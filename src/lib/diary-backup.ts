export type BackupLog = { id: string; date: string; photo_url: string | null };
const encoder = new TextEncoder();
const MAX_BYTES = 96 * 1024 * 1024;
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let value = i;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  CRC_TABLE[i] = value >>> 0;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 255];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ZIP STORE: photos are already compressed; no new dependency or recompression.
export function createZip(files: { name: string; bytes: Uint8Array }[]): Blob {
  if (files.length > 65535) throw new Error('파일이 너무 많아요. 월별로 백업해주세요.');
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  const names = new Set<string>();
  let offset = 0;
  for (const file of files) {
    if (names.has(file.name) || !file.name || file.name.startsWith('/') || file.name.split('/').includes('..')) throw new Error('잘못된 백업 파일 이름');
    names.add(file.name);
    const name = encoder.encode(file.name);
    if (name.length > 65535) throw new Error('파일 이름이 너무 길어요.');
    const size = file.bytes.length;
    if (offset + size > MAX_BYTES) throw new Error('백업이 커요. 월별로 나누어 백업해주세요.');
    const crc = crc32(file.bytes);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x800, true); lv.setUint16(12, 0x21, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, size, true); lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true); local.set(name, 30);
    const entry = new Uint8Array(46 + name.length);
    const cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x800, true); cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); entry.set(name, 46);
    parts.push(local.buffer, file.bytes.slice().buffer as ArrayBuffer);
    central.push(entry);
    offset += local.length + size;
  }
  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central.map(entry => entry.buffer as ArrayBuffer), end.buffer], { type: 'application/zip' });
}

export function backupCsv(logs: BackupLog[]): string {
  const keys = [...new Set(logs.flatMap(log => Object.keys(log)))];
  const cell = (value: unknown) => {
    let text = value == null ? '' : String(value);
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [keys.map(cell).join(','), ...logs.map(log => keys.map(key => cell((log as unknown as Record<string, unknown>)[key])).join(','))].join('\r\n');
}

export async function buildBackup(logs: BackupLog[], signal: AbortSignal, progress: (done: number, total: number) => void): Promise<Blob> {
  if (!logs.length) throw new Error('선택한 기간에 기록이 없어요.');
  const files: { name: string; bytes: Uint8Array }[] = [];
  const photos: { id: string; date: string; original_url: string; file: string }[] = [];
  let totalBytes = 0;
  const add = (name: string, bytes: Uint8Array) => {
    totalBytes += bytes.length;
    if (totalBytes > MAX_BYTES) throw new Error('백업이 커요. 월별로 나누어 백업해주세요.');
    files.push({ name, bytes });
  };
  const withPhotos = logs.filter(log => log.photo_url);
  progress(0, withPhotos.length);
  for (const log of withPhotos) {
    signal.throwIfAborted();
    const response = await fetch(log.photo_url!, { signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]) });
    const type = response.headers.get('content-type')?.split(';')[0];
    const ext = ({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' } as Record<string, string>)[type ?? ''];
    if (!response.ok || !ext || !response.body) { await response.body?.cancel(); throw new Error(`${log.date} 사진을 받지 못했어요. 백업은 저장하지 않았어요.`); }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 12 * 1024 * 1024 || totalBytes + size > MAX_BYTES) throw new Error('사진 용량이 커요. 월별로 나누어 백업해주세요.');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    if (!size) throw new Error(`${log.date} 사진 파일이 비어 있어요.`);
    const bytes = new Uint8Array(size);
    let position = 0;
    for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.length; }
    const file = `photos/${log.date.replace(/[^0-9-]/g, '')}_${log.id.replace(/[^a-zA-Z0-9_-]/g, '')}.${ext}`;
    add(file, bytes);
    photos.push({ id: log.id, date: log.date, original_url: log.photo_url!, file });
    progress(photos.length, withPhotos.length);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  signal.throwIfAborted();
  add('records.json', encoder.encode(JSON.stringify(logs, null, 2)));
  add('records.csv', encoder.encode(backupCsv(logs)));
  add('manifest.json', encoder.encode(JSON.stringify({ version: 1, created_at: new Date().toISOString(), record_count: logs.length, photos }, null, 2)));
  add('README.txt', encoder.encode('치우의 하루하루 백업\nrecords.json: 전체 기록 원본 데이터\nrecords.csv: 엑셀용 기록\nphotos/: 실제 사진 파일\nmanifest.json: 기록과 사진 파일 연결 정보\n사진은 앱에 저장된 압축본이며 휴대폰의 원본 사진은 아닙니다.\n자동 복원 기능은 아직 제공하지 않습니다.\n개인 기록이므로 안전한 곳에 보관해주세요.\n'));
  return createZip(files);
}
