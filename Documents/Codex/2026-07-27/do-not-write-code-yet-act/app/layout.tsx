import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "FormationFlow",
  description: "Plan dance formation transitions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
