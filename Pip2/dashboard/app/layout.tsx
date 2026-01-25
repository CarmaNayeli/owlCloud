import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import AuthButton from "@/components/AuthButton";

export const metadata: Metadata = {
  title: "RollCloud Dashboard",
  description: "Admin dashboard for RollCloud Discord integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SessionProvider>
          <nav className="bg-green-600 text-white p-4 shadow-lg">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold">RollCloud</h1>
              </div>
              <div className="flex items-center space-x-6">
                <a href="/" className="hover:text-green-200 transition">Home</a>
                <a href="/setup" className="hover:text-green-200 transition">Setup</a>
                <a href="/pip-settings" className="hover:text-green-200 transition">Pip 2 Settings</a>
                <a href="/my-instances" className="hover:text-green-200 transition">My Instances</a>
                <AuthButton />
              </div>
            </div>
          </nav>
          <main className="container mx-auto p-6">
            {children}
          </main>
          <footer className="border-t border-gray-200 dark:border-gray-700 mt-8 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            RollCloud v1.2
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
