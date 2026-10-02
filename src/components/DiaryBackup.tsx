'use client';
import { useEffect, useRef, useState } from 'react';
import { buildBackup, type BackupLog } from '@/lib/diary-backup';

export default function DiaryBackup({ logs, onClose }: { logs: BackupLog[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const downloadUrl = useRef<string | null>(null);
  const [month, setMonth] = useState('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const months = [...new Set(logs.map(log => log.date.slice(0, 7)))].sort().reverse();
  useEffect(() => {
    dialog.current?.showModal();
    return () => { controller.current?.abort(); if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current); };
  }, []);
  async function prepare() {
    if (busy) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setMessage('백업 준비 중…');
    try {
      const selected = month === 'all' ? logs : logs.filter(log => log.date.startsWith(month));
      const blob = await buildBackup(selected, abort.signal, (done, total) => setMessage(`사진 준비 ${done} / ${total}`));
      abort.signal.throwIfAborted();
      downloadUrl.current = URL.createObjectURL(blob); setReadyUrl(downloadUrl.current);
      setMessage(`기록 ${selected.length}개와 사진 ${selected.filter(log => log.photo_url).length}개 준비 완료`);
    } catch (error) {
      if (!abort.signal.aborted) setMessage(error instanceof Error ? error.message : '백업을 만들지 못했어요.');
    } finally { if (!abort.signal.aborted) setBusy(false); }
  }
  return <dialog ref={dialog} onClose={onClose} className="m-auto w-[90vw] max-w-sm rounded-3xl bg-white p-6 text-amber-950 backdrop:bg-black/40">
    <div className="space-y-4">
      <h2 className="font-black">사진까지 ZIP 백업</h2>
      <p className="text-sm text-stone-600">기록 데이터와 실제 사진 파일을 함께 담아요. 앱에 저장된 압축 사진이며, 자동 복원 기능은 아직 없어요. 용량이 크면 월별로 나누어주세요.</p>
      <label className="block text-sm">백업 기간<select value={month} disabled={busy || Boolean(readyUrl)} onChange={event => setMonth(event.target.value)} className="mt-2 border rounded-xl p-3 w-full"><option value="all">전체 기록</option>{months.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      {message && <p role="status" aria-live="polite" className="text-sm">{message}</p>}
      {readyUrl ? <a href={readyUrl} download={`치우_기록_${month}.zip`} className="block text-center bg-emerald-600 text-white rounded-xl p-3">ZIP 파일 저장</a> : <button type="button" disabled={busy || !logs.length} onClick={prepare} className="w-full bg-emerald-600 text-white rounded-xl p-3 disabled:opacity-50">{busy ? '준비 중…' : '백업 만들기'}</button>}
      <button type="button" onClick={onClose} className="w-full p-2 text-sm">{busy ? '취소하고 닫기' : '닫기'}</button>
    </div>
  </dialog>;
}
