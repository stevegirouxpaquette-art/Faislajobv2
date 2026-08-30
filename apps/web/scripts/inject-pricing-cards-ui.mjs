import fs from 'node:fs';

const requestFile=new URL('../src/RequestFlow.tsx',import.meta.url);
let request=fs.readFileSync(requestFile,'utf8');

const oldCategoryPrice=`{p.hourly!==null&&<small><b>Tarif minute : {money(p.minute)}/min</b><br/><b>Tarif heure : {money(p.hourly)}/h</b><br/>Minimum 15 min : {money(p.minimum)}</small>}`;
const newCategoryPrice=`{p.hourly!==null&&<span className="request-category-price"><span className="request-category-price-row"><span className="request-category-price-rate"><b>{money(p.minute)}</b><em>/ min</em></span><span className="request-category-price-hour">{money(p.hourly)} / h</span></span><span className="request-category-price-min"><span>Minimum 15 min</span><b>{money(p.minimum)}</b></span></span>}`;

if(!request.includes('request-category-price')){
  if(!request.includes(oldCategoryPrice))throw new Error('Pricing cards: category price marker not found');
  request=request.replace(oldCategoryPrice,newCategoryPrice);
}

const oldSelectedPrice=`{selectedPricing&&selectedPricing.hourly!==null&&<div className="request-tip">💵 <span><strong>Tarif minute : {money(selectedPricing.minute)}/minute</strong><br/><strong>Tarif heure : {money(selectedPricing.hourly)}/heure</strong><br/>Minimum facturable de 15 minutes : <strong>{money(selectedPricing.minimum)}</strong></span></div>}`;
const newSelectedPrice=`{selectedPricing&&selectedPricing.hourly!==null&&<div className="request-selected-price"><div><span>À la minute</span><strong>{money(selectedPricing.minute)} <small>/ min</small></strong></div><div><span>À l’heure</span><strong>{money(selectedPricing.hourly)} <small>/ h</small></strong></div><div className="request-selected-price-min"><span>Minimum facturable · 15 min</span><strong>{money(selectedPricing.minimum)}</strong></div></div>}`;

if(!request.includes('request-selected-price')){
  if(!request.includes(oldSelectedPrice))throw new Error('Pricing cards: selected price marker not found');
  request=request.replace(oldSelectedPrice,newSelectedPrice);
}

fs.writeFileSync(requestFile,request);

const cssFile=new URL('../src/request-native.css',import.meta.url);
let css=fs.readFileSync(cssFile,'utf8');
if(!css.includes('.request-category-price{'))css+=`\n/* Clean pricing cards */\n.request-category-copy{flex:1}.request-category-price{display:grid;gap:8px;margin-top:auto;padding-top:11px;border-top:1px solid #24435d}.request-category-price-row{display:flex;align-items:baseline;justify-content:space-between;gap:7px;min-width:0}.request-category-price-rate{display:flex;align-items:baseline;gap:4px;white-space:nowrap}.request-category-price-rate b{font-size:1.08rem;color:#f5fbff;letter-spacing:-.025em}.request-category-price-rate em{font-size:.68rem;font-style:normal;font-weight:900;color:#69bdff}.request-category-price-hour{font-size:.72rem;color:#9eb3c7;font-weight:850;white-space:nowrap}.request-category-price-min{display:flex;justify-content:space-between;align-items:center;gap:7px;font-size:.68rem!important;color:#8299ae!important}.request-category-price-min b{color:#dcecff;font-size:.78rem;white-space:nowrap}.request-selected-price{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:9px}.request-selected-price>div{background:#0c2235;border:1px solid #2a4d69;border-radius:14px;padding:12px;display:grid;gap:5px}.request-selected-price span{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:#84a6c2;font-weight:900}.request-selected-price strong{font-size:1.05rem;color:#f4faff}.request-selected-price strong small{font-size:.68rem;color:#75c5ff}.request-selected-price-min{grid-column:1/-1!important;display:flex!important;grid-template-columns:1fr auto!important;align-items:center!important}.request-selected-price-min strong{font-size:1rem}@media(max-width:560px){.request-category{min-height:205px}.request-category-copy{padding-right:10px}.request-category-price-row{display:grid;gap:2px}.request-category-price-hour{font-size:.68rem}.request-category-price-rate b{font-size:1rem}.request-category-price-min{align-items:flex-end}.request-selected-price{grid-template-columns:1fr 1fr}}\n`;
fs.writeFileSync(cssFile,css);

console.log('✓ pricing cards: cleaner minute/hour/minimum layout');
