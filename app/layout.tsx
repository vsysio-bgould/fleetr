import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fleetr",
  description: "Real-time fleet music for EVE Online",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
