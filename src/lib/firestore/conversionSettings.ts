import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ConversionSettings } from "@/types/models";

const DEFAULT_SETTINGS: ConversionSettings = {
  isFinalized: false,
  conversionRate: null,
  totalBudget: null,
  headcount: null,
  finalizedAt: null,
  appliedSemester: null,
};

export async function getConversionSettings(): Promise<ConversionSettings> {
  const snap = await getDoc(doc(db, "conversionSettings", "current"));
  if (!snap.exists()) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<ConversionSettings>) };
}
