'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import imageCompression from 'browser-image-compression';
import { 
  Camera, 
  Plus, 
  Minus, 
  Footprints, 
  Sparkles, 
  Calendar as CalendarIcon, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  X
} from 'lucide-react';

interface DailyLog {
  id: string;
  date: string;
  walked: boolean;
  walk_minutes: number;
  poop_count: number;
  photo_url: string | null;
  memo: string | null;
  created_at: string;
}

export default function Home() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(true);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [walked, setWalked] = useState(false);
  const [walkMinutes, setWalkMinutes] = useState(30);
  const [poopCount, setPoopCount] = useState(1);
  const [memo, setMemo] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('기록 불러오기 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removePhoto = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      let photoUrl: string | null = null;

      if (selectedFile) {
        const compressionOptions = {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          fileType: 'image/webp',
        };

        const compressedFile = await imageCompression(selectedFile, compressionOptions);
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.webp`;

        const { error: uploadError } = await supabase.storage
          .from('dog-photos')
          .upload(fileName, compressedFile, {
            contentType: 'image/webp',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('dog-photos')
          .getPublicUrl(fileName);

        photoUrl = publicUrlData.publicUrl;
      }

      const { error: insertError } = await supabase
        .from('daily_logs')
        .upsert(
          {
            date,
            walked,
            walk_minutes: walked ? walkMinutes : 0,
            poop_count: poopCount,
            photo_url: photoUrl,
            memo: memo.trim() || null,
          },
          { onConflict: 'date' }
        );

      if (insertError) throw insertError;

      setMemo('');
      removePhoto();
      setIsFormOpen(false);
      await fetchLogs();
    } catch (err: any) {
      alert(`저장 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`;
  };

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#4A4036] pb-24 px-4 font-sans">
      <div className="max-w-md mx-auto pt-6">
        <header className="flex items-center justify-between mb-5 px-1">
          <div>
            <div className="flex items-center gap-1.5 text-amber-700">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-bold tracking-wider uppercase">My Dog Diary</span>
            </div>
            <h1 className="text-2xl font-black text-[#2D2319] tracking-tight">댕댕 일기장 🐾</h1>
          </div>
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-100/80 text-amber-900 border border-amber-200/70 active:scale-95 transition-transform"
          >
            {isFormOpen ? (
              <>접기 <ChevronUp className="w-3.5 h-3.5" /></>
            ) : (
              <>오늘 기록 쓰기 <ChevronDown className="w-3.5 h-3.5" /></>
            )}
          </button>
        </header>

        {isFormOpen && (
          <section className="bg-white rounded-3xl p-5 mb-8 border border-amber-100 shadow-sm transition-all animate-in fade-in slide-in-from-top-2 duration-200">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <span className="text-xs font-bold text-stone-500 flex items-center gap-1">
                  <CalendarIcon className="w-3.5 h-3.5" /> 기록 날짜
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="text-sm font-semibold bg-stone-50 px-2.5 py-1 rounded-xl border border-stone-200 outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="bg-stone-50/80 p-3 rounded-2xl border border-stone-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold flex items-center gap-1.5">
                    <Footprints className="w-4 h-4 text-emerald-600" /> 오늘 산책했나요?
                  </span>
                  <button
                    type="button"
                    onClick={() => setWalked(!walked)}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                      walked 
                        ? 'bg-emerald-500 text-white shadow-sm' 
                        : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {walked ? '산책 완료! 🐾' : '쉬었어요'}
                  </button>
                </div>

                {walked && (
                  <div className="flex items-center justify-between pt-2 border-t border-stone-200/50">
                    <span className="text-xs text-stone-500">산책 시간</span>
                    <div className="flex gap-1">
                      {[15, 30, 45, 60].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setWalkMinutes(mins)}
                          className={`px-2 py-0.5 text-xs rounded-lg font-medium transition-all ${
                            walkMinutes === mins
                              ? 'bg-amber-500 text-white font-bold'
                              : 'bg-white border border-stone-200 text-stone-600'
                          }`}
                        >
                          {mins}분
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between bg-stone-50/80 p-3 rounded-2xl border border-stone-100">
                <span className="text-sm font-bold flex items-center gap-1">
                  💩 황금 응가 횟수
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPoopCount(Math.max(0, poopCount - 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-stone-200 text-stone-600 active:scale-90 transition-transform"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-base font-black w-5 text-center text-amber-900">
                    {poopCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPoopCount(poopCount + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-amber-500 text-white active:scale-90 transition-transform"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  className="hidden"
                />
                
                {previewUrl ? (
                  <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-stone-100 border border-amber-100">
                    <img 
                      src={previewUrl} 
                      alt="오늘의 미리보기" 
                      className="w-full h-full object-cover" 
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 flex flex-col items-center justify-center gap-1 text-amber-800 active:scale-[0.99] transition-transform"
                  >
                    <Camera className="w-5 h-5 text-amber-700" />
                    <span className="text-xs font-semibold">오늘의 귀여운 컷 찍기/선택</span>
                  </button>
                )}
              </div>

              <div>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="오늘 특별했던 일이나 건강 상태를 적어주세요 :)"
                  rows={2}
                  className="w-full p-3 text-sm bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-stone-400 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> 저장하는 중...
                  </>
                ) : (
                  '오늘 하루 저장하기 🦴'
                )}
              </button>
            </form>
          </section>
        )}

        <section className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-stone-600">지난 기록들 ({logs.length})</h2>
          </div>

          {loading ? (
            <div className="text-center py-12 text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
              <p className="text-xs">추억을 불러오는 중...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-amber-100 shadow-sm">
              <p className="text-2xl mb-2">🐶</p>
              <p className="text-sm font-semibold text-stone-600">아직 작성된 일기가 없어요</p>
              <p className="text-xs text-stone-400 mt-1">위 폼에서 첫 기록을 남겨보세요!</p>
            </div>
          ) : (
            logs.map((log) => (
              <article
                key={log.id}
                className="bg-white rounded-3xl p-4 border border-stone-200/70 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-bold text-stone-800">
                    {formatDate(log.date)}
                  </span>
                  <span className="text-[11px] font-medium text-stone-400">
                    {log.date}
                  </span>
                </div>

                {log.photo_url && (
                  <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-stone-100 border border-stone-100">
                    <img
                      src={log.photo_url}
                      alt={`${log.date} 기록 사진`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {log.walked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60">
                      🐾 산책 {log.walk_minutes}분 완료
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 text-stone-500 text-xs font-medium">
                      💤 집콕 휴식
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200/60">
                    💩 응가 {log.poop_count}회
                  </span>
                </div>

                {log.memo && (
                  <p className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl leading-relaxed whitespace-pre-wrap">
                    {log.memo}
                  </p>
                )}
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}