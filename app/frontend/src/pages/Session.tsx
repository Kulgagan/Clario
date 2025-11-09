import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import Visualizer from "@/components/Visualizer";
import { Slider } from "@/components/ui/slider";
import { Pause, Play, SkipForward, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const Session = () => {
  // UI state
  const [playing, setPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number[]>([70]);
  const [focusLevel, setFocusLevel] = useState<number>(0);
  const [alphaBetaRatio, setAlphaBetaRatio] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [showQuiz, setShowQuiz] = useState<boolean>(false);
  const [quizDone, setQuizDone] = useState<boolean>(false);
  const [pendingPlay, setPendingPlay] = useState<boolean>(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [profileInfo, setProfileInfo] = useState<{ profile: string; overrides: Record<string, number> } | null>(null);

  // Audio + WS refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const musicWsRef = useRef<WebSocket | null>(null);

  // timers
  const statusTimerRef = useRef<number | null>(null);
  const focusPushTimerRef = useRef<number | null>(null);

  // debug HUD
  const [audioReady, setAudioReady] = useState(false);
  const [workletLoaded, setWorkletLoaded] = useState(false);
  const [wsState, setWsState] = useState<"idle" | "open" | "error" | "closed">("idle");
  const [lastChunkBytes, setLastChunkBytes] = useState(0);
  const [lastChunkAmp, setLastChunkAmp] = useState(0);
  const [lastError, setLastError] = useState<string>("");
  // Calibration state
  const [showCal, setShowCal] = useState(false);
  const [calPhase, setCalPhase] = useState<'idle'|'relax'|'task'|'done'>('idle');
  const [calSeconds, setCalSeconds] = useState<number>(60);
  const [calInterval, setCalInterval] = useState<number | null>(null);

  // Keep dashboard metrics fresh
  useEffect(() => {
    const tick = async () => {
      try {
        const s = await api.getStatus();
        setIsConnected(s.is_connected);
        setIsStreaming(s.is_streaming);
        if (typeof s.focus_percentage === "number") {
          setFocusLevel(Math.max(0, Math.min(100, s.focus_percentage)));
        }
        if (typeof s.alpha_beta_ratio === "number") setAlphaBetaRatio(s.alpha_beta_ratio);
      } catch {
        // ignore
      }
    };
    tick();
    statusTimerRef.current = window.setInterval(tick, 1000) as unknown as number;
    return () => {
      if (statusTimerRef.current) {
        window.clearInterval(statusTimerRef.current);
        statusTimerRef.current = null;
      }
    };
  }, []);

  // Questionnaire: load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("musicProfileAnswers");
      const savedInfo = localStorage.getItem("musicProfileInfo");
      if (saved) {
        const a = JSON.parse(saved);
        setAnswers(a || {});
        setQuizDone(true);
      }
      if (savedInfo) {
        const info = JSON.parse(savedInfo);
        if (info && info.profile) setProfileInfo(info);
      }
    } catch {}
  }, []);

  type Question = { id: string; question: string; options: string[] };
  const questions: Question[] = [
    {
      id: "q1",
      question: "Do you have a diagnosed learning disability?",
      options: [
        "No, I do not have a learning disability",
        "Yes, I have ADHD (Attention Deficit Hyperactivity Disorder)",
        "Yes, I have Autism Spectrum Disorder (ASD)",
        "Yes, I have both ADHD and Autism",
        "Yes, I have a different learning disability",
        "I am not sure / Prefer not to answer",
      ],
    },
    {
      id: "q2",
      question:
        "If you have a learning disability, which specific type? (Select 'Not applicable' if you don't have one)",
      options: [
        "Not applicable",
        "Dyslexia",
        "Dyscalculia",
        "Dysgraphia",
        "Auditory Processing Disorder",
        "Visual Processing Disorder",
        "Non-Verbal Learning Disability",
        "Other learning disability",
      ],
    },
    {
      id: "q3",
      question: "How often do you experience difficulty maintaining focus or attention on tasks?",
      options: [
        "Rarely or never",
        "Occasionally (a few times a week)",
        "Frequently (daily or most days)",
        "Constantly (throughout most of the day)",
      ],
    },
    {
      id: "q4",
      question: "How often do you experience restlessness or difficulty sitting still?",
      options: ["Rarely or never", "Occasionally", "Frequently", "Constantly"],
    },
    {
      id: "q5",
      question: "How often do you have difficulty organizing tasks or managing time?",
      options: ["Rarely or never", "Occasionally", "Frequently", "Constantly"],
    },
    {
      id: "q6",
      question: "How sensitive are you to sensory stimuli (sounds, lights, textures, smells)?",
      options: [
        "Not sensitive at all",
        "Slightly sensitive",
        "Moderately sensitive",
        "Very sensitive (often overwhelming)",
      ],
    },
    {
      id: "q7",
      question: "How often do you experience difficulty with social interactions or understanding social cues?",
      options: ["Rarely or never", "Occasionally", "Frequently", "Constantly"],
    },
    {
      id: "q8",
      question: "How important are routines and predictability in your daily life?",
      options: [
        "Not important - I'm flexible with changes",
        "Somewhat important",
        "Very important - I prefer routines",
        "Extremely important - changes are very difficult",
      ],
    },
  ];

  const deriveProfile = (a: Record<string, string>): { profile: string; overrides: Record<string, number> } => {
    const o: Record<string, number> = {};
    let profile: string = "none";

    const has = (id: string, s: string) => (a[id] || "").toLowerCase().includes(s.toLowerCase());

    // Map q1 primary
    if (has("q1", "both") || has("q1", "autism")) profile = "sensory"; // ASD => sensory-friendly
    else if (has("q1", "adhd")) profile = "adhd";

    // Sensory sensitivity (q6)
    const q6 = (a["q6"] || "").toLowerCase();
    if (q6.includes("very") || q6.includes("moderately")) {
      profile = profile === "adhd" ? profile : "sensory"; // tilt toward sensory if not adhd-dominant
      o.brightness = 0.08; // darker timbre
      o.drone_cut = 400; // fewer highs
      o.drone_gain = 0.045; // lower dynamics
    } else if (q6.includes("slightly")) {
      o.brightness = 0.10;
    }

    // Need for routine (q8)
    const q8 = (a["q8"] || "").toLowerCase();
    if (q8.includes("very") || q8.includes("extremely")) {
      o.hold_bars = Math.max(o.hold_bars || 0, 40);
      o.epsilon = Math.min(o.epsilon ?? 1, 0.06);
      o.tempo = Math.min(o.tempo || 48, 48); // keep slow
      if (profile === "none") profile = "sensory"; // prefer stability
    }

    // Restlessness / attention lapses (q3, q4, q5)
    const restlessCount = ["q3", "q4", "q5"].reduce((acc, k) => {
      const v = (a[k] || "").toLowerCase();
      return acc + (v.includes("frequently") || v.includes("constantly") ? 1 : 0);
    }, 0);
    if (restlessCount >= 2) {
      profile = "adhd";
      o.tempo = Math.max(o.tempo || 0, 52); // subtle pulse via slightly higher tempo
      o.hold_bars = Math.min(o.hold_bars || 24, 32);
      o.epsilon = Math.max(o.epsilon || 0.12, 0.10);
      o.brightness = Math.max(o.brightness || 0.16, 0.16);
    }

    // Specific LD types (q2) => prefer stability
    const q2 = (a["q2"] || "").toLowerCase();
    if (q2 && !q2.includes("not applicable")) {
      o.hold_bars = Math.max(o.hold_bars || 0, 36);
      o.epsilon = Math.min(o.epsilon ?? 1, 0.08);
    }

    return { profile, overrides: o };
  };

  // Start/stop adaptive music
  useEffect(() => {
    const startMusic = async () => {
    try {
      // AudioContext + Worklet
      // @ts-ignore
      const ACtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new ACtx();
      audioCtxRef.current = ctx;
      await ctx.audioWorklet.addModule('/worklets/pcm-player.js');
      await ctx.resume();

      // Worklet -> Gain -> Destination
      const node = new AudioWorkletNode(ctx, 'pcm-player', { numberOfOutputs: 1 });
      workletRef.current = node;

      const gain = ctx.createGain();
      gain.gain.value = 1.0;
      node.connect(gain);
      gain.connect(ctx.destination);

      // helper to fade and teardown
      const fadeAndClose = async () => {
        try {
          // tell worklet to flush and fade
          node.port.postMessage({ type: 'flush' });
        } catch {}
        try {
          const now = ctx.currentTime;
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        } catch {}
        try { node.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
        try { await ctx.close(); } catch {}
        workletRef.current = null;
        audioCtxRef.current = null;
      };

      // WebSocket
      const ws = new WebSocket(api.getMusicWebSocketUrl());
      ws.binaryType = "arraybuffer";
      musicWsRef.current = ws;

      ws.onopen = () => {
        try {
          ws.send(JSON.stringify({ type: "focus", value: focusLevel }));
          ws.send(JSON.stringify({ type: "volume", value: (volume?.[0] ?? 70) / 100 }));
          // Send profile preferences if available
          const info = profileInfo || (() => {
            try {
              const savedInfo = localStorage.getItem("musicProfileInfo");
              return savedInfo ? JSON.parse(savedInfo) : null;
            } catch { return null; }
          })();
          if (info && info.profile) {
            ws.send(
              JSON.stringify({ type: "profile", profile: info.profile, overrides: info.overrides || {} })
            );
          }
        } catch {}
      };

      ws.onmessage = (ev) => {
        if (ev.data instanceof ArrayBuffer) {
          // pass raw buffer; worklet copies & caps internally
          workletRef.current?.port.postMessage({ type: 'chunk', payload: ev.data }, [ev.data]);
        } else {
          // optional: handle text control messages
          // const msg = JSON.parse(ev.data);
        }
      };

      ws.onerror = () => {
        toast.error("Music connection error.");
      };

      ws.onclose = () => {
        // Immediate local stop when server disappears
        fadeAndClose();
        setPlaying(false);
        toast.info("Music connection closed.");
      };

      // push focus periodically
      focusPushTimerRef.current = window.setInterval(() => {
        try {
          musicWsRef.current?.send(JSON.stringify({ type: "focus", value: focusLevel }));
        } catch {}
      }, 750) as unknown as number;

      // ensure our teardown runs if the tab suspends or user navigates
      window.addEventListener('beforeunload', fadeAndClose);

      // store a ref to the local teardown so stopMusic can call it
      (node as any)._fadeAndClose = fadeAndClose;

    } catch (err) {
      toast.error("Failed to start adaptive music.");
      setPlaying(false);
      }
    };

    const stopMusic = () => {
    try { musicWsRef.current?.send(JSON.stringify({ type: "stop" })); } catch {}
    try { musicWsRef.current?.close(); } catch {}
    musicWsRef.current = null;

    if (focusPushTimerRef.current) {
      window.clearInterval(focusPushTimerRef.current);
      focusPushTimerRef.current = null;
    }

    try { workletRef.current?.port.postMessage({ type: 'flush' }); } catch {}
    try {
      // if we stored the local fade helper:
      const fadeAndClose = (workletRef.current as any)?._fadeAndClose;
      if (typeof fadeAndClose === 'function') fadeAndClose();
    } catch {}
    try { workletRef.current?.disconnect(); } catch {}
    workletRef.current = null;

    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;

    window.removeEventListener('beforeunload', () => {});
    };


    if (playing) startMusic();
    else stopMusic();

    return () => stopMusic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // UI handlers
  const togglePlay = () => setPlaying((p) => !p);

  const handleVolumeChange = (v: number[]) => {
    setVolume(v);
    try {
      musicWsRef.current?.send(JSON.stringify({ type: "volume", value: v[0] / 100 }));
    } catch {}
  };

  const skipGenre = () => {
    try {
      musicWsRef.current?.send(JSON.stringify({ type: "skip" }));
    } catch {}
  };

  // ===== Calibration flow (Session) =====
  const startCountdown = (seconds: number, onDone: () => void) => {
    setCalSeconds(seconds);
    const id = window.setInterval(() => {
      setCalSeconds((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          setCalInterval(null);
          onDone();
          return 0;
        }
        return s - 1;
      });
    }, 1000) as unknown as number;
    setCalInterval(id);
  };

  const startRelax = async () => {
    try {
      await api.startCalibration('relax');
      setCalPhase('relax');
      startCountdown(60, stopRelax);
    } catch {
      toast.error('Failed to start relax calibration');
    }
  };

  const stopRelax = async () => {
    try { await api.stopCalibration('relax'); } catch {}
    setCalPhase('task');
    setCalSeconds(60);
  };

  const startTask = async () => {
    try {
      await api.startCalibration('task');
      setCalPhase('task');
      startCountdown(60, stopTask);
    } catch {
      toast.error('Failed to start task calibration');
    }
  };

  const stopTask = async () => {
    try { await api.stopCalibration('task'); } catch {}
    try {
      const res = await api.commitCalibration();
      localStorage.setItem('calibrationMidpoint', String(res.midpoint));
      toast.success('Calibration complete');
      setCalPhase('done');
      setShowCal(false);
    } catch {
      toast.error('Failed to finalize calibration');
    }
  };

  const handleAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const submitQuiz = () => {
    const info = deriveProfile(answers);
    setProfileInfo(info);
    setQuizDone(true);
    setShowQuiz(false);
    try {
      localStorage.setItem("musicProfileAnswers", JSON.stringify(answers));
      localStorage.setItem("musicProfileInfo", JSON.stringify(info));
    } catch {}
    try {
      if (musicWsRef.current && musicWsRef.current.readyState === WebSocket.OPEN) {
        musicWsRef.current.send(
          JSON.stringify({ type: "profile", profile: info.profile, overrides: info.overrides || {} })
        );
      }
    } catch {}
    if (pendingPlay) {
      setPendingPlay(false);
      setPlaying(true);
    }
    toast.success("Preferences saved. Tailoring music to you.");
  };

  // Local test: push a 1s 440Hz tone into the worklet (bypasses the WS)
  const testTone = async () => {
    try {
      if (!audioCtxRef.current) {
        const ACtx: typeof AudioContext =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new ACtx();
        audioCtxRef.current = ctx;
        await ctx.audioWorklet.addModule("/worklets/pcm-player.js");
        await ctx.resume();
        const node = new AudioWorkletNode(ctx, "pcm-player", { numberOfOutputs: 1 });
        node.connect(ctx.destination);
        workletRef.current = node;
        setAudioReady(true);
        setWorkletLoaded(true);
      }
      const ctx = audioCtxRef.current!;
      const n = Math.floor(ctx.sampleRate * 1.0);
      const buf = new Float32Array(n);
      for (let i = 0; i < n; i++) buf[i] = Math.sin(2 * Math.PI * 440 * (i / ctx.sampleRate)) * 0.2;
      workletRef.current?.port.postMessage({ type: "chunk", payload: buf.buffer }, [buf.buffer]);
      toast.success("Test tone sent");
    } catch (e: any) {
      setLastError(String(e?.message || e));
      toast.error("Test tone failed");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted flex flex-col relative overflow-hidden">
      {/* Animated background responding to focus */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl transition-all duration-1000"
          style={{
            backgroundColor: `hsla(${focusLevel > 70 ? "185, 70%, 50%" : focusLevel > 40 ? "170, 60%, 55%" : "0, 70%, 60%"}, 0.15)`,
            transform: `scale(${0.8 + (focusLevel / 100) * 0.4})`,
          }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl transition-all duration-1000"
          style={{
            backgroundColor: `hsla(${focusLevel > 70 ? "180, 70%, 55%" : focusLevel > 40 ? "160, 60%, 55%" : "20, 80%, 55%"}, 0.12)`,
            transform: `scale(${0.9 + (focusLevel / 100) * 0.3})`,
          }}
        />
      </div>

      <main className="relative z-10 container mx-auto max-w-5xl px-4 py-10">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Focus Session</h1>
            <p className="text-sm text-muted-foreground">
              {isConnected ? (isStreaming ? "Muse connected · streaming" : "Muse connected") : "Muse disconnected"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant={playing ? "secondary" : "default"}
              onClick={togglePlay}
              aria-label={playing ? "Pause adaptive music" : "Play adaptive music"}
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>

            <div className="flex items-center gap-2 ml-2">
              <Volume2 className="w-5 h-5 text-muted-foreground" />
              <div className="w-40">
                <Slider value={volume} max={100} step={1} onValueChange={handleVolumeChange} aria-label="Volume" />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                try { if (calInterval) { window.clearInterval(calInterval); setCalInterval(null); } } catch {}
                setCalPhase('idle');
                setCalSeconds(60);
                setShowCal(true);
                toast.info('Recalibration will re-learn your neutral focus point.');
              }}
            >
              Recalibrate
            </Button>
          </div>
        </header>
        {/* Pre-screening Quiz trigger */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {quizDone
              ? "Preferences loaded. You can retake the quiz anytime."
              : "Please complete a short pre-session questionnaire to tailor the music."}
          </p>
          <Button variant="outline" onClick={() => setShowQuiz(true)}>
            {quizDone ? "Retake Questionnaire" : "Start Questionnaire"}
          </Button>
        </div>
        {/* Focus visual + stats */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border bg-card p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-medium">Focus</h2>
              <span className="text-3xl font-semibold">{Math.round(focusLevel)}%</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">α/β ratio: {alphaBetaRatio.toFixed(2)}</p>
            <div className="mt-6">
              <Visualizer focusLevel={focusLevel} />
            </div>
            <p className="mt-4 text-muted-foreground text-sm">
              {playing ? "Music adapting to your focus level..." : "Paused"}
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-medium mb-3">Adaptive Music</h2>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Infinite, seamless generation (low-latency streaming)</li>
              <li>• RL agent keeps what improves focus, explores when it dips</li>
            </ul>
          </div>
        </section>
        {/* Debug HUD */}
        <div className="mt-8 mb-6 rounded-xl border bg-card p-4 text-sm">
          <div className="font-medium mb-2">Audio Debug</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>Audio ready: <span className="font-mono">{String(audioReady)}</span></div>
            <div>Worklet loaded: <span className="font-mono">{String(workletLoaded)}</span></div>
            <div>WS state: <span className="font-mono">{wsState}</span></div>
            <div>Last chunk: <span className="font-mono">{lastChunkBytes} bytes</span></div>
            <div>Max amp: <span className="font-mono">{lastChunkAmp.toFixed(5)}</span></div>
            <div className="col-span-2 md:col-span-4">
              {lastError && <span className="text-red-500">Error: {lastError}</span>}
            </div>
          </div>
          <div className="mt-3">
            <Button variant="outline" onClick={testTone}>Play 1s Test Tone</Button>
          </div>
        </div>        {/* Questionnaire Dialog */}
        <Dialog open={showQuiz} onOpenChange={setShowQuiz}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Personalize Your Audio</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 max-h-[60vh] overflow-auto pr-2">
              {questions.map((q) => (
                <div key={q.id}>
                  <div className="mb-2 font-medium">{q.question}</div>
                  <RadioGroup
                    value={answers[q.id] || ""}
                    onValueChange={(v) => handleAnswer(q.id, v)}
                    className="space-y-2"
                  >
                    {q.options.map((opt, i) => {
                      const id = `${q.id}-${i}`;
                      return (
                        <div key={id} className="flex items-center space-x-2">
                          <RadioGroupItem id={id} value={opt} />
                          <Label htmlFor={id} className="cursor-pointer">{opt}</Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={submitQuiz}>Save Preferences</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      {/* Calibration Dialog */}
      <Dialog open={showCal} onOpenChange={setShowCal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recalibrate Neutral Focus</DialogTitle>
          </DialogHeader>
          {calPhase === 'idle' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">We’ll measure your baseline in two 1-minute steps:</p>
              <ol className="list-decimal pl-6 text-sm text-muted-foreground space-y-1">
                <li>Relaxation: close your eyes and breathe slowly.</li>
                <li>Mental math: solve simple problems to engage focus.</li>
              </ol>
              <div className="flex justify-end">
                <Button onClick={startRelax}>Start Relaxation</Button>
              </div>
            </div>
          )}
          {calPhase === 'relax' && (
            <div className="space-y-4">
              <p className="text-sm">Relax, breathe slowly. Recording baseline...</p>
              <div className="text-2xl font-semibold">{calSeconds}s</div>
            </div>
          )}
          {calPhase === 'task' && (
            <div className="space-y-4">
              <p className="text-sm">Mental math: solve in your head. Recording focus...</p>
              <SessionMathTask seconds={calSeconds} onStart={startTask} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SessionMathTask = ({ seconds, onStart }: { seconds: number; onStart: () => void }) => {
  const [started, setStarted] = useState(false);
  const [a, setA] = useState<number>(0);
  const [b, setB] = useState<number>(0);
  const [op, setOp] = useState<'+'|'-'>('+');
  const [ans, setAns] = useState('');

  useEffect(() => {
    if (!started) return;
    if (seconds === 60) newProblem();
  }, [started]);

  const newProblem = () => {
    const na = Math.floor(10 + Math.random()*90);
    const nb = Math.floor(10 + Math.random()*90);
    const ops: ('+'|'-')[] = ['+','-'];
    setOp(ops[Math.floor(Math.random()*ops.length)]);
    setA(na); setB(nb); setAns('');
  };

  const submit = () => { newProblem(); };

  if (!started) {
    return <Button onClick={() => { setStarted(true); onStart(); }}>Start Task</Button>;
  }
  return (
    <div className="space-y-3">
      <div className="text-2xl font-semibold">{seconds}s</div>
      <div className="text-xl">{a} {op} {b} = ?</div>
      <div className="flex gap-2">
        <input className="border rounded px-3 py-2 w-32 bg-background" value={ans} onChange={(e) => setAns(e.target.value)} onKeyDown={(e) => { if (e.key==='Enter') submit(); }} />
        <Button onClick={submit}>Next</Button>
      </div>
    </div>
  );
};

export default Session;


