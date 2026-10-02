import React, { useEffect } from 'react';

/** Shown for any path the app does not know. Hidden from search engines. */
export function NotFoundPage({ onGoHome }: { onGoHome: () => void }) {
  useEffect(() => {
    const previousTitle = document.title;
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    document.title = 'ไม่พบหน้านี้ · CXL Studio';
    return () => { robots.remove(); document.title = previousTitle; };
  }, []);

  return (
    <section className="flex flex-col items-center text-center py-20 px-4" aria-labelledby="not-found-title">
      <p className="text-sm font-bold tracking-widest text-slate-400 dark:text-slate-500">404</p>
      <h1 id="not-found-title" className="mt-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">ไม่พบหน้านี้</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว</p>
      <button type="button" className="mt-6 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white" onClick={onGoHome}>กลับหน้าแรก</button>
    </section>
  );
}
