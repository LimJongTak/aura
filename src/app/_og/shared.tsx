import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

const AURA_LETTERS = [
  { letter: "A", word: "AI" },
  { letter: "U", word: "Upgrade" },
  { letter: "R", word: "Realize" },
  { letter: "A", word: "Achieve" },
];

export async function loadNotoSansKRBold() {
  return readFile(join(process.cwd(), "src/app/fonts/NotoSansKR-Bold.ttf"));
}

export function OgImageContent() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: "linear-gradient(135deg, #123f7c 0%, #1a56a8 100%)",
        fontFamily: "Noto Sans KR",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#bcd4f2" }}>
          국립순천대학교 · AI인재양성부트캠프사업단
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 92, fontWeight: 700, color: "#ffffff" }}>
          A.U.R.A 마일리지
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 32, fontWeight: 700, color: "#eaf2fc" }}>
          마일리지 조회 · 신청 · 중고급 이수 신청을 한 곳에서
        </div>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {AURA_LETTERS.map((a, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 130,
              height: 130,
              borderRadius: 24,
              background: "rgba(255,255,255,0.12)",
            }}
          >
            <div style={{ display: "flex", fontSize: 48, fontWeight: 700, color: "#ffffff" }}>{a.letter}</div>
            <div style={{ display: "flex", marginTop: 4, fontSize: 20, fontWeight: 700, color: "#bcd4f2" }}>
              {a.word}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
