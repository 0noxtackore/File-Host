const SUPABASE_URL='https://qxgmhfugoxzzqblztuvq.supabase.co';
const SUPABASE_KEY='sb_publishable_zs0n2Xm3WrWg2YcE7SulmA_VMPU7WVT';
const BUCKET='files';

let db,selectedFiles=[],currentFile=null,allFiles=[],viewMode='grid';
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);

function initSupabase(){db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);loadFiles();}

const uploadModal=$('#uploadModal'),detailModal=$('#detailModal'),confirmModal=$('#confirmModal'),
gallery=$('#gallery'),empty=$('#empty'),noResults=$('#noResults'),stats=$('#stats'),
fileInput=$('#fileInput'),dropZone=$('#dropZone'),filePreview=$('#filePreview'),
uploadForm=$('#uploadForm'),searchInput=$('#searchInput');

function toast(m,t='info'){const i={success:'✓',error:'✕',info:'ℹ'},c=$('#toastContainer'),e=document.createElement('div');e.className=`toast ${t}`;e.innerHTML=`<span class="toast-icon">${i[t]}</span><span class="toast-msg">${m}</span>`;c.appendChild(e);setTimeout(()=>{e.classList.add('removing');setTimeout(()=>e.remove(),300)},3000)}
function openModal(m){m.classList.add('active')}
function closeModal(m){m.classList.remove('active')}
function closeAll(){[uploadModal,detailModal,confirmModal].forEach(m=>closeModal(m))}

$$('[data-close]').forEach(b=>b.addEventListener('click',closeAll));
$$('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m)}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll()});

$('#uploadBtn').addEventListener('click',()=>{selectedFiles=[];filePreview.innerHTML='';fileInput.value='';$('#uploadProgress').style.display='none';openModal(uploadModal)});

dropZone.addEventListener('click',()=>fileInput.click());
dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('dragover')});
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop',e=>{e.preventDefault();dropZone.classList.remove('dragover');addFiles(e.dataTransfer.files)});
fileInput.addEventListener('change',()=>addFiles(fileInput.files));

function addFiles(fl){for(const f of fl)if(!selectedFiles.find(s=>s.name===f.name&&s.size===f.size))selectedFiles.push(f);renderPreview()}

function renderPreview(){filePreview.innerHTML=selectedFiles.map((f,i)=>`<div class="tag">${f.name.length>28?f.name.substring(0,28)+'…':f.name}<span class="remove-tag" data-idx="${i}">&times;</span></div>`).join('');filePreview.querySelectorAll('.remove-tag').forEach(el=>{el.addEventListener('click',e=>{e.stopPropagation();selectedFiles.splice(parseInt(el.dataset.idx),1);renderPreview()})})}

async function compressImage(f,maxW=1200,q=0.75){return new Promise(r=>{const img=new Image(),u=URL.createObjectURL(f);img.onload=()=>{URL.revokeObjectURL(u);let w=img.width,h=img.height;if(w>maxW){h=(maxW/w)*h;w=maxW}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);c.toBlob(b=>{r(new File([b],f.name,{type:'image/jpeg'}))},'image/jpeg',q)};img.src=u})}
async function prepareFile(f){if(f.type.startsWith('image/')&&f.size>100000){toast(`Comprimiendo ${f.name}...`,'info');return await compressImage(f)}return f}

uploadForm.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!selectedFiles.length)return toast('Selecciona al menos un archivo','error');
  const sb=$('#submitBtn'),pg=$('#uploadProgress'),pf=$('#progressFill'),pp=$('#progressPercent');
  sb.disabled=true;pg.style.display='block';
  const tot=selectedFiles.length;let dn=0;
  try{
    for(const file of selectedFiles){
      const ready=await prepareFile(file);
      const path=`${Date.now()}_${Math.random().toString(36).slice(2)}_${ready.name}`;
      const{error:ue}=await db.storage.from(BUCKET).upload(path,ready,{cacheControl:'31536000',upsert:false});
      if(ue)throw ue;
      const{error:de}=await db.from('files').insert({name:file.name,mimetype:file.type||'application/octet-stream',size:ready.size,storage_path:path});
      if(de)throw de;
      dn++;const pct=Math.round((dn/tot)*100);pf.style.width=pct+'%';pp.textContent=pct+'%';
    }
    closeModal(uploadModal);toast(`${dn} archivo(s) subido(s)`,'success');loadFiles();
  }catch(err){toast('Error: '+err.message,'error')}
  finally{sb.disabled=false;pg.style.display='none';pf.style.width='0%'}
});

async function loadFiles(){
  try{
    const{data,error}=await db.from('files').select('*').order('created_at',{ascending:false});
    if(error)throw error;allFiles=data||[];renderGallery(allFiles);
  }catch(err){gallery.innerHTML='<p style="color:var(--danger)">Error: '+err.message+'</p>'}
}

