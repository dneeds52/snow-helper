(function(){
  var styles = {
    "":  { b: "#7D3C98", c: "#7D3C98", bg: "#E8DAEF", lbl: "[Initial Action] " },
    "0": { b: "#856404", c: "#856404", bg: "#fff3cd", lbl: "[Update Needed] " },
    "1": { b: "#856404", c: "#856404", bg: "#fff3cd", lbl: "[Update Needed] " },
    "2": { b: "#004085", c: "#004085", bg: "#cce5ff", lbl: "[Prioritize] " },
    "3": { b: "#383d41", c: "#383d41", bg: "#e2e3e5", lbl: "[Discuss] " },
    "4": { b: "#155724", c: "#155724", bg: "#d4edda", lbl: "[Scheduled] " },
    "5": { b: "#721c24", c: "#721c24", bg: "#f8d7da", lbl: "[Blocked] " },
    "6": { b: "#818182", c: "#818182", bg: "#f7f7f9", lbl: "[Deferred] " },
    "7": { b: "#BB0086", c: "#BB0086", bg: "#FFD1F2", lbl: "[DC Move] " },
    "8": { b: "#008970", c: "#008970", bg: "#B3FFF1", lbl: "[ASAP PC] " }
  };
  var labels = Object.values(styles).map(function(s) { return s.lbl; });
  labels.push("[Unmapped] ");

  /* --- find data rows --- */
  var dataRows = Array.from(document.querySelectorAll("table tbody tr")).filter(function(row) {
    return (row.className || "").indexOf("list_row") > -1;
  });
  if (!dataRows.length) { alert("No data rows found."); return; }

  var count = 0;
  dataRows.forEach(function(row) {
    var cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 2) return;

    /* Step 1: Find the Number cell — contains SCTASK/INC/CHG/PRB/RITM pattern.
       This is the most reliable anchor in any SN list view. */
    var numIdx = -1;
    cells.forEach(function(td, i) {
      if (numIdx >= 0) return;
      var t = (td.innerText || "").trim();
      if (/^(INC|SCTASK|CHG|PRB|RITM)\d+/i.test(t)) numIdx = i;
    });
    if (numIdx < 0) return; /* skip rows without a ticket number */

    /* Step 2: Short Description is always the cell right after Number */
    var sdIdx = numIdx + 1;
    if (sdIdx >= cells.length) return;
    var sdCell = cells[sdIdx];

    /* Step 3: Find Order cell — scan remaining cells for a small integer */
    var oCell = null;
    cells.forEach(function(td, i) {
      if (oCell || i === numIdx || i === sdIdx) return;
      var t = (td.innerText || "").trim();
      if (/^\d{1,2}$/.test(t) && parseInt(t, 10) < 90) oCell = td;
    });

    /* read order value — if no Order cell visible, default to empty (Initial Action) */
    var orderVal = "";
    if (oCell) {
      var raw = (oCell.innerText || "").trim();
      var match = raw.match(/^(\d+)/);
      orderVal = match ? match[1] : "";
    }
    var key = (orderVal && orderVal !== "0") ? orderVal.padStart(2, "0").substring(0, 1) : "";
    var s = styles.hasOwnProperty(key) ? styles[key] : styles[""];

    /* clean any previous labels from SD */
    var sdText = (sdCell.innerText || "").trim();
    labels.forEach(function(l) { sdText = sdText.replace(l, "").trim(); });
    sdCell.innerText = sdText;

    /* apply color to short description only */
    sdCell.style.borderBottom = "1px solid " + s.b;
    sdCell.style.color = s.c;
    sdCell.style.backgroundColor = s.bg;
    sdCell.innerHTML = s.lbl + sdCell.innerHTML;
    sdCell.title = sdCell.innerText;

    if (sdCell.innerText.length > 90) {
      sdCell.innerText = sdCell.innerText.substring(0, 87) + "...";
      sdCell.style.maxWidth = "600px";
      sdCell.style.overflow = "hidden";
      sdCell.style.textOverflow = "ellipsis";
      sdCell.style.whiteSpace = "nowrap";
    }
    count++;
  });

  console.log("TaskMaster done: " + count + " rows.");

  /* confetti */
  (function() {
    var c = ["#a78bfa","#67e8f9","#f59e0b","#34d399","#f87171","#fb923c","#60a5fa"];
    for (var i = 0; i < 30; i++) {
      var e = document.createElement("div");
      e.style.cssText = "position:fixed;pointer-events:none;z-index:9999;width:" +
        (Math.random()*8+4) + "px;height:" + (Math.random()*8+4) +
        "px;background:" + c[Math.floor(Math.random()*c.length)] +
        ";border-radius:" + (Math.random()>.5?"50%":"2px") +
        ";left:" + (Math.random()*window.innerWidth) +
        "px;top:" + (Math.random()*window.innerHeight*.5+window.innerHeight*.25) +
        "px;opacity:1;transition:none";
      document.body.appendChild(e);
      var tx = (Math.random()-.5)*300, ty = (Math.random()-1)*300, r = Math.random()*720-360;
      setTimeout(function(el, x, y, ro) {
        el.style.transition = "transform 1s ease-out,opacity 1s ease-out";
        el.style.transform = "translate("+x+"px,"+y+"px) rotate("+ro+"deg)";
        el.style.opacity = "0";
        setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 1100);
      }, 10, e, tx, ty, r);
    }
  })();
})()
