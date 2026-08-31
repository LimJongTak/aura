/** 스프레드시트가 수식으로 해석할 수 있는 선행 문자(=+-@)로 시작하는 문자열
 *  값 앞에 작은따옴표를 붙여 무력화한다. 학생이 자유 입력한 값(학과·교과목명·
 *  비교과 프로그램명·은행 정보 등)이 그대로 관리자용 엑셀 셀에 들어가므로,
 *  모든 엑셀 내보내기가 행을 만들 때 이 함수를 거치게 한다(수식 주입 방지). */
export function sanitizeCell(value: string | number): string | number {
  if (typeof value === "string" && /^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

export function sanitizeRow(row: (string | number)[]): (string | number)[] {
  return row.map(sanitizeCell);
}
