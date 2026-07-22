const SUPABASE_URL='https://qxgmhfugoxzzqblztuvq.supabase.co';
const SUPABASE_KEY='sb_publishable_zs0n2Xm3WrWg2YcE7SulmA_VMPU7WVT';
const BUCKET='files';

let db,selectedFiles=[],currentFile=null,allFiles=[],allFolders=[],currentFolder=null,viewMode='grid';
let selectedIds=new Set(),moveTargetFolder=null,moveFileIds=[];
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);

function initSupabase(){db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);loadContent();}

const uploadModal=$('#uploadModal'),detailModal=$('#detailModal'),confirmModal=$('#confirmModal'),
  newFolderModal=$('#newFolderModal'),renameModal=$('#renameModal'),moveModal=$('#moveModal'),
  gallery=$('#gallery'),empty=$('#empty'),noResults=$('#noResults'),stats=$('#stats'),
  fileInput=$('#fileInput'),dropZone=$('#dropZone'),filePreview=$('#filePreview'),
  uploadForm=$('#uploadForm'),searchInput=$('#searchInput'),breadcrumb=$('#breadcrumb'),
  selectionBar=$('#selectionBar'),selectionCount=$('#selectionCount'),
  folderNameInput=$('#folderNameInput'),newFolderForm=$('#newFolderForm'),
  renameInput=$('#renameInput'),renameForm=$('#renameForm'),
  moveTree=$('#moveTree'),moveConfirmBtn=$('#moveConfirmBtn'),moveCancelBtn=$('#moveCancelBtn'),
  folderSelect=$('#folderSelect'),customNameInput=$('#customNameInput');

function toast(m,t='info'){const i={success:'✓',error:'✕',info:'ℹ'},c=$('#toastContainer'),e=document.createElement('div');e.className=`toast ${t}`;e.innerHTML=`<span class="toast-icon">${i[t]}</span><span class="toast-msg">${m}</span>`;c.appendChild(e);setTimeout(()=>{e.classList.add('removing');setTimeout(()=>e.remove(),300)},3000)}
function openModal(m){m.classList.add('active')}
function closeModal(m){m.classList.remove('active')}
function closeAll(){[uploadModal,detailModal,confirmModal,newFolderModal,renameModal,moveModal].forEach(m=>closeModal(m))}

$$('[data-close]').forEach(b=>b.addEventListener('click',closeAll));
$$('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m)}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll()});

// === FOLDERS ===

async function loadFolders(){
  try{
    const{data,error}=await db.from('folders').select('*').order('name',{ascending:true});
    if(error)throw error;
    allFolders=data||[];
  }catch(err){allFolders=[];}
}

async function loadContent(){
  await loadFolders();
  await loadFiles();
}

async function loadFiles(){
  try{
    const folderFilter=currentFolder?currentFolder:'';
    let q=db.from('files').select('*').order('created_at',{ascending:false});
    if(currentFolder){q=q.eq('folder_id',currentFolder);}
    else{q=q.is('folder_id',null);}
    const{data,error}=await q;
    if(error)throw error;allFiles=data||[];renderGallery(allFiles);
  }catch(err){gallery.innerHTML='<p style="color:var(--danger)">Error: '+err.message+'</p>'}
}

function renderBreadcrumb(){
  if(!currentFolder){breadcrumb.innerHTML='';return;}
  const chain=getFolderPath(currentFolder);
  let html=`<button class="breadcrumb-back" id="breadcrumbBack"><i class="bi bi-arrow-left"></i></button>`;
  html+=`<span class="breadcrumb-item${chain.length===0?' current':''}" data-folder=""><i class="bi bi-house-fill"></i> Raíz</span>`;
  chain.forEach((f,i)=>{
    const isLast=i===chain.length-1;
    html+=`<span class="breadcrumb-sep">›</span>`;
    html+=`<span class="breadcrumb-item${isLast?' current':''}" data-folder="${f.id}">${esc(f.name)}</span>`;
  });
  breadcrumb.innerHTML=html;
  $('#breadcrumbBack').addEventListener('click',()=>{
    const parentId=chain.length>1?chain[chain.length-2].id:null;
    navigateToFolder(parentId);
  });
  breadcrumb.querySelectorAll('.breadcrumb-item:not(.current)').forEach(el=>{
    el.addEventListener('click',()=>navigateToFolder(el.dataset.folder||null));
  });
}

function getFolderPath(folderId){
  const chain=[];
  let current=allFolders.find(f=>f.id===folderId);
  while(current){
    chain.unshift(current);
    current=current.parent_id?allFolders.find(f=>f.id===current.parent_id):null;
  }
  return chain;
}

function navigateToFolder(id){
  currentFolder=id||null;
  selectedIds.clear();
  renderSelectionBar();
  renderBreadcrumb();
  loadFiles();
}

function updateFolderSelect(){
  const opts=[{id:null,name:'Carpeta raíz'}];
  allFolders.forEach(f=>opts.push({id:f.id,name:f.name}));
  folderSelect.innerHTML=opts.map(o=>`<option value="${o.id||''}">${esc(o.name)}</option>`).join('');
}

newFolderForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const name=folderNameInput.value.trim();
  if(!name)return toast('Escribe un nombre','error');
  try{
    const{data,error}=await db.from('folders').insert({name,parent_id:currentFolder}).select();
    if(error)throw error;
    closeModal(newFolderModal);folderNameInput.value='';
    toast('Carpeta creada','success');
    await loadFolders();updateFolderSelect();loadFiles();
  }catch(err){toast('Error: '+err.message,'error')}
});

