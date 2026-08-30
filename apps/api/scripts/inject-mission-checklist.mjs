import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/server.ts', import.meta.url);
let source = readFileSync(file, 'utf8');

const indexMarker = '    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);';
const tableSql = `    CREATE TABLE IF NOT EXISTS mission_tasks(
      id BIGSERIAL PRIMARY KEY,
      mission_id BIGINT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      required BOOLEAN NOT NULL DEFAULT TRUE,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(mission_id,position)
    );
    CREATE INDEX IF NOT EXISTS mission_tasks_mission_idx ON mission_tasks(mission_id);
`;
if (!source.includes('CREATE TABLE IF NOT EXISTS mission_tasks')) {
  if (!source.includes(indexMarker)) throw new Error('Mission checklist injection: database marker not found');
  source = source.replace(indexMarker, `${tableSql}${indexMarker}`);
}

const missionRouteMarker = "app.post('/api/missions',async(request,reply)=>{";
const checklistRoutes = `app.post('/api/missions-with-tasks',async(request,reply)=>{
  const b=request.body as any,u=await currentUser(request),clientId=u?.role==='client'?Number(u.client_id):Number(b?.clientId||0);
  if(!clientId||!b?.categoryId)return reply.code(400).send({error:'clientId and categoryId are required'});
  const tasks=(Array.isArray(b?.tasks)?b.tasks:[]).slice(0,30).map((t:any,i:number)=>({position:i,title:String(t?.title||'').trim().slice(0,180),details:String(t?.details||'').trim().slice(0,1000),required:t?.required!==false})).filter((t:any)=>t.title.length>0);
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const r=await c.query(\`INSERT INTO missions(client_id,category_id,description,scheduled_at) VALUES($1,$2,$3,$4) RETURNING *\`,[clientId,b.categoryId,b.description?.trim()||null,b.scheduledAt||null]);
    const missionId=Number(r.rows[0].id);
    for(const t of tasks)await c.query(\`INSERT INTO mission_tasks(mission_id,position,title,details,required) VALUES($1,$2,$3,$4,$5)\`,[missionId,t.position,t.title,t.details,t.required]);
    await c.query('COMMIT');
    const offersCreated=await dispatchMission(missionId,b.categoryId);
    return reply.code(201).send({mission:(await pool.query('SELECT * FROM missions WHERE id=$1',[missionId])).rows[0],tasks:(await pool.query('SELECT id,position,title,details,required,completed,completed_at FROM mission_tasks WHERE mission_id=$1 ORDER BY position,id',[missionId])).rows,dispatch:{offersCreated}});
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
});

app.get('/api/missions/:id/tasks',async(request,reply)=>{
  const{id}=request.params as any,u=await currentUser(request);
  if(!u)return reply.code(401).send({error:'authentication required'});
  const m=await pool.query('SELECT client_id,provider_id FROM missions WHERE id=$1',[id]);
  if(!m.rowCount)return reply.code(404).send({error:'mission not found'});
  const row=m.rows[0];
  if(u.role==='client'&&String(row.client_id)!==String(u.client_id))return reply.code(403).send({error:'forbidden'});
  if(u.role==='provider'&&String(row.provider_id)!==String(u.provider_id))return reply.code(403).send({error:'forbidden'});
  return{tasks:(await pool.query('SELECT id,position,title,details,required,completed,completed_at FROM mission_tasks WHERE mission_id=$1 ORDER BY position,id',[id])).rows};
});

app.post('/api/missions/:id/tasks/:taskId/toggle',async(request,reply)=>{
  const u=await requireRole(request,reply,'provider');if(!u)return;
  const{id,taskId}=request.params as any,b=request.body as any;
  if(typeof b?.completed!=='boolean')return reply.code(400).send({error:'completed boolean is required'});
  const m=await pool.query('SELECT status FROM missions WHERE id=$1 AND provider_id=$2',[id,u.provider_id]);
  if(!m.rowCount)return reply.code(404).send({error:'mission not found'});
  if(m.rows[0].status!=='in_progress')return reply.code(409).send({error:'La mission doit être en cours pour cocher les tâches.'});
  const r=await pool.query(\`UPDATE mission_tasks SET completed=$1,completed_at=CASE WHEN $1 THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$2 AND mission_id=$3 RETURNING id,position,title,details,required,completed,completed_at\`,[b.completed,taskId,id]);
  if(!r.rowCount)return reply.code(404).send({error:'task not found'});
  return{task:r.rows[0]};
});

`;
if (!source.includes("app.post('/api/missions-with-tasks'")) {
  if (!source.includes(missionRouteMarker)) throw new Error('Mission checklist injection: mission route marker not found');
  source = source.replace(missionRouteMarker, `${checklistRoutes}${missionRouteMarker}`);
}

const completeMarker = "app.post('/api/missions/:id/complete',async(request,reply)=>{const u=await requireRole(request,reply,'provider');if(!u)return;const{id}=request.params as any,r=await pool.query(";
if (!source.includes('remaining_required_tasks')) {
  if (!source.includes(completeMarker)) throw new Error('Mission checklist injection: complete route marker not found');
  source = source.replace(
    completeMarker,
    "app.post('/api/missions/:id/complete',async(request,reply)=>{const u=await requireRole(request,reply,'provider');if(!u)return;const{id}=request.params as any;const remainingRequired=await pool.query(`SELECT COUNT(*)::int AS remaining_required_tasks FROM mission_tasks WHERE mission_id=$1 AND required=TRUE AND completed=FALSE`,[id]);if(Number(remainingRequired.rows[0]?.remaining_required_tasks||0)>0)return reply.code(409).send({error:'Toutes les tâches obligatoires doivent être cochées avant de terminer la job.',remainingTasks:Number(remainingRequired.rows[0].remaining_required_tasks)});const r=await pool.query("
  );
}

writeFileSync(file, source);
console.log('✓ mission checklist persistence and provider task API wired');
