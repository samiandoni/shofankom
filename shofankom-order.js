<script>
  alert('hi');
(function(){
  var WEBHOOK_URL = "https://hook.eu2.make.com/57qvrfwhfkxo9amd2w8h8meaw73ktpf6"; 
  var sent = new Set(); // memory only, resets on reload

  // --- helpers ---
  function preclean(s){
    return (s || "")
      .replace(/```(?:json)?/gi, "").replace(/```/g, "")
      .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
      .replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  }

  function extractOrderJsonBalanced(text){
    text = preclean(text);
    var idx = text.indexOf("ORDER_OBJECT:");
    if (idx === -1) return null;
    var i = text.indexOf("{", idx);
    if (i === -1) return null;

    var depth = 0, inStr = false, esc = false;
    for (var j = i; j < text.length; j++){
      var ch = text[j];
      if (inStr){
        if (esc){ esc = false; }
        else if (ch === "\\"){ esc = true; }
        else if (ch === '"'){ inStr = false; }
      } else {
        if (ch === '"'){ inStr = true; }
        else if (ch === "{"){ depth++; }
        else if (ch === "}"){
          depth--;
          if (depth === 0){
            return text.slice(i, j + 1).trim();
          }
        }
      }
    }
    return null;
  }

  function getOrderKey(order){
    if (order && order.order_id) return "id:" + String(order.order_id);
    try {
      return "h:" + btoa(unescape(encodeURIComponent(JSON.stringify(order)))).slice(0, 64);
    } catch (e){
      return "h:" + Math.random().toString(36).slice(2);
    }
  }

  function replaceBubble(node){
    if (!node) return;
    if (node.dataset && node.dataset.orderCleared === "1") return;
    node.dataset.orderCleared = "1";
    var confirmation = "✅ تم إرسال طلبك للمطعم. راح نتواصل معك لتأكيد الطلب.\n✅ Your order has been sent to the restaurant. We’ll contact you to confirm.";
    if ("innerText" in node) node.innerText = confirmation;
    else node.textContent = confirmation;
  }

  async function postToMake(orderJson, nodeForReplace){
    var order;
    try { order = JSON.parse(orderJson); } catch(e){ return; }
    var key = getOrderKey(order);
    if (sent.has(key)) return; // already sent this session
    sent.add(key);

    var replaced = false;
    var timer = setTimeout(function(){ replaceBubble(nodeForReplace); replaced = true; }, 5000);

    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: order })
      });
      if (!replaced) replaceBubble(nodeForReplace);
      console.log("Shofankom: order sent.", key);
    } catch(e){
      console.warn("Shofankom: send failed", e);
    } finally {
      clearTimeout(timer);
    }
  }

  // Mark existing orders in chat history as sent (avoid resending)
  function primeFromHistory(){
    var all = document.querySelectorAll("body *");
    for (var k = 0; k < all.length; k++){
      var el = all[k];
      var t = (el.innerText || el.textContent || "");
      if (!t || t.indexOf("ORDER_OBJECT:") === -1) continue;
      var json = extractOrderJsonBalanced(t);
      if (!json) continue;
      try {
        var order = JSON.parse(json);
        var key = getOrderKey(order);
        sent.add(key);
      } catch(e){}
    }
  }

  function processNode(node){
    if (!node || (node.dataset && node.dataset.orderCleared === "1")) return;
    var raw = (node.innerText || node.textContent || "");
    if (!raw || raw.indexOf("ORDER_OBJECT:") === -1) return;
    var json = extractOrderJsonBalanced(raw);
    if (json) postToMake(json, node);
  }

  // Run
  primeFromHistory();

  var mo = new MutationObserver(function(muts){
    muts.forEach(function(m){
      m.addedNodes.forEach(function(n){
        processNode(n);
      });
    });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Fallback polling
  setInterval(function(){ processNode(document.body); }, 3000);
})();
</script>
