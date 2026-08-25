const ALPHABET='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function encodeNumericId(value:string|number|null|undefined,length:number,salt:number){
  const base=BigInt(ALPHABET.length);
  const n=base**BigInt(length);
  const x=BigInt(Math.max(0,Number(value||0)))%n;
  const a=2654435761n+BigInt(salt*2); // always odd, therefore invertible modulo 32^length
  const b=73244475n+BigInt(salt*7919);
  let y=(x*a+b)%n;
  let out='';
  for(let i=0;i<length;i++){
    out=ALPHABET[Number(y%base)]+out;
    y/=base;
  }
  return out;
}

export function providerPublicId(id:string|number|null|undefined){return encodeNumericId(id,3,11)}
export function clientPublicId(id:string|number|null|undefined){return encodeNumericId(id,4,17)}
export function clientOrderId(id:string|number|null|undefined){return encodeNumericId(id,5,23)}
export function providerMissionId(id:string|number|null|undefined){return encodeNumericId(id,6,29)}

function fnv1a(text:string){let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)}return h>>>0}
function localDayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
export function dailyPinForProfile(role:'client'|'provider',profileId:string|number|null|undefined,date=new Date()){
  const h=fnv1a(`FLJ-verify-v1|${role}|${profileId||0}|${localDayKey(date)}|Q7M4K9`);
  return String(h%10000).padStart(4,'0');
}
export function dailyPin(user:{role:'client'|'provider';client_id:string|null;provider_id:string|null},date=new Date()){
  return dailyPinForProfile(user.role,user.role==='client'?user.client_id:user.provider_id,date);
}
