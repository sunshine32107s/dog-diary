'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  BarChart3,
  Check
} from 'lucide-react';

interface DailyLog {
  id: string;
  date: string;
  walked: boolean;
  poop_count: number;
  photo_url: string | null;
  memo: string | null;
  bath: boolean;
  ear_clean: boolean;
  play: boolean;
  paw_clean: boolean;
  brush: boolean;
  created_at: string;
}

export default function Home() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 1. 메인에 기록 작성창이 바로 열려있도록 true로 기본 설정
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [currentView, setCurrentView] = useState<'feed' | 'calendar'>('feed');

  // 달력 및 통계용 기준 연/월
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  // 입력 폼 상태
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [walked, setWalked] = useState(false);
  const [poopCount, setPoopCount] = useState(1);
  const [memo, setMemo] = useState('');
  const [bath, setBath] = useState(false);
  const [earClean, setEarClean] = useState(false);
  const [play, setPlay] = useState(false);
  const [pawClean, setPawClean] = useState(false);
  const [brush, setBrush] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 데이터 불러오기
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

  // 삭제 기능
  const handleDelete = async (id: string, photoUrl: string | null) => {
    if (!confirm('이 기록을 삭제할까요?')) return;

    try {
      const { error } = await supabase.from('daily_logs').delete().eq('id', id);
      if (error) throw error;

      if (photoUrl) {
        const pathParts = photoUrl.split('/');
        const fileName = pathParts[pathParts.length - 1];
        await supabase.storage.from('dog-photos').remove([fileName]);
      }

      setLogs((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      alert(`삭제 중 오류가 발생했습니다: ${err.message}`);
    }
  };

  // 사진 선택
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

  // 저장 (Upsert)
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
            poop_count: poopCount,
            photo_url: photoUrl,
            memo: memo.trim() || null,
            bath,
            ear_clean: earClean,
            play,
            paw_clean: pawClean,
            brush,
          },
          { onConflict: 'date' }
        );

      if (insertError) throw insertError;

      // 폼 초기화
      setMemo('');
      setBath(false);
      setEarClean(false);
      setPlay(false);
      setPawClean(false);
      setBrush(false);
      removePhoto();
      await fetchLogs();
    } catch (err: any) {
      alert(`저장 중 오류: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`;
  };

  // 월간 통계 계산
  const monthlyStats = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth() + 1;
    const prefix = `${year}-${String(month).padStart(2, '0')}`;

    const currentLogs = logs.filter((log) => log.date.startsWith(prefix));

    return {
      totalDays: currentLogs.length,
      walkCount: currentLogs.filter((l) => l.walked).length,
      totalPoop: currentLogs.reduce((acc, cur) => acc + (cur.poop_count || 0), 0),
      bath: currentLogs.filter((l) => l.bath).length,
      earClean: currentLogs.filter((l) => l.ear_clean).length,
      play: currentLogs.filter((l) => l.play).length,
      pawClean: currentLogs.filter((l) => l.paw_clean).length,
      brush: currentLogs.filter((l) => l.brush).length,
    };
  }, [logs, currentMonthDate]);

  // 달력 날짜 생성
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= lastDate; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const log = logs.find((l) => l.date === dateStr);
      days.push({ dayNumber: i, dateStr, log });
    }
    return days;
  }, [currentMonthDate, logs]);

  return (
    // 2. 스마트폰 기본 시스템 폰트(system-ui) 우선 적용
    <main 
      className="min-h-screen bg-[#FCFAF6] text-[#3B342B] pb-24 px-4"
      style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif' }}
    >
      <div className="max-w-md mx-auto pt-6">
        
        {/* 상단 헤더 */}
        <header className="flex items-center justify-between mb-4 px-1">
          <div>
            <div className="flex items-center gap-1.5 text-blue-600">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-black tracking-widest uppercase text-blue-600">Chiu's Daily Record</span>
            </div>
            <h1 className="text-2xl font-black text-amber-950 tracking-tight flex items-center gap-1.5">
              치우의 하루하루 🐾
            </h1>
          </div>
          
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200/80 active:scale-95 transition-all"
          >
            {isFormOpen ? (
              <>접기 <ChevronUp className="w-3.5 h-3.5" /></>
            ) : (
              <>기록 쓰기 <ChevronDown className="w-3.5 h-3.5" /></>
            )}
          </button>
        </header>

        {/* 탭 전환: '기록' vs '달력 & 통계' */}
        <nav className="flex bg-amber-100/70 p-1 rounded-2xl mb-5">
          <button
            onClick={() => setCurrentView('feed')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
              currentView === 'feed'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-amber-800/70 hover:text-amber-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> 기록
          </button>
          <button
            onClick={() => setCurrentView('calendar')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
              currentView === 'calendar'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-amber-800/70 hover:text-amber-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> 달력 & 통계
          </button>
        </nav>

        {/* 1) 기록 뷰 (입력창 + 카드 리스트) */}
        {currentView === 'feed' && (
          <div className="space-y-6">
            
            {/* 기록 입력 폼 */}
            {isFormOpen && (
              <section className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-xs transition-all">
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* 날짜 선택 */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-amber-50">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5 text-blue-600" /> 기록 날짜
                    </span>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="text-xs font-bold bg-amber-50/70 text-amber-900 px-3 py-1.5 rounded-xl border border-amber-200 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* 산책 여부 & 응가 횟수 */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-100 flex flex-col justify-between">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                        <Footprints className="w-3.5 h-3.5 text-blue-600" /> 오늘 산책
                      </span>
                      <button
                        type="button"
                        onClick={() => setWalked(!walked)}
                        className={`mt-2 py-2 text-xs font-black rounded-xl transition-all ${
                          walked 
                            ? 'bg-blue-600 text-white shadow-xs' 
                            : 'bg-stone-200/80 text-stone-500'
                        }`}
                      >
                        {walked ? '산책 완료 🐾' : '쉬었어요'}
                      </button>
                    </div>

                    <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-100 flex flex-col justify-between">
                      <span className="text-xs font-bold text-amber-900">💩 황금 응가</span>
                      <div className="flex items-center justify-between mt-2">
                        <button
                          type="button"
                          onClick={() => setPoopCount(Math.max(0, poopCount - 1))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-amber-200 text-amber-900 active:scale-90"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-base font-black text-amber-950">{poopCount}회</span>
                        <button
                          type="button"
                          onClick={() => setPoopCount(poopCount + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500 text-white active:scale-90"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. 치우는 오늘: 1행 3개 / 2행 2개 깔끔한 정렬 */}
                  <div className="bg-amber-50/40 p-3.5 rounded-2xl border border-amber-100/80 space-y-2">
                    <span className="text-xs font-bold text-amber-900 block">✨ 치우는 오늘</span>
                    
                    {/* 첫 번째 행: 귀 청소, 빗질, 목욕 */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: '귀 청소 👂', val: earClean, setVal: setEarClean },
                        { label: '빗질 🪮', val: brush, setVal: setBrush },
                        { label: '목욕 🛁', val: bath, setVal: setBath },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => item.setVal(!item.val)}
                          className={`py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-0.5 transition-all ${
                            item.val
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-white border border-amber-200/70 text-amber-900'
                          }`}
                        >
                          {item.val && <Check className="w-3 h-3 stroke-[3]" />}
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* 두 번째 행: 총캉총캉, 클린발바닥 */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { label: '총캉총캉 ⚡', val: play, setVal: setPlay },
                        { label: '클린발바닥 🐾', val: pawClean, setVal: setPawClean },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => item.setVal(!item.val)}
                          className={`py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                            item.val
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-white border border-amber-200/70 text-amber-900'
                          }`}
                        >
                          {item.val && <Check className="w-3 h-3 stroke-[3]" />}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. 사진 첨부: '치우의 오늘 모습' 문구 적용 */}
                  <div className="space-y-1.5">
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    
                    {previewUrl ? (
                      <div className="relative rounded-2xl overflow-hidden aspect-square bg-stone-100 border border-amber-200">
                        <img src={previewUrl} alt="미리보기" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-4 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/30 flex flex-col items-center justify-center gap-1 text-amber-900 active:scale-[0.99]"
                      >
                        <Camera className="w-5 h-5 text-blue-600" />
                        <span className="text-xs font-bold">치우의 오늘 모습</span>
                      </button>
                    )}
                  </div>

                  {/* 메모 입력 */}
                  <div>
                    <textarea
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      placeholder="치우에게 오늘 있었던 특별한 일이나 컨디션 :)"
                      rows={2}
                      className="w-full p-3 text-xs bg-amber-50/30 border border-amber-200 rounded-2xl outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-stone-400 resize-none"
                    />
                  </div>

                  {/* 5. 저장 버튼: 발바닥 이모지로 변경 */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs disabled:opacity-50"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> 저장하는 중...</>
                    ) : (
                      '치우의 하루 저장하기 🐾'
                    )}
                  </button>
                </form>
              </section>
            )}

            {/* 지난 기록 카드 피드 */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                  기록 모아보기 ({logs.length})
                </h2>
              </div>

              {loading ? (
                <div className="text-center py-12 text-amber-800/60">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-xs font-semibold">치우의 추억을 불러오고 있어요...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center border border-amber-100 shadow-xs">
                  <p className="text-3xl mb-2">🐶</p>
                  <p className="text-sm font-bold text-amber-950">아직 등록된 일기가 없어요</p>
                  <p className="text-xs text-amber-700/60 mt-1">위 입력창에서 치우의 첫 일기를 남겨보세요!</p>
                </div>
              ) : (
                logs.map((log) => (
                  <article
                    key={log.id}
                    className="bg-white rounded-3xl p-4 border border-amber-100 shadow-xs space-y-3"
                  >
                    {/* 날짜 및 삭제 버튼 */}
                    <div className="flex items-center justify-between px-1">
                      <span className="text-sm font-black text-amber-950">
                        {formatDate(log.date)}
                      </span>
                      <button
                        onClick={() => handleDelete(log.id, log.photo_url)}
                        className="p-1.5 text-stone-300 hover:text-rose-500 rounded-lg transition-colors"
                        title="삭제하기"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 사진 */}
                    {log.photo_url && (
                      <div className="relative rounded-2xl overflow-hidden aspect-square bg-amber-50/50 border border-amber-100">
                        <img
                          src={log.photo_url}
                          alt={`${log.date} 치우`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* 기본 뱃지: 산책 & 응가 */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {log.walked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                          🐾 산책 완료
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 text-stone-500 text-xs font-semibold">
                          💤 집콕
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200">
                        💩 응가 {log.poop_count}회
                      </span>
                    </div>

                    {/* 치우는 오늘 체크 뱃지 */}
                    {(log.bath || log.ear_clean || log.play || log.paw_clean || log.brush) && (
                      <div className="flex flex-wrap gap-1 pt-0.5 border-t border-amber-50">
                        {log.ear_clean && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/60">👂 귀 청소</span>}
                        {log.brush && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/60">🪮 빗질</span>}
                        {log.bath && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/60">🛁 목욕</span>}
                        {log.play && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/60">⚡ 총캉총캉</span>}
                        {log.paw_clean && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/60">🐾 클린발바닥</span>}
                      </div>
                    )}

                    {/* 메모 */}
                    {log.memo && (
                      <p className="text-xs text-amber-950 bg-amber-50/60 p-3 rounded-2xl leading-relaxed whitespace-pre-wrap">
                        {log.memo}
                      </p>
                    )}
                  </article>
                ))
              )}
            </section>
          </div>
        )}

        {/* 2) 달력 & 통계 뷰 */}
        {currentView === 'calendar' && (
          <section className="space-y-4">
            
            {/* 월 네비게이션 */}
            <div className="bg-white rounded-3xl p-4 border border-amber-100 shadow-xs flex items-center justify-between">
              <button
                onClick={() => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1))}
                className="p-1 rounded-xl hover:bg-amber-50 text-amber-900"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-base font-black text-amber-950">
                {currentMonthDate.getFullYear()}년 {currentMonthDate.getMonth() + 1}월
              </h2>
              <button
                onClick={() => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1))}
                className="p-1 rounded-xl hover:bg-amber-50 text-amber-900"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* 월간 통계 카드 */}
            <div className="bg-white rounded-3xl p-4 border border-amber-100 shadow-xs space-y-3">
              <h3 className="text-xs font-black text-blue-700 tracking-wider uppercase flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" /> 이번 달 치우 활동 요약
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50/70 p-2.5 rounded-2xl border border-blue-100 text-center">
                  <span className="text-[11px] font-bold text-blue-800 block">산책 일수</span>
                  <span className="text-lg font-black text-blue-900">{monthlyStats.walkCount}일</span>
                </div>
                <div className="bg-amber-50/70 p-2.5 rounded-2xl border border-amber-100 text-center">
                  <span className="text-[11px] font-bold text-amber-800 block">총 응가 횟수</span>
                  <span className="text-lg font-black text-amber-950">{monthlyStats.totalPoop}회</span>
                </div>
              </div>

              {/* 케어 통계 5종 */}
              <div className="grid grid-cols-5 gap-1 pt-1">
                {[
                  { label: '귀 청소', count: monthlyStats.earClean, icon: '👂' },
                  { label: '빗질', count: monthlyStats.brush, icon: '🪮' },
                  { label: '목욕', count: monthlyStats.bath, icon: '🛁' },
                  { label: '총캉총캉', count: monthlyStats.play, icon: '⚡' },
                  { label: '클린발', count: monthlyStats.pawClean, icon: '🐾' },
                ].map((item) => (
                  <div key={item.label} className="bg-stone-50 p-2 rounded-xl text-center border border-stone-100">
                    <span className="text-xs block">{item.icon}</span>
                    <span className="text-[10px] text-stone-500 font-bold block mt-0.5">{item.label}</span>
                    <span className="text-xs font-black text-amber-950 mt-0.5 block">{item.count}회</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 달력 그리드 */}
            <div className="bg-white rounded-3xl p-3.5 border border-amber-100 shadow-xs">
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                  <span
                    key={day}
                    className={`text-[11px] font-bold ${
                      idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : 'text-stone-400'
                    }`}
                  >
                    {day}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((item, idx) => {
                  if (!item) {
                    return <div key={`empty-${idx}`} className="aspect-square rounded-xl bg-transparent" />;
                  }

                  const { dayNumber, log } = item;

                  return (
                    <div
                      key={item.dateStr}
                      className="relative aspect-square rounded-xl overflow-hidden border border-stone-100 bg-stone-50/50 flex flex-col justify-between p-1"
                    >
                      {log?.photo_url && (
                        <img
                          src={log.photo_url}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}

                      {log?.photo_url && (
                        <div className="absolute inset-0 bg-black/20" />
                      )}

                      <span
                        className={`relative z-10 text-[10px] font-black leading-none ${
                          log?.photo_url ? 'text-white drop-shadow-md' : 'text-stone-600'
                        }`}
                      >
                        {dayNumber}
                      </span>

                      {log?.walked && (
                        <span className="relative z-10 self-end text-xs leading-none drop-shadow-md">
                          🐾
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </section>
        )}

      </div>
    </main>
  );
}