searchInput.addEventListener('input',()=>renderGallery(getFilteredFiles()));
function getFilteredFiles(){const q=searchInput.value.toLowerCase().trim();return q?allFiles.filter(f=>f.name.toLowerCase().includes(q)):allFiles}

function renderGallery(files){
  const hs=searchInput.value.trim().length>0;
  if(!allFiles.length&&!hs){gallery.innerHTML='';empty.style.display='block';noResults.style.display='none';stats.textContent='';return}
  empty.style.display='none';
  if(!files.length){gallery.innerHTML='';noResults.style.display='block';stats.textContent='';return}
  noResults.style.display='none';
  const ts=files.reduce((a,f)=>a+f.size,0);
  stats.textContent=`${files.length} archivo(s) · ${formatSize(ts)}`;
  gallery.innerHTML=files.map((f,i)=>`<div class="card" data-id="${f.id}" style="animation-delay:${i*0.04}s"><div class="card-preview"><span class="card-type-badge">${getExtension(f.name)}</span>${f.mimetype&&f.mimetype.startsWith('image/')?`<img src="${getFileUrl(f.storage_path)}" alt="${esc(f.name)}" loading="lazy" decoding="async">`:`<div class="icon-placeholder">${getIcon(f.mimetype)}</div>`}</div><div class="card-info"><h3 title="${esc(f.name)}">${esc(f.name)}</h3><div class="meta"><span>${formatSize(f.size)}</span><span>${formatDate(f.created_at)}</span></div></div></div>`).join('');
  gallery.querySelectorAll('.card').forEach(c=>{c.addEventListener('click',()=>showDetail(c.dataset.id))});
}

function getFileUrl(p){const{data}=db.storage.from(BUCKET).getPublicUrl(p);return data.publicUrl}

$('#gridViewBtn').addEventListener('click',()=>setView('grid'));
$('#listViewBtn').addEventListener('click',()=>setView('list'));
function setView(m){viewMode=m;gallery.classList.toggle('list-view',m==='list');$('#gridViewBtn').classList.toggle('active',m==='grid');$('#listViewBtn').classList.toggle('active',m==='list')}

function getIcon(mt){if(!mt)return '📁';if(mt.startsWith('video/'))return '🎬';if(mt.startsWith('audio/'))return '🎵';if(mt==='application/pdf')return '📄';if(mt.includes('zip'))return '📦';if(mt.startsWith('text/'))return '📝';return '📁'}
function getExtension(n){const e=n.split('.').pop();return e&&e.length<=6?e.toUpperCase():'FILE'}
function formatSize(b){if(!b)return '0 B';const k=1024,s=['B','KB','MB','GB'],i=Math.floor(Math.log(b)/Math.log(k));return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+s[i]}
function formatDate(d){if(!d)return '';return new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'})}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

async function showDetail(id){
  const f=allFiles.find(x=>x.id===id);if(!f)return;
  currentFile=f;$('#detailTitle').textContent=f.name;
  const url=getFileUrl(f.storage_path);
  const isI=f.mimetype&&f.mimetype.startsWith('image/'),isV=f.mimetype&&f.mimetype.startsWith('video/'),isA=f.mimetype&&f.mimetype.startsWith('audio/');
  let mh='';if(isI)mh=`<img class="detail-img" src="${url}" alt="${esc(f.name)}" loading="eager">`;else if(isV)mh=`<video class="detail-img" src="${url}" controls></video>`;else if(isA)mh=`<audio style="width:100%;margin-bottom:1rem;border-radius:var(--radius-sm);" src="${url}" controls></audio>`;
  $('#detailBody').innerHTML=`${mh}<div class="detail-info"><div class="detail-info-row"><span class="label">Nombre</span><span class="value">${esc(f.name)}</span></div><div class="detail-info-row"><span class="label">Tipo</span><span class="value">${f.mimetype||'N/A'}</span></div><div class="detail-info-row"><span class="label">Tamaño</span><span class="value">${formatSize(f.size)}</span></div><div class="detail-info-row"><span class="label">Subido</span><span class="value">${formatDate(f.created_at)}</span></div></div>`;
  $('#detailDownload').href=url;$('#detailDownload').download=f.name;
  openModal(detailModal);
}

$('#detailDeleteBtn').addEventListener('click',()=>{closeModal(detailModal);openModal(confirmModal)});
$('#cancelDeleteBtn').addEventListener('click',()=>closeModal(confirmModal));
$('#confirmDeleteBtn').addEventListener('click',async()=>{
  if(!currentFile)return;
  try{await db.storage.from(BUCKET).remove([currentFile.storage_path]);await db.from('files').delete().eq('id',currentFile.id);closeModal(confirmModal);toast('Archivo eliminado','success');loadFiles()}
  catch(err){toast('Error: '+err.message,'error')}
});

if(window.supabase)initSupabase();else window.addEventListener('load',initSupabase);