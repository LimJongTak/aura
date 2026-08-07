"use client";

import { useEffect, useState } from "react";
import { subscribeQuickLinks } from "@/lib/firestore/quickLinks";
import { DEFAULT_QUICK_LINK_ICON, QUICK_LINK_ICONS } from "@/lib/constants/quickLinkIcons";
import type { QuickLink } from "@/types/models";

/** 화면 오른쪽에 떠있는 바로가기 메뉴 (PC 화면 전용). */
export function QuickLinksFloating() {
  const [links, setLinks] = useState<QuickLink[]>([]);

  useEffect(() => {
    const unsub = subscribeQuickLinks(setLinks);
    return () => unsub();
  }, []);

  const active = links.filter((l) => l.isActive);
  if (active.length === 0) return null;

  return (
    <div className="fixed right-0 top-1/2 z-30 hidden -translate-y-1/2 flex-col overflow-hidden rounded-l-2xl border border-r-0 border-border bg-white shadow-lg lg:flex">
      {active.map((link) => {
        const { Icon } = QUICK_LINK_ICONS[link.icon] ?? QUICK_LINK_ICONS[DEFAULT_QUICK_LINK_ICON];
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-20 flex-col items-center gap-1.5 border-b border-border px-2 py-4 text-center text-foreground transition last:border-b-0 hover:bg-primary-light hover:text-primary-dark"
          >
            <Icon size={22} />
            <span className="text-[11px] font-semibold leading-tight">{link.label}</span>
          </a>
        );
      })}
    </div>
  );
}
