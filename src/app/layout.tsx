import type { Metadata, Viewport } from "next";
import { Noto_Serif_KR } from "next/font/google";
import { PrefsProvider } from "@/lib/prefs";
import "./globals.css";

// Exam content uses Noto Serif KR, self-hosted by next/font at build time (Korean glyphs come
// as unicode-range slices, no requests to Google at runtime). UI text uses the system Korean
// sans (Noto Sans CJK on Android, Apple SD Gothic Neo, Malgun Gothic): a second webfont family
// doubled the render-blocking @font-face CSS and kept Lighthouse performance under 90.
const serif = Noto_Serif_KR({
  variable: "--font-noto-serif-kr",
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "한국사능력검정시험 심화 모의고사", template: "%s · 한능검 심화" },
  description: "국사편찬위원회 기출 문제로 푸는 한국사능력검정시험 심화 실전 모의고사와 오답 노트",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3ea" },
    { media: "(prefers-color-scheme: dark)", color: "#221e18" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${serif.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint to avoid a light flash in dark mode. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=JSON.parse(localStorage.getItem("khs:v1:prefs")||"{}");if(p.theme==="light"||p.theme==="dark")document.documentElement.setAttribute("data-theme",p.theme)}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <PrefsProvider>{children}</PrefsProvider>
      </body>
    </html>
  );
}
