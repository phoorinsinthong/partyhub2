import { useEffect } from 'react';

export function useKeyboardResize() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const offset = window.innerHeight - vv.height;
      document.documentElement.style.setProperty('--keyboard-height', `${offset}px`);
    };

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);

    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
      document.documentElement.style.removeProperty('--keyboard-height');
    };
  }, []);
}
