// Static JSON per round (prerendered at build). Used by the wrong-answer notebook,
// which needs questions from several rounds on one page.
import { getExam, roundParams } from "@/lib/exams";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return roundParams();
}

export async function GET(_req: Request, ctx: RouteContext<"/api/exams/[round]">) {
  const { round } = await ctx.params;
  const exam = getExam(round);
  if (!exam) return new Response("Not found", { status: 404 });
  return Response.json(exam);
}
