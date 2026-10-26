/* What's Next - one-ticket-at-a-time walk through your assigned work, in triage-process order.
   Loaded by the SNOW menu bookmarklet (snow-helper-menu.js) on any ServiceNow page.
   READ-ONLY toward ServiceNow: it never changes a ticket.
   Your own state (skips, quick-win tags, ad-hoc items, daily wrap-ups) is saved in this browser
   (localStorage on the ServiceNow site), so it is private to you.
   Show/hide uses element.style.display only (repo rule). */
(function () {
  'use strict';
  var OV_ID = 'snNextOverlay';
  if (document.getElementById(OV_ID)) { document.getElementById(OV_ID).remove(); return; }

  /* ---------------- config ---------------- */
  var STALE_DAYS = 7;              // a work note older than this counts as "needs an update"
  var SLA_AT_RISK = 75;            // SLA % elapsed that counts as "in danger"
  var TABLES = ['sc_task', 'incident', 'change_request'];
  var ME = 'assigned_toDYNAMIC90d1921e5f510100a9ad2572f2b477fe'; // ServiceNow's built-in "Me" filter
  var OPEN = 'active=true^stateNOT IN3,4,7,8,6';                   // same as your name link in SNOW Helper
  var KEY = 'snNext_v1';
  var LANES = { '': 'Initial Action', '0': 'Update Needed', '1': 'Update Needed', '2': 'Prioritize', '3': 'Discuss',
                '4': 'Scheduled', '5': 'Blocked', '6': 'Deferred', '7': 'DC Move', '8': 'ASAP PC' };
  var STEP_COLOR = { initial: '#a78bfa', update: '#fbbf24', quick: '#fb923c', adhoc: '#67e8f9', prioritize: '#60a5fa' };

  var MOCK = window.SNNEXT_MOCK || null; // preview/testing only
  var tok = MOCK ? 'mock' : window.g_ck;
  if (!tok) { for (var i = 0; i < frames.length; i++) { try { if (frames[i].g_ck) { tok = frames[i].g_ck; break; } } catch (e) {} } }
  if (!tok) { window.alert('Open a ServiceNow page first.'); return; }
  var BASE = MOCK ? (MOCK.base || '') : location.origin;

  /* ---------------- storage ---------------- */
  function load() { try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.adhoc) return s; } catch (e) {} return { adhoc: [], quick: {}, skip: {}, seen: {}, logs: {}, labels: [] }; }
  var S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dkey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var TODAY = dkey();
  // drop yesterday's skips / "seen" marks
  Object.keys(S.skip).forEach(function (k) { if (S.skip[k] !== TODAY) delete S.skip[k]; });
  if (!S.seen[TODAY]) S.seen = {}; if (!S.seen[TODAY]) S.seen[TODAY] = [];
  save();

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function v(f) { return f && typeof f === 'object' ? f.value : f; }
  function dv(f) { return f && typeof f === 'object' ? f.display_value : f; }
  function daysAgo(iso) { if (!iso) return null; var t = Date.parse(iso.replace(' ', 'T') + 'Z'); return isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000); }
  function laneKey(order) { var o = String(order == null ? '' : order).trim(); return (o && o !== '0') ? o.padStart(2, '0').charAt(0) : ''; }

  /* ---------------- ServiceNow API (read-only GETs) ---------------- */
  function api(path) {
    if (MOCK) return Promise.resolve(MOCK.route(path));
    return fetch(BASE + path, { headers: { Accept: 'application/json', 'X-UserToken': tok } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { return j.result || []; });
  }
  function q(table, query, fields, limit) {
    return api('/api/now/table/' + table + '?sysparm_query=' + encodeURIComponent(query) + '&sysparm_fields=' + fields +
      '&sysparm_display_value=all&sysparm_exclude_reference_link=true&sysparm_limit=' + (limit || 500));
  }
  function currentUserName() {
    try { if (window.g_user && g_user.userName) return Promise.resolve(g_user.userName); } catch (e) {}
    for (var i = 0; i < frames.length; i++) { try { if (frames[i].g_user && frames[i].g_user.userName) return Promise.resolve(frames[i].g_user.userName); } catch (e) {} }
    try { if (window.NOW && NOW.user && NOW.user.name) return Promise.resolve(NOW.user.name); } catch (e) {}
    return q('sys_user', 'sys_id=javascript:gs.getUserID()', 'user_name', 1).then(function (r) { return r[0] ? v(r[0].user_name) : ''; }).catch(function () { return ''; });
  }

  /* ---------------- overlay shell ----------------
     Docks over ServiceNow's left navigator (Filter navigator + menus) when it can find it,
     otherwise opens on the right edge. Collapses to a thin strip so the navigator shows again. */
  var ov = document.createElement('div');
  ov.id = OV_ID;
  ov.style.cssText = 'position:fixed;background:#0f0f1a;color:#e2e8f0;z-index:999999;' +
    'font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;box-sizing:border-box;display:flex';
  ov.innerHTML =
    '<div id="snnMain" style="display:flex;flex-direction:column;width:100%;height:100%;min-width:0">' +
    '<div style="display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #2a2a3e;flex-shrink:0">' +
      '<span style="font-size:15px;font-weight:700;color:#67e8f9;letter-spacing:.04em">WHAT\u2019S NEXT</span>' +
      '<span id="snnSub" style="font-size:12px;color:#64748b"></span>' +
      '<button data-a="collapse" id="snnCollapse" title="Collapse" style="margin-left:auto;background:none;border:1px solid #2a2a3e;color:#94a3b8;padding:4px 9px;border-radius:6px;cursor:pointer;font:inherit;font-size:13px">\u25c0</button>' +
      '<button data-a="close" title="Close" style="background:none;border:1px solid #2a2a3e;color:#94a3b8;padding:4px 9px;border-radius:6px;cursor:pointer;font:inherit;font-size:13px">\u2715</button>' +
    '</div>' +
    '<div style="display:flex;gap:4px;padding:8px 14px;border-bottom:1px solid #2a2a3e;flex-shrink:0;flex-wrap:wrap">' +
      tabBtn('next', 'Next') + tabBtn('add', '+ Add') + tabBtn('wrap', 'Wrap up') + tabBtn('weekly', 'Weekly') +
    '</div>' +
    '<div id="snnBody" style="flex:1;overflow-y:auto;padding:16px 14px"></div>' +
    '</div>' +
    '<div id="snnStrip" data-a="expand" title="Open What\u2019s Next" style="display:none;width:100%;height:100%;cursor:pointer;align-items:center;justify-content:center;box-sizing:border-box;white-space:nowrap">' +
      '<span style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#67e8f9">\u25b6 WHAT\u2019S NEXT</span>' +
    '</div>';
  document.body.appendChild(ov);
  var NAV_SEL = ['#nav_west', '.navpage-nav', '#gsft_nav'];
  function findNav() {
    for (var i = 0; i < NAV_SEL.length; i++) {
      var el = document.querySelector(NAV_SEL[i]);
      if (el) { var r = el.getBoundingClientRect(); if (r.width >= 150 && r.height >= 200) return r; }
    }
    return null;
  }
  function place() {
    if (!document.body.contains(ov)) { clearInterval(placeTimer); return; }
    var c = !!S.collapsed, r = findNav();
    document.getElementById('snnMain').style.display = c ? 'none' : 'flex';
    document.getElementById('snnStrip').style.display = c ? 'flex' : 'none';
    ov.style.borderRadius = c ? '8px' : '0';
    if (c) {
      // collapsed: small button at the bottom of the menu (or bottom-right corner), menu stays readable
      ov.style.width = '150px'; ov.style.height = '34px'; ov.style.boxShadow = '0 4px 16px rgba(0,0,0,.4)';
      ov.style.border = '1px solid #a78bfa';
      if (r) { ov.style.left = (r.left + 8) + 'px'; ov.style.right = 'auto'; ov.style.top = (r.bottom - 46) + 'px'; }
      else { ov.style.left = 'auto'; ov.style.right = '12px'; ov.style.top = (window.innerHeight - 46) + 'px'; }
      return;
    }
    ov.style.border = 'none';
    if (r) {
      ov.style.left = r.left + 'px'; ov.style.right = 'auto'; ov.style.top = r.top + 'px';
      ov.style.height = r.height + 'px'; ov.style.width = Math.max(r.width, 300) + 'px';
      ov.style.borderRight = '2px solid #a78bfa';
      ov.style.boxShadow = r.width < 300 ? '8px 0 24px rgba(0,0,0,.4)' : 'none';
      document.getElementById('snnCollapse').textContent = '\u25c0';
    } else {
      ov.style.left = 'auto'; ov.style.right = '0'; ov.style.top = '0'; ov.style.height = '100vh';
      ov.style.width = '420px'; ov.style.maxWidth = '100vw';
      ov.style.borderLeft = '2px solid #a78bfa';
      ov.style.boxShadow = '-8px 0 32px rgba(0,0,0,.5)';
      document.getElementById('snnCollapse').textContent = '\u25b6';
    }
  }
  var placeTimer = setInterval(place, 1000);
  window.addEventListener('resize', place);
  function tabBtn(id, label) { return '<button data-tab="' + id + '" style="flex:1;padding:6px 4px;border-radius:6px;border:1px solid #2a2a3e;background:none;color:#94a3b8;font:inherit;font-size:12px;font-weight:600;cursor:pointer">' + label + '</button>'; }
  var body = document.getElementById('snnBody');
  var tab = 'next';
  function setTab(t) {
    tab = t;
    Array.prototype.forEach.call(ov.querySelectorAll('[data-tab]'), function (b) {
      var on = b.getAttribute('data-tab') === t;
      b.style.background = on ? '#a78bfa' : 'none'; b.style.color = on ? '#0f0f1a' : '#94a3b8'; b.style.borderColor = on ? '#a78bfa' : '#2a2a3e';
    });
    render();
  }

  /* ---------------- data ---------------- */
  var tickets = [], loaded = false, loadErr = '', userName = '', todayNotes = [];
  function loadAll() {
    loaded = false; loadErr = ''; render();
    var fields = 'sys_id,number,short_description,order,state,priority,sys_updated_on,opened_at,sys_class_name';
    Promise.all(TABLES.map(function (t) {
      return q(t, OPEN + '^' + ME, fields).then(function (r) { r.forEach(function (x) { x._table = t; }); return r; }).catch(function () { return []; });
    })).then(function (sets) {
      tickets = [].concat.apply([], sets).map(function (x) {
        return { id: v(x.sys_id), table: x._table, number: dv(x.number), sd: dv(x.short_description), order: v(x.order),
                 lane: laneKey(v(x.order)), priority: dv(x.priority), opened: v(x.opened_at), updated: v(x.sys_updated_on), lastNote: null, sla: null };
      });
      if (!tickets.length) return;
      var ids = tickets.map(function (t) { return t.id; });
      var notes = q('sys_journal_field', 'element=work_notes^element_idIN' + ids.join(',') + '^ORDERBYDESCsys_created_on', 'element_id,sys_created_on', 3000)
        .then(function (r) { var seen = {}; r.forEach(function (n) { var id = v(n.element_id); if (!seen[id]) { seen[id] = 1; var t = byId(id); if (t) t.lastNote = v(n.sys_created_on); } }); })
        .catch(function () {});
      var slas = q('task_sla', 'active=true^taskIN' + ids.join(','), 'task,has_breached,percentage,planned_end_time', 2000)
        .then(function (r) { r.forEach(function (s) { var t = byId(v(s.task)); if (!t) return; var br = String(v(s.has_breached)) === 'true', pct = parseFloat(v(s.percentage)) || 0;
          if (!t.sla || br || pct > t.sla.pct) t.sla = { breached: br || (t.sla && t.sla.breached), pct: Math.max(pct, t.sla ? t.sla.pct : 0), due: dv(s.planned_end_time) }; }); })
        .catch(function () {});
      return Promise.all([notes, slas]);
    }).then(function () { loaded = true; render(); })
      .catch(function (e) { loaded = true; loadErr = 'Couldn\u2019t load your tickets (' + e.message + '). Try Refresh.'; render(); });
  }
  function byId(id) { for (var i = 0; i < tickets.length; i++) if (tickets[i].id === id) return tickets[i]; return null; }

  /* ---------------- the "what's next" order (your Triage Process Guide) ---------------- */
  function noteAge(t) { return t.lastNote ? daysAgo(t.lastNote) : daysAgo(t.opened); }
  function prioRank(t) { var p = parseInt(String(t.priority || '').replace(/\D/g, ''), 10); return isNaN(p) ? 9 : p; }
  function buildQueue() {
    var out = [], used = {};
    function push(step, item, why) { if (used[item.id]) return; used[item.id] = 1; out.push({ step: step, item: item, why: why }); }
    var live = tickets.filter(function (t) { return !S.skip[t.id]; });
    // 1. Initial Action - blank Order
    live.filter(function (t) { return t.lane === ''; })
      .sort(function (a, b) { return (a.opened || '') < (b.opened || '') ? -1 : 1; })
      .forEach(function (t) { push('initial', t, 'No Order set yet, needs initial action'); });
    // 2. Update Needed - the 00-19 lane, then anything you're actively working whose last note is stale
    live.filter(function (t) { return t.lane === '0' || t.lane === '1'; })
      .sort(function (a, b) { return (noteAge(b) || 0) - (noteAge(a) || 0); })
      .forEach(function (t) { var a = noteAge(t); push('update', t, 'In Update Needed' + (a != null ? ', last work note ' + a + ' day' + (a === 1 ? '' : 's') + ' ago' : '')); });
    live.filter(function (t) { return t.lane === '2' && (noteAge(t) || 0) > STALE_DAYS; })
      .sort(function (a, b) { return (noteAge(b) || 0) - (noteAge(a) || 0); })
      .forEach(function (t) { push('update', t, 'Last work note ' + noteAge(t) + ' days ago, status may be out of date'); });
    // 3. Quick wins - ones you've tagged as 15 minutes or less
    live.filter(function (t) { return S.quick[t.id]; }).forEach(function (t) { push('quick', t, 'You tagged this as a quick win'); });
    // 4. Ad-hoc items (Nashoba, ED build, anything outside SN)
    S.adhoc.filter(function (a) { return !a.done && S.skip[a.id] !== TODAY; })
      .forEach(function (a) { push('adhoc', a, a.label ? a.label + ' item you added' : 'Item you added'); });
    // 5. Prioritize lane - missed SLA, SLA at risk, then ones digit, then priority
    live.filter(function (t) { return t.lane === '2'; })
      .sort(function (a, b) {
        function w(t) { return t.sla && t.sla.breached ? 0 : (t.sla && t.sla.pct >= SLA_AT_RISK ? 1 : 2); }
        return (w(a) - w(b)) || ((parseInt(a.order, 10) || 0) - (parseInt(b.order, 10) || 0)) || (prioRank(a) - prioRank(b));
      })
      .forEach(function (t) {
        var why = t.sla && t.sla.breached ? 'SLA missed' : (t.sla && t.sla.pct >= SLA_AT_RISK ? 'SLA ' + Math.round(t.sla.pct) + '% used' + (t.sla.due ? ', due ' + t.sla.due : '') : 'In Prioritize, order ' + t.order);
        push('prioritize', t, why);
      });
    return out;
  }
  var STEP_NAME = { initial: 'Initial Action', update: 'Update Needed', quick: 'Quick win', adhoc: 'Your items', prioritize: 'Prioritize' };

  /* ---------------- views ---------------- */
  function btn(a, label, style, id) { return '<button data-a="' + a + '"' + (id ? ' data-id="' + id + '"' : '') + ' style="padding:8px 12px;border-radius:7px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;' + (style || 'border:1px solid #2a2a3e;background:none;color:#e2e8f0') + '">' + label + '</button>'; }
  var PRI = 'border:1px solid #a78bfa;background:#a78bfa;color:#0f0f1a';
  var GO = 'border:1px solid #34d399;background:#34d399;color:#0f0f1a';

  function render() {
    if (tab === 'next') return renderNext();
    if (tab === 'add') return renderAdd();
    if (tab === 'wrap') return renderWrap();
    if (tab === 'weekly') return renderWeekly();
  }

  function renderNext() {
    document.getElementById('snnSub').textContent = '';
    if (!loaded) { body.innerHTML = '<div style="color:#64748b;text-align:center;padding:40px 0">Reading your tickets\u2026</div>'; return; }
    if (loadErr) { body.innerHTML = '<div style="color:#f87171;margin-bottom:12px">' + esc(loadErr) + '</div>' + btn('refresh', 'Refresh'); return; }
    var queue = buildQueue(), seen = S.seen[TODAY] || [];
    var rest = queue.filter(function (x) { return seen.indexOf(x.item.id) < 0; });
    var cur = rest[0];
    document.getElementById('snnSub').textContent = rest.length ? rest.length + ' to go' : '';
    var h = '';
    if (!cur) {
      var hidden = {}; tickets.forEach(function (t) { if (['3', '4', '5', '6', '7', '8'].indexOf(t.lane) >= 0) hidden[LANES[t.lane]] = (hidden[LANES[t.lane]] || 0) + 1; });
      h += '<div style="font-size:18px;font-weight:600;margin-bottom:8px">You\u2019re through the list.</div>' +
        '<div style="color:#94a3b8;line-height:1.6;margin-bottom:16px">Everything in Initial Action, Update Needed, your quick wins, your items, and Prioritize has had a look today.</div>';
      var hk = Object.keys(hidden);
      if (hk.length) h += '<div style="font-size:12px;color:#64748b;margin-bottom:16px">Not in the walk: ' + hk.map(function (k) { return hidden[k] + ' ' + k; }).join(' \u00b7 ') + '</div>';
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap">' + btn('restart', 'Start over') + btn('tab-wrap', 'Wrap up the day', GO) + '</div>';
      body.innerHTML = h; return;
    }
    var it = cur.item, col = STEP_COLOR[cur.step], isTicket = cur.step !== 'adhoc';
    var stepItems = queue.filter(function (x) { return x.step === cur.step; }), pos = stepItems.indexOf(cur) + 1;
    h += '<div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:' + col + ';text-transform:uppercase;margin-bottom:10px">' +
      STEP_NAME[cur.step] + ' \u00b7 ' + pos + ' of ' + stepItems.length + '</div>';
    h += '<div style="border:1px solid ' + col + '66;border-left:4px solid ' + col + ';border-radius:0;background:#1a1a2e;padding:16px;margin-bottom:14px">';
    if (isTicket) {
      h += '<a href="' + esc(BASE + '/' + it.table + '.do?sys_id=' + it.id) + '" target="_blank" rel="noopener" style="font-family:Consolas,monospace;font-size:13px;color:#60a5fa;text-decoration:none">' + esc(it.number) + ' \u2197</a>';
      h += '<div style="font-size:17px;font-weight:600;line-height:1.4;margin:6px 0 10px">' + esc(it.sd) + '</div>';
    } else {
      if (it.label) h += '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#67e8f922;color:#67e8f9;border:1px solid #67e8f955">' + esc(it.label) + '</span>';
      h += '<div style="font-size:17px;font-weight:600;line-height:1.4;margin:8px 0 10px">' + esc(it.title) + '</div>';
    }
    h += '<div style="font-size:13px;color:#cbd5e1">' + esc(cur.why) + '</div>';
    if (isTicket) h += '<div style="font-size:12px;color:#64748b;margin-top:6px">' + esc([LANES[it.lane], it.priority].filter(Boolean).join(' \u00b7 ')) + '</div>';
    h += '</div>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
    if (isTicket) h += btn('open', 'Open ticket', PRI, it.id);
    else h += btn('adone', '\u2713 Done', GO, it.id);
    h += btn('next', 'Next \u2192', null, it.id) + '</div>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap">' + btn('skip', 'Skip for today', 'border:1px solid #2a2a3e;background:none;color:#94a3b8', it.id);
    if (isTicket) h += btn('quick', S.quick[it.id] ? '\u2605 Quick win (untag)' : '\u2606 Quick win', 'border:1px solid #2a2a3e;background:none;color:' + (S.quick[it.id] ? '#fb923c' : '#94a3b8'), it.id);
    h += '</div>';
    if (seen.length) h += '<div style="margin-top:22px">' + btn('back', '\u2190 Back', 'border:none;background:none;color:#64748b;padding:4px 0') + '</div>';
    body.innerHTML = h;
  }

  function renderAdd() {
    document.getElementById('snnSub').textContent = '';
    var open = S.adhoc.filter(function (a) { return !a.done; });
    var h = '<div style="color:#94a3b8;font-size:13px;margin-bottom:10px">Things that aren\u2019t in ServiceNow. They show up in your walk after quick wins and stay until you mark them done.</div>';
    h += '<input id="snnTitle" placeholder="Confirm go-live testing dates" style="' + inp() + 'margin-bottom:8px">';
    h += '<input id="snnLabel" list="snnLabels" placeholder="Project label (optional): Nashoba" style="' + inp() + 'margin-bottom:8px">';
    h += '<datalist id="snnLabels">' + S.labels.map(function (l) { return '<option value="' + esc(l) + '">'; }).join('') + '</datalist>';
    h += btn('addsave', 'Add', PRI);
    h += '<div id="snnAddMsg" style="font-size:12px;color:#34d399;margin-top:8px;min-height:1em"></div>';
    if (open.length) {
      h += '<div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:#64748b;margin:16px 0 6px">OPEN ITEMS</div>';
      open.forEach(function (a) {
        h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid #2a2a3e">' +
          (a.label ? '<span style="font-size:11px;color:#67e8f9">' + esc(a.label) + '</span>' : '') +
          '<span style="flex:1">' + esc(a.title) + '</span>' +
          '<button data-a="adone" data-id="' + a.id + '" title="Mark done" style="background:none;border:none;color:#34d399;cursor:pointer;font-size:15px">\u2713</button>' +
          '<button data-a="adel" data-id="' + a.id + '" title="Remove" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:15px">\u2715</button></div>';
      });
    }
    body.innerHTML = h;
    var t = document.getElementById('snnTitle'); t.focus();
    t.addEventListener('keydown', function (e) { if (e.key === 'Enter') addItem(); });
    document.getElementById('snnLabel').addEventListener('keydown', function (e) { if (e.key === 'Enter') addItem(); });
  }
  function inp() { return 'width:100%;box-sizing:border-box;padding:9px 11px;background:#1a1a2e;border:1px solid #2a2a3e;border-radius:7px;color:#e2e8f0;font:inherit;font-size:14px;outline:none;'; }
  function addItem() {
    var t = document.getElementById('snnTitle'), l = document.getElementById('snnLabel');
    var title = t.value.trim(), label = l.value.trim();
    if (!title) { document.getElementById('snnAddMsg').textContent = 'Type what the item is first.'; document.getElementById('snnAddMsg').style.color = '#f87171'; return; }
    S.adhoc.push({ id: uid(), title: title, label: label, added: TODAY, done: null });
    if (label && S.labels.indexOf(label) < 0) S.labels.push(label);
    save(); renderAdd();
    document.getElementById('snnAddMsg').textContent = 'Added.';
    document.getElementById('snnLabel').value = label;
  }

  /* Wrap up: what you touched today, written as text you can paste */
  function renderWrap() {
    document.getElementById('snnSub').textContent = '';
    body.innerHTML = '<div style="color:#64748b;text-align:center;padding:40px 0">Pulling today\u2019s work notes\u2026</div>';
    var since = TODAY + ' 00:00:00';
    currentUserName().then(function (u) {
      userName = u;
      if (!u) return [];
      return q('sys_journal_field', 'element=work_notes^sys_created_by=' + u + '^sys_created_on>=javascript:gs.beginningOfToday()^ORDERBYsys_created_on', 'element_id,name,sys_created_on', 500)
        .catch(function () { return q('sys_journal_field', 'element=work_notes^sys_created_by=' + u + '^sys_created_on>=' + since, 'element_id,name,sys_created_on', 500).catch(function () { return []; }); });
    }).then(function (notes) {
      todayNotes = notes || [];
      var touched = {}, order = [];
      todayNotes.forEach(function (n) { var id = v(n.element_id); if (!touched[id]) { touched[id] = 1; order.push(id); } });
      var lines = [];
      order.forEach(function (id) { var t = byId(id); lines.push(t ? t.number + ' ' + t.sd : 'Ticket ' + id.slice(0, 8) + ' (closed or not assigned to you)'); });
      var doneAd = S.adhoc.filter(function (a) { return a.done === TODAY; });
      var openAd = S.adhoc.filter(function (a) { return !a.done; });
      var log = S.logs[TODAY] || {};
      var h = '<div style="font-size:16px;font-weight:600;margin-bottom:12px">' + new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'numeric', day: 'numeric' }) + '</div>';
      h += '<div style="font-size:12px;color:#94a3b8;margin-bottom:6px">Anything to add?</div>';
      h += '<textarea id="snnNote" placeholder="Got pulled into a downtime call for an hour" style="' + inp() + 'min-height:64px;resize:vertical;margin-bottom:12px">' + esc(log.note || '') + '</textarea>';
      h += '<div style="font-size:12px;color:#94a3b8;margin-bottom:6px">Your summary (edit freely before copying)</div>';
      h += '<textarea id="snnSum" style="' + inp() + 'min-height:220px;resize:vertical;font-family:Consolas,monospace;font-size:12.5px;line-height:1.55;margin-bottom:10px"></textarea>';
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' + btn('copysum', 'Copy for OneNote', GO) + '<span id="snnCopied" style="font-size:12px;color:#34d399;display:none">Copied</span></div>';
      if (!userName) h += '<div style="font-size:12px;color:#fbbf24;margin-top:10px">Couldn\u2019t tell who you are from this page, so ServiceNow work notes are left out. Your own items are still included.</div>';
      body.innerHTML = h;
      function build() {
        var note = document.getElementById('snnNote').value.trim();
        var out = [];
        out.push(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
        if (lines.length) { out.push('', 'Worked on in ServiceNow:'); lines.forEach(function (l) { out.push('- ' + l); }); }
        if (doneAd.length) { out.push('', 'Done:'); doneAd.forEach(function (a) { out.push('- ' + (a.label ? a.label + ': ' : '') + a.title); }); }
        if (openAd.length) { out.push('', 'Still open:'); openAd.forEach(function (a) { out.push('- ' + (a.label ? a.label + ': ' : '') + a.title); }); }
        if (note) out.push('', 'Notes: ' + note);
        if (out.length === 1) out.push('', 'Nothing logged yet today.');
        return out.join('\n');
      }
      var sum = document.getElementById('snnSum'); sum.value = build();
      document.getElementById('snnNote').addEventListener('input', function () {
        S.logs[TODAY] = { note: this.value, tickets: lines, done: doneAd.map(function (a) { return a.id; }) }; save(); sum.value = build();
      });
      S.logs[TODAY] = { note: log.note || '', tickets: lines, done: doneAd.map(function (a) { return a.id; }) }; save();
    });
  }

  /* Weekly update for one project label, Monday through today */
  function weekStart() { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); }
  var weeklyLabel = null;
  function renderWeekly() {
    document.getElementById('snnSub').textContent = '';
    var labels = S.labels.slice();
    if (!labels.length) { body.innerHTML = '<div style="color:#94a3b8;line-height:1.6">Add an item with a project label (like Nashoba) on the <b>+ Add</b> tab, and its weekly update will build here.</div>'; return; }
    if (!weeklyLabel || labels.indexOf(weeklyLabel) < 0) weeklyLabel = labels.indexOf('Nashoba') >= 0 ? 'Nashoba' : labels[0];
    var ws = weekStart(), L = weeklyLabel.toLowerCase();
    var mine = S.adhoc.filter(function (a) { return (a.label || '').toLowerCase() === L; });
    var done = mine.filter(function (a) { return a.done && a.done >= ws; });
    var open = mine.filter(function (a) { return !a.done; });
    var notes = Object.keys(S.logs).filter(function (k) { return k >= ws; }).sort()
      .map(function (k) { return S.logs[k].note || ''; })
      .filter(function (n) { return n && n.toLowerCase().indexOf(L) >= 0; });
    var wsd = new Date(ws + 'T12:00:00');
    var out = [weeklyLabel + ' \u2014 week of ' + (wsd.getMonth() + 1) + '/' + wsd.getDate(), '', 'Done this week:'];
    out.push.apply(out, done.length ? done.map(function (a) { return '- ' + a.title; }) : ['- ']);
    out.push('', 'In progress / still open:');
    out.push.apply(out, open.length ? open.map(function (a) { return '- ' + a.title; }) : ['- ']);
    if (notes.length) { out.push('', 'Notes from the week:'); notes.forEach(function (n) { out.push('- ' + n); }); }
    out.push('', 'Blockers:', '- ', '', 'Next week:', '- ');
    var h = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + labels.map(function (l) {
      var on = l === weeklyLabel; return '<button data-a="wlabel" data-id="' + esc(l) + '" style="padding:5px 11px;border-radius:999px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;border:1px solid ' + (on ? '#67e8f9' : '#2a2a3e') + ';background:' + (on ? '#67e8f9' : 'none') + ';color:' + (on ? '#0f0f1a' : '#94a3b8') + '">' + esc(l) + '</button>';
    }).join('') + '</div>';
    h += '<div style="font-size:12px;color:#94a3b8;margin-bottom:6px">Built from this week\u2019s ' + esc(weeklyLabel) + ' items and any wrap-up notes that mention it. Fill in blockers and next week, then copy.</div>';
    h += '<textarea id="snnWeek" style="' + inp() + 'min-height:300px;resize:vertical;font-family:Consolas,monospace;font-size:12.5px;line-height:1.55;margin-bottom:10px">' + esc(out.join('\n')) + '</textarea>';
    h += '<div style="display:flex;gap:8px;align-items:center">' + btn('copyweek', 'Copy for OneNote', GO) + '<span id="snnCopied" style="font-size:12px;color:#34d399;display:none">Copied</span></div>';
    body.innerHTML = h;
  }

  function copy(text) {
    var ok = function () { var m = document.getElementById('snnCopied'); if (m) { m.style.display = 'inline'; setTimeout(function () { m.style.display = 'none'; }, 1600); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { fallback(text); ok(); });
    else { fallback(text); ok(); }
  }
  function fallback(text) { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }

  /* ---------------- events ---------------- */
  ov.addEventListener('click', function (e) {
    var tb = e.target.closest('[data-tab]'); if (tb) { setTab(tb.getAttribute('data-tab')); return; }
    var el = e.target.closest('[data-a]'); if (!el) return;
    var a = el.getAttribute('data-a'), id = el.getAttribute('data-id');
    var seen = S.seen[TODAY];
    switch (a) {
      case 'close': ov.remove(); clearInterval(placeTimer); break;
      case 'collapse': S.collapsed = true; save(); place(); break;
      case 'expand': S.collapsed = false; save(); place(); break;
      case 'refresh': loadAll(); break;
      case 'open': var t = byId(id); if (t) window.open(BASE + '/' + t.table + '.do?sys_id=' + t.id, '_blank'); break;
      case 'next': if (seen.indexOf(id) < 0) seen.push(id); save(); render(); break;
      case 'back': seen.pop(); save(); render(); break;
      case 'skip': S.skip[id] = TODAY; save(); render(); break;
      case 'quick': if (S.quick[id]) delete S.quick[id]; else S.quick[id] = TODAY; save(); render(); break;
      case 'restart': S.seen[TODAY] = []; save(); render(); break;
      case 'adone': S.adhoc.forEach(function (x) { if (x.id === id) x.done = TODAY; }); save(); render(); break;
      case 'adel': S.adhoc = S.adhoc.filter(function (x) { return x.id !== id; }); save(); render(); break;
      case 'addsave': addItem(); break;
      case 'tab-wrap': setTab('wrap'); break;
      case 'copysum': copy(document.getElementById('snnSum').value); break;
      case 'copyweek': copy(document.getElementById('snnWeek').value); break;
      case 'wlabel': weeklyLabel = id; render(); break;
    }
  });

  place();
  setTab('next');
  loadAll();
})();
