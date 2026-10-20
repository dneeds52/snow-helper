(function(){
var gf = window.g_form || null;
if (!gf) {
  for (var i = 0; i < frames.length; i++) {
    try { if (frames[i].g_form) { gf = frames[i].g_form; break; } } catch(e) {}
  }
}
if (!gf) { alert('Open a ticket first.'); return; }

if (document.getElementById('councilOverlay')) {
  document.getElementById('councilOverlay').remove(); return;
}

var num = gf.getValue('number') || 'Ticket';
var sd  = gf.getValue('short_description') || '';

var SITES = ['UNV','MEM','MARL','HALC','CLIN','HHSB','HHWEB','MRMC','NV'];

var ov = document.createElement('div');
ov.id = 'councilOverlay';
ov.style.cssText = 'position:fixed;top:120px;left:50%;transform:translateX(-50%);width:420px;background:#0f0f1a;color:#e2e8f0;z-index:999999;font-family:system-ui,sans-serif;border-radius:12px;border:2px solid #a78bfa;box-shadow:0 8px 32px rgba(0,0,0,.6);padding:0';

var html = '';
/* header — draggable */
html += '<div id="councilHeader" style="padding:14px 18px;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:10px 10px 0 0;border-bottom:1px solid #2a2a3e;cursor:grab;user-select:none">';
html += '<div style="display:flex;justify-content:space-between;align-items:center">';
html += '<div style="font-size:16px;font-weight:700;color:#a78bfa">🏛️ PC Approval</div>';
html += '<button id="councilClose" style="background:none;border:1px solid #2a2a3e;color:#94a3b8;padding:3px 10px;border-radius:5px;cursor:pointer;font:inherit;font-size:14px">✕</button></div>';
html += '<div style="font-size:15px;color:#67e8f9;margin-top:5px">' + num + '</div>';
html += '<div style="font-size:15px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + sd.replace(/"/g, '&quot;') + '">' + sd.replace(/</g, '&lt;') + '</div>';
html += '</div>';

/* site chips */
html += '<div style="padding:14px 18px">';
html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';

SITES.forEach(function(s, idx) {
  html += '<label id="councilRow' + idx + '" style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:#1a1a2e;border:2px solid #2a2a3e;border-radius:8px;cursor:pointer;transition:all .15s;user-select:none">';
  html += '<input type="checkbox" class="councilCk" data-code="' + s + '" style="accent-color:#34d399;width:18px;height:18px;flex:none;margin:0">';
  html += '<span style="font-weight:700;font-size:15px;color:#e2e8f0">' + s + '</span>';
  html += '</label>';
});

html += '</div>';

/* counter */
html += '<div id="councilCount" style="text-align:center;margin:14px 0 10px;font-size:18px;font-weight:700;color:#64748b">0 / ' + SITES.length + '</div>';

/* action buttons */
html += '<div style="display:flex;gap:8px">';
html += '<button id="councilAll" style="flex:1;padding:8px;border-radius:6px;border:1px solid #a78bfa;background:none;color:#a78bfa;font:inherit;font-size:14px;cursor:pointer">All</button>';
html += '<button id="councilClear" style="flex:1;padding:8px;border-radius:6px;border:1px solid #2a2a3e;background:none;color:#94a3b8;font:inherit;font-size:14px;cursor:pointer">Clear</button>';
html += '<button id="councilCopy" style="flex:1;padding:8px;border-radius:6px;border:1px solid #34d399;background:#34d399;color:#0f0f1a;font:inherit;font-size:14px;font-weight:600;cursor:pointer">Copy</button>';
html += '<button id="councilNote" style="flex:1;padding:8px;border-radius:6px;border:1px solid #67e8f9;background:none;color:#67e8f9;font:inherit;font-size:14px;cursor:pointer">Work Note</button>';
html += '</div>';

html += '</div>';
ov.innerHTML = html;
document.body.appendChild(ov);

/* --- Drag logic --- */
var hdr = document.getElementById('councilHeader');
var dragging = false, dx = 0, dy = 0;
hdr.addEventListener('mousedown', function(e) {
  if (e.target.id === 'councilClose') return;
  dragging = true;
  var rect = ov.getBoundingClientRect();
  dx = e.clientX - rect.left;
  dy = e.clientY - rect.top;
  ov.style.transform = 'none';
  ov.style.left = rect.left + 'px';
  ov.style.top = rect.top + 'px';
  hdr.style.cursor = 'grabbing';
  e.preventDefault();
});
document.addEventListener('mousemove', function(e) {
  if (!dragging) return;
  ov.style.left = (e.clientX - dx) + 'px';
  ov.style.top = (e.clientY - dy) + 'px';
});
document.addEventListener('mouseup', function() {
  if (dragging) { dragging = false; hdr.style.cursor = 'grab'; }
});

/* --- Wire up --- */
function updateCount() {
  var checks = ov.querySelectorAll('.councilCk');
  var n = 0;
  checks.forEach(function(c, idx) {
    var row = document.getElementById('councilRow' + idx);
    if (c.checked) {
      n++;
      row.style.borderColor = '#34d399';
      row.style.background = '#0f2a1a';
    } else {
      row.style.borderColor = '#2a2a3e';
      row.style.background = '#1a1a2e';
    }
  });
  document.getElementById('councilCount').textContent = n + ' / ' + SITES.length;
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
  lines.push('PC Approval — ' + num + ' ' + sd);
  if (approved.length) lines.push('✓ Approved: ' + approved.join(', '));
  if (pending.length)  lines.push('✗ Pending:  ' + pending.join(', '));
  lines.push(approved.length + '/' + SITES.length + ' sites approved');
  return lines.join('\n');
}

document.getElementById('councilCopy').onclick = function() {
  var btn = this;
  navigator.clipboard.writeText(buildSummary()).then(function() {
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
  });
};

document.getElementById('councilNote').onclick = function() {
  var btn = this;
  try {
    gf.setValue('work_notes', buildSummary());
    btn.textContent = 'Done!';
    btn.style.background = '#67e8f9';
    btn.style.color = '#0f0f1a';
    setTimeout(function() {
      btn.textContent = 'Work Note';
      btn.style.background = 'none';
      btn.style.color = '#67e8f9';
    }, 1500);
  } catch(e) {
    btn.textContent = 'Failed';
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
