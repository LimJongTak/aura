import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { SubjectMasterEntry } from "@/types/models";

const subjectMasterRef = () => collection(db, "subjectMaster");

export async function listSubjectsForDepartment(department: string): Promise<SubjectMasterEntry[]> {
  const q = query(subjectMasterRef(), where("department", "==", department));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SubjectMasterEntry));
}