$('#newFolderBtn').addEventListener('click',()=>{openModal(newFolderModal);folderNameInput.value='';setTimeout(()=>folderNameInput.focus(),100);});

// === SELECTION ===

function toggleSelect(id,e){
  if(e){e.stopPropagation();}
  if(selectedIds.has(id)){selectedIds.delete(id);}else{selectedIds.add(id);}
  const card=gallery.querySelector(`.card[data-id="${id}"]`);
  if(card)card.classList.toggle('selected',selectedIds.has(id));
  renderSelectionBar();
}

function renderSelectionBar(){
  const count=selectedIds.size;
  if(count===0){selectionBar.style.display='none';return;}
  selectionBar.style.display='flex';
  selectionCount.textContent=`${count} seleccionado${count>1?'s':''}`;
}

$('#clearSelectionBtn').addEventListener('click',()=>{selectedIds.clear();gallery.querySelectorAll('.card.selected').forEach(c=>c.classList.remove('selected'));renderSelectionBar();});

$('#batchDeleteBtn').addEventListener('click',async()=>{
  if(!selectedIds.size)return;
  const count=selectedIds.size;
  $('#confirmTitle').textContent=`Eliminar ${count} archivo(s)`;
  $('#confirmMessage').textContent='Esta acción no se puede deshacer.';
  openModal(confirmModal);
  $('#confirmDeleteBtn').onclick=async()=>{
    const ids=[...selectedIds];
    try{
      for(const id of ids){
        const f=allFiles.find(x=>x.id===id);
        if(f){await db.storage.from(BUCKET).remove([f.storage_path]);await db.from('files').delete().eq('id',id);}
      }
      selectedIds.clear();closeModal(confirmModal);toast(`${ids.length} archivo(s) eliminado(s)`,'success');loadFiles();
    }catch(err){toast('Error: '+err.message,'error')}
  };
});

$('#batchDownloadBtn').addEventListener('click',async()=>{
  if(!selectedIds.size)return;
  const files=allFiles.filter(f=>selectedIds.has(f.id));
  if(files.length===1){return downloadSingleFile(files[0]);}
  toast('Preparando descarga...','info');
  try{
    if(!window.JSZip){
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js';
        s.onload=resolve;s.onerror=()=>reject(new Error('No se pudo cargar JSZip'));
        document.head.appendChild(s);
      });
    }
    const zip=new JSZip();
    await Promise.all(files.map(async f=>{
      const url=getFileUrl(f.storage_path);
      const resp=await fetch(url);
      const blob=await resp.blob();
      zip.file(f.name,blob);
    }));
    const content=await zip.generateAsync({type:'blob'});
    const a=document.createElement('a');a.href=URL.createObjectURL(content);
    a.download=`archivos_${Date.now()}.zip`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href);
    toast('Descarga iniciada','success');
  }catch(err){toast('Error al descargar: '+err.message,'error');}
});

