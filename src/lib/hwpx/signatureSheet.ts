/** 프로그램 신청자 명단으로 한글(hwpx) 서명부를 만든다. 서식(public/templates/signature-sheet.hwpx)의
 *  제목 "프로그램명"을 글 제목으로 바꾸고 표의 소속(학과)·학번·성명 칸만 채운다 — 일시·장소·서명은
 *  담당자가 한글에서 직접 적는다. 서식 한 쪽에 들어가는 인원(20명)보다 많으면 제목·일시·장소·표까지
 *  같은 쪽을 다음 쪽에 이어 붙이고 연번은 이어서 매긴다(21, 22…). 마지막 쪽의 남는 줄은 연번만 적고
 *  비워 둔다(49명이면 50~60번) — 현장 추가 참석자용.
 *
 *  hwpx는 XML 파일들을 zip으로 묶은 형식이라 브라우저에서 바로 풀어 고친 뒤 다시 묶는다. */

import { deflateSync, strFromU8, strToU8, unzipSync } from "fflate";
import type { Program, ProgramApplication } from "@/types/models";

const TEMPLATE_URL = "/templates/signature-sheet.hwpx";
const SECTION_PATH = "Contents/section0.xml";
const TITLE_PLACEHOLDER = "프로그램명";
const SUBTITLE_TAG = " [일반용]";

export interface SignatureRow {
  department: string;
  studentId: string;
  name: string;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** search가 들어 있는 첫 글자 칸(<hp:t>)의 search를 replacement로 바꾼다. 글자 수가 바뀌므로 그 문단의
 *  줄 배치 정보(linesegarray)는 빼서 한글이 열 때 다시 계산하게 한다. */
function replaceText(xml: string, search: string, replacement: string): string {
  const found = xml.match(new RegExp(`<hp:t>[^<]*${search.replace(/[[\]]/g, "\\$&")}[^<]*</hp:t>`));
  if (found?.index === undefined) return xml;
  const at = found.index;
  let rest = xml.slice(at + found[0].length);
  const segStart = rest.indexOf("<hp:linesegarray>");
  if (segStart >= 0 && segStart < rest.indexOf("</hp:p>")) {
    rest = rest.slice(0, segStart) + rest.slice(rest.indexOf("</hp:linesegarray>") + "</hp:linesegarray>".length);
  }
  return xml.slice(0, at) + found[0].replace(search, escapeXml(replacement)) + rest;
}

/** 셀의 문단을 글자 하나짜리 문단으로 바꾼다 (줄 배치 정보는 뺀다). */
function setCellText(cell: string, text: string, paraPrId: string, charPrId: string): string {
  const run = text ? `<hp:run charPrIDRef="${charPrId}"><hp:t>${escapeXml(text)}</hp:t></hp:run>` : `<hp:run charPrIDRef="${charPrId}"/>`;
  return cell.replace(
    /<hp:p [\s\S]*<\/hp:p>/,
    // 함수로 넘겨 학과명 등에 들어 있는 $ 기호가 치환 패턴으로 해석되지 않게 한다.
    () => `<hp:p id="0" paraPrIDRef="${paraPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${run}</hp:p>`
  );
}

/** 데이터 줄 하나의 연번을 매기고 소속·학번·성명 칸을 채운다(신청자가 없는 줄은 연번만). 글자 모양은
 *  연번 칸(가운데 정렬)과 같게 한다. */
function fillRow(row: string, no: number, values: string[]): string {
  const cells = row.match(/<hp:tc [\s\S]*?<\/hp:tc>/g) ?? [];
  const paraPrId = cells[0]?.match(/paraPrIDRef="(\d+)"/)?.[1] ?? "0";
  const charPrId = cells[0]?.match(/<hp:run charPrIDRef="(\d+)"/)?.[1] ?? "0";
  let col = 0;
  // 0: 연번, 1: 소속, 2: 학번, 3: 성명, 4: 서명(비움)
  return row.replace(/<hp:tc [\s\S]*?<\/hp:tc>/g, (cell) => {
    const i = col++;
    if (i === 0) return setCellText(cell, String(no), paraPrId, charPrId);
    return i <= 3 ? setCellText(cell, values[i - 1] ?? "", paraPrId, charPrId) : cell;
  });
}

/** 한 쪽 분량(본문 XML)의 명단 표에 rows를 채운다. 표의 줄 수가 한 쪽 정원이고, 연번은 firstNo부터 이어진다. */
function fillPage(body: string, rows: SignatureRow[], firstNo: number): string {
  const headerAt = body.indexOf("<hp:t>연번</hp:t>");
  const tblStart = body.lastIndexOf("<hp:tbl ", headerAt);
  const tblEnd = body.indexOf("</hp:tbl>", headerAt);
  const table = body.slice(tblStart, tblEnd);
  let idx = -1; // 첫 줄은 머리글
  const filled = table.replace(/<hp:tr>[\s\S]*?<\/hp:tr>/g, (row) => {
    const i = idx++;
    if (i < 0) return row;
    const r = rows[i];
    return fillRow(row, firstNo + i, r ? [r.department, r.studentId, r.name] : []);
  });
  return body.slice(0, tblStart) + filled + body.slice(tblEnd);
}

/** 구역(hs:sec) 바로 아래 문단들의 [시작, 끝] 위치 — 표 칸 안의 문단은 건너뛴다. */
function topLevelParagraphs(xml: string): [number, number][] {
  const secOpen = xml.indexOf("<hs:sec");
  const re = /<(\/?)hp:p(?: [^>]*)?>/g;
  re.lastIndex = xml.indexOf(">", secOpen) + 1;
  const result: [number, number][] = [];
  let depth = 0;
  let start = 0;
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    if (!m[1]) {
      if (depth++ === 0) start = m.index;
    } else if (--depth === 0) {
      result.push([start, re.lastIndex]);
    }
  }
  return result;
}

