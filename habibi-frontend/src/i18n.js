// Drop-in for the parts of react-i18next this site uses (see i18n-core.js for
// why it replaced the library). Components import { useTranslation, Trans }
// from here instead of 'react-i18next'; the call sites are unchanged.
import { Fragment, cloneElement, createElement } from 'react';
import en from './locales/en.json';
import { createT } from './i18n-core';

const t = createT(en, 'en');
const i18n = { language: 'en', t };
const value = { t, i18n };

export function useTranslation() {
  return value;
}

// <Trans i18nKey="..." values={{...}} components={{ bold: <strong /> }} />
// renders "<bold>text</bold>" in the string as the given element.
export function Trans({ i18nKey, values = {}, components = {} }) {
  const text = t(i18nKey, values);
  const parts = [];
  const re = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const el = components[m[1]];
    parts.push(el ? cloneElement(el, { key: parts.length }, m[2]) : m[2]);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return createElement(Fragment, null, ...parts);
}

export default i18n;
