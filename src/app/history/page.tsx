import type { Metadata } from "next";
import { HistoryView } from "@/components/history/HistoryView";
import { PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "응시 기록" };

export default function HistoryPage() {
  return (
    <PageShell>
      <HistoryView />
    </PageShell>
  );
}
