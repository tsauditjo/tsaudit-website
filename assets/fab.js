/* الطباعة: فتح الأسئلة المطوية قبل الطباعة كي تُطبع أجوبتها، ثم إعادتها كما كانت. */
(function () {
  var opened = [];
  window.addEventListener('beforeprint', function () {
    opened = [];
    var items = document.querySelectorAll('details:not([open])');
    for (var i = 0; i < items.length; i++) { items[i].open = true; opened.push(items[i]); }
  });
  window.addEventListener('afterprint', function () {
    for (var i = 0; i < opened.length; i++) opened[i].open = false;
    opened = [];
  });
})();

/* زر واتساب العائم: يظهر بعد الواجهة، ويُخفى فوق الأقسام المحددة في data-hide-over،
   وعندما يقع فوق نص أي رابط أو زر، ثم يعود بعد لحظة من زوال التقاطع. */
(function () {
  var fab = document.getElementById('fab');
  if (!fab) return;

  var ids = (fab.getAttribute('data-hide-over') || '').split(',');
  var zones = [];
  ids.forEach(function (id) {
    var el = document.getElementById(id.trim());
    if (el) zones.push(el);
  });

  var MARGIN = 6;        // هامش حول الزر بالبكسل
  var RESHOW_MS = 250;   // مهلة العودة بعد زوال التقاطع، لتجنب الوميض
  var range = document.createRange();
  var targets = [];      // عناصر قابلة للضغط مع عقد النص داخلها
  var overText = false;
  var reshowTimer = null;
  var queued = false;

  function collectTargets() {
    var items = document.querySelectorAll('a[href], button, summary');
    for (var i = 0; i < items.length; i++) {
      if (fab.contains(items[i])) continue;
      var nodes = [];
      var walker = document.createTreeWalker(items[i], NodeFilter.SHOW_TEXT);
      var n;
      while ((n = walker.nextNode())) {
        if (n.nodeValue.replace(/\s+/g, '') !== '') nodes.push(n);
      }
      if (nodes.length) targets.push({ el: items[i], nodes: nodes });
    }
  }

  function hits(a, b) {
    return b.width > 0 && b.height > 0 &&
      a.left - MARGIN < b.right && a.right + MARGIN > b.left &&
      a.top - MARGIN < b.bottom && a.bottom + MARGIN > b.top;
  }

  function coversLinkText(f) {
    for (var i = 0; i < targets.length; i++) {
      if (!hits(f, targets[i].el.getBoundingClientRect())) continue;
      for (var j = 0; j < targets[i].nodes.length; j++) {
        range.selectNodeContents(targets[i].nodes[j]);
        var rects = range.getClientRects();
        for (var k = 0; k < rects.length; k++) {
          if (hits(f, rects[k])) return true;
        }
      }
    }
    return false;
  }

  function inZone() {
    var vh = window.innerHeight;
    for (var i = 0; i < zones.length; i++) {
      var r = zones[i].getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) return true;
    }
    return false;
  }

  function render() {
    var focused = document.activeElement === fab;
    fab.classList.toggle('show', !inZone() && (!overText || focused));
  }

  function check() {
    queued = false;
    var f = fab.getBoundingClientRect();
    if (f.width === 0) return;   // الزر غير معروض على الشاشات الكبيرة
    if (coversLinkText(f)) {
      clearTimeout(reshowTimer);
      reshowTimer = null;
      overText = true;
    } else if (overText && reshowTimer === null) {
      reshowTimer = setTimeout(function () {
        reshowTimer = null;
        overText = false;
        render();
      }, RESHOW_MS);
    }
    render();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(check);
  }

  collectTargets();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('toggle', schedule, true);   // فتح الأسئلة يحرّك المحتوى دون تمرير
  fab.addEventListener('focus', schedule);
  fab.addEventListener('blur', schedule);
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  schedule();
})();
