'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Share2, X } from 'lucide-react';
import type { AlbumLog } from '@/lib/diary-album';

export default function AlbumExport({ daily, logs, month, onClose }: {
  daily?: AlbumLog;
  logs?: AlbumLog[];
  month?: string;
  onClose: () => void;
}) {
  const [output, setOutput] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let url: string | undefined;
    (async () => {
      try {
        const { dailyImage, monthlyImage } = await import('@/lib/album-image');
        if (cancelled) return;
        const result = daily ? await dailyImage(daily, controller.signal) : await monthlyImage(logs ?? [], month ?? '', controller.signal);
        if (cancelled) return;
        url = URL.createObjectURL(result.blob);
        setOutput({ file: new File([result.blob], result.filename, { type: 'image/png' }), url });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '이미지를 만들지 못했어요. 다시 시도해주세요.');
      }
    })();
    return () => { cancelled = true; controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [daily, logs, month, attempt]);

  const download = () => {
    if (!output) return;
    const link = document.createElement('a');
    link.href = output.url;
    link.download = output.file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setNotice('이미지 파일로 저장했어요. 휴대폰에서는 다운로드한 이미지를 사진 앱에 저장할 수 있어요.');
  };

  const share = async () => {
    if (!output || sharing) return;
    if (!navigator.canShare?.({ files: [output.file] })) {
      download();
      setNotice('이 브라우저는 파일 공유를 지원하지 않아 이미지로 저장했어요. 사진 앱에서 공유해주세요.');
      return;
    }
    try {
      setSharing(true);
      await navigator.share({ files: [output.file], title: daily ? '치우의 하루' : '치우의 월간 앨범' });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setNotice('공유 메뉴를 열지 못했어요. 사진으로 저장한 뒤 공유해주세요.');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="album-export-title"
      className="m-auto w-[calc(100%-2rem)] max-w-sm max-h-[90dvh] rounded-3xl bg-[#faf7f2] p-4 text-stone-700 shadow-2xl backdrop:bg-black/70">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 id="album-export-title" className="text-sm font-black text-amber-950">{daily ? '하루 기록 저장·공유' : '월간 앨범 저장·공유'}</h2>
        <button autoFocus onClick={onClose} aria-label="이미지 미리보기 닫기" className="p-2 rounded-full bg-white"><X className="w-4 h-4" /></button>
      </div>
      {!output && !error && <p role="status" className="py-16 text-center text-xs"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />추억을 이미지로 만들고 있어요…</p>}
      {error && <div role="alert" className="py-8 text-center text-xs space-y-4"><p>{error}</p><button onClick={() => { setError(''); setOutput(null); setAttempt((value) => value + 1); }} className="rounded-xl bg-blue-600 text-white px-4 py-2">다시 시도</button></div>}
      {output && <>
        <div className="max-h-[55dvh] overflow-y-auto rounded-2xl border border-amber-100"><img src={output.url} alt={daily ? '하루 기록 이미지 미리보기' : '월간 앨범 이미지 미리보기'} className="w-full" /></div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={download} className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white text-xs font-bold"><Download className="w-4 h-4" />사진으로 저장</button>
          <button onClick={share} disabled={sharing} className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50"><Share2 className="w-4 h-4" />공유하기</button>
        </div>
      </>}
      <p role="status" className="text-[11px] leading-relaxed mt-3">{notice || (daily ? '미리보기 이미지 그대로 저장돼요.' : '선택한 달의 전체 기록과 최대 9장의 사진을 담아요. 긴 일기는 두 줄로 요약해요.')}</p>
    </dialog>
  );
}
