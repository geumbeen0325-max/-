/** 서버 전용: 사용자가 넣은 링크 1건을 안전하게 가져온다 (내부망 차단, 리다이렉트 검증, 크기·시간 제한) */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const TIMEOUT_MS = 15_000;
export const MAX_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export class SourceError extends Error {
  constructor(message: string, public status = 422) {
    super(message);
  }
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function assertPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SourceError("올바른 URL 형식이 아닙니다.", 400);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SourceError("http 또는 https 주소만 불러올 수 있습니다.", 400);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addresses.length) throw new SourceError("주소를 찾을 수 없습니다. 링크를 확인해주세요.");
  if (addresses.some(isPrivateIp)) throw new SourceError("내부망 주소는 불러올 수 없습니다.", 400);
  return url;
}

/** 클라우드 공유 링크를 직접 다운로드 주소로 변환 */
function toDirectUrl(url: URL) {
  // Google Docs/Sheets/Slides → 내보내기
  const g = url.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([\w-]+)/);
  if (url.hostname === "docs.google.com" && g) {
    const format = { document: "docx", spreadsheets: "xlsx", presentation: "pptx" }[g[1]]!;
    return new URL(`https://docs.google.com/${g[1]}/d/${g[2]}/export?format=${format}`);
  }
  // Google Drive 파일 → 다운로드
  const d = url.pathname.match(/^\/file\/d\/([\w-]+)/);
  if (url.hostname === "drive.google.com" && d) {
    return new URL(`https://drive.google.com/uc?export=download&id=${d[1]}`);
  }
  // Dropbox → dl=1
  if (url.hostname.endsWith("dropbox.com")) {
    url.searchParams.set("dl", "1");
  }
  return url;
}

function filenameFrom(res: Response, url: URL) {
  const cd = res.headers.get("content-disposition") ?? "";
  const star = cd.match(/filename\*=(?:UTF-8'')?([^;]+)/i)?.[1];
  const plain = cd.match(/filename="?([^";]+)"?/i)?.[1];
  try {
    if (star) return decodeURIComponent(star.replace(/"/g, ""));
  } catch {}
  if (plain) return plain;
  return decodeURIComponent(url.pathname.split("/").pop() || url.hostname);
}

export async function fetchUrl(raw: string) {
  if (/drive\.google\.com\/drive\/(u\/\d+\/)?folders\//.test(raw)) {
    throw new SourceError(
      "클라우드 폴더 링크는 로그인 권한이 필요해 열 수 없어요. 폴더를 내려받아 '폴더 선택'으로 넣거나, 파일 링크를 하나씩 넣어주세요.",
    );
  }
  let url = toDirectUrl(await assertPublicUrl(raw));
  // 일부 사이트는 브라우저형 UA를, 일부는 반대로 봇 UA만 허용하므로 403이면 한 번 바꿔서 재시도
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "TrendDrawer/1.0 (+https://github.com/)",
  ];
  let agent = 0;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": agents[agent],
        Accept: "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      },
    }).catch((e: Error) => {
      throw new SourceError(e.name === "TimeoutError" ? "사이트 응답이 너무 느립니다." : "사이트에 접속하지 못했습니다.");
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (res.status === 403 && agent === 0) {
      agent = 1;
      i--;
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw new SourceError(
        "사이트가 접근을 막았거나 로그인 권한이 필요한 링크예요. 공유 설정을 '링크가 있는 모든 사용자'로 바꾸거나, 파일을 내려받아 직접 넣어주세요.",
      );
    }
    if (!res.ok) throw new SourceError(`사이트가 요청을 거부했습니다. (HTTP ${res.status})`);

    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new SourceError("파일이 너무 큽니다. (최대 20MB)");
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new SourceError("파일이 너무 큽니다. (최대 20MB)");

    return {
      buf,
      contentType: res.headers.get("content-type") ?? "",
      filename: filenameFrom(res, url),
      finalUrl: url.toString(),
    };
  }
  throw new SourceError("리다이렉트가 너무 많습니다.");
}
