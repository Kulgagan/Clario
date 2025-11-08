import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Pause, Play, SkipForward, Volume2 } from "lucide-react";
import Visualizer from "@/components/Visualizer";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { api } from "@/lib/api";

const Session = () => {
  const [playing, setPlaying] = useState(true);
  const [volume, setVolume] = useState([70]);
  const [focusLevel, setFocusLevel] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [alphaBetaRatio, setAlphaBetaRatio] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

  // Connect to WebSocket and handle live updates
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(api.getWebSocketUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("WebSocket connected");
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.focus_percentage !== undefined) {
              setFocusLevel(data.focus_percentage);
              setAlphaBetaRatio(data.alpha_beta_ratio || 0);
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          toast.error("Connection error. Trying to reconnect...");
        };

        ws.onclose = () => {
          console.log("WebSocket closed");
          setIsConnected(false);
          // Try to reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error("Failed to connect WebSocket:", error);
        toast.error("Failed to connect to live feed");
      }
    };

    // Check if device is connected first
    api.getStatus()
      .then((status) => {
        if (status.is_connected) {
          connectWebSocket();
          setFocusLevel(status.focus_percentage);
          setAlphaBetaRatio(status.alpha_beta_ratio);
        } else {
          toast.error("Device not connected. Redirecting to connect page...");
          setTimeout(() => navigate("/connect"), 2000);
        }
      })
      .catch(() => {
        toast.error("Failed to check device status");
        setTimeout(() => navigate("/connect"), 2000);
      });

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [navigate]);

  const getFocusColor = () => {
    if (focusLevel < 40) return "text-destructive";
    if (focusLevel < 70) return "text-accent";
    return "text-primary";
  };

  const getFocusLabel = () => {
    if (focusLevel < 40) return "Distracted";
    if (focusLevel < 70) return "Focused";
    return "Deep Focus";
  };

  const handleEndSession = async () => {
    try {
      await api.disconnect();
      toast.success("Session ended");
      navigate("/");
    } catch (error) {
      toast.error("Failed to disconnect");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted flex flex-col relative overflow-hidden">
      {/* Animated background responding to focus */}
      <div className="absolute inset-0">
        <div 
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl transition-all duration-1000"
          style={{ 
            backgroundColor: `hsla(${focusLevel > 70 ? '185, 70%, 50%' : focusLevel > 40 ? '170, 60%, 55%' : '0, 70%, 60%'}, 0.15)`,
            transform: `scale(${0.8 + (focusLevel / 100) * 0.4})`
          }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl transition-all duration-1000"
          style={{ 
            backgroundColor: `hsla(${focusLevel > 70 ? '170, 60%, 55%' : focusLevel > 40 ? '195, 60%, 65%' : '20, 70%, 60%'}, 0.15)`,
            animationDelay: "1s",
            transform: `scale(${0.7 + (focusLevel / 100) * 0.5})`
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={handleEndSession}
            className="hover:bg-card/50"
          >
            End Session
          </Button>
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <Volume2 className="w-5 h-5 text-muted-foreground" />
          <Slider
            value={volume}
            onValueChange={setVolume}
            max={100}
            step={1}
            className="w-32"
          />
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Focus indicator */}
        <div className="mb-12 text-center">
          <div className="mb-4">
            <div className={`text-7xl font-bold transition-colors duration-500 ${getFocusColor()}`}>
              {Math.round(focusLevel)}%
            </div>
          </div>
          <div className={`text-xl font-medium transition-colors duration-500 ${getFocusColor()}`}>
            {getFocusLabel()}
          </div>
        </div>

        {/* Visualizer */}
        <div className="w-full max-w-4xl mb-12">
          <Visualizer />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6">
          <Button
            variant="outline"
            size="icon"
            className="w-12 h-12 rounded-full border-2"
          >
            <SkipForward className="w-5 h-5" />
          </Button>

          <Button
            size="icon"
            onClick={() => setPlaying(!playing)}
            className="w-16 h-16 rounded-full shadow-lg hover:shadow-glow transition-all duration-300"
          >
            {playing ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-1" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="w-12 h-12 rounded-full border-2"
          >
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>

        {/* Status text */}
        <p className="mt-8 text-muted-foreground text-sm">
          {playing ? "Music adapting to your focus level..." : "Paused"}
        </p>
      </main>
    </div>
  );
};

export default Session;
