/* SNOW Helper Menu — loaded by a single bookmarklet from any SN page.
   Hosted at: https://dneeds52.github.io/snow-helper/snow-helper-menu.js
   Bookmarklet: javascript:(function(){if(document.getElementById('snMenu')){document.getElementById('snMenu').remove();return}var s=document.createElement('script');s.src='https://dneeds52.github.io/snow-helper/snow-helper-menu.js?t='+Date.now();document.body.appendChild(s)})();
*/
(function(){
if(document.getElementById('snMenu')){document.getElementById('snMenu').remove();return}

var tok=window.g_ck||'';
var gf=window.g_form||null;
if(!gf){try{for(var i=0;i<frames.length;i++){if(frames[i].g_form){gf=frames[i].g_form;tok=frames[i].g_ck||tok;break}}}catch(e){}}

var Q='b0f881a7db916e00cdb372fc0f961973';
var OWNERS='5bcef6801bfb4950d96b531b234bcbb3,542e894edbddaa00cdb372fc0f961903,042e494edbddaa00cdb372fc0f9619cc,2e0e454edbddaa00cdb372fc0f9619c3';

function api(m,u,b){return fetch(u,{method:m,headers:{'Content-Type':'application/json',Accept:'application/json','X-UserToken':tok},body:b?JSON.stringify(b):undefined}).then(function(r){return r.json()})}

function confetti(){var c=['#a78bfa','#67e8f9','#f59e0b','#34d399','#f87171','#fb923c','#60a5fa'];for(var i=0;i<30;i++){var e=document.createElement('div');e.style.cssText='position:fixed;pointer-events:none;z-index:999999;width:'+(Math.random()*8+4)+'px;height:'+(Math.random()*8+4)+'px;background:'+c[Math.floor(Math.random()*c.length)]+';border-radius:'+(Math.random()>.5?'50%':'2px')+';left:'+(Math.random()*window.innerWidth)+'px;top:'+(Math.random()*window.innerHeight*.5+window.innerHeight*.25)+'px;opacity:1;transition:none';document.body.appendChild(e);var tx=(Math.random()-.5)*300,ty=(Math.random()-1)*300,r=Math.random()*720-360;setTimeout(function(el,x,y,ro){el.style.transition='transform 1s ease-out,opacity 1s ease-out';el.style.transform='translate('+x+'px,'+y+'px) rotate('+ro+'deg)';el.style.opacity='0';setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el)},1100)},10,e,tx,ty,r)}}

function flash(btn,msg){var old=btn.textContent;btn.textContent=msg;btn.style.borderColor='#34d399';btn.style.color='#34d399';setTimeout(function(){btn.textContent=old;btn.style.borderColor='#2a2a3e';btn.style.color='#e2e8f0'},1500)}

/* ===== TOOL FUNCTIONS ===== */

function grabTicket(btn){
  if(!gf){flash(btn,'No ticket open');return}
  var sd=gf.getValue('short_description')||'';
  var desc=gf.getValue('description')||'';
  var txt=(sd+(desc?'\n'+desc:'')).trim();
  if(!txt){flash(btn,'No content');return}
  if(tok&&gf.getUniqueValue()){
    fetch('/api/now/table/sys_journal_field?sysparm_query=element_id='+gf.getUniqueValue()+'^elementINwork_notes,comments^ORDERBYDESCsys_created_on&sysparm_limit=20&sysparm_fields=element,value,sys_created_on,sys_created_by',{headers:{Accept:'application/json','X-UserToken':tok}}).then(function(r){return r.json()}).then(function(j){
      var a=(j.result||[]).map(function(e){return'['+(e.element==='work_notes'?'WN':'C')+' '+e.sys_created_on.substring(0,10)+' '+e.sys_created_by+'] '+e.value});
      navigator.clipboard.writeText(txt+(a.length?'\n\n--- ACTIVITY ---\n'+a.join('\n'):'')).then(function(){confetti();flash(btn,'Copied!')});
    }).catch(function(){navigator.clipboard.writeText(txt).then(function(){confetti();flash(btn,'Copied!')})});
  }else{navigator.clipboard.writeText(txt).then(function(){confetti();flash(btn,'Copied!')})}
}

