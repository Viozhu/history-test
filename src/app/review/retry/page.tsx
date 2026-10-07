import type { Metadata } from "next";
import { RetrySession } from "@/components/runner/RetrySession";

export const metadata: Metadata = { title: "오답 다시 풀기" };

export default function RetryPage() {
  return <RetrySession />;
}
