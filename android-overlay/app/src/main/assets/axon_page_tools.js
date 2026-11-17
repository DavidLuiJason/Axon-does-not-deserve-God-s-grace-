/* AXON Web page tools v1: small owner tools that run inside the page (read links, select text, reader mode, media controls).
   Injected by the native browser on request; every tool takes one JSON string and returns a JSON string. */
(function () {
  'use strict';
  if (window.__axonTools && window.__axonTools.version === 1) return;
  function clip(value, limit) {
    var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    return text.length > limit ? text.slice(0, limit) : text;
  }
  function visible(el) {
    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    return !!rect && !(rect.width === 0 && rect.height === 0);
  }
  function parse(json) { try { var a = JSON.parse(json); return a && typeof a === 'object' ? a : {}; } catch (e) { return {}; } }
  function done(object) { return JSON.stringify(object); }
  function extract() {
    var links = [], headings = [], images = [], i, list;
    list = document.querySelectorAll('a[href]');
    for (i = 0; i < list.length && links.length < 200; i++) {
      if (!visible(list[i])) continue;
      links.push({ index: links.length, text: clip(list[i].innerText || list[i].textContent || list[i].getAttribute('aria-label'), 120), href: clip(list[i].href || list[i].getAttribute('href'), 400) });
    }
    list = document.querySelectorAll('h1,h2,h3');
    for (i = 0; i < list.length && headings.length < 60; i++) headings.push({ level: Number(String(list[i].tagName).slice(1)), text: clip(list[i].innerText || list[i].textContent, 160) });
    list = document.querySelectorAll('img');
    for (i = 0; i < list.length && images.length < 40; i++) images.push({ alt: clip(list[i].getAttribute('alt'), 120), src: clip(list[i].src || list[i].getAttribute('src'), 400) });
    return done({ ok: true, url: String(location.href), title: String(document.title || ''), links: links, headings: headings, images: images });
  }
  function selectText() {
    var selection = window.getSelection ? window.getSelection() : null;
    if (!selection || !document.body) return done({ ok: false, error: 'no-selection-support', message: 'This page cannot select text.' });
    if (selection.removeAllRanges) selection.removeAllRanges();
    if (selection.selectAllChildren) selection.selectAllChildren(document.body);
    return done({ ok: true, length: String(selection.toString()).length });
  }
  function selection() {
    var selection = window.getSelection ? window.getSelection() : null;
    var text = selection ? String(selection.toString()) : '';
    return done({ ok: true, text: text.length > 5000 ? text.slice(0, 5000) : text });
  }
  function readerMode() {
    var holder = document.querySelector('article') || document.querySelector('main') || document.body;
    if (!holder) return done({ ok: false, error: 'no-content', message: 'There is nothing to show in reader mode.' });
    var paragraphs = holder.querySelectorAll('p,h1,h2,h3,li'), out = [], total = 0, i;
    for (i = 0; i < paragraphs.length && total < 60000; i++) {
      var text = clip(paragraphs[i].innerText || paragraphs[i].textContent, 2000);
      if (text.length < 2) continue;
      var tag = String(paragraphs[i].tagName).toLowerCase();
      out.push({ tag: tag === 'li' ? 'p' : tag, text: text });
      total += text.length;
    }
    if (out.length === 0) return done({ ok: false, error: 'no-content', message: 'This page has no readable text.' });
    var title = String(document.title || '');
    document.body.textContent = '';
    var wrap = document.createElement('div');
    wrap.setAttribute('style', 'max-width:40em;margin:0 auto;padding:16px;font:18px/1.6 sans-serif;color:#222;background:#fff');
    var heading = document.createElement('h1'); heading.textContent = title; wrap.appendChild(heading);
    for (i = 0; i < out.length; i++) { var node = document.createElement(out[i].tag); node.textContent = out[i].text; wrap.appendChild(node); }
    document.body.appendChild(wrap);
    return done({ ok: true, blocks: out.length, chars: total });
  }
  function media(json) {
    var a = parse(json), list = document.querySelectorAll('video,audio'), target = null, i;
    for (i = 0; i < list.length; i++) { if (!list[i].paused) { target = list[i]; break; } }
    if (!target && list.length > 0) target = list[0];
    if (!target) return done({ ok: false, error: 'no-media', message: 'There is no video or audio on this page.' });
    if (a.action === 'playPause') {
      if (target.paused) { if (target.play) target.play(); } else if (target.pause) target.pause();
      return done({ ok: true, playing: !target.paused });
    }
    if (a.action === 'seek') {
      var delta = Number(a.delta);
      if (!isFinite(delta)) return done({ ok: false, error: 'bad-input', message: 'seek needs a number of seconds.' });
      var length = isFinite(target.duration) ? target.duration : Number.MAX_VALUE;
      target.currentTime = Math.max(0, Math.min(length, Number(target.currentTime || 0) + Math.max(-3600, Math.min(3600, delta))));
      return done({ ok: true, time: Number(target.currentTime) });
    }
    if (a.action === 'volume') {
      var level = Number(a.level);
      if (!isFinite(level)) return done({ ok: false, error: 'bad-input', message: 'volume needs a level from 0 to 1.' });
      target.volume = Math.max(0, Math.min(1, level));
      return done({ ok: true, volume: Number(target.volume) });
    }
    return done({ ok: false, error: 'bad-input', message: 'Unknown media action.' });
  }
  window.__axonTools = { version: 1, extract: extract, selectText: selectText, selection: selection, readerMode: readerMode, media: media };
})();