function saveTicket(btn){
  if(!gf){flash(btn,'No ticket open');return}
  var num=gf.getValue('number')||'';
  var sd=gf.getValue('short_description')||'';
  var fname=(num+(sd?' '+sd:'')).replace(/[\\/:*?"<>|.]/g,'').replace(/\s+/g,' ').trim()||'ticket';
  navigator.clipboard.writeText(fname).then(function(){confetti();flash(btn,'Copied!')});
}

function copyTicket(btn){
  if(!gf){flash(btn,'No ticket open');return}
  var num=gf.getValue('number')||'';
  var sd=gf.getValue('short_description')||'';
  var sysId=gf.getUniqueValue()||'';
  var tbl=gf.getTableName()||'sc_task';
  var link=location.origin+'/nav_to.do?uri='+tbl+'.do?sys_id='+sysId;
  var text=num+' '+sd+'\n'+link;
  navigator.clipboard.writeText(text).then(function(){confetti();flash(btn,'Copied!')});
}

function emailTicket(btn){
  if(!gf){flash(btn,'No ticket open');return}
  var num=gf.getValue('number')||'';
  var sd=gf.getValue('short_description')||'';
  var desc=gf.getValue('description')||'';
  var sysId=gf.getUniqueValue()||'';
  var tbl=gf.getTableName()||'sc_task';
  var link=location.origin+'/nav_to.do?uri='+tbl+'.do?sys_id='+sysId;
  var reqName='';
  try{reqName=gf.getDisplayValue('requested_for')||gf.getDisplayValue('caller_id')||''}catch(e){}
  var fn=(reqName.split(' ')[0])||'there';
  var reqNum='';
  try{reqNum=gf.getDisplayValue('request')||''}catch(e){}
  var nl='\r\n';
  var subj=reqNum?(reqNum+' / '+num+' '+sd):(num+' '+sd);
  var body='Hi '+fn+'!'+nl+nl+'=== EMAIL INTRO GOES HERE ==='+nl+nl+'________________________________________'+nl+nl+num+' '+sd+nl+link+nl+nl+'Description:'+nl+nl+desc+nl+'________________________________________'+nl+nl;
  navigator.clipboard.writeText('SUBJECT: '+subj+nl+nl+body).then(function(){confetti();flash(btn,'Copied!')});
}

function cleanTicket(btn){
  if(!gf){flash(btn,'No ticket open');return}
  var desc=gf.getValue('description')||'';
  var nl='\n';
  var t='--- ADDITIONAL INFO NEEDED ---'+nl+'Department: '+nl+'Epic Security Template: '+nl+'Steps To Reproduce:'+nl+'  1. '+nl+'  2. '+nl+'  3. '+nl+nl+'--- ORIGINAL DESCRIPTION ---'+nl+desc;
  gf.setValue('description',t);
  var sd=gf.getValue('short_description')||'';
  gf.setValue('short_description',sd.replace(/\w\S*/g,function(w){return w.charAt(0).toUpperCase()+w.substr(1)}));
  flash(btn,'Done!');
}

function fillTriage(btn){
  var p=prompt('Paste Triage Tagger payload:');
  if(!p)return;
  var d;try{d=JSON.parse(p)}catch(e){flash(btn,'Bad JSON');return}
  if(!gf){flash(btn,'No ticket open');return}
  var out=[];
  try{gf.setValue('short_description',d.short_description);out.push('Short desc: OK')}catch(e){out.push('Short desc: FAIL')}
  try{gf.setValue('description',d.description);out.push('Description: OK')}catch(e){out.push('Description: FAIL')}
  (d.extras||[]).forEach(function(x){try{gf.setValue(x.field,x.value);out.push(x.field.slice(0,20)+': set')}catch(e){out.push(x.field.slice(0,20)+': FAIL')}});
  if(d.set_ranking_from_order){try{var ord=gf.getValue('order')||'';var ones=ord.replace(/\D/g,'').slice(-1);if(ones){gf.setValue('u_ranking',ones);out.push('Ranking: '+ones)}}catch(e){}}
  if(d.ci){api('GET','/api/now/table/cmdb_ci?sysparm_limit=1&sysparm_fields=sys_id,name&sysparm_query=name='+encodeURIComponent(d.ci)).then(function(r){var rec=r.result&&r.result[0];if(rec){gf.setValue('cmdb_ci',rec.sys_id,rec.name);out.push('CI: '+rec.name)}}).catch(function(){})}
  if(d.tags&&d.tags.length&&tok&&gf.getUniqueValue()){
    var tbl=gf.getTableName(),key=gf.getUniqueValue();
    Promise.all(d.tags.map(function(name){
      return api('GET','/api/now/table/label?sysparm_limit=5&sysparm_fields=sys_id,name&sysparm_query=name='+encodeURIComponent(name)+'%5EownerIN'+OWNERS).then(function(r){
        var l=r.result&&r.result[0];
        if(!l)return api('GET','/api/now/table/label?sysparm_limit=5&sysparm_fields=sys_id,name&sysparm_query=nameLIKE'+encodeURIComponent(name)).then(function(r2){var l2=r2.result&&r2.result[0];if(!l2)throw 0;return api('POST','/api/now/table/label_entry',{label:l2.sys_id,table:tbl,table_key:key})});
        return api('POST','/api/now/table/label_entry',{label:l.sys_id,table:tbl,table_key:key})
      }).then(function(){return name+': applied'}).catch(function(){return name+': FAILED'})
    })).then(function(res){out=out.concat(res);alert(out.join('\n'))});
  }else{alert(out.join('\n'))}
}

function staleCheck(btn){
  if(!tok){flash(btn,'No SN session');return}
  flash(btn,'Checking...');
  var d=new Date();d.setDate(d.getDate()-7);
  var y=d.getFullYear(),mo=String(d.getMonth()+1).padStart(2,'0'),da=String(d.getDate()).padStart(2,'0');
  var hr=String(d.getHours()).padStart(2,'0'),mi=String(d.getMinutes()).padStart(2,'0'),se=String(d.getSeconds()).padStart(2,'0');
  var cutoff=y+'-'+mo+'-'+da+' '+hr+':'+mi+':'+se;
  var q='active=true^assignment_group='+Q+'^orderBETWEEN50@59^sys_updated_on<'+cutoff;
  var f='sys_id,number,short_description,order,sys_updated_on';
  Promise.all([
    api('GET','/api/now/table/sc_task?sysparm_query='+encodeURIComponent(q)+'&sysparm_fields='+f+'&sysparm_display_value=true&sysparm_limit=100'),
    api('GET','/api/now/table/incident?sysparm_query='+encodeURIComponent(q)+'&sysparm_fields='+f+'&sysparm_display_value=true&sysparm_limit=100'),
    api('GET','/api/now/table/change_request?sysparm_query='+encodeURIComponent(q)+'&sysparm_fields='+f+'&sysparm_display_value=true&sysparm_limit=100')
  ]).then(function(results){
    var items=[];results.forEach(function(r){if(r.result){r.result.forEach(function(t){items.push(t)})}});
    if(!items.length){flash(btn,'All clear!');return}
    var lines=items.map(function(t,i){var upd=(t.sys_updated_on||'unknown');if(upd.length>10)upd=upd.substring(0,10);return(i+1)+'. '+t.number+'\n   Order: '+(t.order||'?')+' | Updated: '+upd+'\n   '+(t.short_description||'').substring(0,50)});
    if(!confirm('Found '+items.length+' stale blocked item(s) (not updated since '+cutoff.substring(0,10)+'):\n\n'+lines.join('\n\n')+'\n\nOK = move to Update Needed\nCancel = leave as is'))return;
    Promise.all(items.map(function(t){var digits=(t.order||'50').toString().replace(/\D/g,'')||'50';var nw='1'+digits.slice(-1);
      var tbl=/^INC/.test(t.number)?'incident':(/^CHG/.test(t.number)?'change_request':'sc_task');
      return api('PATCH','/api/now/table/'+tbl+'/'+t.sys_id,{order:nw}).then(function(){return t.number+': done'}).catch(function(){return t.number+': FAILED'})})).then(function(res){alert('Done:\n\n'+res.join('\n'))});
  }).catch(function(e){flash(btn,'Error: '+e)});
}

/* ===== BUILD THE MENU ===== */

var menu=document.createElement('div');
menu.id='snMenu';
menu.style.cssText='position:fixed;top:10px;right:20px;z-index:99999;background:#1a1a2e;border:1px solid #a78bfa;border-radius:12px;padding:14px;min-width:240px;width:260px;font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.6);resize:both;overflow:auto';

menu.innerHTML='<div id="snMenuHdr" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;cursor:move;user-select:none"><span style="font-size:.8rem;font-weight:700;color:#a78bfa;letter-spacing:.08em">SNOW HELPER</span><div style="display:flex;gap:4px"><button id="snMenuLayout" style="background:none;border:1px solid #2a2a3e;color:#64748b;cursor:pointer;font-size:.75rem;padding:2px 8px;border-radius:4px" title="Toggle layout">☰</button><button id="snMenuClose" style="background:none;border:1px solid #2a2a3e;color:#64748b;cursor:pointer;font-size:.75rem;padding:2px 8px;border-radius:4px">✕</button></div></div>';
var btnWrap=document.createElement('div');
btnWrap.id='snMenuBtns';
btnWrap.style.cssText='display:flex;flex-direction:column;gap:5px';
menu.appendChild(btnWrap);

var colors={
  'Grab Ticket':  {bg:'rgba(52,211,153,.12)',border:'#34d399',hover:'#34d399'},
  'Save Title':   {bg:'rgba(56,189,248,.12)',border:'#38bdf8',hover:'#38bdf8'},
  'Copy Info':    {bg:'rgba(96,165,250,.12)',border:'#60a5fa',hover:'#60a5fa'},
  'Email':        {bg:'rgba(251,191,36,.12)',border:'#fbbf24',hover:'#fbbf24'},
  'Clean Ticket': {bg:'rgba(167,139,250,.12)',border:'#a78bfa',hover:'#a78bfa'},
  'Fill Triage':  {bg:'rgba(244,114,182,.12)',border:'#f472b6',hover:'#f472b6'},
  'Stale Check':  {bg:'rgba(248,113,113,.12)',border:'#f87171',hover:'#f87171'},
  'PC Review':    {bg:'rgba(52,211,153,.12)',border:'#34d399',hover:'#34d399'},
  'TaskMaster':   {bg:'rgba(251,146,60,.12)',border:'#fb923c',hover:'#fb923c'}
};

var tools=[
  {label:'Grab Ticket',icon:'📋',fn:grabTicket},
  {label:'Save Title',icon:'💾',fn:saveTicket},
  {label:'Copy Info',icon:'🔗',fn:copyTicket},
  {label:'Email',icon:'✉️',fn:emailTicket},
  {label:'Clean Ticket',icon:'🧹',fn:cleanTicket},
  {label:'Fill Triage',icon:'🏷️',fn:fillTriage},
  {label:'Stale Check',icon:'⏰',fn:staleCheck},
  {label:'PC Review',icon:'📋',fn:null},
  {label:'TaskMaster',icon:'🏅',fn:null}
];

tools.forEach(function(t){
  var c=colors[t.label]||{bg:'transparent',border:'#2a2a3e',hover:'#a78bfa'};
  var b=document.createElement('button');
  b.style.cssText='display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;margin-bottom:5px;border:1px solid '+c.border+';border-radius:8px;background:'+c.bg+';color:#e2e8f0;font:inherit;font-size:.92rem;font-weight:500;cursor:pointer;text-align:left;transition:all .15s';
  b.innerHTML='<span style="font-size:1.1rem">'+t.icon+'</span> '+t.label;
  b.onmouseover=function(){this.style.background=c.bg.replace('.12','.25');this.style.color=c.hover;this.style.transform='translateX(2px)'};
  b.onmouseout=function(){this.style.background=c.bg;this.style.color='#e2e8f0';this.style.transform='none'};
  if(t.label==='TaskMaster'){
    b.onclick=function(){var sc=document.createElement('script');sc.src='https://dneeds52.github.io/snow-helper/snow-helper-taskmaster.js?t='+Date.now();document.body.appendChild(sc);flash(this,'Running...')};
  }else if(t.label==='PC Review'){
    b.onclick=function(){var sc=document.createElement('script');sc.src='https://dneeds52.github.io/snow-helper/snow-helper-pc-review.js?t='+Date.now();document.body.appendChild(sc);flash(this,'Running...')};
  }else{
    b.onclick=function(){t.fn(this)};
  }
  btnWrap.appendChild(b);
});

document.body.appendChild(menu);
document.getElementById('snMenuClose').onclick=function(){menu.remove()};

/* Make draggable */
var hdr=document.getElementById('snMenuHdr');
var dx=0,dy=0,mx=0,my=0,dragging=false;
hdr.onmousedown=function(e){if(e.target.id==='snMenuClose')return;dragging=true;mx=e.clientX;my=e.clientY;e.preventDefault()};
document.addEventListener('mousemove',function(e){if(!dragging)return;dx=e.clientX-mx;dy=e.clientY-my;mx=e.clientX;my=e.clientY;menu.style.top=(menu.offsetTop+dy)+'px';menu.style.right='auto';menu.style.left=(menu.offsetLeft+dx)+'px'});
document.addEventListener('mouseup',function(){dragging=false});

/* Layout toggle */
var horizontal=false;
document.getElementById('snMenuLayout').onclick=function(e){
  e.stopPropagation();
  horizontal=!horizontal;
  var bw=document.getElementById('snMenuBtns');
  if(horizontal){
    menu.style.width='auto';menu.style.minWidth='auto';menu.style.maxWidth='none';
    menu.style.left='10px';menu.style.right='10px';menu.style.top='10px';menu.style.borderRadius='12px';
    bw.style.flexDirection='row';bw.style.flexWrap='nowrap';
    bw.querySelectorAll('button').forEach(function(b){b.style.width='auto';b.style.padding='8px 14px'});
    this.textContent='☰';this.title='Switch to list view';
  }else{
    menu.style.width='260px';menu.style.minWidth='240px';menu.style.maxWidth='';
    menu.style.left='';menu.style.right='20px';menu.style.top='10px';
    bw.style.flexDirection='column';bw.style.flexWrap='nowrap';
    bw.querySelectorAll('button').forEach(function(b){b.style.width='100%';b.style.padding='10px 12px'});
    this.textContent='⊞';this.title='Switch to grid view';
  }
};

})();
