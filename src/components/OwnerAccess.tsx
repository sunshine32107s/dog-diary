'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useOwnerAccess() {
  const [owner, setOwner] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [revision, setRevision] = useState(0);
  const latest = useRef(0);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      latest.current += 1;
      setOwner(false);
      setChecking(true);
      setSignedIn(Boolean(session));
      setRevision(value => value + 1);
    });
    return () => { latest.current += 1; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const version = latest.current;
    // Keep network calls outside the auth callback to avoid refresh lock deadlocks.
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const result = session ? await supabase.rpc('is_diary_owner') : null;
        if (cancelled || version !== latest.current) return;
        setSignedIn(Boolean(session));
        setOwner(result?.error == null && result?.data === true);
      } catch {
        if (!cancelled && version === latest.current) setOwner(false);
      } finally {
        if (!cancelled && version === latest.current) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [revision]);
  return { owner, checking, signedIn };
}

export default function OwnerAccess({ owner, checking, signedIn }: ReturnType<typeof useOwnerAccess>) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy || sent) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(), options: { emailRedirectTo: window.location.origin },
      });
      if (!active.current) return;
      if (error) setMessage('메일을 보내지 못했어요. 잠시 후 다시 시도해주세요.');
      else { setSent(true); setMessage('메일의 로그인 링크를 평소 쓰는 브라우저에서 열어주세요. 스팸함도 확인해주세요.'); }
    } catch { if (active.current) setMessage('인터넷 연결을 확인하고 다시 시도해주세요.'); }
    finally { if (active.current) setBusy(false); }
  }
  async function signOut() {
    if (!window.confirm('이 브라우저에서 로그아웃할까요? 다음 수정 때 이메일 인증이 필요해요.')) return;
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) alert('로그아웃하지 못했어요. 다시 시도해주세요.');
  }
  return <>
    <div className="flex justify-end items-center gap-2 text-[11px] text-stone-500 mb-2">
      {checking ? <span>로그인 확인 중…</span> : signedIn ? <>
        <span>{owner ? '소유자 로그인 유지 중' : '이 계정에는 수정 권한이 없어요'}</span>
        <button type="button" onClick={signOut} className="underline">로그아웃</button>
      </> : <button type="button" onClick={() => { setMessage(''); setSent(false); setOpen(true); }} className="rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-amber-900">소유자 로그인</button>}
    </div>
    {open && <dialog ref={dialog} onClose={() => setOpen(false)} className="m-auto w-[90vw] max-w-sm rounded-3xl p-6 bg-white text-amber-950 backdrop:bg-black/40">
      <form onSubmit={send} className="space-y-4">
        <h2 className="font-black">소유자 로그인</h2>
        <p className="text-sm text-stone-600">등록한 이메일로 인증하면 기록을 수정할 수 있어요. 같은 브라우저에서는 로그인 상태가 유지돼요.</p>
        <label className="block text-sm">이메일<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={busy || sent} className="mt-2 border rounded-xl w-full p-3" /></label>
        {message && <p role="status" className="text-sm text-stone-600">{message}</p>}
        <button disabled={busy || sent} className="w-full bg-amber-600 text-white rounded-xl p-3 disabled:opacity-50">{busy ? '메일 보내는 중…' : sent ? '로그인 메일을 보냈어요' : '이메일로 로그인 링크 받기'}</button>
        <button type="button" onClick={() => dialog.current?.close()} className="w-full text-sm p-2">닫기</button>
      </form>
    </dialog>}
  </>;
}
