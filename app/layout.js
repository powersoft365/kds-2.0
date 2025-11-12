"use client";
import React from "react";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "sonner";

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning={true} lang="en">
      <body
        className="min-h-dvh select-none bg-background text-foreground antialiased"
        suppressHydrationWarning={true}
      >
        {/* ThemeProvider uses class switching so Tailwind `dark:` works */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}

          {/* Global Sonner Toaster with safe defaults */}
          <Toaster
            richColors
            expand
            closeButton
            position="top-right"
            toastOptions={{
              classNames: {
                toast: "font-semibold",
                title: "text-sm",
                actionButton: "",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
