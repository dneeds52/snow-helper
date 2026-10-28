/* What's Next - one-ticket-at-a-time walk through your assigned work, in triage-process order.
   Loaded by the SNOW menu bookmarklet (snow-helper-menu.js) on any ServiceNow page.
   Reads ServiceNow; the only thing it ever changes is a ticket's due date, and only when you click
   Park until / Bring back.
   Your own state (skips, quick-win tags, ad-hoc items, daily wrap-ups) is saved in this browser
   (localStorage on the ServiceNow site), so it is private to you.
   Show/hide uses element.style.display only (repo rule). */
(function () {
  'use strict';
  var OV_ID = 'snNextOverlay';
  if (document.getElementById(OV_ID)) { document.getElementById(OV_ID).remove(); return; }

  /* ---------------- config ---------------- */
  var STALE_DAYS = 7;              // a work note older than this counts as "needs an update"
  var PARK_DATE = '2027-02-22';    // "Park until" button date (Nashoba go-live 2/1, back on the list ~2/15)
  var PARK_LEAD = 7;               // a parked ticket comes back this many days before its due date
  var SLA_AT_RISK = 75;            // SLA % elapsed that counts as "in danger"
  var TABLES = ['sc_task', 'incident', 'change_request'];
  var ME = 'assigned_toDYNAMIC90d1921e5f510100a9ad2572f2b477fe'; // ServiceNow's built-in "Me" filter
  var OPEN = 'active=true^stateNOT IN3,4,7,8,6';
  var GROUP = 'b0f881a7db916e00cdb372fc0f961973';                  // EPIC-ASAP assignment group
  var QUEUE_DAY = 3; // Wednesday: you're on the group queue
  // Group queue switch: on automatically on Wednesdays; flip it for any day (only lasts that day)
  function queueOn() { return S.queue && S.queue.day === dkey() ? S.queue.on : new Date().getDay() === QUEUE_DAY; }
  // your tickets, plus (when the queue is on) your group's tickets nobody has taken yet
  function listQuery() { return OPEN + '^' + ME + (queueOn() ? '^NQ' + OPEN + '^assigned_toISEMPTY^assignment_group=' + GROUP : ''); }
  var KEY = 'snNext_v1';
  var LANES = { '': 'Initial Action', '0': 'Update Needed', '1': 'Update Needed', '2': 'Prioritize', '3': 'Discuss',
                '4': 'Scheduled', '5': 'Blocked', '6': 'Deferred', '7': 'DC Move', '8': 'ASAP PC' };
  var STEP_COLOR = { top: '#f87171', initial: '#a78bfa', update: '#fbbf24', quick: '#fb923c', adhoc: '#67e8f9', prioritize: '#60a5fa' };

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
  // calendar days ago in your local time (yesterday at 4pm = 1, even if it's only 16 hours)
  function daysAgo(iso) {
    if (!iso) return null; var t = Date.parse(iso.replace(' ', 'T') + 'Z'); if (isNaN(t)) return null;
    var a = new Date(t), b = new Date(); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 86400000);
  }
  function laneKey(order) { var o = String(order == null ? '' : order).trim(); return (o && o !== '0') ? o.padStart(2, '0').charAt(0) : ''; }

  /* ---------------- ServiceNow API (reads, plus the one due-date write below) ---------------- */
  function api(path) {
    if (MOCK) return Promise.resolve(MOCK.route(path));
    return fetch(BASE + path, { headers: { Accept: 'application/json', 'X-UserToken': tok } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { return j.result || []; });
  }
  // The ONLY write What's Next makes: setting or clearing a ticket's due date, when you click Park / Bring back.
  function setDue(t, ymd) {
    var val = ymd ? ymd + ' 17:00:00' : '';   // noon Eastern, stored in UTC
    if (MOCK) return Promise.resolve(MOCK.write(t.table, t.id, { due_date: val }));
    return fetch(BASE + '/api/now/table/' + t.table + '/' + t.id + '?sysparm_input_display_value=false', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-UserToken': tok },
      body: JSON.stringify({ due_date: val })
    }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function daysUntil(iso) { if (!iso) return null; var t = Date.parse(iso.replace(' ', 'T') + 'Z'); return isNaN(t) ? null : Math.ceil((t - Date.now()) / 86400000); }
  function shortDate(iso) { if (!iso) return ''; var d = new Date(Date.parse(iso.replace(' ', 'T') + 'Z')); return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2); }
  function isParked(t) { var d = daysUntil(t.due); return d != null && d > PARK_LEAD; }
  // tickets: a far-off due date only parks it once it has an Order and an owner (new tickets always show)
  function parkedNow(t) { return isParked(t) && (isItem(t) || (S.parked && S.parked[t.id]) || (t.lane !== '' && !t.unassigned)); }
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

  // Diagonal-arrow icons: inward = minimize, outward = expand
  var ICON_MIN = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  var ICON_REFRESH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>';
  var ICON_MAX = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  /* ---------------- overlay shell ----------------
     Docks over ServiceNow's left navigator (Filter navigator + menus) when it can find it,
     otherwise opens on the right edge. Collapses to a thin strip so the navigator shows again. */
  var ov = document.createElement('div');
  ov.id = OV_ID;
  ov.style.cssText = 'position:fixed;background:#0f0f1a;color:#e2e8f0;z-index:999999;' +
    'font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;box-sizing:border-box;display:flex';
  ov.innerHTML =
    '<div id="snnMain" style="display:flex;flex-direction:column;width:100%;height:100%;min-width:0">' +
    '<div style="display:flex;align-items:center;gap:5px;padding:10px 10px 10px 14px;border-bottom:1px solid #2a2a3e;flex-shrink:0">' +
      '<span style="font-size:14px;font-weight:700;color:#67e8f9;letter-spacing:.04em;white-space:nowrap">WHAT\u2019S NEXT</span>' +
      '<span id="snnSub" style="font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0"></span>' +
      '<button data-a="refresh" title="Refresh tickets" aria-label="Refresh tickets" style="margin-left:auto;background:none;border:1px solid #2a2a3e;color:#94a3b8;padding:4px 5px;border-radius:6px;cursor:pointer;line-height:0">' + ICON_REFRESH + '</button>' +
      '<button data-a="tab-help" title="How to use" aria-label="How to use" style="background:none;border:1px solid #2a2a3e;color:#94a3b8;padding:3px 7px;border-radius:6px;cursor:pointer;font:inherit;font-size:13px;font-weight:700">?</button>' +
      '<button data-a="collapse" id="snnCollapse" title="Minimize" aria-label="Minimize" style="background:none;border:1px solid #2a2a3e;color:#94a3b8;padding:4px 5px;border-radius:6px;cursor:pointer;line-height:0">' + ICON_MIN + '</button>' +
      '<button data-a="close" title="Close" style="background:none;border:1px solid #2a2a3e;color:#94a3b8;padding:3px 7px;border-radius:6px;cursor:pointer;font:inherit;font-size:13px">\u2715</button>' +
    '</div>' +
    '<div style="display:flex;gap:4px;padding:8px 14px;border-bottom:1px solid #2a2a3e;flex-shrink:0;flex-wrap:wrap">' +
      tabBtn('next', 'Next') + tabBtn('add', '+ Add') + tabBtn('wrap', 'Wrap up') + tabBtn('weekly', 'Weekly') +
    '</div>' +
    '<div id="snnUndo" style="display:none;align-items:center;gap:8px;padding:8px 14px;background:#1a1a2e;border-bottom:1px solid #2a2a3e;font-size:13px;flex-shrink:0"><span id="snnUndoMsg" style="flex:1;min-width:0"></span><button data-a="undo" style="background:none;border:1px solid #67e8f9;color:#67e8f9;border-radius:6px;padding:3px 10px;font:inherit;font-size:12px;font-weight:600;cursor:pointer">Undo</button></div>' +
    '<div id="snnBody" style="flex:1;overflow-y:auto;padding:16px 14px"></div>' +
    '</div>' +
    '<div id="snnStrip" data-a="expand" title="Open What\u2019s Next" style="display:none;width:100%;height:100%;cursor:pointer;align-items:center;justify-content:center;box-sizing:border-box;white-space:nowrap">' +
      '<span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;letter-spacing:.08em;color:#67e8f9">' + ICON_MAX + 'WHAT\u2019S NEXT</span>' +
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
    } else {
      ov.style.left = 'auto'; ov.style.right = '0'; ov.style.top = '0'; ov.style.height = '100vh';
      ov.style.width = '420px'; ov.style.maxWidth = '100vw';
      ov.style.borderLeft = '2px solid #a78bfa';
      ov.style.boxShadow = '-8px 0 32px rgba(0,0,0,.5)';
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
  var lastLoad = 0, loading = false;
  // silent = refresh in the background without flashing "Reading your tickets"
  function loadAll(silent) {
    if (loading) return; loading = true; lastLoad = Date.now();
    if (!silent) { loaded = false; loadErr = ''; render(); }
    var fields = 'sys_id,number,short_description,order,state,priority,sys_updated_on,opened_at,sys_class_name,due_date,assigned_to';
    Promise.all(TABLES.map(function (t) {
      return q(t, listQuery(), fields).then(function (r) { r.forEach(function (x) { x._table = t; }); return r; }).catch(function () { return []; });
    })).then(function (sets) {
      tickets = [].concat.apply([], sets).map(function (x) {
        return { id: v(x.sys_id), table: x._table, number: dv(x.number), sd: dv(x.short_description), order: v(x.order),
                 lane: laneKey(v(x.order)), priority: dv(x.priority), opened: v(x.opened_at), updated: v(x.sys_updated_on), unassigned: !v(x.assigned_to), due: v(x.due_date) || '', lastNote: null, sla: null };
      });
      if (!tickets.length) return;
      var ids = tickets.map(function (t) { return t.id; });
      var meU = myUserName();
      var notes = q('sys_journal_field', 'elementINwork_notes,comments^element_idIN' + ids.join(',') + '^ORDERBYDESCsys_created_on', 'element_id,sys_created_on,sys_created_by', 3000)
        .then(function (r) {
          r.forEach(function (n) {
            var t = byId(v(n.element_id)); if (!t) return;
            if (!t.lastNote) { t.lastNote = v(n.sys_created_on); t.noteSrc = 'notes table'; }
            if (!t.myLast && meU && String(v(n.sys_created_by)).toLowerCase() === meU.toLowerCase()) t.myLast = v(n.sys_created_on);
          });
        })
        .catch(function () {})
        .then(fromTicketText);
      var slas = q('task_sla', 'active=true^taskIN' + ids.join(','), 'task,has_breached,percentage,planned_end_time', 2000)
        .then(function (r) { r.forEach(function (s) { var t = byId(v(s.task)); if (!t) return; var br = String(v(s.has_breached)) === 'true', pct = parseFloat(v(s.percentage)) || 0;
          if (!t.sla || br || pct > t.sla.pct) t.sla = { breached: br || (t.sla && t.sla.breached), pct: Math.max(pct, t.sla ? t.sla.pct : 0), due: dv(s.planned_end_time) }; }); })
        .catch(function () {});
      return Promise.all([notes, slas]);
    }).then(function () { loading = false; loaded = true; loadErr = ''; noteArrivals(); var sb = document.getElementById('snnSub'); if (sb && /^Refresh/.test(sb.textContent)) sb.textContent = ''; if (!silent || tab === 'next' || tab === 'parked') keepTyping(render); })
      .catch(function (e) { loading = false; if (silent) return; loaded = true; loadErr = 'Couldn\u2019t load your tickets (' + e.message + '). Try Refresh.'; render(); });
  }
  // don't wipe anything you're typing in during a background refresh
  function keepTyping(fn) { var a = document.activeElement; if (a && ov.contains(a) && /INPUT|TEXTAREA/.test(a.tagName)) return; fn(); }
  // Auto-refresh: when you come back to this tab/window (e.g. after updating a ticket), reload quietly.
  function maybeRefresh() { if (!document.body.contains(ov)) return; if (document.visibilityState === 'visible' && Date.now() - lastLoad > 15000) loadAll(true); }
  document.addEventListener('visibilitychange', maybeRefresh);
  window.addEventListener('focus', maybeRefresh);
  var autoTimer = setInterval(function () { if (!document.body.contains(ov)) { clearInterval(autoTimer); return; } if (document.visibilityState === 'visible' && Date.now() - lastLoad > 300000) loadAll(true); }, 60000);
  /* Backup for "last update": if the notes table gave nothing for a ticket (often a permissions thing),
     read the ticket's own Work notes + Additional comments text and take the newest timestamp. */
  function fromTicketText() {
    var byTable = {};
    var me = myFullName(), meU = myUserName();
    // read the ticket text when the notes table gave nothing, or when it couldn't tell which notes are yours
    tickets.forEach(function (t) { if (!t.lastNote || (!meU && me)) (byTable[t.table] = byTable[t.table] || []).push(t.id); });
    return Promise.all(Object.keys(byTable).map(function (tb) {
      return q(tb, 'sys_idIN' + byTable[tb].join(','), 'sys_id,work_notes,comments', 500).then(function (r) {
        r.forEach(function (x) {
          var t = byId(v(x.sys_id)); if (!t) return;
          var text = String(dv(x.work_notes) || '') + '\n' + String(dv(x.comments) || '');
          var best = newestStamp(text);
          if (best && !t.lastNote) { t.lastNote = best; t.noteSrc = 'ticket text'; }
          if (me && !t.myLast) {
            var mine = parseJournal(text, '').filter(function (e) { return e.author.toLowerCase() === me.toLowerCase(); }).sort(function (a, b) { return b.when - a.when; })[0];
            if (mine) t.myLast = mine.when.toISOString().slice(0, 19).replace('T', ' ');
          }
        });
      }).catch(function () {});
    }));
  }
  // "2026-10-20 09:13:22 - Name (Work notes)" or "10-20-2026 09:13:22 AM - Name (Additional comments)" -> newest, as UTC "YYYY-MM-DD HH:MM:SS"
  function newestStamp(text) {
    var re = /(\d{1,4})[-\/.](\d{1,2})[-\/.](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?\s+-\s+[^\n]*?\((Work notes|Additional comments|Comments)\)/gi, m, best = 0;
    while ((m = re.exec(text))) {
      var y, mo, d;
      if (m[1].length === 4) { y = +m[1]; mo = +m[2]; d = +m[3]; } else { mo = +m[1]; d = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
      var h = +m[4]; if (m[7]) { var pm = /p/i.test(m[7]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
      var dt = new Date(y, mo - 1, d, h, +m[5], +(m[6] || 0)).getTime();
      if (dt > best && dt <= Date.now() + 864e5) best = dt;
    }
    return best ? new Date(best).toISOString().slice(0, 19).replace('T', ' ') : null;
  }
  function byId(id) { for (var i = 0; i < tickets.length; i++) if (tickets[i].id === id) return tickets[i]; return null; }

  /* ---------------- the "what's next" order (your Triage Process Guide) ---------------- */
  function noteAge(t) { return t.lastNote ? daysAgo(t.lastNote) : daysAgo(t.opened); }
  // "updated today" = YOU wrote a work note or comment today (not the requester, not an automatic note)
  function touchedToday(t) { return !!t.myLast && dkey(new Date(Date.parse(t.myLast.replace(' ', 'T') + 'Z'))) === TODAY; }
  function myUserName() {
    var u = null; try { u = window.g_user; } catch (e) {}
    for (var i = 0; !u && i < frames.length; i++) { try { u = frames[i].g_user; } catch (e) {} }
    return (u && (u.userName || u.user_name)) || '';
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  // "last update 3 days ago" / "updated today" / "no updates yet, opened 600 days ago"
  function updateText(t) {
    if (t.lastNote) { var a = daysAgo(t.lastNote); return a <= 0 ? 'updated today' : 'last update ' + plural(a, 'day') + ' ago'; }
    var o = daysAgo(t.opened); return 'no work notes or comments yet' + (o != null ? ', opened ' + plural(o, 'day') + ' ago' : '');
  }
  /* Your items (project work, not in ServiceNow) get a bucket just like tickets */
  var ITEM_LANES = [['initial', 'Initial Action'], ['update', 'Update Needed'], ['prioritize', 'Prioritize'], ['waiting', 'Waiting / blocked'], ['deferred', 'Deferred']];
  function isItem(x) { return !!x && !x.number; }
  function itemLane(a) { return a.lane || 'initial'; }
  function laneOptions(sel) { return ITEM_LANES.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === sel ? ' selected' : '') + '>' + l[1] + '</option>'; }).join(''); }
  function itemAge(a) { return daysAgo((a.touched || a.added) + ' 12:00:00') || 0; }
  function itemWhy(a) {
    var who = a.label ? a.label + ' item' : 'Your item', age = daysAgo(a.added + ' 12:00:00') || 0;
    return who + ', added ' + (age ? plural(age, 'day') + ' ago' : 'today');
  }
  function prioRank(t) { var p = parseInt(String(t.priority || '').replace(/\D/g, ''), 10); return isNaN(p) ? 9 : p; }
  function buildQueue() {
    var out = [], used = {};
    function push(step, item, why) { if (used[item.id]) return; used[item.id] = 1; out.push({ step: step, item: item, why: why }); }
    // touched today (a work note or comment from today) stays in its bucket but counts as done
    var live = tickets.filter(function (t) { return !S.skip[t.id] && !parkedNow(t); });
    // your items that are in the walk today (done-today ones stay so counts don't jump)
    var items = S.adhoc.filter(function (a) { return (!a.done || a.done === TODAY) && S.skip[a.id] !== TODAY && !isParked(a); });
    function itemsIn(l) { return items.filter(function (a) { return itemLane(a) === l; }); }
    // merge two lists that are each already in order; "older first" decides who goes next
    function mergeByAge(ts, tsAge, its) {
      var out2 = [], i = 0, j = 0;
      its = its.slice().sort(function (a, b) { return itemAge(b) - itemAge(a); });
      while (i < ts.length || j < its.length) {
        if (j >= its.length || (i < ts.length && tsAge(ts[i]) >= itemAge(its[j]))) out2.push(ts[i++]); else out2.push(its[j++]);
      }
      return out2;
    }
    // 0. Important - anything you pinned, in the order you pinned it
    S.pin = S.pin || {};
    live.concat(items).filter(function (x) { return S.pin[x.id]; }).sort(function (a, b) { return S.pin[a.id] < S.pin[b.id] ? -1 : 1; })
      .forEach(function (x) { push('top', x, 'You marked this important'); });
    // 1. Initial Action - blank Order (oldest first), mixed with items in Initial Action
    var initT = live.filter(function (t) { return t.lane === ''; }).sort(function (a, b) { return (a.opened || '') < (b.opened || '') ? -1 : 1; });
    mergeByAge(initT, function (t) { return daysAgo(t.opened) || 0; }, itemsIn('initial')).forEach(function (x) {
      push('initial', x, isItem(x) ? itemWhy(x) : 'No Order set yet, needs initial action');
    });
    // 2. Update Needed - the 00-19 lane (stalest first), mixed with items; then stale Prioritize tickets
    var updT = live.filter(function (t) { return t.lane === '0' || t.lane === '1'; }).sort(function (a, b) { return (noteAge(b) || 0) - (noteAge(a) || 0); });
    mergeByAge(updT, function (t) { return noteAge(t) || 0; }, itemsIn('update')).forEach(function (x) {
      push('update', x, isItem(x) ? itemWhy(x) + ', needs an update' : 'In Update Needed, ' + updateText(x));
    });
    // 3. Quick wins - tickets or items you've tagged as 15 minutes or less
    live.filter(function (t) { return S.quick[t.id]; }).forEach(function (t) { push('quick', t, 'You tagged this as a quick win'); });
    items.filter(function (a) { return S.quick[a.id] && itemLane(a) !== 'waiting' && itemLane(a) !== 'deferred'; }).forEach(function (a) { push('quick', a, 'You tagged this as a quick win'); });
    // 4. Prioritize - missed SLA, SLA at risk first; then the rest by Order, mixed with items by age
    function w(t) { return t.sla && t.sla.breached ? 0 : (t.sla && t.sla.pct >= SLA_AT_RISK ? 1 : 2); }
    var prT = live.filter(function (t) { return t.lane === '2'; })
      .sort(function (a, b) { return (w(a) - w(b)) || ((parseInt(a.order, 10) || 0) - (parseInt(b.order, 10) || 0)) || (prioRank(a) - prioRank(b)); });
    var urgent = prT.filter(function (t) { return w(t) < 2; }), rest = prT.filter(function (t) { return w(t) === 2; });
    urgent.concat(mergeByAge(rest, function (t) { return daysAgo(t.opened) || 0; }, itemsIn('prioritize'))).forEach(function (x) {
      if (isItem(x)) { push('prioritize', x, itemWhy(x)); return; }
      push('prioritize', x, x.sla && x.sla.breached ? 'SLA missed' : (x.sla && x.sla.pct >= SLA_AT_RISK ? 'SLA ' + Math.round(x.sla.pct) + '% used' + (x.sla.due ? ', due ' + x.sla.due : '') : 'In Prioritize, order ' + x.order) + ((noteAge(x) || 0) > STALE_DAYS ? ' \u00b7 ' + updateText(x) : ''));
    });
    return out;
  }
  var STEP_NAME = { top: 'Important', initial: 'Initial Action', update: 'Update Needed', quick: 'Quick win', adhoc: 'Your items', prioritize: 'Prioritize' };

  /* ---------------- views ---------------- */
  function btn(a, label, style, id) { return '<button data-a="' + a + '"' + (id ? ' data-id="' + id + '"' : '') + ' style="padding:8px 12px;border-radius:7px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;' + (style || 'border:1px solid #2a2a3e;background:none;color:#e2e8f0') + '">' + label + '</button>'; }
  var PRI = 'border:1px solid #a78bfa;background:#a78bfa;color:#0f0f1a';
  var GO = 'border:1px solid #34d399;background:#34d399;color:#0f0f1a';

  function render() {
    if (tab === 'next') return renderNext();
    if (tab === 'add') return renderAdd();
    if (tab === 'wrap') return renderWrap();
    if (tab === 'weekly') return renderWeekly();
    if (tab === 'parked') return renderParked();
    if (tab === 'help') return renderHelp();
  }

  var ORDER = ['top', 'initial', 'update', 'quick', 'prioritize'];
  var lastActive = null;
  function buckets() {
    var queue = buildQueue(), seen = S.seen[TODAY] || [], B = {};
    queue.forEach(function (x) { x.done = seen.indexOf(x.item.id) >= 0 || (isItem(x.item) ? x.item.done === TODAY : touchedToday(x.item)); });
    ORDER.forEach(function (k) {
      var items = queue.filter(function (x) { return x.step === k; });
      var done = items.filter(function (x) { return x.done; }).length;
      B[k] = { items: items, total: items.length, done: done, next: items.filter(function (x) { return !x.done; })[0] || null };
    });
    return B;
  }
  /* New arrivals: anything that shows up after your first load of the day is "new" until you've been through it */
  function noteArrivals() {
    var ids = buildQueue().map(function (x) { return x.item.id; });
    if (!S.known || S.known.day !== TODAY) { S.known = { day: TODAY, ids: ids }; S.newIds = { day: TODAY, ids: [] }; save(); return; }
    if (!S.newIds || S.newIds.day !== TODAY) S.newIds = { day: TODAY, ids: [] };
    ids.forEach(function (id) { if (S.known.ids.indexOf(id) < 0) { S.known.ids.push(id); S.newIds.ids.push(id); } });
    save();
  }
  // new arrivals you haven't been through yet: [{step, id}]
  function pendingNew(B) {
    var ids = (S.newIds && S.newIds.day === TODAY) ? S.newIds.ids : [], out = [];
    ORDER.forEach(function (k) { B[k].items.forEach(function (x) { if (!x.done && ids.indexOf(x.item.id) >= 0) out.push({ step: k, id: x.item.id }); }); });
    return out;
  }
  function stripHtml(B, active) {
    var pend = pendingNew(B);
    var h = '<div style="margin-bottom:14px">';
    ORDER.forEach(function (k) {
      var b = B[k], col = STEP_COLOR[k];
      if ((k === 'quick' || k === 'top') && !b.total) return;
      var isActive = k === active, finished = !b.next;
      var icon = finished ? '\u2713' : (isActive ? '\u25cf' : '\u25cb');
      var count = !b.total ? 'none' : finished ? 'done' : isActive ? (k === 'prioritize' ? 'next up' : (b.done + 1) + ' of ' + b.total) : (k === 'prioritize' ? '' : String(b.total - b.done));
      var st = isActive ? 'background:' + col + '1f;border:1px solid ' + col + '66;color:' + col : 'border:1px solid transparent;color:' + (finished ? '#64748b' : '#94a3b8');
      h += '<button data-a="bucket" data-id="' + k + '" title="' + (finished ? STEP_NAME[k] + ' is done' : 'Jump to ' + STEP_NAME[k]) + '" style="display:flex;align-items:center;gap:8px;width:100%;padding:6px 9px;margin-bottom:3px;border-radius:7px;font:inherit;font-size:13px;text-align:left;cursor:' + (finished ? 'default' : 'pointer') + ';background:none;' + st + '">' +
        '<span style="width:12px;text-align:center">' + icon + '</span><span>' + STEP_NAME[k] + '</span>' +
        (function () { var n = pend.filter(function (p) { return p.step === k; }).length; return n ? '<span style="font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;background:#f8717122;color:#f87171;border:1px solid #f8717166">+' + n + ' new</span>' : ''; })() +
        '<span style="margin-left:auto;font-family:Consolas,monospace;font-size:12px">' + count + '</span></button>';
    });
    return h + '</div>';
  }
  function renderNext() {
    document.getElementById('snnSub').textContent = '';
    if (!loaded) { body.innerHTML = '<div style="color:#64748b;text-align:center;padding:40px 0">Reading your tickets\u2026</div>'; return; }
    if (loadErr) { body.innerHTML = '<div style="color:#f87171;margin-bottom:12px">' + esc(loadErr) + '</div>' + btn('refresh', 'Refresh'); return; }
    var B = buckets(), seen = S.seen[TODAY] || [];
    var focus = S.focus && S.focus.day === TODAY ? S.focus.step : null;
    if (focus && !B[focus].next) { focus = null; delete S.focus; save(); }
    var pend = pendingNew(B), stay = null;
    // the card you're on stays put, even if new tickets arrive in an earlier bucket
    if (S.cur && S.cur.day === TODAY) ORDER.some(function (k) { return B[k].items.some(function (x) { if (x.item.id === S.cur.id && !x.done) { stay = { step: k, entry: x }; return true; } return false; }); });
    var normal = focus || ORDER.filter(function (k) { return B[k].next; })[0] || null;
    function earlier(p, step) { return step && ORDER.indexOf(p.step) < ORDER.indexOf(step); }
    // new arrivals in an earlier bucket than where you are go next (after the card you're on)
    var early = pend.filter(function (p) { return earlier(p, normal); });
    var active = stay ? stay.step : (early.length ? early[0].step : normal);
    if (!stay && early.length && focus) { delete S.focus; }
    var banner = (!stay && lastActive && lastActive !== active && B[lastActive].total && !B[lastActive].next) ? STEP_NAME[lastActive] + ' done.' : '';
    lastActive = active;
    var h = '';
    if (banner) h += '<div style="background:#34d39922;color:#34d399;border-radius:7px;padding:9px 11px;font-size:13px;margin-bottom:10px">\u2713 ' + esc(banner) + (active ? ' On to ' + STEP_NAME[active] + '.' : '') + '</div>';
    var waitingNew = stay ? pend.filter(function (p) { return p.id !== stay.entry.item.id && earlier(p, stay.step); }) : [];
    if (stay && waitingNew.length) {
      var byStep = {}; waitingNew.forEach(function (p) { byStep[p.step] = (byStep[p.step] || 0) + 1; });
      h += '<div style="display:flex;align-items:center;gap:8px;background:#f8717118;border:1px solid #f8717155;color:#fca5a5;border-radius:7px;padding:8px 10px;font-size:13px;margin-bottom:10px"><span style="flex:1">' +
        esc(Object.keys(byStep).map(function (k) { return byStep[k] + ' new in ' + STEP_NAME[k]; }).join(', ')) + '. Up after this card.</span>' +
        '<button data-a="gonew" style="background:none;border:1px solid #f87171;color:#f87171;border-radius:6px;padding:3px 9px;font:inherit;font-size:12px;font-weight:600;cursor:pointer">Go now</button></div>';
    }
    var qo = queueOn(), qAuto = !(S.queue && S.queue.day === TODAY);
    h += '<button data-a="queue" title="Include your group\u2019s unassigned tickets" style="display:flex;align-items:center;gap:8px;width:100%;margin-bottom:10px;padding:6px 9px;border-radius:7px;border:1px solid #2a2a3e;background:none;color:#94a3b8;font:inherit;font-size:12px;cursor:pointer;text-align:left">' +
      '<span style="display:inline-block;width:28px;height:16px;border-radius:999px;position:relative;background:' + (qo ? '#fbbf24' : '#2a2a3e') + '"><span style="position:absolute;top:2px;left:' + (qo ? '14px' : '2px') + ';width:12px;height:12px;border-radius:50%;background:#0f0f1a"></span></span>' +
      '<span style="color:' + (qo ? '#fbbf24' : '#94a3b8') + '">Group queue ' + (qo ? 'on' : 'off') + '</span>' +
      '<span style="margin-left:auto;color:#64748b">' + (qAuto ? (qo ? 'Wednesday' : 'auto on Wednesdays') : 'just for today') + '</span></button>';
    h += stripHtml(B, active);
    if (!active) {
      var hidden = {}; tickets.forEach(function (t) { if (['3', '4', '5', '6', '7', '8'].indexOf(t.lane) >= 0) hidden[LANES[t.lane]] = (hidden[LANES[t.lane]] || 0) + 1; });
      h += '<div style="font-size:18px;font-weight:600;margin-bottom:8px">You\u2019re through the list.</div>' +
        '<div style="color:#94a3b8;line-height:1.6;margin-bottom:12px">Every bucket has had a look today.</div>';
      var tt = tickets.filter(touchedToday).length;
      if (tt) h += '<div style="font-size:12px;color:#34d399;margin-bottom:12px">' + plural(tt, 'ticket') + ' updated today.</div>';
      var hk = Object.keys(hidden);
      if (hk.length) h += '<div style="font-size:12px;color:#64748b;margin-bottom:16px">Not in the walk: ' + hk.map(function (k) { return hidden[k] + ' ' + k; }).join(' \u00b7 ') + '</div>';
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap">' + btn('fresh', '\u21ba Start a fresh pass') + btn('tab-wrap', 'Wrap up the day', GO) + '</div>';
      h += '<div style="margin-top:18px">' + parkedLink() + '</div>';
      body.innerHTML = h; return;
    }
    var cur = stay ? stay.entry : (early.length ? B[active].items.filter(function (x) { return x.item.id === early[0].id; })[0] : B[active].next);
    S.cur = { day: TODAY, id: cur.item.id }; save();
    var it = cur.item, col = STEP_COLOR[cur.step], isTicket = !isItem(it);
    h += '<div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:' + col + ';text-transform:uppercase;margin-bottom:8px">' +
      (cur.step === 'prioritize' ? 'Pick this up for 30 min' : STEP_NAME[cur.step]) + '</div>';
    h += '<div style="border:1px solid ' + col + '66;border-left:4px solid ' + col + ';border-radius:0;background:#1a1a2e;padding:16px;margin-bottom:14px">';
    if (isTicket) {
      h += '<a href="' + esc(BASE + '/' + it.table + '.do?sys_id=' + it.id) + '" target="_blank" rel="noopener" style="font-family:Consolas,monospace;font-size:13px;color:#60a5fa;text-decoration:none">' + esc(it.number) + ' \u2197</a>';
      h += '<div style="font-size:17px;font-weight:600;line-height:1.4;margin:6px 0 10px">' + esc(it.sd) + '</div>';
    } else {
      if (it.label) h += '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#67e8f922;color:#67e8f9;border:1px solid #67e8f955">' + esc(it.label) + '</span>';
      h += '<div style="font-size:17px;font-weight:600;line-height:1.4;margin:8px 0 10px">' + esc(it.title) + '</div>';
    }
    h += '<div style="font-size:13px;color:#cbd5e1"' + (isTicket && it.noteSrc ? ' title="Last update read from the ' + it.noteSrc + '"' : '') + '>' + esc(cur.why) + '</div>';
    if (S.parked && S.parked[it.id] && it.due && !isParked(it)) h += '<div style="font-size:12px;color:#34d399;margin-top:6px">Parked until ' + esc(shortDate(it.due)) + ', back on your list</div>';
    if (isTicket) h += '<div style="font-size:12px;color:#64748b;margin-top:6px">' + esc([LANES[it.lane], it.priority].filter(Boolean).join(' \u00b7 ')) +
      (it.unassigned ? '<div style="margin-top:6px"><span style="white-space:nowrap;font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;background:#fbbf2422;color:#fbbf24;border:1px solid #fbbf2455">Unassigned \u00b7 group queue</span></div>' : '') + '</div>';
    h += '</div>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
    if (isTicket) h += btn('open', 'Open ticket', PRI, it.id) + btn('find', 'Find', null, it.id);
    else h += btn('adone', '\u2713 Done', GO, it.id);
    h += btn('next', 'Next \u2192', null, it.id) + '</div>';
    if (isTicket) h += '<div id="snnFindMsg" style="font-size:12px;margin:-4px 0 8px;min-height:0"></div>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap">' + btn('skip', 'Skip for today', 'border:1px solid #2a2a3e;background:none;color:#94a3b8', it.id);
    h += btn('pin', (S.pin && S.pin[it.id]) ? '\u2b07 Not important' : '\u2b06 Important', 'border:1px solid #2a2a3e;background:none;color:' + ((S.pin && S.pin[it.id]) ? '#f87171' : '#94a3b8'), it.id);
    h += btn('quick', S.quick[it.id] ? '\u2605 Quick win (untag)' : '\u2606 Quick win', 'border:1px solid #2a2a3e;background:none;color:' + (S.quick[it.id] ? '#fb923c' : '#94a3b8'), it.id);
    h += '</div>';
    if (!isTicket) h += '<div style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:12px;color:#94a3b8">Move to ' +
      '<select data-a="movelane" data-id="' + it.id + '" style="padding:5px 7px;background:#1a1a2e;border:1px solid #2a2a3e;border-radius:6px;color:#e2e8f0;font:inherit;font-size:12px;color-scheme:dark">' + laneOptions(itemLane(it)) + '</select></div>';
    {
      var pd = PARK_DATE.split('-');
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px">' +
        btn('park', '\u23f8 Park until ' + (+pd[1]) + '/' + (+pd[2]), 'border:1px solid #2a2a3e;background:none;color:#94a3b8', it.id) +
        '<button data-a="parkother" data-id="' + it.id + '" style="background:none;border:none;color:#64748b;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline">other date</button>' +
        '<span id="snnParkOther" style="display:none;gap:6px;align-items:center"><input type="date" id="snnParkDate" style="padding:5px 7px;background:#1a1a2e;border:1px solid #2a2a3e;border-radius:6px;color:#e2e8f0;font:inherit;font-size:12px;color-scheme:dark">' +
        btn('parkgo', 'Park', 'border:1px solid #2a2a3e;background:none;color:#e2e8f0;padding:5px 10px', it.id) + '</span></div>' +
        '<div id="snnParkMsg" style="font-size:12px;margin-top:6px;min-height:1em"></div>';
    }
    h += '<div style="display:flex;justify-content:space-between;margin-top:22px">' +
      (seen.length ? btn('back', '\u2190 Back', 'border:none;background:none;color:#64748b;padding:4px 0') : '<span></span>') + parkedLink() + '</div>' +
      '<div style="margin-top:6px">' + btn('fresh', '\u21ba Start a fresh pass', 'border:none;background:none;color:#64748b;padding:4px 0;font-weight:400;font-size:12px') + '</div>';
    body.innerHTML = h;
  }
  function parkedLink() {
    var n = tickets.filter(parkedNow).length + S.adhoc.filter(function (a) { return !a.done && isParked(a); }).length;
    return n ? btn('tab-parked', n + ' parked until later \u2192', 'border:none;background:none;color:#64748b;padding:4px 0') : '';
  }
  function renderHelp() {
    document.getElementById('snnSub').textContent = '';
    function sec(title, items) {
      return '<div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:#67e8f9;margin:16px 0 6px">' + title + '</div>' +
        items.map(function (i) { return '<div style="padding:5px 0;line-height:1.45;font-size:13px">' + i + '</div>'; }).join('');
    }
    function b(t) { return '<b style="color:#e2e8f0">' + t + '</b>'; }
    var h = btn('tab-next', '\u2190 Back to Next', 'border:none;background:none;color:#64748b;padding:0 0 4px') +
      '<div style="font-size:16px;font-weight:600;margin:6px 0 2px">How to use</div>' +
      '<div style="font-size:12px;color:#94a3b8">You don\u2019t need to finish the list. One card, one decision.</div>' +
      '<div style="color:#cbd5e1">' +
      sec('EACH CARD', [
        b('15 min or less?') + ' Open it, do one thing, then ' + b('Next') + '.',
        b('Bigger and matters now?') + ' Give it a 30-minute block.',
        b('Not today?') + ' Skip for today.',
        b('After Nashoba?') + ' Park until 2/22.'
      ]) +
      sec('EACH DAY', [
        b('Morning:') + ' clear the <span style="color:#a78bfa">purple</span> and <span style="color:#fbbf24">yellow</span> cards.',
        b('Rest of day:') + ' a few <span style="color:#60a5fa">blue</span> cards.',
        b('End of day:') + ' Wrap up \u2192 copy to OneNote.',
        b('Friday:') + ' Weekly \u2192 copy the Nashoba update.'
      ]) +
      '<div style="font-size:12px;color:#94a3b8;margin-top:16px;padding-top:12px;border-top:1px solid #2a2a3e">A good day = purple and yellow done, plus a couple of blue.</div>' +
      '</div>';
    body.innerHTML = h;
  }
  function renderParked() {
    document.getElementById('snnSub').textContent = '';
    var list = tickets.filter(parkedNow).concat(S.adhoc.filter(function (a) { return !a.done && isParked(a); })).sort(function (a, b) { return a.due < b.due ? -1 : 1; });
    var h = btn('tab-next', '\u2190 Back to Next', 'border:none;background:none;color:#64748b;padding:0 0 12px') +
      '<div style="font-size:16px;font-weight:600;margin-bottom:4px">Parked</div>' +
      '<div style="font-size:12px;color:#94a3b8;margin-bottom:12px">Each one comes back ' + PARK_LEAD + ' days before its due date. Bring back clears the due date.</div>';
    if (!list.length) h += '<div style="color:#64748b">Nothing parked.</div>';
    list.forEach(function (t) {
      var back = new Date(Date.parse(t.due.replace(' ', 'T') + 'Z') - PARK_LEAD * 864e5);
      h += '<div style="padding:9px 0;border-top:1px solid #2a2a3e">' +
        '<div style="display:flex;gap:8px;align-items:baseline">' + (isItem(t) ? '<span style="font-size:12px;color:#67e8f9">' + esc(t.label || 'Your item') + '</span>' : '<a href="' + esc(BASE + '/' + t.table + '.do?sys_id=' + t.id) + '" target="_blank" rel="noopener" style="font-family:Consolas,monospace;font-size:12px;color:#60a5fa;text-decoration:none">' + esc(t.number) + '</a>') +
        '<span style="margin-left:auto;font-size:12px;color:#94a3b8;white-space:nowrap">due ' + esc(shortDate(t.due)) + ' \u00b7 back ' + (back.getMonth() + 1) + '/' + back.getDate() + '</span></div>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-top:3px"><span style="flex:1;font-size:13px">' + esc(isItem(t) ? t.title : t.sd) + '</span>' +
        btn('unpark', 'Bring back', 'border:1px solid #2a2a3e;background:none;color:#e2e8f0;padding:4px 9px;font-size:12px', t.id) + '</div></div>';
    });
    body.innerHTML = h;
  }

  var editingId = null;
  function renderAdd() {
    document.getElementById('snnSub').textContent = '';
    var open = S.adhoc.filter(function (a) { return !a.done; });
    var doneToday = S.adhoc.filter(function (a) { return a.done === TODAY; });
    var h = '<div style="color:#94a3b8;font-size:13px;margin-bottom:10px">Project work that isn\u2019t in ServiceNow. Pick a bucket and it shows up in your walk alongside your tickets until you mark it done.</div>';
    h += '<input id="snnTitle" placeholder="Confirm go-live testing dates" style="' + inp() + 'margin-bottom:8px">';
    h += '<input id="snnLabel" list="snnLabels" placeholder="Project label (optional): Nashoba" style="' + inp() + 'margin-bottom:8px">';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px;color:#94a3b8">Bucket <select id="snnLane" style="flex:1;padding:8px 9px;background:#1a1a2e;border:1px solid #2a2a3e;border-radius:7px;color:#e2e8f0;font:inherit;font-size:13px;color-scheme:dark">' + laneOptions('initial') + '</select></div>';
    h += '<datalist id="snnLabels">' + S.labels.map(function (l) { return '<option value="' + esc(l) + '">'; }).join('') + '</datalist>';
    h += btn('addsave', 'Add', PRI);
    h += '<div id="snnAddMsg" style="font-size:12px;color:#34d399;margin-top:8px;min-height:1em"></div>';
    function itemRow(a, done) {
      if (editingId === a.id) {
        return '<div style="padding:8px 0;border-top:1px solid #2a2a3e">' +
          '<input id="snnEditTitle" value="' + esc(a.title) + '" style="' + inp() + 'margin-bottom:6px">' +
          '<input id="snnEditLabel" list="snnLabels" value="' + esc(a.label || '') + '" placeholder="Project label (optional)" style="' + inp() + 'margin-bottom:6px">' +
          '<select id="snnEditLane" style="' + inp() + 'margin-bottom:6px;color-scheme:dark">' + laneOptions(itemLane(a)) + '</select>' +
          '<div style="display:flex;gap:6px">' + btn('editsave', 'Save', PRI, a.id) + btn('editcancel', 'Cancel', null, a.id) + '</div></div>';
      }
      var ic = 'background:none;border:none;cursor:pointer;font-size:15px;padding:2px 4px;';
      return '<div style="display:flex;align-items:center;gap:6px;padding:8px 0;border-top:1px solid #2a2a3e">' +
        '<span style="flex:1;min-width:0;' + (done ? 'color:#64748b;text-decoration:line-through' : '') + '">' + (a.label ? '<span style="font-size:11px;color:#67e8f9">' + esc(a.label) + '</span> ' : '') + esc(a.title) +
        (done ? '' : '<span style="display:block;font-size:11px;color:#64748b">' + esc((ITEM_LANES.filter(function (l) { return l[0] === itemLane(a); })[0] || ['', ''])[1]) + (isParked(a) ? ' \u00b7 parked until ' + esc(shortDate(a.due)) : '') + '</span>') + '</span>' +
        (done ? '<button data-a="areopen" data-id="' + a.id + '" title="Not done after all" style="' + ic + 'color:#94a3b8;font-size:12px;text-decoration:underline">reopen</button>' :
          '<button data-a="aedit" data-id="' + a.id + '" title="Edit" style="' + ic + 'color:#94a3b8">\u270e</button>' +
          '<button data-a="adone" data-id="' + a.id + '" title="Mark done" style="' + ic + 'color:#34d399">\u2713</button>' +
          '<button data-a="adel" data-id="' + a.id + '" title="Remove" style="' + ic + 'color:#64748b">\u2715</button>') + '</div>';
    }
    if (open.length) {
      h += '<div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:#64748b;margin:16px 0 6px">OPEN ITEMS</div>';
      open.forEach(function (a) { h += itemRow(a, false); });
    }
    if (doneToday.length) {
      h += '<div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:#64748b;margin:16px 0 6px">DONE TODAY</div>';
      doneToday.forEach(function (a) { h += itemRow(a, true); });
    }
    h += '<div style="margin-top:22px;padding-top:12px;border-top:1px solid #2a2a3e;font-size:12px;color:#64748b">Your items are saved in this browser only. ' +
      '<button data-a="backup" style="background:none;border:none;color:#94a3b8;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;padding:0">Back up</button> \u00b7 ' +
      '<button data-a="restore" style="background:none;border:none;color:#94a3b8;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;padding:0">Restore</button>' +
      '<input type="file" id="snnRestoreFile" accept=".json,application/json" style="display:none"></div>';
    body.innerHTML = h;
    if (editingId) {
      var et = document.getElementById('snnEditTitle');
      if (et) { et.focus(); [et, document.getElementById('snnEditLabel')].forEach(function (x) { x.addEventListener('keydown', function (e) { if (e.key === 'Enter') saveEdit(editingId); if (e.key === 'Escape') { editingId = null; renderAdd(); } }); }); }
    } else {
      var t = document.getElementById('snnTitle'); t.focus();
      t.addEventListener('keydown', function (e) { if (e.key === 'Enter') addItem(); });
      document.getElementById('snnLabel').addEventListener('keydown', function (e) { if (e.key === 'Enter') addItem(); });
    }
    document.getElementById('snnRestoreFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var d = JSON.parse(rd.result); if (!d || !d.adhoc) throw new Error('not a What\u2019s Next backup');
          var before = JSON.parse(JSON.stringify(S));
          ['quick', 'skip', 'seen', 'logs'].forEach(function (k) { d[k] = d[k] || {}; }); d.labels = d.labels || []; d.seen[TODAY] = d.seen[TODAY] || [];
          S = d; save(); showUndo('Restored from backup.', function () { S = before; save(); });
          render();
        } catch (e) { var m = document.getElementById('snnAddMsg'); if (m) { m.textContent = 'That file isn\u2019t a What\u2019s Next backup.'; m.style.color = '#f87171'; } }
      };
      rd.readAsText(f);
    });
  }
  function inp() { return 'width:100%;box-sizing:border-box;padding:9px 11px;background:#1a1a2e;border:1px solid #2a2a3e;border-radius:7px;color:#e2e8f0;font:inherit;font-size:14px;outline:none;'; }
  function saveEdit(id) {
    var a = S.adhoc.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    var t = document.getElementById('snnEditTitle').value.trim(), l = document.getElementById('snnEditLabel').value.trim();
    if (!t) { document.getElementById('snnEditTitle').style.borderColor = '#f87171'; return; }
    a.title = t; a.label = l; a.lane = document.getElementById('snnEditLane').value; a.touched = TODAY; if (l && S.labels.indexOf(l) < 0) S.labels.push(l);
    editingId = null; save(); renderAdd();
  }
  var undoFn = null, undoTimer = null;
  function showUndo(msg, fn) {
    undoFn = fn; var bar = document.getElementById('snnUndo');
    document.getElementById('snnUndoMsg').textContent = msg; bar.style.display = 'flex';
    clearTimeout(undoTimer); undoTimer = setTimeout(function () { bar.style.display = 'none'; undoFn = null; }, 8000);
  }
  function backup() {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'whats-next-backup-' + TODAY + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function addItem() {
    var t = document.getElementById('snnTitle'), l = document.getElementById('snnLabel');
    var title = t.value.trim(), label = l.value.trim();
    if (!title) { document.getElementById('snnAddMsg').textContent = 'Type what the item is first.'; document.getElementById('snnAddMsg').style.color = '#f87171'; return; }
    var laneSel = document.getElementById('snnLane');
    var nid = uid(); if (S.known && S.known.day === TODAY) S.known.ids.push(nid);
    S.adhoc.push({ id: nid, title: title, label: label, lane: laneSel ? laneSel.value : 'initial', added: TODAY, done: null });
    if (label && S.labels.indexOf(label) < 0) S.labels.push(label);
    save(); renderAdd();
    document.getElementById('snnAddMsg').textContent = 'Added.';
    document.getElementById('snnLabel').value = label;
  }

  /* ---------------- Wrap up ----------------
     Reads today's activity straight from your tickets (assigned to you, updated today), so it works even
     when the notes table is off-limits: closed tickets show by name, and the text of your notes and comments
     is included. Time buttons (Fibonacci-ish hours) feed the summary and the Friday time list. */
  var HOURS = [0.5, 1, 2, 3, 5, 8];
  function hrs(h) { return h === 0.5 ? '\u00bdh' : (h % 1 ? Math.floor(h) + '\u00bd' : h) + 'h'; }
  function myFullName() {
    var u = null;
    try { u = window.g_user; } catch (e) {}
    for (var i = 0; !u && i < frames.length; i++) { try { u = frames[i].g_user; } catch (e) {} }
    if (!u) return '';
    try { if (u.getFullName) return u.getFullName(); } catch (e) {}
    return u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ');
  }
  // split a journal field's text into entries: {when, author, kind, text}
  function parseJournal(text, kind) {
    var re = /(\d{1,4})[-\/.](\d{1,2})[-\/.](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?\s+-\s+([^\n(]*?)\s*\((Work notes|Additional comments|Comments)\)/gi;
    var heads = [], m;
    while ((m = re.exec(text))) {
      var y, mo, d;
      if (m[1].length === 4) { y = +m[1]; mo = +m[2]; d = +m[3]; } else { mo = +m[1]; d = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
      var h = +m[4]; if (m[7]) { var pm = /p/i.test(m[7]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
      heads.push({ at: m.index, end: re.lastIndex, when: new Date(y, mo - 1, d, h, +m[5], +(m[6] || 0)), author: m[8].trim(), kind: kind });
    }
    return heads.map(function (hd, i) {
      hd.text = text.slice(hd.end, i + 1 < heads.length ? heads[i + 1].at : text.length).replace(/\s+/g, ' ').trim(); return hd;
    });
  }
  var wrapData = null; // cached per open of the tab: {rows, me, err}
  function localMidnightUTC() { var d = new Date(); d.setHours(0, 0, 0, 0); return new Date(d - 864e5 / 6).toISOString().slice(0, 19).replace('T', ' '); }
  function fetchWrap() {
    var me = myFullName();
    var fields = 'sys_id,number,short_description,sys_class_name,state,closed_at,work_notes,comments';
    return q('task', ME + '^sys_updated_on>=' + localMidnightUTC(), fields, 300).then(function (r) {
      var rows = [];
      r.forEach(function (x) {
        var entries = parseJournal(String(dv(x.work_notes) || ''), 'Work note').concat(parseJournal(String(dv(x.comments) || ''), 'Comment'))
          .filter(function (e) { return dkey(e.when) === TODAY && (!me || e.author.toLowerCase() === me.toLowerCase()); })
          .sort(function (a, b) { return a.when - b.when; });
        var state = String(dv(x.state) || '');
        var ca = v(x.closed_at), closedToday = ca && dkey(new Date(Date.parse(ca.replace(' ', 'T') + 'Z'))) === TODAY;
        var closed = !!closedToday && /closed|resolved|complete|cancel/i.test(state);
        if (!entries.length && !closed) return;
        rows.push({ id: v(x.sys_id), number: dv(x.number), sd: dv(x.short_description), state: state, closed: closed,
                    notes: entries.map(function (e) { return e.text; }).filter(Boolean) });
      });
      rows.sort(function (a, b) { return a.number < b.number ? -1 : 1; });
      return { rows: rows, me: me };
    }).catch(function (e) { return { rows: [], me: me, err: e.message || 'error' }; });
  }
  function dayTime() { S.time = S.time || {}; S.time[TODAY] = S.time[TODAY] || {}; return S.time[TODAY]; }
  function timeChips(id) {
    var cur = dayTime()[id];
    return '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">' + HOURS.map(function (h) {
      var on = cur === h;
      return '<button data-a="settime" data-id="' + esc(id) + '" data-h="' + h + '" style="padding:3px 8px;border-radius:999px;font:inherit;font-size:12px;cursor:pointer;border:1px solid ' + (on ? '#67e8f9' : '#2a2a3e') + ';background:' + (on ? '#67e8f9' : 'none') + ';color:' + (on ? '#0f0f1a' : '#94a3b8') + '">' + hrs(h) + '</button>';
    }).join('') + '</div>';
  }
  function wrapItems() {
    var rows = (wrapData && wrapData.rows) || [];
    var t = dayTime();
    var doneAd = S.adhoc.filter(function (a) { return a.done === TODAY; });
    // still-open added items: only ones added today or with time logged today
    var openAd = S.adhoc.filter(function (a) { return !a.done && (a.added === TODAY || t[a.id]); });
    return { rows: rows, doneAd: doneAd, openAd: openAd };
  }
  function buildSummary() {
    var w = wrapItems(), t = dayTime(), total = 0, out = [];
    function tm(id) { var h = t[id]; if (h) { total += h; return ' (' + hrs(h) + ')'; } return ''; }
    var lines = [];
    if (w.rows.length) {
      lines.push('', 'ServiceNow:');
      w.rows.forEach(function (r) {
        lines.push('- ' + r.number + ' ' + r.sd + tm(r.id) + (r.closed ? ' - ' + r.state : ''));
        r.notes.forEach(function (n) { lines.push('    ' + (n.length > 160 ? n.slice(0, 157) + '...' : n)); });
      });
    }
    if (w.doneAd.length) { lines.push('', 'Done:'); w.doneAd.forEach(function (a) { lines.push('- ' + (a.label ? a.label + ': ' : '') + a.title + tm(a.id)); }); }
    if (w.openAd.length) { lines.push('', 'Still open:'); w.openAd.forEach(function (a) { lines.push('- ' + (a.label ? a.label + ': ' : '') + a.title + tm(a.id)); }); }
    var note = ((S.logs[TODAY] || {}).note || '').trim();
    if (note) lines.push('', 'Notes: ' + note);
    out.push(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + (total ? '  (total ' + hrs(total) + ')' : ''));
    if (!lines.length) lines.push('', 'Nothing logged yet today.');
    return out.concat(lines).join('\n');
  }
  function logToday() { S.logs[TODAY] = S.logs[TODAY] || { note: '' }; return S.logs[TODAY]; }
  function renderWrap(useCache) {
    document.getElementById('snnSub').textContent = '';
    if (!useCache || !wrapData) {
      body.innerHTML = '<div style="color:#64748b;text-align:center;padding:40px 0">Pulling today\u2019s activity\u2026</div>';
      fetchWrap().then(function (d) { wrapData = d; if (tab === 'wrap') renderWrap(true); });
      return;
    }
    var w = wrapItems(), log = logToday();
    var h = '<div style="font-size:16px;font-weight:600;margin-bottom:4px">' + new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'numeric', day: 'numeric' }) + '</div>';
    h += '<div style="font-size:12px;color:#94a3b8;margin-bottom:12px">Tap how long each one took. It goes in the summary and your Friday time list.</div>';
    function row(id, top, sub, notes) {
      return '<div style="padding:9px 0;border-top:1px solid #2a2a3e">' + top +
        (sub ? '<div style="font-size:12px;color:#64748b;margin-top:2px">' + sub + '</div>' : '') +
        (notes ? '<div style="font-size:12px;color:#94a3b8;margin-top:3px;line-height:1.4">' + notes + '</div>' : '') + timeChips(id) + '</div>';
    }
    if (w.rows.length) {
      h += '<div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:#60a5fa;margin:4px 0 2px">SERVICENOW</div>';
      w.rows.forEach(function (r) {
        var n = r.notes.length ? esc(r.notes[r.notes.length - 1].slice(0, 110)) + (r.notes[r.notes.length - 1].length > 110 ? '\u2026' : '') : '';
        h += row(r.id, '<div style="font-size:13px"><span style="font-family:Consolas,monospace;color:#60a5fa">' + esc(r.number) + '</span> ' + esc(r.sd) + '</div>',
          r.closed ? esc(r.state) : plural(r.notes.length, 'update'), n);
      });
    }
    var ad = w.doneAd.concat(w.openAd);
    if (ad.length) {
      h += '<div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:#67e8f9;margin:14px 0 2px">YOUR ITEMS</div>';
      ad.forEach(function (a) { h += row(a.id, '<div style="font-size:13px">' + (a.label ? '<span style="color:#67e8f9">' + esc(a.label) + ':</span> ' : '') + esc(a.title) + '</div>', a.done ? 'Done' : 'Still open', ''); });
    }
    if (!w.rows.length && !ad.length) h += '<div style="color:#64748b;font-size:13px;padding:6px 0 4px">No ticket activity from you today yet.</div>';
    if (wrapData.err) h += '<div style="font-size:12px;color:#f87171;margin-top:8px">Couldn\u2019t read today\u2019s tickets (' + esc(wrapData.err) + '). Your own items are still included.</div>';
    else if (!wrapData.me) h += '<div style="font-size:12px;color:#fbbf24;margin-top:8px">Couldn\u2019t tell your name from this page, so notes from anyone today are included.</div>';
    h += '<div style="font-size:12px;color:#94a3b8;margin:16px 0 6px">Anything to add?</div>';
    h += '<textarea id="snnNote" placeholder="Got pulled into a downtime call for an hour" style="' + inp() + 'min-height:56px;resize:vertical;margin-bottom:12px">' + esc(log.note || '') + '</textarea>';
    h += '<div style="display:flex;align-items:baseline;margin-bottom:6px"><span style="font-size:12px;color:#94a3b8">Your summary (edit freely before copying)</span>' +
      '<button data-a="rebuildsum" id="snnRebuild" style="margin-left:auto;background:none;border:none;color:#64748b;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;display:' + (log.edited ? 'inline' : 'none') + '">Rebuild</button></div>';
    h += '<textarea id="snnSum" style="' + inp() + 'min-height:220px;resize:vertical;font-family:Consolas,monospace;font-size:12.5px;line-height:1.55;margin-bottom:10px"></textarea>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' + btn('copysum', 'Copy for OneNote', GO) + '<span id="snnCopied" style="font-size:12px;color:#34d399;display:none">Copied</span></div>';
    var keepScroll = body.scrollTop;
    body.innerHTML = h; body.scrollTop = keepScroll;
    var sum = document.getElementById('snnSum');
    sum.value = log.edited && log.summary != null ? log.summary : buildSummary();
    // your edits to the summary are kept; it stops auto-rebuilding until you click Rebuild
    sum.addEventListener('input', function () { var l = logToday(); l.summary = sum.value; l.edited = true; save(); document.getElementById('snnRebuild').style.display = 'inline'; });
    document.getElementById('snnNote').addEventListener('input', function () {
      var l = logToday(); l.note = this.value; save(); if (!l.edited) sum.value = buildSummary();
    });
  }

  /* Weekly update for one project label, Monday through today */
  function weekStart() { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); }
  /* ---------------- Weekly ----------------
     Project update: this week's project tickets from ServiceNow (short description mentions the project)
     plus your items with that label. Time list: everything you logged time on this week, for Friday. */
  var PROJECT_ALIASES = { nashoba: ['nashoba', 'noshoba', 'nv', 'nashoba valley'] };
  function canonLabel(l) {
    var x = String(l || '').trim().toLowerCase();
    for (var k in PROJECT_ALIASES) if (PROJECT_ALIASES[k].indexOf(x) >= 0) return k.charAt(0).toUpperCase() + k.slice(1);
    return String(l || '').trim();
  }
  function projectWords(label) { var k = canonLabel(label).toLowerCase(); return PROJECT_ALIASES[k] || [k]; }
  function mentions(text, label) {
    var t = String(text || '').toLowerCase();
    return projectWords(label).some(function (w) { return new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(t); });
  }
  var weeklyLabel = null, weekData = null; // weekData cached per open of the tab
  function weekStartUTC() { var d = new Date(weekStart() + 'T00:00:00'); return new Date(d - 864e5 / 6).toISOString().slice(0, 19).replace('T', ' '); }
  function fetchWeek() {
    var me = myFullName(), ws = weekStart();
    return q('task', ME + '^sys_updated_on>=' + weekStartUTC(), 'sys_id,number,short_description,state,closed_at,work_notes,comments', 500).then(function (r) {
      return { me: me, rows: r.map(function (x) {
        var entries = parseJournal(String(dv(x.work_notes) || ''), 'Work note').concat(parseJournal(String(dv(x.comments) || ''), 'Comment'))
          .filter(function (e) { return dkey(e.when) >= ws && (!me || e.author.toLowerCase() === me.toLowerCase()); })
          .sort(function (a, b) { return a.when - b.when; });
        var ca = v(x.closed_at), closedWeek = ca && dkey(new Date(Date.parse(ca.replace(' ', 'T') + 'Z'))) >= ws && /closed|resolved|complete|cancel/i.test(String(dv(x.state) || ''));
        return { id: v(x.sys_id), number: dv(x.number), sd: dv(x.short_description), state: dv(x.state), closed: !!closedWeek, entries: entries };
      }) };
    }).catch(function (e) { return { me: me, rows: [], err: e.message || 'error' }; });
  }
  function weekLabels() {
    var seenL = {}, out = [];
    S.labels.concat(S.adhoc.map(function (a) { return a.label; })).forEach(function (l) { var c = canonLabel(l); if (c && !seenL[c.toLowerCase()]) { seenL[c.toLowerCase()] = 1; out.push(c); } });
    return out;
  }
  function buildWeekly(label) {
    var ws = weekStart(), L = canonLabel(label).toLowerCase();
    var mine = S.adhoc.filter(function (a) { return canonLabel(a.label).toLowerCase() === L; });
    var rows = ((weekData && weekData.rows) || []).filter(function (r) { return mentions(r.sd, label) || mentions(r.number, label); });
    var laneName = function (a) { return (ITEM_LANES.filter(function (l) { return l[0] === itemLane(a); })[0] || ['', ''])[1]; };
    var dayName = function (ymd) { return new Date(ymd + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }); };
    var wsd = new Date(ws + 'T12:00:00');
    var out = [canonLabel(label) + ' \u2014 week of ' + (wsd.getMonth() + 1) + '/' + wsd.getDate(), ''];
    var done = rows.filter(function (r) { return r.closed; }).map(function (r) { return r.number + ' ' + r.sd; })
      .concat(mine.filter(function (a) { return a.done && a.done >= ws; }).map(function (a) { return a.title; }));
    out.push('Done this week:'); out.push.apply(out, done.length ? done.map(function (x) { return '- ' + x; }) : ['- ']);
    var moving = rows.filter(function (r) { return !r.closed && r.entries.length; }).map(function (r) {
      var last = r.entries[r.entries.length - 1].text; return r.number + ' ' + r.sd + (last ? ': ' + (last.length > 140 ? last.slice(0, 137) + '...' : last) : '');
    }).concat(mine.filter(function (a) { return !a.done && itemLane(a) !== 'waiting'; }).map(function (a) {
      return a.title + ' (' + laneName(a) + (a.touched && a.touched >= ws ? ', updated ' + dayName(a.touched) : '') + ')';
    }));
    out.push('', 'In progress:'); out.push.apply(out, moving.length ? moving.map(function (x) { return '- ' + x; }) : ['- ']);
    var notes = Object.keys(S.logs).filter(function (k) { return k >= ws; }).sort()
      .map(function (k) { return S.logs[k].note || ''; }).filter(function (n) { return n && mentions(n, label); });
    if (notes.length) { out.push('', 'Notes from the week:'); notes.forEach(function (n) { out.push('- ' + n); }); }
    var blockers = mine.filter(function (a) { return !a.done && itemLane(a) === 'waiting'; }).map(function (a) { return a.title; });
    out.push('', 'Blockers:'); out.push.apply(out, blockers.length ? blockers.map(function (x) { return '- ' + x; }) : ['- ']);
    out.push('', 'Next week:', '- ');
    return out.join('\n');
  }
  // every id you logged time on this week, summed, with a readable name
  function nameFor(id) {
    var t = byId(id); if (t) return t.number + ' ' + t.sd;
    var a = itemById(id); if (a) return (a.label ? canonLabel(a.label) + ': ' : '') + a.title;
    var r = ((weekData && weekData.rows) || []).filter(function (x) { return x.id === id; })[0]; if (r) return r.number + ' ' + r.sd;
    return (S.names && S.names[id]) || 'Ticket ' + String(id).slice(0, 8);
  }
  function buildTimeList() {
    var ws = weekStart(), tot = {}, sum = 0;
    Object.keys(S.time || {}).filter(function (k) { return k >= ws; }).forEach(function (k) {
      Object.keys(S.time[k]).forEach(function (id) { tot[id] = (tot[id] || 0) + S.time[k][id]; sum += S.time[k][id]; });
    });
    var ids = Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; });
    if (!ids.length) return '';
    var lines = ids.map(function (id) { var n = nameFor(id); if (n.length > 48) n = n.slice(0, 47) + '\u2026'; return n + '  ' + hrs(tot[id]); });
    var w = Math.max.apply(null, lines.map(function (l) { return l.length; }));
    lines = ids.map(function (id, i) { var n = nameFor(id); if (n.length > 48) n = n.slice(0, 47) + '\u2026'; var h = hrs(tot[id]); return n + new Array(Math.max(2, w - n.length - h.length + 1)).join(' ') + ' ' + h; });
    var t = 'Total'; lines.push(t + new Array(Math.max(2, w - t.length - hrs(sum).length + 1)).join(' ') + ' ' + hrs(sum));
    var wsd = new Date(ws + 'T12:00:00');
    return 'Time, week of ' + (wsd.getMonth() + 1) + '/' + wsd.getDate() + '\n\n' + lines.join('\n');
  }
  function timeRows() {
    var ws = weekStart(), tot = {}, sum = 0;
    Object.keys(S.time || {}).filter(function (k) { return k >= ws; }).forEach(function (k) { Object.keys(S.time[k]).forEach(function (id) { tot[id] = (tot[id] || 0) + S.time[k][id]; sum += S.time[k][id]; }); });
    return Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; }).map(function (id) { return [nameFor(id), hrs(tot[id])]; }).concat([['Total', hrs(sum)]]);
  }
  function weekKey(label) { return weekStart() + '|' + canonLabel(label).toLowerCase(); }
  function renderWeekly(useCache) {
    document.getElementById('snnSub').textContent = '';
    if (!useCache || !weekData) {
      body.innerHTML = '<div style="color:#64748b;text-align:center;padding:40px 0">Pulling this week\u2019s activity\u2026</div>';
      fetchWeek().then(function (d) { weekData = d; if (tab === 'weekly') renderWeekly(true); });
      return;
    }
    var labels = weekLabels(), h = '';
    S.weekly = S.weekly || {};
    if (!labels.length) h += '<div style="color:#94a3b8;line-height:1.6;margin-bottom:12px">Add an item with a project label (like Nashoba) on the <b>+ Add</b> tab, and its weekly update will build here.</div>';
    else {
      if (!weeklyLabel || labels.indexOf(canonLabel(weeklyLabel)) < 0) weeklyLabel = labels.indexOf('Nashoba') >= 0 ? 'Nashoba' : labels[0];
      var saved = S.weekly[weekKey(weeklyLabel)];
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + labels.map(function (l) {
        var on = l === weeklyLabel; return '<button data-a="wlabel" data-id="' + esc(l) + '" style="padding:5px 11px;border-radius:999px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;border:1px solid ' + (on ? '#67e8f9' : '#2a2a3e') + ';background:' + (on ? '#67e8f9' : 'none') + ';color:' + (on ? '#0f0f1a' : '#94a3b8') + '">' + esc(l) + '</button>';
      }).join('') + '</div>';
      h += '<div style="display:flex;align-items:baseline;margin-bottom:6px"><span style="font-size:12px;color:#94a3b8">' + esc(weeklyLabel) + ' tickets and items this week. Edit freely, then copy.</span>' +
        '<button data-a="rebuildweek" id="snnRebuildWeek" style="margin-left:auto;background:none;border:none;color:#64748b;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;display:' + (saved && saved.edited ? 'inline' : 'none') + '">Rebuild</button></div>';
      h += '<textarea id="snnWeek" style="' + inp() + 'min-height:280px;resize:vertical;font-family:Consolas,monospace;font-size:12.5px;line-height:1.55;margin-bottom:10px"></textarea>';
      h += '<div style="display:flex;gap:8px;align-items:center">' + btn('copyweek', 'Copy for OneNote', GO) + '<span id="snnCopied" style="font-size:12px;color:#34d399;display:none">Copied</span></div>';
      if (weekData.err) h += '<div style="font-size:12px;color:#f87171;margin-top:8px">Couldn\u2019t read this week\u2019s tickets (' + esc(weekData.err) + '). Your items are still included.</div>';
    }
    var tl = buildTimeList();
    h += '<div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:#67e8f9;margin:22px 0 6px;padding-top:14px;border-top:1px solid #2a2a3e">TIME THIS WEEK</div>';
    if (!tl) h += '<div style="font-size:12px;color:#64748b">No time logged yet. Use the time buttons on Wrap up each day.</div>';
    else {
      h += '<div style="font-size:13px;margin-bottom:10px">' + timeRows().map(function (r, i, all) {
        var last = i === all.length - 1;
        return '<div style="display:flex;gap:10px;padding:5px 0;' + (last ? 'border-top:1px solid #2a2a3e;font-weight:600' : '') + '"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(r[0]) + '">' + esc(r[0]) + '</span><span style="font-family:Consolas,monospace;color:#67e8f9">' + r[1] + '</span></div>';
      }).join('') + '</div>' +
      '<textarea id="snnTime" readonly style="display:none">' + esc(tl) + '</textarea>' +
      '<div style="display:flex;gap:8px;align-items:center">' + btn('copytime', 'Copy time list', null) + '<span id="snnCopiedTime" style="font-size:12px;color:#34d399;display:none">Copied</span></div>';
    }
    var keep = body.scrollTop; body.innerHTML = h; body.scrollTop = keep;
    var wk = document.getElementById('snnWeek');
    if (wk) {
      var sv = S.weekly[weekKey(weeklyLabel)];
      wk.value = sv && sv.edited ? sv.text : buildWeekly(weeklyLabel);
      // your edits are kept for this project and week until you click Rebuild
      wk.addEventListener('input', function () { S.weekly[weekKey(weeklyLabel)] = { text: wk.value, edited: true }; save(); document.getElementById('snnRebuildWeek').style.display = 'inline'; });
    }
  }

  function copy(text) {
    var ok = function () { var m = document.getElementById('snnCopied'); if (m) { m.style.display = 'inline'; setTimeout(function () { m.style.display = 'none'; }, 1600); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { fallback(text); ok(); });
    else { fallback(text); ok(); }
  }
  function fallback(text) { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }

  function parkMsg(t, bad) { var m = document.getElementById('snnParkMsg'); if (m) { m.textContent = t; m.style.color = bad ? '#f87171' : '#34d399'; } }
  function itemById(id) { return S.adhoc.filter(function (x) { return x.id === id; })[0] || null; }
  function park(id, ymd) {
    var t = byId(id), a = t ? null : itemById(id); if (!t && !a) return;
    if (a) {
      if (daysUntil(ymd + ' 17:00:00') <= PARK_LEAD) { parkMsg('Pick a date more than ' + PARK_LEAD + ' days out, or it stays on your list.', true); return; }
      a.due = ymd + ' 17:00:00'; S.parked = S.parked || {}; S.parked[id] = ymd; delete S.cur; save(); render(); return;
    }
    if (daysUntil(ymd + ' 17:00:00') <= PARK_LEAD) { parkMsg('Pick a date more than ' + PARK_LEAD + ' days out, or it stays on your list.', true); return; }
    parkMsg('Setting due date\u2026');
    setDue(t, ymd).then(function () {
      t.due = ymd + ' 17:00:00'; S.parked = S.parked || {}; S.parked[id] = ymd; delete S.cur; save(); render();
    }).catch(function (e) { parkMsg('Couldn\u2019t set the due date (' + e.message + '). Nothing changed.', true); });
  }
  function unpark(id, el) {
    var t = byId(id), a = t ? null : itemById(id);
    if (a) { a.due = ''; if (S.parked) delete S.parked[id]; save(); render(); return; }
    if (!t) return;
    el.textContent = 'Clearing\u2026';
    setDue(t, '').then(function () {
      t.due = ''; if (S.parked) delete S.parked[id]; save(); render();
    }).catch(function (e) { el.textContent = 'Failed (' + e.message + ')'; });
  }

  /* Find on page: scroll to this ticket in the ServiceNow list you have open and highlight its row */
  function findOnPage(id) {
    var t = byId(id); if (!t) return;
    var docs = [document];
    (function addFrames(d, depth) {
      if (depth > 2) return;
      Array.prototype.forEach.call(d.querySelectorAll('iframe'), function (f) {
        try { if (f.contentDocument) { docs.push(f.contentDocument); addFrames(f.contentDocument, depth + 1); } } catch (e) {}
      });
    })(document, 0);
    var hit = null;
    docs.some(function (d) {
      if (!d.body) return false;
      var w = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT, null), n;
      while ((n = w.nextNode())) {
        var el = n.parentElement;
        if (!el || ov.contains(el) || n.nodeValue.indexOf(t.number) < 0) continue;
        if (!el.offsetParent && el.getClientRects().length === 0) continue;
        hit = el.closest('tr, li, [role="row"]') || el; return true;
      }
      return false;
    });
    var msg = document.getElementById('snnFindMsg');
    if (!hit) { if (msg) { msg.textContent = t.number + ' isn\u2019t in the list on screen. Try your ticket list view, or use Open ticket.'; msg.style.color = '#fbbf24'; } return; }
    hit.scrollIntoView({ block: 'center', behavior: 'smooth' });
    var old = { o: hit.style.outline, b: hit.style.backgroundColor, t: hit.style.transition };
    hit.style.transition = 'background-color .4s';
    hit.style.outline = '3px solid #67e8f9'; hit.style.backgroundColor = 'rgba(103,232,249,.28)';
    setTimeout(function () { hit.style.outline = old.o; hit.style.backgroundColor = old.b; setTimeout(function () { hit.style.transition = old.t; }, 450); }, 3500);
    if (msg) { msg.textContent = 'Found ' + t.number + ', highlighted in the list.'; msg.style.color = '#34d399'; }
  }

  ov.addEventListener('change', function (e) {
    var el = e.target;
    if (el.getAttribute && el.getAttribute('data-a') === 'movelane') {
      var a = itemById(el.getAttribute('data-id')); if (!a) return;
      var from = itemLane(a); a.lane = el.value; a.touched = TODAY; save(); render();
      showUndo('Moved to ' + (ITEM_LANES.filter(function (l) { return l[0] === a.lane; })[0] || ['', a.lane])[1] + '.', function () { a.lane = from; save(); });
    }
  });

  /* ---------------- events ---------------- */
  ov.addEventListener('click', function (e) {
    var tb = e.target.closest('[data-tab]'); if (tb) { setTab(tb.getAttribute('data-tab')); return; }
    var el = e.target.closest('[data-a]'); if (!el) return;
    var a = el.getAttribute('data-a'), id = el.getAttribute('data-id');
    var seen = S.seen[TODAY];
    if (['next', 'back', 'skip', 'adone', 'bucket', 'restart', 'fresh', 'gonew', 'pin'].indexOf(a) >= 0) delete S.cur;
    switch (a) {
      case 'queue': S.queue = { day: TODAY, on: !queueOn() }; delete S.cur; S.known = null; save(); loadAll(); break;
      case 'gonew': var pn = pendingNew(buckets()); delete S.focus; lastActive = null; if (pn.length) S.cur = { day: TODAY, id: pn[0].id }; save(); render(); break;
      case 'fresh':
        var prevSeen = (S.seen[TODAY] || []).slice(), prevFocus = S.focus;
        S.seen[TODAY] = []; delete S.focus; lastActive = null; if (S.newIds) S.newIds.ids = []; save(); render();
        showUndo('Fresh pass started. Tickets you updated today still count as done.', function () { S.seen[TODAY] = prevSeen; if (prevFocus) S.focus = prevFocus; save(); });
        break;
      case 'close': ov.remove(); clearInterval(placeTimer); clearInterval(autoTimer); break;
      case 'collapse': S.collapsed = true; save(); place(); break;
      case 'expand': S.collapsed = false; save(); place(); break;
      case 'refresh': if (tab === 'wrap') { wrapData = null; renderWrap(); break; } if (tab === 'weekly') { weekData = null; renderWeekly(); break; } if (!loaded) { loadAll(); break; } document.getElementById('snnSub').textContent = 'Refreshing\u2026'; loadAll(true); break;
      case 'open': var t = byId(id); if (t) window.open(BASE + '/' + t.table + '.do?sys_id=' + t.id, '_blank'); break;
      case 'next': if (seen.indexOf(id) < 0) seen.push(id); save(); render(); break;
      case 'back': seen.pop(); save(); render(); break;
      case 'skip': S.skip[id] = TODAY; save(); render(); break;
      case 'quick': if (S.quick[id]) delete S.quick[id]; else S.quick[id] = TODAY; save(); render(); break;
      case 'park': park(id, PARK_DATE); break;
      case 'parkother': var po = document.getElementById('snnParkOther'); po.style.display = po.style.display === 'none' ? 'inline-flex' : 'none'; break;
      case 'parkgo': var dv2 = document.getElementById('snnParkDate').value; if (!dv2) { parkMsg('Pick a date first.', true); break; } park(id, dv2); break;
      case 'unpark': unpark(id, el); break;
      case 'tab-parked': setTab('parked'); break;
      case 'tab-next': setTab('next'); break;
      case 'find': findOnPage(id); break;
      case 'tab-help': setTab(tab === 'help' ? 'next' : 'help'); break;
      case 'restart': S.seen[TODAY] = []; delete S.focus; lastActive = null; save(); render(); break;
      case 'bucket': var bb = buckets()[id]; if (bb && bb.next) { S.focus = { day: TODAY, step: id }; lastActive = id; save(); render(); } break;
      case 'adone': var ad1 = S.adhoc.filter(function (x) { return x.id === id; })[0]; if (ad1) { ad1.done = TODAY; save(); render(); showUndo('Marked \u201c' + ad1.title + '\u201d done.', function () { ad1.done = null; save(); }); } break;
      case 'pin': S.pin = S.pin || {}; if (S.pin[id]) delete S.pin[id]; else { S.pin[id] = new Date().toISOString(); S.focus = { day: TODAY, step: 'top' }; lastActive = 'top'; } save(); render(); break;
      case 'areopen': S.adhoc.forEach(function (x) { if (x.id === id) x.done = null; }); save(); render(); break;
      case 'aedit': editingId = id; renderAdd(); break;
      case 'editsave': saveEdit(id); break;
      case 'editcancel': editingId = null; renderAdd(); break;
      case 'undo': if (undoFn) { undoFn(); undoFn = null; } document.getElementById('snnUndo').style.display = 'none'; render(); break;
      case 'backup': backup(); break;
      case 'restore': document.getElementById('snnRestoreFile').click(); break;
      case 'adel': var idx = -1; S.adhoc.forEach(function (x, i) { if (x.id === id) idx = i; }); if (idx >= 0) { var gone = S.adhoc.splice(idx, 1)[0]; save(); render(); showUndo('Removed \u201c' + gone.title + '\u201d.', function () { S.adhoc.splice(idx, 0, gone); save(); }); } break;
      case 'addsave': addItem(); break;
      case 'tab-wrap': setTab('wrap'); break;
      case 'copysum': copy(document.getElementById('snnSum').value); break;
      case 'settime': S.names = S.names || {}; var wr = ((wrapData && wrapData.rows) || []).filter(function (x) { return x.id === id; })[0]; if (wr) S.names[id] = wr.number + ' ' + wr.sd; var dt = dayTime(), hh = parseFloat(el.getAttribute('data-h')); if (dt[id] === hh) delete dt[id]; else dt[id] = hh; save(); renderWrap(true); break;
      case 'rebuildsum': var lt = logToday(); lt.edited = false; delete lt.summary; save(); renderWrap(true); break;
      case 'copyweek': copy(document.getElementById('snnWeek').value); break;
      case 'wlabel': weeklyLabel = id; renderWeekly(true); break;
      case 'rebuildweek': if (S.weekly) delete S.weekly[weekKey(weeklyLabel)]; save(); renderWeekly(true); break;
      case 'copytime': (function () { var m = document.getElementById('snnCopiedTime'); var t = document.getElementById('snnTime').value; var ok = function () { m.style.display = 'inline'; setTimeout(function () { m.style.display = 'none'; }, 1600); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { fallback(t); ok(); }); else { fallback(t); ok(); } })(); break;
    }
  });

  place();
  setTab('next');
  loadAll();
})();
