import { test } from 'node:test';
import assert from 'node:assert/strict';
import { albumDate, albumPhotos, albumStats, chronologicalLogs, monthLogs } from '../src/lib/diary-album.ts';

const log = (date, extra = {}) => ({ id: date, date, photo_url: `https://example.test/${date}.jpg`, walked: false, sleep_well: true, bath: false, hospital: false, ...extra });

test('month selection and chronological navigation preserve the source order', () => {
  const input = [log('2026-10-02'), log('2026-09-30'), log('2026-10-01')];
  assert.deepEqual(monthLogs(input, '2026-10').map((l) => l.date), ['2026-10-01', '2026-10-02']);
  assert.deepEqual(input.map((l) => l.date), ['2026-10-02', '2026-09-30', '2026-10-01']);
  assert.equal(chronologicalLogs(input)[0].date, '2026-09-30');
});

test('a nine-photo cover spans the whole month and excludes days without photos', () => {
  const input = Array.from({ length: 31 }, (_, i) => log(`2026-10-${String(i + 1).padStart(2, '0')}`));
  const photos = albumPhotos([...input, log('2026-09-30', { photo_url: null })]);
  assert.equal(photos.length, 9);
  assert.equal(new Set(photos.map((l) => l.id)).size, 9);
  assert.equal(photos[0].date, '2026-10-01');
  assert.equal(photos.at(-1).date, '2026-10-31');
  assert.deepEqual(albumPhotos([], 9), []);
  assert.equal(albumPhotos(input.slice(0, 1)).length, 1);
});

test('monthly statistics include days without photos and legacy sleep defaults', () => {
  assert.deepEqual(albumStats([
    log('2026-10-01', { walked: true, sleep_well: null, photo_url: null, bath: true }),
    log('2026-10-02', { sleep_well: false, hospital: true }),
  ]), { days: 2, photos: 1, walks: 1, sleeps: 1, baths: 1, hospitals: 1 });
  assert.equal(albumStats([]).days, 0);
});

test('date labels use calendar dates without UTC timezone shifts', () => {
  assert.equal(albumDate('2026-10-01'), '2026년 10월 1일 (목)');
});
