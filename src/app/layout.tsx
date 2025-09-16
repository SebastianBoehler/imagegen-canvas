import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ImageGen Canvas",
  description: "An experimental canvas UI for orchestrating AI-assisted image generation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
