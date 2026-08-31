"use client";

import { useState } from "react";

/**
 * Native HTML5 drag-and-drop for reordering a list. Pairs well with arrow-button
 * reordering (kept for precision/accessibility) rather than replacing it.
 */
export function useDragReorder<T>(items: T[], onReorder: (next: T[]) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function getDragHandleProps(index: number) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = "move";
      },
      onDragEnd: () => {
        setDragIndex(null);
        setOverIndex(null);
      },
    };
  }

  function getRowProps(index: number) {
    return {
      onDragEnter: (e: React.DragEvent) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        setOverIndex(index);
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        const next = items.slice();
        const [moved] = next.splice(dragIndex, 1);
        next.splice(index, 0, moved);
        // onReorder는 대부분 Firestore 쓰기가 섞인 async 콜백이다 — 여기서
        // await하지 않으면 실패가 아무 데도 보고되지 않는 unhandled rejection이
        // 되므로, 실패 시 최소한의 사용자 피드백을 여기서 한 번에 준다.
        Promise.resolve(onReorder(next)).catch(() => {
          alert("순서 변경에 실패했어요. 잠시 후 다시 시도해주세요.");
        });
        setDragIndex(null);
        setOverIndex(null);
      },
      isDragging: dragIndex === index,
      isDragOver: overIndex === index && dragIndex !== index,
    };
  }

  return { getDragHandleProps, getRowProps };
}
