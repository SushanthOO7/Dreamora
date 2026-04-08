import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dreamora",
  description: "A personal productivity workspace for image and video generation."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
