const UTM_KEY = 'habibi_utm';
const UTM_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

export function captureUtm() {
  const params = new URLSearchParams(window.location.search);
  const source   = params.get('utm_source');
  const medium   = params.get('utm_medium');
  const campaign = params.get('utm_campaign');
  const content  = params.get('utm_content');

  if (!source && !medium && !campaign && !content) return;

  localStorage.setItem(UTM_KEY, JSON.stringify({
    utm_source:   source   || null,
    utm_medium:   medium   || null,
    utm_campaign: campaign || null,
    utm_content:  content  || null,
    captured_at:  Date.now(),
  }));
}

export function getStoredUtm() {
  try {
    const raw = localStorage.getItem(UTM_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.captured_at > UTM_TTL) {
      localStorage.removeItem(UTM_KEY);
      return null;
    }
    const { utm_source, utm_medium, utm_campaign, utm_content } = data;
    return { utm_source, utm_medium, utm_campaign, utm_content };
  } catch {
    return null;
  }
}
