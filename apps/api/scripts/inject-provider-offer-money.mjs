import fs from 'node:fs';

const file=new URL('../src/server.ts',import.meta.url);
let source=fs.readFileSync(file,'utf8');
const marker='// PROVIDER OFFER MONEY V1';

if(!source.includes(marker)){
  const start=source.indexOf("app.get('/api/providers/:id/offers'");
  const end=source.indexOf("app.post('/api/missions-with-tasks'",start);
  if(start<0||end<0)throw new Error('Provider offer money: offers route not found');
  let segment=source.slice(start,end);

  if(!segment.includes('hourly_rate_cents')){
    segment=segment.replace(
      'm.service_lat,m.service_lon,COALESCE((SELECT',
      'm.service_lat,m.service_lon,COALESCE(zcr.hourly_rate_cents,c.hourly_rate_cents,$2::int) hourly_rate_cents,COALESCE((SELECT'
    );
    segment=segment.replace(
      'LEFT JOIN categories c ON c.id=m.category_id WHERE',
      'LEFT JOIN categories c ON c.id=m.category_id LEFT JOIN zone_category_rates zcr ON zcr.zone_id=m.zone_id AND zcr.category_id=m.category_id WHERE'
    );
    segment=segment.replace('ORDER BY o.offered_at`,[id])).rows;','ORDER BY o.offered_at`,[id,DEFAULT_HOURLY_RATE_CENTS])).rows;');
    segment=segment.replace(
      'distance_km:distanceKm,tasks:Array.isArray(row.tasks)?row.tasks:[]',
      'distance_km:distanceKm,hourly_rate_cents:Number(row.hourly_rate_cents||DEFAULT_HOURLY_RATE_CENTS),provider_commission_bps:PROVIDER_COMMISSION_BPS,tasks:Array.isArray(row.tasks)?row.tasks:[]'
    );
  }

  source=source.slice(0,start)+marker+'\n'+segment+source.slice(end);
}

fs.writeFileSync(file,source);
console.log('✓ tarif et gain potentiel ajoutés aux offres prestataire');
