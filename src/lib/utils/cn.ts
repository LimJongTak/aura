import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** clsx만으로는 나중에 넘긴 className이 앞서 붙인 것과 같은 CSS 속성(예: p-6 vs
 *  p-0)을 건드릴 때 어느 쪽이 이기는지 보장이 안 된다 — Tailwind가 생성한
 *  스타일시트 안의 등장 순서로 정해지지, 클래스 문자열에 적은 순서가 아니기
 *  때문이다. twMerge로 같은 속성끼리는 나중 값이 이기도록 해서, 컴포넌트
 *  기본 클래스를 호출부 className으로 안전하게 덮어쓸 수 있게 한다. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
