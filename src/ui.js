import icons from './icons.generated.js';

export const marker = (name) => icons[name] || '';
export const escape = (value) => String(value ?? '').replace(/[&<>"']/g,(c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const cleanLabel = (value) => value.replace(/^./u,(s) => s.toUpperCase());
export const button = (action,label,pic,cls='icon-button',extra='') => `<button type="button" class="${cls}" data-do="${action}" aria-label="${escape(label)}" ${extra}>${marker(pic)}</button>`;
export const actionText = (action,label,pic='chevron-right',cls='text-button') => `<button type="button" class="${cls}" data-do="${action}">${escape(label)}${marker(pic)}</button>`;
export const sourceLink = (href,label) => `<a href="${href}">${escape(label)}</a>`;
export const blank = (message) => `<p class="empty">${escape(message)}</p>`;
