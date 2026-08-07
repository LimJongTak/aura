import { ImageResponse } from "next/og";
import { OG_SIZE, OgImageContent, loadNotoSansKRBold } from "./_og/shared";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A.U.R.A 마일리지 | 국립순천대학교 AI인재양성부트캠프사업단";

export default async function Image() {
  const fontData = await loadNotoSansKRBold();
  return new ImageResponse(<OgImageContent />, {
    ...OG_SIZE,
    fonts: [{ name: "Noto Sans KR", data: fontData, style: "normal", weight: 700 }],
  });
}
