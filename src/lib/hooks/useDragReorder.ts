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
        onReorder(next);
        setDragIndex(null);
        setOverIndex(null);
      },
      isDragging: dragIndex === index,
      isDragOver: overIndex === index && dragIndex !== index,
    };
  }

  return { getDragHandleProps, getRowProps };
}
