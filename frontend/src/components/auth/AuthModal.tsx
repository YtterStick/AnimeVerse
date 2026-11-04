import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Film, AlertTriangle, AlertCircle } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "signup";
}

export function AuthModal({ isOpen, onClose, defaultTab = "signin" }: AuthModalProps) {
  const { isConfigured, signInWithEmail, signUpWithEmail } = useAuth();

  const [activeTab, setActiveTab] = useState<"signin" | "signup">(defaultTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (activeTab === "signin") {
        await signInWithEmail(email, password);
        onClose();
      } else {
        await signUpWithEmail(email, password);
        setMessage("Verification email sent! Please check your inbox.");
      }
    } catch (err: any) {
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };



  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px] bg-card border border-border/80 text-foreground p-6 rounded-2xl">
        <DialogHeader className="flex flex-col items-center text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-md">
            <Film className="w-5 h-5 text-white" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-white">
            Welcome to AniVerse
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Sign in to sync watch progress and watchlist favorites.
          </DialogDescription>
        </DialogHeader>

        {/* Warning if Supabase is not configured */}
        {!isConfigured ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3 text-amber-200 text-xs leading-normal my-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-300">Supabase Not Configured</p>
              <p className="mt-0.5 text-amber-200/80">
                Auth features are disabled because the environment variables are not set. Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.local.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Tabs (Sign In / Sign Up) */}
            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as "signin" | "signup")}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 bg-secondary/80 rounded-lg p-1 border border-border/40">
                <TabsTrigger value="signin" className="rounded-md py-1.5 text-xs font-semibold">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-md py-1.5 text-xs font-semibold">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              {/* Form submit handler wrapper */}
              <form onSubmit={handleSubmit} className="space-y-3.5 pt-4">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex gap-2 text-destructive text-xs">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {message && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-emerald-300 text-xs">
                    {message}
                  </div>
                )}

                <div className="space-y-1">
                  <Input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-secondary/60 border-border/80 focus:border-primary text-sm h-10 px-3"
                  />
                </div>
                <div className="space-y-1">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="bg-secondary/60 border-border/80 focus:border-primary text-sm h-10 px-3"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-primary hover:bg-primary/95 text-white font-semibold rounded-lg shadow-md transition-all mt-2"
                >
                  {loading
                    ? "Processing..."
                    : activeTab === "signin"
                    ? "Sign In"
                    : "Create Account"}
                </Button>

                {activeTab === "signup" && (
                  <p className="text-[10px] text-muted-foreground/60 text-center pt-1">
                    By signing up, you agree to our terms of service.
                  </p>
                )}
              </form>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AuthModal;
