import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { nanoid } from "@/lib/utils/nanoid";

/** 증빙서류 파일을 evidence/{studentId}/{nanoid}-{filename} 경로에 업로드하고 다운로드 URL을 반환한다. */
export async function uploadEvidenceFile(studentId: string, file: File): Promise<string> {
  const path = `evidence/${studentId}/${nanoid()}-${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}
