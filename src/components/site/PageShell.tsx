import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/** Header + main landmark + footer shared by the home, results, notebook and history pages. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-4 focus:outline-none sm:pt-8">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
