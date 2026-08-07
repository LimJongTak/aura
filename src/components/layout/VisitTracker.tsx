"use client";

import { useEffect } from "react";
import { recordVisitOncePerSession } from "@/lib/firestore/visits";

export function VisitTracker() {
  useEffect(() => {
    recordVisitOncePerSession().catch(() => {
      // best-effort — a failed visit count shouldn't affect the visitor
    });
  }, []);

  return null;
}