$('#batchMoveBtn').addEventListener('click',()=>{
  moveFileIds=[...selectedIds];
  openMoveModal();
});

// === UPLOAD ===

$('#uploadBtn').addEventListener('click',()=>{
  selectedFiles=[];filePreview.innerHTML='';fileInput.value='';
  customNameInput.value='';$('#uploadProgress').style.display='none';
  updateFolderSelect();
  folderSelect.value=currentFolder||'';
  openModal(uploadModal);
});

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
  const customName=customNameInput.value.trim()||null;
  const targetFolder=folderSelect.value||null;
  try{
    for(const file of selectedFiles){
      const ready=await prepareFile(file);
      const path=`${Date.now()}_${Math.random().toString(36).slice(2)}_${ready.name}`;
      const{error:ue}=await db.storage.from(BUCKET).upload(path,ready,{cacheControl:'31536000',upsert:false});
      if(ue)throw ue;
      const displayName=customName&&tot===1?customName:file.name;
      const{error:de}=await db.from('files').insert({name:file.name,mimetype:file.type||'application/octet-stream',size:ready.size,storage_path:path,folder_id:targetFolder});
      if(de)throw de;
      if(customName&&tot===1){
        const{data:recent}=await db.from('files').select('id').eq('storage_path',path).single();
        if(recent){await db.from('files').update({custom_name:customName}).eq('id',recent.id);}
      }
      dn++;const pct=Math.round((dn/tot)*100);pf.style.width=pct+'%';pp.textContent=pct+'%';
    }
    closeModal(uploadModal);toast(`${dn} archivo(s) subido(s)`,'success');loadFiles();
  }catch(err){toast('Error: '+err.message,'error')}
  finally{sb.disabled=false;pg.style.display='none';pf.style.width='0%'}
});

// === GALLERY ===

searchInput.addEventListener('input',()=>renderGallery(getFilteredFiles()));
function getFilteredFiles(){const q=searchInput.value.toLowerCase().trim();return q?allFiles.filter(f=>getDisplayName(f).toLowerCase().includes(q)):allFiles}

function getDisplayName(f){return f.custom_name||f.name;}

