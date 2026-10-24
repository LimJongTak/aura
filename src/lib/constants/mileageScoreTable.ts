import type { ActivityGroup } from "@/types/models";

/** 마일리지 점수표 — 홈 화면 안내와 프로그램 작성 화면의 점수표 카드가 함께 쓴다. */
export const MILEAGE_SCORE_TABLE: { group: ActivityGroup; label: string; score: string }[] = [
  { group: "AI기반참여", label: "전공진입 (2학년 1학기)", score: "20점" },
  { group: "AI기반참여", label: "몰입형프로그램 참여", score: "50점" },
  { group: "AI기반참여", label: "교육참여 3일 이상", score: "25점" },
  { group: "AI기반참여", label: "교육참여 (4시간 이상)", score: "15점" },
  { group: "AI기반참여", label: "설명회 / 특강 참여", score: "10점" },
  { group: "역량향상", label: "참여 인증에 준하는 자격증", score: "5점" },
  { group: "역량향상", label: "산업기사 자격증", score: "10점" },
  { group: "역량향상", label: "AI 관련 자격증", score: "10점" },
  { group: "역량향상", label: "기사자격증", score: "15점" },
  { group: "역량향상", label: "국제공인 AI 관련 자격증", score: "15점" },
  { group: "실전경험", label: "현장실습 장기(3개월 이상)/연1회", score: "40점" },
  { group: "실전경험", label: "현장실습 중기(2개월 이상)/연1회", score: "30점" },
  { group: "실전경험", label: "현장실습 단기(1개월 이상)/연1회", score: "20점" },
  { group: "실전경험", label: "산학협력 프로젝트 참여", score: "30점" },
  { group: "실전경험", label: "산학협력 프로젝트 우수", score: "40점" },
  { group: "성과창출", label: "국내 경진대회/공모전 참가", score: "10점" },
  { group: "성과창출", label: "국내 경진대회/공모전 수상", score: "20점" },
  { group: "성과창출", label: "AI사업단 주관 경진대회 수상", score: "40점" },
  { group: "성과창출", label: "글로벌 경진대회/공모전 수상", score: "50점" },
  { group: "성과창출", label: "대외 논문 게재·전시·발표", score: "15점" },
  { group: "봉사", label: "사업단 주관 행사지원(시간당)", score: "5점" },
  { group: "기타", label: "사업단장 인정 활동", score: "최대 20점" },
];
