import { useEffect, useRef, useState } from 'react';

export const useTableConnection = (refresh, tableKey) => {
  const [offline,setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false), [returned,setReturned] = useState(false);
  const latest = useRef(refresh); latest.current = refresh;
  useEffect(() => {
    if (!tableKey) return;
    let timer, away = document.visibilityState !== 'visible';
    const welcome = () => { setReturned(true); clearTimeout(timer); timer = setTimeout(() => setReturned(false),5000); };
    const online = () => { setOffline(false); welcome(); void latest.current(); };
    const disconnected = () => setOffline(true);
    const visible = () => { if (document.visibilityState !== 'visible') away = true; else if (away) { away = false; welcome(); } };
    try { const key = `hakoware:table-visit:${tableKey}`, prior = Number(sessionStorage.getItem(key)); if (prior && Date.now()-prior > 5000) welcome(); sessionStorage.setItem(key,String(Date.now())); } catch { /* Rejoining never depends on browser storage. */ }
    window.addEventListener('online',online); window.addEventListener('offline',disconnected); document.addEventListener('visibilitychange',visible);
    return () => { clearTimeout(timer); window.removeEventListener('online',online); window.removeEventListener('offline',disconnected); document.removeEventListener('visibilitychange',visible); };
  },[tableKey]);
  return { offline,returned };
};
