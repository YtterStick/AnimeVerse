import { Link } from "react-router-dom";
import { ShieldCheck, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-8 page-enter">
      {/* Header */}
      <div className="space-y-3 border-b border-border/40 pb-6">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground hover:text-white">
          <Link to="/" className="flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </Button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Privacy Policy
            </h1>
            <p className="text-xs text-muted-foreground">
              Last updated: November 2026
            </p>
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        {/* Section 1 */}
        <section className="space-y-3 bg-card/40 border border-border/40 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-primary/20 text-primary text-xs font-mono font-extrabold flex items-center justify-center">
              1
            </span>
            Information We Collect
          </h2>
          <p>AniVerse is designed with privacy in mind. We only collect the minimal information necessary to deliver viewing functionality:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs sm:text-sm">
            <li><strong>Account Data:</strong> If you sign up via Supabase Auth (email or Google OAuth), we store your user ID and email address to manage your session.</li>
            <li><strong>Watch History:</strong> Progress timestamps, duration, and episode numbers are saved so you can resume watching across devices.</li>
            <li><strong>Watchlist:</strong> Anime titles added to your favorites list.</li>
            <li><strong>App Preferences:</strong> Display settings such as English / Japanese Romaji title language toggles and playback preferences stored locally on your device.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-3 bg-card/40 border border-border/40 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-primary/20 text-primary text-xs font-mono font-extrabold flex items-center justify-center">
              2
            </span>
            Local Storage &amp; Cookies
          </h2>
          <p>
            We use browser <code className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">localStorage</code> to deliver 0-latency playback resumption for guest sessions and persist client-side UI configurations. We do not use third-party advertising cookies or cross-site tracking scripts.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-3 bg-card/40 border border-border/40 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-primary/20 text-primary text-xs font-mono font-extrabold flex items-center justify-center">
              3
            </span>
            Data Protection &amp; Security
          </h2>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-start gap-3 text-emerald-300 text-xs">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Your data is never sold, traded, or monetized to data brokers or advertising networks. Authentication and storage are guarded by Supabase enterprise-grade Row Level Security (RLS) policies.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3 bg-card/40 border border-border/40 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-primary/20 text-primary text-xs font-mono font-extrabold flex items-center justify-center">
              4
            </span>
            User Control &amp; Data Deletion
          </h2>
          <p>
            You have full autonomy over your data at all times. You can clear individual history items, wipe your entire watch history in one click on the History page, or remove anime from your watchlist anytime.
          </p>
        </section>
      </div>

      <div className="pt-6 border-t border-border/30 flex justify-between items-center text-xs text-muted-foreground">
        <span>&copy; {new Date().getFullYear()} AniVerse. All rights reserved.</span>
        <Link to="/terms" className="text-primary hover:underline">
          View Terms of Service &rarr;
        </Link>
      </div>
    </div>
  );
}

export default PrivacyPage;
