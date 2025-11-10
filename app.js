
let map, geocoder, placesService, infoWindow;
let markers = new Map();
let selectedId = null;
const STORE_KEY = "my-restaurant-map:v1";
const $ = id => document.getElementById(id);

function loadStore(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {places:[]}; } catch{ return {places:[]}; } }
function saveStore(d){ localStorage.setItem(STORE_KEY, JSON.stringify(d)); }
function uid(){ return "r_"+Date.now()+"_"+Math.random().toString(36).slice(2,8); }

function initMap(){
  geocoder = new google.maps.Geocoder();
  map = new google.maps.Map(document.getElementById("map"), { center:{lat:25.033964,lng:121.564468}, zoom:13, mapTypeControl:false });
  infoWindow = new google.maps.InfoWindow();
  placesService = new google.maps.places.PlacesService(map);
  if(navigator.geolocation){ navigator.geolocation.getCurrentPosition(p=>{ map.setCenter({lat:p.coords.latitude,lng:p.coords.longitude}); map.setZoom(14); }); }
  setupUI(); renderAll();
}

function setupUI(){
  const fabMain=$("fab-main"), fabMenu=$("fab-menu");
  fabMain.addEventListener("click",()=>fabMenu.classList.toggle("hidden"));
  $("btn-search").addEventListener("click",()=>{ $("dlg-search").showModal(); fabMenu.classList.add("hidden"); });
  $("btn-address").addEventListener("click",()=>{ $("dlg-address").showModal(); fabMenu.classList.add("hidden"); });
  $("btn-export").addEventListener("click", onExport);
  $("importFile").addEventListener("change", onImport);
  $("searchBtn").addEventListener("click", onGoogleSearch);
  $("geocodeBtn").addEventListener("click", onGeocode);
  $("saveBtn").addEventListener("click", onSave);
  $("deleteBtn").addEventListener("click", onDelete);
  $("photoInput").addEventListener("change", onPhotosSelected);
  $("filterWish").addEventListener("change", renderAll);
  $("filterVisited").addEventListener("change", renderAll);

  const sheet = $("sheet"), handle=$("sheetHandle");
  handle.addEventListener("click",()=>sheet.classList.toggle("collapsed"));
}

function onGoogleSearch(){
  const dlg=$("dlg-search"); const q=$("placeSearch").value.trim(); if(!q) return alert("請輸入關鍵字");
  placesService.textSearch({query:q}, (results,status)=>{
    if(status!==google.maps.places.PlacesServiceStatus.OK || !results) return alert("搜尋失敗或無結果");
    const store=loadStore(); let added=0;
    for(const p of results){
      const pos=p.geometry?.location; if(!pos) continue;
      if(store.places.some(x=>x.place_id && x.place_id===p.place_id)) continue;
      const id=uid();
      store.places.push({ id, name:p.name||"(未命名)", address:p.formatted_address||p.vicinity||"", lat:pos.lat(), lng:pos.lng(), status:"wish", rating:"", tags:[], note:"", photos:[], place_id:p.place_id||null, source:"google", created_at:Date.now(), updated_at:Date.now() });
      added++;
    }
    saveStore(store); renderAll(); alert(`已加入 ${added} 筆到「想去」`); dlg.close();
  });
}

function onGeocode(){
  const dlg=$("dlg-address"); const addr=$("addressInput").value.trim(); if(!addr) return alert("請輸入地址或地點");
  geocoder.geocode({address:addr}, (results,status)=>{
    if(status==="OK" && results[0]){
      const loc=results[0].geometry.location; const id=uid(); const store=loadStore();
      store.places.push({ id, name:results[0].formatted_address, address:results[0].formatted_address, lat:loc.lat(), lng:loc.lng(), status:"wish", rating:"", tags:[], note:"", photos:[], place_id:null, source:"address", created_at:Date.now(), updated_at:Date.now() });
      saveStore(store); renderAll(); map.panTo({lat:loc.lat(),lng:loc.lng()}); map.setZoom(16); dlg.close();
    } else { alert("找不到該地址，請再試一次"); }
  });
}

