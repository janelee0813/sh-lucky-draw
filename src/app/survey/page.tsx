import { SurveyFlow } from "@/components/survey/SurveyFlow";

export const dynamic = "force-dynamic";

export default function SurveyPage() {
  return (
    <main className="min-h-[100dvh] w-full bg-white">
      <div className="mx-auto h-[100dvh] max-w-[480px] bg-white">
        <SurveyFlow />
      </div>
    </main>
  );
}
