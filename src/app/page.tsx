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
  X,
  Trash2,
  Pencil,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  BarChart3,
  Check,
  PenLine,
  LayoutGrid,
  List,
  Pill,
  Stethoscope,
  AlertTriangle,
  Scale,
  Trophy
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
  heartworm?: boolean;
  hospital?: boolean;
  condition_bad?: boolean;
  weight?: number | null;
  created_at: string;
}

export default function Home() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  // 탭 상태: write(오늘 쓰기) / feed(모아보기) / calendar(달력·통계)
  const [activeTab, setActiveTab] = useState<'write' | 'feed' | 'calendar'>('write');

  // 모아보기 뷰 스타일: card(카드형) / grid(3열 사진 갤러리)
  const [feedViewMode, setFeedViewMode] = useState<'card' | 'grid'>('card');
  const [selectedPhotoLog, setSelectedPhotoLog] = useState<DailyLog | null>(null);

  // 수정(Edit) 모드
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);

  // 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; photo_url: string | null; date: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 모아보기 및 달력 기준 연/월
  const [filterMonthDate, setFilterMonthDate] = useState(new Date());
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [feedFilterTag, setFeedFilterTag] = useState<'all' | 'walk' | 'photo' | 'health'>('all');

  // 입력 폼 상태
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [walked, setWalked] = useState(false);
  const [poopCount, setPoopCount] = useState(1);
  const [memo, setMemo] = useState('');
  
  // 케어 5종
  const [bath, setBath] = useState(false);
  const [earClean, setEarClean] = useState(false);
  const [play, setPlay] = useState(false);
  const [pawClean, setPawClean] = useState(false);
  const [brush, setBrush] = useState(false);

  // 신규: 건강 3종 + 몸무게
  const [heartworm, setHeartworm] = useState(false);
  const [hospital, setHospital] = useState(false);
  const [conditionBad, setConditionBad] = useState(false);
  const [weight, setWeight] = useState<string>('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. 데이터 불러오기
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

  // 2. 심장사상충 D-Day 계산
  const heartwormDDay = useMemo(() => {
    const heartwormLogs = logs.filter((l) => l.heartworm);
    if (heartwormLogs.length === 0) return null;

    // 가장 최근 투약일
    const lastDate = new Date(heartwormLogs[0].date);
    // 다음 예정일 (+30일)
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 30);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    nextDate.setHours(0, 0, 0, 0);

    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      diffDays,
      lastDate: heartwormLogs[0].date,
    };
  }, [logs]);

  // 3. 수정 모드 세팅
  const handleStartEdit = (log: DailyLog) => {
    setEditingLogId(log.id);
    setDate(log.date);
    setWalked(log.walked);
    setPoopCount(log.poop_count);
    setMemo(log.memo || '');
    setBath(log.bath);
    setEarClean(log.ear_clean);
    setPlay(log.play);
    setPawClean(log.paw_clean);
    setBrush(log.brush);
    setHeartworm(Boolean(log.heartworm));
    setHospital(Boolean(log.hospital));
    setConditionBad(Boolean(log.condition_bad));
    setWeight(log.weight ? String(log.weight) : '');
    setExistingPhotoUrl(log.photo_url);
    setSelectedFile(null);
    setPreviewUrl(null);
    setActiveTab('write');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingLogId(null);
    setExistingPhotoUrl(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setDate(new Date().toISOString().split('T')[0]);
    setWalked(false);
    setPoopCount(1);
    setMemo('');
    setBath(false);
    setEarClean(false);
    setPlay(false);
    setPawClean(false);
    setBrush(false);
    setHeartworm(false);
    setHospital(false);
    setConditionBad(false);
    setWeight('');
  };

  // 4. 삭제 확정
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase.from('daily_logs').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      if (deleteTarget.photo_url) {
        const pathParts = deleteTarget.photo_url.split('/');
        const fileName = pathParts[pathParts.length - 1];
        await supabase.storage.from('dog-photos').remove([fileName]);
      }

      setLogs((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      if (editingLogId === deleteTarget.id) handleCancelEdit();
    } catch (err: any) {
      alert(`삭제 중 오류: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // 5. 사진 업로드 및 폼 제출
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setExistingPhotoUrl(null);
    }
  };

  const removePhoto = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setExistingPhotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      let photoUrl: string | null = existingPhotoUrl;

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

      const payload = {
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
        heartworm,
        hospital,
        condition_bad: conditionBad,
        weight: weight ? parseFloat(weight) : null,
      };

      if (editingLogId) {
        const { error: updateError } = await supabase
          .from('daily_logs')
          .update(payload)
          .eq('id', editingLogId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('daily_logs')
          .upsert(payload, { onConflict: 'date' });

        if (insertError) throw insertError;
      }

      handleCancelEdit();
      await fetchLogs();
      setActiveTab('feed');
    } catch (err: any) {
      alert(`저장 중 오류: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`;
  };

  // 모아보기 필터
  const filteredLogs = useMemo(() => {
    let result = logs;

    if (!showAllMonths) {
      const year = filterMonthDate.getFullYear();
      const month = filterMonthDate.getMonth() + 1;
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      result = result.filter((log) => log.date.startsWith(prefix));
    }

    if (feedFilterTag === 'walk') {
      result = result.filter((log) => log.walked);
    } else if (feedFilterTag === 'photo') {
      result = result.filter((log) => Boolean(log.photo_url));
    } else if (feedFilterTag === 'health') {
      result = result.filter((log) => log.heartworm || log.hospital || log.condition_bad);
    }

    return result;
  }, [logs, filterMonthDate, showAllMonths, feedFilterTag]);

  // 사진만 모은 목록 (갤러리용)
  const photoOnlyLogs = useMemo(() => {
    return filteredLogs.filter((log) => Boolean(log.photo_url));
  }, [filteredLogs]);

  // 월간 통계 및 최근 몸무게
  const monthlyStats = useMemo(() => {
    const year = filterMonthDate.getFullYear();
    const month = filterMonthDate.getMonth() + 1;
    const prefix = `${year}-${String(month).padStart(2, '0')}`;

    const currentLogs = logs.filter((log) => log.date.startsWith(prefix));
    const logsWithWeight = currentLogs.filter((l) => l.weight && l.weight > 0);
    const latestWeight = logsWithWeight.length > 0 ? logsWithWeight[0].weight : null;

    return {
      totalDays: currentLogs.length,
      walkCount: currentLogs.filter((l) => l.walked).length,
      totalPoop: currentLogs.reduce((acc, cur) => acc + (cur.poop_count || 0), 0),
      bath: currentLogs.filter((l) => l.bath).length,
      earClean: currentLogs.filter((l) => l.ear_clean).length,
      play: currentLogs.filter((l) => l.play).length,
      pawClean: currentLogs.filter((l) => l.paw_clean).length,
      brush: currentLogs.filter((l) => l.brush).length,
      heartworm: currentLogs.filter((l) => l.heartworm).length,
      hospital: currentLogs.filter((l) => l.hospital).length,
      latestWeight,
    };
  }, [logs, filterMonthDate]);

  // 달력 계산
  const calendarDays = useMemo(() => {
    const year = filterMonthDate.getFullYear();
    const month = filterMonthDate.getMonth();
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
  }, [filterMonthDate, logs]);

  return (
    <main className="min-h-screen bg-[#FCFAF6] text-[#3B342B] pb-24 px-4 font-gowun">
      <style jsx global>{`
        @font-face {
          font-family: 'ChiuFont';
          src: url('/font.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        .font-gowun {
          font-family: 'ChiuFont', -apple-system, BlinkMacSystemFont, sans-serif;
        }
      `}</style>

      <div className="max-w-md mx-auto pt-5">
        
        {/* 상단 헤더 & 사상충 D-Day 뱃지 */}
        <header className="mb-4 px-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1 text-blue-600 mb-0.5">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-black tracking-widest uppercase">Chiu's Daily Diary</span>
              </div>
              <h1 className="text-2xl font-black text-amber-950 tracking-tight flex items-center gap-1.5">
                치우의 하루하루 🐾
              </h1>
            </div>

            {/* 심장사상충 스마트 D-Day 뱃지 */}
            {heartwormDDay && (
              <div 
                className={`px-3 py-1.5 rounded-2xl border text-right transition-all ${
                  heartwormDDay.diffDays <= 0
                    ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
                    : heartwormDDay.diffDays <= 3
                    ? 'bg-amber-100 border-amber-300 text-amber-900 font-black'
                    : 'bg-blue-50 border-blue-100 text-blue-800'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px] font-bold justify-end">
                  <Pill className="w-3 h-3" /> 사상충
                </div>
                <span className="text-xs font-black block">
                  {heartwormDDay.diffDays === 0
                    ? '오늘 복용! 💊'
                    : heartwormDDay.diffDays < 0
                    ? `D+${Math.abs(heartwormDDay.diffDays)} 경과`
                    : `D-${heartwormDDay.diffDays}`}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* 3개 탭 네비게이션 */}
        <nav className="grid grid-cols-3 bg-amber-100/70 p-1 rounded-2xl mb-5 gap-1">
          <button
            onClick={() => setActiveTab('write')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'write'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-amber-900/70 hover:text-amber-950'
            }`}
          >
            <PenLine className="w-3.5 h-3.5" /> 
            {editingLogId ? '수정 중 ✏️' : '오늘 기록'}
          </button>
          
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'feed'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-amber-900/70 hover:text-amber-950'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> 모아보기
          </button>
          
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'calendar'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-amber-900/70 hover:text-amber-950'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> 달력·통계
          </button>
        </nav>

        {/* ========================================================= */}
        {/* 탭 1: 오늘 기록 및 수정 */}
        {/* ========================================================= */}
        {activeTab === 'write' && (
          <section className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-xs">
            {editingLogId && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 text-blue-900 px-3.5 py-2 rounded-2xl text-xs font-bold mb-4">
                <span>✏️ {formatDate(date)} 기록을 수정하는 중</span>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-blue-600 underline text-[11px]"
                >
                  취소
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 날짜 & 몸무게 입력 */}
              <div className="flex items-center justify-between pb-3 border-b border-amber-50">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4 text-blue-600" /> 날짜
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="text-xs font-bold bg-amber-50/80 text-amber-950 px-3 py-1.5 rounded-xl border border-amber-200 outline-none w-32 text-center"
                />
              </div>

              {/* 산책 여부 & 황금 응가 */}
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

              {/* 치우는 오늘: 케어 5종 */}
              <div className="bg-amber-50/40 p-3.5 rounded-2xl border border-amber-100/80 space-y-2">
                <span className="text-xs font-bold text-amber-900 block">✨ 치우는 오늘</span>
                
                {/* 1행: 귀 청소, 빗질, 목욕 */}
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

                {/* 2행: 총캉총캉, 클린발바닥 */}
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

              {/* 건강 & 특별 케어 (사상충, 병원, 컨디션, 몸무게) */}
              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 flex items-center gap-1">
                    <Stethoscope className="w-3.5 h-3.5 text-blue-600" /> 건강 & 체크
                  </span>
                  
                  {/* 선택형 몸무게 입력 */}
                  <div className="flex items-center gap-1 text-xs">
                    <Scale className="w-3.5 h-3.5 text-stone-400" />
                    <input
                      type="number"
                      step="0.05"
                      placeholder="몸무게"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="w-16 px-2 py-0.5 text-xs text-right bg-white border border-stone-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                    />
                    <span className="text-stone-500 text-[11px]">kg</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHeartworm(!heartworm)}
                    className={`py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                      heartworm 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'bg-white border border-stone-200 text-stone-600'
                    }`}
                  >
                    {heartworm && <Check className="w-3 h-3 stroke-[3]" />}
                    💊 사상충
                  </button>

                  <button
                    type="button"
                    onClick={() => setHospital(!hospital)}
                    className={`py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                      hospital 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'bg-white border border-stone-200 text-stone-600'
                    }`}
                  >
                    {hospital && <Check className="w-3 h-3 stroke-[3]" />}
                    🏥 병원
                  </button>

                  <button
                    type="button"
                    onClick={() => setConditionBad(!conditionBad)}
                    className={`py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                      conditionBad 
                        ? 'bg-rose-500 text-white shadow-xs' 
                        : 'bg-white border border-stone-200 text-stone-600'
                    }`}
                  >
                    {conditionBad && <Check className="w-3 h-3 stroke-[3]" />}
                    🚨 컨디션↓
                  </button>
                </div>
              </div>

              {/* 사진 첨부 */}
              <div className="space-y-1.5">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  className="hidden"
                />
                
                {previewUrl || existingPhotoUrl ? (
                  <div className="relative rounded-2xl overflow-hidden aspect-square bg-stone-100 border border-amber-200">
                    <img 
                      src={previewUrl || existingPhotoUrl || ''} 
                      alt="미리보기" 
                      className="w-full h-full object-cover" 
                    />
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

              {/* 메모 */}
              <div>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="치우에게 오늘 있었던 특별한 일이나 컨디션 :)"
                  rows={2}
                  className="w-full p-3 text-xs bg-amber-50/30 border border-amber-200 rounded-2xl outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-stone-400 resize-none"
                />
              </div>

              {/* 저장 버튼 */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs disabled:opacity-50"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 저장하는 중...</>
                ) : editingLogId ? (
                  '치우의 하루 수정 완료 🐾'
                ) : (
                  '치우의 하루 저장하기 🐾'
                )}
              </button>
            </form>
          </section>
        )}

        {/* ========================================================= */}
        {/* 탭 2: 기록 모아보기 (카드 리스트 vs 3열 갤러리 뷰) */}
        {/* ========================================================= */}
        {activeTab === 'feed' && (
          <section className="space-y-4">
            
            {/* 네비게이션 & 뷰 모드 토글 */}
            <div className="bg-white rounded-3xl p-3.5 border border-amber-100 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <button
                  disabled={showAllMonths}
                  onClick={() => setFilterMonthDate(new Date(filterMonthDate.getFullYear(), filterMonthDate.getMonth() - 1, 1))}
                  className="p-1.5 rounded-xl hover:bg-amber-50 text-amber-900 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="text-sm font-black text-amber-950">
                  {showAllMonths 
                    ? '전체 기간' 
                    : `${filterMonthDate.getFullYear()}년 ${filterMonthDate.getMonth() + 1}월`}
                </span>

                <button
                  disabled={showAllMonths}
                  onClick={() => setFilterMonthDate(new Date(filterMonthDate.getFullYear(), filterMonthDate.getMonth() + 1, 1))}
                  className="p-1.5 rounded-xl hover:bg-amber-50 text-amber-900 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* 필터 칩 & 뷰 전환 아이콘 */}
              <div className="flex items-center justify-between pt-2 border-t border-amber-50">
                <div className="flex gap-1 overflow-x-auto py-0.5 no-scrollbar">
                  <button
                    onClick={() => setFeedFilterTag('all')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 ${
                      feedFilterTag === 'all' ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setFeedFilterTag('walk')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 ${
                      feedFilterTag === 'walk' ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    🐾 산책
                  </button>
                  <button
                    onClick={() => setFeedFilterTag('health')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 ${
                      feedFilterTag === 'health' ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    🏥 건강
                  </button>
                </div>

                {/* 뷰 전환: 카드형 vs 3열 갤러리 */}
                <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-xl ml-2">
                  <button
                    onClick={() => setFeedViewMode('card')}
                    className={`p-1 rounded-lg transition-all ${
                      feedViewMode === 'card' ? 'bg-white text-blue-700 shadow-xs' : 'text-stone-400'
                    }`}
                    title="카드 뷰"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setFeedViewMode('grid')}
                    className={`p-1 rounded-lg transition-all ${
                      feedViewMode === 'grid' ? 'bg-white text-blue-700 shadow-xs' : 'text-stone-400'
                    }`}
                    title="3열 사진 갤러리"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-16 text-amber-800/60">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-xs font-semibold">치우의 추억을 불러오고 있어요...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-amber-100 shadow-xs">
                <p className="text-3xl mb-2">🐶</p>
                <p className="text-sm font-bold text-amber-950">해당 조건의 기록이 없어요</p>
              </div>
            ) : feedViewMode === 'grid' ? (
              /* [3열 사진 갤러리 뷰] */
              <div className="grid grid-cols-3 gap-1.5">
                {photoOnlyLogs.length === 0 ? (
                  <div className="col-span-3 bg-white rounded-3xl p-8 text-center border border-amber-100">
                    <p className="text-xs text-stone-400">등록된 사진이 없어요 📸</p>
                  </div>
                ) : (
                  photoOnlyLogs.map((log) => (
                    <div
                      key={log.id}
                      onClick={() => setSelectedPhotoLog(log)}
                      className="relative aspect-square rounded-2xl overflow-hidden bg-stone-100 border border-amber-100 active:scale-95 transition-all cursor-pointer group"
                    >
                      <img
                        src={log.photo_url!}
                        alt={log.date}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {log.walked && (
                        <span className="absolute bottom-1 right-1 text-xs drop-shadow">🐾</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* [기본 카드형 뷰] */
              filteredLogs.map((log) => (
                <article
                  key={log.id}
                  className="bg-white rounded-3xl p-4 border border-amber-100 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-amber-950">
                        {formatDate(log.date)}
                      </span>
                      {log.weight && (
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                          {log.weight}kg
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(log)}
                        className="p-1.5 text-stone-400 hover:text-blue-600 rounded-lg"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: log.id, photo_url: log.photo_url, date: log.date })}
                        className="p-1.5 text-stone-400 hover:text-rose-500 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

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

                  {/* 뱃지 영역 */}
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

                    {/* 건강 특이사항 뱃지 */}
                    {log.heartworm && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold">
                        💊 사상충
                      </span>
                    )}
                    {log.hospital && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                        🏥 병원
                      </span>
                    )}
                    {log.condition_bad && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-rose-500 text-white text-[11px] font-bold">
                        🚨 컨디션↓
                      </span>
                    )}
                  </div>

                  {/* 케어 체크 뱃지 */}
                  {(log.bath || log.ear_clean || log.play || log.paw_clean || log.brush) && (
                    <div className="flex flex-wrap gap-1 pt-0.5 border-t border-amber-50">
                      {log.ear_clean && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/60">👂 귀 청소</span>}
                      {log.brush && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/60">🪮 빗질</span>}
                      {log.bath && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/60">🛁 목욕</span>}
                      {log.play && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/60">⚡ 총캉총캉</span>}
                      {log.paw_clean && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/60">🐾 클린발바닥</span>}
                    </div>
                  )}

                  {log.memo && (
                    <p className="text-xs text-amber-950 bg-amber-50/60 p-3 rounded-2xl leading-relaxed whitespace-pre-wrap">
                      {log.memo}
                    </p>
                  )}
                </article>
              ))
            )}
          </section>
        )}

        {/* ========================================================= */}
        {/* 탭 3: 달력 & 통계 & 월간 결산 리포트 카드 */}
        {/* ========================================================= */}
        {activeTab === 'calendar' && (
          <section className="space-y-4">
            
            {/* 월 네비게이션 */}
            <div className="bg-white rounded-3xl p-4 border border-amber-100 shadow-xs flex items-center justify-between">
              <button
                onClick={() => setFilterMonthDate(new Date(filterMonthDate.getFullYear(), filterMonthDate.getMonth() - 1, 1))}
                className="p-1.5 rounded-xl hover:bg-amber-50 text-amber-900"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-base font-black text-amber-950">
                {filterMonthDate.getFullYear()}년 {filterMonthDate.getMonth() + 1}월
              </h2>
              <button
                onClick={() => setFilterMonthDate(new Date(filterMonthDate.getFullYear(), filterMonthDate.getMonth() + 1, 1))}
                className="p-1.5 rounded-xl hover:bg-amber-50 text-amber-900"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* 통계 요약 카드 */}
            <div className="bg-white rounded-3xl p-4 border border-amber-100 shadow-xs space-y-3">
              <h3 className="text-xs font-black text-blue-700 tracking-wider uppercase flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" /> 이달의 수치 요약
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
                  if (!item) return <div key={`empty-${idx}`} className="aspect-square rounded-xl bg-transparent" />;

                  const { dayNumber, log } = item;

                  return (
                    <div
                      key={item.dateStr}
                      className="relative aspect-square rounded-xl overflow-hidden border border-stone-100 bg-stone-50/50 flex flex-col justify-between p-1"
                    >
                      {log?.photo_url && (
                        <img src={log.photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      )}
                      {log?.photo_url && <div className="absolute inset-0 bg-black/20" />}

                      <span className={`relative z-10 text-[10px] font-black leading-none ${log?.photo_url ? 'text-white drop-shadow-md' : 'text-stone-600'}`}>
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

            {/* 신규: 🌾 이달의 치우 결산 리포트 카드 (인스타/소장 감성) */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-5 text-white shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-white/20 pb-3">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-5 h-5 text-amber-200" />
                  <span className="font-black text-sm tracking-tight">치우의 {filterMonthDate.getMonth() + 1}월 결산 리포트</span>
                </div>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Verified Chiu</span>
              </div>

              <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-amber-100">함께 걸은 산책길</span>
                  <span className="font-black text-sm text-white">{monthlyStats.walkCount}일 완주 🐾</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-amber-100">황금빛 응가 배출</span>
                  <span className="font-black text-sm text-white">{monthlyStats.totalPoop}회 달성 💩</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-amber-100">신나는 총캉총캉</span>
                  <span className="font-black text-sm text-white">{monthlyStats.play}회 발산 ⚡</span>
                </div>
                {monthlyStats.latestWeight && (
                  <div className="flex justify-between items-center pt-1 border-t border-white/15">
                    <span className="text-amber-100">최근 측정한 몸무게</span>
                    <span className="font-black text-sm text-white">{monthlyStats.latestWeight} kg</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-amber-100 text-center font-bold">
                "이번 달도 치우와 함께 씩씩하고 행복하게 보냈어요! 🐕💛"
              </p>
            </div>

          </section>
        )}

      </div>

      {/* 갤러리 뷰 사진 클릭 시 상세 팝업 모달 */}
      {selectedPhotoLog && (
        <div 
          onClick={() => setSelectedPhotoLog(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl overflow-hidden max-w-xs w-full shadow-2xl space-y-3 pb-4"
          >
            <div className="relative aspect-square w-full bg-stone-100">
              <img src={selectedPhotoLog.photo_url!} alt="" className="w-full h-full object-cover" />
              <button 
                onClick={() => setSelectedPhotoLog(null)}
                className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="px-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-amber-950">{formatDate(selectedPhotoLog.date)}</span>
                {selectedPhotoLog.walked && <span className="text-xs font-bold text-blue-600">🐾 산책함</span>}
              </div>
              {selectedPhotoLog.memo && (
                <p className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl whitespace-pre-wrap">
                  {selectedPhotoLog.memo}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 안전한 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center shadow-xl border border-amber-100 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-amber-950">정말 삭제할까요?</h3>
              <p className="text-xs text-stone-500 mt-1">
                <span className="font-bold text-amber-900">{formatDate(deleteTarget.date)}</span>의 기록과 사진이 영구히 지워져요 😢
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="py-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-bold"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="py-2.5 rounded-xl bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
