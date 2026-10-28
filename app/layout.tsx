import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kaisan Legal | Evidence-led legal research",
  description: "A source-grounded legal research workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
