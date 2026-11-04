// BballData online (the published copy only, never the double-click file):
//  - offline mode: a service worker keeps the app on the device, so it also opens without signal;
//  - a small bar that helps a new device join the coach's Google Sheet, or install the app.
// It never touches the app's data: it only reads whether a Google Sheet is connected.
(function () {
  'use strict';
  var hosted = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!hosted) return;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('Offline mode unavailable:', e); });
    });
  }

  var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var installEvent = null;
  var bar = null;

  function hiddenUntil() { try { return Number(localStorage.getItem('bballdata-bar-hidden') || 0); } catch (e) { return 0; } }
  function hideFor(days) { try { localStorage.setItem('bballdata-bar-hidden', String(Date.now() + days * 864e5)); } catch (e) { /* not kept */ } }

  function render(connected) {
    if (bar) { bar.remove(); bar = null; }
    if (Date.now() < hiddenUntil()) return;
    var parts = [];
    if (!connected) parts.push('<span>Already using BballData on another device?</span><a href="connect.html" class="bb-act">Connect this one</a>');
    if (installEvent && !standalone) parts.push('<button type="button" class="bb-act" id="bb-install">Install the app</button>');
    if (!parts.length) return;
    bar = document.createElement('div');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'BballData on this device');
    bar.innerHTML = '<style>' +
      '#bb-bar{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:9999;width:max-content;max-width:calc(100vw - 20px);display:flex;flex-wrap:nowrap;align-items:center;gap:10px;' +
      'background:#1d1d1f;color:#fff;font:14px/1.4 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;padding:8px 10px 8px 14px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25)}' +
      '#bb-bar span{flex:1 1 auto;min-width:0}#bb-bar .bb-act{flex:none;white-space:nowrap;background:#fff;color:#1d1d1f;border:0;border-radius:8px;padding:7px 12px;font:inherit;font-weight:600;text-decoration:none;cursor:pointer}' +
      '#bb-bar .bb-x{flex:none;background:none;border:0;color:#bbb;font-size:20px;line-height:1;cursor:pointer;padding:4px 6px}' +
      '@media print{#bb-bar{display:none}}</style>' +
      '<div id="bb-bar">' + parts.join('') + '<button type="button" class="bb-x" aria-label="Hide for a week" title="Hide for a week">×</button></div>';
    document.body.appendChild(bar);
    bar.querySelector('.bb-x').onclick = function () { hideFor(7); bar.remove(); bar = null; };
    var b = bar.querySelector('#bb-install');
    if (b) b.onclick = function () {
      var ev = installEvent; installEvent = null;
      ev.prompt();
      ev.userChoice.finally(function () { check(); });
    };
  }

  // Is a Google Sheet connected on this device? Read-only, and only once the app has created its storage.
  function connected() {
    return new Promise(function (resolve) {
      var r;
      try { r = indexedDB.open('bballdata'); } catch (e) { resolve(null); return; }
      r.onupgradeneeded = function () { r.transaction.abort(); };       // not created yet: never create it here
      r.onerror = r.onblocked = function () { resolve(null); };
      r.onsuccess = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains('_meta')) { db.close(); resolve(null); return; }
        try {
          var q = db.transaction('_meta', 'readonly').objectStore('_meta').get('google');
          q.onsuccess = function () { var v = q.result && q.result.value; db.close(); resolve(!!(v && v.enabled)); };
          q.onerror = function () { db.close(); resolve(null); };
        } catch (e) { db.close(); resolve(null); }
      };
    });
  }

  var tries = 0;
  function check() {
    connected().then(function (c) {
      if (c === null && tries++ < 10) { setTimeout(check, 1500); return; }
      render(c !== false);
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvent = e; check(); });
  window.addEventListener('appinstalled', function () { installEvent = null; check(); });
  window.addEventListener('load', function () { setTimeout(check, 1200); });
  // the app reloads its data after a Google pull: the bar may no longer be needed
  window.addEventListener('bballdata:reloaded', function () { setTimeout(check, 500); });
})();
