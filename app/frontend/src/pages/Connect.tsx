import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Bluetooth, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const Connect = () => {
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const [calPhase, setCalPhase] = useState<'idle'|'relax'|'task'|'done'>('idle');
  const [calSeconds, setCalSeconds] = useState<number>(60);
  const [calInterval, setCalInterval] = useState<number | null>(null);
  const [quizDone, setQuizDone] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  // Check connection status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await api.getStatus();
        if (status.is_connected) {
          setIsConnected(true);
          toast.info("Device already connected");
        }
      } catch (error) {
        // Ignore errors on initial check
      }
    };
    checkStatus();
    // Load existing quiz + calibration state
    try {
      const saved = localStorage.getItem("musicProfileAnswers");
      const savedInfo = localStorage.getItem("musicProfileInfo");
      const savedCal = localStorage.getItem("calibrationMidpoint");
      if (saved) {
        setAnswers(JSON.parse(saved) || {});
        setQuizDone(true);
      }
      if (savedCal) {
        // calibration already done previously
      }
      if (savedInfo) {
        // noop: Session page sends this on WS open
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
    if (has("q1", "both") || has("q1", "autism")) profile = "sensory"; else if (has("q1", "adhd")) profile = "adhd";
    const q6 = (a["q6"] || "").toLowerCase();
    if (q6.includes("very") || q6.includes("moderately")) {
      profile = profile === "adhd" ? profile : "sensory";
      o.brightness = 0.08; o.drone_cut = 400; o.drone_gain = 0.045;
    } else if (q6.includes("slightly")) { o.brightness = 0.10; }
    const q8 = (a["q8"] || "").toLowerCase();
    if (q8.includes("very") || q8.includes("extremely")) {
      o.hold_bars = Math.max(o.hold_bars || 0, 40);
      o.epsilon = Math.min(o.epsilon ?? 1, 0.06);
      o.tempo = Math.min(o.tempo || 48, 48);
      if (profile === "none") profile = "sensory";
    }
    const restlessCount = ["q3", "q4", "q5"].reduce((acc, k) => {
      const v = (a[k] || "").toLowerCase();
      return acc + (v.includes("frequently") || v.includes("constantly") ? 1 : 0);
    }, 0);
    if (restlessCount >= 2) {
      profile = "adhd";
      o.tempo = Math.max(o.tempo || 0, 52);
      o.hold_bars = Math.min(o.hold_bars || 24, 32);
      o.epsilon = Math.max(o.epsilon || 0.12, 0.10);
      o.brightness = Math.max(o.brightness || 0.16, 0.16);
    }
    const q2 = (a["q2"] || "").toLowerCase();
    if (q2 && !q2.includes("not applicable")) {
      o.hold_bars = Math.max(o.hold_bars || 0, 36);
      o.epsilon = Math.min(o.epsilon ?? 1, 0.08);
    }
    return { profile, overrides: o };
  };

  const handleConnect = async () => {
    if (isConnected) {
      const hasCal = !!localStorage.getItem('calibrationMidpoint');
      if (!hasCal) { setShowCal(true); return; }
      if (quizDone) navigate("/session"); else setShowQuiz(true);
      return;
    }

    setConnecting(true);
    toast.info("Searching for Muse 2 device...");
    
    try {
      await api.connect();
      toast.success("Connected to Muse 2!");
      setIsConnected(true);
      // After connect, run calibration first if not done, then quiz
      const hasCal = !!localStorage.getItem('calibrationMidpoint');
      if (!hasCal) { setShowCal(true); return; }
      if (!quizDone) { setShowQuiz(true); return; }
      navigate("/session");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect to device");
      setConnecting(false);
    }
  };

  const handleAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const submitQuiz = () => {
    const info = deriveProfile(answers);
    try {
      localStorage.setItem("musicProfileAnswers", JSON.stringify(answers));
      localStorage.setItem("musicProfileInfo", JSON.stringify(info));
    } catch {}
    setQuizDone(true);
    setShowQuiz(false);
    toast.success("Preferences saved. Starting your session.");
    navigate("/session");
  };

  // ===== Calibration flow =====
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
      // After calibration, continue to preferences if needed
      if (!quizDone) setShowQuiz(true); else navigate('/session');
    } catch {
      toast.error('Failed to finalize calibration');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted flex items-center justify-center px-6 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: "1.5s" }} />
      </div>

      <div className="relative z-10 text-center max-w-lg w-full">
        {/* Connection status indicator */}
        <div className="mb-8 flex justify-center">
          <div className={`relative ${connecting ? 'animate-scale-pulse' : ''}`}>
            {isConnected ? (
              <CheckCircle2 className="w-24 h-24 text-primary" strokeWidth={1.5} />
            ) : (
              <>
                <Bluetooth className="w-24 h-24 text-primary" strokeWidth={1.5} />
                {connecting && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Connect Your Muse 2
        </h1>

        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
          {isConnected
            ? "Device connected! Ready to start your focus session."
            : connecting 
            ? "Establishing connection with your device..." 
            : "Make sure your Muse 2 headband is powered on and nearby."
          }
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={handleConnect}
            disabled={connecting}
            className="px-10 py-6 text-lg rounded-full shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Connecting...
              </>
            ) : isConnected ? (
              quizDone ? "Start Session" : "Continue to Preferences"
            ) : (
              "Connect Device"
            )}
          </Button>
          {isConnected && (
            <Button
              variant="outline"
              onClick={() => {
                try { if (calInterval) { window.clearInterval(calInterval); setCalInterval(null); } } catch {}
                setCalPhase('idle');
                setCalSeconds(60);
                setShowCal(true);
                toast.info('Recalibration will re-learn your neutral focus point.');
              }}
              disabled={connecting}
              className="px-6 py-6 rounded-full"
            >
              Recalibrate
            </Button>
          )}
        </div>

        <div className="mt-12 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50">
          <h3 className="font-semibold mb-3">Connection Tips</h3>
          <ul className="text-sm text-muted-foreground space-y-2 text-left">
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span>Ensure Bluetooth is enabled on your device</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span>Place the Muse 2 headband on your forehead</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span>Keep the headband within 10 feet of your device</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Pre-session Calibration Dialog */}
      <Dialog open={showCal} onOpenChange={setShowCal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calibrate Neutral Focus</DialogTitle>
          </DialogHeader>
          {calPhase === 'idle' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We’ll measure your baseline in two 1-minute steps:
              </p>
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
              <MathTask seconds={calSeconds} onStart={startTask} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pre-session Questionnaire Dialog */}
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
            <Button onClick={submitQuiz}>Save & Start Session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Lightweight math task component
const MathTask = ({ seconds, onStart }: { seconds: number; onStart: () => void }) => {
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

  const submit = () => {
    // No need to validate; this is just to keep engagement
    newProblem();
  };

  if (!started) {
    return <Button onClick={() => { setStarted(true); onStart(); }}>Start Task</Button>;
  }

  return (
    <div className="space-y-3">
      <div className="text-2xl font-semibold">{seconds}s</div>
      <div className="text-xl">
        {a} {op} {b} = ?
      </div>
      <div className="flex gap-2">
        <input className="border rounded px-3 py-2 w-32 bg-background" value={ans} onChange={(e) => setAns(e.target.value)} onKeyDown={(e) => { if (e.key==='Enter') submit(); }} />
        <Button onClick={submit}>Next</Button>
      </div>
    </div>
  );
};

export default Connect;
