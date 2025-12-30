import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClipGenius - AI-Powered Video Clipping",
  description: "Transform your YouTube videos into viral short-form clips with AI-powered analysis, smart framing, and auto-captions.",
  keywords: ["video clipping", "AI", "YouTube", "shorts", "TikTok", "content creation"],
  authors: [{ name: "ClipGenius" }],
  openGraph: {
    title: "ClipGenius - AI-Powered Video Clipping",
    description: "Transform your YouTube videos into viral short-form clips",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
