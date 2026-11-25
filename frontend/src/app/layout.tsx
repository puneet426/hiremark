import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AuthProvider } from "../lib/auth";

export const metadata: Metadata = {
  title: "Hiremark: AI mock interviews for SDE freshers",
  description: "A 40-minute AI interview for SDE freshers, built around your resume. Your result becomes proof recruiters can search.",
};

// Sets the theme before the first paint: the saved choice (shared with the home page), else the system's.
const themeScript = `(function(){var t=null;try{t=localStorage.getItem('hm-theme')}catch(e){}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
