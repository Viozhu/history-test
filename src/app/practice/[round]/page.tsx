import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { RoundRunner } from "@/components/runner/RoundRunner";
import { getExam, roundParams } from "@/lib/exams";

export const dynamicParams = false;

export function generateStaticParams() {
  return roundParams();
}

type Props = { params: Promise<{ round: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { round } = await params;
  return { title: `제${round}회 연습` };
}

export default async function PracticePage({ params }: Props) {
  const { round } = await params;
  const exam = getExam(round);
  if (!exam) notFound();
  // Most sessions open on question 1: fetch its image before hydration (it is the LCP).
  const first = exam.questions[0];
  preload((first.useFallback ? first.fallbackImage : first.images[0] ?? first.fallbackImage).src, { as: "image", fetchPriority: "high" });
  return <RoundRunner exam={exam} mode="practice" />;
}
