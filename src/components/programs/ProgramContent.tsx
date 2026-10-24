import { cn } from "@/lib/utils/cn";

type Block = { kind: "text"; lines: string[] } | { kind: "table"; header: string[] | null; rows: string[][] };

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const isSeparatorRow = (cells: string[]) => cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));

/** 본문을 일반 텍스트 / 표 블록으로 나눈다. `|`로 시작하는 줄이 이어지면 표로 본다
 *  (작성 화면의 "표 넣기"가 만드는 `| a | b |` + `| --- | --- |` 형식). */
export function parseProgramContent(content: string): Block[] {
  const blocks: Block[] = [];
  for (const line of content.split("\n")) {
    const isTableLine = line.trim().startsWith("|");
    const last = blocks[blocks.length - 1];
    if (isTableLine) {
      const cells = splitRow(line);
      if (last?.kind === "table") {
        // 첫 줄 바로 다음의 구분선이면 첫 줄을 머리글로 올린다.
        if (isSeparatorRow(cells)) {
          if (last.header === null && last.rows.length === 1) last.header = last.rows.pop()!;
        } else last.rows.push(cells);
      } else if (!isSeparatorRow(cells)) {
        blocks.push({ kind: "table", header: null, rows: [cells] });
      }
    } else if (last?.kind === "text") {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "text", lines: [line] });
    }
  }
  return blocks;
}

/** 프로그램 게시글 본문 — `■`로 시작하는 줄은 소제목으로, `|` 줄은 표로 보여준다. */
export function ProgramContent({ content, className }: { content: string; className?: string }) {
  const blocks = parseProgramContent(content);
  return (
    <div className={cn("break-words text-sm leading-relaxed text-foreground/90", className)}>
      {blocks.map((b, i) =>
        b.kind === "text" ? (
          b.lines.map((line, j) =>
            line.trim().startsWith("■") ? (
              <p key={`${i}-${j}`} className="mt-2 whitespace-pre-wrap font-bold text-foreground first:mt-0">
                {line}
              </p>
            ) : (
              <p key={`${i}-${j}`} className="min-h-[1.625em] whitespace-pre-wrap">
                {line}
              </p>
            )
          )
        ) : (
          <div key={i} className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              {b.header && (
                <thead>
                  <tr>
                    {b.header.map((c, k) => (
                      <th key={k} className="border border-border bg-surface px-3 py-2 font-semibold text-foreground">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((c, k) => (
                      <td key={k} className="whitespace-pre-wrap border border-border px-3 py-2 align-top">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
