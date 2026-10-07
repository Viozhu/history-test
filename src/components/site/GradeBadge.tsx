import type { Grade } from "@/lib/types";

/** Small bordered stamp, like the grade seal on the certificate. 불합격 is printed in plain ink. */
export function GradeBadge({ grade, className = "" }: { grade: Grade; className?: string }) {
  const pass = grade !== "불합격";
  return (
    <span
      className={`inline-flex min-w-[3.25rem] items-center justify-center rounded-[3px] border-[1.5px] px-1.5 py-0.5 font-serif text-[13px] leading-none font-bold tracking-wide ${
        pass ? "-rotate-2 border-seal text-seal" : "border-ink-faint text-ink-faint"
      } ${className}`}
    >
      {grade}
    </span>
  );
}