function renderAll(){
  markers.forEach(m=>m.setMap(null)); markers.clear();
  const showWish=$("filterWish").checked, showVisited=$("filterVisited").checked;
  const store=loadStore(); const ul=$("placeList"); ul.innerHTML="";
  for(const p of store.places){
    if((p.status==="wish" && !showWish) || (p.status==="visited" && !showVisited)) continue;
    const marker=new google.maps.Marker({ position:{lat:p.lat,lng:p.lng}, map, icon:markerIconFor(p.status), title:p.name||"(未命名)" });
    markers.set(p.id, marker);
    marker.addListener("click",()=>{
      selectPlace(p.id);
      const content = `<div style="max-width:240px"><div style="font-weight:700">${escapeHtml(p.name||"(未命名)")}</div><div style="font-size:12px;color:#888">${escapeHtml(p.address||"")}</div>${p.rating?`<div>${p.rating}</div>`:""}${p.note?`<div style='margin-top:6px'>${escapeHtml(p.note)}</div>`:""}</div>`;
      (infoWindow|| (infoWindow=new google.maps.InfoWindow())).setContent(content);
      infoWindow.open(map, marker);
    });
    const li=document.createElement("li");
    li.innerHTML = `<div class="place-title">${escapeHtml(p.name||"(未命名)")}</div><div class="place-sub">${escapeHtml(p.address||"")}</div><div class="place-sub">${p.status==="visited"?"已去":"想去"} ${p.rating? "・"+p.rating:""} ${p.tags?.length? "・"+p.tags.join(", "):""}</div>`;
    li.addEventListener("click",()=>selectPlace(p.id)); ul.appendChild(li);
  }
}

function selectPlace(id){
  selectedId=id; const store=loadStore(); const p=store.places.find(x=>x.id===id); if(!p) return;
  $("nameInput").value=p.name||""; $("statusSelect").value=p.status||"wish"; $("ratingSelect").value=p.rating||""; $("tagsInput").value=(p.tags||[]).join(", "); $("noteInput").value=p.note||"";
  const preview=$("photoPreview"); preview.innerHTML=""; (p.photos||[]).forEach(src=>{ const img=document.createElement("img"); img.src=src; preview.appendChild(img); });
  map.panTo({lat:p.lat,lng:p.lng}); map.setZoom(Math.max(map.getZoom(),16));
}

async function onPhotosSelected(evt){
  const files=Array.from(evt.target.files||[]); if(!files.length) return; if(!selectedId) return alert("請先選取或新增一個地點");
  const store=loadStore(); const p=store.places.find(x=>x.id===selectedId);
  for(const f of files){ const b64=await readAndCompressImage(f,1280,82); (p.photos||(p.photos=[])).push(b64); }
  p.updated_at=Date.now(); saveStore(store); selectPlace(selectedId);
}

function onSave(){
  if(!selectedId) return alert("請先選取或新增一個地點");
  const store=loadStore(); const p=store.places.find(x=>x.id===selectedId);
  p.name=$("nameInput").value.trim()||p.name; p.status=$("statusSelect").value; p.rating=$("ratingSelect").value;
  p.tags=$("tagsInput").value.split(",").map(s=>s.trim()).filter(Boolean); p.note=$("noteInput").value.trim();
  p.updated_at=Date.now(); saveStore(store); renderAll();
}

function onDelete(){
  if(!selectedId) return;
  if(!confirm("確定要刪除這個地點嗎？")) return;
  const store=loadStore(); const idx=store.places.findIndex(x=>x.id===selectedId);
  if(idx>=0) store.places.splice(idx,1); saveStore(store); selectedId=null; renderAll();
}

function onExport(){
  const blob=new Blob([JSON.stringify(loadStore(),null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="my-restaurant-map-mobile.json"; a.click(); URL.revokeObjectURL(url);
}
function onImport(evt){
  const file=evt.target.files?.[0]; if(!file) return;
  const reader=new FileReader(); reader.onload=()=>{ try{ const json=JSON.parse(reader.result); if(!json || !Array.isArray(json.places)) throw new Error("格式不正確"); localStorage.setItem(STORE_KEY, JSON.stringify(json)); renderAll(); alert("匯入完成"); } catch(e){ alert("匯入失敗："+e.message); } }; reader.readAsText(file);
}

function markerIconFor(status){
  const fill = status==="visited" ? "#10b981" : "#3b82f6";
  return { path:"M12 2C7.03 2 3 6.03 3 11c0 5.25 7.2 11.22 8.25 12.07a1 1 0 0 0 1.5 0C13.8 22.22 21 16.25 21 11c0-4.97-4.03-9-9-9zm0 12.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z", fillColor:fill, fillOpacity:1, strokeWeight:0, scale:1.6, anchor:new google.maps.Point(12,24) };
}

function readAndCompressImage(file,maxSize=1280,quality=85){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader(); reader.onload=()=>{ const img=new Image(); img.onload=()=>{
      const canvas=document.createElement("canvas"); let {width,height}=img;
      if(width>height && width>maxSize){ height=Math.round(height*(maxSize/width)); width=maxSize; }
      else if(height>maxSize){ width=Math.round(width*(maxSize/height)); height=maxSize; }
      canvas.width=width; canvas.height=height; const ctx=canvas.getContext("2d"); ctx.drawImage(img,0,0,width,height); resolve(canvas.toDataURL("image/jpeg",quality/100)); };
      img.onerror=reject; img.src=reader.result; }; reader.onerror=reject; reader.readAsDataURL(file);
  });
}

function escapeHtml(str){ return (str||"").replace(/[&<>\"']/g, s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[s])); }

window.initMap=initMap;
