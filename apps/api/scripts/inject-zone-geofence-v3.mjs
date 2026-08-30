import fs from 'node:fs';

const file = new URL('../src/server.ts', import.meta.url);
let source = fs.readFileSync(file, 'utf8');
const marker = '// ZONE GEOFENCE V3';

if (!source.includes('// ZONE GEOFENCE V2')) {
  throw new Error('Zone geofence V2 must run before V3');
}

const normalizeHelper = `function normalizeZoneCity(value:any){return String(value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}\n`;
if (!source.includes('function normalizeZoneCity(')) {
  source = source.replace('// ZONE GEOFENCE V2\n', `// ZONE GEOFENCE V2\n${normalizeHelper}`);
}

const replacement = `async function matchServiceZone(latRaw:any,lonRaw:any,cityRaw:any){
 const lat=Number(latRaw),lon=Number(lonRaw),city=normalizeZoneCity(cityRaw),hasCoords=latRaw!==null&&latRaw!==undefined&&lonRaw!==null&&lonRaw!==undefined&&Number.isFinite(lat)&&Number.isFinite(lon);
 const rows=(await pool.query(\`SELECT id,name,city_match,latitude,longitude,radius_km FROM zones WHERE is_active=TRUE ORDER BY id\`)).rows;
 // Repair legacy zones that were created before GPS centers existed.
 for(const z of rows){
  if(z.latitude!=null&&z.longitude!=null)continue;
  const zoneCity=String(z.city_match||'').trim();
  if(!zoneCity)continue;
  try{
   const params=new URLSearchParams({format:'jsonv2',countrycodes:'ca',limit:'1',q:\`\${zoneCity}, Québec, Canada\`});
   const response=await fetch(\`https://nominatim.openstreetmap.org/search?\${params.toString()}\`,{headers:{'Accept-Language':'fr-CA,fr;q=0.9','User-Agent':'FaisLaJob/1.0 zone-geocoder'}});
   if(response.ok){const places=await response.json() as any[];const p=places?.[0],zLat=Number(p?.lat),zLon=Number(p?.lon);if(Number.isFinite(zLat)&&Number.isFinite(zLon)){z.latitude=zLat;z.longitude=zLon;await pool.query('UPDATE zones SET latitude=$1,longitude=$2,updated_at=NOW() WHERE id=$3',[zLat,zLon,z.id])}}
  }catch{}
 }
 let zone:any=null,distanceKm:number|null=null;
 if(hasCoords){
  for(const z of rows){
   if(z.latitude==null||z.longitude==null)continue;
   const zLat=Number(z.latitude),zLon=Number(z.longitude),radius=Number(z.radius_km||25);
   if(!Number.isFinite(zLat)||!Number.isFinite(zLon)||!Number.isFinite(radius)||radius<=0)continue;
   const d=zoneDistanceKm(lat,lon,zLat,zLon);
   if(d<=radius&&(distanceKm===null||d<distanceKm)){zone=z;distanceKm=d}
  }
 }
 // A client physically in the configured city should never be rejected because of a GPS/geocoder variation.
 if(!zone&&city){zone=rows.find((z:any)=>normalizeZoneCity(z.city_match)===city)||null;if(zone&&hasCoords&&zone.latitude!=null&&zone.longitude!=null)distanceKm=zoneDistanceKm(lat,lon,Number(zone.latitude),Number(zone.longitude))}
 return{configured:rows.length>0,zone,distanceKm};
}`;

const matcherPattern = /async function matchServiceZone\([\s\S]*?\napp\.get\('\/api\/zones\/check'/;
if (!matcherPattern.test(source)) throw new Error('Existing zone matcher not found');
source = source.replace(matcherPattern, `${replacement}\napp.get('/api/zones/check'`);

if (!source.includes(marker)) source = source.replace('// CATEGORY ADMIN ROUTES', `${marker}\n// CATEGORY ADMIN ROUTES`);

fs.writeFileSync(file, source);
console.log('✓ zone geofence V3 applied');
