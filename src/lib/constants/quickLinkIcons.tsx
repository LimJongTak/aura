import {
  BookOpen,
  Globe,
  GraduationCap,
  HelpCircle,
  Link2,
  Megaphone,
  Newspaper,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { QuickLinkIcon } from "@/types/models";

export const QUICK_LINK_ICONS: Record<QuickLinkIcon, { label: string; Icon: LucideIcon }> = {
  newspaper: { label: "사업단", Icon: Newspaper },
  sparkles: { label: "AI 서비스", Icon: Sparkles },
  "book-open": { label: "전자책", Icon: BookOpen },
  "graduation-cap": { label: "학사모", Icon: GraduationCap },
  link: { label: "링크", Icon: Link2 },
  globe: { label: "웹사이트", Icon: Globe },
  megaphone: { label: "공지", Icon: Megaphone },
  "help-circle": { label: "안내", Icon: HelpCircle },
};

export const DEFAULT_QUICK_LINK_ICON: QuickLinkIcon = "link";
