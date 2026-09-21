import assert from 'node:assert/strict';
import test from 'node:test';

import {
  sanitizeHtml,
  sanitizeHtmlForStorage,
} from '../src/lib/sanitize.server.js';

function assertNoExecutableMarkup(html) {
  assert.doesNotMatch(html, /<(?:script|iframe|object|embed|svg|math|form|input|button|style)\b/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /\s(?:href|src)\s*=\s*["']?\s*(?:javascript|vbscript):/i);
}

test('removes script elements and event handler attributes', () => {
  const input = [
    '<p onclick="alert(1)">safe text</p>',
    '<script>alert(2)</script>',
    '<img src="https://example.com/cover.jpg" onerror="alert(3)">',
  ].join('');

  const result = sanitizeHtmlForStorage(input);

  assertNoExecutableMarkup(result.html);
  assert.match(result.html, /safe text/);
  assert.match(result.html, /src="https:\/\/example\.com\/cover\.jpg"/);
  assert.match(result.html, /loading="lazy"/);
  assert.equal(result.removedUnsafeContent, true);
});

test('removes executable URL schemes from links and images', () => {
  const input = [
    '<a href="javascript:alert(1)">bad link</a>',
    '<a href="vbscript:alert(2)">bad legacy link</a>',
    '<img src="javascript:alert(3)" alt="bad image">',
  ].join('');

  const result = sanitizeHtmlForStorage(input);

  assertNoExecutableMarkup(result.html);
  assert.match(result.html, /bad link/);
  assert.match(result.html, /bad legacy link/);
  assert.equal(result.removedUnsafeContent, true);
});

test('removes active SVG, MathML, iframe, object, form, and style markup', () => {
  const input = [
    '<svg><a onload="alert(1)"><circle></circle></a></svg>',
    '<math><mtext><img src=x onerror="alert(2)"></mtext></math>',
    '<iframe srcdoc="<script>alert(3)</script>"></iframe>',
    '<object data="javascript:alert(4)"></object>',
    '<form action="javascript:alert(5)"><input autofocus onfocus="alert(6)"></form>',
    '<style>@import "javascript:alert(7)";</style>',
    '<p>remaining text</p>',
  ].join('');

  const result = sanitizeHtmlForStorage(input);

  assertNoExecutableMarkup(result.html);
  assert.match(result.html, /remaining text/);
  assert.equal(result.removedUnsafeContent, true);
});

test('keeps only the inline style properties supported by the editor', () => {
  const input = '<p style="color: rgb(10, 20, 30); background-color: #fff; font-size: 18px; position: fixed; background-image: url(javascript:alert(1)); z-index: 9999">styled</p>';

  const result = sanitizeHtmlForStorage(input);

  assert.match(result.html, /color:\s*rgb\(10, 20, 30\)/);
  assert.match(result.html, /background-color:\s*#fff/);
  assert.match(result.html, /font-size:\s*18px/);
  assert.doesNotMatch(result.html, /position|background-image|z-index|javascript:/i);
  assert.equal(result.removedUnsafeContent, true);
});

test('rejects unsafe values even on allowed style properties', () => {
  const input = '<p style="color: expression(alert(1)); background-color: url(javascript:alert(2)); font-size: calc(100vh * 100)">styled</p>';
  const result = sanitizeHtmlForStorage(input);

  assert.equal(result.html, '<p>styled</p>');
  assert.doesNotMatch(result.html, /expression|url\s*\(|javascript:|calc\s*\(/i);
  assert.equal(result.removedUnsafeContent, true);
});

test('preserves representative Quill semantic HTML', () => {
  const input = [
    '<h2>큰 제목</h2><h3>작은 제목</h3>',
    '<p><strong>굵게</strong> <em>기울임</em> <u>밑줄</u> <s>취소선</s></p>',
    '<p><span style="color: rgb(230, 0, 0); font-size: 18px">색상과 크기</span></p>',
    '<ol><li>첫 번째</li></ol>',
    '<ul><li>글머리표</li></ul>',
    '<blockquote>인용문</blockquote>',
    '<p><a href="https://example.com/books?id=1" target="_self">책 링크</a></p>',
    '<p><img src="https://firebasestorage.googleapis.com/v0/b/example/o/cover.jpg?alt=media" alt="표지" class="img-md"></p>',
  ].join('');

  const result = sanitizeHtmlForStorage(input);

  assert.match(result.html, /<h2>큰 제목<\/h2>/);
  assert.match(result.html, /<h3>작은 제목<\/h3>/);
  assert.match(result.html, /<strong>굵게<\/strong>/);
  assert.match(result.html, /<em>기울임<\/em>/);
  assert.match(result.html, /<u>밑줄<\/u>/);
  assert.match(result.html, /<s>취소선<\/s>/);
  assert.match(result.html, /style="color:\s*rgb\(230, 0, 0\);\s*font-size:\s*18px"/);
  assert.match(result.html, /<ol><li>첫 번째<\/li><\/ol>/);
  assert.match(result.html, /<ul><li>글머리표<\/li><\/ul>/);
  assert.match(result.html, /<blockquote>인용문<\/blockquote>/);
  assert.match(result.html, /href="https:\/\/example\.com\/books\?id=1"/);
  assert.match(result.html, /target="_blank"/);
  assert.match(result.html, /rel="noopener noreferrer"/);
  assert.match(result.html, /class="img-md"/);
  assert.match(result.html, /loading="lazy"/);
  assert.equal(result.removedUnsafeContent, false);
});

test('does not report changes for safe basic Quill HTML', () => {
  const input = '<h2>제목</h2><p><strong>안전한 본문</strong><br></p><blockquote>인용</blockquote>';
  const result = sanitizeHtmlForStorage(input);

  assert.match(result.html, /<h2>제목<\/h2>/);
  assert.match(result.html, /<p><strong>안전한 본문<\/strong><br\s*\/><\/p>/);
  assert.match(result.html, /<blockquote>인용<\/blockquote>/);
  assert.equal(result.removedUnsafeContent, false);
});

test('sanitization is idempotent', () => {
  const input = '<p onclick="alert(1)"><a href="javascript:alert(2)">본문</a><img src="https://example.com/a.jpg" onload="alert(3)"></p>';
  const once = sanitizeHtml(input);
  const twice = sanitizeHtml(once);

  assert.equal(twice, once);
  assertNoExecutableMarkup(twice);
});

test('removes encoded and whitespace-obfuscated executable URLs', () => {
  const input = [
    '<a href="jav&#x61;script:alert(1)">encoded link</a>',
    '<a href="java\nscript:alert(2)">whitespace link</a>',
    '<img src="&#x6a;avascript:alert(3)" alt="encoded image">',
  ].join('');
  const result = sanitizeHtmlForStorage(input);

  assertNoExecutableMarkup(result.html);
  assert.match(result.html, /encoded link/);
  assert.match(result.html, /whitespace link/);
  assert.equal(result.removedUnsafeContent, true);
});

test('strips arbitrary class names that could overlay the page', () => {
  const input = [
    '<div class="fixed inset-0 z-50 bg-white">FAKE LOGIN</div>',
    '<div class="modal-overlay">overlay</div>',
    '<p class="nav-mobile-overlay img-md">mixed</p>',
  ].join('');

  const result = sanitizeHtmlForStorage(input);

  assert.doesNotMatch(result.html, /fixed|inset-0|z-50|modal-overlay|nav-mobile-overlay/);
  assert.match(result.html, /FAKE LOGIN/);
  assert.match(result.html, /<p class="img-md">mixed<\/p>/);
  assert.equal(result.removedUnsafeContent, true);
});

test('keeps the class names produced by the editor', () => {
  const input = [
    '<p class="ql-align-center">가운데</p>',
    '<ul><li class="ql-indent-1">들여쓰기</li></ul>',
    '<p><img src="https://example.com/a.jpg" alt="" class="img-lg"></p>',
  ].join('');

  const result = sanitizeHtmlForStorage(input);

  assert.match(result.html, /class="ql-align-center"/);
  assert.match(result.html, /<li class="ql-indent-1">/);
  assert.match(result.html, /class="img-lg"/);
  assert.equal(result.removedUnsafeContent, false);
});

test('silently drops the editor-only is-selected class', () => {
  const input = '<p><img src="https://example.com/a.jpg" alt="" class="img-md is-selected"></p>';
  const result = sanitizeHtmlForStorage(input);

  assert.match(result.html, /class="img-md"/);
  assert.doesNotMatch(result.html, /is-selected/);
  assert.equal(result.removedUnsafeContent, false);
});
