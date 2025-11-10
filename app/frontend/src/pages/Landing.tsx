import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Brain, Waves } from "lucide-react";
import Logo from "./claro_nobg.png";

const Landing = () => {
  const navigate = useNavigate();
  // Landing remains visible; button below routes to Connect

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        {/* Logo/Icon */}
        <div className="mb-2">
          <div className="relative">
            <img
              src={Logo}
              alt="Clario logo"
              className="w-36 h-36 md:w-48 md:h-48 object-contain drop-shadow-md"
            />
          </div>
        </div>

        {/* Hero content */}
        <div className="max-w-3xl animate-fade-in-up">
          <p className="text-lg md:text-xl text-muted-foreground mb-8 md:mb-10 max-w-xl mx-auto leading-relaxed">
            <b>Be calm. Stay focused. Perform your best.</b>
          </p>

          <Button
            size="lg"
            onClick={() => navigate("/connect")}
            className="mt-2 px-10 py-6 text-lg rounded-full shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105"
          >
            Start
          </Button>
        </div>

        {/* Features preview */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-4xl w-full">
          <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-300 text-center hover:translate-y-0.5">
            <Brain className="w-10 h-10 text-primary mb-4 mx-auto" strokeWidth={1.5} />
            <h3 className="font-semibold text-lg mb-2">EEG Detection</h3>
            <p className="text-sm text-muted-foreground">Real-time brain activity monitoring</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-300 text-center hover:translate-y-0.5">
            <Waves className="w-10 h-10 text-accent mb-4 mx-auto" strokeWidth={1.5} />
            <h3 className="font-semibold text-lg mb-2">Adaptive Music</h3>
            <p className="text-sm text-muted-foreground">Music that responds to your focus</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-300 text-center hover:translate-y-0.5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent mb-4 mx-auto animate-scale-pulse" />
            <h3 className="font-semibold text-lg mb-2">Flow State</h3>
            <p className="text-sm text-muted-foreground">Achieve peak performance effortlessly</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