/** 둘째 쪽부터 쓸 본문: 구역·단 설정과 머리말(로고)은 첫 쪽에만 두고, 쪽 나눔으로 시작하며 표 id가 겹치지 않게 한다.
 *  컨트롤을 빼면 문단의 글자 위치가 달라져 줄 배치 정보(linesegarray)가 맞지 않게 되고, 한글은 그런 문서를
 *  손상된 것으로 보고 열지 않는다 — 이 쪽의 줄 배치 정보는 모두 빼서 한글이 다시 계산하게 한다. */
function asContinuationPage(body: string, page: number): string {
  return body
    .replace(/<hp:secPr [\s\S]*?<\/hp:secPr>/, "")
    .replace(/<hp:ctrl><hp:colPr [^>]*\/><\/hp:ctrl>/, "")
    .replace(/<hp:ctrl><hp:header [\s\S]*?<\/hp:header><\/hp:ctrl>/, "")
    .replace(/<hp:run charPrIDRef="\d+"><\/hp:run>/g, "")
    .replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, "")
    .replace(/<hp:p id="\d+"/, '<hp:p id="0"')
    .replace(/pageBreak="0"/, 'pageBreak="1"')
    .replace(/<hp:tbl id="(\d+)"/g, (_m, id) => `<hp:tbl id="${Number(id) + page * 100}"`);
}

