#!/usr/bin/env node
/*
أداة صورة المنشور لمقالات موقع مكتب تيسير صافي لتدقيق الحسابات.

الاستخدام من جذر المستودع:
    node tools/social-image/make_social_image.js "عنوان المقال" images/social/slug.jpg [--kicker "سطر صغير"]

تنتج صورة مربعة 1080×1080 بصيغة JPEG بهوية المكتب (فحمي وذهبي، خط IBM Plex Sans Arabic)
وتتحقق بعد الإنتاج من الصيغة والأبعاد والحجم. الخطوط مرفقة في مجلد fonts بجوار الملف.
المتطلبات: Node مع حزمة playwright ومتصفح Chromium الخاص بها، وهما مثبتان في بيئة
الجلسات السحابية لكلود كود بلا أي تثبيت إضافي.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const FONTS = path.join(HERE, 'fonts');

const BRAND = 'مكتب تيسير صافي لتدقيق الحسابات';
const SITE = 'tsaudit.com';
const DEFAULT_KICKER = 'مقال جديد على موقع المكتب';

const CHARCOAL = '#2B2B2B';
const GOLD = '#B8954A';
const MAX_BYTES = 1000000;
const SIZE = 1080;

function fail(msg) {
  process.stderr.write(msg + '\n');
  process.exit(1);
}

function fontUri(name) {
  const p = path.join(FONTS, name);
  if (!fs.statSync(p, { throwIfNoEntry: false })) fail('الخط غير موجود: ' + p);
  return pathToFileURL(p).href;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHtml(title, kicker) {
  const n = [...title].length; // عدّ الأحرف لا البايتات
  const size = n <= 45 ? 72 : n <= 70 ? 62 : n <= 95 ? 54 : 46;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<style>
@font-face { font-family: "PlexAr"; src: url("${fontUri('IBMPlexSansArabic-Bold.ttf')}"); font-weight: 700; }
@font-face { font-family: "PlexAr"; src: url("${fontUri('IBMPlexSansArabic-Regular.ttf')}"); font-weight: 400; }
@font-face { font-family: "PlexLat"; src: url("${fontUri('IBMPlexSans-Regular.ttf')}"); font-weight: 400; }
html, body { margin: 0; width: ${SIZE}px; height: ${SIZE}px; background: ${CHARCOAL}; color: #ffffff; font-family: "PlexAr", sans-serif; }
.wrap { box-sizing: border-box; width: ${SIZE}px; height: ${SIZE}px; padding: 96px; display: flex; flex-direction: column; justify-content: space-between; }
.rule { width: 120px; height: 6px; background: ${GOLD}; border-radius: 3px; }
.kicker { color: ${GOLD}; font-size: 30px; font-weight: 400; margin-bottom: 28px; }
h1 { margin: 0; font-weight: 700; font-size: ${size}px; line-height: 1.35; text-align: right; overflow-wrap: break-word; }
.foot { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #4a4a4a; padding-top: 36px; }
.brand { font-size: 30px; font-weight: 700; }
.site { font-family: "PlexLat", sans-serif; font-size: 28px; color: ${GOLD}; direction: ltr; }
</style>
</head>
<body>
<div class="wrap">
  <div><div class="rule"></div></div>
  <div>
    <div class="kicker">${escapeHtml(kicker)}</div>
    <h1>${escapeHtml(title)}</h1>
  </div>
  <div class="foot">
    <div class="brand">${escapeHtml(BRAND)}</div>
    <div class="site">${SITE}</div>
  </div>
</div>
</body>
</html>`;
}

async function render(pageHtml, out) {
  const { chromium } = require('playwright');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
    await page.setContent(pageHtml, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    // هل خرج العنوان عن حدود الصورة؟ يُفحص قبل اللقطة
    const overflow = await page.evaluate(() => {
      const r = document.querySelector('h1').getBoundingClientRect();
      return r.bottom > 1080 - 96 || r.top < 96;
    });
    await page.screenshot({ path: out, type: 'jpeg', quality: 88, fullPage: false });
    return overflow;
  } finally {
    await browser.close();
  }
}

// قراءة أبعاد JPEG من ترويسة الملف بلا مكتبات خارجية
function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    const sof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
    if (sof.includes(marker)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

function verify(out, overflow) {
  const buf = fs.readFileSync(out);
  const dims = jpegSize(buf);
  if (!dims) fail('الصيغة ليست JPEG أو الملف تالف');
  if (dims.width !== SIZE || dims.height !== SIZE) fail(`الأبعاد ليست ${SIZE}×${SIZE}: ${dims.width}×${dims.height}`);
  if (buf.length > MAX_BYTES) fail(`حجم الملف يتجاوز الحد: ${buf.length} بايت`);
  if (overflow) fail('العنوان أطول من مساحة الصورة؛ قصّره أو غيّر صياغته');
  console.log(`تم: ${out} (${buf.length} بايت، ${SIZE}×${SIZE}، JPEG)`);
}

function parseArgs(argv) {
  const args = { kicker: DEFAULT_KICKER };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--kicker') { args.kicker = argv[++i] || ''; continue; }
    rest.push(argv[i]);
  }
  args.title = rest[0];
  args.output = rest[1];
  return args;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.title === undefined || a.output === undefined) fail('الاستخدام: node make_social_image.js "عنوان المقال" images/social/slug.jpg [--kicker "سطر صغير"]');
  if (!['.jpg', '.jpeg'].includes(path.extname(a.output).toLowerCase())) fail('امتداد الإخراج يجب أن يكون jpg');
  if (!a.title.trim()) fail('العنوان فارغ');
  const overflow = await render(buildHtml(a.title.trim(), a.kicker.trim()), a.output);
  verify(a.output, overflow);
}

main().catch((e) => fail('فشل الإنتاج: ' + (e && e.message ? e.message : e)));
