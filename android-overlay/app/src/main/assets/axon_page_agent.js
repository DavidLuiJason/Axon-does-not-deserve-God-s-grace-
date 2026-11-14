/* AXON page agent v1. Injected by the native browser into the AXON-owned tab only.
   It reads the page as a list of interactive elements and performs one small action at a time.
   Safety here is a second line of defence; the permission gateway decides first. */
(function () {
  'use strict';
  if (window.__axonAgent && window.__axonAgent.version === 1) return;
  var counter = 1;
  var INTERACTIVE = 'a[href],button,input,select,textarea,[role="button"],[role="link"],[role="checkbox"],[onclick]';
  var MAX_ELEMENTS = 120, MAX_TEXT = 20000, MAX_LABEL = 120, MAX_TYPED = 2000;
  var PAYMENT = /(pay now|place order|complete purchase|buy now|checkout|confirm payment|purchase|pay with|pay )/i;
  var SIGNIN = /(sign in|log in|login|sign up|register|create account)/i;
  var SENSITIVE_NAME = /(card|cvv|cvc|ccnum|expir|iban|ssn|passw|otp|pin code|security code)/i;

  function clip(value, limit) {
    var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    return text.length > limit ? text.slice(0, limit) : text;
  }
  function attr(el, name) { return el.getAttribute ? (el.getAttribute(name) || '') : ''; }
  function tag(el) { return String(el.tagName || '').toLowerCase(); }
  function inputType(el) { return tag(el) === 'input' ? (attr(el, 'type') || 'text').toLowerCase() : ''; }
  function isVisible(el) {
    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (!rect || (rect.width === 0 && rect.height === 0)) return false;
    var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    return true;
  }
  function labelOf(el) {
    var text = attr(el, 'aria-label') || attr(el, 'title') || attr(el, 'placeholder') || attr(el, 'alt');
    if (!text) text = el.innerText || el.textContent || '';
    if (!text && tag(el) === 'input') text = attr(el, 'value');
    return clip(text, MAX_LABEL);
  }
  function roleOf(el) {
    var t = tag(el), type = inputType(el);
    if (t === 'a') return 'link';
    if (t === 'button') return 'button';
    if (t === 'select') return 'select';
    if (t === 'textarea') return 'textbox';
    if (t === 'input') {
      if (type === 'submit' || type === 'button' || type === 'reset' || type === 'image') return 'button';
      if (type === 'checkbox' || type === 'radio') return type;
      return 'textbox';
    }
    return attr(el, 'role') || 'control';
  }
  function isSensitive(el) {
    var t = tag(el), type = inputType(el);
    if (t !== 'input' && t !== 'textarea') return false;
    if (type === 'password') return true;
    var auto = attr(el, 'autocomplete').toLowerCase();
    if (auto.indexOf('cc-') === 0 || auto === 'one-time-code' || auto === 'current-password' || auto === 'new-password') return true;
    return SENSITIVE_NAME.test(attr(el, 'name') + ' ' + attr(el, 'id'));
  }
  function riskOf(el) {
    var role = roleOf(el), type = inputType(el);
    var buttonLike = role === 'button' || type === 'submit';
    if (!buttonLike) return 'none';
    var text = labelOf(el) + ' ' + attr(el, 'name') + ' ' + attr(el, 'id') + ' ' + attr(el, 'value');
    var form = el.closest ? el.closest('form') : null;
    var passwordForm = !!(form && form.querySelector && form.querySelector('input[type="password"]'));
    if (PAYMENT.test(text)) return 'payment';
    if (SIGNIN.test(text) || passwordForm) return 'sign-in';
    if (type === 'submit' || (form && tag(el) === 'button' && attr(el, 'type') !== 'button')) return 'submit';
    return 'none';
  }
  function describe(el) {
    var id = attr(el, 'data-axon-id');
    if (!id) { id = 'e' + counter++; el.setAttribute('data-axon-id', id); }
    var item = { id: id, role: roleOf(el), tag: tag(el), text: labelOf(el), sensitive: isSensitive(el), risk: riskOf(el) };
    var href = attr(el, 'href');
    if (href) item.href = clip(href, 300);
    var type = inputType(el);
    if (type) item.inputType = type;
    var name = attr(el, 'name');
    if (name) item.name = clip(name, 60);
    if (!item.sensitive && (tag(el) === 'input' || tag(el) === 'textarea' || tag(el) === 'select') && type !== 'checkbox' && type !== 'radio') item.value = clip(el.value, 200);
    if (type === 'checkbox' || type === 'radio') item.checked = !!el.checked;
    return item;
  }
  function snapshot() {
    var nodes = document.querySelectorAll(INTERACTIVE), elements = [], truncated = false;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.disabled || !isVisible(el)) continue;
      if (elements.length >= MAX_ELEMENTS) { truncated = true; break; }
      elements.push(describe(el));
    }
    var body = document.body;
    var text = String((body && (body.innerText || body.textContent)) || '');
    if (text.length > MAX_TEXT) { text = text.slice(0, MAX_TEXT); truncated = true; }
    return JSON.stringify({ ok: true, url: String(location.href), title: String(document.title || ''), text: text, elements: elements, truncated: truncated, scrollY: Number(window.scrollY || 0) });
  }
  function fire(el, type) { try { el.dispatchEvent(new Event(type, { bubbles: true })); } catch (e) { /* ignore */ } }
  function fail(error, message, extra) {
    var out = { ok: false, error: error, message: message };
    if (extra && extra.risk) out.risk = extra.risk;
    return JSON.stringify(out);
  }
  function act(json) {
    var a;
    try { a = JSON.parse(json); } catch (e) { return fail('bad-action', 'The action was not valid JSON.'); }
    if (!a || typeof a !== 'object') return fail('bad-action', 'The action must be an object.');
    if (a.url && String(location.href) !== String(a.url)) return fail('page-changed', 'The page changed since the last snapshot. Take a new snapshot first.');
    if (a.type === 'scroll') {
      var dy = Number(a.dy);
      if (!isFinite(dy)) return fail('bad-action', 'scroll needs a number dy.');
      dy = Math.max(-5000, Math.min(5000, dy));
      window.scrollBy(0, dy);
      return JSON.stringify({ ok: true, action: 'scroll', y: Number(window.scrollY || 0) });
    }
    var id = String(a.id || '');
    if (!/^e[0-9]+$/.test(id)) return fail('bad-id', 'The element id is not valid.');
    var el = document.querySelector('[data-axon-id="' + id + '"]');
    if (!el) return fail('no-such-element', 'No element with that id on this page. Take a new snapshot.');
    if (!isVisible(el) || el.disabled) return fail('not-available', 'The element is hidden or disabled.');
    if (a.type === 'click') {
      var risk = riskOf(el);
      if (risk === 'payment' || risk === 'sign-in') return fail('owner-handoff', 'Payment and sign-in steps are done by the owner, never by AXON.', { risk: risk });
      if (risk === 'submit' && a.approved !== true) return fail('owner-approval-required', 'Submitting a form needs the owner approval.', { risk: risk });
      if (el.scrollIntoView) el.scrollIntoView();
      el.click();
      return JSON.stringify({ ok: true, action: 'click', risk: risk });
    }
    if (a.type === 'type') {
      var t = tag(el);
      if (t !== 'input' && t !== 'textarea') return fail('not-a-text-field', 'Only text fields can be typed into.');
      var type = inputType(el);
      if (type === 'checkbox' || type === 'radio' || type === 'file' || type === 'submit' || type === 'button') return fail('not-a-text-field', 'This input does not take text.');
      if (isSensitive(el)) return fail('sensitive-field', 'AXON never types into password, card or code fields.');
      var text = String(a.text == null ? '' : a.text);
      if (text.length > MAX_TYPED) return fail('text-too-long', 'The text is too long.');
      if (el.focus) el.focus();
      var proto = t === 'textarea' ? window.HTMLTextAreaElement : window.HTMLInputElement;
      var descriptor = proto && proto.prototype ? Object.getOwnPropertyDescriptor(proto.prototype, 'value') : null;
      if (descriptor && descriptor.set) descriptor.set.call(el, text); else el.value = text;
      fire(el, 'input'); fire(el, 'change');
      return JSON.stringify({ ok: true, action: 'type' });
    }
    if (a.type === 'select') {
      if (tag(el) !== 'select') return fail('not-a-select', 'The element is not a drop-down list.');
      var wanted = String(a.value == null ? '' : a.value), found = false, options = el.options || [];
      for (var i = 0; i < options.length; i++) { if (String(options[i].value) === wanted) { found = true; break; } }
      if (!found) return fail('no-such-option', 'The drop-down list has no such value.');
      el.value = wanted; fire(el, 'change');
      return JSON.stringify({ ok: true, action: 'select' });
    }
    return fail('bad-action', 'Action type must be click, type, select or scroll.');
  }
  window.__axonAgent = { version: 1, snapshot: snapshot, act: act };
})();
