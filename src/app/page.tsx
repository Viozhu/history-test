import type { Metadata } from "next";
import { HomeView } from "@/components/home/HomeView";
import { PageShell } from "@/components/site/PageShell";
import { getExamIndex } from "@/lib/exams";

export const metadata: Metadata = {
  title: { absolute: "한국사능력검정시험 심화 모의고사" },
};

export default function HomePage() {
  return (
    <PageShell>
      <HomeView rounds={getExamIndex()} />
    </PageShell>
  );
}
