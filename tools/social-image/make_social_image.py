#!/usr/bin/env python3
"""
أداة صورة المنشور لمقالات موقع مكتب تيسير صافي لتدقيق الحسابات.

الاستخدام:
    python3 tools/social-image/make_social_image.py "عنوان المقال" images/social/slug.jpg

تنتج صورة مربعة 1080×1080 بصيغة JPEG بهوية المكتب (فحمي وذهبي، خط IBM Plex Sans Arabic)
وتتحقق بعد الإنتاج من الأبعاد والصيغة والحجم. الخطوط مرفقة في مجلد fonts بجوار الملف.
المتطلبات: Python 3 مع حزمتي playwright (ومتصفح Chromium) وPillow.
"""

import argparse
import html
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
FONTS = HERE / "fonts"

BRAND = "مكتب تيسير صافي لتدقيق الحسابات"
SITE = "tsaudit.com"
DEFAULT_KICKER = "مقال جديد على موقع المكتب"

CHARCOAL = "#2B2B2B"
GOLD = "#B8954A"
MAX_BYTES = 1_000_000
SIZE = 1080


def font_uri(name: str) -> str:
    path = FONTS / name
    if not path.is_file():
        sys.exit(f"الخط غير موجود: {path}")
    return path.as_uri()


def build_html(title: str, kicker: str) -> str:
    title_html = html.escape(title)
    kicker_html = html.escape(kicker)
    brand_html = html.escape(BRAND)
    # حجم الخط يصغر تلقائياً مع العناوين الطويلة
    n = len(title)
    if n <= 45:
        size = 72
    elif n <= 70:
        size = 62
    elif n <= 95:
        size = 54
    else:
        size = 46
    return f"""<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<style>
@font-face {{ font-family: "PlexAr"; src: url("{font_uri('IBMPlexSansArabic-Bold.ttf')}"); font-weight: 700; }}
@font-face {{ font-family: "PlexAr"; src: url("{font_uri('IBMPlexSansArabic-Regular.ttf')}"); font-weight: 400; }}
@font-face {{ font-family: "PlexLat"; src: url("{font_uri('IBMPlexSans-Regular.ttf')}"); font-weight: 400; }}
html, body {{ margin: 0; width: {SIZE}px; height: {SIZE}px; background: {CHARCOAL}; color: #ffffff;
             font-family: "PlexAr", sans-serif; }}
.wrap {{ box-sizing: border-box; width: {SIZE}px; height: {SIZE}px; padding: 96px;
         display: flex; flex-direction: column; justify-content: space-between; }}
.rule {{ width: 120px; height: 6px; background: {GOLD}; border-radius: 3px; }}
.kicker {{ color: {GOLD}; font-size: 30px; font-weight: 400; margin-bottom: 28px; }}
h1 {{ margin: 0; font-weight: 700; font-size: {size}px; line-height: 1.35; text-align: right;
      overflow-wrap: break-word; }}
.foot {{ display: flex; justify-content: space-between; align-items: flex-end;
         border-top: 1px solid #4a4a4a; padding-top: 36px; }}
.brand {{ font-size: 30px; font-weight: 700; }}
.site {{ font-family: "PlexLat", sans-serif; font-size: 28px; color: {GOLD}; direction: ltr; }}
</style>
</head>
<body>
<div class="wrap">
  <div><div class="rule"></div></div>
  <div>
    <div class="kicker">{kicker_html}</div>
    <h1>{title_html}</h1>
  </div>
  <div class="foot">
    <div class="brand">{brand_html}</div>
    <div class="site">{SITE}</div>
  </div>
</div>
</body>
</html>"""


def render(page_html: str, out: pathlib.Path) -> None:
    from playwright.sync_api import sync_playwright

    out.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": SIZE, "height": SIZE}, device_scale_factor=1)
        page.set_content(page_html, wait_until="load")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(300)
        page.screenshot(path=str(out), type="jpeg", quality=88, full_page=False)
        browser.close()


def verify(out: pathlib.Path) -> None:
    from PIL import Image

    with Image.open(out) as im:
        if im.format != "JPEG":
            sys.exit(f"الصيغة ليست JPEG: {im.format}")
        if im.size != (SIZE, SIZE):
            sys.exit(f"الأبعاد ليست {SIZE}×{SIZE}: {im.size}")
    size = out.stat().st_size
    if size > MAX_BYTES:
        sys.exit(f"حجم الملف يتجاوز الحد: {size} بايت")
    print(f"تم: {out} ({size} بايت، {SIZE}×{SIZE}، JPEG)")


def main() -> None:
    ap = argparse.ArgumentParser(description="إنتاج صورة منشور لمقال")
    ap.add_argument("title", help="عنوان المقال كما سيظهر على الصورة")
    ap.add_argument("output", help="مسار ملف الإخراج، بامتداد jpg")
    ap.add_argument("--kicker", default=DEFAULT_KICKER, help="السطر الصغير فوق العنوان")
    args = ap.parse_args()

    out = pathlib.Path(args.output)
    if out.suffix.lower() not in (".jpg", ".jpeg"):
        sys.exit("امتداد الإخراج يجب أن يكون jpg")
    if not args.title.strip():
        sys.exit("العنوان فارغ")

    render(build_html(args.title.strip(), args.kicker.strip()), out)
    verify(out)


if __name__ == "__main__":
    main()
