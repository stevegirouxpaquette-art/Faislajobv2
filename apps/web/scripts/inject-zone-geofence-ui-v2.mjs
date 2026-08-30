import fs from 'node:fs';

const file = new URL('../src/RequestFlow.tsx', import.meta.url);
let source = fs.readFileSync(file, 'utf8');
const marker = '// ZONE_GEOFENCE_CLIENT_V2';
if(source.includes(marker)){console.log('✓ zone geofence client already wired');process.exit(0)}

source=source.replace("type ValidatedAddress={label:string;lat:number;lon:number}|null;",`type ValidatedAddress={label:string;lat:number;lon:number}|null;\ntype ZoneCheck={configured:boolean;serviceAvailable:boolean;zone:{id:string;name:string;cityMatch:string;radiusKm:number}|null;distanceKm:number|null;hourlyRateCents:number|null};\n${marker}`);

source=source.replace("const[validatedAddress,setValidatedAddress]=useState<ValidatedAddress>(null),[addressLoading,setAddressLoading]=useState(false);","const[validatedAddress,setValidatedAddress]=useState<ValidatedAddress>(null),[addressLoading,setAddressLoading]=useState(false),[zoneCheck,setZoneCheck]=useState<ZoneCheck|null>(null),[geoLoading,setGeoLoading]=useState(false);");

source=source.replace("const updateAddress=(key:keyof AddressFields,value:string)=>{setAddressFields(current=>({...current,[key]:value}));setValidatedAddress(null);setError('')};","const updateAddress=(key:keyof AddressFields,value:string)=>{setAddressFields(current=>({...current,[key]:value}));setValidatedAddress(null);setZoneCheck(null);setError('')};");

const displayAnchor="const displayAddress=(label:string)=>addressFields.apartment.trim()?`${label} — App. ${addressFields.apartment.trim()}`:label;";
if(!source.includes(displayAnchor))throw new Error('RequestFlow displayAddress anchor not found');
source=source.replace(displayAnchor,`${displayAnchor}\n const checkServiceZone=async(lat:number,lon:number,city:string)=>{const params=new URLSearchParams({lat:String(lat),lon:String(lon),city});if(category?.id)params.set('categoryId',category.id);const r=await fetch(\`/api/zones/check?\${params.toString()}\`,{cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||d.error||'Impossible de vérifier la zone de service.');const result=d as ZoneCheck;setZoneCheck(result);return result};\n const locateMe=()=>{if(!navigator.geolocation){setError('La localisation n’est pas disponible sur cet appareil.');return}setGeoLoading(true);setError('');setZoneCheck(null);navigator.geolocation.getCurrentPosition(async position=>{try{const lat=position.coords.latitude,lon=position.coords.longitude,params=new URLSearchParams({format:'jsonv2',addressdetails:'1',lat:String(lat),lon:String(lon)}),r=await fetch(\`https://nominatim.openstreetmap.org/reverse?\${params.toString()}\`,{headers:{'Accept-Language':'fr-CA,fr;q=0.9'}});if(!r.ok)throw new Error('Impossible de trouver ton adresse à partir de ta position.');const place=await r.json() as Place,a=place.address||{},cityName=a.city||a.town||a.village||a.municipality||a.county||'';setAddressFields(current=>({number:a.house_number||'',street:a.road||a.pedestrian||a.residential||'',apartment:current.apartment,city:cityName,postalCode:(a.postcode||'').toUpperCase()}));const validated={label:place.display_name,lat,lon};setValidatedAddress(validated);const zone=await checkServiceZone(lat,lon,cityName);if(zone.configured&&!zone.serviceAvailable)setError('FaisLaJob n’est pas encore disponible à ta position actuelle.')}catch(e){setError(e instanceof Error?e.message:'Impossible d’utiliser ta localisation.')}finally{setGeoLoading(false)}},()=>{setGeoLoading(false);setError('Autorise la localisation dans ton navigateur pour utiliser ta position.')},{enableHighAccuracy:true,timeout:12000,maximumAge:60000})};`);

const validationOld="setValidatedAddress({label:place.display_name,lat:Number(place.lat),lon:Number(place.lon)});";
const validationNew="const validated={label:place.display_name,lat:Number(place.lat),lon:Number(place.lon)};setValidatedAddress(validated);const resolvedCity=place.address?.city||place.address?.town||place.address?.village||place.address?.municipality||city;const zone=await checkServiceZone(validated.lat,validated.lon,resolvedCity);if(zone.configured&&!zone.serviceAvailable)setError('FaisLaJob n’est pas encore disponible à cette adresse.');";
if(!source.includes(validationOld))throw new Error('Validated address assignment not found');
source=source.replace(validationOld,validationNew);

