import webpush from 'web-push';

type CurrentUser=(request:any)=>Promise<any>;
type PoolLike={query:(sql:string,params?:any[])=>Promise<any>};

type PushPayload={title:string;body:string;url?:string;tag?:string};

const PUBLIC_KEY=process.env.VAPID_PUBLIC_KEY||'';
const PRIVATE_KEY=process.env.VAPID_PRIVATE_KEY||'';
const SUBJECT=process.env.VAPID_SUBJECT||'mailto:notifications@faislajob.ca';
const configured=Boolean(PUBLIC_KEY&&PRIVATE_KEY);

if(configured)webpush.setVapidDetails(SUBJECT,PUBLIC_KEY,PRIVATE_KEY);

async function sendToUser(pool:PoolLike,userId:number,payload:PushPayload){
  if(!configured)return 0;
  const r=await pool.query(`SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=$1`,[userId]);
  let sent=0;
  for(const row of r.rows){
    try{
      await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify({icon:'/favicon.ico',badge:'/favicon.ico',...payload}),{TTL:120});
      sent++;
    }catch(e:any){
      const status=Number(e?.statusCode||0);
      if(status===404||status===410)await pool.query('DELETE FROM push_subscriptions WHERE id=$1',[row.id]);
    }
  }
  return sent;
}

function messageForStatus(status:string):PushPayload|null{
  if(status==='assigned')return{title:'Partenaire trouvé 🎉',body:'Un partenaire a accepté ta mission.',url:'/',tag:'mission-assigned'};
  if(status==='en_route')return{title:'Ton partenaire est en route 🚗',body:'Il se dirige maintenant vers l’adresse de la mission.',url:'/',tag:'mission-en-route'};
  if(status==='arrived')return{title:'Ton partenaire est arrivé 📍',body:'Il est maintenant arrivé sur place.',url:'/',tag:'mission-arrived'};
  if(status==='in_progress')return{title:'La job est commencée 🛠️',body:'Ta mission est maintenant en cours.',url:'/',tag:'mission-started'};
  if(status==='completed')return{title:'Mission terminée ✅',body:'La job est terminée. Ta facture est disponible dans FaisLaJob.',url:'/',tag:'mission-completed'};
  if(status==='cancelled')return{title:'Mission annulée',body:'Ta mission a été annulée. Ouvre FaisLaJob pour les détails.',url:'/',tag:'mission-cancelled'};
  return null;
}

export async function registerPushRoutes(app:any,pool:PoolLike,currentUser:CurrentUser){
  await pool.query(`CREATE TABLE IF NOT EXISTS push_subscriptions(
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);`);

  app.get('/api/push/public-key',async(_request:any,reply:any)=>{
    if(!configured)return reply.code(503).send({error:'push notifications are not configured'});
    return{publicKey:PUBLIC_KEY};
  });

  app.get('/api/push/status',async(request:any,reply:any)=>{
    const user=await currentUser(request);if(!user)return reply.code(401).send({error:'not authenticated'});
    const r=await pool.query('SELECT COUNT(*)::int count FROM push_subscriptions WHERE user_id=$1',[Number(user.id)]);
    return{configured,subscribed:Number(r.rows[0]?.count||0)>0};
  });

  app.post('/api/push/subscribe',async(request:any,reply:any)=>{
    const user=await currentUser(request);if(!user)return reply.code(401).send({error:'not authenticated'});
    if(!configured)return reply.code(503).send({error:'push notifications are not configured'});
    const b=request.body as any,endpoint=String(b?.endpoint||''),p256dh=String(b?.keys?.p256dh||''),auth=String(b?.keys?.auth||'');
    if(!endpoint||!p256dh||!auth)return reply.code(400).send({error:'invalid push subscription'});
    await pool.query(`INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth,user_agent) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,user_agent=EXCLUDED.user_agent,updated_at=NOW()`,[Number(user.id),endpoint,p256dh,auth,String(request.headers['user-agent']||'')]);
    return{ok:true};
  });

  app.post('/api/push/unsubscribe',async(request:any,reply:any)=>{
    const user=await currentUser(request);if(!user)return reply.code(401).send({error:'not authenticated'});
    const endpoint=String((request.body as any)?.endpoint||'');
    if(endpoint)await pool.query('DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2',[Number(user.id),endpoint]);
    return{ok:true};
  });

  app.post('/api/push/test',async(request:any,reply:any)=>{
    const user=await currentUser(request);if(!user)return reply.code(401).send({error:'not authenticated'});
    if(!configured)return reply.code(503).send({error:'push notifications are not configured'});
    const sent=await sendToUser(pool,Number(user.id),{title:'FaisLaJob 🔔',body:'Parfait! Les notifications fonctionnent sur cet appareil.',url:'/',tag:'push-test'});
    return{ok:true,sent};
  });

  // Lightweight event watcher: it observes mission/offer state changes already written by the API,
  // so push notifications stay independent from the mission business logic.
  const missionState=new Map<string,string>();
  const offerSeen=new Set<string>();
  let primed=false;

  const poll=async()=>{
    try{
      const missions=await pool.query(`SELECT m.id::text id,m.status,u.id::bigint user_id
        FROM missions m JOIN users u ON u.client_id=m.client_id
        WHERE m.created_at>NOW()-INTERVAL '7 days' AND m.status IN ('requested','offered','assigned','en_route','arrived','in_progress','completed','cancelled')`);
      const offers=await pool.query(`SELECT mo.id::text id,u.id::bigint user_id,m.category_id
        FROM mission_offers mo JOIN users u ON u.provider_id=mo.provider_id JOIN missions m ON m.id=mo.mission_id
        WHERE mo.status='pending' AND mo.offered_at>NOW()-INTERVAL '24 hours'`);

      if(!primed){
        for(const m of missions.rows)missionState.set(String(m.id),String(m.status));
        for(const o of offers.rows)offerSeen.add(String(o.id));
        primed=true;return;
      }

      for(const m of missions.rows){
        const id=String(m.id),status=String(m.status),previous=missionState.get(id);
        if(previous&&previous!==status){const payload=messageForStatus(status);if(payload)void sendToUser(pool,Number(m.user_id),payload);}
        missionState.set(id,status);
      }
      for(const o of offers.rows){
        const id=String(o.id);
        if(!offerSeen.has(id))void sendToUser(pool,Number(o.user_id),{title:'Nouvelle job disponible ⚡',body:`Une nouvelle mission ${String(o.category_id)} est disponible.`,url:'/',tag:`offer-${id}`});
        offerSeen.add(id);
      }
    }catch(e){console.error('push watcher error',e);}
  };
  setInterval(poll,4000).unref();
  void poll();
}
