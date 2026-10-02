import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { crc32, createZip, backupCsv, buildBackup } from '../src/lib/diary-backup.ts';
const enc = new TextEncoder();
test('ZIP CRC standard vector and empty content', () => {
  assert.equal(crc32(enc.encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array()), 0);
});
test('ZIP headers, UTF8 name, stored bytes, directory offsets', async () => {
  const bytes = new Uint8Array(await createZip([{name:'사진.txt',bytes:enc.encode('치우')}]).arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0,true),0x04034b50);
  assert.equal(view.getUint16(6,true),0x800);
  const size=view.getUint32(18,true), nameLength=view.getUint16(26,true);
  assert.equal(new TextDecoder().decode(bytes.slice(30,30+nameLength)), '사진.txt');
  assert.equal(new TextDecoder().decode(bytes.slice(30+nameLength,30+nameLength+size)), '치우');
  const end=bytes.length-22, central=view.getUint32(end+16,true);
  assert.equal(view.getUint32(central,true),0x02014b50);
  assert.equal(view.getUint32(central+42,true),0);
  assert.equal(view.getUint16(end+10,true),1);
});
test('ZIP refuses unsafe and duplicate paths', () => {
  for (const name of ['/secret','../secret','photos/../secret']) assert.throws(()=>createZip([{name,bytes:new Uint8Array()}]));
  assert.throws(()=>createZip([{name:'a',bytes:new Uint8Array()},{name:'a',bytes:new Uint8Array()}]));
});
test('CSV quotes commas/newlines and neutralizes spreadsheet formulas', () => {
  const csv=backupCsv([{id:'1',date:'2026-10-02',photo_url:null,memo:'=HYPERLINK("x")\n,치우'}]);
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")\n,치우"'));
});
test('backup contains actual photo bytes and all record fields', async () => {
  const png = Uint8Array.from([137,80,78,71,13,10,26,10]);
  const url='data:image/png;base64,'+Buffer.from(png).toString('base64');
  const progress=[];
  const zip=await buildBackup([{id:'test',date:'2026-10-02',photo_url:url,memo:'치우',walk_minutes:30}],new AbortController().signal,(...value)=>progress.push(value));
  const bytes=Buffer.from(await zip.arrayBuffer());
  assert.ok(bytes.includes(png)); assert.ok(bytes.includes(Buffer.from('"walk_minutes": 30')));
  assert.ok(bytes.includes(Buffer.from('photos/2026-10-02_test.png')));
  assert.deepEqual(progress,[[0,1],[1,1]]);
  if (process.env.BACKUP_TEST_OUTPUT) await writeFile(process.env.BACKUP_TEST_OUTPUT,bytes);
});
test('failed photo and cancellation never create partial success', async () => {
  await assert.rejects(buildBackup([{id:'x',date:'2026-10-02',photo_url:'data:text/html,bad'}],new AbortController().signal,()=>{}));
  const abort=new AbortController(); abort.abort();
  await assert.rejects(buildBackup([{id:'x',date:'2026-10-02',photo_url:'data:image/png;base64,iVBORw=='}],abort.signal,()=>{}));
});
test('photo removal stays null; mutations verify affected row before cleanup', async () => {
  const source=await readFile(new URL('../src/app/page.tsx',import.meta.url),'utf8');
  assert.ok(source.includes('let finalPhotoUrl: string | null = existingPhotoUrl;'));
  assert.ok(!source.includes(".upsert(payload"));
  assert.ok(source.includes(".eq('id', editingLogId).select('id').single()"));
  assert.ok(source.indexOf('databaseSaved = true;') < source.indexOf('await deletePhotoFromStorage(effectiveOriginalPhoto)'));
});
