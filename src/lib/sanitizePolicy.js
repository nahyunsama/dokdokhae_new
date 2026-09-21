export const ALLOWED_TAGS = [
  'p', 'br', 'span', 'div',
  'strong', 'em', 'u', 's',
  'h2', 'h3',
  'ol', 'ul', 'li',
  'blockquote',
  'a',
  'img',
];

// class는 여기에 두지 않는다. 서버(sanitize-html)는 ALLOWED_CLASS_PATTERNS로 값을 걸러서 허용하고,
// 클라이언트(DOMPurify)는 DOMPURIFY_ALLOWED_ATTRIBUTES에 class를 넣은 뒤 훅에서 값을 걸러낸다.
// (sanitize-html은 allowedAttributes에 class가 있으면 allowedClasses를 무시하고 모든 값을 통과시킨다.)
export const ALLOWED_ATTRIBUTES = {
  '*': ['style'],
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'loading'],
  li: ['data-list'],
};

// 본문에 남길 수 있는 class: 에디터가 만드는 이미지 크기·들여쓰기·정렬뿐이다.
// 임의의 class를 허용하면 앱 전역 CSS(.modal-overlay 등)나 Tailwind 유틸리티(fixed inset-0 …)로
// 화면 전체를 덮는 가짜 로그인 창 같은 UI를 만들 수 있다.
export const ALLOWED_CLASS_PATTERNS = [
  /^img-(?:sm|md|lg)$/,
  /^ql-indent-[1-8]$/,
  /^ql-align-(?:center|right|justify)$/,
];

// 에디터 화면에서만 잠깐 붙는 class. 저장할 때는 조용히 제거하고 "안전하지 않은 내용을 제거했다"는
// 안내 대상으로 치지 않는다.
const EDITOR_ONLY_CLASSES = ['is-selected'];

export function isAllowedClassName(name) {
  return ALLOWED_CLASS_PATTERNS.some((pattern) => pattern.test(name));
}

export function isEditorOnlyClassName(name) {
  return EDITOR_ONLY_CLASSES.includes(name);
}

export const DOMPURIFY_ALLOWED_ATTRIBUTES = [
  'class',
  ...ALLOWED_ATTRIBUTES['*'],
  ...ALLOWED_ATTRIBUTES.a,
  ...ALLOWED_ATTRIBUTES.img,
  ...ALLOWED_ATTRIBUTES.li,
];

const COLOR_VALUE = /^(?:#[0-9a-f]{3,8}|[a-z]+|rgba?\([0-9.,%\s]+\)|hsla?\([0-9.,%\s]+\))$/i;
const FONT_SIZE_VALUE = /^(?:\d+(?:\.\d+)?(?:px|em|rem|%)|xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)$/i;

export const ALLOWED_STYLE_RULES = {
  color: [COLOR_VALUE],
  'background-color': [COLOR_VALUE],
  'font-size': [FONT_SIZE_VALUE],
};

export function isAllowedStyleDeclaration(declaration) {
  const separator = declaration.indexOf(':');
  if (separator < 1) return false;

  const property = declaration.slice(0, separator).trim().toLowerCase();
  const value = declaration.slice(separator + 1).trim();
  const rules = ALLOWED_STYLE_RULES[property];
  return Boolean(value && rules?.some((rule) => rule.test(value)));
}
