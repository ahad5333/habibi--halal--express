import { useEffect } from 'react';

const SEO = ({ title, description, keywords, image, url, type = 'website', schema }) => {
  useEffect(() => {
    // 1. Title
    const defaultTitle = 'Habibi Halal Express | Authentic Halal Dining';
    document.title = title ? `${title} | Habibi Halal Express` : defaultTitle;

    // Helper to get or create meta tag
    const setMetaTag = (attrName, attrValue, content) => {
      if (!content) return;
      let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attrName, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 2. Meta description & keywords
    setMetaTag('name', 'description', description || 'Authentic Halal Dining. Every dish crafted with tradition, precision, and passion.');
    if (keywords) {
      setMetaTag('name', 'keywords', keywords);
    }

    // 3. Open Graph (OG) tags
    const siteUrl = window.location.origin;
    const ogTitle = title ? `${title} | Habibi Halal Express` : 'Habibi Halal Express';
    setMetaTag('property', 'og:title', ogTitle);
    setMetaTag('property', 'og:description', description || 'Authentic Halal Dining. Every dish crafted with tradition, precision, and passion.');
    setMetaTag('property', 'og:image', image ? (image.startsWith('http') ? image : siteUrl + image) : siteUrl + '/images/logos/logo.png');
    setMetaTag('property', 'og:url', url ? (url.startsWith('http') ? url : siteUrl + url) : window.location.href);
    setMetaTag('property', 'og:type', type);

    // 4. Twitter Card tags
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', ogTitle);
    setMetaTag('name', 'twitter:description', description || 'Authentic Halal Dining. Every dish crafted with tradition, precision, and passion.');
    setMetaTag('name', 'twitter:image', image ? (image.startsWith('http') ? image : siteUrl + image) : siteUrl + '/images/logos/logo.png');

    // 5. Canonical URL
    const canonicalHref = url
      ? (url.startsWith('http') ? url : window.location.origin + url)
      : window.location.href.split('?')[0].split('#')[0];
    let canonEl = document.querySelector('link[rel="canonical"]');
    if (!canonEl) {
      canonEl = document.createElement('link');
      canonEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonEl);
    }
    canonEl.setAttribute('href', canonicalHref);

    // 6. Ingest JSON-LD Schema
    let scriptTag = document.getElementById('json-ld-schema');
    if (schema) {
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.id = 'json-ld-schema';
        scriptTag.type = 'application/ld+json';
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(schema);
    } else {
      if (scriptTag) {
        scriptTag.remove();
      }
    }
  }, [title, description, keywords, image, url, type, schema]);

  return null;
};

export default SEO;
