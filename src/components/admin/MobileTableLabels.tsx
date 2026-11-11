"use client";

import { useEffect, useRef } from "react";

/**
 * 관리자 화면의 표를 휴대폰(640px 미만)에서 카드 목록으로 보여주기 위한 보조 컴포넌트.
 * 실제 카드 모양은 globals.css의 `.admin-content table` 모바일 규칙이 담당하고, 여기서는
 * 각 칸(td)에 해당 열의 제목(th 텍스트)을 data-label로 달아 카드 안에서 "학번 2023…"처럼
 * 이름표가 붙게 한다. 표가 새로 그려지거나 행이 바뀔 때마다 다시 단다. PC 화면에서는
 * data-label이 CSS에서 쓰이지 않으므로 아무 영향이 없다.
 *
 * 특정 표를 카드로 바꾸지 않고 가로 스크롤로 두려면 `<table data-mobile-table="scroll">`.
 */
export function MobileTableLabels({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let frame = 0;

    const apply = () => {
      frame = 0;
      root.querySelectorAll("table").forEach((table) => {
        const headers = Array.from(table.querySelectorAll(":scope > thead > tr > th")).map((th) =>
          (th.textContent ?? "").trim()
        );
        table.querySelectorAll(":scope > tbody > tr").forEach((tr) => {
          Array.from(tr.children).forEach((cell, i) => {
            const label = headers[i] ?? "";
            if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
            // 카드는 2열 타일로 배치되는데, 긴 글·입력칸이 든 칸은 한 줄 전체를 쓰게 한다.
            const wide =
              (cell.textContent ?? "").trim().length > 22 ||
              !!cell.querySelector("p, ul, textarea, select, input:not([type=checkbox]):not([type=radio])");
            const wideValue = wide ? "true" : "false";
            if (cell.getAttribute("data-wide") !== wideValue) cell.setAttribute("data-wide", wideValue);
            // 글자 없이 아이콘 버튼(링크) 하나만 든 칸(상세·수정·삭제 등)은 칸 전체를 눌리는
            // 큰 버튼으로 보여준다 — 아이콘만으로는 손가락으로 누르기 너무 작다.
            const controls = cell.querySelectorAll("a, button");
            const action = !!label && controls.length === 1 && !(cell.textContent ?? "").trim() ? "true" : "false";
            if (cell.getAttribute("data-action") !== action) cell.setAttribute("data-action", action);
          });
        });
      });
    };

    apply();
    // 속성 변경은 감시하지 않는다 — 여기서 다는 data-label 때문에 다시 호출되는 걸 막는다.
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(apply);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="admin-content min-w-0 flex-1">
      {children}
    </div>
  );
}
