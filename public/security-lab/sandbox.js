// Runs inside <iframe sandbox="allow-scripts">: an opaque ("null") origin. Each probe tries something the
// browser should refuse and reports what actually happened. Results go to the parent by postMessage.
(function () {
  var results = [];
  function probe(name, fn) {
    try { var v = fn(); results.push({ name: name, blocked: false, detail: String(v) }); }
    catch (e) { results.push({ name: name, blocked: true, detail: (e && e.name ? e.name + ': ' : '') + (e && e.message ? e.message : String(e)) }); }
  }
  probe('My origin', function () { return self.origin; });
  probe('Read the parent page (parent.document.title)', function () { return parent.document.title; });
  probe('Read the parent URL (top.location.href)', function () { return top.location.href; });
  probe('Use localStorage', function () { localStorage.setItem('probe', '1'); return 'allowed'; });
  probe('Read cookies (document.cookie)', function () { return document.cookie === '' ? '(empty)' : 'readable'; });
  probe('Talk to the parent (postMessage)', function () { return 'allowed: this report arrived that way'; });
  parent.postMessage({ type: 'breach:sandbox', results: results }, '*');
})();