function renderGallery(files){
  const hs=searchInput.value.trim().length>0;
  if(!allFiles.length&&!allFolders.filter(f=>(f.parent_id||null)===(currentFolder||null)).length&&!hs){gallery.innerHTML='';empty.style.display='block';noResults.style.display='none';stats.textContent='';breadcrumb.innerHTML='';return}
  empty.style.display='none';
  const filteredFiles=files||allFiles;
  const visibleFolders=allFolders.filter(f=>(f.parent_id||null)===(currentFolder||null));
  const hasContent=filteredFiles.length>0||visibleFolders.length>0;
  if(!hasContent&&!hs){gallery.innerHTML='';noResults.style.display='none';empty.style.display='block';stats.textContent='';return}
  if(hs&&!filteredFiles.length){gallery.innerHTML='';noResults.style.display='block';stats.textContent='';return}
  noResults.style.display='none';
  const ts=filteredFiles.reduce((a,f)=>a+f.size,0);
  const folderCount=visibleFolders.length;
  const parts=[];
  if(folderCount)parts.push(`${folderCount} carpeta(s)`);
  if(filteredFiles.length)parts.push(`${filteredFiles.length} archivo(s) · ${formatSize(ts)}`);
  stats.textContent=parts.join(' · ');
  let html='';
  visibleFolders.forEach((f,i)=>{
    html+=`<div class="card folder-card" data-folder-id="${f.id}" style="animation-delay:${i*0.04}s"><div class="card-preview"><div class="icon-placeholder"><i class="bi bi-folder-fill"></i></div></div><div class="card-info"><h3 title="${esc(f.name)}">${esc(f.name)}</h3><div class="meta"><span>Carpeta</span></div></div></div>`;
  });
  filteredFiles.forEach((f,i)=>{
    const displayName=getDisplayName(f);
    const isSelected=selectedIds.has(f.id);
    const isImg=f.mimetype&&f.mimetype.startsWith('image/');
    const isVid=f.mimetype&&f.mimetype.startsWith('video/');
    const isAud=f.mimetype&&f.mimetype.startsWith('audio/');
    const isPdf=f.mimetype==='application/pdf'||/\.pdf$/i.test(f.name);
    const isWord=(f.mimetype&&f.mimetype.includes('word'))||/\.docx?$/i.test(f.name);
    const isExcel=(f.mimetype&&f.mimetype.includes('spreadsheet'))||(f.mimetype&&f.mimetype.includes('excel'))||/\.xlsx?$/i.test(f.name);
    const isPpt=(f.mimetype&&f.mimetype.includes('presentation'))||/\.pptx?$/i.test(f.name);
    let preview='';
    if(isImg)preview=`<img src="${getFileUrl(f.storage_path)}" alt="${esc(displayName)}" loading="lazy" decoding="async">`;
    else if(isVid)preview=`<video src="${getFileUrl(f.storage_path)}" muted preload="metadata" class="card-video"></video><div class="card-play-overlay"><i class="bi bi-play-fill"></i></div>`;
    else if(isPdf)preview=`<div class="doc-icon-card doc-pdf"><i class="bi bi-file-earmark-pdf"></i></div>`;
    else if(isWord)preview=`<div class="doc-icon-card doc-word"><i class="bi bi-file-earmark-word"></i></div>`;
    else if(isExcel)preview=`<div class="doc-icon-card doc-excel"><i class="bi bi-file-earmark-excel"></i></div>`;
    else if(isPpt)preview=`<div class="doc-icon-card doc-ppt"><i class="bi bi-file-earmark-ppt"></i></div>`;
    else if(isAud)preview=`<div class="icon-placeholder audio-icon"><i class="bi bi-music-note-beamed"></i></div>`;
    else preview=`<div class="icon-placeholder">${getFileIcon(f.mimetype,f.name)}</div>`;
    html+=`<div class="card${isSelected?' selected':''}" data-id="${f.id}" style="animation-delay:${(visibleFolders.length+i)*0.04}s"><div class="card-checkbox" data-id="${f.id}"></div><div class="card-preview"><span class="card-type-badge">${getExtension(f.name)}</span>${preview}</div><div class="card-info"><h3 title="${esc(displayName)}">${esc(displayName)}</h3><div class="meta"><span>${formatSize(f.size)}</span><span>${formatDate(f.created_at)}</span></div></div></div>`;
  });
  gallery.innerHTML=html;
  gallery.querySelectorAll('.card.folder-card').forEach(c=>{
    c.addEventListener('click',()=>navigateToFolder(c.dataset.folderId));
  });
  gallery.querySelectorAll('.card:not(.folder-card)').forEach(c=>{
    c.addEventListener('click',e=>{
      if(e.target.closest('.card-checkbox'))return;
      showDetail(c.dataset.id);
    });
  });
  gallery.querySelectorAll('.card-checkbox').forEach(cb=>{
    cb.addEventListener('click',e=>{
      e.stopPropagation();
      toggleSelect(cb.dataset.id,e);
    });
  });
}

function getFileUrl(p){const{data}=db.storage.from(BUCKET).getPublicUrl(p);return data.publicUrl}

$('#gridViewBtn').addEventListener('click',()=>setView('grid'));
$('#listViewBtn').addEventListener('click',()=>setView('list'));
function setView(m){viewMode=m;gallery.classList.toggle('list-view',m==='list');$('#gridViewBtn').classList.toggle('active',m==='grid');$('#listViewBtn').classList.toggle('active',m==='list')}

