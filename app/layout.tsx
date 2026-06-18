import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/components/auth";

export const metadata: Metadata = {
  title: "PulseOps — WhatsApp Alignment Console",
  description:
    "Leadership console for weekly WhatsApp alignment data. For founders, department heads, and team leads.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
