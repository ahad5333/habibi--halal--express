import { useEffect } from 'react';

// Swaps the browser-tab icon while a page is mounted and puts the original
// back on unmount. Staff spend all shift with these open next to the customer
// site, so /staff and /kitchen each get their own icon rather than three
// identical Habibi tabs.
//
// Lives here rather than being pasted into each page: DriverView.jsx already
// had its own copy of this effect, and duplicated blocks in this codebase have
// a habit of drifting apart (see utils/orderFlow.js for the same consolidation).
export default function usePageFavicon(href) {
  useEffect(() => {
    if (!href) return undefined;
    const links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
    const originals = [];
    links.forEach(el => {
      originals.push({ el, href: el.href });
      el.href = href;
    });
    return () => {
      originals.forEach(({ el, href: original }) => { el.href = original; });
    };
  }, [href]);
}
