import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Film,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ChevronDown,
  Mail,
} from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "signup";
}

function isEmailRateLimitError(msg: string): boolean {
  return /rate\s*limit|too\s*many|over_email_send|429|email.*limit/i.test(msg);
}

export function AuthModal({ isOpen, onClose, defaultTab = "signin" }: AuthModalProps) {
  const { isConfigured, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"signin" | "signup">(defaultTab);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setShowEmailForm(false);
      setError(null);
      setRateLimited(false);
      setMessage(null);
      setLoading(false);
      setGoogleLoading(false);
    }
  }, [isOpen, defaultTab]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setRateLimited(false);
    setMessage(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Browser will redirect to Google's authentication page
    } catch (err: any) {
      setError(err.message || "Failed to initiate Google sign in.");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRateLimited(false);
    setMessage(null);
    setLoading(true);

    try {
      if (activeTab === "signin") {
        await signInWithEmail(email, password);
        toast.success("Signed in to AniVerse");
        onClose();
      } else {
        const result = await signUpWithEmail(email, password);
        if (result.needsEmailConfirmation) {
          setMessage(
            "Verification email sent! Please check your inbox (or Spam folder) to activate your account."
          );
        } else {
          toast.success("Account created! Welcome to AniVerse.");
          onClose();
        }
      }
    } catch (err: any) {
      const rawMsg = err?.message || "An authentication error occurred.";
      if (isEmailRateLimitError(rawMsg)) {
        setRateLimited(true);
        setError(
          "Email signup limit reached right now. Use Continue with Google above for instant 1-click access — no verification email needed!"
        );
      } else if (/email not confirmed/i.test(rawMsg)) {
        setError(
          "Your email isn't verified yet. Check your inbox/Spam folder, or use Continue with Google above instead."
        );
      } else {
        setError(rawMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[430px] bg-card border border-border/80 text-foreground p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="flex flex-col items-center text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-md">
            <Film className="w-5 h-5 text-white" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-white">
            Welcome to AniVerse
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Sign in to sync your watch history, comments, and watchlist across devices.
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
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex flex-col gap-2 text-destructive text-xs">
                <div className="flex gap-2 items-start">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
                {rateLimited && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                    className="w-full h-8 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-lg text-xs cursor-pointer"
                  >
                    {googleLoading ? "Connecting to Google..." : "Continue with Google Instead"}
                  </Button>
                )}
              </div>
            )}
            {message && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-emerald-300 text-xs leading-relaxed">
                {message}
              </div>
            )}

            {/* Primary & Recommended: Continue with Google */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Recommended • Instant &amp; No Email Wait
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                  1-Click
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={loading || googleLoading}
                onClick={handleGoogleSignIn}
                className="w-full h-11 bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer select-none"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span className="text-xs sm:text-sm font-semibold text-slate-800">
                  {googleLoading ? "Connecting to Google..." : "Continue with Google"}
                </span>
              </Button>

              <p className="text-[11px] text-muted-foreground/85 text-center leading-snug">
                Your Gmail name &amp; photo stay private — you get a random anime profile you can customize anytime.
              </p>
            </div>

            {/* Secondary Collapsible Email & Password Section */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowEmailForm((prev) => !prev)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Or sign in / sign up with email</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    showEmailForm ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showEmailForm && (
                <div className="pt-3 animate-fade-in">
                  <Tabs
                    value={activeTab}
                    onValueChange={(val) => {
                      setActiveTab(val as "signin" | "signup");
                      setError(null);
                      setRateLimited(false);
                      setMessage(null);
                    }}
                    className="w-full"
                  >
                    <TabsList className="grid grid-cols-2 bg-secondary/80 rounded-lg p-1 border border-border/40">
                      <TabsTrigger value="signin" className="rounded-md py-1.5 text-xs font-semibold cursor-pointer">
                        Sign In
                      </TabsTrigger>
                      <TabsTrigger value="signup" className="rounded-md py-1.5 text-xs font-semibold cursor-pointer">
                        Sign Up
                      </TabsTrigger>
                    </TabsList>

                    <form onSubmit={handleSubmit} className="space-y-3 pt-3">
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
                          placeholder="Password (min 6 characters)"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="bg-secondary/60 border-border/80 focus:border-primary text-sm h-10 px-3"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={loading || googleLoading}
                        className="w-full h-10 bg-primary hover:bg-primary/95 text-white font-semibold rounded-lg shadow-md transition-all mt-1 cursor-pointer"
                      >
                        {loading
                          ? "Processing..."
                          : activeTab === "signin"
                          ? "Sign In with Email"
                          : "Create Account"}
                      </Button>

                      {activeTab === "signup" && (
                        <p className="text-[10px] text-muted-foreground/70 text-center pt-0.5 leading-snug">
                          Tip: Google Sign-In above works instantly with no email verification limits.
                        </p>
                      )}
                    </form>
                  </Tabs>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AuthModal;
