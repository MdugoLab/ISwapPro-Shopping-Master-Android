
(() => {
  "use strict";
  const KEY = "iswappro_shopping_cart_v1";
  const CATS = {
    "Vegetables":"🥬","Fruit":"🍎","Dairy":"🥛","Bakery":"🥖","Meat & Fish":"🥩",
    "Frozen":"🧊","Drinks":"🥤","Pantry":"🥫","Household":"🧽","Personal Care":"🧴","Other":"📦"
  };
  const blank = {items:[],inventory:[],history:[],sales:[],suppliers:[],purchaseOrders:[],supplierPrices:[],stockMovements:[],settings:{currency:"ZAR",budget:0,dark:false},stats:{lists:0,items:0,spend:0,category:{}}};
  const clone = x => JSON.parse(JSON.stringify(x));
  let state = load();
  let settingsDraft = null;
  let filters = {search:"",category:"all",status:"all",sort:"priority"};
  let activeListType = "grocery";
  let activeInventoryType = "grocery";
  const LIST_TYPE_COPY = {grocery:"Groceries, household goods, clothing, electronics, education and other personal purchases.",stock:"Products, equipment, packaging, stationery and other business purchases.",material:"Building materials, tools, supplies and project-related purchases."};
  const TYPE_LABELS = {grocery:"General shopping",stock:"Business items",material:"Tools & project items"};
  const TYPE_CATEGORIES = {grocery:["Groceries","Household Items","Clothing & Accessories","Electronics","Personal Care & Health","Education & Office","Other Purchases","Other"],stock:["Business Products","Equipment","Packaging","Stationery","Electronics","Tools & Equipment","Clothing & Accessories","Other"],material:["Building Materials","Electrical","Plumbing","Cleaning","Tools & Equipment","Decorating","Catering Supplies","Other"]};
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const uid = () => "g_" + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  const wholeUnits = new Set(["each","item","items","piece","pieces","pack","packs","box","boxes","bottle","bottles","can","cans","pair","pairs","set","sets"]);
  const qtyStep = unit => wholeUnits.has(String(unit||"each").toLowerCase()) ? 1 : 0.1;
  const cleanQty = (value, unit="each", min=0) => { const n=Number(value); if(!Number.isFinite(n)) return min; const step=qtyStep(unit); const rounded=step===1?Math.round(n):Math.round(n*1000)/1000; return Math.max(min,rounded); };
  const qtyText = (value, unit="each") => cleanQty(value,unit).toLocaleString("en-ZA",{maximumFractionDigits:3});
  const money = n => new Intl.NumberFormat("en-ZA",{style:"currency",currency:state.settings.currency||"ZAR"}).format(Number(n)||0);
  const date = ts => new Date(ts).toLocaleString([], {dateStyle:"medium",timeStyle:"short"});
  function load(){
    try { const x=JSON.parse(localStorage.getItem(KEY)||"null"); return x?{...clone(blank),...x,settings:{...blank.settings,...x.settings},stats:{...blank.stats,...x.stats},inventory:Array.isArray(x.inventory)?x.inventory:[],sales:Array.isArray(x.sales)?x.sales:[],suppliers:Array.isArray(x.suppliers)?x.suppliers:[],purchaseOrders:Array.isArray(x.purchaseOrders)?x.purchaseOrders:[],supplierPrices:Array.isArray(x.supplierPrices)?x.supplierPrices:[],stockMovements:Array.isArray(x.stockMovements)?x.stockMovements:[]}:clone(blank); }
    catch(e){ return clone(blank); }
  }
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){notify("Could not save data. Export a backup and free browser storage.","error");} }
  function logStockMovement(item,delta,reason,reference=""){state.stockMovements=Array.isArray(state.stockMovements)?state.stockMovements:[];if(!delta)return;state.stockMovements.unshift({id:uid(),date:Date.now(),inventoryId:item.id,name:item.name,type:item.type||"grocery",delta:Number(delta),unit:item.unit||"each",reason,reference});state.stockMovements=state.stockMovements.slice(0,1000);}
  // V16: create one opening-balance audit entry for legacy inventory records
  // that existed before V15 movement tracking. Never duplicate an existing baseline.
  function migrateLegacyInventoryMovements(){
    state.inventory=Array.isArray(state.inventory)?state.inventory:[];
    state.stockMovements=Array.isArray(state.stockMovements)?state.stockMovements:[];
    let changed=false;
    state.inventory.forEach(item=>{
      if(!item.id){item.id=uid();changed=true;}
      const hasTrail=state.stockMovements.some(m=>m.inventoryId===item.id);
      const qty=Number(item.qty)||0;
      if(!hasTrail&&qty>0){
        state.stockMovements.unshift({id:uid(),date:Date.now(),inventoryId:item.id,name:item.name||"Unnamed item",type:item.type||"grocery",delta:qty,unit:item.unit||"each",reason:"Opening balance (legacy inventory migration)",reference:"V16 migration"});
        changed=true;
      }
    });
    if(changed){state.stockMovements=state.stockMovements.slice(0,1000);save();}
  }
  migrateLegacyInventoryMovements();
  function renderMovements(){const rows=(state.stockMovements||[]).filter(m=>(m.type||"grocery")===activeInventoryType).slice(0,40);const el=$("#movementList");if(!el)return;el.innerHTML=rows.length?rows.map(m=>`<article class="movement-row"><span class="movement-symbol">${m.delta>0?"↗":"↘"}</span><div class="movement-main"><b>${esc(m.name)}</b><small>${esc(m.reason)} · ${date(m.date)}${m.reference?" · "+esc(m.reference):""}</small></div><strong class="movement-delta ${m.delta>0?"in":"out"}">${m.delta>0?"+":""}${m.delta} ${esc(m.unit)}</strong></article>`).join(""):`<div class="empty-state">No stock movements recorded for this purpose yet.</div>`;}
  let scannerStream=null;function stopBarcodeScanner(){if(scannerStream){scannerStream.getTracks().forEach(t=>t.stop());scannerStream=null;}const v=$("#barcodeVideo");if(v)v.srcObject=null;$("#barcodeScanner").hidden=true;}

  function notify(msg,type="ok"){const n=document.createElement("div");n.className="toast";n.textContent=msg;$("#toastRegion").append(n);setTimeout(()=>n.remove(),3000);}
  function openDialog(id){const d=$("#"+id);if(d.showModal)d.showModal();else d.setAttribute("open","");}
  function closeDialog(id){
    if(id==="stockDialog")stopBarcodeScanner();
    if(id==="settingsDialog" && settingsDraft){
      state.settings={...settingsDraft};
      settingsDraft=null;
      applyTheme();
    }
    const d=$("#"+id);if(d.close)d.close();else d.removeAttribute("open");
  }
  function navigate(view){$$(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+view));$$(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===view));renderAll();window.scrollTo({top:0,behavior:"smooth"});}
  function totalCost(items=state.items){return items.reduce((s,i)=>s+(Number(i.price)||0)*(Number(i.qty)||1),0);}
  function bought(){return state.items.filter(i=>i.done);}
  function remaining(){return state.items.filter(i=>!i.done);}
  function applyTheme(){document.body.classList.toggle("dark",!!state.settings.dark);$("#darkMode").checked=!!state.settings.dark;$("#themeToggle").textContent=state.settings.dark?"☾":"☼";}
  function renderDashboard(){
    const total=state.items.length,done=bought().length,left=total-done,pct=total?Math.round(done/total*100):0,cost=totalCost();
    $("#metricTotal").textContent=total;$("#metricBought").textContent=done;$("#metricLeft").textContent=left;$("#metricCost").textContent=money(cost);
    $("#progressPercent").textContent=pct+"%";$("#progressFill").style.width=pct+"%";$("#progressBought").textContent=done+" collected";$("#progressRemaining").textContent=left+" remaining";
    $("#budgetStatus").textContent=state.settings.budget>0?`${money(cost)} of ${money(state.settings.budget)}${cost>state.settings.budget?" · over budget":""}`:"No budget set";
    $("#welcomeLine").textContent=total?`${left} item${left===1?"":"s"} left to collect. Your estimated list value is ${money(cost)}.`:"Start by adding a few items to your shopping list.";
    $("#navCount").textContent=left;
    const preview=state.items.filter(i=>!i.done).slice(0,3);
    $("#dashboardPreview").innerHTML=preview.length?preview.map(i=>`<div class="preview-item"><span>${CATS[i.category]||"📦"}</span><div><b>${esc(i.name)}</b><small>Qty ${i.qty} · ${money(i.price*i.qty)}</small></div></div>`).join(""):`<div class="empty-state" style="grid-column:1/-1"><b>Your list is clear</b>Add an item to see it here.</div>`;
  }
  function renderCategoryOptions(){
    const sel=$("#categoryFilter"),value=sel.value||"all";
    const cats=TYPE_CATEGORIES[activeListType]||TYPE_CATEGORIES.grocery;
    sel.innerHTML='<option value="all">All categories</option>'+cats.map(c=>`<option>${esc(c)}</option>`).join("");
    sel.value=[...sel.options].some(o=>o.value===value)?value:"all";
  }
  function renderItems(){
    renderCategoryOptions();
    const typeItems=state.items.filter(i=>(i.type||"grocery")===activeListType);
    let items=[...typeItems];
    if(filters.search){const q=filters.search.toLowerCase();items=items.filter(i=>[i.name,i.category,i.notes,i.store,i.location,i.sku,i.project,i.service,TYPE_LABELS[i.type||"grocery"]].join(" ").toLowerCase().includes(q));}
    if(filters.category!=="all")items=items.filter(i=>i.category===filters.category);
    if(filters.status==="remaining")items=items.filter(i=>!i.done);
    if(filters.status==="bought")items=items.filter(i=>i.done);
    const po={high:0,medium:1,low:2};
    items.sort((a,b)=>filters.sort==="name"?a.name.localeCompare(b.name):filters.sort==="category"?a.category.localeCompare(b.category):filters.sort==="recent"?b.created-a.created:filters.sort==="price"?b.price-a.price:(po[a.priority]-po[b.priority]||a.name.localeCompare(b.name)));
    const typeDone=typeItems.filter(i=>i.done).length,typeLeft=typeItems.length-typeDone;
    $("#listSummary").textContent=`${items.length} shown · ${typeItems.length} ${TYPE_LABELS[activeListType].toLowerCase()} · ${typeLeft} to collect`;
    $("#listTotal").textContent=money(totalCost(typeItems));
    $("#listCostNote").textContent=`${typeDone} collected · ${typeLeft} still to collect`;
    $("#listTypeCaption").textContent=LIST_TYPE_COPY[activeListType];
    $("#count-grocery").textContent=state.items.filter(i=>(i.type||"grocery")==="grocery").length;
    $("#count-stock").textContent=state.items.filter(i=>i.type==="stock").length;
    $("#count-material").textContent=state.items.filter(i=>i.type==="material").length;
    $$("[data-list-type]").forEach(b=>{const on=b.dataset.listType===activeListType;b.classList.toggle("active",on);b.setAttribute("aria-selected",String(on));});
    $("#itemList").innerHTML=items.length?items.map(i=>`
      <article class="grocery-item ${i.done?"done":""}" data-id="${i.id}">
        <button class="item-check" data-action="toggle" aria-label="${i.done?"Mark as not collected":"Mark as collected"}" aria-pressed="${i.done}">${i.done?"✓":""}</button>
        <span class="item-emoji">${CATS[i.category]||"📦"}</span>
        <div class="item-main"><div class="item-name">${esc(i.name)}</div><div class="item-meta">${qtyText(i.qty,i.unit)} ${esc(i.unit)} · ${esc(TYPE_LABELS[i.type||"grocery"])} · ${esc(i.category)}${i.sku?" · SKU "+esc(i.sku):""}${i.project?" · Job "+esc(i.project):""}${i.store?" · "+esc(i.store):""}${i.location?" · "+esc(i.location):""}${i.notes?" · "+esc(i.notes):""}${i.barcode?" · Barcode "+esc(i.barcode):""}</div></div>
        <div class="qty-stepper"><button type="button" data-action="qty-minus" aria-label="Decrease quantity">−</button><strong>${qtyText(i.qty,i.unit)}</strong><button type="button" data-action="qty-plus" aria-label="Increase quantity">＋</button><small>${esc(i.unit)}</small></div>
        <span class="priority ${i.priority}">${i.priority}</span>
        <span class="item-price">${money(i.price*i.qty)}</span>
        <div class="item-actions"><button class="mini-action" data-action="edit" aria-label="Edit ${esc(i.name)}">✎</button><button class="mini-action" data-action="delete" aria-label="Delete ${esc(i.name)}">×</button></div>
      </article>`).join(""):`<div class="empty-state"><b>${state.items.length?"No matching items":`No ${TYPE_LABELS[activeListType].toLowerCase()} yet`}</b>${typeItems.length?"Try changing your search or filters.":`Add items to your ${TYPE_LABELS[activeListType].toLowerCase()} list.`}</div>`;
  }
  function renderHistory(){
    $("#historyList").innerHTML=state.history.length?state.history.map(h=>`
      <article class="history-card" data-id="${h.id}"><span class="history-icon">▤</span><div class="history-main"><b>${esc(TYPE_LABELS[h.type||h.items[0]?.type||"grocery"]||"Shopping session")} · ${h.items.length} items</b><small>${date(h.date)} · ${h.purchased} collected · ${h.pct}% complete</small></div><span class="history-total">${money(h.totalCost)}</span><div class="history-actions"><button class="mini-action" data-action="restore" aria-label="Restore list">↶</button><button class="mini-action" data-action="history-delete" aria-label="Delete history">×</button></div></article>`).join(""):`<div class="empty-state"><b>No completed sessions yet</b>When you complete a shopping list, it will be saved here.</div>`;
  }
  let activeReportType="grocery";
  function renderInsights(){
    const labels={all:"Household shopping activity only.",grocery:"Household grocery purchases and collected items only.",stock:"Business resale stock purchases only. Sales revenue and profit remain in the Business Stock inventory panel.",material:"Service-delivery materials and job-related purchases only."};
    const all=Array.isArray(state.history)?state.history:[];
    const typeOf=h=>h.type||h.items?.[0]?.type||"grocery";
    const hist=activeReportType==="all"?all:all.filter(h=>typeOf(h)===activeReportType);
    const itemRows=hist.flatMap(h=>(Array.isArray(h.items)?h.items:[]));
    const avg=hist.length?Math.round(hist.reduce((sum,h)=>sum+(Number(h.pct)||0),0)/hist.length):0;
    const spend=hist.reduce((sum,h)=>sum+(Number(h.totalCost)||0),0);
    $("#insightLists").textContent=hist.length;$("#insightItems").textContent=itemRows.length;$("#insightAverage").textContent=avg+"%";$("#insightSpend").textContent=money(spend);
    $("#reportCaption").textContent=labels[activeReportType];
    $$("[data-report-type]").forEach(b=>b.classList.toggle("active",b.dataset.reportType===activeReportType));
    const cats={};itemRows.forEach(i=>{const cat=i.category||"Other";cats[cat]=(cats[cat]||0)+(Number(i.qty)||1);});
    const entries=Object.entries(cats).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...entries.map(x=>x[1]));
    $("#categoryChart").innerHTML=entries.length?entries.map(([cat,count])=>`<div class="category-row"><span>${CATS[cat]||"📦"} ${esc(cat)}</span><div class="category-track"><span style="width:${Math.max(3,count/max*100)}%"></span></div><strong>${count}</strong></div>`).join(""):`<div class="empty-state"><b>No report data yet</b>Complete collected items in this purpose to build its report.</div>`;
    const types=["grocery","stock","material"],summary=types.map(type=>{const rows=all.filter(h=>typeOf(h)===type),items=rows.flatMap(h=>h.items||[]),value=rows.reduce((a,h)=>a+(Number(h.totalCost)||0),0);return {type,rows,items,value};});
    const top=Math.max(1,...summary.map(x=>x.value));
    $("#purposeComparison").innerHTML=summary.map(x=>`<div class="purpose-comparison-row"><span>${esc(TYPE_LABELS[x.type])}</span><strong>${money(x.value)}</strong><div class="purpose-comparison-track"><span style="width:${x.value/top*100}%"></span></div><small>${x.rows.length} sessions · ${x.items.length} collected items</small></div>`).join("");
  }
  function renderInventoryIntelligence(typed,low){
    const units=typed.reduce((sum,x)=>sum+Math.max(0,Number(x.qty)||0),0);
    const value=typed.reduce((sum,x)=>sum+Math.max(0,Number(x.qty)||0)*Math.max(0,Number(x.costPrice)||0),0);
    $("#intelUnits").textContent=units.toLocaleString("en-ZA");
    $("#intelValue").textContent=money(value);
    $("#intelReorderCount").textContent=low.length;
    const queue=$("#reorderQueue");
    queue.innerHTML=low.length?low.map(x=>{
      const qty=Math.max(1,Number(x.min||0)-Number(x.qty||0));
      return `<article class="reorder-row"><div><b>${esc(x.name)}</b><small>${esc(TYPE_LABELS[x.type||"grocery"])} · On hand ${Number(x.qty)||0} ${esc(x.unit||"each")} · Minimum ${Number(x.min)||0}</small></div><strong>+${qty} ${esc(x.unit||"each")}</strong><button type="button" class="secondary-btn" data-restock-one="${esc(x.id)}">Add to list</button></article>`;
    }).join(""):`<div class="intelligence-clear">✓ All tracked items are above their minimum stock levels.</div>`;
    const barcodes=typed.filter(x=>String(x.barcode||"").trim());
    const seen=new Set(),duplicates=new Set();
    barcodes.forEach(x=>{const code=String(x.barcode).trim().toLowerCase();if(seen.has(code))duplicates.add(code);seen.add(code);});
    const audit=$("#barcodeAudit");
    audit.hidden=!duplicates.size;
    audit.textContent=duplicates.size?`Barcode check: ${duplicates.size} duplicate barcode value(s) found in this inventory purpose. Review the matching product records before relying on barcode lookup.`:"";
    $("#addAllRestock").disabled=!low.length;
  }
  function addInventoryRestockToList(x){
    const need=Math.max(1,Number(x.min||0)-Number(x.qty||0));
    let existing=state.items.find(i=>i.name.trim().toLowerCase()===x.name.trim().toLowerCase()&&(i.type||"grocery")===(x.type||"grocery")&&!i.done);
    if(existing)existing.qty=Math.min(999999,Number(existing.qty||0)+need);
    else state.items.unshift({id:uid(),name:x.name,type:x.type||"grocery",qty:need,unit:x.unit||"each",category:x.category||"Other",priority:"high",price:0,store:x.store||"",location:x.location||"",notes:"Restock recommendation from inventory",done:false,created:Date.now()});
    return need;
  }
  function renderInventory(){
    const q=($("#stockSearch").value||"").toLowerCase(), filter=$("#stockFilter").value||"all";
    const typed=state.inventory.filter(x=>(x.type||"grocery")===activeInventoryType);
    const low=typed.filter(x=>Number(x.qty)<=Number(x.min));
    renderInventoryIntelligence(typed,low);
    $("#stockCount").textContent=typed.length;$("#lowStockCount").textContent=low.length;$("#healthyStockCount").textContent=typed.length-low.length;
    const restock=low.reduce((sum,x)=>{const match=state.items.find(i=>i.name.toLowerCase()===x.name.toLowerCase()&&(i.type||"grocery")===(x.type||"grocery"));return sum+Math.max(0,Number(x.min)-Number(x.qty))*(match?Number(match.price)||0:0);},0);$("#restockValue").textContent=money(restock);
    let rows=typed.filter(x=>[x.name,x.category,x.store,x.location].join(" ").toLowerCase().includes(q));
    if(filter==="low")rows=rows.filter(x=>Number(x.qty)<=Number(x.min));if(filter==="healthy")rows=rows.filter(x=>Number(x.qty)>Number(x.min));
    rows.sort((a,b)=>(Number(a.qty)-Number(a.min))-(Number(b.qty)-Number(b.min)));
    $("#inventoryList").innerHTML=rows.length?rows.map(x=>{const isLow=Number(x.qty)<=Number(x.min);return `<article class="grocery-item stock-item" data-stock-id="${x.id}"><span class="item-emoji">${x.photo?`<img class="stock-photo" src="${x.photo}" alt="${esc(x.name)}">`:CATS[x.category]||"📦"}</span><div class="item-main"><div class="item-name">${esc(x.name)}</div><div class="item-meta">${esc(TYPE_LABELS[x.type||"grocery"])} · ${esc(x.category)} · Minimum ${x.min} ${esc(x.unit)}${x.store?" · "+esc(x.store):""}${x.location?" · "+esc(x.location):""}</div>${x.barcode?`<span class="barcode-tag">▦ ${esc(x.barcode)}</span>`:""}</div><strong class="stock-quantity">${qtyText(x.qty,x.unit)} ${esc(x.unit)}</strong><span class="stock-badge ${isLow?"low":"healthy"}">${isLow?"LOW STOCK":"IN STOCK"}</span><div class="item-actions">${activeInventoryType==="stock"?`<button class="mini-action sale-action" data-stock-action="sale" aria-label="Record sale of ${esc(x.name)}">R$</button>`:""}<button class="mini-action" data-stock-action="minus" aria-label="Decrease ${esc(x.name)} stock">−</button><button class="mini-action" data-stock-action="plus" aria-label="Increase ${esc(x.name)} stock">＋</button><button class="mini-action" data-stock-action="restock" aria-label="Add ${esc(x.name)} to shopping list">🛒</button><button class="mini-action" data-stock-action="edit" aria-label="Edit ${esc(x.name)}">✎</button></div>${activeInventoryType==="stock"?`<div class="stock-pricing-line">Cost ${money(x.costPrice||0)} · Sell ${money(x.sellPrice||0)} · Margin ${Number(x.sellPrice)>0?(((Number(x.sellPrice)-Number(x.costPrice||0))/Number(x.sellPrice))*100).toFixed(1):"0.0"}%</div>`:""}</article>`;}).join(""):`<div class="empty-state"><b>${typed.length?"No matching items":`No ${TYPE_LABELS[activeInventoryType].toLowerCase()} inventory yet`}</b>${typed.length?"Change the search or filter.":"Add an item here or complete a shopping list with collected items to build inventory automatically."}</div>`;
    $$("[data-inventory-type]").forEach(b=>b.classList.toggle("active",b.dataset.inventoryType===activeInventoryType));
    $("#inventoryPurposeNote").textContent=LIST_TYPE_COPY[activeInventoryType];
    $("#inventoryHeading").textContent=activeInventoryType==="grocery"?"Household inventory":activeInventoryType==="stock"?"Business stock inventory":"Service materials inventory";
    const panel=$("#businessPanel");panel.hidden=activeInventoryType!=="stock";
    if(activeInventoryType==="stock"){
      const costValue=typed.reduce((a,x)=>a+Number(x.qty||0)*Number(x.costPrice||0),0),salesValue=typed.reduce((a,x)=>a+Number(x.qty||0)*Number(x.sellPrice||0),0),sales=(state.sales||[]).filter(x=>x.type==="stock"),activeSales=sales.filter(x=>!x.reversed),revenue=activeSales.reduce((a,x)=>a+Number(x.revenue||0),0),profit=activeSales.reduce((a,x)=>a+Number(x.profit||0),0);
      $("#businessCostValue").textContent=money(costValue);$("#businessSalesValue").textContent=money(salesValue);$("#businessRevenue").textContent=money(revenue);$("#businessProfit").textContent=money(profit);
      const recent=sales.slice(0,12);$("#salesList").innerHTML=recent.length?recent.map(x=>`<article class="history-card ${x.reversed?"sale-reversed":""}" data-sale-id="${esc(x.id)}"><span class="history-icon">${x.reversed?"↶":"↗"}</span><div class="history-main"><b>${esc(x.name)}${x.reversed?" · REVERSED":""}</b><small>${date(x.date)} · ${qtyText(x.qty,x.unit)} ${esc(x.unit)} sold${x.reversed?` · Reversed ${date(x.reversedAt)}`:""}</small></div><strong>${money(x.revenue)}</strong><small>Profit ${money(x.profit)}</small>${x.reversed?"":`<button type="button" class="mini-action reverse-sale" data-sale-action="reverse" aria-label="Reverse sale of ${esc(x.name)}">↶</button>`}</article>`).join(""):`<div class="empty-state">No sales recorded yet. Use the R$ button beside a business stock item to record a sale.</div>`;
      renderProcurement();
      renderProductAnalytics(typed);
    }
    renderMovements();
  }
  function renderAll(){renderDashboard();renderItems();renderInventory();renderHistory();renderInsights();}
  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

  function normalizeBarcode(value){return String(value||'').trim().replace(/[\s-]+/g,'').toUpperCase();}
  function barcodeMatches(code,excludeId=''){
    const key=normalizeBarcode(code);if(!key)return [];
    const rows=[...state.items.map(x=>({...x,_source:'shopping'})),...state.inventory.map(x=>({...x,_source:'inventory'}))];
    return rows.filter(x=>x.id!==excludeId&&normalizeBarcode(x.barcode)===key);
  }
  async function lookupProductByBarcode(code,kind){
    const key=normalizeBarcode(code);if(!key)return null;
    const nameInput=kind==='stock'?$('#stockName'):$('#itemName');
    const status=kind==='stock'?$('#scannerStatus'):$('#shoppingScannerStatus');
    if(status)status.textContent='Barcode captured. Looking up product information…';
    // Open Food Facts is a public product catalogue; lookup is optional and never blocks saving.
    try{
      const response=await fetch('https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(key)+'.json?fields=product_name,product_name_en,brands,quantity,categories_tags,image_front_url',{headers:{'Accept':'application/json'}});
      if(!response.ok)throw new Error('Catalogue unavailable');
      const data=await response.json();
      if(data.status!==1||!data.product){if(status)status.textContent='Barcode captured: '+key+'. No product record found; enter the item name manually.';return null;}
      const p=data.product;const productName=String(p.product_name_en||p.product_name||'').trim();
      if(productName&&nameInput&&!nameInput.value.trim())nameInput.value=productName;
      if(kind==='shopping'&&p.quantity&&!$('#itemNotes').value.trim())$('#itemNotes').value='Pack size: '+p.quantity;
      const details=[productName,p.brands?'Brand: '+p.brands:'',p.quantity?'Pack: '+p.quantity:''].filter(Boolean).join(' · ');
      if(status)status.textContent='Product found: '+(details||key)+'. Check the item name before saving.';
      return p;
    }catch(err){if(status)status.textContent='Barcode captured: '+key+'. Product lookup unavailable; you can still save the item manually.';return null;}
  }
  function warnDuplicateBarcode(code,excludeId=''){
    const matches=barcodeMatches(code,excludeId);if(!matches.length)return false;
    const first=matches[0];
    return !confirm('This barcode is already assigned to “'+first.name+'” ('+first._source+'). Save another record with the same barcode anyway?');
  }

  const FORM_CATEGORIES = {
    grocery:["Groceries","Vegetables","Fruit","Dairy","Bakery","Meat & Fish","Frozen","Drinks","Pantry","Household Items","Clothing & Accessories","Electronics","Personal Care & Health","Education & Office","Other Purchases","Other"],
    stock:["Business Products","Equipment","Packaging","Stationery","Electronics","Clothing & Accessories","Tools & Equipment","Homeware","Automotive","Other"],
    material:["Building Materials","Electrical","Plumbing","Cleaning","Tools & Equipment","Decorating","Catering Supplies","Other"]
  };
  const PURPOSE_META={
    grocery:{title:"Groceries",eyebrow:"HOUSEHOLD GROCERY FORM",name:"Grocery item",placeholder:"e.g. Full cream milk",icon:"🛒"},
    stock:{title:"Business stock",eyebrow:"BUSINESS STOCK PURCHASE FORM",name:"Product name",placeholder:"e.g. Wireless earbuds",icon:"📦"},
    material:{title:"Service materials",eyebrow:"SERVICE MATERIALS FORM",name:"Material name",placeholder:"e.g. PVC pipe, paint or cleaning chemical",icon:"🧰"}
  };
  let activePurpose="grocery";
  let purposeDrafts={grocery:{},stock:{},material:{}};
  const units=['each','pack','kg','g','litre','ml','dozen','box','bottle','metre','roll','pair','set','sheet','bag'];
  function fieldLabel(id,label,value,placeholder='',type='text',attrs=''){
    return `<label>${label}<input id="${id}" type="${type}" value="${esc(value??'')}" placeholder="${esc(placeholder)}" ${attrs}></label>`;
  }
  function selectField(id,label,options,value){
    return `<label>${label}<select id="${id}">${options.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
  }
  function formValues(){
    const ids=['itemName','itemQty','itemUnit','itemCategory','itemPriority','itemPrice','itemStore','itemLocation','itemNotes','itemSku','itemSellPrice','itemReorder','itemProject','itemService','itemBarcode'];
    const out={};ids.forEach(id=>{const el=document.getElementById(id);if(el)out[id]=el.value;});return out;
  }
  function renderPurposeFields(values={}){
    const type=activePurpose,meta=PURPOSE_META[type],cats=FORM_CATEGORIES[type];
    $$('.purpose-option').forEach(btn=>{const on=btn.dataset.purpose===type;btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',String(on));});
    $('#itemType').value=type;$('#itemEyebrow').textContent=meta.eyebrow;
    $('#itemDialogTitle').textContent=($('#editId').value?'Edit ':'Add ')+meta.title.toLowerCase()+' item';
    const qty=values.itemQty||1,unit=values.itemUnit||'each',category=cats.includes(values.itemCategory)?values.itemCategory:'Other';
    let specific='';
    if(type==='grocery'){
      specific=`<div class="form-section-title">GROCERY DETAILS</div><div class="form-two">${selectField('itemCategory','Grocery category',cats,category)}${selectField('itemPriority','Priority',['Low','Medium','High'],(values.itemPriority||'medium').replace(/^./,c=>c.toUpperCase()))}</div>${fieldLabel('itemPrice','Estimated unit price',values.itemPrice,'0.00','number','min="0" step="0.01"')}<div class="form-two supplier-fields">${fieldLabel('itemStore','Store name',values.itemStore,'e.g. Checkers, Shoprite, Makro')}${fieldLabel('itemLocation','Store location',values.itemLocation,'e.g. Komatipoort, town centre')}</div><label>Notes<textarea id="itemNotes" rows="3" maxlength="300" placeholder="Brand, size or household notes…">${esc(values.itemNotes||'')}</textarea></label>`;
    }else if(type==='stock'){
      specific=`<div class="form-section-title">PRODUCT & RESELLING DETAILS</div><div class="form-two">${selectField('itemCategory','Product category',cats,category)}${fieldLabel('itemSku','SKU / product code',values.itemSku,'Optional product code')}</div><div class="form-two">${fieldLabel('itemPrice','Purchase cost per unit',values.itemPrice,'0.00','number','min="0" step="0.01"')}${fieldLabel('itemSellPrice','Planned selling price',values.itemSellPrice,'0.00','number','min="0" step="0.01"')}</div><div class="form-two">${fieldLabel('itemReorder','Minimum / reorder level',values.itemReorder,'e.g. 5','number','min="0" step="1"')}${selectField('itemPriority','Purchase priority',['Low','Medium','High'],(values.itemPriority||'medium').replace(/^./,c=>c.toUpperCase()))}</div><div class="form-section-title">SUPPLIER DETAILS</div><div class="form-two supplier-fields">${fieldLabel('itemStore','Supplier / store name',values.itemStore,'e.g. wholesaler or Makro')}${fieldLabel('itemLocation','Supplier location',values.itemLocation,'City, area or branch')}</div><label>Product notes<textarea id="itemNotes" rows="3" maxlength="300" placeholder="Brand, model, colour, warranty or pack details…">${esc(values.itemNotes||'')}</textarea></label><p class="field-help">Purchase cost and planned selling price are estimates. Profit calculations can be added in a later stock-management milestone.</p>`;
    }else{
      specific=`<div class="form-section-title">MATERIAL & JOB DETAILS</div><div class="form-two">${selectField('itemCategory','Material category',cats,category)}${fieldLabel('itemProject','Project / job name',values.itemProject,'e.g. Office repainting')}</div>${fieldLabel('itemService','Service being delivered',values.itemService,'e.g. Painting, plumbing, catering') }<div class="form-two">${fieldLabel('itemPrice','Estimated cost per unit',values.itemPrice,'0.00','number','min="0" step="0.01"')}${selectField('itemPriority','Purchase priority',['Low','Medium','High'],(values.itemPriority||'medium').replace(/^./,c=>c.toUpperCase()))}</div><div class="form-section-title">SUPPLIER DETAILS</div><div class="form-two supplier-fields">${fieldLabel('itemStore','Supplier / store name',values.itemStore,'e.g. building supplier')}${fieldLabel('itemLocation','Supplier location',values.itemLocation,'City, area or branch')}</div><label>Material notes<textarea id="itemNotes" rows="3" maxlength="300" placeholder="Specification, colour, size or job instructions…">${esc(values.itemNotes||'')}</textarea></label>`;
    }
    $('#purposeFormFields').innerHTML=`<div class="purpose-fields">${fieldLabel('itemName',type==='grocery'?'Item name':type==='stock'?'Business item name':'Purchase item name',values.itemName,meta.placeholder,'text','required maxlength="100"')}<div class="form-two">${fieldLabel('itemQty','Quantity',qty,'1','number','min="0.01" max="999999" step="any" required')}${selectField('itemUnit','Unit',units,unit)}</div><div class="form-two barcode-entry">${fieldLabel('itemBarcode','Barcode / EAN / UPC',values.itemBarcode,'Scan or enter barcode','text','maxlength="80" inputmode="numeric"')}<button type="button" class="secondary-btn scan-trigger" id="scanShoppingBarcode">▦ Scan barcode</button></div><div id="shoppingBarcodeScanner" class="barcode-scanner" hidden><video id="shoppingBarcodeVideo" playsinline muted></video><p id="shoppingScannerStatus" class="dialog-note">Point the camera at a product barcode.</p><div class="scanner-actions"><button type="button" class="secondary-btn" id="shoppingScannerTorch" hidden>🔦 Light off</button><button type="button" class="secondary-btn" id="stopShoppingScanner">Stop camera</button></div></div>${specific}</div>`;
  }
  $$('.purpose-option').forEach(btn=>btn.addEventListener('click',()=>{purposeDrafts[activePurpose]=formValues();activePurpose=btn.dataset.purpose;renderPurposeFields(purposeDrafts[activePurpose]||{});}));
  function openItem(id){
    const i=state.items.find(x=>x.id===id),type=i?.type||'grocery';activePurpose=type;purposeDrafts={grocery:{},stock:{},material:{}};
    purposeDrafts[type]=i?{itemName:i.name,itemQty:i.qty,itemUnit:i.unit,itemCategory:i.category,itemPriority:i.priority,itemPrice:i.price,itemStore:i.store,itemLocation:i.location,itemNotes:i.notes,itemSku:i.sku,itemSellPrice:i.sellPrice,itemReorder:i.reorder,itemProject:i.project,itemService:i.service,itemBarcode:i.barcode}:{};
    renderPurposeFields(purposeDrafts[type]);
    $('#editId').value=i?.id||'';openDialog('itemDialog');setTimeout(()=>$('#itemName').focus(),100);
  }

  let shoppingScannerStream=null,shoppingScanFrame=0,stockScanFrame=0,activeScannerKind=null;
  function stopShoppingBarcodeScanner(){if(shoppingScanFrame)cancelAnimationFrame(shoppingScanFrame);shoppingScanFrame=0;if(shoppingScannerStream){shoppingScannerStream.getTracks().forEach(t=>t.stop());shoppingScannerStream=null;}const v=$('#shoppingBarcodeVideo');if(v){v.pause();v.srcObject=null;}const panel=$('#shoppingBarcodeScanner');if(panel)panel.hidden=true;if(activeScannerKind==='shopping')activeScannerKind=null;}
  function stopBarcodeScanner(){if(stockScanFrame)cancelAnimationFrame(stockScanFrame);stockScanFrame=0;if(scannerStream){scannerStream.getTracks().forEach(t=>t.stop());scannerStream=null;}const v=$('#barcodeVideo');if(v){v.pause();v.srcObject=null;}const panel=$('#barcodeScanner');if(panel)panel.hidden=true;if(activeScannerKind==='stock')activeScannerKind=null;}
  function scannerEnvironment(){
    const secure=window.isSecureContext===true;
    const media=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
    const detector=typeof window.BarcodeDetector==='function';
    return {secure,media,detector,protocol:location.protocol,host:location.hostname};
  }
  function scannerUnavailableMessage(){
    const e=scannerEnvironment();
    if(!e.secure)return 'Camera blocked: this page is not a secure context. Open Shopping Master from an HTTPS website or localhost.';
    if(!e.media)return 'Camera API unavailable in this browser tab. Local content:// files may not be allowed to use the camera. Open the app over HTTPS or localhost.';
    if(!e.detector)return 'Camera is available, but this Chrome version has no built-in offline barcode decoder. Update Chrome or use manual barcode entry.';
    return '';
  }
  async function startBarcodeScan(kind){
    const stock=kind==='stock';
    const input=$(stock?'#stockBarcode':'#itemBarcode');
    const video=$(stock?'#barcodeVideo':'#shoppingBarcodeVideo');
    const panel=$(stock?'#barcodeScanner':'#shoppingBarcodeScanner');
    const status=$(stock?'#scannerStatus':'#shoppingScannerStatus');
    const stop=stock?stopBarcodeScanner:stopShoppingBarcodeScanner;
    stop();
    if(!input||!video||!panel||!status){notify('Scanner interface could not be opened. Close and reopen the item form.','error');return;}
    const unavailable=scannerUnavailableMessage();
    if(unavailable){panel.hidden=false;status.textContent=unavailable;notify(unavailable,'error');return;}
    try{
      let formats=['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','qr_code'];
      if(typeof window.BarcodeDetector.getSupportedFormats==='function'){
        const supported=await window.BarcodeDetector.getSupportedFormats();
        formats=formats.filter(f=>supported.includes(f));
      }
      if(!formats.length)throw new Error('This browser does not support common product barcode formats.');
      const detector=new window.BarcodeDetector({formats});
      panel.hidden=false;status.textContent='Opening rear camera…';
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}});
      if(stock)scannerStream=stream;else shoppingScannerStream=stream;
      activeScannerKind=kind;
      const track=stream.getVideoTracks()[0];
      const caps=track.getCapabilities?track.getCapabilities():{};
      const settings=track.getSettings?track.getSettings():{};
      // Autofocus is device-dependent. Prefer continuous mode and fall back to single-shot when offered.
      try{
        if(caps.focusMode){
          const mode=caps.focusMode.includes('continuous')?'continuous':(caps.focusMode.includes('single-shot')?'single-shot':null);
          if(mode)await track.applyConstraints({advanced:[{focusMode:mode}]});
        }
      }catch(focusErr){}
      video.setAttribute('playsinline','');video.muted=true;video.autoplay=true;video.srcObject=stream;
      video.style.display='block';video.style.margin='0 auto';video.style.width='auto';video.style.maxWidth='100%';video.style.height='auto';video.style.maxHeight='360px';video.style.objectFit='contain';video.style.background='transparent';
      await video.play();
      // Keep the video preview proportional to the actual camera stream; don't stretch portrait video into a landscape box.
      if(video.videoWidth&&video.videoHeight)video.style.aspectRatio=video.videoWidth+'/'+video.videoHeight;
      status.textContent='Camera active · '+(settings.width||video.videoWidth)+' × '+(settings.height||video.videoHeight)+'. Start at the widest view; move closer only until the barcode is sharp and fills the guide.';
      const torchButton=$(stock?'#scannerTorch':'#shoppingScannerTorch');
      if(torchButton){torchButton.hidden=!(caps.torch===true);torchButton.dataset.enabled='false';torchButton.textContent='🔦 Light off';}
      // Expose a zoom control only when the camera reports hardware zoom support.
      let zoomControl=$(stock?'#scannerZoom':'#shoppingScannerZoom');
      if(!zoomControl){
        const actions=panel.querySelector('.scanner-actions');
        if(actions){zoomControl=document.createElement('label');zoomControl.id=stock?'scannerZoom':'shoppingScannerZoom';zoomControl.className='scanner-zoom';zoomControl.innerHTML='<span>Zoom</span><input type="range" min="1" max="3" step="0.1" value="1" aria-label="Camera zoom">';actions.prepend(zoomControl);}
      }
      if(zoomControl){
        const range=zoomControl.querySelector('input');
        const zoom=caps.zoom;
        zoomControl.hidden=!(zoom&&range);
        if(zoom&&range){
          // Some Android cameras expose sub-1x zoom (ultra-wide). Do not clamp it to 1x.
          const minZoom=Number.isFinite(zoom.min)?zoom.min:1;
          const maxZoom=Math.min(5,Number.isFinite(zoom.max)?zoom.max:3);
          range.min=String(minZoom);range.max=String(maxZoom);range.step=String(zoom.step||0.1);
          const startZoom=Math.max(minZoom,Math.min(maxZoom,1));range.value=String(startZoom);
          const zoomLabel=zoomControl.querySelector('span');
          if(zoomLabel)zoomLabel.textContent='Zoom '+startZoom.toFixed(1)+'×';
          range.oninput=async()=>{const value=Number(range.value);if(zoomLabel)zoomLabel.textContent='Zoom '+value.toFixed(1)+'×';try{await track.applyConstraints({advanced:[{zoom:value}]});}catch(e){status.textContent='This camera cannot apply that zoom level.';}};
          // Explicitly begin at the widest supported camera view.
          try{await track.applyConstraints({advanced:[{zoom:minZoom}]});range.value=String(minZoom);if(zoomLabel)zoomLabel.textContent='Zoom '+minZoom.toFixed(1)+'×';}catch(e){}
        }
      }
      let busy=false, lastRead=0;
      const scan=async()=>{
        if(stock?!scannerStream:!shoppingScannerStream)return;
        if(!busy&&video.readyState>=2&&video.videoWidth>0&&Date.now()-lastRead>180){
          busy=true;lastRead=Date.now();
          try{
            const codes=await detector.detect(video);
            if(codes&&codes.length&&codes[0].rawValue){
              const value=codes[0].rawValue;
              input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
              status.textContent='Barcode captured: '+value;
              stop();notify('Barcode captured successfully');
              lookupProductByBarcode(value,stock?'stock':'shopping');return;
            }
          }catch(readErr){status.textContent='Camera is active, but no barcode was decoded. Move closer, keep the code flat, improve lighting, and allow the camera to focus.';}
          finally{busy=false;}
        }
        if(stock)stockScanFrame=requestAnimationFrame(scan);else shoppingScanFrame=requestAnimationFrame(scan);
      };
      scan();
    }catch(err){
      stop();let msg='Could not start barcode scanning. ';
      if(err&&err.name==='NotAllowedError')msg+='Camera permission was denied. Allow camera access for this site in Chrome settings.';
      else if(err&&err.name==='NotFoundError')msg+='No camera was found on this device.';
      else if(err&&err.name==='NotReadableError')msg+='The camera is busy. Close other camera apps and try again.';
      else msg+=(err&&err.message?err.message:'Check camera permission and open the app over HTTPS or localhost.');
      if(status){panel.hidden=false;status.textContent=msg;}notify(msg,'error');
    }
  }
  // Capture-phase delegation makes scanner controls respond even when the icon/text inside is tapped.
  document.addEventListener('click',e=>{
    const target=e.target instanceof Element?e.target:null;if(!target)return;
    const scan=target.closest('#scanBarcode,#scanShoppingBarcode');
    if(scan){e.preventDefault();e.stopImmediatePropagation();startBarcodeScan(scan.id==='scanBarcode'?'stock':'shopping');return;}
    const torch=target.closest('#scannerTorch,#shoppingScannerTorch');
    if(torch){e.preventDefault();const stream=torch.id==='scannerTorch'?scannerStream:shoppingScannerStream;const track=stream&&stream.getVideoTracks()[0];if(!track)return;const next=torch.dataset.enabled!=='true';track.applyConstraints({advanced:[{torch:next}]}).then(()=>{torch.dataset.enabled=String(next);torch.textContent=next?'🔦 Light on':'🔦 Light off';}).catch(()=>{torch.hidden=true;notify('Flashlight control is not supported by this camera.');});return;}
    if(target.closest('#stopScanner')){e.preventDefault();stopBarcodeScanner();return;}
    if(target.closest('#stopShoppingScanner')){e.preventDefault();stopShoppingBarcodeScanner();}
  },true);
  $('#itemDialog').addEventListener('close',stopShoppingBarcodeScanner);
  document.addEventListener('focusout',e=>{if(e.target&&e.target.id==='itemBarcode'&&e.target.value.trim())lookupProductByBarcode(e.target.value,'shopping');if(e.target&&e.target.id==='stockBarcode'&&e.target.value.trim())lookupProductByBarcode(e.target.value,'stock');});

  $('#itemForm').addEventListener('submit',e=>{
    e.preventDefault();const name=$('#itemName').value.trim();if(!name){notify('Enter an item name.');return;}
    const id=$('#editId').value,existing=state.items.find(i=>i.id===id),read=id=>document.getElementById(id)?.value||'';purposeDrafts[activePurpose]=formValues();
    const priority=(read('itemPriority')||'Medium').toLowerCase();
    const item={id:id||uid(),name,type:activePurpose,qty:Math.max(.01,Math.min(999999,Number(read('itemQty'))||1)),unit:read('itemUnit')||'each',category:read('itemCategory')||'Other',priority,price:Math.max(0,Number(read('itemPrice'))||0),store:read('itemStore').trim(),location:read('itemLocation').trim(),notes:read('itemNotes').trim(),sku:read('itemSku').trim(),sellPrice:Math.max(0,Number(read('itemSellPrice'))||0),reorder:Math.max(0,Number(read('itemReorder'))||0),project:read('itemProject').trim(),service:read('itemService').trim(),barcode:read('itemBarcode').trim(),done:existing?.done||false,created:existing?.created||Date.now()};
    if(item.barcode&&warnDuplicateBarcode(item.barcode,id))return;
    if(existing)Object.assign(existing,item);else state.items.unshift(item);
    activeListType=activePurpose;
    filters.category="all";
    $("#categoryFilter").value="all";
    save();closeDialog('itemDialog');renderAll();notify(existing?'Item updated':'Item added to your '+PURPOSE_META[activePurpose].title.toLowerCase()+' list');
  });
  $("#itemList").addEventListener("click",e=>{
    const btn=e.target.closest("[data-action]");if(!btn)return;const card=btn.closest("[data-id]"),id=card?.dataset.id,item=state.items.find(i=>i.id===id);if(!item)return;
    const action=btn.dataset.action;
    if(action==="toggle"){item.done=!item.done;save();renderAll();notify(item.done?"Marked as collected":"Moved back to your list");}
    if(action==="qty-plus"){item.qty=cleanQty(Math.min(999999,Number(item.qty||0)+qtyStep(item.unit)),item.unit,.01);save();renderAll();}
    if(action==="qty-minus"){item.qty=cleanQty(Math.max(.01,Number(item.qty||1)-qtyStep(item.unit)),item.unit,.01);save();renderAll();}
    if(action==="edit")openItem(id);
    if(action==="delete"&&confirm(`Delete "${item.name}" from your list?`)){state.items=state.items.filter(i=>i.id!==id);save();renderAll();notify("Item deleted");}
  });
  function checkout(){
    const scoped=state.items.filter(i=>(i.type||"grocery")===activeListType),done=scoped.filter(i=>i.done).length,left=scoped.length-done;
    $("#checkoutBought").textContent=done;$("#checkoutLeft").textContent=left;$("#checkoutTotal").textContent=money(totalCost(scoped));
    $("#checkoutMessage").textContent=`${TYPE_LABELS[activeListType]}: `+(left?`${left} unchecked item${left===1?" remains":"s remain"}. Completing now moves only collected items to history; the rest stay on your active list.`:"Everything in this list is checked off. You can complete it now.");
    $("#completeList").textContent=done?`Complete collected items (${done})`:"No collected items to complete";
    $("#completeList").disabled=!done;
    openDialog("checkoutDialog");
  }
  $("#completeList").addEventListener("click",()=>{
    const scoped=state.items.filter(i=>(i.type||"grocery")===activeListType),collected=scoped.filter(i=>i.done),left=scoped.length-collected.length;
    if(!collected.length){notify("Mark at least one item as collected before completing it.");return;}
    const pct=Math.round(collected.length/scoped.length*100);
    const session={id:uid(),date:Date.now(),type:activeListType,items:clone(collected),purchased:collected.length,pct,totalCost:totalCost(collected)};
    // Only collected items enter inventory and history. Unchecked items remain active.
    collected.forEach(i=>{
      const record=state.inventory.find(x=>x.name.trim().toLowerCase()===i.name.trim().toLowerCase()&&(x.type||"grocery")===(i.type||"grocery"));
      if(record){record.qty=Math.min(999999,Number(record.qty||0)+Number(i.qty||0));logStockMovement(record,Number(i.qty||0),"Shopping checkout received");record.unit=i.unit||record.unit;record.category=i.category||record.category;record.store=i.store||record.store;record.location=i.location||record.location;if(i.type==="stock"){record.costPrice=Number(i.price)||Number(record.costPrice)||0;record.sellPrice=Number(i.sellPrice)||Number(record.sellPrice)||0;}}
      else {const created={id:uid(),name:i.name,type:i.type||"grocery",qty:Number(i.qty)||1,min:Number(i.reorder)||1,unit:i.unit||"each",category:i.category||"Other",store:i.store||"",location:i.location||"",costPrice:i.type==="stock"?(Number(i.price)||0):0,sellPrice:i.type==="stock"?(Number(i.sellPrice)||0):0};state.inventory.push(created);logStockMovement(created,created.qty,"Shopping checkout received");}
    });
    state.history.unshift(session);state.stats.lists++;state.stats.items+=collected.length;state.stats.spend+=totalCost(collected);
    collected.forEach(i=>state.stats.category[i.category]=(state.stats.category[i.category]||0)+i.qty);
    const ids=new Set(collected.map(i=>i.id));state.items=state.items.filter(i=>!ids.has(i.id));save();closeDialog("checkoutDialog");renderAll();
    notify(left?`${collected.length} collected item(s) saved to history. ${left} unchecked item(s) remain on your active list.`:`${TYPE_LABELS[activeListType]} completed and saved to history.`);
  });
  $("#historyList").addEventListener("click",e=>{
    const b=e.target.closest("[data-action]");if(!b)return;const id=b.closest("[data-id]").dataset.id,h=state.history.find(x=>x.id===id);if(!h)return;
    if(b.dataset.action==="restore"){
      if(state.items.length&&!confirm("Replace your current active list with this restored list?"))return;
      state.items=h.items.map(i=>({...i,id:uid(),type:i.type||h.type||"grocery",done:false,created:Date.now()}));activeListType=h.type||state.items[0]?.type||"grocery";save();navigate("shopping");notify("Previous list restored");
    }else if(b.dataset.action==="history-delete"&&confirm("Delete this history record?")){
      state.history=state.history.filter(x=>x.id!==id);save();renderHistory();notify("History record deleted");
    }
  });
  function refreshStockPricing(){const isStock=$("#stockType").value==="stock";$("#stockPricingFields").hidden=!isStock;if(isStock){const c=Number($("#stockCost").value)||0,p=Number($("#stockSell").value)||0,margin=p>0?((p-c)/p*100):0;$("#stockMarginPreview").textContent=p?`Estimated profit per unit: ${money(p-c)} · Gross margin: ${margin.toFixed(1)}%`:`Enter a selling price to calculate margin.`;}}
  function openStock(id){pendingStockPhoto=null;const x=state.inventory.find(v=>v.id===id);$("#stockDialogTitle").textContent=x?"Edit inventory item":"Add inventory item";$("#stockEditId").value=x?.id||"";$("#stockType").value=x?.type||activeInventoryType;$("#stockName").value=x?.name||"";$("#stockQty").value=x?.qty??1;$("#stockMin").value=x?.min??1;$("#stockUnit").value=x?.unit||"each";$("#stockCategory").value=x?.category||"Other";$("#stockStore").value=x?.store||"";$("#stockLocation").value=x?.location||"";$("#stockCost").value=x?.costPrice??"";$("#stockSell").value=x?.sellPrice??"";$("#stockBarcode").value=x?.barcode||"";$("#stockPhoto").value="";$("#stockPhotoPreview").hidden=!x?.photo;$("#stockPhotoPreview").innerHTML=x?.photo?`<img src="${x.photo}" alt="Product preview"><span>Saved product photo</span>`:"";stopBarcodeScanner();refreshStockPricing();openDialog("stockDialog");}
  $("#stockPhoto").addEventListener("change",e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){notify("Choose an image file.","error");return;}if(file.size>8*1024*1024){notify("Choose an image smaller than 8 MB.","error");return;}const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const c=document.createElement("canvas"),scale=Math.min(1,640/Math.max(img.width,img.height));c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext("2d").drawImage(img,0,0,c.width,c.height);pendingStockPhoto=c.toDataURL("image/jpeg",.72);$("#stockPhotoPreview").hidden=false;$("#stockPhotoPreview").innerHTML=`<img src="${pendingStockPhoto}" alt="Product preview"><span>Photo ready · compressed for local storage</span>`;};img.src=reader.result;};reader.readAsDataURL(file);});
  let pendingStockPhoto=null;


  $("#stockType").addEventListener("change",refreshStockPricing);$("#stockCost").addEventListener("input",refreshStockPricing);$("#stockSell").addEventListener("input",refreshStockPricing);
  $("#stockForm").addEventListener("submit",e=>{e.preventDefault();const name=$("#stockName").value.trim();if(!name)return;const id=$("#stockEditId").value,old=state.inventory.find(x=>x.id===id),qty=Math.max(0,Number($("#stockQty").value)||0);const record={id:id||uid(),type:$("#stockType").value,name,qty,min:Math.max(0,Number($("#stockMin").value)||0),unit:$("#stockUnit").value,category:$("#stockCategory").value,store:$("#stockStore").value.trim(),location:$("#stockLocation").value.trim(),costPrice:Math.max(0,Number($("#stockCost").value)||0),sellPrice:Math.max(0,Number($("#stockSell").value)||0),barcode:$("#stockBarcode").value.trim(),photo:pendingStockPhoto!==null?pendingStockPhoto:(old?.photo||"")};if(record.barcode&&warnDuplicateBarcode(record.barcode,id))return;if(old){const delta=qty-Number(old.qty||0);Object.assign(old,record);if(delta)logStockMovement(old,delta,"Manual quantity adjustment");}else{state.inventory.push(record);if(qty)logStockMovement(record,qty,"Opening balance");}pendingStockPhoto=null;activeInventoryType=record.type;stopBarcodeScanner();save();closeDialog("stockDialog");renderInventory();notify(old?"Inventory item updated":"Inventory item added");});
  $("#inventoryList").addEventListener("click",e=>{const b=e.target.closest("[data-stock-action]");if(!b)return;const card=b.closest("[data-stock-id]"),x=state.inventory.find(v=>v.id===card.dataset.stockId);if(!x)return;const a=b.dataset.stockAction;if(a==="sale"){if(Number(x.qty)<=0){notify("No stock available to sell.","error");return;}$("#saleStockId").value=x.id;$("#saleProductName").textContent=`${x.name} · Available: ${qtyText(x.qty,x.unit)} ${x.unit}`;$("#saleQty").max=String(x.qty);$("#saleQty").value="1";$("#salePrice").value=Number(x.sellPrice)||0;updateSalePreview();openDialog("saleDialog");return;}if(a==="edit")openStock(x.id);if(a==="plus"){const step=qtyStep(x.unit);x.qty=cleanQty(Math.min(99999,Number(x.qty)+step),x.unit,0);logStockMovement(x,step,"Manual stock increase");}if(a==="minus"){if(Number(x.qty)>0){const step=qtyStep(x.unit);const delta=Math.min(step,Number(x.qty));x.qty=cleanQty(Math.max(0,Number(x.qty)-step),x.unit,0);logStockMovement(x,-delta,"Manual stock decrease");}}if(a==="plus"||a==="minus"){save();renderInventory();}if(a==="restock"){const existing=state.items.find(i=>i.name.toLowerCase()===x.name.toLowerCase()&&(i.type||"grocery")===(x.type||"grocery")&&!i.done);if(existing){existing.qty+=Math.max(1,Number(x.min)-Number(x.qty));}else state.items.unshift({id:uid(),name:x.name,type:x.type||"grocery",qty:Math.max(1,Number(x.min)-Number(x.qty)),unit:x.unit,category:x.category,priority:"medium",price:0,store:x.store||"",location:x.location||"",notes:"Restock from inventory",done:false,created:Date.now()});activeListType=x.type||"grocery";save();renderAll();navigate("shopping");notify(`Restock item added to ${TYPE_LABELS[activeListType]} list`);}});
  $("#addStockTop").addEventListener("click",()=>openStock());$$("[data-inventory-type]").forEach(b=>b.addEventListener("click",()=>{activeInventoryType=b.dataset.inventoryType;$("#stockSearch").value="";$("#stockFilter").value="all";renderInventory();}));$("#stockSearch").addEventListener("input",renderInventory);$("#stockFilter").addEventListener("change",renderInventory);
  $("#reorderQueue").addEventListener("click",e=>{const b=e.target.closest("[data-restock-one]");if(!b)return;const item=state.inventory.find(x=>x.id===b.dataset.restockOne);if(!item)return;const qty=addInventoryRestockToList(item);save();renderAll();notify(`${item.name}: ${qty} ${item.unit||"each"} added to ${TYPE_LABELS[item.type||"grocery"]} list`);});
  $("#addAllRestock").addEventListener("click",()=>{const low=state.inventory.filter(x=>(x.type||"grocery")===activeInventoryType&&Number(x.qty)<=Number(x.min));if(!low.length){notify("There are no low-stock items to add.");return;}let count=0;low.forEach(x=>{addInventoryRestockToList(x);count++;});save();renderAll();notify(`${count} low-stock products added to their matching lists`);});
  function renderProcurement(){
    state.suppliers=Array.isArray(state.suppliers)?state.suppliers:[];
    state.purchaseOrders=Array.isArray(state.purchaseOrders)?state.purchaseOrders:[];
    const supplierList=$("#supplierList"),orderList=$("#purchaseOrderList");
    if(!supplierList||!orderList)return;
    supplierList.innerHTML=state.suppliers.length?state.suppliers.map(v=>`<article class="history-card supplier-card" data-supplier-id="${esc(v.id)}"><span class="history-icon">🏢</span><div class="history-main"><b>${esc(v.name)}</b><small>${esc(v.contact||"No contact person")}${v.phone?" · "+esc(v.phone):""}${v.email?" · "+esc(v.email):""}${v.location?" · "+esc(v.location):""}</small>${v.notes?`<small>${esc(v.notes)}</small>`:""}</div><div class="history-actions"><button type="button" class="mini-action" data-supplier-action="edit" aria-label="Edit ${esc(v.name)}">✎</button><button type="button" class="mini-action" data-supplier-action="delete" aria-label="Delete ${esc(v.name)}">×</button></div></article>`).join(""):`<div class="empty-state">No suppliers added yet. Add your regular wholesalers, shops and service-material suppliers.</div>`;
    const orders=[...state.purchaseOrders].sort((a,b)=>Number(b.created||0)-Number(a.created||0));
    const pending=orders.filter(o=>o.status==="ordered"||o.status==="draft").length;
    $("#poPendingCount").textContent=pending;$("#poOpenValue").textContent=money(orders.filter(o=>o.status==="ordered"||o.status==="draft").reduce((a,o)=>a+Number(o.qty||0)*Number(o.unitCost||0),0));
    orderList.innerHTML=orders.length?orders.map(o=>`<article class="history-card po-card ${o.status==="received"?"po-received":""}" data-po-id="${esc(o.id)}"><span class="history-icon">${o.status==="received"?"✓":o.status==="cancelled"?"×":"▤"}</span><div class="history-main"><b>${esc(o.productName)} · ${esc(o.supplierName)}</b><small>${date(o.created)} · ${o.qty} ${esc(o.unit)} × ${money(o.unitCost)} · Total ${money(Number(o.qty)*Number(o.unitCost))}</small><small>Expected: ${o.expectedDate?esc(o.expectedDate):"Not set"} · <strong class="po-status ${esc(o.status)}">${esc(o.status.toUpperCase())}</strong>${o.receivedAt?" · Received "+date(o.receivedAt):""}</small>${o.notes?`<small>${esc(o.notes)}</small>`:""}</div><div class="po-actions">${o.status==="draft"?`<button type="button" class="mini-action" data-po-action="order" aria-label="Mark order as placed">↗</button>`:""}${o.status==="ordered"?`<button type="button" class="mini-action po-receive" data-po-action="receive" aria-label="Receive purchase order">✓</button>`:""}${(o.status==="draft"||o.status==="ordered")?`<button type="button" class="mini-action" data-po-action="cancel" aria-label="Cancel purchase order">×</button>`:""}</div></article>`).join(""):`<div class="empty-state">No purchase orders yet. Create an order to track supplier purchases from placement through receiving.</div>`;
    state.supplierPrices=Array.isArray(state.supplierPrices)?state.supplierPrices:[];
    const quoteGroups={};state.supplierPrices.forEach(q=>{const key=String(q.productName||"").trim().toLowerCase();if(!key)return;(quoteGroups[key]??=[]).push(q);});
    const comparison=$("#supplierPriceComparison");
    const groupRows=Object.values(quoteGroups).sort((a,b)=>a[0].productName.localeCompare(b[0].productName));
    comparison.innerHTML=groupRows.length?groupRows.map(group=>{const sorted=[...group].sort((a,b)=>Number(a.unitCost)-Number(b.unitCost));const best=sorted[0];return `<article class="price-compare-card"><div class="price-compare-head"><b>${esc(best.productName)}</b><span class="price-best">LOWEST ${money(best.unitCost)} / ${esc(best.unit||"each")}</span></div>${sorted.map((q,index)=>`<div class="price-compare-row"><span>${esc(q.supplierName)}</span><strong>${money(q.unitCost)} / ${esc(q.unit||"each")}</strong><small>${q.quoteDate?esc(q.quoteDate):date(q.created)}${q.notes?" · "+esc(q.notes):""}</small><button type="button" class="mini-action" data-quote-delete="${esc(q.id)}" aria-label="Delete quote">×</button></div>`).join("")}</article>`;}).join(""):`<div class="empty-state">No supplier quotes recorded. Add at least two quotes for a product to compare supplier costs.</div>`;
    const quoteSupplier=$("#quoteSupplier");if(quoteSupplier){const old=quoteSupplier.value;quoteSupplier.innerHTML='<option value="">Choose supplier</option>'+state.suppliers.map(v=>`<option value="${esc(v.id)}">${esc(v.name)}</option>`).join("");if(state.suppliers.some(v=>v.id===old))quoteSupplier.value=old;}
    const supplierSelect=$("#poSupplier");
    if(supplierSelect){const old=supplierSelect.value;supplierSelect.innerHTML='<option value="">Choose supplier</option>'+state.suppliers.map(v=>`<option value="${esc(v.id)}">${esc(v.name)}</option>`).join("");if(state.suppliers.some(v=>v.id===old))supplierSelect.value=old;}
  }
  function renderProductAnalytics(stockItems){
    const now=Date.now(),since=now-30*86400000;
    const sales=(state.sales||[]).filter(s=>s.type==="stock"&&!s.reversed&&Number(s.date)>=since);
    const units=sales.reduce((a,s)=>a+Number(s.qty||0),0),profit=sales.reduce((a,s)=>a+Number(s.profit||0),0);
    $("#analyticsUnits30").textContent=units.toLocaleString("en-ZA");$("#analyticsProfit30").textContent=money(profit);
    const rows=stockItems.map(item=>{const sold=sales.filter(s=>s.inventoryId===item.id);const qty=sold.reduce((a,s)=>a+Number(s.qty||0),0);const revenue=sold.reduce((a,s)=>a+Number(s.revenue||0),0);const gross=sold.reduce((a,s)=>a+Number(s.profit||0),0);const daily=qty/30;const cover=daily>0?Number(item.qty||0)/daily:null;const suggested=daily>0?Math.max(0,Math.ceil(daily*30-Number(item.qty||0))):null;return {...item,sold30:qty,revenue30:revenue,profit30:gross,cover,suggested};}).sort((a,b)=>b.profit30-a.profit30||b.sold30-a.sold30);
    $("#productAnalytics").innerHTML=rows.length?rows.map(x=>`<article class="product-analytics-card"><div class="price-compare-head"><b>${esc(x.name)}</b><strong>${money(x.profit30)} profit</strong></div><div class="analytics-stats"><span>Sold 30d <b>${x.sold30} ${esc(x.unit||"each")}</b></span><span>Revenue <b>${money(x.revenue30)}</b></span><span>Stock cover <b>${x.cover===null?"No sales data":x.cover.toFixed(1)+" days"}</b></span><span>30d reorder estimate <b>${x.suggested===null?"Not available":x.suggested+" units"}</b></span></div></article>`).join(""):`<div class="empty-state">Add business stock products to see performance analytics.</div>`;
  }
  function openSupplier(id){const v=state.suppliers.find(x=>x.id===id);$("#supplierEditId").value=v?.id||"";$("#supplierName").value=v?.name||"";$("#supplierContact").value=v?.contact||"";$("#supplierPhone").value=v?.phone||"";$("#supplierEmail").value=v?.email||"";$("#supplierLocation").value=v?.location||"";$("#supplierNotes").value=v?.notes||"";$("#supplierDialogTitle").textContent=v?"Edit supplier":"Add supplier";openDialog("supplierDialog");}
  function openPurchaseOrder(){if(!state.suppliers.length){notify("Add a supplier before creating a purchase order.","error");openSupplier();return;}$("#poForm").reset();$("#poQty").value="1";$("#poUnitCost").value="0.00";renderProcurement();openDialog("purchaseOrderDialog");}
  $("#addSupplierBtn").addEventListener("click",()=>openSupplier());
  $("#supplierForm").addEventListener("submit",e=>{e.preventDefault();const id=$("#supplierEditId").value,name=$("#supplierName").value.trim();if(!name)return;const record={id:id||uid(),name,contact:$("#supplierContact").value.trim(),phone:$("#supplierPhone").value.trim(),email:$("#supplierEmail").value.trim(),location:$("#supplierLocation").value.trim(),notes:$("#supplierNotes").value.trim()};const old=state.suppliers.find(x=>x.id===id);if(old)Object.assign(old,record);else state.suppliers.push(record);save();closeDialog("supplierDialog");renderProcurement();notify(old?"Supplier updated":"Supplier added");});
  $("#supplierList").addEventListener("click",e=>{const b=e.target.closest("[data-supplier-action]");if(!b)return;const card=b.closest("[data-supplier-id]"),v=state.suppliers.find(x=>x.id===card?.dataset.supplierId);if(!v)return;if(b.dataset.supplierAction==="edit")openSupplier(v.id);if(b.dataset.supplierAction==="delete"){const linked=state.purchaseOrders.some(o=>o.supplierId===v.id);if(linked){notify("This supplier has purchase-order history and cannot be deleted.","error");return;}if(confirm(`Delete supplier ${v.name}?`)){state.suppliers=state.suppliers.filter(x=>x.id!==v.id);save();renderProcurement();notify("Supplier deleted");}}});
  $("#addSupplierPriceBtn").addEventListener("click",()=>{if(!state.suppliers.length){notify("Add a supplier before recording a quote.","error");openSupplier();return;}$("#supplierPriceForm").reset();$("#quoteDate").value=new Date().toISOString().slice(0,10);renderProcurement();openDialog("supplierPriceDialog");});
  $("#supplierPriceForm").addEventListener("submit",e=>{e.preventDefault();const supplier=state.suppliers.find(x=>x.id===$("#quoteSupplier").value),productName=$("#quoteProduct").value.trim(),unitCost=Number($("#quoteCost").value);if(!supplier||!productName||!Number.isFinite(unitCost)||unitCost<0){notify("Check the product, supplier and unit cost.","error");return;}state.supplierPrices=Array.isArray(state.supplierPrices)?state.supplierPrices:[];state.supplierPrices.unshift({id:uid(),created:Date.now(),productName,supplierId:supplier.id,supplierName:supplier.name,unitCost,unit:$("#quoteUnit").value,quoteDate:$("#quoteDate").value,notes:$("#quoteNotes").value.trim()});save();closeDialog("supplierPriceDialog");renderProcurement();notify("Supplier quote saved for comparison");});
  $("#exportSupplierPrices").addEventListener("click",()=>{const rows=[["Product","Supplier","Unit cost","Unit","Quote date","Notes"],...(state.supplierPrices||[]).map(q=>[q.productName,q.supplierName,q.unitCost,q.unit,q.quoteDate,q.notes])];const csv="\uFEFF"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");download("iswappro-supplier-price-comparison.csv",csv,"text/csv;charset=utf-8");notify(`${(state.supplierPrices||[]).length} supplier quotes exported`);});
  $("#supplierPriceComparison").addEventListener("click",e=>{const b=e.target.closest("[data-quote-delete]");if(!b)return;if(confirm("Delete this supplier quote?")){state.supplierPrices=(state.supplierPrices||[]).filter(q=>q.id!==b.dataset.quoteDelete);save();renderProcurement();notify("Supplier quote deleted");}});
  $("#createPurchaseOrderBtn").addEventListener("click",openPurchaseOrder);
  $("#poForm").addEventListener("submit",e=>{e.preventDefault();const supplier=state.suppliers.find(x=>x.id===$("#poSupplier").value),productName=$("#poProduct").value.trim(),qty=Number($("#poQty").value),unitCost=Number($("#poUnitCost").value);if(!supplier||!productName||!Number.isFinite(qty)||qty<=0||!Number.isFinite(unitCost)||unitCost<0){notify("Check the supplier, product, quantity and unit cost.","error");return;}state.purchaseOrders.unshift({id:uid(),created:Date.now(),supplierId:supplier.id,supplierName:supplier.name,productName,qty,unit:$("#poUnit").value,unitCost,expectedDate:$("#poExpectedDate").value,notes:$("#poNotes").value.trim(),status:"draft"});save();closeDialog("purchaseOrderDialog");renderProcurement();notify("Purchase order created as draft");});
  $("#purchaseOrderList").addEventListener("click",e=>{const b=e.target.closest("[data-po-action]");if(!b)return;const card=b.closest("[data-po-id]"),o=state.purchaseOrders.find(x=>x.id===card?.dataset.poId);if(!o)return;const action=b.dataset.poAction;if(action==="order"){o.status="ordered";o.orderedAt=Date.now();save();renderProcurement();notify("Purchase order marked as placed");}else if(action==="cancel"){if(confirm(`Cancel the purchase order for ${o.productName}?`)){o.status="cancelled";o.cancelledAt=Date.now();save();renderProcurement();notify("Purchase order cancelled");}}else if(action==="receive"){if(!confirm(`Receive ${o.qty} ${o.unit} of ${o.productName} into business stock?`))return;let item=state.inventory.find(x=>(x.type||"grocery")==="stock"&&x.name.trim().toLowerCase()===o.productName.trim().toLowerCase());if(item){const oldQty=Math.max(0,Number(item.qty)||0),oldCost=Math.max(0,Number(item.costPrice)||0),receivedQty=Number(o.qty),receivedCost=Number(o.unitCost);item.qty=oldQty+receivedQty;logStockMovement(item,receivedQty,"Purchase order received",o.supplierName);item.costHistory=Array.isArray(item.costHistory)?item.costHistory:[];item.costHistory.unshift({date:Date.now(),supplierId:o.supplierId,supplierName:o.supplierName,unitCost:receivedCost,qty:receivedQty,reference:o.id});item.costPrice=item.qty>0?((oldQty*oldCost)+(receivedQty*receivedCost))/item.qty:receivedCost;item.store=o.supplierName;}else{item={id:uid(),type:"stock",name:o.productName,qty:Number(o.qty),min:1,unit:o.unit,category:"Other",store:o.supplierName,location:"",costPrice:Number(o.unitCost),sellPrice:0,costHistory:[{date:Date.now(),supplierId:o.supplierId,supplierName:o.supplierName,unitCost:Number(o.unitCost),qty:Number(o.qty),reference:o.id}]};state.inventory.push(item);logStockMovement(item,Number(o.qty),"Purchase order received",o.supplierName);}o.inventoryId=item.id;o.status="received";o.receivedAt=Date.now();save();renderInventory();notify("Purchase order received and business stock updated");}});
  $("#exportMovements").addEventListener("click",()=>{migrateLegacyInventoryMovements();const records=[...(state.stockMovements||[])].sort((a,b)=>Number(b.date)-Number(a.date));const rows=[["Date","Purpose","Product","Change","Unit","Reason","Reference","Inventory ID"],...records.map(m=>[new Date(m.date).toISOString(),TYPE_LABELS[m.type]||m.type,m.name,m.delta,m.unit,m.reason,m.reference||"",m.inventoryId||""])];const csv="\uFEFF"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");download("iswappro-stock-movements.csv",csv,"text/csv;charset=utf-8");notify(records.length?`${records.length} stock movement records exported`:"No movements exist yet; an empty report was exported.",records.length?"ok":"error");});
  // V17: supplier quote comparison export, including the quoted supplier and unit.
  $("#exportPurchaseOrders").addEventListener("click",()=>{const rows=[["Created","Supplier","Product","Quantity","Unit","Unit cost","Order total","Expected date","Status","Notes"],...state.purchaseOrders.map(o=>[new Date(o.created).toISOString(),o.supplierName,o.productName,o.qty,o.unit,o.unitCost,Number(o.qty)*Number(o.unitCost),o.expectedDate,o.status,o.notes])];const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");download("iswappro-purchase-orders.csv",csv,"text/csv");});
  function reverseSale(saleId){
    const sale=(state.sales||[]).find(x=>x.id===saleId);
    if(!sale||sale.reversed)return;
    if(!confirm(`Reverse this sale of ${sale.name}? The sold quantity will be returned to inventory and the sale excluded from revenue/profit totals.`))return;
    const item=state.inventory.find(x=>x.id===sale.inventoryId);
    if(item){item.qty=Math.min(999999,Number(item.qty||0)+Number(sale.qty||0));logStockMovement(item,Number(sale.qty||0),"Sale reversed");}
    sale.reversed=true;sale.reversedAt=Date.now();
    save();renderInventory();notify(item?"Sale reversed and stock restored":"Sale reversed. Original inventory item was not found.",item?"ok":"error");
  }
  $("#salesList").addEventListener("click",e=>{const b=e.target.closest('[data-sale-action="reverse"]');if(!b)return;const card=b.closest("[data-sale-id]");if(card)reverseSale(card.dataset.saleId);});
  $("#exportSalesCsv").addEventListener("click",()=>{const rows=[["Sale date","Product","Quantity","Unit","Unit selling price","Unit cost","Revenue","Cost of goods sold","Gross profit","Status"],...(state.sales||[]).filter(x=>x.type==="stock").map(x=>[new Date(x.date).toISOString(),x.name,x.qty,x.unit,x.price,x.costPrice,x.revenue,x.cost,x.profit,x.reversed?"Reversed":"Recorded"])];const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");download("iswappro-business-sales.csv",csv,"text/csv");});
  function updateSalePreview(){const x=state.inventory.find(v=>v.id===$("#saleStockId").value);if(!x)return;const qty=Math.max(0,Number($("#saleQty").value)||0),price=Math.max(0,Number($("#salePrice").value)||0),revenue=qty*price,cost=qty*Number(x.costPrice||0);$("#salePreview").textContent=`Sale total: ${money(revenue)} · Estimated gross profit: ${money(revenue-cost)}`;}
  $("#saleQty").addEventListener("input",updateSalePreview);$("#salePrice").addEventListener("input",updateSalePreview);
  $("#saleForm").addEventListener("submit",e=>{e.preventDefault();const x=state.inventory.find(v=>v.id===$("#saleStockId").value),qty=Number($("#saleQty").value),price=Number($("#salePrice").value);if(!x||!Number.isFinite(qty)||qty<=0||qty>Number(x.qty)||!Number.isFinite(price)||price<0){notify("Check the sale quantity and selling price. Available stock cannot be exceeded.","error");return;}const revenue=qty*price,cost=qty*Number(x.costPrice||0);x.qty=Math.max(0,Number(x.qty)-qty);logStockMovement(x,-qty,"Sale recorded");x.sellPrice=price;state.sales=Array.isArray(state.sales)?state.sales:[];state.sales.unshift({id:uid(),date:Date.now(),type:"stock",inventoryId:x.id,name:x.name,qty,unit:x.unit,price,costPrice:Number(x.costPrice)||0,revenue,cost,profit:revenue-cost});save();closeDialog("saleDialog");renderInventory();notify(`Sale recorded · Gross profit ${money(revenue-cost)}`);});
  $("#recordSaleTop").addEventListener("click",()=>{const x=state.inventory.find(v=>(v.type||"grocery")==="stock"&&Number(v.qty)>0);if(!x){notify("Add business stock with available quantity first.");return;}$("#saleStockId").value=x.id;$("#saleProductName").textContent=`${x.name} · Available: ${qtyText(x.qty,x.unit)} ${x.unit}`;$("#saleQty").max=String(x.qty);$("#saleQty").value="1";$("#salePrice").value=Number(x.sellPrice)||0;updateSalePreview();openDialog("saleDialog");});
  function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $("#exportJson").addEventListener("click",()=>download("iswappro-shopping-master-backup.json",JSON.stringify(state,null,2),"application/json"));
  $("#exportCsv").addEventListener("click",()=>{const rows=[["Name","Purpose","Quantity","Unit","Category","Priority","Purchase unit cost","Line total","Store or supplier","Location","SKU","Planned selling price","Reorder level","Project or job","Service","Collected","Notes"],...state.items.map(i=>[i.name,TYPE_LABELS[i.type||"grocery"],i.qty,i.unit,i.category,i.priority,i.price,i.price*i.qty,i.store,i.location,i.sku,i.sellPrice,i.reorder,i.project,i.service,i.done,i.notes])];const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");download("iswappro-shopping-master-list.csv",csv,"text/csv");});
  $("#importJson").addEventListener("click",()=>$("#importFile").click());
  $("#importFile").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.items)||!Array.isArray(d.history)||!d.settings||!d.stats)throw Error();if(!confirm("Importing replaces the data in this browser. Continue?"))return;state={...clone(blank),...d,inventory:Array.isArray(d.inventory)?d.inventory:[],sales:Array.isArray(d.sales)?d.sales:[],suppliers:Array.isArray(d.suppliers)?d.suppliers:[],purchaseOrders:Array.isArray(d.purchaseOrders)?d.purchaseOrders:[],supplierPrices:Array.isArray(d.supplierPrices)?d.supplierPrices:[]};save();applyTheme();renderAll();notify("Backup imported successfully");}catch(err){notify("That backup file is invalid.","error");}};r.readAsText(f);e.target.value="";});
  function settingsOpen(){
    settingsDraft={...state.settings};
    $("#currencySelect").value=state.settings.currency||"ZAR";
    $("#budgetInput").value=state.settings.budget||"";
    $("#darkMode").checked=!!state.settings.dark;
    openDialog("settingsDialog");
  }
  $("#darkMode").addEventListener("change",e=>{
    state.settings.dark=e.target.checked;
    applyTheme();
  });
  $("#saveSettings").addEventListener("click",()=>{
    state.settings.currency=$("#currencySelect").value;
    state.settings.budget=Math.max(0,Number($("#budgetInput").value)||0);
    state.settings.dark=$("#darkMode").checked;
    settingsDraft=null;
    save();applyTheme();closeDialog("settingsDialog");renderAll();notify("Settings saved");
  });
  $("#settingsOpen").addEventListener("click",settingsOpen);
  $("#themeToggle").addEventListener("click",()=>{state.settings.dark=!state.settings.dark;save();applyTheme();});
  $("#searchFocus").addEventListener("click",()=>{navigate("shopping");$("#searchInput").focus();});
  $("#heroAdd").addEventListener("click",()=>openItem());
  $("#quickNew").addEventListener("click",()=>openItem());
  $("#quickShop").addEventListener("click",()=>navigate("shopping"));
  $("#quickCheckout").addEventListener("click",checkout);
  $("#addItemTop").addEventListener("click",()=>openItem());$("#mobileAdd").addEventListener("click",()=>openItem());
  $("#goCheckout").addEventListener("click",checkout);
  $("#setBudget").addEventListener("click",settingsOpen);
  $("#clearCollected").addEventListener("click",()=>{const scoped=state.items.filter(i=>(i.type||"grocery")===activeListType),n=scoped.filter(i=>i.done).length;if(!n){notify("No collected items in this list.");return;}if(confirm(`Remove ${n} collected ${TYPE_LABELS[activeListType].toLowerCase()} item(s)?`)){const ids=new Set(scoped.filter(i=>i.done).map(i=>i.id));state.items=state.items.filter(i=>!ids.has(i.id));save();renderAll();notify("Collected items removed from this list");}});
  $$("[data-view]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
  $$("[data-goto]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.goto)));
  $$("[data-close]").forEach(b=>b.addEventListener("click",()=>closeDialog(b.dataset.close)));
  $$("[data-list-type]").forEach(b=>b.addEventListener("click",()=>{activeListType=b.dataset.listType;filters.category="all";$("#categoryFilter").value="all";renderItems();}));
  $$("[data-report-type]").forEach(b=>b.addEventListener("click",()=>{activeReportType=b.dataset.reportType;renderInsights();}));
  $("#searchInput").addEventListener("input",e=>{filters.search=e.target.value;renderItems();});
  $("#categoryFilter").addEventListener("change",e=>{filters.category=e.target.value;renderItems();});
  $("#statusFilter").addEventListener("change",e=>{filters.status=e.target.value;renderItems();});
  $("#sortSelect").addEventListener("change",e=>{filters.sort=e.target.value;renderItems();});
  document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();navigate("shopping");$("#searchInput").focus();}if(e.key==="Escape")$$("dialog[open]").forEach(d=>closeDialog(d.id));});
  applyTheme();renderAll();
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
})();
