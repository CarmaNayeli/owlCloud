import type { Metadata } from "next";
import "./globals.css";

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
        <nav className="bg-indigo-600 text-white p-4 shadow-lg">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🎲</span>
              <h1 className="text-xl font-bold">RollCloud Dashboard</h1>
            </div>
            <div className="flex space-x-6">
              <a href="/" className="hover:text-indigo-200 transition">Home</a>
              <a href="/setup" className="hover:text-indigo-200 transition">Setup</a>
              <a href="/reaction-roles" className="hover:text-indigo-200 transition">Reaction Roles</a>
              <a href="/changelog" className="hover:text-indigo-200 transition">Changelog</a>
            </div>
          </div>
        </nav>
        <main className="container mx-auto p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
