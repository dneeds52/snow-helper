(function(){
  /* --- locate header row to find columns by name --- */
  var ths = Array.from(document.querySelectorAll("table.list_table th, table.data_list_table th"));
  if (!ths.length) ths = Array.from(document.querySelectorAll("table th"));
  var sdIdx = -1, oIdx = -1;

  ths.forEach(function(th, i) {
    var txt = (th.getAttribute("glide_label") || th.getAttribute("name") || th.innerText || "").toLowerCase().trim();
    if (txt === "short_description" || txt === "short description") sdIdx = i;
    if (txt === "order" || txt === "u_order") oIdx = i;
  });

  /* fallback: scan data rows if headers didn't work */
  var dataRows = Array.from(document.querySelectorAll("table tbody tr")).filter(function(row) {
    return (row.className || "").indexOf("list_row") > -1;
  });
  if (!dataRows.length) { alert("No data rows found."); return; }

  if (sdIdx < 0 || oIdx < 0) {
    /* old positional fallback */
    var numIdx = -1;
    for (var ri = 0; ri < dataRows.length; ri++) {
      var tds = Array.from(dataRows[ri].querySelectorAll("td"));
      tds.forEach(function(td, i) {
        if (/^(INC|SCTASK|CHG|PRB|RITM)\d+/i.test((td.innerText || "").trim())) numIdx = i;
      });
      if (numIdx >= 0) break;
    }
    if (numIdx < 0) { alert("Could not find ticket number column."); return; }

    if (sdIdx < 0) {
      /* find the first text-heavy column after the number */
      for (var ri2 = 0; ri2 < Math.min(dataRows.length, 5); ri2++) {
        var tds2 = Array.from(dataRows[ri2].querySelectorAll("td"));
        for (var ci = numIdx + 1; ci < tds2.length; ci++) {
          var t = (tds2[ci].innerText || "").trim();
          if (t.length > 10 && !/^\d+$/.test(t)) { sdIdx = ci; break; }
        }
        if (sdIdx >= 0) break;
      }
    }
    if (oIdx < 0) {
      for (var ri3 = 0; ri3 < dataRows.length; ri3++) {
        var tds3 = Array.from(dataRows[ri3].querySelectorAll("td"));
        for (var ci2 = (sdIdx >= 0 ? sdIdx + 1 : numIdx + 2); ci2 < tds3.length; ci2++) {
          var st = tds3[ci2].getAttribute("style") || "";
          if (st.indexOf("text-align: right") > -1) { oIdx = ci2; break; }
        }
        if (oIdx >= 0) break;
      }
    }
  }

  if (sdIdx < 0) { alert("Could not find Short Description column."); return; }
  if (oIdx < 0) { alert("Could not find Order column."); return; }

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

  var count = 0;
  dataRows.forEach(function(row) {
    var cells = Array.from(row.querySelectorAll("td"));
    if (cells.length <= Math.max(sdIdx, oIdx)) return;

    var sdCell = cells[sdIdx];
    var oCell = cells[oIdx];
    var raw = (oCell.innerText || "").trim();
    var match = raw.match(/^(\d+)/);
    var orderVal = match ? match[1] : "";
    var key = (orderVal && orderVal !== "0") ? orderVal.padStart(2, "0").substring(0, 1) : "";
    var s = styles.hasOwnProperty(key) ? styles[key] : styles[""];

    /* clean any previous labels */
    var sdText = (sdCell.innerText || "").trim();
    labels.forEach(function(l) { sdText = sdText.replace(l, "").trim(); });
    sdCell.innerText = sdText;

    /* apply color to short description */
    sdCell.style.borderBottom = "1px solid " + s.b;
    sdCell.style.color = s.c;
    sdCell.style.backgroundColor = s.bg;
    sdCell.innerHTML = s.lbl + sdCell.innerHTML;
    sdCell.title = sdCell.innerText;

    /* also color the order cell */
    oCell.style.backgroundColor = s.bg;
    oCell.style.color = s.c;

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