function getFileIcon(mt,n){
  if(!mt)return '<i class="bi bi-file-earmark"></i>';
  if(mt.startsWith('video/'))return '<i class="bi bi-play-circle"></i>';
  if(mt.startsWith('audio/'))return '<i class="bi bi-music-note-beamed"></i>';
  if(mt==='application/pdf')return '<i class="bi bi-file-earmark-pdf"></i>';
  if(mt==='application/msword'||mt.includes('wordprocessingml')||(n&&/\.docx?$/i.test(n)))return '<i class="bi bi-file-earmark-word"></i>';
  if(mt.includes('spreadsheet')||mt.includes('excel')||(n&&/\.xlsx?$/i.test(n)))return '<i class="bi bi-file-earmark-excel"></i>';
  if(mt.includes('presentation')||(n&&/\.pptx?$/i.test(n)))return '<i class="bi bi-file-earmark-ppt"></i>';
  if(mt.includes('zip')||mt.includes('rar')||mt.includes('7z')||mt.includes('tar')||mt.includes('gzip'))return '<i class="bi bi-file-earmark-zip"></i>';
  if(mt.startsWith('text/'))return '<i class="bi bi-file-earmark-text"></i>';
  if(mt.includes('json'))return '<i class="bi bi-filetype-json"></i>';
  if(mt.includes('javascript'))return '<i class="bi bi-filetype-js"></i>';
  if(mt.includes('html'))return '<i class="bi bi-filetype-html"></i>';
  if(mt.includes('css'))return '<i class="bi bi-filetype-css"></i>';
  if(mt.startsWith('image/'))return '<i class="bi bi-file-earmark-image"></i>';
  return '<i class="bi bi-file-earmark"></i>';
}
function getExtension(n){const e=n.split('.').pop();return e&&e.length<=6?e.toUpperCase():'FILE'}
function formatSize(b){if(!b)return '0 B';const k=1024,s=['B','KB','MB','GB'],i=Math.floor(Math.log(b)/Math.log(k));return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+s[i]}
function formatDate(d){if(!d)return '';return new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'})}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

// === DETAIL ===

async function showDetail(id){
  const f=allFiles.find(x=>x.id==id);if(!f)return;
  currentFile=f;
  const displayName=getDisplayName(f);
  $('#detailTitle').textContent=displayName;
  const url=getFileUrl(f.storage_path);
  const isI=f.mimetype&&f.mimetype.startsWith('image/'),isV=f.mimetype&&f.mimetype.startsWith('video/'),isA=f.mimetype&&f.mimetype.startsWith('audio/');
  let mh='';if(isI)mh=`<img class="detail-img" src="${url}" alt="${esc(displayName)}" loading="eager">`;else if(isV)mh=`<video class="detail-img" src="${url}" controls></video>`;else if(isA)mh=`<audio style="width:100%;margin-bottom:1rem;border-radius:var(--radius-sm);" src="${url}" controls></audio>`;
  const folderName=f.folder_id?allFolders.find(fo=>fo.id===f.folder_id)?.name||'Otra':'Raíz';
  $('#detailBody').innerHTML=`${mh}<div class="detail-info"><div class="detail-info-row"><span class="label">Nombre</span><span class="value">${esc(displayName)}</span></div>${f.custom_name?`<div class="detail-info-row"><span class="label">Original</span><span class="value">${esc(f.name)}</span></div>`:''}<div class="detail-info-row"><span class="label">Tipo</span><span class="value">${f.mimetype||'N/A'}</span></div><div class="detail-info-row"><span class="label">Tamaño</span><span class="value">${formatSize(f.size)}</span></div><div class="detail-info-row"><span class="label">Carpeta</span><span class="value"><i class="bi bi-folder"></i> ${esc(folderName)}</span></div><div class="detail-info-row"><span class="label">Subido</span><span class="value">${formatDate(f.created_at)}</span></div></div>`;
  $('#detailDownload').href='#';$('#detailDownload').onclick=e=>{e.preventDefault();downloadSingleFile(currentFile)};
  openModal(detailModal);
}

async function downloadSingleFile(f){
  if(!f)return;
  toast('Descargando...','info');
  const url=getFileUrl(f.storage_path);
  try{const r=await fetch(url);const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=f.name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href)}
  catch(err){window.open(url,'_blank')}
}

