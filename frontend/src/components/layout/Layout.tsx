import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-all duration-300">
      {/* Navigation Header */}
      <Navbar />

      {/* Main Page Content */}
      <main className="flex-1 flex flex-col pt-[72px]">
        <Outlet />
      </main>

      {/* Footer Section */}
      <Footer />
    </div>
  );
}

export default Layout;
