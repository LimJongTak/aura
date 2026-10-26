import type { ApplicationFileType } from "@/types/models";

/** 프로그램 신청서로 받을 수 있는 파일 형식 — 관리자가 글 작성 시 고르고, 학생 신청 창은 고른 형식만 받는다. */
export const APPLICATION_FILE_TYPES: Record<ApplicationFileType, { label: string; extensions: string[] }> = {
  pdf: { label: "PDF", extensions: [".pdf"] },
  hwp: { label: "한글(HWP·HWPX)", extensions: [".hwp", ".hwpx"] },
  word: { label: "워드(DOC·DOCX)", extensions: [".doc", ".docx"] },
  image: { label: "이미지(JPG·PNG)", extensions: [".jpg", ".jpeg", ".png"] },
};

export const APPLICATION_FILE_TYPE_KEYS = Object.keys(APPLICATION_FILE_TYPES) as ApplicationFileType[];

/** 고른 형식들의 확장자 목록 — 비어 있으면(제한 없음) 빈 배열. */
export function allowedExtensions(types: ApplicationFileType[]): string[] {
  return types.flatMap((t) => APPLICATION_FILE_TYPES[t].extensions);
}

/** "PDF, 한글(HWP·HWPX)" 처럼 사람이 읽는 형식 목록. */
export function describeFileTypes(types: ApplicationFileType[]): string {
  return types.map((t) => APPLICATION_FILE_TYPES[t].label).join(", ");
}

export function isAllowedFile(fileName: string, types: ApplicationFileType[]): boolean {
  if (types.length === 0) return true;
  const lower = fileName.toLowerCase();
  return allowedExtensions(types).some((ext) => lower.endsWith(ext));
}
