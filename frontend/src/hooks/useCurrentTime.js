import { useCallback, useEffect, useState } from 'react';

export const useCurrentTime = () => {
  const [now, setNow] = useState(() => new Date());

  const syncNow = useCallback(() => {
    setNow(new Date());
  }, []);

  useEffect(() => {
    syncNow();

    const intervalId = window.setInterval(syncNow, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncNow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncNow]);

  return now;
};
