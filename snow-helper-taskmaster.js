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

  /* --- find Order column index using th name attribute --- */
  var ths = Array.from(document.querySelectorAll("table.list_table th, table.data_list_table th"));
  if (!ths.length) ths = Array.from(document.querySelectorAll("table th"));
  var orderThName = null;
  ths.forEach(function(th) {
    var n = (th.getAttribute("name") || "").toLowerCase();
    if (n === "order" || n === "u_order") orderThName = n;
  });

  /* --- find data rows --- */
  var dataRows = Array.from(document.querySelectorAll("table tbody tr")).filter(function(row) {
    return (row.className || "").indexOf("list_row") > -1;
  });
  if (!dataRows.length) { alert("No data rows found."); return; }

  /* --- For each row, find cells by content rather than header index.
     This works regardless of grouping, extra columns, or column reordering.
     Order cell: identified by th name matching via td's data attributes,
     or by finding a td whose text is a small integer (0-89).
     Short Description cell: the td with the longest text. --- */

  var count = 0;
  dataRows.forEach(function(row) {
    var cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 2) return;

    /* find the Order cell: look for td with matching field attribute first */
    var oCell = null;
    var sdCell = null;

    cells.forEach(function(td) {
      var field = (td.getAttribute("data-field") || td.getAttribute("field") || "").toLowerCase();
      if (field === "order" || field === "u_order") oCell = td;
      if (field === "short_description") sdCell = td;
    });

    /* fallback: find Order by content — a cell with just a small number */
    if (!oCell) {
      cells.forEach(function(td) {
        if (oCell) return;
        var t = (td.innerText || "").trim();
        if (/^\d{1,2}$/.test(t) && parseInt(t, 10) < 90) oCell = td;
      });
    }

    /* fallback: find SD by content — longest text cell, excluding known non-SD content */
    if (!sdCell) {
      var best = null, bestLen = 0;
      cells.forEach(function(td) {
        if (td === oCell) return;
        var t = (td.innerText || "").trim();
        /* skip cells that look like ticket numbers, states, dates, or very short */
        if (/^(INC|SCTASK|CHG|PRB|RITM)\d+/i.test(t)) return;
        if (/^(Open|Pending|Closed|Resolved|New|Active|Awaiting)/i.test(t) && t.length < 30) return;
        if (t.length > bestLen) { bestLen = t.length; best = td; }
      });
      sdCell = best;
    }

    if (!oCell || !sdCell) return;

    /* read order value */
    var raw = (oCell.innerText || "").trim();
    var match = raw.match(/^(\d+)/);
    var orderVal = match ? match[1] : "";
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
