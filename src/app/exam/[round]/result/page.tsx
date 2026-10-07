import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResultView } from "@/components/results/ResultView";
import { PageShell } from "@/components/site/PageShell";
import { getExam, roundParams } from "@/lib/exams";

export const dynamicParams = false;

export function generateStaticParams() {
  return roundParams();
}

type Props = { params: Promise<{ round: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { round } = await params;
  return { title: `제${round}회 채점 결과` };
}

export default async function ResultPage({ params }: Props) {
  const { round } = await params;
  const exam = getExam(round);
  if (!exam) notFound();
  return (
    <PageShell>
      <ResultView exam={exam} />
    </PageShell>
  );
}
