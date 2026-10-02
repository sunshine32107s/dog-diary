import { albumDate, albumPhotos, albumStats, careLabels, type AlbumLog } from './diary-album';

const WIDTH = 1080;
const MARGIN = 68;
const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 30, color = '#44403c', bold = false) {
  ctx.font = `${bold ? 700 : 400} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function wrap(ctx: CanvasRenderingContext2D, value: string, width: number, size: number) {
  ctx.font = `400 ${size}px ${FONT}`;
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    for (const character of Array.from(paragraph)) {
      if (line && ctx.measureText(line + character).width > width) {
        lines.push(line);
        line = character;
      } else {
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string, radius = 28) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function drawPhoto(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, size: number) {
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 24);
  ctx.clip();
  ctx.drawImage(image, x + (size - image.naturalWidth * scale) / 2, y + (size - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  ctx.restore();
}

function loadPhoto(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('이미지 생성 취소', 'AbortError')); return; }
    const image = new Image();
    const timer = window.setTimeout(() => fail(), 20000);
    const cleanup = () => {
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => { cleanup(); image.src = ''; reject(new DOMException('이미지 생성 취소', 'AbortError')); };
    const fail = () => {
      cleanup();
      image.src = '';
      reject(new Error('사진을 불러오지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해주세요.'));
    };
    image.crossOrigin = 'anonymous';
    signal?.addEventListener('abort', abort, { once: true });
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = fail;
    image.src = url;
  });
}

function canvas(height: number) {
  if (height > 16000) throw new Error('일기가 너무 길어 이미지로 담기 어려워요. CSV 백업으로 전체 내용을 저장해주세요.');
  const element = document.createElement('canvas');
  element.width = WIDTH;
  element.height = height;
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서 이미지를 만들 수 없어요.');
  ctx.textBaseline = 'top';
  box(ctx, 0, 0, WIDTH, height, '#faf7f2', 0);
  return { element, ctx };
}

function toBlob(element: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      element.toBlob((blob) => {
        // Release the large pixel buffer once the PNG has been encoded.
        element.width = element.height = 0;
        if (blob) resolve(blob);
        else reject(new Error('이미지를 만들지 못했어요. 다시 시도해주세요.'));
      }, 'image/png');
    } catch {
      element.width = element.height = 0;
      reject(new Error('사진을 이미지로 저장할 수 없어요. 사진 접근 권한과 네트워크를 확인해주세요.'));
    }
  });
}

function header(ctx: CanvasRenderingContext2D, title: string, subtitle: string) {
  text(ctx, "CHIU'S DAILY DIARY", MARGIN, 50, 24, '#2563eb', true);
  text(ctx, title, MARGIN, 94, 48, '#451a03', true);
  text(ctx, subtitle, MARGIN, 156, 28, '#78716c');
}

export async function dailyImage(log: AlbumLog, signal?: AbortSignal) {
  await document.fonts.ready;
  const measure = canvas(1);
  const memoLines = log.memo ? wrap(measure.ctx, log.memo, WIDTH - MARGIN * 2 - 48, 32) : [];
  const badges = [
    (log.sleep_well ?? true) ? '꿀잠' : '뒤척임', log.walked ? '산책 완료' : '집콕',
    `응가 ${log.poop_count || 0}회`, ...(log.weight ? [`${log.weight}kg`] : []), ...careLabels(log),
  ];
  const badgeLines = wrap(measure.ctx, badges.join('  ·  '), WIDTH - MARGIN * 2, 28);
  measure.element.width = measure.element.height = 0;
  const size = WIDTH - MARGIN * 2;
  const detailY = log.photo_url ? 224 + size + 36 : 240;
  const memoY = detailY + badgeLines.length * 42 + 34;
  const height = Math.max(1350, memoY + (memoLines.length ? memoLines.length * 48 + 48 : 0) + 116);
  const { element, ctx } = canvas(height);
  header(ctx, '치우의 하루하루', albumDate(log.date));
  if (log.photo_url) drawPhoto(ctx, await loadPhoto(log.photo_url, signal), MARGIN, 224, size);
  badgeLines.forEach((line, index) => text(ctx, line, MARGIN, detailY + index * 42, 28, '#1d4ed8', true));
  if (memoLines.length) {
    box(ctx, MARGIN, memoY, size, memoLines.length * 48 + 48, '#ffffff');
    memoLines.forEach((line, index) => text(ctx, line, MARGIN + 24, memoY + 24 + index * 48, 32));
  }
  text(ctx, '치우와 함께 쌓아가는 작은 추억', MARGIN, height - 64, 24, '#a8a29e');
  return { blob: await toBlob(element), filename: `치우_${log.date}.png` };
}

export async function monthlyImage(logs: AlbumLog[], month: string, signal?: AbortSignal) {
  if (!logs.length) throw new Error('이 달에는 저장할 기록이 없어요.');
  await document.fonts.ready;
  const photos = albumPhotos(logs);
  const stats = albumStats(logs);
  const measure = canvas(1);
  const memos = logs.filter((log) => log.memo?.trim()).map((log) => {
    const lines = wrap(measure.ctx, log.memo!.trim(), WIDTH - MARGIN * 2 - 48, 28);
    return { log, lines: lines.length > 2 ? [lines[0], `${lines[1].slice(0, -1)}…`] : lines };
  });
  measure.element.width = measure.element.height = 0;
  const cell = (WIDTH - MARGIN * 2 - 28) / 3;
  const photoHeight = photos.length ? Math.ceil(photos.length / 3) * (cell + 40) : 70;
  const statsY = 226 + photoHeight + 20;
  const memoY = statsY + 216;
  const memoHeight = memos.reduce((sum, memo) => sum + 48 + memo.lines.length * 42 + 24, 0);
  const height = Math.max(1350, memoY + (memos.length ? 62 + memoHeight : 0) + 104);
  const { element, ctx } = canvas(height);
  const [year, number] = month.split('-');
  header(ctx, `치우의 ${Number(number)}월 앨범`, `${year}년 · 사진 ${stats.photos}장 · 기록 ${stats.days}일`);
  // Load one photo at a time so a month's original images don't stay in memory together.
  for (let index = 0; index < photos.length; index++) {
    const x = MARGIN + (index % 3) * (cell + 14);
    const y = 226 + Math.floor(index / 3) * (cell + 40);
    drawPhoto(ctx, await loadPhoto(photos[index].photo_url!, signal), x, y, cell);
    text(ctx, photos[index].date.slice(5).replace('-', '.'), x + 4, y + cell + 9, 22, '#78716c');
  }
  if (!photos.length) text(ctx, '사진 없이도 소중한 기록이 쌓였어요.', MARGIN, 240, 30, '#78716c');
  box(ctx, MARGIN, statsY, WIDTH - MARGIN * 2, 168, '#eff6ff');
  text(ctx, `산책 ${stats.walks}일  ·  꿀잠 ${stats.sleeps}일`, MARGIN + 28, statsY + 30, 34, '#1d4ed8', true);
  text(ctx, `목욕 ${stats.baths}회  ·  병원 ${stats.hospitals}회`, MARGIN + 28, statsY + 92, 30, '#1d4ed8');
  if (memos.length) {
    text(ctx, '그날의 한 줄 일기', MARGIN, memoY, 36, '#451a03', true);
    let y = memoY + 62;
    for (const memo of memos) {
      text(ctx, `${Number(memo.log.date.slice(8))}일`, MARGIN, y, 26, '#2563eb', true);
      y += 44;
      memo.lines.forEach((line) => { text(ctx, line, MARGIN + 16, y, 28); y += 42; });
      y += 28;
    }
  }
  text(ctx, '사진은 최대 9장 · 긴 일기는 두 줄로 담았어요', MARGIN, height - 64, 22, '#a8a29e');
  return { blob: await toBlob(element), filename: `치우_${month}_월간앨범.png` };
}
