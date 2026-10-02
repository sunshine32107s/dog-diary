'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronLeft, ChevronRight, Download, Pause, Play, X } from 'lucide-react';
import { albumDate, careLabels, type AlbumLog } from '@/lib/diary-album';

const AlbumExport = dynamic(() => import('./AlbumExport'), { ssr: false });

export default function DiaryViewer({ logs, initialId, autoplay, onClose }: {
  logs: AlbumLog[];
  initialId: string;
  autoplay: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(() => Math.max(0, logs.findIndex((log) => log.id === initialId)));
  const [playing, setPlaying] = useState(autoplay && logs.length > 1);
  const [imageReady, setImageReady] = useState('');
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const log = logs[index];

  useLayoutEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => { content.current?.scrollTo({ top: 0 }); }, [index]);

  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);

  useEffect(() => {
    if (!playing || exporting || !log || (log.photo_url && imageReady !== log.id && !failedImages.has(log.id))) return;
    const timer = window.setTimeout(() => {
      if (index < logs.length - 1) setIndex(index + 1);
      else setPlaying(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [playing, exporting, index, logs.length, log, imageReady, failedImages]);

  useEffect(() => {
    if (!playing || !logs[index + 1]?.photo_url) return;
    const next = new Image();
    next.src = logs[index + 1].photo_url!;
    return () => { next.src = ''; };
  }, [playing, index, logs]);

  if (!log) return null;
  const move = (direction: number) => {
    setPlaying(false);
    setIndex((value) => Math.min(logs.length - 1, Math.max(0, value + direction)));
  };
  const togglePlay = () => {
    if (!playing && index === logs.length - 1) setIndex(0);
    setPlaying((value) => !value);
  };

  return <>
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="diary-viewer-title"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => {
        if (exporting) return;
        if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm max-h-[92dvh] overflow-hidden rounded-3xl bg-white text-stone-700 shadow-2xl backdrop:bg-black/70">
      <div className="flex items-center justify-between px-4 py-2 border-b border-amber-50">
        <h2 id="diary-viewer-title" className="text-xs font-black text-amber-950">치우의 추억 <span className="ml-1 text-stone-400 font-normal">{index + 1} / {logs.length}</span></h2>
        <button autoFocus onClick={onClose} aria-label="상세 기록 닫기" className="p-2 rounded-full hover:bg-stone-100"><X className="w-4 h-4" /></button>
      </div>
      <div ref={content} className="max-h-[calc(92dvh-9rem)] overflow-y-auto overscroll-contain"
        onTouchStart={(event) => {
          swiped.current = false;
          touch.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
        }}
        onTouchCancel={() => { touch.current = null; }}
        onTouchEnd={(event) => {
          const start = touch.current;
          touch.current = null;
          if (!start || !event.changedTouches.length) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            swiped.current = true;
            move(dx < 0 ? 1 : -1);
          }
        }}>
        {log.photo_url && <div className="relative aspect-square bg-stone-100"
          onClick={() => { if (swiped.current) { swiped.current = false; return; } if (playing) setPlaying(false); }}>
          {failedImages.has(log.id) ? <p className="absolute inset-0 flex items-center justify-center text-xs text-stone-500">사진을 불러오지 못했어요</p> :
            <img key={log.id} src={log.photo_url} alt={`${albumDate(log.date)} 치우`} className="w-full h-full object-cover" decoding="async"
              onLoad={() => setImageReady(log.id)}
              onError={() => setFailedImages((previous) => new Set(previous).add(log.id))} />}
          {playing && <span className="absolute bottom-3 right-3 text-[10px] bg-black/50 text-white rounded-full px-2 py-1 pointer-events-none">터치하면 일시정지</span>}
        </div>}
        <div className="px-4 py-4 space-y-3">
          <p className="text-sm font-black text-amber-950">{albumDate(log.date)}</p>
          {log.memo && <p className="text-xs leading-relaxed whitespace-pre-wrap break-words bg-amber-50/60 rounded-xl p-3">{log.memo}</p>}
          <div className="flex flex-wrap gap-1.5 text-[10px] font-bold text-blue-700">
            <span className="bg-blue-50 rounded-lg px-2 py-1">{(log.sleep_well ?? true) ? '🌙 꿀잠' : '🌧️ 뒤척임'}</span>
            <span className="bg-blue-50 rounded-lg px-2 py-1">{log.walked ? '🐾 산책함' : '💤 집콕'}</span>
            <span className="bg-amber-50 rounded-lg px-2 py-1">💩 응가 {log.poop_count || 0}회</span>
            {log.weight && <span className="bg-blue-50 rounded-lg px-2 py-1">{log.weight}kg</span>}
            {careLabels(log).map((label) => <span key={label} className="bg-stone-100 text-stone-600 rounded-lg px-2 py-1">{label}</span>)}
          </div>
        </div>
      </div>
      <div className="border-t border-amber-100 px-3 py-2 space-y-1">
        <div className="grid grid-cols-3 items-center">
          <div>{index > 0 && <button aria-label="이전 기록" onClick={() => move(-1)} className="flex items-center text-xs font-bold p-2"><ChevronLeft className="w-4 h-4" />이전</button>}</div>
          <button onClick={togglePlay} disabled={logs.length < 2} className="flex justify-center items-center gap-1 p-2 text-xs font-bold text-blue-700 disabled:opacity-40">{playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}{playing ? '일시정지' : '재생'}</button>
          <div className="flex justify-end">{index < logs.length - 1 && <button aria-label="다음 기록" onClick={() => move(1)} className="flex items-center text-xs font-bold p-2">다음<ChevronRight className="w-4 h-4" /></button>}</div>
        </div>
        <button onClick={() => { setPlaying(false); setExporting(true); }} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-50 text-amber-950 text-xs font-bold"><Download className="w-3.5 h-3.5" />이 하루 저장·공유</button>
      </div>
    </dialog>
    {exporting && <AlbumExport daily={log} onClose={() => setExporting(false)} />}
  </>;
}