$('#detailDeleteBtn').addEventListener('click',()=>{closeModal(detailModal);$('#confirmTitle').textContent='Eliminar archivo';$('#confirmMessage').textContent='Esta acción no se puede deshacer.';openModal(confirmModal);$('#confirmDeleteBtn').onclick=deleteCurrentFile;});
$('#cancelDeleteBtn').addEventListener('click',()=>closeModal(confirmModal));

async function deleteCurrentFile(){
  if(!currentFile)return;
  try{await db.storage.from(BUCKET).remove([currentFile.storage_path]);await db.from('files').delete().eq('id',currentFile.id);closeModal(confirmModal);toast('Archivo eliminado','success');loadFiles()}
  catch(err){toast('Error: '+err.message,'error')}
}

// === RENAME ===

$('#detailRenameBtn').addEventListener('click',()=>{
  if(!currentFile)return;
  renameInput.value=getDisplayName(currentFile);
  closeModal(detailModal);
  openModal(renameModal);
  setTimeout(()=>{renameInput.focus();renameInput.select()},100);
});

renameForm.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!currentFile)return;
  const newName=renameInput.value.trim();
  if(!newName)return toast('Escribe un nombre','error');
  try{
    const{error}=await db.from('files').update({custom_name:newName}).eq('id',currentFile.id);
    if(error)throw error;
    closeModal(renameModal);toast('Archivo renombrado','success');loadFiles();
  }catch(err){toast('Error: '+err.message,'error')}
});

// === MOVE ===

$('#detailMoveBtn').addEventListener('click',()=>{
  if(!currentFile)return;
  moveFileIds=[currentFile.id];
  closeModal(detailModal);
  openMoveModal();
});

function openMoveModal(){
  moveTargetFolder=null;
  renderMoveTree();
  openModal(moveModal);
}

function renderMoveTree(){
  const childFolders=allFolders.filter(f=>f.parent_id===(moveTargetFolder||null));
  let html=`<div class="move-tree-item${moveTargetFolder===null?' selected':''}" data-folder="">`;
  html+=`<span class="tree-icon"><i class="bi bi-house-fill"></i></span><span>Carpeta raíz</span></div>`;
  function renderLevel(parentId,depth){
    const children=allFolders.filter(f=>f.parent_id===parentId);
    children.forEach(f=>{
      const indent='&nbsp;'.repeat(depth*4);
      const isSelected=moveTargetFolder===f.id;
      html+=`<div class="move-tree-item${isSelected?' selected':''}" data-folder="${f.id}">`;
      html+=`<span class="tree-indent">${indent}</span><span class="tree-icon"><i class="bi bi-folder-fill"></i></span><span>${esc(f.name)}</span></div>`;
      renderLevel(f.id,depth+1);
    });
  }
  renderLevel(null,1);
  if(!childFolders.length&&!allFolders.length){
    html+=`<div class="move-tree-empty">No hay carpetas. Crea una primero.</div>`;
  }
  moveTree.innerHTML=html;
  moveTree.querySelectorAll('.move-tree-item').forEach(el=>{
    el.addEventListener('click',()=>{
      moveTree.querySelectorAll('.move-tree-item').forEach(x=>x.classList.remove('selected'));
      el.classList.add('selected');
      moveTargetFolder=el.dataset.folder||null;
    });
  });
}

moveConfirmBtn.addEventListener('click',async()=>{
  if(!moveFileIds.length)return;
  try{
    for(const id of moveFileIds){
      const{error}=await db.from('files').update({folder_id:moveTargetFolder||null}).eq('id',id);
      if(error)throw error;
    }
    closeModal(moveModal);toast(`${moveFileIds.length} archivo(s) movido(s)`,'success');
    selectedIds.clear();renderSelectionBar();loadFiles();
  }catch(err){toast('Error: '+err.message,'error')}
});

moveCancelBtn.addEventListener('click',()=>closeModal(moveModal));

if(window.supabase)initSupabase();else window.addEventListener('load',initSupabase);