/** 서식 hwpx(zip 바이트)에 제목과 명단을 채운 새 hwpx 바이트를 돌려준다. */
export function fillSignatureSheet(template: Uint8Array, title: string, rows: SignatureRow[]): Uint8Array {
  const files = unzipSync(template);
  let xml = strFromU8(files[SECTION_PATH]);
  xml = replaceText(xml, TITLE_PLACEHOLDER, title);
  xml = replaceText(xml, SUBTITLE_TAG, "");

  const paras = topLevelParagraphs(xml);
  if (paras.length === 0 || !xml.includes("<hp:t>연번</hp:t>")) throw new Error("서명부 서식에서 명단 표를 찾지 못했습니다.");
  const bodyStart = paras[0][0];
  const bodyEnd = paras[paras.length - 1][1];
  const body = xml.slice(bodyStart, bodyEnd);

  const tableAt = body.indexOf("<hp:t>연번</hp:t>");
  const table = body.slice(body.lastIndexOf("<hp:tbl ", tableAt), body.indexOf("</hp:tbl>", tableAt));
  const perPage = (table.match(/<hp:tr>/g)?.length ?? 1) - 1;
  if (perPage < 1) throw new Error("서명부 서식의 명단 표 형식이 다릅니다.");

  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const pages = Array.from({ length: pageCount }, (_, p) => {
    const page = fillPage(body, rows.slice(p * perPage, (p + 1) * perPage), p * perPage + 1);
    return p === 0 ? page : asContinuationPage(page, p);
  });
  xml = xml.slice(0, bodyStart) + pages.join("") + xml.slice(bodyEnd);

  return replaceZipEntry(template, SECTION_PATH, strToU8(xml));
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** 서식 zip에서 항목 하나의 내용만 바꾼 zip을 만든다. 한글은 zip 구성(항목 순서·압축 방식·헤더 값)이
 *  자기가 저장한 것과 다르면 손상·변조된 문서로 보므로, 나머지 항목은 압축된 바이트와 헤더를 그대로
 *  복사하고 바뀐 항목도 원래 압축 방식·헤더 값을 유지한 채 크기·CRC만 고친다. */
function replaceZipEntry(zip: Uint8Array, target: string, content: Uint8Array): Uint8Array {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = zip.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("서명부 서식 파일이 올바른 hwpx가 아닙니다.");
  const count = view.getUint16(eocd + 10, true);

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  let p = view.getUint32(eocd + 16, true);
  for (let i = 0; i < count; i++) {
    const nameLen = view.getUint16(p + 28, true);
    const cdLen = 46 + nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
    const central = zip.slice(p, p + cdLen);
    const name = strFromU8(zip.subarray(p + 46, p + 46 + nameLen));
    const lh = view.getUint32(p + 42, true);
    const localHeaderLen = 30 + view.getUint16(lh + 26, true) + view.getUint16(lh + 28, true);
    const header = zip.slice(lh, lh + localHeaderLen);
    let data = zip.subarray(lh + localHeaderLen, lh + localHeaderLen + view.getUint32(p + 20, true));

    if (name === target) {
      const method = view.getUint16(p + 10, true);
      data = method === 0 ? content : deflateSync(content, { level: 6 });
      const crc = crc32(content);
      const lv = new DataView(header.buffer);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, content.length, true);
      const cv = new DataView(central.buffer);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, content.length, true);
    }
    new DataView(central.buffer).setUint32(42, offset, true);
    locals.push(header, data);
    centrals.push(central);
    offset += header.length + data.length;
    p += cdLen;
  }

  const end = zip.slice(eocd);
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  new DataView(end.buffer).setUint32(12, centralSize, true);
  new DataView(end.buffer).setUint32(16, offset, true);

  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** 신청자(반려 제외)를 소속(학과) 가나다순, 같은 학과 안에서는 이름 가나다순(동명이인은 학번순)으로 정렬해 서명부를 만들고 내려받는다. */
export async function downloadSignatureSheet(program: Program, apps: ProgramApplication[]): Promise<void> {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error("서명부 서식을 불러오지 못했습니다.");
  const rows = apps
    .filter((a) => a.status !== "반려")
    .map((a) => ({ department: a.department, studentId: a.studentId, name: a.studentName }))
    .sort((a, b) => a.department.localeCompare(b.department, "ko") || a.name.localeCompare(b.name, "ko") || a.studentId.localeCompare(b.studentId));
  const bytes = fillSignatureSheet(new Uint8Array(await res.arrayBuffer()), program.title, rows);

  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/hwp+zip" }));
  const link = document.createElement("a");
  link.href = url;
  const safeTitle = program.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 40);
  link.download = `${safeTitle}_서명부_${new Date().toISOString().slice(0, 10)}.hwpx`;
  link.click();
  URL.revokeObjectURL(url);
}
