import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { isValidEmail, isValidPhone, normalizePhone } from "@/lib/utils/ticket-number";

const companionSchema = z.object({
  name: z.string().trim().min(1).max(50),
  team: z.string().trim().min(1).max(100),
  position: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1),
});

const bodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  phone: z.string().trim().min(1),
  email: z.string().trim().min(1),
  company: z.string().trim().min(1).max(100),
  job_role: z.string().trim().min(1),
  rnd_dept: z.string().trim().min(1),
  rnd_dept_name: z.string().trim().max(100).optional().nullable(),
  rnd_relocation_plan: z.string().trim().optional().nullable(),
  hq_location: z.string().trim().min(1),
  hq_location_other: z.string().trim().max(100).optional().nullable(),
  survey_answer_1: z.string().trim().min(1),
  survey_answer_2: z.string().trim().min(1),
  privacy_consent: z.literal(true),
  companions: z.array(companionSchema).max(5).optional().default([]),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    const json = await req.json();
    body = bodySchema.parse(json);
  } catch {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "입력값을 다시 확인해주세요." },
      { status: 400 }
    );
  }

  if (!isValidPhone(body.phone)) {
    return NextResponse.json(
      { error: "INVALID_PHONE", message: "휴대전화 번호 형식을 확인해주세요." },
      { status: 400 }
    );
  }
  if (!isValidEmail(body.email)) {
    return NextResponse.json(
      { error: "INVALID_EMAIL", message: "이메일 형식을 확인해주세요." },
      { status: 400 }
    );
  }
  for (const c of body.companions) {
    if (!isValidPhone(c.phone)) {
      return NextResponse.json(
        { error: "INVALID_PHONE", message: "동반자 휴대전화 번호 형식을 확인해주세요." },
        { status: 400 }
      );
    }
  }

  const phone = normalizePhone(body.phone);
  const companions = body.companions.map((c) => ({
    name: c.name,
    team: c.team || null,
    position: c.position || null,
    phone: normalizePhone(c.phone),
  }));
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase.rpc("submit_survey", {
    p_name: body.name,
    p_phone: phone,
    p_email: body.email.trim(),
    p_company: body.company,
    p_job_role: body.job_role,
    p_rnd_dept: body.rnd_dept,
    p_rnd_dept_name: body.rnd_dept_name || null,
    p_rnd_relocation_plan: body.rnd_relocation_plan || null,
    p_hq_location: body.hq_location,
    p_hq_location_other: body.hq_location_other || null,
    p_answer1: body.survey_answer_1,
    p_answer2: body.survey_answer_2,
    p_consent: true,
    p_companions: companions,
  });

  if (error) {
    const message = error.message || "";

    if (message.includes("EVENT_FULL")) {
      return NextResponse.json(
        {
          error: "EVENT_FULL",
          message: "안내드립니다. 준비된 모든 응모권이 모두 소진되어 더 이상 참여할 수 없습니다.",
        },
        { status: 409 }
      );
    }

    if (message.includes("DUPLICATE_PHONE")) {
      // 이미 참여한 번호 - 기존 응모권 안내를 위해 조회
      const { data: existing } = await supabase
        .from("participants")
        .select("ticket_number")
        .eq("phone", phone)
        .maybeSingle();

      return NextResponse.json(
        {
          error: "DUPLICATE_PHONE",
          message: "이미 참여하신 휴대전화 번호입니다.",
          existingTicketNumber: existing?.ticket_number ?? null,
        },
        { status: 409 }
      );
    }

    if (message.includes("PRIVACY_CONSENT_REQUIRED")) {
      return NextResponse.json(
        { error: "PRIVACY_CONSENT_REQUIRED", message: "개인정보 수집 동의가 필요합니다." },
        { status: 400 }
      );
    }

    console.error("submit_survey error:", error);
    return NextResponse.json(
      { error: "UNKNOWN", message: "일시적인 오류가 발생했습니다. 다시 시도해주세요." },
      { status: 500 }
    );
  }

  const row = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    ticketNumber: row.ticket_number,
  });
}
