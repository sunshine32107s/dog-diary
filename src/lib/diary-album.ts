export interface AlbumLog {
  id: string;
  date: string;
  photo_url: string | null;
  memo: string | null;
  walked: boolean;
  sleep_well: boolean;
  poop_count: number;
  weight: number | null;
  bath: boolean;
  ear_clean: boolean;
  play: boolean;
  paw_clean: boolean;
  paw_moist: boolean;
  brush: boolean;
  heartworm: boolean;
  hospital: boolean;
  condition_bad: boolean;
}

export function albumDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(year, month - 1, day).getDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

export function chronologicalLogs<T extends AlbumLog>(logs: T[]) {
  return [...logs].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function monthLogs<T extends AlbumLog>(logs: T[], month: string) {
  return chronologicalLogs(logs.filter((log) => log.date.startsWith(`${month}-`)));
}

// Spread the cover photos across the month rather than taking only the newest nine.
export function albumPhotos(logs: AlbumLog[], limit = 9) {
  const photos = chronologicalLogs(logs.filter((log) => log.photo_url));
  if (photos.length <= limit) return photos;
  if (limit <= 1) return photos.slice(0, Math.max(0, limit));
  return Array.from({ length: limit }, (_, index) => photos[Math.round(index * (photos.length - 1) / (limit - 1))]);
}

export function careLabels(log: AlbumLog) {
  const checks: [keyof AlbumLog, string][] = [
    ['ear_clean', '귀 청소'], ['brush', '빗질'], ['bath', '목욕'],
    ['play', '총캉총캉'], ['paw_clean', '클린 발'], ['paw_moist', '매끈 발'],
    ['heartworm', '사상충'], ['hospital', '병원'], ['condition_bad', '컨디션↓'],
  ];
  return checks.filter(([key]) => log[key]).map(([, label]) => label);
}

export function albumStats(logs: AlbumLog[]) {
  return {
    days: logs.length,
    photos: logs.filter((log) => log.photo_url).length,
    walks: logs.filter((log) => log.walked).length,
    sleeps: logs.filter((log) => log.sleep_well ?? true).length,
    baths: logs.filter((log) => log.bath).length,
    hospitals: logs.filter((log) => log.hospital).length,
  };
}
