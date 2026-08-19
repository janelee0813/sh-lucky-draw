export type CompanionRow = { name: string; team: string | null; position: string | null; phone: string };

// 엑셀/관리자 화면에서 동반자 여러 명을 한 줄로 요약해서 보여준다.
// 예: "홍길동(개발팀·과장, 010-0000-0000); 김철수(010-1111-2222)"
export function formatCompanions(companions: CompanionRow[] | null | undefined): string {
  if (!companions || companions.length === 0) return "";
  return companions
    .map((c) => {
      const roleParts = [c.team, c.position].filter(Boolean).join("·");
      const role = roleParts ? `${roleParts}, ` : "";
      return `${c.name}(${role}${c.phone})`;
    })
    .join("; ");
}
