export const ADMIN_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>StreamBox Admin</title>
<style>
:root{font-family:Inter,system-ui;background:#090b10;color:#f5f7fb}*{box-sizing:border-box}body{margin:0;background:#090b10;color:#f5f7fb}button,input,select,textarea{font:inherit}.shell{max-width:1250px;margin:auto;padding:28px 18px 70px}header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}.brand{font-size:24px;font-weight:900}.brand span{color:#ff3f68}.muted{color:#96a0b0}.card{background:#11151d;border:1px solid #252b36;border-radius:16px;padding:18px}.login{max-width:460px;margin:12vh auto}.field input,.field select,.field textarea{width:100%;background:#0c1017;border:1px solid #303846;color:#fff;border-radius:10px;padding:11px}button{border:0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;background:#ff3f68;color:#fff}.secondary{background:#202632}.hidden{display:none!important}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.stat strong{display:block;font-size:28px;margin-top:6px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.provider-head{display:flex;justify-content:space-between;gap:12px}.provider h3{margin:0}.fields,.form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:14px 0}.field label{display:block;color:#aab2bf;font-size:12px;margin-bottom:6px}.pill{font-size:11px;padding:5px 8px;border-radius:999px;background:#202632;color:#b9c1cf}.ok{color:#78e08f}.warn{color:#ffd166}.section{margin-top:28px}.forms{display:grid;grid-template-columns:1fr 1fr;gap:14px}.wide{grid-column:1/-1}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;border-bottom:1px solid #272d38;padding:10px 7px}th{color:#8f99aa}.table-wrap{overflow:auto}.toast{position:fixed;right:18px;bottom:18px;background:#1b2230;border:1px solid #384255;padding:12px 16px;border-radius:10px;max-width:360px}@media(max-width:800px){.stats,.grid,.forms{grid-template-columns:1fr 1fr}.fields,.form-grid{grid-template-columns:1fr}}@media(max-width:560px){.stats,.grid,.forms{grid-template-columns:1fr}header{align-items:flex-start;flex-direction:column}}
</style></head>
<body><div class="shell">
<div id="login" class="card login"><div class="brand">Stream<span>Box</span> Admin</div><p class="muted">Enter ADMIN_TOKEN. It is exchanged for a secure HttpOnly session.</p><div class="field"><input id="token" type="password" placeholder="ADMIN_TOKEN"></div><div style="margin-top:12px"><button onclick="login()">Login</button></div></div>
<div id="app" class="hidden"><header><div><div class="brand">Stream<span>Box</span> Admin</div><div class="muted">Backend APIs, providers, licensing and streams</div></div><button class="secondary" onclick="logout()">Logout</button></header>
<div id="stats" class="stats"></div>
<section class="section"><h2>API / Provider Settings</h2><div id="providers" class="grid"></div></section>
<section class="section"><h2>Add authorized content</h2><div class="forms">
<form id="licenseForm" class="card" onsubmit="addLicense(event)"><h3>License record</h3><div class="form-grid">
<div class="field wide"><label>Catalog ID</label><input name="catalogId" placeholder="tmdb:movie:123" required></div>
<div class="field"><label>Marketplace</label><select name="marketplace"><option value="filmhub">Filmhub</option><option value="vuulr">Vuulr</option><option value="direct">Direct</option></select></div>
<div class="field"><label>Reference</label><input name="reference" required></div><div class="field"><label>Territory</label><input name="territory" value="WORLD"></div>
<div class="field"><label>Starts at</label><input name="startsAt" type="datetime-local"></div><div class="field"><label>Ends at</label><input name="endsAt" type="datetime-local"></div>
<div class="field wide"><label>Notes</label><textarea name="notes"></textarea></div></div><button>Save license</button></form>
<form id="directForm" class="card" onsubmit="addDirect(event)"><h3>Direct HLS / MP4 stream</h3><div class="form-grid">
<div class="field wide"><label>Catalog ID</label><input name="catalogId" placeholder="tmdb:movie:123" required></div><div class="field wide"><label>Title</label><input name="title" required></div>
<div class="field wide"><label>Stream URL</label><input name="streamUrl" placeholder="https://.../master.m3u8" required></div>
<div class="field"><label>Rights</label><select name="rightsStatus"><option value="licensed">Licensed</option><option value="public_domain">Public domain</option></select></div>
<div class="field"><label>License source</label><input name="licenseSource" required></div><div class="field"><label>License reference</label><input name="licenseReference" required></div><div class="field"><label>Territory</label><input name="territory" value="WORLD"></div>
</div><button>Register stream</button></form>
<form id="muxForm" class="card" onsubmit="addMux(event)"><h3>Ingest authorized master to Mux</h3><div class="form-grid">
<div class="field wide"><label>Catalog ID</label><input name="catalogId" placeholder="tmdb:movie:123" required></div><div class="field wide"><label>Title</label><input name="title" required></div>
<div class="field wide"><label>Authorized input URL</label><input name="inputUrl" required></div>
<div class="field"><label>Rights</label><select name="rightsStatus"><option value="licensed">Licensed</option><option value="public_domain">Public domain</option></select></div>
<div class="field"><label>License source</label><input name="licenseSource" required></div><div class="field"><label>License reference</label><input name="licenseReference" required></div><div class="field"><label>Territory</label><input name="territory" value="WORLD"></div>
</div><button>Send to Mux</button></form>
</div></section>
<section class="section"><h2>Registered streams</h2><div class="card table-wrap"><table><thead><tr><th>Catalog</th><th>Title</th><th>Source</th><th>Rights</th><th>Territory</th><th>Updated</th></tr></thead><tbody id="streams"></tbody></table></div></section>
<section class="section"><h2>License records</h2><div class="card table-wrap"><table><thead><tr><th>Catalog</th><th>Marketplace</th><th>Reference</th><th>Territory</th><th>Created</th></tr></thead><tbody id="licenses"></tbody></table></div></section>
</div></div><div id="toast" class="toast hidden"></div>
<script>
const fields={tmdb:[['readToken','TMDB Read Access Token',1]],watchmode:[['apiKey','Watchmode API Key',1],['defaultRegion','Default Region',0]],internet_archive:[],mux:[['tokenId','Mux Token ID',1],['tokenSecret','Mux Token Secret',1]],filmhub:[['accountReference','Account / Buyer Reference',0]],vuulr:[['accountReference','Account / Buyer Reference',0]],direct:[]};
function el(id){return document.getElementById(id)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(m,e){const x=el('toast');x.textContent=m;x.classList.remove('hidden');x.style.borderColor=e?'#b84b5d':'#384255';setTimeout(()=>x.classList.add('hidden'),3500)}
async function api(p,o={}){const r=await fetch(p,{...o,credentials:'same-origin',headers:{'content-type':'application/json',...(o.headers||{})}});const t=await r.text();let b={};try{b=JSON.parse(t)}catch{b={error:t}}if(r.status===401){showLogin();throw Error('Admin session expired')}if(!r.ok)throw Error(b.error||('Request failed '+r.status));return b}
function showLogin(){el('login').classList.remove('hidden');el('app').classList.add('hidden')}function showApp(){el('login').classList.add('hidden');el('app').classList.remove('hidden')}
async function login(){const tokenEl=el('token');try{await api('/v1/admin/session',{method:'POST',body:JSON.stringify({token:tokenEl.value})});tokenEl.value='';showApp();await load()}catch(e){toast(e.message,1)}}
async function logout(){try{await fetch('/v1/admin/session',{method:'DELETE',credentials:'same-origin'})}finally{showLogin()}}
function card(p){let f=(fields[p.id]||[]).map(a=>{const k=a[0],lab=a[1],sec=a[2],set=sec&&p.secretConfigured&&p.secretConfigured[k],v=sec?'':((p.publicConfig&&p.publicConfig[k])||'');return '<div class="field"><label>'+esc(lab)+(set?' <span class="ok">• configured</span>':'')+'</label><input data-field="'+esc(k)+'" type="'+(sec?'password':'text')+'" value="'+esc(v)+'" placeholder="'+esc(sec?(set?'Leave blank to keep existing':'Enter value'):'')+'"></div>'}).join('');return '<div class="card provider" data-provider="'+esc(p.id)+'"><div class="provider-head"><div><h3>'+esc(p.name)+'</h3><span class="pill">'+esc(p.source)+'</span></div><label><input class="enabled" type="checkbox" '+(p.enabled?'checked':'')+'> Enabled</label></div><p class="muted">'+esc(p.purpose)+'</p>'+(p.configError?'<p class="warn">'+esc(p.configError)+'</p>':'')+'<div class="fields">'+f+'</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button onclick="saveProvider(\''+esc(p.id)+'\')">Save provider</button><button class="secondary" onclick="testProvider(\''+esc(p.id)+'\')">Test connection</button></div></div>'}
function renderProviders(p){el('providers').innerHTML=p.map(card).join('')}
async function saveProvider(id){const c=document.querySelector('[data-provider="'+id+'"]'),cfg={};c.querySelectorAll('[data-field]').forEach(i=>cfg[i.dataset.field]=i.value);try{const d=await api('/v1/admin/providers/'+id,{method:'PUT',body:JSON.stringify({enabled:c.querySelector('.enabled').checked,config:cfg})});renderProviders(d.providers);toast(id+' saved')}catch(e){toast(e.message,1)}}
async function testProvider(id){try{const d=await api('/v1/admin/providers/'+id+'/test',{method:'POST',body:'{}'});toast(d.message,!d.ok)}catch(e){toast(e.message,1)}}
function row(v){return '<tr>'+v.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>'}
function render(d){el('stats').innerHTML=[['Providers enabled',d.stats.providersEnabled+'/'+d.stats.providersTotal],['Streams',d.stats.streams],['Licenses',d.stats.licenses],['Backend','Online']].map(x=>'<div class="card stat"><span class="muted">'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');renderProviders(d.providers);el('streams').innerHTML=d.streams.map(s=>row([s.catalog_id,s.title,s.source_type,s.rights_status,s.territory,s.updated_at])).join('');el('licenses').innerHTML=d.licenses.map(l=>row([l.catalog_id,l.marketplace,l.reference,l.territory,l.created_at])).join('')}
async function load(){try{render(await api('/v1/admin/dashboard'));showApp()}catch(e){showLogin()}}
function data(f){const d=Object.fromEntries(new FormData(f).entries());['startsAt','endsAt'].forEach(k=>{if(d[k])d[k]=new Date(d[k]).toISOString()});return d}
async function addLicense(e){e.preventDefault();try{await api('/v1/admin/licenses',{method:'POST',body:JSON.stringify(data(e.target))});toast('License saved');await load()}catch(x){toast(x.message,1)}}
async function addDirect(e){e.preventDefault();try{await api('/v1/admin/streams/direct',{method:'POST',body:JSON.stringify(data(e.target))});toast('Direct stream registered');await load()}catch(x){toast(x.message,1)}}
async function addMux(e){e.preventDefault();try{await api('/v1/admin/mux/assets',{method:'POST',body:JSON.stringify(data(e.target))});toast('Mux ingest created');await load()}catch(x){toast(x.message,1)}}
load();
</script></body></html>`;
