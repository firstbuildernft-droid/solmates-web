import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

// REPLACES the layout.tsx that create-next-app generates.
// The default one imports Google fonts; we don't need them and they're
// one more thing that can fail on a slow connection.

export const metadata: Metadata = {
  title: "Solmates",
  description: "Dating for Solana traders.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
