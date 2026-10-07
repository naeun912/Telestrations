import { useEffect } from 'react';

/**
 * 게임 중 모바일 화면이 자동으로 꺼지지 않도록 유지한다.
 * (화면이 꺼지면 모바일 브라우저가 온라인 연결을 끊어버리기 때문)
 * 지원하지 않는 브라우저에서는 조용히 무시한다.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const l = await navigator.wakeLock.request('screen');
        if (cancelled) {
          l.release().catch(() => {});
          return;
        }
        lock = l;
      } catch {
        /* 권한 없음/배터리 절약 모드 등 - 무시 */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
