(function(){
/* --- Session --- */
var gf = window.g_form || null;
if (!gf) {
  for (var i = 0; i < frames.length; i++) {
    try { if (frames[i].g_form) { gf = frames[i].g_form; break; } } catch(e) {}
  }
}
if (!gf) { alert('Open a ticket first.'); return; }

/* toggle off if already open */
if (document.getElementById('councilOverlay')) {
  document.getElementById('councilOverlay').remove(); return;
}

var num = gf.getValue('number') || 'Ticket';
var sd  = gf.getValue('short_description') || '';

var SITES = [
  { code: 'UNV',   name: 'University' },
  { code: 'MEM',   name: 'Memorial' },
  { code: 'MARL',  name: 'Marlborough' },
  { code: 'HALC',  name: 'HealthAlliance Leominster' },
  { code: 'CLIN',  name: 'Clinton' },
  { code: 'HHSB',  name: 'Harrington Southbridge' },
  { code: 'HHWEB', name: 'Harrington Webster' },
  { code: 'MRMC',  name: 'Milford' },
  { code: 'NV',    name: 'Nashoba Valley' },
  { code: 'UC',    name: 'Urgent Care' }
];

/* --- Build overlay --- */
var ov = document.createElement('div');
ov.id = 'councilOverlay';
ov.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:420px;max-height:90vh;overflow-y:auto;background:#0f0f1a;color:#e2e8f0;z-index:999999;font-family:system-ui,sans-serif;border-radius:12px;border:2px solid #a78bfa;box-shadow:0 8px 32px rgba(0,0,0,.6);padding:0';

var html = '';
/* header */
html += '<div style="padding:14px 18px;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:10px 10px 0 0;border-bottom:1px solid #2a2a3e">';
html += '<div style="display:flex;justify-content:space-between;align-items:center">';
html += '<div style="font-size:1rem;font-weight:700;color:#a78bfa;letter-spacing:.04em">🏛️ Partnership Council</div>';
html += '<button id="councilClose" style="background:none;border:1px solid #2a2a3e;color:#94a3b8;padding:4px 10px;border-radius:6px;cursor:pointer;font:inherit;font-size:.85rem">✕</button></div>';
html += '<div style="font-size:.85rem;color:#67e8f9;margin-top:6px">' + num + '</div>';
html += '<div style="font-size:.9rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + sd.replace(/"/g, '&quot;') + '">' + sd.replace(/</g, '&lt;') + '</div>';
html += '</div>';

/* site checklist */
html += '<div style="padding:14px 18px">';
html += '<div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:10px;font-weight:600">Site Approval</div>';

SITES.forEach(function(s, idx) {
  var bg = idx % 2 === 0 ? '#1a1a2e' : '#151525';
  html += '<label id="councilRow' + idx + '" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:' + bg + ';border:1px solid #2a2a3e;border-radius:8px;margin-bottom:4px;cursor:pointer;transition:background .15s">';
  html += '<input type="checkbox" class="councilCk" data-code="' + s.code + '" style="accent-color:#34d399;width:18px;height:18px;flex:none">';
  html += '<span style="font-weight:600;color:#e2e8f0;min-width:52px">' + s.code + '</span>';
  html += '<span style="color:#94a3b8;font-size:.88rem">' + s.name + '</span>';
  html += '<span class="councilStatus" style="margin-left:auto;font-size:.8rem;color:#64748b">—</span>';
  html += '</label>';
});

/* counter */
html += '<div id="councilCount" style="text-align:center;margin:14px 0 6px;font-size:1.3rem;font-weight:700;color:#34d399">0 / ' + SITES.length + ' approved</div>';

/* action buttons */
html += '<div style="display:flex;gap:8px;margin-top:10px">';
html += '<button id="councilAll" style="flex:1;padding:8px;border-radius:6px;border:1px solid #a78bfa;background:none;color:#a78bfa;font:inherit;font-size:.85rem;cursor:pointer">Select All</button>';
html += '<button id="councilClear" style="flex:1;padding:8px;border-radius:6px;border:1px solid #2a2a3e;background:none;color:#94a3b8;font:inherit;font-size:.85rem;cursor:pointer">Clear All</button>';
html += '<button id="councilCopy" style="flex:1;padding:8px;border-radius:6px;border:1px solid #34d399;background:#34d399;color:#0f0f1a;font:inherit;font-size:.85rem;font-weight:600;cursor:pointer">Copy Summary</button>';
html += '</div>';

/* work note button */
html += '<button id="councilNote" style="width:100%;margin-top:8px;padding:8px;border-radius:6px;border:1px solid #67e8f9;background:none;color:#67e8f9;font:inherit;font-size:.85rem;cursor:pointer">Paste as Work Note</button>';

html += '</div>';
ov.innerHTML = html;
document.body.appendChild(ov);

/* --- Wire up --- */
function updateCount() {
  var checks = ov.querySelectorAll('.councilCk');
  var n = 0;
  checks.forEach(function(c, idx) {
    var st = ov.querySelectorAll('.councilStatus')[idx];
    var row = document.getElementById('councilRow' + idx);
    if (c.checked) {
      n++;
      st.textContent = '✓ Approved';
      st.style.color = '#34d399';
      row.style.borderColor = '#34d399';
    } else {
      st.textContent = '—';
      st.style.color = '#64748b';
      row.style.borderColor = '#2a2a3e';
    }
  });
  document.getElementById('councilCount').textContent = n + ' / ' + SITES.length + ' approved';
  document.getElementById('councilCount').style.color = n === SITES.length ? '#34d399' : (n > 0 ? '#fbbf24' : '#64748b');
}

ov.addEventListener('change', function(e) {
  if (e.target.classList.contains('councilCk')) updateCount();
});

document.getElementById('councilClose').onclick = function() { ov.remove(); };

document.getElementById('councilAll').onclick = function() {
  ov.querySelectorAll('.councilCk').forEach(function(c) { c.checked = true; });
  updateCount();
};

document.getElementById('councilClear').onclick = function() {
  ov.querySelectorAll('.councilCk').forEach(function(c) { c.checked = false; });
  updateCount();
};

function buildSummary() {
  var approved = [], pending = [];
  ov.querySelectorAll('.councilCk').forEach(function(c) {
    var code = c.getAttribute('data-code');
    if (c.checked) approved.push(code);
    else pending.push(code);
  });
  var lines = [];
  lines.push('Partnership Council — Site Approval');
  lines.push(num + ' ' + sd);
  lines.push('');
  if (approved.length) lines.push('✓ Approved: ' + approved.join(', '));
  if (pending.length)  lines.push('✗ Pending:  ' + pending.join(', '));
  lines.push('');
  lines.push(approved.length + ' / ' + SITES.length + ' sites approved');
  return lines.join('\n');
}

document.getElementById('councilCopy').onclick = function() {
  var btn = this;
  navigator.clipboard.writeText(buildSummary()).then(function() {
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy Summary'; }, 1500);
  });
};

document.getElementById('councilNote').onclick = function() {
  var btn = this;
  try {
    gf.setValue('work_notes', buildSummary());
    btn.textContent = 'Added to Work Notes!';
    btn.style.background = '#67e8f9';
    btn.style.color = '#0f0f1a';
    setTimeout(function() {
      btn.textContent = 'Paste as Work Note';
      btn.style.background = 'none';
      btn.style.color = '#67e8f9';
    }, 2000);
  } catch(e) {
    btn.textContent = 'Failed — ' + e;
  }
};

/* confetti on all approved */
ov.addEventListener('change', function() {
  var all = ov.querySelectorAll('.councilCk');
  var n = 0; all.forEach(function(c) { if (c.checked) n++; });
  if (n === SITES.length) {
    var c = ['#a78bfa','#67e8f9','#f59e0b','#34d399','#f87171','#fb923c','#60a5fa'];
    for (var j = 0; j < 30; j++) {
      var e = document.createElement('div');
      e.style.cssText = 'position:fixed;pointer-events:none;z-index:9999999;width:'+(Math.random()*8+4)+'px;height:'+(Math.random()*8+4)+'px;background:'+c[Math.floor(Math.random()*c.length)]+';border-radius:'+(Math.random()>.5?'50%':'2px')+';left:'+(Math.random()*window.innerWidth)+'px;top:'+(Math.random()*window.innerHeight*.5+window.innerHeight*.25)+'px;opacity:1;transition:none';
      document.body.appendChild(e);
      var tx=(Math.random()-.5)*300,ty=(Math.random()-1)*300,r=Math.random()*720-360;
      setTimeout(function(el,x,y,ro){el.style.transition='transform 1s ease-out,opacity 1s ease-out';el.style.transform='translate('+x+'px,'+y+'px) rotate('+ro+'deg)';el.style.opacity='0';setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el)},1100)},10,e,tx,ty,r);
    }
  }
});
})()
