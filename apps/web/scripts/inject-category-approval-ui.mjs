import fs from 'node:fs';

const requestFile = new URL('../src/RequestFlow.tsx', import.meta.url);
let request = fs.readFileSync(requestFile, 'utf8');

if (!request.includes("id:'a-classer'")) {
  const anchor = "{id:'garde-enfant-devoirs',icon:'👨‍👩‍👧',name:'Garde d’enfant & aide aux devoirs',description:'Garde d’enfants et soutien scolaire à domicile.',subcategories:[{name:'Garde d’enfant',icon:'🧸',description:'Surveillance et garde d’un ou plusieurs enfants'},{name:'Aide aux devoirs',icon:'📚',description:'Accompagnement pour les devoirs et les études'}]}\n];";
  if (!request.includes(anchor)) throw new Error('category approval UI: childcare anchor not found');
  request = request.replace(anchor, anchor.replace('\n];', ",\n{id:'a-classer',icon:'❓',name:'Autre demande',description:'Une demande qui ne correspond à aucune catégorie. Un admin devra la classer avant l’envoi aux prestataires.',subcategories:[{name:'Demande à classer',icon:'📝',description:'Décris précisément ce que tu veux faire; notre équipe choisira la bonne catégorie'}]}\n];"));
}

if (request.includes("setMissionId(String((await mr.json()).mission.id))")) {
  request = request.replace("setMissionId(String((await mr.json()).mission.id))", "const missionResponse=await mr.json();setMissionId(String(missionResponse.mission.id));if(missionResponse.categoryApprovalRequired)setError('Ta demande a été reçue. Elle doit être approuvée et classée par un admin avant d’être envoyée à un prestataire.')");
}
request = request.replace("<p>Mission #{missionId} créée avec succès. On cherche maintenant le bon partenaire.</p>", "<p>Mission #{missionId} créée avec succès. Si tu as choisi « Autre demande », elle sera vérifiée par un admin avant d’être envoyée à un prestataire.</p>");
fs.writeFileSync(requestFile, request);

const adminFile = new URL('../src/AdminPortal.tsx', import.meta.url);
let admin = fs.readFileSync(adminFile, 'utf8');

if (!admin.includes('CATEGORY_APPROVAL_UI_V2')) {
  admin = admin.replace(
    /const statusLabel:Record<string,string>=\{([^}]*)\};/,
    (full, body) => body.includes('pending_admin_category') ? full : `const statusLabel:Record<string,string>={pending_admin_category:'À classer par un admin',${body}};`
  );

  if (!admin.includes('const approveCategory=')) {
    const anchor = /const deleteCategory=async\(c:Category\)=>\{[^\n]*\};/;
    if (!anchor.test(admin)) throw new Error('category approval UI: deleteCategory anchor not found');
    const approval = `\n const approveCategory=async(m:Mission)=>{try{const d=await api('/api/categories');const list=(d.categories||[]).filter((c:Category)=>c.id!=='a-classer');if(!list.length){setError('Aucune catégorie disponible.');return}const names=list.map((c:Category)=>c.name+' ['+c.id+']').join('\\n');const selected=window.prompt('Choisis la catégorie pour la commande #'+clientOrderId(m.id)+' :\\n\\n'+names,list[0].id);if(!selected?.trim())return;await action('/api/admin/missions/'+m.id+'/approve-category',{categoryId:selected.trim()})}catch(e){setError(e instanceof Error?e.message:'Classement impossible')}};\n // CATEGORY_APPROVAL_UI_V2`;
    admin = admin.replace(anchor, match => `${match}${approval}`);
  }

  if (!admin.includes('value="pending_admin_category"')) {
    admin = admin.replace('<option value="requested">À dispatcher</option>', '<option value="requested">À dispatcher</option><option value="pending_admin_category">À classer par un admin</option>');
  }

  const exactActions = "{!['completed','cancelled'].includes(m.status)&&<div className=\"admin-actions\"><button onClick={()=>openAssign(m)}>Assigner</button><button onClick={()=>action(`/api/admin/missions/${m.id}/redispatch`)}>Redispatch</button><button className=\"danger\" onClick={()=>confirm(`Annuler commande #${clientOrderId(m.id)}?`)&&action(`/api/admin/missions/${m.id}/cancel`)}>Annuler</button></div>}";
  if (admin.includes(exactActions)) {
    const replacement = "{m.status==='pending_admin_category'?<div className=\"admin-actions\"><button onClick={()=>approveCategory(m)}>✓ Approuver et classer</button><button className=\"danger\" onClick={()=>confirm(`Annuler commande #${clientOrderId(m.id)}?`)&&action(`/api/admin/missions/${m.id}/cancel`)}>Annuler</button></div>:!['completed','cancelled'].includes(m.status)&&<div className=\"admin-actions\"><button onClick={()=>openAssign(m)}>Assigner</button><button onClick={()=>action(`/api/admin/missions/${m.id}/redispatch`)}>Redispatch</button><button className=\"danger\" onClick={()=>confirm(`Annuler commande #${clientOrderId(m.id)}?`)&&action(`/api/admin/missions/${m.id}/cancel`)}>Annuler</button></div>}";
    admin = admin.replace(exactActions, replacement);
  } else if (!admin.includes("m.status==='pending_admin_category'")) {
    const cardMarker = "</article>)}{missions.length===0";
    if (admin.includes(cardMarker)) admin = admin.replace(cardMarker, "{m.status==='pending_admin_category'&&<div className=\"admin-actions\"><button onClick={()=>approveCategory(m)}>✓ Approuver et classer</button></div>}</article>)}{missions.length===0");
  }
}

fs.writeFileSync(adminFile, admin);
console.log('✓ UI Autre demande + classement admin appliquée');
