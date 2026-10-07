"use client";
// Booklet-style masthead: title on the left, language/theme on the right, section tabs below.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrefs } from "@/lib/prefs";
import { LangToggle, ThemeToggle } from "./PrefsControls";

const L = {
  ko: { skip: "본문 바로가기", nav: "주 메뉴", sub: "기출 모의고사" },
  en: { skip: "Skip to content", nav: "Main", sub: "Past-paper simulator" },
};

export function SiteHeader() {
  const { prefs, t } = usePrefs();
  const l = L[prefs.lang];
  const pathname = usePathname();
  const links = [
    { href: "/", label: t.home, active: pathname === "/" },
    { href: "/review", label: t.review, active: pathname === "/review" },
    { href: "/history", label: t.history, active: pathname === "/history" },
  ];

  return (
    <header className="border-b-[3px] border-double border-rule bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        {l.skip}
      </a>
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-end justify-between gap-x-4 gap-y-1 px-4 pt-3">
        <Link href="/" className="group flex min-h-10 flex-col justify-center">
          <span className="font-serif text-lg leading-tight font-bold tracking-tight text-ink group-hover:underline sm:text-xl">
            {t.appName}
          </span>
          <span className="font-sans text-[11px] tracking-[0.2em] text-ink-faint uppercase">{l.sub}</span>
        </Link>
        <div className="flex items-center gap-2 pb-1">
          <LangToggle />
          <ThemeToggle />
        </div>
      </div>
      <nav aria-label={l.nav} className="mx-auto w-full max-w-5xl px-4">
        <ul className="-mb-px flex gap-1 overflow-x-auto">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={link.active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center border-b-2 px-3 font-sans text-sm transition-colors ${
                  link.active
                    ? "border-ink font-bold text-ink"
                    : "border-transparent text-ink-soft hover:border-rule-soft hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
