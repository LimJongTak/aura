import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ActivityStandard } from "@/types/models";

const activityStandardsRef = () => collection(db, "activityStandards");

export async function listActivityStandards(): Promise<ActivityStandard[]> {
  const q = query(activityStandardsRef(), orderBy("category"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityStandard));
}
