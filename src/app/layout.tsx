import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SH AI EXPO 2026 | LUCKY DRAW",
  description: "SH서울주택도시개발공사 AI EXPO 2026 부스 Lucky Draw 이벤트",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-body">{children}</body>
    </html>
  );
}
