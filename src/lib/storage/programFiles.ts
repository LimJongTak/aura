import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { nanoid } from "@/lib/utils/nanoid";
import type { ProgramFile } from "@/types/models";

export const PROGRAM_FILE_MAX_BYTES = 20 * 1024 * 1024;

/** 관리자가 프로그램 게시글에 붙이는 이미지/첨부파일 → programs/{programId}/{nanoid}-{filename} (공개 읽기). */
export async function uploadProgramFile(programId: string, file: File): Promise<ProgramFile> {
  const path = `programs/${programId}/${nanoid()}-${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type || undefined });
  return { name: file.name, url: await getDownloadURL(fileRef), path };
}

export async function deleteProgramFile(file: ProgramFile): Promise<void> {
  try {
    await deleteObject(ref(storage, file.path));
  } catch {
    // 이미 지워졌거나 경로가 바뀐 파일은 무시한다 — 글에서 링크만 빠지면 된다.
  }
}

/** 학생이 프로그램 신청 시 제출하는 신청서 → programApplications/{studentId}/{nanoid}-{filename} (본인·관리자만). */
export async function uploadProgramApplicationFile(studentId: string, file: File): Promise<ProgramFile> {
  const path = `programApplications/${studentId}/${nanoid()}-${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type || undefined });
  return { name: file.name, url: await getDownloadURL(fileRef), path };
}
