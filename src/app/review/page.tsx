import type { Metadata } from "next";
import { NotebookView } from "@/components/review/NotebookView";
import { PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "오답 노트" };

export default function ReviewPage() {
  return (
    <PageShell>
      <NotebookView />
    </PageShell>
  );
}
