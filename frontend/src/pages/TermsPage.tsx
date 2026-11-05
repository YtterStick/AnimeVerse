import { Link } from "react-router-dom";
import { FileText, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TermsPage() {
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
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Terms of Service
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
            Acceptance of Terms
          </h2>
          <p>
            By accessing or using AniVerse (&ldquo;the Service&rdquo;), you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service. If you do not agree to all provisions contained herein, please discontinue using the Service immediately.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-3 bg-card/40 border border-border/40 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-primary/20 text-primary text-xs font-mono font-extrabold flex items-center justify-center">
              2
            </span>
            Nature of the Service &amp; Content Disclaimer
          </h2>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3 text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              AniVerse does not host, upload, store, or maintain any video files or media on its own servers. All content is indexed from third-party publicly available services across the web.
            </p>
          </div>
          <p>
            AniVerse functions purely as a metadata browser, indexer, and stream resolver. Anime titles, synopsis, images, and schedule data are aggregated from MyAnimeList and AniList public APIs for educational, non-commercial discovery purposes.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-3 bg-card/40 border border-border/40 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-primary/20 text-primary text-xs font-mono font-extrabold flex items-center justify-center">
              3
            </span>
            User Accounts &amp; Data Synchronization
          </h2>
          <p>
            When registering an account with AniVerse via email or OAuth providers (e.g. Google), you agree to maintain the security and confidentiality of your credentials. You are responsible for all activities conducted through your account, including saved watch progress, watchlists, and preferences.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-3 bg-card/40 border border-border/40 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-primary/20 text-primary text-xs font-mono font-extrabold flex items-center justify-center">
              4
            </span>
            Acceptable Use Policy
          </h2>
          <p>When using AniVerse, you agree not to:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs sm:text-sm">
            <li>Engage in automated scraping, denial of service (DoS), or excessive rate limiting abuse.</li>
            <li>Attempt to bypass security features, reverse-engineer, or probe private endpoints.</li>
            <li>Misuse public APIs or distribute malicious payloads through the platform.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-3 bg-card/40 border border-border/40 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-primary/20 text-primary text-xs font-mono font-extrabold flex items-center justify-center">
              5
            </span>
            Limitation of Liability
          </h2>
          <p>
            AniVerse is provided &ldquo;as is&rdquo; without warranties of any kind, whether express or implied. Under no circumstances shall the operators or contributors of AniVerse be liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use this platform.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-3 bg-card/40 border border-border/40 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-primary/20 text-primary text-xs font-mono font-extrabold flex items-center justify-center">
              6
            </span>
            Contact &amp; DMCA Notices
          </h2>
          <p>
            If you are a copyright owner and have inquiries or concerns regarding content indexed through the platform, please note that AniVerse cannot delete files stored on external third-party hosts. Please submit copyright concerns directly to the respective file hosting providers.
          </p>
        </section>
      </div>

      <div className="pt-6 border-t border-border/30 flex justify-between items-center text-xs text-muted-foreground">
        <span>&copy; {new Date().getFullYear()} AniVerse. All rights reserved.</span>
        <Link to="/privacy" className="text-primary hover:underline">
          View Privacy Policy &rarr;
        </Link>
      </div>
    </div>
  );
}

export default TermsPage;