source=source.replace("const submit=async()=>{if(!category||!validatedAddress)return;","const submit=async()=>{if(!category||!validatedAddress||zoneCheck===null||(zoneCheck.configured&&!zoneCheck.serviceAvailable))return;");
source=source.replace("body:JSON.stringify({clientId,categoryId:category.id,description,serviceCity:addressFields.city.trim()})","body:JSON.stringify({clientId,categoryId:category.id,description,serviceCity:addressFields.city.trim(),serviceLat:validatedAddress.lat,serviceLon:validatedAddress.lon})");
source=source.replace("if(!mr.ok)throw new Error('Création de la mission impossible.');setMissionId(String((await mr.json()).mission.id))","const md=await mr.json().catch(()=>({}));if(!mr.ok)throw new Error(md.message||md.error||'Création de la mission impossible.');setMissionId(String(md.mission.id))");

source=source.replace("const selectedPricing=category?pricing(category):null;","const selectedPricing=category?pricing({...category,hourly_rate_cents:zoneCheck?.hourlyRateCents??category.hourly_rate_cents}):null;");
source=source.replace("onClick={()=>{setCategory(c);setSubcategory('');setStep(1)}}","onClick={()=>{setCategory(c);setSubcategory('');setZoneCheck(null);setStep(1)}}");

const addressIntro="{step===4&&<><p className=\"request-copy\">Entre l’adresse de la job. OpenStreetMap va la valider avant de continuer. Le code postal et l’appartement sont facultatifs.</p><div className=\"request-address-grid\">";
const addressIntroNew="{step===4&&<><p className=\"request-copy\">Entre l’adresse de la job ou utilise ta position. FaisLaJob vérifiera automatiquement si l’endroit est dans une zone desservie.</p><button className=\"request-validate-address\" disabled={geoLoading||addressLoading} onClick={locateMe}>{geoLoading?'📍 Localisation…':'📍 Utiliser ma position'}</button><div className=\"request-address-grid\">";
if(!source.includes(addressIntro))throw new Error('Address step intro not found');
source=source.replace(addressIntro,addressIntroNew);

const validateButton="<button className=\"request-validate-address\" disabled={addressLoading} onClick={validateAddress}>{addressLoading?'⏳ Validation…':'✓ Valider l’adresse'}</button>";
const zoneUi=`${validateButton}{zoneCheck&&zoneCheck.configured&&zoneCheck.serviceAvailable&&zoneCheck.zone&&<div className=\"request-tip\">📍 <span><strong>Zone desservie : {zoneCheck.zone.name}</strong><br/>Rayon configuré : {zoneCheck.zone.radiusKm} km{zoneCheck.distanceKm!=null?\` · environ \${zoneCheck.distanceKm} km du centre\`:''}</span></div>}{zoneCheck&&zoneCheck.configured&&!zoneCheck.serviceAvailable&&<div className=\"request-error\">🚫 FaisLaJob n’est pas encore disponible à cette adresse. Essaie une adresse située dans une zone active.</div>}`;
if(!source.includes(validateButton))throw new Error('Validate address button not found');
source=source.replace(validateButton,zoneUi);

const continueOld="<button className=\"request-primary\" disabled={!validatedAddress} onClick={()=>setStep(user?.role==='client'?6:5)}>Continuer →</button>";
const continueNew="<button className=\"request-primary\" disabled={!validatedAddress||zoneCheck===null||(zoneCheck.configured&&!zoneCheck.serviceAvailable)} onClick={()=>setStep(user?.role==='client'?6:5)}>Continuer →</button>";
if(!source.includes(continueOld))throw new Error('Address continue button not found');
source=source.replace(continueOld,continueNew);

const summaryAddress="<div><span>Adresse</span><strong>{validatedAddress?displayAddress(validatedAddress.label):'—'}</strong></div>";
source=source.replace(summaryAddress,`${summaryAddress}{zoneCheck?.zone&&<div><span>Zone</span><strong>{zoneCheck.zone.name}</strong></div>}`);

fs.writeFileSync(file,source);
console.log('✓ zone geofence client wired');
