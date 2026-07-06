import type { Metadata } from "next";
import "./globals.css";
import { getSessionUser } from "@/server/auth";
import Link from "next/link";
import { startWorker } from "@/server/worker";

export const metadata: Metadata = {
  title: "Triparr - Media Manager & Downloader",
  description: "Self-hosted media request and library management system",
};

// Start background worker in dev/server env
if (typeof window === "undefined") {
  const globalRef = global as any;
  if (!globalRef.workerStarted) {
    globalRef.workerStarted = true;
    startWorker().catch((err) => console.error("Worker start error in Next.js process:", err));
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();


  if (!user) {
    // Render without sidebar for login/register pages
    return (
      <html lang="en" className="dark">
        <body>
          <main className="min-h-screen flex items-center justify-center bg-[#0A0A0A] p-6">
            {children}
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className="dark">
      <head>
        {/* Load Google Material Symbols stylesheet */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="bg-[#0A0A0A] text-[#E5E2E1] flex min-h-screen">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-[#131313] border-r border-[#262626] flex flex-col justify-between shrink-0">
          <div>
            {/* Logo */}
            <div className="h-16 flex items-center px-6 border-b border-[#262626]">
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3B82F6] fill-icon">cloud_download</span>
                Triparr
              </span>
            </div>

            {/* Nav Links */}
            <nav className="p-4 space-y-1">
              <Link
                href="/"
                className="flex items-center gap-3 px-4 py-2.5 rounded text-sm font-medium hover:bg-[#1C1B1B] hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[#8C909F] text-lg">search</span>
                Discover / Search
              </Link>
              <Link
                href="/library"
                className="flex items-center gap-3 px-4 py-2.5 rounded text-sm font-medium hover:bg-[#1C1B1B] hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[#8C909F] text-lg">folder_open</span>
                Local Library
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-3 px-4 py-2.5 rounded text-sm font-medium hover:bg-[#1C1B1B] hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[#8C909F] text-lg">settings</span>
                Settings
              </Link>
              <Link
                href="/logs"
                className="flex items-center gap-3 px-4 py-2.5 rounded text-sm font-medium hover:bg-[#1C1B1B] hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[#8C909F] text-lg">terminal</span>
                System Logs
              </Link>
            </nav>
          </div>

          {/* User Info / Logout Footer */}
          <div className="p-4 border-t border-[#262626] flex items-center justify-between text-xs text-[#C2C6D6]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-[#10B981]">account_circle</span>
              <span className="font-medium text-white truncate max-w-[120px]">{user.username}</span>
            </div>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="hover:text-red-400 transition-colors flex items-center p-1 rounded hover:bg-[#1C1B1B]"
                title="Logout"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            </form>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-16 border-b border-[#262626] flex items-center justify-between px-8 bg-[#131313]/60 backdrop-blur-sm sticky top-0 z-50">
            <h1 className="font-semibold text-lg text-white">Console</h1>
            <div className="flex items-center gap-4 text-xs text-[#8C909F]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] glow-green inline-block"></span>
                Worker Active
              </span>
            </div>
          </header>
          <main className="flex-1 p-8 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
