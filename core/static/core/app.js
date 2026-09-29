/* Weatherly front end: state, data, sky engine, views, command palette. */
const $=s=>document.querySelector(s);
const LS={get(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
let S=Object.assign({theme:'live',temp:'celsius',wind:'kmh',press:'hpa',vis:'km',motion:false},LS.get('wy-set',{}));
if(!['live','night','paper'].includes(S.theme))S.theme='live';
let saved=LS.get('wy-saved',[]),recent=LS.get('wy-recent',[]),cur=LS.get('wy-cur',null);
let data=null,stale=false,route='overview',selH=0,openD=-1,HIDX=[],PTS=[];
const CW=66;
const NAV=[['overview','Overview'],['forecast','Forecast'],['analytics','Analytics'],['map','Map'],['locations','Places'],['settings','Settings']];
const IC={overview:'<path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',forecast:'<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>',analytics:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',map:'<path d="M9 3L3 5v16l6-2 6 2 6-2V3l-6 2z"/><path d="M9 3v16M15 5v16"/>',locations:'<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',settings:'<path d="M4 6h9M19 6h1M4 12h1M11 12h9M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.2"/><circle cx="8" cy="12" r="2.2"/><circle cx="18" cy="18" r="2.2"/>'};
const svgi=(p,s=22)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const QUICK=[{name:'Lahore',region:'Punjab',country:'Pakistan',lat:31.5497,lon:74.3436},{name:'London',region:'England',country:'United Kingdom',lat:51.5072,lon:-0.1276},{name:'New York',region:'New York',country:'United States',lat:40.7128,lon:-74.006},{name:'Dubai',region:'Dubai',country:'United Arab Emirates',lat:25.2048,lon:55.2708},{name:'Tokyo',region:'Tokyo',country:'Japan',lat:35.6762,lon:139.6503},{name:'Sydney',region:'New South Wales',country:'Australia',lat:-33.8688,lon:151.2093}];
/* ---------- helpers ---------- */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nz=v=>v!=null&&!isNaN(v);const clean=a=>a.filter(nz);
const deg=v=>nz(v)?Math.round(v)+'°':'–';
const hh=t=>t.slice(11,16);
const wu=()=>({kmh:'km/h',mph:'mph',ms:'m/s'}[S.wind]);
const DIRN=['north','north-east','east','south-east','south','south-west','west','north-west'],DIRS=['N','NE','E','SE','S','SW','W','NW'];
const dirI=d=>Math.round(d/45)%8;
const dayName=(s,i)=>i===0?'Today':new Date(s+'T12:00').toLocaleDateString('en',{weekday:'short'});
const locLabel=l=>[l.name,l.region,l.country].filter(Boolean).join(', ');
const same=(a,b)=>Math.abs(a.lat-b.lat)<.01&&Math.abs(a.lon-b.lon)<.01;
const NA='<span class="na">Not available</span>';
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1800)}
/* ---------- weather codes -> app conditions ---------- */
function cond(c){if(c===0)return['clear','Clear sky'];if(c<=2)return['partly','Partly cloudy'];if(c===3)return['cloudy','Overcast'];if(c===45||c===48)return['fog','Fog'];if(c>=51&&c<=57)return['rain','Drizzle'];if(c>=61&&c<=67||c>=80&&c<=82)return['rain',c>=65||c===82?'Heavy rain':'Rain'];if(c>=71&&c<=77||c===85||c===86)return['snow','Snow'];if(c>=95)return['storm','Thunderstorm'];return['unknown','Unknown']}
/* ---------- icon language ---------- */
const CLOUD=(c,t='')=>`<g fill="${c}" ${t}><circle cx="17" cy="29" r="7"/><circle cx="26" cy="23" r="9"/><circle cx="35" cy="30" r="6.5"/><rect x="17" y="29" width="18" height="7.5"/></g>`;
const SUN=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#ffc94d"/>`+[0,45,90,135,180,225,270,315].map(a=>`<line x1="${x}" y1="${y-r-3}" x2="${x}" y2="${y-r-6}" stroke="#ffc94d" stroke-width="2.2" stroke-linecap="round" transform="rotate(${a} ${x} ${y})"/>`).join('');
const MOON='<path d="M30 9a14 14 0 1 0 9 25 11.5 11.5 0 0 1-9-25z" fill="#f2efc9"/>';
function wicon(k,night){let b;switch(k){
case'clear':b=night?MOON:SUN(24,24,8);break;
case'partly':b=(night?`<g transform="translate(-8 -8) scale(.8)">${MOON}</g>`:SUN(16,16,6))+CLOUD('#f2f6ff','transform="translate(3 6) scale(.9)"');break;
case'rain':b=CLOUD('#c9d8ee','transform="translate(0 -5)"')+'<g stroke="#6fbaff" stroke-width="2.6" stroke-linecap="round"><path d="M17 36l-2 6M25 36l-2 6M33 36l-2 6"/></g>';break;
case'storm':b=CLOUD('#a9b4cc','transform="translate(0 -6)"')+'<path d="M26 28l-7 11h5l-3 8 10-13h-5l3-6z" fill="#ffd34d"/>';break;
case'snow':b=CLOUD('#e6effb','transform="translate(0 -5)"')+'<g fill="#fff"><circle cx="16" cy="39" r="2.3"/><circle cx="25" cy="42" r="2.3"/><circle cx="34" cy="39" r="2.3"/></g>';break;
case'fog':b=CLOUD('#dfe6ef','transform="translate(0 -6)"')+'<g stroke="#fff" stroke-opacity=".85" stroke-width="2.6" stroke-linecap="round"><path d="M10 35h28M14 41h22"/></g>';break;
default:b=CLOUD('#dfe6ef')}return`<svg class="wi" viewBox="0 0 48 48" aria-hidden="true">${b}</svg>`}
function nightAt(t){const D=data.j.daily,i=D.time.indexOf(t.slice(0,10));if(i<0||!D.sunrise[i]||!D.sunset[i])return false;const h=t.slice(11,16);return h<D.sunrise[i].slice(11,16)||h>=D.sunset[i].slice(11,16)}
/* ---------- data layer (talks only to our Django API) ---------- */
async function jf(u){const r=await fetch(u);if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
const geo={search:async n=>(await jf('/api/search/?q='+encodeURIComponent(n))).results,reverse:async(lat,lon)=>{try{return await jf(`/api/reverse/?lat=${lat}&lon=${lon}`)}catch{return{name:'My location',region:'',country:'',lat,lon}}}};
const cache=new Map();
async function getWeather(l,force){const key=[l.lat.toFixed(2),l.lon.toFixed(2),S.temp,S.wind].join('|');const hit=cache.get(key)||LS.get('wy-c:'+key,null);
if(hit&&!force&&Date.now()-hit.at<600000){cache.set(key,hit);stale=false;return hit}
try{const j=await jf(`/api/forecast/?lat=${l.lat}&lon=${l.lon}&temp=${S.temp}&wind=${S.wind}`);if(!j.current||!j.hourly||!j.daily)throw new Error('bad');const d={at:Date.now(),j};cache.set(key,d);LS.set('wy-c:'+key,d);stale=false;return d}
catch(e){if(hit){stale=true;return hit}throw e}}
/* ---------- sky engine ---------- */
function sunState(){if(!data)return null;const D=data.j.daily,c=data.j.current;if(!D.sunrise[0]||!D.sunset[0])return null;
const m=t=>+t.slice(11,13)*60+ +t.slice(14,16),now=m(c.time),a=m(D.sunrise[0]),b=m(D.sunset[0]),dusk=Math.min(Math.abs(now-a),Math.abs(now-b))<50;
if(now>=a&&now<=b)return{night:false,f:(now-a)/(b-a),l:hh(D.sunrise[0]),r:hh(D.sunset[0]),ll:'Sunrise',rl:'Sunset',len:b-a,dusk};
const nx=D.sunrise[1]||D.sunrise[0],na=m(nx)+1440,s0=now>b?b:b-1440,e0=now>b?na:a;
return{night:true,f:Math.min(1,Math.max(0,(now-s0)/(e0-s0))),l:hh(D.sunset[0]),r:hh(nx),ll:'Sunset',rl:'Sunrise',len:b-a,dusk}}
function fx(k,night){const n=(c,f)=>Array.from({length:c},(_,i)=>f(i)).join('');let h='';
if(night)h+=n(70,i=>`<i class="star" style="left:${(i*37+11)%100}%;top:${(i*53+7)%70}%;width:${1+i%3*.6}px;height:${1+i%3*.6}px;animation-delay:${i%7*.5}s"></i>`);
if(['cloudy','partly','fog','storm','rain','snow'].includes(k)){const dk=k==='rain'||k==='storm'?' dk':'';h+=n(k==='partly'?3:6,i=>`<i class="cloud${dk}" style="top:${4+i*13}%;width:${260+i%3*120}px;height:${70+i%3*30}px;animation-duration:${70+i*18}s;animation-delay:-${i*23}s"></i>`)}
if(k==='fog')h+=n(3,i=>`<i class="fogb" style="top:${40+i*18}%;animation-delay:-${i*7}s"></i>`);
if(k==='rain'||k==='storm')h+=n(90,i=>`<i class="drop" style="left:${(i*23)%100}%;animation-duration:${.55+i%4*.12}s;animation-delay:-${i%9*.15}s;opacity:${.25+i%3*.15}"></i>`);
if(k==='snow')h+=n(60,i=>`<i class="flake" style="left:${(i*31)%100}%;width:${3+i%3*2}px;height:${3+i%3*2}px;animation-duration:${6+i%5*1.5}s;animation-delay:-${i%8}s"></i>`);
if(k==='storm')h+='<i class="flash"></i>';return h}
function applySky(){const R=document.documentElement;R.dataset.t=S.theme==='paper'?'paper':'sky';R.classList.toggle('reduce',S.motion||matchMedia('(prefers-reduced-motion:reduce)').matches);
let sky='clear',night=false,kind='clear',f=.5;const ss=sunState();
if(S.theme==='night'){night=true;sky='night'}
else if(data){const c=data.j.current;kind=cond(c.weather_code)[0];night=c.is_day===0;sky=kind==='partly'?'clear':kind==='unknown'?'cloudy':kind;if(sky==='clear'){if(night)sky='night';else if(ss&&ss.dusk)sky='dusk'}}
if(ss&&S.theme!=='night')f=ss.f;
R.dataset.sky=sky;R.dataset.n=night?'1':'0';$('#skyfx').innerHTML=S.theme==='paper'?'':fx(kind,night);
const dim=!['clear','partly'].includes(kind);$('#orb').style.cssText=`left:${8+84*f}%;top:${48-36*Math.sin(Math.PI*f)}%;opacity:${dim?.22:1}`;
const mt=document.querySelector('meta[name=theme-color]');if(mt)mt.content=({night:'#040915',dusk:'#2a2a6e',cloudy:'#48586f',rain:'#1b2739',storm:'#0d1020',snow:'#566d8b',fog:'#5a6673'}[sky])||(S.theme==='paper'?'#dbe8f8':'#1f5fd1')}
function save(){LS.set('wy-set',S);applySky()}
/* ---------- header, nav, states ---------- */
function head(){const b=$('#locbtn');b.innerHTML=cur?`<b>${esc(cur.name)}</b><small>${esc([cur.region,cur.country].filter(Boolean).join(', ')||'Selected place')}</small>`:'<b>Choose a place</b><small>Search or use your location</small>';
document.title=(data&&cur?Math.round(data.j.current.temperature_2m)+'° '+cur.name+' — ':'')+'Weatherly'}
function nav(){$('#dock').innerHTML=NAV.map(([k,l])=>`<button class="dk" data-r="${k}" ${k===route?'aria-current="page"':''} aria-label="${l}">${svgi(IC[k])}<span>${l}</span></button>`).join('')}
function skel(){return'<div class="sk" style="height:340px"></div><div class="sk" style="height:230px"></div><div class="sk" style="height:300px"></div>'}
function errUI(m,btn,id){return`<section class="panel err">${wicon('cloudy')}<h1>${esc(m[0])}</h1><p>${esc(m[1])}</p><button class="btn" id="${id}">${btn}</button></section>`}
function welcome(){return`<section class="welcome"><h1>Where would you like the weather?</h1><p>Use your location, or search any city, region or postal code.</p><div class="wact"><button class="btn" id="uloc">Use my location</button><button class="btn ghost" id="opalb">Search places</button></div><div class="chips" role="group" aria-label="Popular places">${QUICK.map((q,i)=>`<button data-q="${i}">${q.name}</button>`).join('')}</div></section>`}
/* ---------- overview pieces ---------- */
function hourIdx(){const t=data.j.current.time.slice(0,13);return Math.max(0,data.j.hourly.time.findIndex(x=>x.startsWith(t)))}
function summary(){const {j}=data,c=j.current,H=j.hourly,i0=hourIdx(),n=Math.min(24,H.time.length-i0),p=[];
if(nz(c.apparent_temperature))p.push(`Feels like ${deg(c.apparent_temperature)}.`);
let mi=-1;for(let i=i0;i<i0+n;i++)if(nz(H.temperature_2m[i])&&(mi<0||H.temperature_2m[i]>H.temperature_2m[mi]))mi=i;
if(mi>=0)p.push(mi===i0?'It is about as warm as it gets today.':`Warmest around ${hh(H.time[mi])} at ${deg(H.temperature_2m[mi])}.`);
let ri=-1,rp=0;for(let i=i0;i<i0+Math.min(12,n);i++)if((H.precipitation_probability[i]||0)>rp){rp=H.precipitation_probability[i];ri=i}
if(H.precipitation_probability[i0]!=null||rp)p.push(rp>=40?`Rain is likely around ${hh(H.time[ri])} (${rp}%).`:'No significant rain expected in the next 12 hours.');
if(nz(c.wind_speed_10m)&&nz(c.wind_direction_10m))p.push(`Wind ${Math.round(c.wind_speed_10m)} ${wu()} from the ${DIRN[dirI(c.wind_direction_10m)]}.`);return p.join(' ')}
function arc(){const s=sunState();if(!s)return'';const f=Math.min(1,Math.max(0,s.f)),x=500-460*Math.cos(Math.PI*f),y=200-180*Math.sin(Math.PI*f),d='M40 200A460 180 0 0 1 960 200';
return`<div class="arc"><svg viewBox="0 0 1000 220" role="img" aria-label="${s.night?'Night':'Daylight'} progress from ${s.l} to ${s.r}"><defs><linearGradient id="ag" x1="0" x2="1"><stop offset="0" style="stop-color:var(--warm)"/><stop offset="1" style="stop-color:var(--accent)"/></linearGradient></defs><line class="a-base" x1="0" y1="200" x2="1000" y2="200"/><path class="a-base" d="${d}" fill="none" stroke-width="2" stroke-dasharray="2 9" stroke-linecap="round"/><path class="arcdraw" d="${d}" pathLength="1" fill="none" stroke="url(#ag)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${f} 1"/><g transform="translate(${x} ${y})"><circle r="28" fill="${s.night?'#c9d6ff':'#ffc94d'}" opacity=".2"/><circle r="11" fill="${s.night?'#f2efc9':'#ffc94d'}"/></g></svg><div class="arcl"><span><b>${s.l}</b> ${s.ll}</span><span>${s.night?'':`${Math.floor(s.len/60)} h ${s.len%60} min of daylight`}</span><span><b>${s.r}</b> ${s.rl}</span></div></div>`}
function hero(){const {j}=data,c=j.current,[k,label]=cond(c.weather_code),age=Math.round((Date.now()-data.at)/60000),isFav=saved.some(s=>same(s,cur));
return`<section class="hero" aria-label="Current weather"><div class="hero-top"><span>${new Date(c.time).toLocaleDateString('en',{weekday:'long',day:'numeric',month:'long'})}, ${hh(c.time)} local time</span><span style="display:flex;gap:8px;flex-wrap:wrap"><span class="pill${stale?' warn':''}">${stale?'Offline, showing data from '+age+' min ago':(age<1?'Updated just now':'Updated '+age+' min ago')}</span><button class="pill" id="fav" aria-pressed="${isFav}">${svgi('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"'+(isFav?' fill="currentColor"':'')+'/>',16)}${isFav?'Saved':'Save place'}</button></span></div>
<div class="temp-row"><div class="temp" role="text" aria-label="${Math.round(c.temperature_2m)} degrees">${Math.round(c.temperature_2m)}<sup>°</sup></div><div class="cond-col"><div class="cond">${wicon(k,c.is_day===0)}${label}</div><div class="hl"><span>High<b>${deg(j.daily.temperature_2m_max[0])}</b></span><span>Low<b>${deg(j.daily.temperature_2m_min[0])}</b></span></div><p class="summary">${esc(summary())}</p></div></div>${arc()}</section>`}
function curve(idx){const H=data.j.hourly,v=idx.map(i=>H.temperature_2m[i]),ok=clean(v);if(ok.length<3){PTS=[];return''}
const mn=Math.min(...ok),mx=Math.max(...ok),rg=mx-mn||1,W=idx.length*CW,Ht=110;PTS=v.map((t,n)=>[n*CW+CW/2,nz(t)?14+(1-(t-mn)/rg)*(Ht-24):null]);
const P=PTS.filter(p=>p[1]!=null);let d='M'+P[0].join(',');for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],x=(a[0]+b[0])/2;d+=`C${x},${a[1]} ${x},${b[1]} ${b[0]},${b[1]}`}
return`<svg class="curve" viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Temperature curve from ${deg(mn)} to ${deg(mx)} over the next 24 hours"><defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--warm);stop-opacity:.42"/><stop offset="1" style="stop-color:var(--warm);stop-opacity:0"/></linearGradient></defs><path d="${d}L${P.at(-1)[0]},${Ht}L${P[0][0]},${Ht}Z" fill="url(#cg)"/><path class="cline" d="${d}" stroke-width="3" stroke-linecap="round"/><g id="hmark"><line class="mline" x1="0" x2="0" y1="0" y2="${Ht}"/><circle class="mdot" r="6" cx="0" cy="0"/></g></svg>`}
function hourly(){const H=data.j.hourly,i0=hourIdx(),idx=[];for(let i=i0;i<Math.min(i0+24,H.time.length);i++)idx.push(i);HIDX=idx;
const cols=idx.map((i,n)=>{const [k,l]=cond(H.weather_code[i]),p=H.precipitation_probability[i];return`<button class="hc" data-h="${n}" aria-pressed="false" aria-label="${n===0?'Now':hh(H.time[i])}, ${nz(H.temperature_2m[i])?deg(H.temperature_2m[i]):'no data'}, ${l}"><span>${n===0?'Now':hh(H.time[i]).slice(0,2)}</span>${wicon(k,nightAt(H.time[i]))}<b>${deg(H.temperature_2m[i])}</b><span class="hp"><i style="height:${p||0}%"></i></span><small>${nz(p)?p+'%':''}</small></button>`}).join('');
return`<section class="panel" id="hourp"><div class="ph"><h2>Next 24 hours</h2></div><p id="hsel" aria-live="polite"></p><div class="hscroll"><div class="hin" style="width:${idx.length*CW}px">${curve(idx)}<div class="hcols" role="group" aria-label="Hourly forecast">${cols}</div></div></div></section>`}
function selectHour(n,focus){if(!HIDX.length)return;n=Math.max(0,Math.min(HIDX.length-1,n));selH=n;const btns=document.querySelectorAll('.hc');btns.forEach((b,i)=>b.setAttribute('aria-pressed',i===n));
const H=data.j.hourly,i=HIDX[n],p=H.precipitation_probability[i],bits=[cond(H.weather_code[i])[1],nz(p)&&`${p}% chance of rain`,nz(H.wind_speed_10m[i])&&`wind ${Math.round(H.wind_speed_10m[i])} ${wu()}`,nz(H.uv_index[i])&&`UV ${Math.round(H.uv_index[i])}`].filter(Boolean);
const el=$('#hsel');if(el)el.innerHTML=`<b>${n===0?'Now':hh(H.time[i])}</b> ${esc(bits.join(', '))}`;
const mk=$('#hmark');if(mk&&PTS[n]&&PTS[n][1]!=null){mk.setAttribute('transform',`translate(${PTS[n][0]} 0)`);mk.querySelector('circle').setAttribute('cy',PTS[n][1])}
if(focus&&btns[n]){btns[n].focus({preventScroll:true});btns[n].scrollIntoView({inline:'nearest',block:'nearest'})}}
const tile=(c,l,v,x='')=>`<div class="tile ${c}"><span class="tl">${l}</span>${v}${x}</div>`;
function bento(){const {j}=data,c=j.current,H=j.hourly,i=hourIdx(),uv=H.uv_index[i],vis=H.visibility[i],rain=H.precipitation_probability[i],dew=H.dew_point_2m[i];
const wd=c.wind_direction_10m,ticks=[['N',50,12],['E',88,53],['S',50,94],['W',12,53]].map(([t,x,y])=>`<text x="${x}" y="${y}">${t}</text>`).join('');
const wind=nz(c.wind_speed_10m)?`<div class="trow"><span class="tv">${Math.round(c.wind_speed_10m)}<small>${wu()}</small></span><span class="tn">${nz(wd)?'From the '+DIRN[dirI(wd)]:''}${nz(c.wind_gusts_10m)?`<br>Gusts ${Math.round(c.wind_gusts_10m)} ${wu()}`:''}</span></div>`:NA;
const comp=nz(wd)?`<svg class="compass" viewBox="0 0 100 100" role="img" aria-label="Wind from ${DIRS[dirI(wd)]}"><circle class="cr" cx="50" cy="50" r="38"/>${ticks}<g transform="rotate(${wd+180} 50 50)"><path class="ar" d="M50 22l6 28H44z"/><path class="ar2" d="M50 78l-6-28h12z"/></g></svg>`:'';
const uvL=v=>v<3?'Low':v<6?'Moderate':v<8?'High':v<11?'Very high':'Extreme';
const hum=c.relative_humidity_2m,cc=c.cloud_cover,pr=c.pressure_msl,dc=nz(dew)?(S.temp==='fahrenheit'?(dew-32)*5/9:dew):null;
return`<div class="bento">
${tile('w','Wind',wind,comp)}
${tile('','Humidity',nz(hum)?`<div class="trow"><span class="tv">${hum}<small>%</small></span><span class="tube" role="img" aria-label="${hum} percent"><i style="height:${hum}%"></i></span></div>`:NA)}
${tile('','UV index',nz(uv)?`<span class="tv">${Math.round(uv)}<small>${uvL(uv)}</small></span><span class="scale uv"><i style="left:${Math.min(uv/12,1)*100}%"></i></span>`:NA)}
${tile('','Pressure',nz(pr)?`<span class="tv">${S.press==='inhg'?(pr*0.02953).toFixed(2):Math.round(pr)}<small>${S.press==='inhg'?'inHg':'hPa'}</small></span><span class="scale"><i style="left:${Math.min(1,Math.max(0,(pr-980)/60))*100}%"></i></span><span class="tn">${pr<1009?'Low':pr>1022?'High':'Steady'}</span>`:NA)}
${tile('','Visibility',nz(vis)?`<span class="tv">${S.vis==='mi'?(vis/1609.34).toFixed(1):(vis/1000).toFixed(1)}<small>${S.vis==='mi'?'mi':'km'}</small></span><span class="fill"><i style="width:${Math.min(vis/20000,1)*100}%"></i></span>`:NA)}
${tile('w2','Chance of rain',nz(rain)?`<span class="tv">${rain}<small>%</small></span><span class="fill" role="img" aria-label="${rain} percent"><i style="width:${rain}%"></i></span>`:NA)}
${tile('','Cloud cover',nz(cc)?`<div class="trow"><span class="tv">${cc}<small>%</small></span><span class="ring" style="background:conic-gradient(var(--cool) ${cc}%,var(--line) 0)"></span></div>`:NA)}
${tile('','Dew point',nz(dew)?`<span class="tv">${deg(dew)}</span><span class="tn">${dc<10?'Dry':dc<16?'Comfortable':dc<21?'Humid':'Oppressive'}</span>`:NA)}</div>`}
function detail(i){const D=data.j.daily,[,lab]=cond(D.weather_code[i]),f=(v,s)=>nz(v)?v+s:'N/A';
return`<div class="det"><div><span>Conditions</span>${lab}</div><div><span>Feels like, up to</span>${deg(D.apparent_temperature_max[i])}</div><div><span>Chance of rain</span>${f(D.precipitation_probability_max[i],'%')}</div><div><span>Wind, up to</span>${nz(D.wind_speed_10m_max[i])?Math.round(D.wind_speed_10m_max[i])+' '+wu():'N/A'}</div><div><span>UV, peak</span>${nz(D.uv_index_max[i])?Math.round(D.uv_index_max[i]):'N/A'}</div><div><span>Sun</span>${D.sunrise[i]?hh(D.sunrise[i])+' to '+hh(D.sunset[i]):'N/A'}</div></div>`}
function daily(){const D=data.j.daily,c=data.j.current,mn=Math.min(...clean(D.temperature_2m_min)),mx=Math.max(...clean(D.temperature_2m_max)),r=mx-mn||1;
return`<section class="panel daily" id="dailyp"><h2>Next 7 days</h2>${D.time.map((t,i)=>{const [k]=cond(D.weather_code[i]),lo=D.temperature_2m_min[i],hi=D.temperature_2m_max[i],p=D.precipitation_probability_max[i],now=i===0&&nz(c.temperature_2m)?(c.temperature_2m-mn)/r*100:null;
return`<button class="d" data-d="${i}" aria-expanded="${openD===i}"><span class="dn">${dayName(t,i)}</span>${wicon(k,false)}<span class="dl">${deg(lo)}</span><span class="rt">${nz(lo)&&nz(hi)?`<i class="rf" style="left:${(lo-mn)/r*100}%;width:${Math.max((hi-lo)/r*100,4)}%"></i>`:''}${now!=null?`<i class="nowdot" style="left:${Math.min(100,Math.max(0,now))}%"></i>`:''}</span><span class="dh">${deg(hi)}</span><span class="dp">${nz(p)?p+'%':''}</span></button>${openD===i?detail(i):''}`}).join('')}</section>`}
/* ---------- other pages ---------- */
function locsView(){return'<h1 class="pt">Places</h1>'+(saved.length?`<div class="places">${saved.map((s,i)=>`<article class="place"><button class="pgo" data-go="${i}"><span class="pn">${esc(s.label||s.name)}</span><small class="muted">${esc(locLabel(s))}</small><span class="plive muted" data-live="${i}">Loading current weather</span></button><div class="pact"><input aria-label="Rename ${esc(s.name)}" data-rn="${i}" value="${esc(s.label||'')}" placeholder="Add a nickname"><button class="ib" data-up="${i}" aria-label="Move ${esc(s.name)} up">${svgi('<path d="M12 19V5M5 12l7-7 7 7"/>',18)}</button><button class="ib" data-rm="${i}" aria-label="Remove ${esc(s.name)}">${svgi('<path d="M6 6l12 12M18 6L6 18"/>',18)}</button></div></article>`).join('')}</div>`:`<section class="panel err"><h1>No saved places yet</h1><p>Open a city and choose Save place. It will show up here with its live weather.</p><button class="btn" id="opalb">Search places</button></section>`)}
function seg(k,o){return`<div class="seg" role="group">${o.map(([v,l])=>`<button data-s="${k}:${v}" aria-pressed="${S[k]===v}">${l}</button>`).join('')}</div>`}
function settingsView(){const sw=(v,l,g,c='#fff')=>`<button class="sw" data-s="theme:${v}" aria-pressed="${S.theme===v}" style="background:${g};color:${c}">${l}</button>`;
return`<h1 class="pt">Settings</h1><section class="panel narrow"><div class="set"><div><b>Appearance</b><p class="muted">Live sky changes with the weather and time of day.</p></div><div class="sws">${sw('live','Live sky','linear-gradient(160deg,#1f5fd1,#8ec5ff 60%,#ffd7a3)')}${sw('night','Midnight','linear-gradient(160deg,#040915,#23407a)')}${sw('paper','Paper','linear-gradient(160deg,#dbe8f8,#fff)','#0d1a33')}</div></div>
<div class="set"><b>Temperature</b>${seg('temp',[['celsius','Celsius'],['fahrenheit','Fahrenheit']])}</div>
<div class="set"><b>Wind speed</b>${seg('wind',[['kmh','km/h'],['mph','mph'],['ms','m/s']])}</div>
<div class="set"><b>Pressure</b>${seg('press',[['hpa','hPa'],['inhg','inHg']])}</div>
<div class="set"><b>Visibility</b>${seg('vis',[['km','Kilometres'],['mi','Miles']])}</div>
<div class="set"><div><b>Reduce motion</b><p class="muted">Stops rain, clouds and other background movement.</p></div><div class="seg"><button data-s="motion:toggle" aria-pressed="${S.motion}">${S.motion?'On':'Off'}</button></div></div>
<div class="set"><div><b>Stored weather data</b><p class="muted">Clears cached forecasts and recent places from this browser.</p></div><button class="btn ghost" id="clr">Clear</button></div></section>`}
/* ---------- render / load ---------- */
function render(){destroyViz();nav();head();const v=$('#v');
if(route==='settings'){v.innerHTML=settingsView();return}
if(route==='locations'){v.innerHTML=locsView();enrichSaved();return}
if(route==='map'){v.innerHTML='<h1 class="pt">Map</h1>'+mapView();initMap();return}
if(!cur){v.innerHTML=welcome();return}
if(route==='analytics'){v.innerHTML='<h1 class="pt">Analytics</h1>'+analyticsView();initAnalytics();return}
if(!data){load();return}
v.innerHTML=route==='forecast'?'<h1 class="pt">Forecast</h1>'+hourly()+daily():hero()+hourly()+`<div class="split"><div>${bento()}</div>${daily()}</div>`;
selectHour(selH)}
async function load(force){if(!cur){render();return}const dv=route==='overview'||route==='forecast';if(dv)$('#v').innerHTML=skel();
try{data=await getWeather(cur,force);applySky();render()}catch(e){if(dv)$('#v').innerHTML=errUI(['Weather data is temporarily unavailable.','We could not reach the weather service. Check your connection and try again.'],'Try again','retry')}}
function setLoc(l){cur={name:l.name,region:l.region||'',country:l.country||'',lat:l.lat,lon:l.lon};LS.set('wy-cur',cur);recent=[cur,...recent.filter(r=>!same(r,cur))].slice(0,5);LS.set('wy-recent',recent);selH=0;openD=-1;data=null;closePal();if(route==='settings'||route==='locations'||route==='analytics')route='overview';applySky();load()}
function geoFail(){route='overview';nav();$('#v').innerHTML=errUI(['We couldn\u2019t access your location.','Location permission was denied or unavailable. Search for a city instead.'],'Search places','opalb')}
function useGeo(){if(!navigator.geolocation)return geoFail();toast('Finding your location');navigator.geolocation.getCurrentPosition(async p=>{route=route==='map'?'map':'overview';setLoc(await geo.reverse(p.coords.latitude,p.coords.longitude))},geoFail,{timeout:10000})}
const go=r=>{route=r;openD=-1;render();scrollTo(0,0)};
function setS(k,v){S[k]=v;save();if(k==='temp'||k==='wind')data=null;render()}
/* ---------- command palette ---------- */
let PI=[],pi=0,PR=[],pstate='',pq='',ptm,lastFocus=null;
function cmds(){return[...NAV.map(([k,l])=>({g:'Go to',l,run:()=>go(k)})),
{g:'Actions',l:'Use my location',run:useGeo},{g:'Actions',l:'Refresh weather',run:()=>load(true)},
{g:'Actions',l:S.temp==='celsius'?'Show temperatures in Fahrenheit':'Show temperatures in Celsius',run:()=>setS('temp',S.temp==='celsius'?'fahrenheit':'celsius')},
{g:'Actions',l:'Show wind in '+({kmh:'mph',mph:'m/s',ms:'km/h'}[S.wind]),run:()=>setS('wind',{kmh:'mph',mph:'ms',ms:'kmh'}[S.wind])},
{g:'Appearance',l:'Live sky',run:()=>setS('theme','live')},{g:'Appearance',l:'Midnight',run:()=>setS('theme','night')},{g:'Appearance',l:'Paper',run:()=>setS('theme','paper')}]}
function palRows(){const q=pq.trim().toLowerCase(),pl=(p,g)=>({g,l:p.label||p.name,h:[p.region,p.country].filter(Boolean).join(', '),place:1,run:()=>setLoc(p)});
const rows=q.length>=2?PR.map(p=>pl(p,'Places')):[...saved.map(p=>pl(p,'Saved')),...recent.filter(r=>!saved.some(s=>same(s,r))).map(p=>pl(p,'Recent'))];
return rows.concat(cmds().filter(x=>!q||x.l.toLowerCase().includes(q)))}
function hlt(t,q){const i=q?t.toLowerCase().indexOf(q.toLowerCase()):-1;return i<0?esc(t):esc(t.slice(0,i))+'<mark>'+esc(t.slice(i,i+q.length))+'</mark>'+esc(t.slice(i+q.length))}
function palDraw(){PI=palRows();if(pi>=PI.length)pi=Math.max(0,PI.length-1);let g='',h='';const q=pq.trim();
if(q.length>=2&&pstate)h+=`<div class="pmsg">${{loading:'Searching…',empty:'No places match. Try another city or country.',error:'Search is unavailable right now. Try again in a moment.'}[pstate]||''}</div>`;
PI.forEach((r,i)=>{if(r.g!==g){g=r.g;h+=`<div class="pg">${esc(g)}</div>`}h+=`<button class="pi" role="option" data-pi="${i}" aria-selected="${i===pi}"><span>${r.place?hlt(r.l,q):esc(r.l)}</span><small>${esc(r.h||'')}</small></button>`});
$('#plist').innerHTML=h;const s=document.querySelector('.pi[aria-selected=true]');if(s)s.scrollIntoView({block:'nearest'})}
function openPal(){lastFocus=document.activeElement;$('#pal').hidden=false;pq='';pi=0;PR=[];pstate='';$('#pq').value='';palDraw();$('#pq').focus()}
function closePal(){const p=$('#pal');if(p.hidden)return;p.hidden=true;if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true})}
function pick(i){const r=PI[i];if(!r)return;closePal();r.run()}
$('#pq').addEventListener('input',e=>{pq=e.target.value;pi=0;clearTimeout(ptm);const q=pq.trim();
if(q.length<2){PR=[];pstate='';return palDraw()}pstate='loading';palDraw();
ptm=setTimeout(async()=>{try{PR=await geo.search(q);pstate=PR.length?'':'empty'}catch{PR=[];pstate='error'}if(pq.trim()===q)palDraw()},300)});
$('#pq').addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();pi=(pi+(e.key==='ArrowDown'?1:-1)+PI.length)%(PI.length||1);palDraw()}
else if(e.key==='Enter'){e.preventDefault();pick(pi)}else if(e.key==='Tab'){e.preventDefault()}});
/* ---------- events ---------- */
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#pal').hidden?openPal():closePal();return}
if(e.key==='Escape')closePal();
const hc=e.target.closest&&e.target.closest('.hc');if(hc&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){e.preventDefault();selectHour(selH+(e.key==='ArrowRight'?1:-1),true)}});
document.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const h=e.target.closest&&e.target.closest('.hin');if(!h)return;const n=Math.floor((e.clientX-h.getBoundingClientRect().left)/CW);if(n>=0&&n<HIDX.length&&n!==selH)selectHour(n)});
document.addEventListener('click',e=>{const t=e.target,c=s=>t.closest(s);let b;
if(b=c('[data-pi]'))return pick(+b.dataset.pi);
if(t.id==='pal')return closePal();
if(b=c('[data-r]'))go(b.dataset.r);
else if(b=c('[data-h]'))selectHour(+b.dataset.h);
else if(b=c('[data-d]')){openD=openD===+b.dataset.d?-1:+b.dataset.d;const p=$('#dailyp');p.outerHTML=daily()}
else if(c('#fav')){const i=saved.findIndex(s=>same(s,cur));if(i<0){saved.push({...cur});toast('Saved '+cur.name)}else{saved.splice(i,1);toast('Removed '+cur.name)}LS.set('wy-saved',saved);const f=$('#fav'),on=i<0;f.setAttribute('aria-pressed',on);f.lastChild.textContent=on?'Saved':'Save place'}
else if(b=c('[data-go]')){route='overview';setLoc(saved[+b.dataset.go])}
else if(b=c('[data-rm]')){saved.splice(+b.dataset.rm,1);LS.set('wy-saved',saved);render()}
else if(b=c('[data-up]')){const i=+b.dataset.up;if(i>0){[saved[i-1],saved[i]]=[saved[i],saved[i-1]];LS.set('wy-saved',saved);render()}}
else if(b=c('[data-q]'))setLoc(QUICK[+b.dataset.q]);
else if(b=c('[data-s]')){const[k,v]=b.dataset.s.split(':');setS(k,v==='toggle'?!S.motion:v)}
else if(c('#clr')){Object.keys(localStorage).filter(k=>k.startsWith('wy-c:')).forEach(k=>localStorage.removeItem(k));cache.clear();recent=[];LS.set('wy-recent',[]);toast('Stored data cleared')}
else if(c('#retry'))load(true);
else if(c('#uloc')||c('#loc')||c('#loc2'))useGeo();
else if(c('#locbtn')||c('#opal')||c('#opalb'))openPal();
else if(c('#rf')){toast('Refreshing');load(true)}
else if(c('#th'))setS('theme',{live:'night',night:'paper',paper:'live'}[S.theme])});
document.addEventListener('change',e=>{const i=e.target.dataset.rn;if(i!=null){saved[+i].label=e.target.value.trim();LS.set('wy-saved',saved)}});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',applySky);
applySky();nav();head();load();
