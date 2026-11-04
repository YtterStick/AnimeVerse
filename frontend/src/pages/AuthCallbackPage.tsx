import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase client automatically handles hash fragments or code exchanges in the background.
    // We listen to the session state and redirect to home once loaded.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/", { replace: true });
      } else if (event === "SIGNED_OUT") {
        navigate("/", { replace: true });
      }
    });

    // Timeout redirection fallback if no session is detected after 4 seconds
    const timer = setTimeout(() => {
      navigate("/", { replace: true });
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-32 w-full flex-1 flex flex-col items-center justify-center text-center space-y-4 page-enter">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <div className="space-y-1">
        <h1 className="text-lg font-bold text-white">Completing Sign In</h1>
        <p className="text-xs text-muted-foreground">
          Setting up your session. You will be redirected shortly...
        </p>
      </div>
    </div>
  );
}

export default AuthCallbackPage;
