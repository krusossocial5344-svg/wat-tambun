// ระบบทำบุญวัด — Firebase (Auth + Firestore) + static hosting on Vercel
// ถ้ายังไม่ได้ใส่ค่าใน firebase-config.js หน้าเว็บจะเปิดใน "โหมดตัวอย่าง" (ข้อมูลเก็บในเครื่องนี้เท่านั้น)
const FBV='10.12.2';
let cfgMod={};
try{cfgMod=await import('./firebase-config.js')}catch(e){}
const firebaseConfig=cfgMod.firebaseConfig||{};
const ADMIN_EMAILS=(cfgMod.ADMIN_EMAILS||[]).filter(e=>/@/.test(e)&&!/^ใส่/.test(e));
const DEMO=!(firebaseConfig.apiKey&&!/^ใส่/.test(firebaseConfig.apiKey));

/* ---------- helpers ---------- */
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>(Number(n)||0).toLocaleString('th-TH');
const baht=n=>'฿'+num(n);
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const today=()=>ymd(new Date());
const daysAgo=n=>{const d=new Date();d.setDate(d.getDate()-n);return ymd(d)};
const thDate=d=>{if(!d)return'';const x=new Date(d+'T00:00:00');return isNaN(x)?d:x.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'})};
const thDateLong=d=>{if(!d)return'';const x=new Date(d+'T00:00:00');return isNaN(x)?d:x.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})};
const curBE=()=>new Date().getFullYear()+543;
const campYear=c=>Number(c.year)||(c.date?+c.date.slice(0,4)+543:curBE());
const donorYear=d=>d.date?+d.date.slice(0,4)+543:null;
const sum=(c,list)=>(list||c.donors).reduce((a,d)=>a+(Number(d.amount)||0),0);
const todaySum=c=>{const t=today();return c.donors.filter(d=>d.date===t).reduce((a,d)=>a+(Number(d.amount)||0),0)};
const parseAmt=v=>{const n=Number(String(v??'').replace(/บาท|฿|,|\s/g,''));return isFinite(n)&&n>0?Math.round(n):0};
const tsMs=t=>t&&t.toMillis?t.toMillis():(t&&t._ts)||Date.now();
const initial=s=>{const t=String(s||'').replace(/^(คุณ|นาย|นางสาว|นาง|ร้าน|ครอบครัว|คณะ|ชมรม|บริษัท|ห้างหุ้นส่วนจำกัด)\s*/,'').trim().replace(/^[เแโใไ]+/,'');return t?[...t][0]:'?'};
const hue=s=>{let h=0;for(const ch of String(s))h=(h*31+ch.codePointAt(0))>>>0;return h%7+1};
const DEFAULT_LOGO='icons/logo.webp';
const BLESS={
  welcome:'ขอเชิญท่านสาธุชนร่วมบำเพ็ญกุศล ทำนุบำรุงพระบวรพุทธศาสนา',
  thanks:'ขออนุโมทนาบุญ ขออานิสงส์แห่งกุศลนี้ จงอำนวยพรให้ท่านเจริญด้วยจตุรพิธพรชัย อายุ วรรณะ สุขะ พละ ทุกประการเทอญ',
  cert:'ด้วยอำนาจแห่งกุศลจิตที่ท่านได้บริจาคทรัพย์ ทำนุบำรุงพระบวรพุทธศาสนาในครั้งนี้ ขออานิสงส์ผลบุญจงเป็นพลวปัจจัย อำนวยพรให้ท่านและครอบครัว เจริญด้วยอายุ วรรณะ สุขะ พละ ปฏิภาณ ธนสารสมบัติ ปราศจากทุกข์โศกโรคภัยทั้งปวงเทอญ',
  pali:'อิทํ เม ทานํ อาสวกฺขยาวหํ โหตุ',
  tv:'อายุ วรรณะ สุขะ พละ จงมีแด่ท่านเทอญ',
  footer:'สาธุ สาธุ สาธุ ขออนุโมทนาบุญแด่ท่านสาธุชนทุกท่าน'};
const bless=k=>(S.temple['b_'+k]||BLESS[k]);
const DEFAULT_TYPES=['ทอดกฐิน','ทอดผ้าป่า','บูรณะ/ก่อสร้าง','ค่าน้ำค่าไฟ','ภัตตาหารเพล','ทุนการศึกษา','ทั่วไป'];

/* ---------- icons ---------- */
const IC={key:'<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.7-8.7M17 6l2.5 2.5M14.5 8.5l2 2"/>',plus:'<path d="M12 5v14M5 12h14"/>',share:'<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v13M7 8l5-5 5 5"/>',image:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',back:'<path d="M15 18l-6-6 6-6"/>',home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',wallet:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c1.9.6 3.1 2.4 3.5 5.5"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',logout:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',download:'<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',up:'<path d="M7 14l5-5 5 5"/>',wheel:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 3.5v6.3M12 14.2v6.3M3.5 12h6.3M14.2 12h6.3M6 6l4.4 4.4M13.6 13.6 18 18M18 6l-4.4 4.4M10.4 13.6 6 18"/>',login:'<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M14 17l5-5-5-5M19 12H8"/>',inbox:'<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>',file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',qr:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',pen:'<path d="M4 20c3-1 4-4 6-6l7-7a2.1 2.1 0 0 0-3-3l-7 7c-2 2-5 3-6 6"/><path d="M13 6l3 3"/>',menu:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',phone:'<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',pin:'<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',upload:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'};
const ic=(n,s=20)=>`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

/* ---------- demo data layer (same calls as Firestore, kept in this browser) ---------- */
function demoSeed(){
  const T=n=>({_ts:Date.now()-n*86400000});
  const st={settings:{temple:{name:'วัดเสือข้าม',place:'ต.ประศุก อ.อินทร์บุรี จ.สิงห์บุรี',types:DEFAULT_TYPES}},
    accounts:{a1:{label:'บัญชีหลักของวัด',bank:'ธนาคารกรุงไทย',name:'วัดเสือข้าม (เพื่อการทำบุญ)',no:'000-0-00000-0',promptpay:'',isDefault:true},a2:{label:'บัญชีกฐิน',bank:'ธนาคารออมสิน',name:'กองทุนกฐินวัดเสือข้าม',no:'000-0-00000-1',promptpay:'',isDefault:false}},
    campaigns:{
      c1:{type:'ทอดกฐิน',title:'กฐินสามัคคี ประจำปี '+curBE(),desc:'ร่วมเป็นเจ้าภาพกฐินสามัคคี ถวายผ้ากฐินและปัจจัยบำรุงวัด\nแห่องค์กฐินเวลา 09.00 น. ถวายเวลา 10.30 น.',year:curBE(),goal:200000,date:daysAgo(-12),acctIds:['a2'],hideAmt:false,createdAt:T(1)},
      c2:{type:'บูรณะ/ก่อสร้าง',title:'บูรณะหลังคาศาลาการเปรียญ',desc:'เปลี่ยนกระเบื้องหลังคาศาลาที่รั่วซึม ตารางเมตรละ 450 บาท',year:curBE(),goal:350000,date:'',acctIds:[],hideAmt:false,createdAt:T(2)},
      c3:{type:'ค่าน้ำค่าไฟ',title:'ค่าน้ำค่าไฟวัด ประจำเดือน',desc:'ร่วมเป็นเจ้าภาพค่าน้ำค่าไฟประจำเดือน',year:curBE(),goal:0,date:'',acctIds:[],hideAmt:true,createdAt:T(3)},
      c4:{type:'ทอดกฐิน',title:'กฐินสามัคคี ประจำปี '+(curBE()-1),desc:'',year:curBE()-1,goal:150000,date:'',acctIds:['a2'],hideAmt:false,createdAt:T(370)}},
    donations:{}};
  const MS=['cash','cash','transfer','qr'],WHO=[['u1','พี่สมศรี'],['u2','น้องต้น']];const add=(c,name,amount,ago,note,want,sent)=>{const i=Object.keys(st.donations).length;st.donations['d'+i]={campaignId:c,name,amount,date:daysAgo(ago),note:note||'',wantReceipt:!!want,receiptSent:!!sent,method:MS[i%4],createdAt:T(ago),createdBy:WHO[i%2][0],createdByName:WHO[i%2][1]}};
  add('c1','คุณสมชาย ใจบุญ และครอบครัว',5000,6,'',true,true);add('c1','ร้านทองเจริญผล',10000,4,'อุทิศให้คุณพ่อ',true,false);add('c1','ไม่ประสงค์ออกนาม',1000,2);add('c1','คุณวิภา แสงทอง',2000,0,'',true,false);add('c1','ครอบครัวศรีสวัสดิ์',3500,0);
  add('c2','ชมรมผู้สูงอายุ',12000,9);add('c2','คุณมาลี ศรีสุข',900,1,'2 ตารางเมตร');add('c3','ครอบครัวทองดี',2000,5);add('c3','คุณอนันต์ มีสุข',500,0);
  add('c4','คณะศิษย์วัด',42000,380);add('c4','คุณประยูร แก้วงาม',3000,372);
  st.accounts.a3={label:'พร้อมเพย์วัด',bank:'พร้อมเพย์',name:'วัดเสือข้าม',no:'',promptpay:'0812345678',isDefault:false};
  st.campaigns.c1.acctIds=['a3','a2'];st.campaigns.c2.acctIds=['a3','a1'];
  st.receipts={d1:{donationId:'d1',campaignId:'c1',donorName:'ร้านทองเจริญผล',receiptName:'ห้างหุ้นส่วนจำกัด ทองเจริญผล',taxId:'0000000000000',address:'99 ถ.ตัวอย่าง อ.เมือง จ.สิงห์บุรี',phone:'080-000-0000',note:'ขอใบในนามบริษัท',amount:10000,date:daysAgo(4),status:'pending',createdAt:T(4)},
    d3:{donationId:'d3',campaignId:'c1',donorName:'คุณวิภา แสงทอง',receiptName:'นางวิภา แสงทอง',taxId:'0000000000000',address:'12 หมู่ 3 ต.ตัวอย่าง',phone:'',note:'',amount:2000,date:daysAgo(0),status:'pending',createdAt:T(0)},
    d0:{donationId:'d0',campaignId:'c1',donorName:'คุณสมชาย ใจบุญ และครอบครัว',receiptName:'นายสมชาย ใจบุญ',taxId:'0000000000000',address:'5 ถ.ตัวอย่าง',phone:'',note:'',amount:5000,date:daysAgo(6),status:'issued',ref:'ED-ตัวอย่าง-001',createdAt:T(6)}};
  st.slips={s1:{campaignId:'c1',name:'คุณบุญมี ใจดี',amount:999,date:daysAgo(0),note:'โอนผ่านพร้อมเพย์',wantReceipt:true,receipt:{receiptName:'นายบุญมี ใจดี',taxId:'0000000000000',address:'1 ถ.ตัวอย่าง',phone:'081-000-0000'},img:demoSlipImg(),status:'pending',createdAt:T(0)}};
  st.settings.temple.signer='(ชื่อเจ้าอาวาส)';st.settings.temple.signerTitle='เจ้าอาวาสวัดเสือข้าม';st.settings.temple.address='ต.ประศุก อ.อินทร์บุรี จ.สิงห์บุรี';st.settings.temple.phone='036-000-000';
  st.logs={l1:{action:'create',target:'donation',targetId:'c1',summary:'เพิ่ม 2 รายการ รวม ฿5,500 (เงินสด) · กฐินสามัคคี: คุณวิภา แสงทอง 2,000, ครอบครัวศรีสวัสดิ์ 3,500',by:'u1',byName:'พี่สมศรี',at:T(0)},l2:{action:'update',target:'donation',targetId:'d1',summary:'แก้ไข ร้านทองเจริญผล: ยอด ฿1,000 → ฿10,000 · เหตุผล: พิมพ์ยอดผิด',by:'demo-admin',byName:'แอดมิน (ทดลอง)',at:T(3)}};
  st.presence={u1:{name:'พี่สมศรี',email:'a@example.com',role:'staff',at:T(0)},u2:{name:'น้องต้น',email:'b@example.com',role:'staff',at:T(0)}};
  return st;
}
function demoSlipImg(){
  try{const c=document.createElement('canvas');c.width=360;c.height=560;const x=c.getContext('2d');
    x.fillStyle='#fff';x.fillRect(0,0,360,560);x.fillStyle='#12b5a6';x.fillRect(0,0,360,90);x.fillStyle='#fff';x.font='bold 26px sans-serif';x.fillText('โอนเงินสำเร็จ',24,56);
    x.fillStyle='#171927';x.font='20px sans-serif';[['จำนวนเงิน','999.00 บาท'],['ไปยัง','วัดเสือข้าม'],['วันที่',new Date().toLocaleDateString('th-TH')],['เลขที่รายการ','ตัวอย่าง']].forEach(([a,b],i)=>{x.fillStyle='#6a6f86';x.fillText(a,24,150+i*80);x.fillStyle='#171927';x.font='bold 24px sans-serif';x.fillText(b,24,182+i*80);x.font='20px sans-serif'});
    x.fillStyle='#ff3d77';x.font='bold 18px sans-serif';x.fillText('สลิปตัวอย่าง (ไม่ใช่สลิปจริง)',24,530);return c.toDataURL('image/jpeg',.7)}catch(e){return ''}
}
function demoApi(){
  const KEY='wat-demo-db-v6';
  const revive=v=>{if(v&&typeof v==='object'){if('_ts' in v&&Object.keys(v).length===1)return {_ts:v._ts,toMillis(){return this._ts}};for(const k in v)v[k]=revive(v[k])}return v};
  let store=LS.get(KEY,null)||demoSeed();store=revive(store);
  const ls=new Set(),col=c=>store[c]||(store[c]={}),clone=o=>revive(JSON.parse(JSON.stringify(o)));
  const notify=()=>{LS.set(KEY,store);setTimeout(()=>ls.forEach(f=>f()),0)};
  const val=v=>v&&typeof v==='object'&&'_ts' in v?v._ts:v;
  const okF=(d,f)=>{const v=val(d[f.f]);return f.op==='=='?v===f.v:f.op==='in'?f.v.includes(v):f.op==='>='?v>=f.v:f.op==='<='?v<=f.v:true};
  const rows=ref=>{let l=Object.entries(col(ref.c)).filter(([,d])=>(ref.filters||[]).every(f=>okF(d,f)));
    if(ref.order){const k=ref.order.f,dir=ref.order.dir==='desc'?-1:1;l.sort((a,b)=>((val(a[1][k])??0)>(val(b[1][k])??0)?1:(val(a[1][k])??0)<(val(b[1][k])??0)?-1:0)*dir)}
    if(ref.lim)l=l.slice(0,ref.lim);return l.map(([id,d])=>({id,data:()=>clone(d)}))};
  const api={
    doc:(db,c,id)=>({kind:'doc',c,id}),collection:(db,c)=>({kind:'col',c,filters:[]}),
    query:(b,...cs)=>{const q={kind:'col',c:b.c,filters:[...(b.filters||[])],order:b.order,lim:b.lim};cs.forEach(x=>{if(x.t==='w')q.filters.push(x);else if(x.t==='o')q.order=x;else if(x.t==='l')q.lim=x.n});return q},
    where:(f,op,v)=>({t:'w',f,op,v}),orderBy:(f,dir)=>({t:'o',f,dir}),limit:n=>({t:'l',n}),
    sum:f=>({t:'sum',f}),count:()=>({t:'count'}),
    async getDocs(ref){return{docs:rows(ref)}},
    async getAggregateFromServer(ref,spec){const r=rows(ref),out={};for(const k in spec){const x=spec[k];out[k]=x.t==='count'?r.length:r.reduce((a,d)=>a+(Number(d.data()[x.f])||0),0)}return{data:()=>out}},
    async signInAnonymously(){return{user:{uid:'demo-anon'}}},
    serverTimestamp:()=>({_ts:Date.now(),toMillis(){return this._ts}}),
    onSnapshot(ref,cb){const fire=()=>{if(ref.kind==='doc'){const d=col(ref.c)[ref.id];cb({exists:()=>!!d,data:()=>d?clone(d):undefined})}else cb({docs:rows(ref)})};ls.add(fire);setTimeout(fire,0);return()=>ls.delete(fire)},
    async getDoc(ref){const d=col(ref.c)[ref.id];return{exists:()=>!!d,data:()=>d&&clone(d)}},
    async setDoc(ref,data,o){const c=col(ref.c);c[ref.id]=o&&o.merge?{...(c[ref.id]||{}),...data}:{...data};notify()},
    async updateDoc(ref,data){const c=col(ref.c);if(!c[ref.id])throw Object.assign(new Error('not-found'),{code:'not-found'});c[ref.id]={...c[ref.id],...data};notify()},
    async deleteDoc(ref){delete col(ref.c)[ref.id];notify()},
    writeBatch(){const ops=[];return{set:(r,d,o)=>ops.push(()=>api.setDoc(r,d,o)),update:(r,d)=>ops.push(()=>api.updateDoc(r,d)),delete:r=>ops.push(()=>api.deleteDoc(r)),async commit(){for(const f of ops)await f()}}},
    reset(){store=revive(demoSeed());notify()}
  };
  return api;
}

/* ---------- connect ---------- */
let F,db=null,auth=null;
if(DEMO){F=demoApi()}
else{
  const [A,U,S_]=await Promise.all([import(`https://www.gstatic.com/firebasejs/${FBV}/firebase-app.js`),import(`https://www.gstatic.com/firebasejs/${FBV}/firebase-auth.js`),import(`https://www.gstatic.com/firebasejs/${FBV}/firebase-firestore.js`)]);
  F={...A,...U,...S_};
  const fb=F.initializeApp(firebaseConfig);auth=F.getAuth(fb);
  if(cfgMod.RECAPTCHA_SITE_KEY){try{const AC=await import(`https://www.gstatic.com/firebasejs/${FBV}/firebase-app-check.js`);AC.initializeAppCheck(fb,{provider:new AC.ReCaptchaV3Provider(cfgMod.RECAPTCHA_SITE_KEY),isTokenAutoRefreshEnabled:true})}catch(e){console.warn('App Check',e)}}
  try{db=F.initializeFirestore(fb,{localCache:F.persistentLocalCache({tabManager:F.persistentMultipleTabManager()})})}catch(e){db=F.initializeFirestore(fb,{})}
}
const {doc,collection,onSnapshot,writeBatch,setDoc,updateDoc,deleteDoc,getDoc,serverTimestamp,query,where,orderBy,limit,getDocs}=F;

/* ---------- live data ----------
   อ่านเท่าที่จำเป็น เพื่อไม่ให้เกินโควตาฟรีของ Firebase:
   - หน้ารวมงานบุญ: ใช้ยอดสรุป (aggregate) ต่องาน 1 ครั้งต่อนาที ไม่โหลดรายชื่อ
   - หน้างานบุญ (คนทั่วไป): รายชื่อล่าสุด 60 รายการ + ยอดสรุป กด "ดูเพิ่ม" ได้
   - หน้างานบุญ (เจ้าหน้าที่): รายชื่อทั้งหมดของงานนั้นงานเดียว
   - รายงาน / ค้นหา / สำรองข้อมูล: โหลดทั้งหมดครั้งเดียวเมื่อเปิดหน้านั้น (เฉพาะเจ้าหน้าที่) */
const S={temple:{name:'',place:''},types:DEFAULT_TYPES,accounts:[],campaigns:[],donations:[],don:{},full:{},allDon:null,allAt:0,agg:{},day:null,roles:[],slips:[],slipsDone:null,dup:{},receipts:[],presence:[],logs:[],closings:[],updatedAt:null,loaded:{t:false,a:false,c:false}};
let freshKeys=new Set();
const ANON='ผู้ไม่ประสงค์ออกนาม';
/* ช่องชื่อยาวขึ้นตามข้อความ ไม่ตัดท้าย */
function autosize(el){if(!el)return;el.style.height='auto';el.style.height=el.scrollHeight+2+'px'}
document.addEventListener('input',e=>{if(e.target.classList&&e.target.classList.contains('autogrow'))autosize(e.target)});
const growAll=root=>root.querySelectorAll('textarea.autogrow').forEach(autosize);
addEventListener('resize',()=>{clearTimeout(growAll.t);growAll.t=setTimeout(()=>growAll(document),150)});
function knownDon(){
  const m=new Map();(S.allDon||[]).forEach(d=>m.set(d.k,d));
  for(const id in S.don){if(S.allDon&&S.full[id])for(const [k,d] of m)if(d.campaignId===id)m.delete(k);S.don[id].forEach(d=>m.set(d.k,d))}
  return [...m.values()];
}
function rebuild(){
  S.donations=knownDon();
  const by=new Map();S.donations.forEach(d=>{if(!by.has(d.campaignId))by.set(d.campaignId,[]);by.get(d.campaignId).push(d)});
  S.campaigns.forEach(c=>{c.donors=by.get(c.id)||[];c.full=!!S.allDon||S.full[c.id]===true;c.ready=c.full||!!S.don[c.id]});
  const last=Math.max(0,...S.donations.map(d=>tsMs(d.createdAt)),...Object.values(S.agg).map(a=>a.last||0),...S.campaigns.map(c=>tsMs(c.updatedAt||c.createdAt)));
  S.updatedAt=last?new Date(last):null;
}
/* ยอดของงาน: ถ้ามีรายชื่อครบในเครื่องก็นับเอง ไม่งั้นใช้ยอดสรุปจากเซิร์ฟเวอร์ */
function stats(c){if(!c)return{total:0,n:0,today:0};if(c.full)return{total:sum(c),n:c.donors.length,today:todaySum(c)};return S.agg[c.id]||{total:0,n:0,today:0,wait:true}}
const aggBusy=new Set();
let refT=null;const softRefresh=()=>{clearTimeout(refT);refT=setTimeout(refresh,60)};
function needAgg(list,maxAge=60000){
  list.forEach(c=>{if(!c||c.full||aggBusy.has(c.id))return;const a=S.agg[c.id];if(a&&Date.now()-a.at<maxAge)return;aggBusy.add(c.id);
    const base=query(collection(db,'donations'),where('campaignId','==',c.id));
    Promise.all([F.getAggregateFromServer(base,{total:F.sum('amount'),n:F.count()}),F.getAggregateFromServer(query(base,where('date','==',today())),{total:F.sum('amount')})])
      .then(([a1,a2])=>{const n=a1.data().n||0,old=S.agg[c.id];S.agg[c.id]={total:a1.data().total||0,n,today:a2.data().total||0,at:Date.now(),last:old&&old.n!==n?Date.now():(old?.last||0)}})
      .catch(e=>{console.warn('aggregate',e);S.agg[c.id]={...(S.agg[c.id]||{total:0,n:0,today:0}),at:Date.now(),err:true}})
      .finally(()=>{aggBusy.delete(c.id);rebuild();softRefresh()})});
}
/* ติดตามรายชื่อแบบสด เฉพาะงานที่กำลังเปิดดู */
const live={};let daySub=null;
function stashAgg(id){const c=S.campaigns.find(x=>x.id===id);if(c&&c.full&&!S.allDon)S.agg[id]={total:sum(c),n:c.donors.length,today:todaySum(c),at:Date.now()}}
function syncLive(){
  const r=route(),want=new Map();
  if(['camp','edit','tv'].includes(r.p))want.set(r.id,isStaff()?0:(ui.lim||60));
  for(const id in live){if(want.get(id)!==live[id].lim){stashAgg(id);live[id].unsub();delete live[id];delete S.don[id];delete S.full[id];rebuild()}}
  want.forEach((lim,id)=>{if(live[id])return;let seen=null;
    const base=query(collection(db,'donations'),where('campaignId','==',id));
    const q=lim?query(base,orderBy('createdAt','desc'),limit(lim)):base;
    live[id]={lim,unsub:onSnapshot(q,snap=>{const arr=snap.docs.map(d=>({k:d.id,...d.data()}));const keys=new Set(arr.map(d=>d.k));
      if(seen)keys.forEach(k=>{if(!seen.has(k))freshKeys.add(k)});const changed=!seen||keys.size!==seen.size||[...keys].some(k=>!seen.has(k));seen=keys;
      S.don[id]=arr;S.full[id]=!lim;rebuild();if(lim&&changed){if(S.agg[id])S.agg[id].at=0;needAgg([S.campaigns.find(x=>x.id===id)],0)}
      refresh()},onErr)}});
  /* ปิดยอดประจำวัน: ดูเฉพาะรายการของวันที่เลือก */
  const day=r.p==='closing'&&isStaff()?(ui.cday||today()):null;
  if((daySub&&daySub.day)!==day){if(daySub)daySub.unsub();daySub=null;S.day=null;
    if(day)daySub={day,unsub:onSnapshot(query(collection(db,'donations'),where('date','==',day)),snap=>{S.day={day,list:snap.docs.map(d=>({k:d.id,...d.data()}))};refresh()},onErr)}}
}
/* โหลดทั้งหมดครั้งเดียว (รายงาน ค้นหา สำรองข้อมูล) */
let allBusy=null;
function loadAll(stale){
  if(!isStaff())return Promise.resolve();
  if(S.allDon&&!(stale&&Date.now()-S.allAt>stale))return Promise.resolve();
  if(allBusy)return allBusy;
  allBusy=getDocs(collection(db,'donations')).then(q=>{S.allDon=q.docs.map(d=>({k:d.id,...d.data()}));S.allAt=Date.now();cacheNames();rebuild();refresh()}).catch(onErr).finally(()=>{allBusy=null});
  return allBusy;
}
const findDon=k=>S.donations.find(x=>x.k===k)||(S.day?.list||[]).find(x=>x.k===k);
function onErr(e){console.error(e);if(e&&e.code==='failed-precondition'&&/index/i.test(e.message||'')){toast('ต้องสร้างดัชนีในฐานข้อมูลก่อน ดูวิธีใน README (firestore.indexes.json)',7000);return}if(e&&e.code!=='permission-denied')toast('เชื่อมต่อฐานข้อมูลไม่ได้: '+(e.code||e.message),5000)}
onSnapshot(doc(db,'settings','temple'),s=>{const d=s.data()||{};S.temple={name:d.name||'ชื่อวัด',place:d.place||'',address:d.address||'',phone:d.phone||'',line:d.line||'',facebook:d.facebook||'',footerNote:d.footerNote||'',signer:d.signer||'',signerTitle:d.signerTitle||'',lastBackupAt:d.lastBackupAt||null,logo:d.logo||'',b_welcome:d.b_welcome||'',b_thanks:d.b_thanks||'',b_cert:d.b_cert||'',b_tv:d.b_tv||''};S.types=Array.isArray(d.types)&&d.types.length?d.types:DEFAULT_TYPES;S.loaded.t=true;refresh()},onErr);
onSnapshot(collection(db,'accounts'),q=>{S.accounts=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.isDefault?1:0)-(a.isDefault?1:0)||(a.label||'').localeCompare(b.label||'','th'));S.loaded.a=true;refresh()},onErr);
onSnapshot(collection(db,'campaigns'),q=>{S.campaigns=q.docs.map(d=>({id:d.id,acctIds:[],...d.data()})).sort((a,b)=>tsMs(b.createdAt)-tsMs(a.createdAt));S.loaded.c=true;rebuild();refresh()},onErr);
setInterval(()=>{if(document.hidden)return;const p=route().p;if(p==='home'||p==='welcome')needAgg(S.campaigns.filter(c=>campYear(c)===activeYear()));else if(p==='camp'||p==='tv')needAgg([S.campaigns.find(c=>c.id===route().id)])},30000);
/* staff-only collections: slips + who is online; admin-only: receipt requests + roles */
const subs={};
function watchPrivate(){
  Object.values(subs).forEach(u=>u&&u());for(const k in subs)delete subs[k];
  S.slips=[];S.slipsDone=null;S.dup={};S.allDon=null;rebuild();S.receipts=[];S.presence=[];S.roles=[];S.logs=[];S.closings=[];
  if(isStaff()){
    subs.slips=onSnapshot(query(collection(db,'slips'),where('status','==','pending')),q=>{S.slips=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>tsMs(b.createdAt)-tsMs(a.createdAt));S.slips.forEach(checkDup);refresh()},onErr);
    subs.presence=onSnapshot(collection(db,'presence'),q=>{S.presence=q.docs.map(d=>({id:d.id,...d.data()}));refresh()},onErr);
    subs.closings=onSnapshot(collection(db,'closings'),q=>{S.closings=q.docs.map(d=>({id:d.id,...d.data()}));refresh()},onErr);
  }
  if(isAdmin()){
    subs.receipts=onSnapshot(collection(db,'receipts'),q=>{S.receipts=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>tsMs(b.createdAt)-tsMs(a.createdAt));refresh()},onErr);
    const lq=DEMO?collection(db,'logs'):F.query(collection(db,'logs'),F.orderBy('at','desc'),F.limit(500));
    subs.logs=onSnapshot(lq,q=>{S.logs=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>tsMs(b.at)-tsMs(a.at));refresh()},onErr);
    if(!DEMO)subs.roles=onSnapshot(collection(db,'roles'),q=>{S.roles=q.docs.map(d=>({email:d.id,...d.data()}));refresh()},onErr);
  }
}
const pendingSlips=()=>S.slips.length;
const slipBy=id=>S.slips.find(x=>x.id===id)||(S.slipsDone||[]).find(x=>x.id===id);
function loadDoneSlips(){S.slipsDone=S.slipsDone||'loading';getDocs(query(collection(db,'slips'),where('status','in',['approved','rejected']),orderBy('createdAt','desc'),limit(20))).then(q=>{S.slipsDone=q.docs.map(d=>({id:d.id,...d.data()}));refresh()}).catch(e=>{S.slipsDone=[];onErr(e)})}
const pendingReceipts=()=>S.receipts.filter(r=>r.status!=='issued').length;
const onlineNow=()=>S.presence.filter(p=>DEMO||Date.now()-tsMs(p.at)<150000);

const defaultAcct=()=>S.accounts.find(a=>a.isDefault)||S.accounts[0];
function accountsFor(c){const l=(c.acctIds||[]).map(id=>S.accounts.find(a=>a.id===id)).filter(Boolean);if(l.length)return l;const d=defaultAcct();return d?[d]:[]}
const acctTitle=a=>a.label||[a.bank,a.name].filter(Boolean).join(' · ')||a.no||a.promptpay;

/* ---------- who is viewing ---------- */
let user=null,role='viewer';
const isAdmin=()=>role==='admin',isStaff=()=>role==='admin'||role==='staff';
if(DEMO){
  const setDemo=r=>{role=r;user=r==='viewer'?null:{displayName:r==='admin'?'แอดมิน (ทดลอง)':'เจ้าหน้าที่ (ทดลอง)',email:r+'@example.com',uid:'demo-'+r};LS.set('wat-demo-role',r)};
  setDemo(LS.get('wat-demo-role','admin'));
  window.__setDemo=r=>{setDemo(r);watchPrivate();ui={};const r0=route().p;if(!['home','camp'].includes(r0))location.hash='home';render()};
}else{
  F.onAuthStateChanged(auth,async u=>{
    if(u&&u.isAnonymous)u=null;
    user=u;role='viewer';
    if(u&&u.email){const e=u.email.toLowerCase();
      if(ADMIN_EMAILS.map(x=>x.toLowerCase()).includes(e))role='admin';
      else{try{const r=await getDoc(doc(db,'roles',e));if(r.exists()){const v=r.data().role;role=v==='admin'?'admin':v==='staff'?'staff':'viewer'}}catch(err){}}
      if(role==='viewer')toast('บัญชี '+shownId(u.email)+' ยังไม่ได้รับสิทธิ์ ให้แอดมินเพิ่มที่เมนู “เจ้าหน้าที่”',6000);
    }
    watchPrivate();heartbeat();render();
  });
}
/* เจ้าหน้าที่ที่ไม่มีอีเมล: แอดมินออก "รหัสเจ้าหน้าที่" 8 ตัวให้ ใส่รหัสอย่างเดียวก็เข้าได้
   เบื้องหลังระบบแปลงรหัสเป็นบัญชีภายใน c<แฮชของรหัส>@staff.<โดเมนโปรเจกต์> (ไม่มีกล่องจดหมายจริง และไม่เก็บรหัสไว้ที่ไหน) */
const STAFF_DOMAIN='staff.'+(firebaseConfig.authDomain||'wat.local');
const isPassAcct=e=>String(e||'').toLowerCase().endsWith('@'+STAFF_DOMAIN);
const shownId=e=>isPassAcct(e)?'บัญชีรหัสเจ้าหน้าที่':e;
const CODE_ABC='abcdefghjkmnpqrstuvwxyz23456789';
const normCode=c=>String(c||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const fmtCode=c=>c.slice(0,4)+'-'+c.slice(4);
function genCode(){const r=crypto.getRandomValues(new Uint32Array(8));return [...r].map(x=>CODE_ABC[x%CODE_ABC.length]).join('')}
async function codeEmail(code){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('wat-staff:'+code));return 'c'+[...new Uint8Array(h)].slice(0,10).map(b=>b.toString(16).padStart(2,'0')).join('')+'@'+STAFF_DOMAIN}
async function googleLogin(){const p=new F.GoogleAuthProvider();try{await F.signInWithPopup(auth,p)}catch(e){if(e.code==='auth/popup-blocked'||e.code==='auth/operation-not-supported-in-this-environment')await F.signInWithRedirect(auth,p);else if(e.code!=='auth/popup-closed-by-user')toast('เข้าสู่ระบบไม่สำเร็จ: '+e.code,5000)}}
function login(){
  if(DEMO){toast('โหมดตัวอย่าง: เลือกบทบาทจากแถบด้านบนแทน');return}
  const ov=sheet(`<div class="row"><h3>${ic('login',20)} เจ้าหน้าที่วัด เข้าสู่ระบบ</h3><span class="spacer"></span><button class="iconbtn ghost sm" data-close aria-label="ปิด">${ic('x',18)}</button></div>
  <form class="form" id="lg-pass"><label class="f">รหัสเจ้าหน้าที่ (8 ตัว)<input id="lg-c" type="password" class="codein" autocomplete="current-password" autocapitalize="none" spellcheck="false" maxlength="12" placeholder="xxxx-xxxx"></label>
  <label class="check"><input type="checkbox" id="lg-show"> แสดงรหัส</label>
  <button class="btn primary block" type="submit">${ic('key',18)} เข้าสู่ระบบ</button><p class="note" id="lg-msg">รหัสเจ้าหน้าที่ขอได้จากแอดมินของวัด</p></form>
  <div class="or"><span>หรือ</span></div>
  <button class="btn block" id="lg-google">${ic('users',18)} เข้าสู่ระบบด้วยบัญชี Google</button>`);
  const inp=ov.querySelector('#lg-c');inp.focus();
  ov.querySelector('#lg-show').onchange=e=>{inp.type=e.target.checked?'text':'password'};
  ov.querySelector('#lg-google').onclick=()=>{ov.remove();googleLogin()};
  ov.querySelector('#lg-pass').onsubmit=async e=>{e.preventDefault();const code=normCode(inp.value),msg=ov.querySelector('#lg-msg');
    if(code.length!==8){msg.textContent='รหัสเจ้าหน้าที่มี 8 ตัว (ตัวอักษรอังกฤษและตัวเลข)';msg.classList.add('bad-t');return}
    const btn=ov.querySelector('[type=submit]');btn.disabled=true;
    try{await F.signInWithEmailAndPassword(auth,await codeEmail(code),code);ov.remove();go('home')}
    catch(err){btn.disabled=false;msg.classList.add('bad-t');msg.textContent=err.code==='auth/too-many-requests'?'ลองผิดหลายครั้ง กรุณารอสักครู่แล้วลองใหม่':err.code==='auth/network-request-failed'?'เชื่อมต่ออินเทอร์เน็ตไม่ได้':err.code==='auth/operation-not-allowed'?'แอดมินยังไม่ได้เปิด Email/Password ใน Firebase':'รหัสไม่ถูกต้อง หรือถูกยกเลิกแล้ว'}};
}
/* แอดมินออกรหัส: ใช้ Firebase app ตัวที่สอง เพื่อไม่ให้แอดมินหลุดจากระบบ */
async function createCodeStaff(name,role){
  const A=await import(`https://www.gstatic.com/firebasejs/${FBV}/firebase-app.js`);
  const sec=A.initializeApp(firebaseConfig,'mk'+Date.now()),sa=F.initializeAuth(sec,{persistence:F.inMemoryPersistence});
  const code=genCode(),em=await codeEmail(code);
  try{const cr=await F.createUserWithEmailAndPassword(sa,em,code);await F.updateProfile(cr.user,{displayName:name});await F.signOut(sa)}
  finally{A.deleteApp(sec).catch(()=>{})}
  const w=writeBatch(db);w.set(doc(db,'roles',em),{role,name,kind:'code',addedAt:serverTimestamp()});
  addLog(w,'create','role',em,`ออกรหัสเจ้าหน้าที่ให้ ${name} (${role==='admin'?'แอดมิน':'เจ้าหน้าที่'})`);await w.commit();
  return code;
}
function showCreds(name,code){
  const url=location.origin+location.pathname,txt=`เข้าระบบทำบุญ ${S.temple.name||''}\nเว็บ: ${url}\nรหัสเจ้าหน้าที่ของ ${name}: ${fmtCode(code)}\n(กด “เจ้าหน้าที่วัด เข้าสู่ระบบ” แล้วใส่รหัสนี้ อย่าบอกต่อคนอื่น)`;
  const ov=sheet(`<h3>${ic('check',20)} ออกรหัสให้ ${esc(name)} แล้ว</h3>
  <div class="creds one"><div><span>รหัสเจ้าหน้าที่</span><b class="num">${esc(fmtCode(code))}</b></div></div>
  <p class="note"><b>รหัสแสดงครั้งเดียว</b> คัดลอกส่งให้เจ้าหน้าที่หรือจดไว้ก่อนปิดหน้านี้ ถ้าลืมหรือรหัสหลุด ให้กด “ยกเลิกรหัส” แล้วออกรหัสใหม่</p>
  <div class="row"><button class="btn" id="cr-copy">${ic('copy',16)} คัดลอกข้อความส่ง LINE</button><span class="spacer"></span><button class="btn primary" data-close>เสร็จแล้ว</button></div>`,'',true);
  ov.querySelector('#cr-copy').onclick=()=>copy(txt);
}
async function logout(){if(DEMO){window.__setDemo('viewer');return}try{if(user)await deleteDoc(doc(db,'presence',user.uid))}catch(e){}await F.signOut(auth);ui={};go('home')}

/* presence: each signed-in staff member writes "I'm here" every minute so others see who is entering data */
let hbTimer=null;
function heartbeat(){
  clearInterval(hbTimer);if(DEMO||!isStaff()||!user)return;
  const beat=()=>{if(document.visibilityState!=='visible')return;setDoc(doc(db,'presence',user.uid),{name:user.displayName||user.email,email:user.email,role,at:serverTimestamp()}).catch(()=>{})};
  beat();hbTimer=setInterval(beat,60000);document.addEventListener('visibilitychange',beat);
}

const logoSrc=()=>S.temple.logo||DEFAULT_LOGO;
const logoEl=(cls='')=>`<span class="logo img ${cls}"><img src="${esc(logoSrc())}" alt="ตราวัด"></span>`;
const tidx=t=>Math.max(0,S.types.indexOf(t))%7;
const gcls=t=>'g'+(tidx(t)+1);

/* ---------- pages, addressed by a plain #word so one campaign can be shared on its own ---------- */
const STAFF_PAGES=['slips','closing','search'],ADMIN_PAGES=['new','settings','accounts','staff','import','receipts','report','logs'];
function route(){
  const h=location.hash.replace('#','');
  if(h===''||h==='welcome')return{p:'welcome'};
  if(S.campaigns.some(c=>c.id===h))return{p:'camp',id:h};
  if(h.startsWith('tv-')&&S.campaigns.some(c=>c.id===h.slice(3)))return{p:'tv',id:h.slice(3)};
  if(h.startsWith('e-')&&S.campaigns.some(c=>c.id===h.slice(2)))return isAdmin()?{p:'edit',id:h.slice(2)}:{p:'camp',id:h.slice(2)};
  if(STAFF_PAGES.includes(h)&&isStaff())return{p:h};
  if(ADMIN_PAGES.includes(h)&&isAdmin())return{p:h};
  if(h&&!S.loaded.c&&!/^y\d{4}$/.test(h))return{p:'loading'};
  return{p:'home'};
}
const cur=()=>{const r=route();return r.p==='camp'?S.campaigns.find(c=>c.id===r.id):null};
const tvCamp=()=>{const r=route();return r.p==='tv'?S.campaigns.find(c=>c.id===r.id):null};
const go=h=>{if(location.hash==='#'+h)render();else location.hash=h||'home'};
const shareLink=id=>location.origin+location.pathname+'#'+id;

let yearFilter=LS.get('wat-year',null),ui={},draft=null,autoTimer=null,busy=false;
{const m=location.hash.match(/^#y(\d{4})$/);if(m)yearFilter=+m[1]}
let autoOn=LS.get('wat-auto',true);
const app=document.getElementById('app');
function toast(t,ms){const el=document.getElementById('toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,ms||2600)}
async function copy(text,input){try{await navigator.clipboard.writeText(text);toast('คัดลอกแล้ว')}catch(e){if(input){input.focus();input.select()}toast('กดค้างเพื่อคัดลอก')}}
const years=()=>[...new Set(S.campaigns.map(campYear))].sort((a,b)=>b-a);
function activeYear(){const ys=years();if(S.loaded.c&&!ys.includes(yearFilter))yearFilter=ys.includes(curBE())?curBE():(ys[0]??curBE());return yearFilter}

/* ---------- numbers that tick up when a new donation arrives ---------- */
const lastCounts=new Map();
function countUp(root){
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll('[data-count]').forEach(el=>{
    const key=el.dataset.key,to=+el.dataset.count,fmt=el.dataset.fmt,from=lastCounts.has(key)?lastCounts.get(key):to;lastCounts.set(key,to);
    const out=v=>fmt==='baht'?baht(v):fmt==='pct'?Math.round(v)+'%':num(v);
    if(from===to||reduce){el.textContent=out(to);return}
    el.textContent=out(from);el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');
    const t0=performance.now(),dur=900;const step=t=>{const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=out(from+(to-from)*e);if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step);
  });
}
const cnt=(key,val,fmt)=>`<span data-count="${val}" data-key="${key}" data-fmt="${fmt}">${fmt==='baht'?baht(val):fmt==='pct'?Math.round(val)+'%':num(val)}</span>`;

/* ---------- draft rows being typed (kept in this browser until saved) ---------- */
const blankRow=()=>({k:uid(),name:'',img:'',amount:'',note:'',receipt:false,rName:'',taxId:'',addr:'',phone:''});
const blank=n=>Array.from({length:n},blankRow);
const rowState=r=>{const n=r.name.trim()!==''||!!r.img,a=parseAmt(r.amount),raw=String(r.amount).trim()!=='';if(!n&&!raw&&!r.note.trim())return'empty';return n&&a>0?'ok':'bad'};
function loadDraft(id){const d=LS.get('wat-draft-'+id,null);draft=(d&&Array.isArray(d.rows))?d:{date:today(),rows:blank(3)};draft.rows=draft.rows.map(r=>({...blankRow(),...r}));padRows()}
function saveDraft(){const c=cur();if(c&&draft)LS.set('wat-draft-'+c.id,draft)}
function padRows(){if(!draft.rows.some(r=>rowState(r)==='empty'))draft.rows.push(...blank(2))}

/* ---------- render ---------- */
let pending=false;
function typingInForm(){const a=document.activeElement;return a&&app.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&!a.closest('#batch')}
function refresh(){
  if(document.querySelector('.sheet[data-hold]'))return;
  const r=route();
  if(r.p==='tv'&&document.getElementById('tv')){tvUpdate(tvCamp());return}
  if(r.p==='camp'&&document.getElementById('d-hero')&&document.getElementById('d-hero').dataset.id===r.id){partial();return}
  if(typingInForm()||ui.formDirty){pending=true;return}
  render(true);
}
app.addEventListener('focusout',()=>setTimeout(()=>{if(pending&&!typingInForm()&&!ui.formDirty){pending=false;render(true)}},0));
function partial(){
  const c=cur();if(!c)return render(true);
  document.getElementById('d-hero').innerHTML=heroInner(c);
  document.getElementById('d-list').innerHTML=listInner(c);
  const sd=document.getElementById('side');if(sd)sd.innerHTML=sideInner();
  const tb=document.getElementById('topbar');if(tb)tb.outerHTML=topbar();
  const bn=document.getElementById('bnav');if(bn)bn.innerHTML=bnavInner();
  bind();countUp(app);growAll(app);if(draft&&document.getElementById('bt-body'))updateBatchSum();
  freshKeys=new Set();
}
function render(keep){
  pending=false;ui.formDirty=false;
  const r=route(),c=cur();
  syncLive();
  if(r.p==='home'||r.p==='welcome')needAgg(S.campaigns.filter(x=>campYear(x)===activeYear()));
  if((r.p==='camp'||r.p==='tv')&&!S.full[r.id])needAgg([S.campaigns.find(x=>x.id===r.id)]);
  if(['report','search'].includes(r.p))loadAll(keep?0:120000);
  if(r.p==='camp'&&isStaff()&&ui.batch&&Date.now()-(LS.get('wat-names',{}).at||0)>86400000)loadAll();
  if(r.p==='slips'&&ui.slipTab==='done'&&!S.slipsDone)loadDoneSlips();
  if(c){if(!draft||draft._id!==c.id){loadDraft(c.id);draft._id=c.id}}else draft=null;
  document.body.classList.toggle('tvmode',r.p==='tv');
  if(r.p==='tv'){const tc=tvCamp();app.innerHTML=tvHTML(tc);document.body.classList.remove('has-nav');tvStart(tc);return}
  document.body.classList.toggle('welcomemode',r.p==='welcome');
  if(r.p==='welcome'){app.innerHTML=landing();document.body.classList.remove('has-nav');bind();bindLanding();if(!keep)window.scrollTo(0,0);return}
  let body;
  if(r.p==='loading')body=`<div class="loading"><div class="sk"></div><div class="sk"></div></div>`;
  else if(r.p==='camp')body=detail(c);
  else if(r.p==='new')body=page('เพิ่มงานบุญใหม่',campForm(null));
  else if(r.p==='edit')body=page('แก้ไขงานบุญ',campForm(S.campaigns.find(x=>x.id===r.id)));
  else if(r.p==='settings')body=page('ตั้งค่าวัด',settingsForm());
  else if(r.p==='accounts')body=page('บัญชีรับเงิน',accountsPage());
  else if(r.p==='staff')body=page('เจ้าหน้าที่',staffPage());
  else if(r.p==='import')body=page('นำเข้าข้อมูลจากระบบเดิม',importPage());
  else if(r.p==='slips')body=page('ตรวจสลิปโอนเงิน',slipsPage());
  else if(r.p==='receipts')body=page('คำขอใบอนุโมทนา',receiptsPage());
  else if(r.p==='report')body=page('รายงานการทำบุญ',reportPage());
  else if(r.p==='logs')body=page('ประวัติการทำรายการ',logsPage());
  else if(r.p==='closing')body=page('ปิดยอดประจำวัน',closingPage());
  else if(r.p==='search')body=page('ค้นหาผู้ทำบุญ',searchPage());
  else body=home();
  app.innerHTML=layout(body);
  document.body.classList.toggle('has-nav',navItems().length>1);
  bind();bindBatch();countUp(app);growAll(app);
  if(!keep&&!ui.keepScroll)window.scrollTo(0,0);ui.keepScroll=false;
  if(c&&ui.batch&&isStaff()){updateBatchSum();const f=app.querySelector('#bt-body [data-f="name"]');if(ui.focusFirst&&f){f.focus();ui.focusFirst=false}}
  freshKeys=new Set();
}

/* ---------- shell: sidebar (wide) / top bar + floating icon bar (phone) ---------- */
function navItems(){
  const l=[['home','home','งานบุญ',0]];
  if(isStaff())l.push(['slips','inbox','ตรวจสลิป',pendingSlips()],['closing','wallet','ปิดยอด',0]);
  if(isAdmin())l.push(['receipts','receipt','ใบอนุโมทนา',pendingReceipts()],['report','file','รายงาน PDF',0]);
  if(isStaff())l.push(['search','eye','ค้นหาผู้ทำบุญ',0]);
  if(isAdmin())l.push(['logs','calendar','ประวัติการแก้ไข',0],['new','plus','เพิ่มงานบุญ',0],['accounts','wallet','บัญชีรับเงิน',0],['staff','users','เจ้าหน้าที่',0],['settings','gear','ตั้งค่าวัด',0]);
  return l;
}
function isActive(h){const r=route().p;return h==='home'?(r==='home'||r==='camp'):h==='settings'?(r==='settings'||r==='import'):h==='new'?(r==='new'||r==='edit'):r===h}
function pageTitle(){
  const r=route(),c=cur();
  return {home:`รายการงานบุญ ประจำปี พ.ศ. ${activeYear()}`,camp:c?`รายละเอียดงานบุญ · ${c.type} · ปี พ.ศ. ${campYear(c)}`:'รายละเอียดงานบุญ',slips:'ตรวจสลิปโอนเงินจากผู้ทำบุญ',receipts:'คำขอใบอนุโมทนาบัตร',report:'รายงานการทำบุญ (PDF / Excel)',new:'เพิ่มงานบุญใหม่',edit:'แก้ไขงานบุญ',accounts:'บัญชีรับเงินของวัด',staff:'จัดการเจ้าหน้าที่',settings:'ตั้งค่าวัด',import:'นำเข้าข้อมูลจากระบบเดิม',logs:'ประวัติการเพิ่ม แก้ไข ลบ ทั้งหมด',closing:'ปิดยอดและนับเงินสดประจำวัน',search:'ค้นหาประวัติผู้ทำบุญ',loading:'กำลังโหลด…'}[r.p]||'';
}
function topbar(){
  const on=isStaff()?onlineNow():[];
  return `<header class="topbar" id="topbar"><button class="tb-brand" data-go="home" aria-label="กลับหน้ารายการงานบุญ">${logoEl()}<span class="tb-text"><b>${esc(S.temple.name||'ระบบทำบุญวัด')}</b><small>${esc(pageTitle())}</small></span></button>
  <span class="spacer"></span>
  ${on.length?`<span class="tb-online" title="เจ้าหน้าที่ที่กำลังใช้งาน"><span class="dot"></span><span class="hide-sm">ใช้งานอยู่ </span>${on.length}</span>`:''}
  ${user?`<span class="tb-user">${avatar(user.displayName||user.email)}<span class="who hide-sm"><b>${esc(user.displayName||user.email)}</b><span class="role">${isAdmin()?'แอดมิน':isStaff()?'เจ้าหน้าที่':'ยังไม่มีสิทธิ์'}</span></span></span><button class="iconbtn ghost sm" id="b-logout" aria-label="ออกจากระบบ" title="ออกจากระบบ">${ic('logout',18)}</button>`:DEMO?'':`<button class="btn sm" id="b-login">${ic('login',16)}<span class="hide-sm">เข้าสู่ระบบ</span></button>`}</header>`;
}
const brand=sub=>`<div class="brand">${logoEl()}<div style="min-width:0"><b>${esc(S.temple.name||'ระบบทำบุญวัด')}</b><small>${sub||'ระบบทำบุญออนไลน์'}</small></div></div>`;
const avatar=(name,cls='')=>`<span class="avatar ${cls||'g'+hue(name)}">${esc(initial(name))}</span>`;
function sideInner(){
  const ys=years(),y=activeYear(),r=route().p;
  const items=navItems().map(([h,i,l,b])=>`<button class="side-item" data-go="${h}" ${isActive(h)?'aria-current="page"':''}>${ic(i,20)}<span>${l}</span>${b?`<span class="badge">${b}</span>`:''}</button>`).join('');
  const yitems=ys.map(v=>`<button class="side-item yr" data-year="${v}" ${r==='home'&&v===y?'aria-current="page"':''}>${ic('calendar',18)}<span>ประจำปี ${v}</span><span class="cnt">${S.campaigns.filter(c=>campYear(c)===v).length} งาน</span></button>`).join('');
  const on=isStaff()?onlineNow():[];
  return `<div class="side-sec"><span>เมนู</span>${items}</div>
  ${ys.length?`<div class="side-sec"><span>งานบุญแยกตามปี พ.ศ.</span>${yitems}</div>`:''}
  <div class="side-foot">${on.length?`<div class="online"><span><span class="dot"></span> กำลังใช้งานอยู่ ${on.length} คน</span><span class="avs">${on.slice(0,6).map(p=>`<span title="${esc(p.name)}">${avatar(p.name)}</span>`).join('')}</span></div>`:''}</div>`;
}
function bnavInner(){
  const items=navItems();if(items.length<2)return'';
  const shown=items.length>5?items.slice(0,4):items,rest=items.length>5?items.slice(4):[];
  const restBadge=rest.reduce((a,x)=>a+x[3],0),restOn=rest.some(x=>isActive(x[0]));
  return shown.map(([h,i,l,b])=>`<button data-go="${h}" ${isActive(h)?'aria-current="page"':''}>${ic(i,22)}<span>${l}</span>${b?`<span class="badge">${b}</span>`:''}</button>`).join('')+(rest.length?`<button id="b-more" ${restOn?'aria-current="page"':''}>${ic('menu',22)}<span>เพิ่มเติม</span>${restBadge?`<span class="badge">${restBadge}</span>`:''}</button>`:'');
}
function demoBar(){
  if(!DEMO)return'';
  const b=(r,l)=>`<button class="chip" data-demo="${r}" aria-pressed="${role===r}">${l}</button>`;
  return `<div class="demo"><span>โหมดตัวอย่าง · ดูในฐานะ</span><span class="seg">${b('admin','แอดมิน')}${b('staff','เจ้าหน้าที่')}${b('viewer','ผู้ชมทั่วไป')}</span><span class="spacer"></span><button class="iconbtn ghost sm" id="b-demo-reset" aria-label="ล้างข้อมูลตัวอย่าง" title="ล้างข้อมูลตัวอย่าง">${ic('trash',16)}</button></div>`;
}
function layout(body){
  return `${topbar()}<div class="layout"><aside class="side" id="side" aria-label="เมนูหลัก">${sideInner()}</aside><main class="main">${demoBar()}${body}${footer()}</main></div><nav class="bnav" id="bnav" aria-label="เมนู" ${navItems().length<2?'hidden':''}>${bnavInner()}</nav>`;
}
function page(title,inner){return `<div class="row"><button class="btn ghost sm" data-go="home">${ic('back',18)} กลับไปรายการงานบุญ</button></div><h2 class="page-h">${title}</h2>`+inner}
function footer(){
  const t=S.temple,items=[];
  if(t.address)items.push(['pin','ที่อยู่',esc(t.address)]);
  if(t.phone)items.push(['phone','โทรศัพท์',esc(t.phone)]);
  if(t.facebook&&/^https?:\/\//.test(t.facebook))items.push(['share','Facebook',`<a href="${esc(t.facebook)}" target="_blank" rel="noopener">${esc(t.facebook.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,''))}</a>`]);
  const acts=`${!DEMO?`<button class="btn sm" data-install ${canInstall()?'':'hidden'}>${ic('download',14)} ติดตั้งแอป</button>`:''}${!user&&!DEMO?`<button class="btn sm" id="b-login2">${ic('login',14)} สำหรับเจ้าหน้าที่</button>`:''}`;
  return `<footer class="foot"><div class="foot-main">
    <div class="foot-brand">${logoEl()}<div><b>${esc(t.name||'')}</b><small>${esc(t.place||'ระบบทำบุญออนไลน์')}</small></div></div>
    ${items.length?`<ul class="foot-info">${items.map(([i,k,v])=>`<li${i==='pin'?' class="wide"':''}><span class="fi">${ic(i,15)}</span><span class="fk">${k}</span><span class="fv">${v}</span></li>`).join('')}</ul>`:isAdmin()?'<p class="foot-info note-on">ใส่ที่อยู่ เบอร์โทร และ LINE ได้ที่เมนูตั้งค่าวัด</p>':''}
  </div>
  <div class="foot-bar"><span>© ${curBE()} ${esc(t.name||'')}</span><button class="linkbtn" data-go="welcome">หน้าแรก</button><button class="linkbtn" data-privacy>ความเป็นส่วนตัว</button><span class="foot-note">${esc(t.footerNote||BLESS.footer)}</span>${acts?`<span class="row">${acts}</span>`:''}</div></footer>`;
}
function home(){
  const ys=years(),y=activeYear();
  const list=S.campaigns.filter(c=>campYear(c)===y);
  const loading=!S.loaded.c;
  return `<section class="banner"><span class="eyebrow">ขอเชิญร่วมทำบุญ ประจำปี พ.ศ. ${y}</span><h1>${esc(S.temple.name||'')}</h1>${S.temple.place?`<p>${esc(S.temple.place)}</p>`:''}
    <div class="row"><span class="glass">${ic('heart',15)} เปิดรับทำบุญ ${list.length} งาน</span>${S.updatedAt?`<span class="glass"><span class="dot" style="background:#fff;box-shadow:none"></span> อัปเดต ${S.updatedAt.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} น.</span>`:''}</div></section>`+
  (ys.length>1?`<div class="yrbar" role="group" aria-label="เลือกปี">${ys.map(v=>`<button class="chip" data-year="${v}" aria-pressed="${v===y}">พ.ศ. ${v}</button>`).join('')}</div>`:'')+
  (isAdmin()&&S.loaded.t&&S.campaigns.length&&(!S.temple.lastBackupAt||Date.now()-tsMs(S.temple.lastBackupAt)>30*86400000)?`<div class="card remind"><span>${ic('download',20)}</span><div><b>ยังไม่ได้สำรองข้อมูลเกิน 30 วัน</b><p class="note">ดาวน์โหลดไฟล์สำรองเก็บไว้ กันข้อมูลสูญหาย</p></div><button class="btn primary sm" id="b-backup">สำรองตอนนี้</button></div>`:'')+
  `<div class="sec-h"><h3>รายการงานบุญ ประจำปี พ.ศ. ${y} <span class="muted small">(${list.length} งาน)</span></h3>${isAdmin()?`<button class="btn sm" data-go="new">${ic('plus',16)} เพิ่มงานบุญ</button>`:''}</div>
  ${loading?'<div class="loading grid"><div class="sk"></div><div class="sk"></div></div>':list.length?`<div class="grid">${list.map(card).join('')}</div>`:`<div class="card empty">ยังไม่มีงานบุญในปี พ.ศ. ${y}${isAdmin()?`<div style="margin-top:12px"><button class="btn primary" data-go="new">${ic('plus',18)} เพิ่มงานบุญแรก</button></div>`:''}</div>`}`;
}
function card(c){
  const s=stats(c).total,pct=c.goal?Math.min(100,s/c.goal*100):0,t=stats(c).today,hide=c.hideAmt&&!isStaff();
  return `<article class="cc ${gcls(c.type)}"><button class="cc-hit" data-open="${c.id}" aria-label="เปิดงานบุญ ${esc(c.title)}"></button>
  <div class="cc-head"><div class="row"><span class="tagw">${esc(c.type)}</span><span class="spacer"></span><span class="tagw">${c.date?ic('calendar',13)+' '+thDate(c.date):'ปี '+campYear(c)}</span></div><h3>${esc(c.title)}</h3></div>
  <div class="cc-body">${hide?`<div class="amt"><b>${cnt('cp-'+c.id,stats(c).n,'int')}</b><span>ผู้ร่วมบุญ</span></div>`:`<div class="amt"><b>${cnt('ca-'+c.id,s,'baht')}</b>${c.goal?`<span>จากเป้า ${baht(c.goal)}</span>`:''}</div>${c.goal?`<div class="bar" aria-label="${Math.round(pct)}% ของเป้า"><i style="width:${pct}%"></i></div>`:''}`}
  <div class="meta"><span>${ic('users',15)} ${num(stats(c).n)} รายการ</span>${c.goal&&!hide?`<span>${Math.round(pct)}% ของเป้า</span>`:''}${t&&!hide?`<span class="up">${ic('up',15)} วันนี้ ${baht(t)}</span>`:''}</div></div>
  <div class="cc-actions">${isStaff()?`<button class="btn primary sm" data-record="${c.id}">${ic('plus',16)} บันทึกผู้ทำบุญ</button>`:`<button class="btn primary sm" data-give="${c.id}">${ic('qr',16)} ร่วมทำบุญ</button>`}<span class="spacer"></span><button class="iconbtn sm" data-snap="${c.id}" aria-label="บันทึกภาพยอด" title="บันทึกภาพยอด">${ic('image',17)}</button>${isAdmin()?`<button class="iconbtn sm" data-share="${c.id}" aria-label="แชร์งานนี้" title="แชร์งานนี้">${ic('share',17)}</button>`:''}</div>
  ${isAdmin()&&ui.shareFor===c.id?`<div style="padding:0 18px 16px;position:relative;z-index:2;display:grid;gap:6px">${shareBox(c.id)}</div>`:''}</article>`;
}
function shareBox(id){return `<div class="sharebox"><input id="sl-${id}" readonly value="${esc(shareLink(id))}" aria-label="ลิงก์แชร์"><button class="btn violet" data-copy="${id}">${ic('copy',16)} คัดลอก</button></div><p class="note">คนที่เปิดลิงก์นี้จะเห็นเฉพาะงานบุญนี้ ไม่ต้องเข้าสู่ระบบ</p>`}

/* ---------- campaign page ---------- */
function detail(c){
  const ppAccs=accountsFor(c).filter(a=>a.promptpay);
  return `<div class="row"><button class="btn ghost sm" data-go="home">${ic('back',18)} กลับไปรายการงานบุญ ปี พ.ศ. ${campYear(c)}</button><span class="spacer"></span>${isStaff()?`<button class="btn sm violet" data-go="tv-${c.id}" title="เปิดบนทีวีหรือโปรเจกเตอร์ในวันงาน">${ic('eye',16)} โหมดจอใหญ่</button>`:''}${isAdmin()?`<button class="iconbtn" data-share="${c.id}" aria-label="แชร์งานนี้" title="แชร์งานนี้">${ic('share',18)}</button><button class="iconbtn" data-go="e-${c.id}" aria-label="แก้ไขงานบุญ" title="แก้ไขงานบุญ">${ic('edit',18)}</button>`:''}</div>
  ${isAdmin()&&ui.shareFor===c.id?`<div class="card">${shareBox(c.id)}</div>`:''}
  <section class="chero ${gcls(c.type)}" id="d-hero" data-id="${c.id}">${heroInner(c)}</section>
  <div class="actions-main">${isStaff()&&!ui.batch?`<button class="btn primary lg" id="b-batch">${ic('plus',20)} บันทึกผู้ทำบุญ</button>`:''}<button class="btn teal lg" data-give="${c.id}">${ic('qr',20)} ร่วมทำบุญออนไลน์</button><button class="btn lg" data-snap="${c.id}">${ic('image',20)} ภาพยอด</button></div>
  <div id="d-batch">${isStaff()&&ui.batch?batchPanel():''}</div>
  ${c.desc?`<div class="card"><p class="desc">${esc(c.desc)}</p></div>`:''}
  <section id="give"><div id="slipform">${slipForm(c)}</div></section>
  <div id="d-list">${listInner(c)}</div>`;
}
function heroInner(c){
  const s=stats(c).total,hide=c.hideAmt&&!isStaff(),pend=draft&&ui.batch?pendingTotal():0;
  const pct=c.goal?Math.min(100,s/c.goal*100):0,ppct=c.goal?Math.min(100,(s+pend)/c.goal*100):0;
  const R=46,C=2*Math.PI*R;
  const ring=c.goal&&!hide?`<div class="ring" aria-label="ได้ ${Math.round(pct)}% ของเป้า"><svg width="112" height="112" viewBox="0 0 112 112"><circle class="trk" cx="56" cy="56" r="${R}" fill="none" stroke-width="10"/>${pend?`<circle class="pn" cx="56" cy="56" r="${R}" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-ppct/100)}"/>`:''}<circle class="val" cx="56" cy="56" r="${R}" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct/100)}"/></svg><div class="lbl"><b>${cnt('rp-'+c.id,pct,'pct')}</b><span>ของเป้า</span></div></div>`:'';
  const st=[];if(!hide)st.push(`<div><b>+${cnt('dt-'+c.id,stats(c).today,'baht')}</b><span>วันนี้</span></div>`);st.push(`<div><b>${cnt('dn-'+c.id,stats(c).n,'int')}</b><span>ผู้ร่วมบุญ</span></div>`);if(c.date)st.push(`<div><b>${thDate(c.date)}</b><span>วันงาน</span></div>`);
  return `<div class="row"><span class="tagw">${esc(c.type)}</span><span class="eyebrow">ปี ${campYear(c)}</span></div>
  <h2>${esc(c.title)}</h2>
  <div class="split"><div style="min-width:0">${hide?`<div class="big">${cnt('dp-'+c.id,stats(c).n,'int')}<small>ผู้ร่วมบุญ</small></div>`:`<div class="eyebrow">ยอดทำบุญงานนี้</div><div class="big">${cnt('da-'+c.id,s,'baht')}</div>${c.goal?`<div class="eyebrow">เป้าหมาย ${baht(c.goal)}</div>`:''}`}
  ${pend?`<span class="pend">+${baht(pend)} กำลังกรอก → ${baht(s+pend)}</span>`:''}</div>${ring}</div>
  <div class="stats" style="--n:${st.length}">${st.join('')}</div>`;
}
function listInner(c){
  const showAmt=!c.hideAmt||isStaff(),showR=isStaff(),st=stats(c);
  const shown=c.donors.filter(d=>!ui.onlyR||d.wantReceipt).sort((x,y)=>(y.date||'').localeCompare(x.date||'')||tsMs(y.createdAt)-tsMs(x.createdAt));
  const rCount=c.donors.filter(d=>d.wantReceipt).length;
  const rcell=d=>!showR||!d.wantReceipt?'':`<span class="pill ${d.receiptSent?'ok':'wait'}">${ic(d.receiptSent?'check':'receipt',12)} ${d.receiptSent?'ออกใบแล้ว':'ขอใบอนุโมทนา'}</span>`;
  return `<div class="sec-h"><h3>รายนามผู้ร่วมอนุโมทนาบุญ</h3><div class="row">${showR&&rCount?`<button class="chip" id="b-onlyr" aria-pressed="${!!ui.onlyR}">${ic('receipt',15)} ขอใบ ${rCount}</button>`:''}${isAdmin()&&stats(c).n?`<button class="btn sm" data-report="${c.id}">${ic('file',15)} PDF</button>`:`<span class="muted small">${num(shown.length)} รายการ</span>`}</div></div>
  <div class="dl">${shown.length?shown.map(d=>`<div class="dr${freshKeys.has(d.k)?' dr-new':''}">${avatar(d.name||'?',gcls(c.type))}
   <div class="dr-main">${d.nameImg?`<img class="hw" src="${esc(d.nameImg)}" alt="ลายมือชื่อ ${esc(d.name)}">`:`<span class="dr-name">${esc(d.name)}</span>`}<span class="dr-sub"><span>${thDate(d.date)}</span>${showR?payPill(d.method):''}${d.source==='slip'?'<span class="pill info">ผ่านสลิป</span>':''}${d.editedAt&&showR?'<span class="pill wait">แก้ไขแล้ว</span>':''}${d.note?`<span>${esc(d.note)}</span>`:''}</span></div>
   <div class="dr-amt">${showAmt?`<span>${baht(d.amount)}</span>`:''}${rcell(d)}</div>${isStaff()?`<button class="iconbtn ghost sm" data-dmenu="${d.k}" aria-label="ตัวเลือกของ ${esc(d.name)}">${ic('menu',18)}</button>`:'<span></span>'}</div>`).join('')
   :`<div class="empty">${c.ready?'ยังไม่มีผู้ร่วมบุญ ขอเชิญเป็นท่านแรก':'กำลังโหลด…'}</div>`}
  ${!c.full&&c.ready&&st.n>c.donors.length?`<div class="dl-more"><button class="btn" id="b-more">${ic('users',16)} ดูรายนามเพิ่ม (แสดง ${num(c.donors.length)} จาก ${num(st.n)})</button></div>`:''}
  ${shown.length&&showAmt?`<div class="dl-foot"><span>รวม ${num(c.full||ui.onlyR?shown.length:st.n)} รายการ</span><span>${baht(c.full||ui.onlyR?sum(c,shown):st.total)}</span></div>`:''}</div>`;
}

/* ---------- public: send a transfer slip ---------- */
function slipForm(c){
  if(ui.slipDone)return `<div class="card tint2" style="text-align:center"><h3>${ic('check',22)} ส่งสลิปเรียบร้อย</h3><p class="bless">${esc(bless('thanks'))}</p><p class="note">เจ้าหน้าที่จะตรวจสอบสลิป แล้วรายชื่อของท่านจะขึ้นในรายนามผู้ร่วมบุญ${ui.slipDone==='r'?' ส่วนคำขอใบอนุโมทนาส่งถึงแอดมินของวัดแล้ว':''}</p><div><button class="btn" id="slip-again">ส่งสลิปอีกใบ</button></div></div>`;
  const accs=accountsFor(c),pp=accs.filter(a=>a.promptpay),banks=accs.filter(a=>a.no);
  return `<form class="card form giveflow" id="f-slip" data-c="${c.id}" novalidate>
  <div class="gf-head"><h3>${ic('heart',20)} ร่วมทำบุญออนไลน์</h3><p class="note">ทำตาม 3 ขั้นตอน โอนแล้ว<b>ต้องแนบสลิปในขั้นตอนที่ 3 ทันที</b> ระบบจึงจะลงรายนามให้</p></div>
  <ol class="gsteps">
   <li><span class="gnum">1</span><div class="gbody"><h4>ชื่อและจำนวนเงิน</h4>
     <label class="f"><span id="sl-nlbl">${ui.giveAnon?'ชื่อของท่าน (ไม่บังคับ · ไม่แสดงในรายนาม เห็นเฉพาะเจ้าหน้าที่)':'ชื่อผู้ทำบุญ (แสดงในรายนาม)'}</span><textarea id="sl-name" class="autogrow nm" rows="1" maxlength="200" placeholder="เช่น คุณสมศรี ใจดี พร้อมครอบครัว และญาติมิตร" spellcheck="false">${esc(ui.giveName||'')}</textarea><small class="cnt" id="sl-ncnt"></small></label>
     <label class="check anon"><input type="checkbox" id="sl-anon" ${ui.giveAnon?'checked':''}> ไม่ประสงค์ออกนาม <small>รายนามจะแสดงว่า “${ANON}”</small></label>
     <label class="f" style="max-width:260px">จำนวนเงิน (บาท)<input id="sl-amt" required inputmode="decimal" placeholder="เช่น 100" value="${esc(ui.qrAmt||'')}"></label>
     <p class="pdpa">${ic('eye',14)} ชื่อและยอดเงินที่ส่งจะ<b>แสดงต่อสาธารณะ</b>ในรายนามผู้ร่วมบุญของงานนี้ หากไม่ต้องการ ติ๊ก “ไม่ประสงค์ออกนาม” · <button type="button" class="linkbtn" data-privacy>นโยบายความเป็นส่วนตัว</button></p></div></li>
   <li><span class="gnum">2</span><div class="gbody"><h4>โอนเงิน</h4>
     <div class="paybox">${pp.length?`<div id="qrarea">${qrArea(pp)}</div>`:''}
     ${banks.length?`<div class="banklist">${pp.length?'<span class="note">หรือโอนเข้าบัญชี</span>':''}${banks.map(a=>`<div class="brow"><span class="bico">${ic('wallet',18)}</span><div class="btxt"><small>${esc(a.bank||acctTitle(a))}</small><b>${esc(a.no)}</b><small>${esc(a.name||'')}</small></div><button type="button" class="btn sm" data-copytext="${esc(a.no.replace(/[^\d]/g,''))}" aria-label="คัดลอกเลขบัญชี">${ic('copy',15)}<span class="hide-sm">คัดลอก</span></button></div>`).join('')}</div>`:''}
     ${!pp.length&&!banks.length?'<p class="note">วัดยังไม่ได้ตั้งบัญชีรับเงิน</p>':''}</div></div></li>
   <li><span class="gnum">3</span><div class="gbody"><h4>แนบสลิป <span class="pill bad">บังคับ</span></h4>
     <label class="drop" id="sl-drop"><input id="sl-img" type="file" accept="image/*" required><span class="drop-in" id="sl-prev">${ic('upload',26)}<b>แตะเพื่อเลือกรูปสลิป</b><small>ถ่ายภาพหรือเลือกจากแกลเลอรี</small></span></label>
     <div class="grid2"><label class="f">วันที่โอน<input id="sl-date" type="date" value="${today()}"></label>
     <label class="f">หมายเหตุ (ถ้ามี)<input id="sl-note" maxlength="300" placeholder="เช่น อุทิศให้…"></label></div>
     <label class="switch"><input type="checkbox" id="sl-want"> ต้องการใบอนุโมทนาบัตร (ลดหย่อนภาษี)</label>
     <div id="sl-rc" hidden>${receiptFields('sl')}<label class="check" style="margin-top:8px"><input type="checkbox" id="sl-consent"> ยินยอมให้วัดใช้ข้อมูลนี้เพื่อออกใบอนุโมทนาและแจ้งกรมสรรพากรเท่านั้น ข้อมูลนี้ไม่แสดงต่อสาธารณะ</label></div></div></li>
  </ol>
  <label class="hp" aria-hidden="true">เว็บไซต์<input id="sl-web" tabindex="-1" autocomplete="off"></label>
  <div class="gf-foot"><span class="note" id="sl-hint">กรอกชื่อ จำนวนเงิน และแนบสลิปให้ครบ</span><button class="btn teal lg" type="submit" id="sl-submit" disabled>${ic('check',18)} ส่งข้อมูลทำบุญ</button></div></form>`;
}
function qrArea(pp){
  const sel=pp.find(a=>a.id===ui.qrAcct)||pp[0];
  return `${pp.length>1?`<div class="seg">${pp.map(a=>`<button type="button" class="chip" data-qracct="${a.id}" aria-pressed="${a.id===sel.id}">${esc(acctTitle(a))}</button>`).join('')}</div>`:''}
  <div class="qrwrap"><div class="qrhead">${ic('qr',16)} สแกนจ่ายพร้อมเพย์</div><canvas id="qr" width="264" height="264" aria-label="คิวอาร์โค้ดพร้อมเพย์"></canvas><div class="qa">${esc(sel.name||acctTitle(sel))}<br>${esc(sel.promptpay)}</div></div>`;
}
function receiptFields(p,v={}){
  return `<div class="bt-rc"><span class="lbl">${ic('receipt',15)} ข้อมูลสำหรับออกใบอนุโมทนา (ส่งถึงแอดมินของวัดเท่านั้น)</span>
  <label class="f">ชื่อในใบอนุโมทนา<input data-f="rName" id="${p}-rname" value="${esc(v.rName||'')}" placeholder="ชื่อ-นามสกุล หรือชื่อบริษัท"></label>
  <label class="f">เลขประจำตัวผู้เสียภาษี / เลขบัตรประชาชน<input data-f="taxId" id="${p}-tax" inputmode="numeric" maxlength="17" value="${esc(v.taxId||'')}" placeholder="13 หลัก"></label>
  <label class="f full">ที่อยู่<input data-f="addr" id="${p}-addr" value="${esc(v.addr||'')}"></label>
  <label class="f">เบอร์โทร<input data-f="phone" id="${p}-phone" inputmode="tel" value="${esc(v.phone||'')}"></label>
  <label class="f">หมายเหตุถึงแอดมิน<input data-f="rNote" id="${p}-rnote" value="${esc(v.rNote||'')}" placeholder="เช่น ขอในนามบริษัท"></label></div>`;
}
const taxOk=s=>{const d=String(s||'').replace(/\D/g,'');if(d.length!==13)return false;let t=0;for(let i=0;i<12;i++)t+=+d[i]*(13-i);return (11-t%11)%10===+d[12]};

/* ---------- staff: batch entry ---------- */
function batchPanel(){
  return `<section class="batch" id="batch" aria-label="บันทึกผู้ทำบุญหลายคน"><div class="batch-h"><h3>บันทึกผู้ทำบุญ</h3><button type="button" class="iconbtn ghost" id="bt-close" aria-label="ปิด">${ic('x',20)}</button></div>
  <div class="opts"><label class="f">วันที่ทำบุญ (ใช้กับทุกแถว)<input type="date" id="bt-date" value="${esc(draft.date)}"></label>
  <label class="switch"><input type="checkbox" id="bt-auto" ${autoOn?'checked':''}> บันทึกอัตโนมัติเมื่อหยุดพิมพ์ 3 วินาที</label></div>
  <div class="row"><span class="note" style="font-weight:700">รับเงินแบบ</span><span class="seg">${Object.entries(PAY).map(([k,v])=>`<button type="button" class="chip" data-paym="${k}" aria-pressed="${(draft.method||'cash')===k}">${v}</button>`).join('')}</span><span class="note">ใช้กับแถวที่บันทึกรอบนี้ แก้ทีละรายการได้ภายหลัง</span></div>
  <div class="bt-head"><span>#</span><span>ชื่อผู้ทำบุญ (พิมพ์ หรือกด ${'✎'} เขียนด้วยปากกา)</span><span style="text-align:right">จำนวนเงิน</span><span>ใบอนุโมทนา</span><span>หมายเหตุ</span><span></span></div>
  <div id="bt-body">${draft.rows.map(rowHTML).join('')}</div>
  <div class="row"><button type="button" class="btn sm" id="bt-add">${ic('plus',15)} เพิ่ม 5 แถว</button><button type="button" class="btn ghost sm" id="bt-clear">ล้างตาราง</button><span class="note">Enter = ไปแถวถัดไป · วางรายชื่อจาก Excel/LINE ที่ช่องชื่อได้ทีเดียว · หลายเครื่องบันทึกพร้อมกันได้</span></div>
  <div class="bt-foot"><span id="bt-sum"></span><button type="button" class="btn primary" id="bt-save">${ic('check',18)} บันทึกทั้งหมด</button></div></section>`;
}
function rowHTML(r,i){
  const name=r.img?`<span class="hwbox"><img src="${esc(r.img)}" alt="ลายมือชื่อ แถว ${i+1}" data-pen="${r.k}"><button type="button" class="iconbtn ghost sm" data-unimg="${r.k}" aria-label="ลบลายมือ">${ic('x',14)}</button></span>`
    :`<textarea data-f="name" class="autogrow nm" rows="1" maxlength="200" placeholder="ชื่อผู้ทำบุญ" aria-label="ชื่อ แถว ${i+1}" autocomplete="off" spellcheck="false">${esc(r.name)}</textarea>`;
  return `<div class="bt-row st-${rowState(r)}" data-k="${r.k}"><div class="bt-main"><span class="n">${i+1}</span><span class="c-name namebox">${name}<button type="button" class="penbtn" data-pen="${r.k}" aria-label="เขียนชื่อด้วยปากกา แถว ${i+1}" title="เขียนด้วยปากกา">${ic('pen',18)}</button></span><span class="c-amt"><input data-f="amount" inputmode="decimal" value="${esc(r.amount)}" placeholder="บาท" aria-label="จำนวนเงิน แถว ${i+1}" autocomplete="off"></span><span class="c-rc"><label class="tgl"><input type="checkbox" data-f="receipt" ${r.receipt?'checked':''}><span class="box">${ic('check',12)}</span>ใบอนุโมทนา</label></span><span class="c-note"><input data-f="note" value="${esc(r.note)}" placeholder="หมายเหตุ (ถ้ามี)" aria-label="หมายเหตุ แถว ${i+1}" autocomplete="off"></span><span class="c-x"><button type="button" class="iconbtn ghost sm" data-rm="${r.k}" aria-label="ลบแถว ${i+1}">${ic('x',16)}</button></span></div>${r.receipt?receiptFields('r'+r.k,r):''}</div>`;
}
const pendingTotal=()=>draft?draft.rows.filter(r=>rowState(r)==='ok').reduce((a,r)=>a+parseAmt(r.amount),0):0;
function redrawRows(){const b=document.getElementById('bt-body');b.innerHTML=draft.rows.map(rowHTML).join('');growAll(b);updateBatchSum()}
let heroTimer=null;
function updateBatchSum(){
  const el=document.getElementById('bt-sum');if(!el||!draft)return;
  const ok=draft.rows.filter(r=>rowState(r)==='ok'),bad=draft.rows.filter(r=>rowState(r)==='bad').length,tot=ok.reduce((a,r)=>a+parseAmt(r.amount),0),rc=ok.filter(r=>r.receipt).length;
  el.innerHTML=`<b>${ok.length}</b> คน · <b>${baht(tot)}</b>${rc?` · ขอใบ ${rc}`:''}${bad?` <span class="autostate">· ${bad} แถวไม่ครบ</span>`:''}${autoOn&&ok.length?' <span class="autostate">· รอบันทึกอัตโนมัติ</span>':''}`;
  document.getElementById('bt-save').disabled=!ok.length||busy;
  clearTimeout(heroTimer);heroTimer=setTimeout(()=>{const c=cur(),h=document.getElementById('d-hero');if(c&&h){h.innerHTML=heroInner(c);countUp(h)}},150);
}
function scheduleAuto(){clearTimeout(autoTimer);if(!autoOn)return;autoTimer=setTimeout(()=>saveBatch(true),3000)}

/* ---------- staff: check slips ---------- */
function slipsPage(){
  const tab=ui.slipTab||'pending',list=tab==='pending'?S.slips:Array.isArray(S.slipsDone)?S.slipsDone:[];
  const camp=id=>S.campaigns.find(c=>c.id===id);
  return `<p class="note">สลิปที่ผู้ทำบุญส่งเข้ามาผ่านหน้าเว็บ ตรวจยอดกับบัญชีวัดแล้วกด “ยืนยัน” รายชื่อจะขึ้นในรายนามทันที</p>
  <div class="seg"><button class="chip" data-slipTab="pending" aria-pressed="${tab==='pending'}">รอตรวจ ${pendingSlips()}</button><button class="chip" data-slipTab="done" aria-pressed="${tab!=='pending'}">ตรวจแล้ว (ล่าสุด 20)</button></div>
  ${tab!=='pending'&&!Array.isArray(S.slipsDone)?'<div class="loading"><div class="sk"></div></div>':''}
  <div class="list">${list.length?list.map(s=>{const c=camp(s.campaignId);return `<article class="card"><div class="slip"><button type="button" data-zoom="${s.id}" aria-label="ดูสลิปขนาดใหญ่">${s.img?`<img src="${esc(s.img)}" alt="สลิปของ ${esc(s.name)}">`:''}</button>
   <div style="display:grid;gap:10px;min-width:0"><div class="row"><b style="font-size:1.08rem">${esc(s.anon&&s.realName?s.realName:s.name)}</b>${s.status==='pending'?dupInfo(s):''}${s.anon?'<span class="pill info">ไม่ประสงค์ออกนาม</span>':''}${s.wantReceipt?'<span class="pill info">ขอใบอนุโมทนา</span>':''}${s.status==='approved'?'<span class="pill ok">ยืนยันแล้ว</span>':s.status==='rejected'?'<span class="pill bad">ไม่ผ่าน</span>':''}</div>
   <dl class="kv"><dt>งานบุญ</dt><dd>${esc(c?c.title:'(งานถูกลบ)')}</dd><dt>วันที่โอน</dt><dd>${thDateLong(s.date)}</dd>${s.note?`<dt>หมายเหตุ</dt><dd>${esc(s.note)}</dd>`:''}</dl>
   ${s.status==='pending'?`<div class="row"><label class="f" style="max-width:170px">ยอดที่ตรวจแล้ว (บาท)<input id="sa-${s.id}" inputmode="decimal" value="${esc(s.amount)}"></label></div>
   <div class="row"><button class="btn ok solid" data-approve="${s.id}" ${c?'':'disabled'}>${ic('check',17)} ยืนยัน ลงรายนาม</button><button class="btn danger" data-reject="${s.id}">ไม่ผ่าน</button></div>`:`<p class="note">ยอด ${baht(s.amount)}</p>${isAdmin()?`<div><button class="btn ghost sm danger" data-slipdel="${s.id}">${ic('trash',15)} ลบสลิปนี้</button></div>`:''}`}</div></div></article>`}).join(''):`<div class="card empty">${tab==='pending'?'ไม่มีสลิปรอตรวจ':'ยังไม่มีสลิปที่ตรวจแล้ว'}</div>`}</div>`;
}

/* ---------- admin: receipt requests ---------- */
function receiptsPage(){
  const tab=ui.rTab||'pending',list=S.receipts.filter(r=>tab==='pending'?r.status!=='issued':r.status==='issued');
  const camp=id=>S.campaigns.find(c=>c.id===id);
  const text=r=>[`ชื่อในใบ: ${r.receiptName||r.donorName}`,`เลขประจำตัวผู้เสียภาษี: ${r.taxId||'-'}`,`ที่อยู่: ${r.address||'-'}`,`โทร: ${r.phone||'-'}`,`จำนวนเงิน: ${num(r.amount)} บาท`,`วันที่: ${beDate(r.date)}`,`งานบุญ: ${camp(r.campaignId)?.title||''}`,r.note?`หมายเหตุ: ${r.note}`:''].filter(Boolean).join('\n');
  return `<p class="note">คำขอจากเจ้าหน้าที่และจากผู้ทำบุญที่ส่งสลิป ใช้ข้อมูลนี้ออกใบในระบบ e-Donation ของกรมสรรพากร แล้วใส่เลขอ้างอิงเพื่อปิดคำขอ ข้อมูลส่วนนี้เห็นเฉพาะแอดมิน</p>
  <div class="row"><div class="seg"><button class="chip" data-rtab="pending" aria-pressed="${tab==='pending'}">รอออกใบ ${pendingReceipts()}</button><button class="chip" data-rtab="issued" aria-pressed="${tab==='issued'}">ออกแล้ว</button></div><span class="spacer"></span>${list.length?`<button class="btn sm" id="b-rcsv">${ic('download',15)} Excel</button>`:''}</div>
  <div class="list">${list.length?list.map(r=>`<article class="card"><div class="row"><b style="font-size:1.08rem">${esc(r.receiptName||r.donorName)}</b>${taxOk(r.taxId)?'':'<span class="pill wait">ตรวจเลข 13 หลักอีกครั้ง</span>'}<span class="spacer"></span><b class="num">${baht(r.amount)}</b></div>
   <dl class="kv"><dt>ผู้ทำบุญ</dt><dd>${esc(r.donorName)}</dd><dt>เลขผู้เสียภาษี</dt><dd class="num">${esc(r.taxId||'-')}</dd><dt>ที่อยู่</dt><dd>${esc(r.address||'-')}</dd><dt>โทร</dt><dd>${esc(r.phone||'-')}</dd><dt>งานบุญ</dt><dd>${esc(camp(r.campaignId)?.title||'-')}</dd><dt>วันที่</dt><dd>${thDateLong(r.date)}</dd>${r.note?`<dt>หมายเหตุ</dt><dd>${esc(r.note)}</dd>`:''}${r.status==='issued'?`<dt>เลขอ้างอิง</dt><dd>${esc(r.ref||'-')}</dd>`:''}</dl>
   <div class="row"><button class="btn sm" data-copytext="${esc(text(r))}">${ic('copy',15)} คัดลอกข้อมูล</button><span class="spacer"></span>${r.status==='issued'?`<button class="btn ghost sm" data-unissue="${r.id}">เปลี่ยนเป็นรอออก</button>`:`<input id="ref-${r.id}" placeholder="เลขอ้างอิง e-Donation" style="max-width:220px"><button class="btn ok solid sm" data-issue="${r.id}">${ic('check',15)} ออกใบแล้ว</button>`}</div></article>`).join(''):`<div class="card empty">${tab==='pending'?'ไม่มีคำขอรอออกใบ':'ยังไม่มีรายการที่ออกแล้ว'}</div>`}</div>`;
}

/* ---------- admin: reports ---------- */
function reportPage(){
  if(!S.allDon)return `<div class="card empty">กำลังโหลดข้อมูลทั้งหมดสำหรับรายงาน…</div><div class="loading"><div class="sk"></div></div>`;
  const v=ui.rep||(ui.rep={mode:'year',year:activeYear(),month:today().slice(0,7),day:today(),camp:'all'});
  if(!v.year&&S.loaded.c)v.year=activeYear();
  const ys=[...new Set([...years(),...S.donations.map(donorYear).filter(Boolean)])].sort((a,b)=>b-a);
  const rows=reportRows(v),tot=rows.reduce((a,x)=>a+x.d.amount,0);
  const mb=(m,l)=>`<button class="chip" data-repmode="${m}" aria-pressed="${v.mode===m}">${l}</button>`;
  return `<section class="card form"><h3>${ic('file',20)} เลือกช่วงเวลา</h3>
  <div class="seg">${mb('day','รายวัน')}${mb('month','รายเดือน')}${mb('year','รายปี')}${mb('all','ทั้งหมด')}</div>
  <div class="grid2">${v.mode==='day'?`<label class="f">วันที่<input type="date" id="rp-day" value="${esc(v.day)}"></label>`:v.mode==='month'?`<label class="f">เดือน<input type="month" id="rp-month" value="${esc(v.month)}"></label>`:v.mode==='year'?`<label class="f">ปี พ.ศ.<select id="rp-year">${ys.map(y=>`<option ${y===+v.year?'selected':''}>${y}</option>`).join('')}</select></label>`:'<div></div>'}
  <label class="f">งานบุญ<select id="rp-camp"><option value="all">ทุกงานบุญ</option>${S.campaigns.map(c=>`<option value="${c.id}" ${v.camp===c.id?'selected':''}>${esc(c.title)} (ปี ${campYear(c)})</option>`).join('')}</select></label></div>
  <div class="preview"><div><b>${num(rows.length)}</b><span>รายการ</span></div><div><b>${baht(tot)}</b><span>ยอดในรายงาน</span></div><div><b>${rows.filter(x=>x.d.wantReceipt).length}</b><span>ขอใบอนุโมทนา</span></div></div>
  <div class="row"><button class="btn primary lg" id="rp-pdf" ${rows.length?'':'disabled'}>${ic('download',18)} ดาวน์โหลด PDF</button><button class="btn lg" id="rp-csv" ${rows.length?'':'disabled'}>${ic('download',18)} Excel</button><button class="btn violet lg" id="rp-cert" ${rows.length?'':'disabled'}>${ic('heart',18)} พิมพ์ใบอนุโมทนาบัตรทุกรายการ</button></div>
  <p class="note">ช่วงเวลานับตามวันที่ทำบุญของแต่ละรายการ ยอดรวมในรายงานเป็นข้อมูลสำหรับแอดมิน ไม่แสดงบนหน้าเว็บ</p></section>`;
}
function reportRows(v){
  const ok=d=>v.mode==='all'||(v.mode==='day'&&d.date===v.day)||(v.mode==='month'&&(d.date||'').slice(0,7)===v.month)||(v.mode==='year'&&donorYear(d)===+v.year);
  const out=[];S.campaigns.filter(c=>v.camp==='all'||c.id===v.camp).forEach(c=>c.donors.forEach(d=>{if(ok(d))out.push({c,d})}));
  return out.sort((a,b)=>(a.d.date||'').localeCompare(b.d.date||'')||tsMs(a.d.createdAt)-tsMs(b.d.createdAt));
}
function reportTitle(v){
  const p=v.mode==='day'?'วันที่ '+thDateLong(v.day):v.mode==='month'?'เดือน'+new Date(v.month+'-01T00:00:00').toLocaleDateString('th-TH',{month:'long',year:'numeric'}):v.mode==='year'?'ปี พ.ศ. '+v.year:'ทั้งหมด';
  const c=v.camp==='all'?'ทุกงานบุญ':(S.campaigns.find(x=>x.id===v.camp)?.title||'');
  return {p,c};
}

/* ---------- admin pages ---------- */
function campForm(c){
  const v=c||{type:S.types[0],title:'',desc:'',goal:0,date:'',year:curBE(),hideAmt:false,acctIds:[]};
  const def=defaultAcct();
  return `<form class="card form" id="f-camp" data-id="${c?c.id:''}">
  <div class="grid2"><label class="f">ประเภท<select id="c-type">${S.types.map(t=>`<option ${t===v.type?'selected':''}>${esc(t)}</option>`).join('')}</select></label>
  <label class="f">หรือพิมพ์ประเภทใหม่<input id="c-newtype" placeholder="เช่น บวชเณรภาคฤดูร้อน"></label></div>
  <label class="f">ชื่องานบุญ<input id="c-title" required maxlength="200" value="${esc(v.title)}"></label>
  <label class="f">รายละเอียด<textarea id="c-desc" maxlength="3000">${esc(v.desc)}</textarea></label>
  <div class="grid2"><label class="f">ปี พ.ศ.<input id="c-year" type="number" min="2500" max="2700" required value="${esc(c?campYear(c):v.year)}"></label>
  <label class="f">วันงาน (ถ้ามี)<input id="c-date" type="date" value="${esc(v.date)}"></label></div>
  <div style="display:grid;gap:8px"><label class="switch"><input type="checkbox" id="c-hasgoal" ${v.goal?'checked':''}> ตั้งยอดเป้าหมาย</label><label class="f" id="c-goal-wrap" ${v.goal?'':'hidden'}>ยอดเป้าหมาย (บาท)<input id="c-goal" type="number" min="1" value="${esc(v.goal||'')}"></label></div>
  <fieldset><legend>บัญชีรับเงินของงานนี้ (เลือกได้มากกว่า 1)</legend>
  ${S.accounts.map(a=>`<label class="check"><input type="checkbox" name="c-acct" value="${a.id}" ${(v.acctIds||[]).includes(a.id)?'checked':''}> <span><b>${esc(acctTitle(a))}</b> <span class="note">${esc(a.bank)} ${esc(a.no||'')}${a.promptpay?' · พร้อมเพย์ '+esc(a.promptpay):''}</span></span></label>`).join('')}
  <p class="note">${S.accounts.length?`ถ้าไม่เลือก จะใช้บัญชีหลัก${def?` (${esc(acctTitle(def))})`:''}`:'ยังไม่มีบัญชี เพิ่มได้ที่เมนู “บัญชี”'}</p></fieldset>
  <label class="switch"><input type="checkbox" id="c-hide" ${v.hideAmt?'checked':''}> ซ่อนจำนวนเงินในหน้าที่แชร์ (แสดงเฉพาะจำนวนผู้ร่วมบุญ)</label>
  <div class="row"><button class="btn primary" type="submit">${ic('check',18)} บันทึก</button><button class="btn" type="button" data-go="${c?c.id:'home'}">ยกเลิก</button></div>
  ${c?`<div class="danger-zone">${ui.confirmDel?`<span class="note">ลบ “${esc(c.title)}” และรายชื่อผู้ทำบุญทั้งหมด ${num(stats(c).n)} รายการ? ลบแล้วกู้คืนไม่ได้</span><div class="row"><button type="button" class="btn danger solid" id="b-del-yes">ยืนยันลบ</button><button type="button" class="btn" id="b-del-no">ยกเลิก</button></div>`:`<div><button type="button" class="btn danger" id="b-del">${ic('trash',16)} ลบงานบุญนี้</button></div>`}</div>`:''}
  </form>`;
}
function settingsForm(){
  const t=S.temple;
  return `<form class="card form" id="f-set"><h3>ส่วนหัวของเว็บ</h3>
  <div class="logo-set"><span class="logo img lg"><img src="${esc(logoSrc())}" alt="ตราวัด"></span><div style="display:grid;gap:6px"><label class="f">ตราวัด (รูปสี่เหลี่ยมจัตุรัส จะถูกตัดเป็นวงกลม)<input type="file" id="s-logo" accept="image/*"></label>${S.temple.logo?'<div><button type="button" class="btn ghost sm" id="s-logo-reset">ใช้ตราเริ่มต้น</button></div>':''}</div></div>
  <div class="grid2"><label class="f">ชื่อวัด<input id="s-name" value="${esc(t.name)}"></label>
  <label class="f">คำโปรย / ที่ตั้งโดยย่อ<input id="s-place" value="${esc(t.place)}" placeholder="เช่น ต.บางปูน อ.เมือง จ.สิงห์บุรี"></label></div>
  <h3>ส่วนท้ายของเว็บ (ข้อมูลติดต่อ)</h3>
  <label class="f">ที่อยู่วัด<input id="s-address" value="${esc(t.address)}"></label>
  <div class="grid3"><label class="f">โทรศัพท์<input id="s-phone" value="${esc(t.phone)}" inputmode="tel"></label>
  <label class="f">ลิงก์ Facebook<input id="s-fb" value="${esc(t.facebook)}" placeholder="https://facebook.com/..."></label></div>
  <label class="f">ข้อความท้ายเว็บ<input id="s-footnote" value="${esc(t.footerNote)}" placeholder="${esc(BLESS.footer)}"></label>
  <h3>ใบอนุโมทนาบัตร (ที่ระลึก)</h3>
  <div class="grid2"><label class="f">ชื่อผู้ลงนาม<input id="s-signer" value="${esc(t.signer)}" placeholder="เช่น พระครูสุนทรธรรมโชติ"></label><label class="f">ตำแหน่ง<input id="s-signertitle" value="${esc(t.signerTitle)}" placeholder="เช่น เจ้าอาวาสวัด…"></label></div>
  <h3>คำอวยพร</h3>
  <p class="note">เว้นว่างไว้ = ใช้คำอวยพรแบบโบราณที่ตั้งไว้ให้</p>
  <label class="f">หน้าแรก (ใต้ชื่อวัด)<input id="s-bw" value="${esc(t.b_welcome)}" placeholder="${esc(BLESS.welcome)}"></label>
  <label class="f">หลังส่งสลิป<textarea id="s-bt" rows="2" placeholder="${esc(BLESS.thanks)}">${esc(t.b_thanks)}</textarea></label>
  <label class="f">ใบอนุโมทนาบัตร<textarea id="s-bc" rows="3" placeholder="${esc(BLESS.cert)}">${esc(t.b_cert)}</textarea></label>
  <label class="f">โหมดจอใหญ่ (ตอนมีคนทำบุญ)<input id="s-btv" value="${esc(t.b_tv)}" placeholder="${esc(BLESS.tv)}"></label>
  <h3>ประเภทงานบุญ</h3>
  <label class="f">บรรทัดละ 1 ประเภท (แต่ละประเภทได้สีของตัวเองตามลำดับ)<textarea id="s-types">${esc(S.types.join('\n'))}</textarea></label>
  <div class="row"><button class="btn primary" type="submit">${ic('check',18)} บันทึก</button></div></form>
  <section class="card"><h3>${ic('download',20)} สำรองข้อมูล</h3><p class="note">ดาวน์โหลดข้อมูลทั้งหมด (งานบุญ รายชื่อ บัญชี ใบอนุโมทนา ประวัติ) เป็นไฟล์เดียว ควรทำทุกเดือน แล้วเก็บไว้ใน Google Drive หรือแฟลชไดรฟ์ ${S.temple.lastBackupAt?`· สำรองล่าสุด ${new Date(tsMs(S.temple.lastBackupAt)).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})}`:'· ยังไม่เคยสำรอง'}</p>
  <label class="switch"><input type="checkbox" id="bk-img"> รวมรูปสลิปด้วย (ไฟล์จะใหญ่ขึ้น)</label><div class="row"><button class="btn primary" id="b-backup">${ic('download',17)} ดาวน์โหลดไฟล์สำรอง</button><button class="btn" data-go="import">กู้ข้อมูลจากไฟล์สำรอง</button></div></section>
  <section class="card"><h3>ย้ายข้อมูลจากระบบเดิม</h3><p class="note">นำงานบุญ บัญชี และรายชื่อผู้ทำบุญจากไฟล์ที่ส่งออกจากระบบเดิม (Claude) เข้ามาในระบบนี้</p><div><button class="btn" data-go="import">ไปหน้านำเข้าข้อมูล</button></div></section>`;
}
function accountsPage(){
  const used=id=>S.campaigns.filter(c=>(c.acctIds||[]).includes(id)).length;
  const form=a=>`<form class="card form acct-form" data-id="${a?a.id:''}">${a?'':'<h3>เพิ่มบัญชีใหม่</h3>'}
    <div class="grid2"><label class="f">ชื่อเรียกบัญชี<input name="label" value="${esc(a?.label)}" placeholder="เช่น บัญชีกฐิน, บัญชีบูรณะ" required></label>
    <label class="f">ธนาคาร<input name="bank" value="${esc(a?.bank)}" placeholder="เช่น ธนาคารกรุงไทย"></label>
    <label class="f">ชื่อบัญชี<input name="accname" value="${esc(a?.name)}"></label>
    <label class="f">เลขที่บัญชี<input name="no" value="${esc(a?.no)}" inputmode="numeric"></label>
    <label class="f">พร้อมเพย์ (เบอร์มือถือ / เลข 13 หลัก)<input name="promptpay" value="${esc(a?.promptpay)}" inputmode="numeric"></label></div>
    <label class="switch"><input type="checkbox" name="isDefault" ${a?.isDefault||(!a&&!S.accounts.length)?'checked':''}> บัญชีหลัก (ใช้กับงานที่ไม่ได้เลือกบัญชี)</label>
    <div class="row"><button class="btn primary" type="submit">${a?'บันทึก':ic('plus',18)+' เพิ่มบัญชี'}</button>${a?`<button class="btn" type="button" data-acct-cancel>ยกเลิก</button>`:''}</div></form>`;
  return `<p class="note">วัดมีหลายบัญชีได้ แต่ละงานบุญเลือกได้ว่าจะแสดงบัญชีไหน บัญชีที่ใส่เลขพร้อมเพย์ (เบอร์มือถือ หรือเลข 13 หลัก) จะแสดงคิวอาร์โค้ดให้สแกนจ่ายได้</p>
  <div class="list">${S.accounts.map(a=>ui.editAcct===a.id?form(a):`<article class="card"><div class="acct-item"><span class="mini"></span><div style="display:grid;gap:2px;min-width:0"><div class="row"><b>${esc(acctTitle(a))}</b>${a.isDefault?'<span class="pill ok">บัญชีหลัก</span>':''}<span class="note">ใช้กับ ${used(a.id)} งาน</span></div>
    <span class="note">${esc(a.bank)}${a.name?' · '+esc(a.name):''}</span>${a.no?`<span class="num">${esc(a.no)}</span>`:''}${a.promptpay?`<span>พร้อมเพย์ ${esc(a.promptpay)}</span>`:''}</div></div>
    <div class="row"><button class="btn sm" data-acct-edit="${a.id}">${ic('edit',15)} แก้ไข</button>${!a.isDefault?`<button class="btn sm" data-acct-def="${a.id}">ตั้งเป็นบัญชีหลัก</button>`:''}<span class="spacer"></span>${ui.delAcct===a.id?`<span class="note">ลบบัญชีนี้?${used(a.id)?` (${used(a.id)} งานจะใช้บัญชีหลักแทน)`:''}</span><button class="btn danger solid sm" data-acct-del-yes="${a.id}">ยืนยันลบ</button><button class="btn sm" data-acct-del-no>ยกเลิก</button>`:`<button class="iconbtn ghost sm" data-acct-del="${a.id}" aria-label="ลบบัญชี">${ic('trash',16)}</button>`}</div></article>`).join('')||'<div class="card empty">ยังไม่มีบัญชี เพิ่มบัญชีแรกด้านล่าง</div>'}</div>
  ${form(null)}`;
}
function staffPage(){
  if(DEMO)return `<div class="card"><p>ในระบบจริง แอดมินเพิ่มเจ้าหน้าที่ได้ 2 แบบ: ด้วยอีเมล Google หรือออก<b>ชื่อผู้ใช้ + รหัสผ่าน</b>ให้คนที่ไม่มีอีเมล เจ้าหน้าที่จะบันทึกรายชื่อผู้ทำบุญได้อย่างเดียว</p><p class="note">หน้านี้ใช้งานได้เมื่อเชื่อม Firebase แล้ว</p></div>`;
  const kind=ui.rKind||'code',lbl=r=>isPassAcct(r.email)?(r.name||'เจ้าหน้าที่'):r.email;
  return `<p class="note">เจ้าหน้าที่บันทึกรายชื่อผู้ทำบุญได้อย่างเดียว ส่วนแอดมินทำได้ทุกอย่าง เข้าสู่ระบบได้ทั้งด้วยบัญชี Google หรือด้วยชื่อผู้ใช้ที่แอดมินออกให้</p>
  <div class="list">${S.roles.length?S.roles.sort((x,y)=>lbl(x).localeCompare(lbl(y),'th')).map(r=>{const pass=isPassAcct(r.email);return `<article class="card"><div class="row"><span class="avatar g${hue(r.email)}">${esc(initial(lbl(r)))}</span><div style="display:grid;min-width:0"><b style="overflow-wrap:anywhere">${esc(lbl(r))}</b><span class="note">${pass?`${ic('key',13)} เข้าด้วยรหัสเจ้าหน้าที่`:`${ic('users',13)} บัญชี Google`}</span></div><span class="spacer"></span><span class="pill ${r.role==='admin'?'wait':'ok'}">${r.role==='admin'?'แอดมิน':'เจ้าหน้าที่'}</span></div>
   <div class="row">${r.role==='admin'?`<button class="btn sm" data-role="${esc(r.email)}" data-to="staff">เปลี่ยนเป็นเจ้าหน้าที่</button>`:`<button class="btn sm" data-role="${esc(r.email)}" data-to="admin">เปลี่ยนเป็นแอดมิน</button>`}<span class="spacer"></span>${ui.delRole===r.email?`<span class="note">เอาสิทธิ์ออก?</span><button class="btn danger solid sm" data-role-del-yes="${esc(r.email)}">ยืนยัน</button><button class="btn sm" data-role-del-no>ยกเลิก</button>`:`<button class="btn ghost danger sm" data-role-del="${esc(r.email)}">${pass?'ยกเลิกรหัส':'เอาสิทธิ์ออก'}</button>`}</div></article>`}).join(''):'<div class="card empty">ยังไม่มีเจ้าหน้าที่</div>'}</div>
  <form class="card form" id="f-role"><h3>เพิ่มเจ้าหน้าที่</h3>
  <div class="seg"><button type="button" class="chip" data-rkind="code" aria-pressed="${kind==='code'}">${ic('key',15)} ออกรหัสเจ้าหน้าที่</button><button type="button" class="chip" data-rkind="google" aria-pressed="${kind==='google'}">${ic('users',15)} ใช้อีเมล Google</button></div>
  ${kind==='code'?`<label class="f">ชื่อเจ้าหน้าที่ (แสดงเป็นผู้บันทึก)<input id="r-name" required maxlength="60" placeholder="เช่น ลุงสมชาย" autocomplete="off"></label>
  <p class="note">ระบบสุ่มรหัส 8 ตัวให้ เจ้าหน้าที่ใส่รหัสอย่างเดียวก็เข้าระบบได้ ไม่ต้องมีชื่อผู้ใช้หรืออีเมล</p>`
  :`<label class="f">อีเมล Google<input id="r-email" type="email" required placeholder="name@gmail.com" autocomplete="off"></label>`}
  <label class="f">สิทธิ์<select id="r-role"><option value="staff">เจ้าหน้าที่ (บันทึกรายชื่อได้อย่างเดียว)</option><option value="admin">แอดมิน (ทำได้ทุกอย่าง)</option></select></label>
  <div class="row"><button class="btn primary" type="submit">${ic('plus',18)} ${kind==='code'?'ออกรหัส':'เพิ่ม'}</button></div></form>
  <p class="note">แอดมินหลักที่ตั้งไว้ในไฟล์ firebase-config.js: ${esc(ADMIN_EMAILS.join(', ')||'-')}</p>`;
}
function importPage(){
  return `<section class="card form"><p class="note">ใช้ได้กับ 2 แบบ: <b>ไฟล์สำรองข้อมูล</b> ที่ดาวน์โหลดจากเมนูตั้งค่าวัด หรือ <b>ข้อมูลจากระบบเดิม.json</b> (ในโฟลเดอร์ data ของโปรเจกต์) กดนำเข้าซ้ำได้ ข้อมูลจะไม่ซ้ำ เพราะใช้รหัสเดิมของแต่ละรายการ</p>
  <label class="f">ไฟล์ข้อมูล (.json)<input type="file" id="imp-file" accept=".json,application/json"></label>
  <label class="switch"><input type="checkbox" id="imp-skipex"> ข้ามงานบุญตัวอย่าง (ที่ติดป้าย “ตัวอย่าง”)</label>
  <div id="imp-preview" class="note"></div>
  <div class="row"><button class="btn primary" id="imp-go" disabled>นำเข้าข้อมูล</button></div></section>`;
}

/* ---------- paste many lines into the name column ---------- */
function parseLines(text){
  return text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{
    let cells=l.split('\t').map(s=>s.trim());
    if(cells.length<2){const m=l.match(/^(.*?)[\s:=-]+([\d,]+(?:\.\d+)?)\s*(?:บาท)?\s*(.*)$/);cells=m?[m[1],m[2],m[3]]:[l]}
    return {...blankRow(),name:(cells[0]||'').replace(/^\d+[.)]\s*/,''),amount:cells[1]||'',note:cells[2]||'',receipt:/ใบ|อนุโมทนา|ต้องการ|✓|yes/i.test(cells[3]||'')};
  });
}

/* ---------- writes ---------- */
async function run(task,okMsg,log){
  if(busy)return false;busy=true;
  try{await task();if(okMsg)toast(okMsg);if(log&&user)setDoc(doc(db,'logs','l'+uid()),logData(...log)).catch(()=>{});return true}
  catch(e){console.error(e);toast(e.code==='permission-denied'?'ไม่มีสิทธิ์ทำรายการนี้':'บันทึกไม่สำเร็จ: '+(e.code||e.message),5000);return false}
  finally{busy=false}
}
const cleanTypes=list=>[...new Set(list.map(t=>t.trim()).filter(Boolean))].slice(0,40);

/* ---------- events ---------- */
function goCampaign(id,batch){ui={batch:!!batch,focusFirst:!!batch};go(id)}
function bind(){
  const $=s=>document.getElementById(s),on=(id,fn)=>{const e=$(id);if(e)e.onclick=fn},all=(sel,fn)=>document.querySelectorAll(sel).forEach(b=>b.onclick=e=>fn(b,e));
  on('b-login',login);on('b-login2',login);on('b-logout',logout);
  all('[data-demo]',b=>window.__setDemo(b.dataset.demo));
  on('b-demo-reset',()=>{F.reset();LS.del('wat-year');toast('ล้างข้อมูลตัวอย่างแล้ว')});
  on('b-more',openMore);
  all('[data-go]',b=>{ui={};document.querySelector('.sheet')?.remove();go(b.dataset.go)});
  all('[data-year]',b=>{yearFilter=+b.dataset.year;LS.set('wat-year',yearFilter);ui={};if(route().p==='home')render();else go('home')});
  on('b-onlyr',()=>{ui.onlyR=!ui.onlyR;partial()});
  all('[data-snap]',b=>openSnap(S.campaigns.find(c=>c.id===b.dataset.snap)));
  all('[data-open]',b=>goCampaign(b.dataset.open,false));
  all('[data-record]',b=>goCampaign(b.dataset.record,true));
  all('[data-give]',b=>{const id=b.dataset.give;if(cur()?.id!==id){ui={};go(id)}setTimeout(()=>document.getElementById('give')?.scrollIntoView({behavior:'smooth',block:'start'}),60)});
  all('[data-slip]',b=>{ui.slipFor=b.dataset.slip;ui.slipDone=null;ui.slipOpenAt=Date.now();const c=cur();document.getElementById('slipform').innerHTML=slipForm(c);bindSlip();document.getElementById('f-slip')?.scrollIntoView({behavior:'smooth',block:'start'})});
  all('[data-qracct]',b=>{ui.qrAcct=b.dataset.qracct;const c=cur();const q=document.getElementById('qrarea');if(q){q.innerHTML=qrArea(accountsFor(c).filter(a=>a.promptpay));bind()}});
  const qa=$('qr-amt');if(qa)qa.oninput=()=>{ui.qrAmt=qa.value;clearTimeout(qa.t);qa.t=setTimeout(drawQR,250)};
  all('[data-share]',b=>{ui.shareFor=ui.shareFor===b.dataset.share?null:b.dataset.share;ui.keepScroll=true;render(true)});
  all('[data-copy]',b=>{const i=$('sl-'+b.dataset.copy);copy(i.value,i)});
  all('[data-copytext]',b=>copy(b.dataset.copytext));
  all('[data-askdel]',b=>{ui.delK=b.dataset.askdel||null;partial()});
  all('[data-deldonor]',b=>{ui.delK=null;run(async()=>{const w=writeBatch(db);w.delete(doc(db,'donations',b.dataset.deldonor));if(S.receipts.some(r=>r.id===b.dataset.deldonor))w.delete(doc(db,'receipts',b.dataset.deldonor));await w.commit()},'ลบรายการแล้ว')});
  all('[data-report]',b=>{ui={rep:{mode:'all',year:activeYear(),month:today().slice(0,7),day:today(),camp:b.dataset.report},_keep:1};go('report')});
  on('b-batch',()=>{ui.batch=true;ui.focusFirst=true;ui.keepScroll=true;render(true);document.getElementById('batch')?.scrollIntoView({behavior:'smooth',block:'start'})});
  on('b-del',()=>{ui.confirmDel=true;render(true)});
  on('b-del-no',()=>{ui.confirmDel=false;render(true)});
  on('b-del-yes',async()=>{const id=$('f-camp').dataset.id,c=S.campaigns.find(x=>x.id===id);
    const ok=await run(async()=>{const ids=c.donors.map(d=>d.k);for(let i=0;i<ids.length;i+=200){const b=writeBatch(db);ids.slice(i,i+200).forEach(k=>{b.delete(doc(db,'donations',k));if(S.receipts.some(r=>r.id===k))b.delete(doc(db,'receipts',k))});await b.commit()}await deleteDoc(doc(db,'campaigns',id))},'ลบงานบุญแล้ว',['delete','campaign',id,`ลบงานบุญ ${c.title} พร้อมรายชื่อ ${stats(c).n} รายการ รวม ${baht(stats(c).total)}`,{donors:c.donors.map(donorSnap)}]);
    if(ok){LS.del('wat-draft-'+id);ui={};go('home')}});
  document.querySelectorAll('form.form:not(#f-slip)').forEach(f=>f.addEventListener('input',()=>{ui.formDirty=true}));
  const hg=$('c-hasgoal');if(hg)hg.onchange=()=>{$('c-goal-wrap').hidden=!hg.checked;if(hg.checked)$('c-goal').focus()};
  const fc=$('f-camp');if(fc)fc.onsubmit=async e=>{e.preventDefault();
    const nt=$('c-newtype').value.trim(),type=nt||$('c-type').value;
    const data={type,title:$('c-title').value.trim(),desc:$('c-desc').value.trim(),year:+$('c-year').value||curBE(),goal:$('c-hasgoal').checked?Math.max(0,Math.round(+$('c-goal').value||0)):0,date:$('c-date').value,
      acctIds:[...fc.querySelectorAll('input[name="c-acct"]:checked')].map(i=>i.value),hideAmt:$('c-hide').checked,updatedAt:serverTimestamp()};
    const id=fc.dataset.id||('c'+uid());
    const ok=await run(async()=>{if(nt&&!S.types.includes(nt))await setDoc(doc(db,'settings','temple'),{types:cleanTypes([...S.types,nt])},{merge:true});
      if(fc.dataset.id)await updateDoc(doc(db,'campaigns',id),data);else await setDoc(doc(db,'campaigns',id),{...data,createdAt:serverTimestamp()})},fc.dataset.id?'บันทึกแล้ว':'เพิ่มงานบุญแล้ว',[fc.dataset.id?'update':'create','campaign',id,`${fc.dataset.id?'แก้ไข':'เพิ่ม'}งานบุญ ${data.title} (ปี ${data.year}${data.goal?' เป้า '+baht(data.goal):''})`]);
    if(ok){yearFilter=data.year;LS.set('wat-year',yearFilter);ui={};go(id)}};
  const fs=$('f-set');if(fs)fs.onsubmit=async e=>{e.preventDefault();const v=id=>$(id).value.trim();
    const ok=await run(()=>setDoc(doc(db,'settings','temple'),{name:v('s-name'),place:v('s-place'),address:v('s-address'),phone:v('s-phone'),facebook:v('s-fb'),footerNote:v('s-footnote'),signer:v('s-signer'),signerTitle:v('s-signertitle'),b_welcome:v('s-bw'),b_thanks:v('s-bt'),b_cert:v('s-bc'),b_tv:v('s-btv'),types:cleanTypes($('s-types').value.split('\n'))},{merge:true}),'บันทึกการตั้งค่าแล้ว',['settings','settings','temple','แก้ไขข้อมูลวัด']);
    if(ok){ui={};go('home')}};
  document.querySelectorAll('.acct-form').forEach(f=>f.onsubmit=async e=>{e.preventDefault();
    const v=n=>f.elements[n].value.trim(),data={label:v('label'),bank:v('bank'),name:v('accname'),no:v('no'),promptpay:v('promptpay').replace(/[^\d]/g,'')};
    if(!data.no&&!data.promptpay){toast('ใส่เลขที่บัญชีหรือพร้อมเพย์อย่างน้อยหนึ่งอย่าง');return}
    if(data.promptpay&&![10,13,15].includes(data.promptpay.length)){toast('พร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลข 13 หลัก');return}
    const id=f.dataset.id||('a'+uid()),makeDef=f.elements.isDefault.checked||S.accounts.length===0;
    const ok=await run(async()=>{const b=writeBatch(db);b.set(doc(db,'accounts',id),{...data,isDefault:makeDef||(S.accounts.find(a=>a.id===id)?.isDefault??false)},{merge:true});
      if(makeDef)S.accounts.filter(a=>a.id!==id&&a.isDefault).forEach(a=>b.update(doc(db,'accounts',a.id),{isDefault:false}));await b.commit()},f.dataset.id?'บันทึกบัญชีแล้ว':'เพิ่มบัญชีแล้ว',[f.dataset.id?'update':'create','account',id,`${f.dataset.id?'แก้ไข':'เพิ่ม'}บัญชี ${data.label} ${data.bank} ${data.no||''}${data.promptpay?' พร้อมเพย์ '+data.promptpay:''}`]);
    if(ok){ui={keepScroll:true};render(true)}});
  all('[data-acct-edit]',b=>{ui={editAcct:b.dataset.acctEdit};render(true)});
  all('[data-acct-cancel]',()=>{ui={};render(true)});
  all('[data-acct-def]',b=>run(async()=>{const w=writeBatch(db);S.accounts.forEach(a=>w.update(doc(db,'accounts',a.id),{isDefault:a.id===b.dataset.acctDef}));await w.commit()},'ตั้งบัญชีหลักแล้ว'));
  all('[data-acct-del]',b=>{ui={delAcct:b.dataset.acctDel};render(true)});
  all('[data-acct-del-no]',()=>{ui={};render(true)});
  all('[data-acct-del-yes]',b=>{const id=b.dataset.acctDelYes;ui={};run(async()=>{const w=writeBatch(db);w.delete(doc(db,'accounts',id));
    S.campaigns.filter(c=>(c.acctIds||[]).includes(id)).forEach(c=>w.update(doc(db,'campaigns',c.id),{acctIds:c.acctIds.filter(x=>x!==id)}));
    const rest=S.accounts.filter(a=>a.id!==id);if(rest.length&&!rest.some(a=>a.isDefault))w.update(doc(db,'accounts',rest[0].id),{isDefault:true});await w.commit()},'ลบบัญชีแล้ว',['delete','account',id,`ลบบัญชี ${acctTitle(S.accounts.find(a=>a.id===id)||{})}`])});
  all('[data-rkind]',b=>{ui.rKind=b.dataset.rkind;render(true)});
  const fr=$('f-role');if(fr)fr.onsubmit=async e=>{e.preventDefault();const role=$('r-role').value;
    if(!$('r-name')){const em=$('r-email').value.trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){toast('อีเมลไม่ถูกต้อง');return}
      if(await run(()=>setDoc(doc(db,'roles',em),{role,kind:'google',addedAt:serverTimestamp()}),'เพิ่ม '+em+' แล้ว',['create','role',em,`เพิ่มเจ้าหน้าที่ ${em} (${role==='admin'?'แอดมิน':'เจ้าหน้าที่'})`])){ui={rKind:'google'};render(true)}return}
    const name=$('r-name').value.trim();if(!name){toast('ใส่ชื่อเจ้าหน้าที่');return}
    const btn=fr.querySelector('[type=submit]');btn.disabled=true;
    try{const code=await createCodeStaff(name,role);ui={};render(true);showCreds(name,code)}
    catch(err){console.error(err);btn.disabled=false;toast(err.code==='auth/operation-not-allowed'?'ต้องเปิด Email/Password ใน Firebase ก่อน (Authentication → Sign-in method)':'ออกรหัสไม่สำเร็จ: '+(err.code||err.message),6000)}};
  all('[data-role]',b=>run(()=>updateDoc(doc(db,'roles',b.dataset.role),{role:b.dataset.to}),'เปลี่ยนสิทธิ์แล้ว',['update','role',b.dataset.role,`เปลี่ยน ${b.dataset.role} เป็น${b.dataset.to==='admin'?'แอดมิน':'เจ้าหน้าที่'}`]));
  all('[data-role-del]',b=>{ui={delRole:b.dataset.roleDel};render(true)});
  all('[data-role-del-no]',()=>{ui={};render(true)});
  all('[data-role-del-yes]',b=>{ui={};const rr=S.roles.find(x=>x.email===b.dataset.roleDelYes),who=rr&&isPassAcct(rr.email)?'รหัสของ '+(rr.name||''):b.dataset.roleDelYes;run(()=>deleteDoc(doc(db,'roles',b.dataset.roleDelYes)),isPassAcct(b.dataset.roleDelYes)?'ยกเลิกรหัสแล้ว รหัสนี้ใช้เข้าระบบไม่ได้อีก':'เอาสิทธิ์ออกแล้ว',['delete','role',b.dataset.roleDelYes,`เอาสิทธิ์ ${who} ออก`])});
  const fi=$('imp-file');if(fi)fi.onchange=()=>readImport(fi.files[0]);
  const sk=$('imp-skipex');if(sk)sk.onchange=()=>previewImport();
  on('imp-go',doImport);
  /* slips */
  all('[data-sliptab]',b=>{ui.slipTab=b.dataset.sliptab;if(ui.slipTab==='done')S.slipsDone=null;render(true)});
  all('[data-zoom]',b=>{const s=slipBy(b.dataset.zoom);if(s)sheet(`<img class="full" src="${esc(s.img)}" alt="สลิป"><div class="row"><span class="spacer"></span><button class="btn" data-close>ปิด</button></div>`,'wide')});
  all('[data-approve]',b=>approveSlip(b.dataset.approve));
  all('[data-reject]',b=>{const sl=slipBy(b.dataset.reject);run(()=>updateDoc(doc(db,'slips',b.dataset.reject),{status:'rejected',checkedBy:user?.uid||'',checkedAt:serverTimestamp()}),'บันทึกว่าไม่ผ่าน',['reject','slip',b.dataset.reject,`ไม่ผ่าน: สลิปของ ${sl?.name||''} ${baht(sl?.amount)}`])});
  all('[data-slipdel]',b=>{const sl=slipBy(b.dataset.slipdel);run(async()=>{await deleteDoc(doc(db,'slips',b.dataset.slipdel));if(Array.isArray(S.slipsDone))S.slipsDone=S.slipsDone.filter(x=>x.id!==b.dataset.slipdel)},'ลบสลิปแล้ว',['delete','slip',b.dataset.slipdel,`ลบสลิปของ ${sl?.name||''} ${baht(sl?.amount)}`])});
  /* receipts */
  all('[data-rtab]',b=>{ui.rTab=b.dataset.rtab;render(true)});
  all('[data-issue]',b=>{const id=b.dataset.issue,ref=($('ref-'+id)?.value||'').trim();run(async()=>{const w=writeBatch(db);w.update(doc(db,'receipts',id),{status:'issued',ref,issuedAt:serverTimestamp()});if((await getDoc(doc(db,'donations',id))).exists())w.update(doc(db,'donations',id),{receiptSent:true});const rc=S.receipts.find(x=>x.id===id);addLog(w,'issue','receipt',id,`ออกใบอนุโมทนาให้ ${rc?.receiptName||rc?.donorName||''} ${baht(rc?.amount)} เลขอ้างอิง ${ref||'-'}`);await w.commit()},'ปิดคำขอแล้ว')});
  all('[data-unissue]',b=>{const id=b.dataset.unissue;run(async()=>{const w=writeBatch(db);w.update(doc(db,'receipts',id),{status:'pending'});if((await getDoc(doc(db,'donations',id))).exists())w.update(doc(db,'donations',id),{receiptSent:false});await w.commit()},'เปลี่ยนเป็นรอออกใบ')});
  on('b-rcsv',exportReceipts);
  /* report */
  all('[data-repmode]',b=>{ui.rep.mode=b.dataset.repmode;render(true)});
  [['rp-day','day'],['rp-month','month'],['rp-year','year'],['rp-camp','camp']].forEach(([id,k])=>{const e=$(id);if(e)e.onchange=()=>{ui.rep[k]=e.value;render(true)}});
  on('rp-pdf',()=>makeReport(ui.rep));
  on('rp-csv',()=>exportCsv(ui.rep));
  all('[data-close]',b=>b.closest('.sheet')?.remove());
  /* v4 */
  all('[data-dmenu]',b=>donorMenu(b.dataset.dmenu));
  all('[data-privacy]',()=>privacySheet());
  on('b-more',()=>{ui.lim=(ui.lim||60)+200;ui.keepScroll=true;render(true)});
  all('[data-paym]',b=>{draft.method=b.dataset.paym;saveDraft();document.querySelectorAll('[data-paym]').forEach(x=>x.setAttribute('aria-pressed',x===b))});
  const lfd=$('lf-date');if(lfd)lfd.onchange=()=>{ui.lf.date=lfd.value;render(true)};
  const lfa=$('lf-act');if(lfa)lfa.onchange=()=>{ui.lf.act=lfa.value;render(true)};
  const lfq=$('lf-q');if(lfq)lfq.onchange=()=>{ui.lf.q=lfq.value.trim();render(true)};
  on('lf-csv',async()=>{const out=[['เวลา','ผู้ทำรายการ','การกระทำ','ประเภท','รายละเอียด']];S.logs.forEach(l=>out.push([new Date(tsMs(l.at)).toLocaleString('th-TH'),l.byName,(ACT[l.action]||[l.action])[0],TGT[l.target]||l.target,l.summary]));if(await downloadBlob(csvBlob(out),'ประวัติการทำรายการ-'+stamp()+'.csv'))toast('ส่งออกแล้ว')});
  const cd=$('c-day');if(cd)cd.onchange=()=>{ui.cday=cd.value||today();render(true)};
  all('[data-close-day]',b=>closeDay(b.dataset.closeDay,+b.dataset.cash,b.dataset.name));
  on('c-csv',async()=>{const day=ui.cday,out=[['วันที่','ผู้บันทึก','ชื่อผู้ทำบุญ','จำนวนเงิน','วิธีรับเงิน','งานบุญ']];(S.day?.list||[]).forEach(d=>out.push([beDate(d.date),d.source==='slip'?'สลิปออนไลน์':d.createdByName||'',d.name,d.amount,PAY[d.method]||'',S.campaigns.find(c=>c.id===d.campaignId)?.title||'']));
    out.push([]);out.push(['ผลการปิดยอด']);S.closings.filter(c=>c.date===day).forEach(c=>out.push([beDate(c.date),c.name,'ยอดเงินสดในระบบ '+c.systemCash,'นับได้ '+c.counted,'ส่วนต่าง '+c.diff,c.note||'']));if(await downloadBlob(csvBlob(out),'ปิดยอด-'+day+'.csv'))toast('ส่งออกแล้ว')});
  const sq=$('s-q');if(sq){sq.oninput=()=>{ui.q=sq.value;clearTimeout(sq.t);sq.t=setTimeout(()=>{document.getElementById('s-res').innerHTML=searchResults()},200)};if(route().p==='search'&&!ui.qFocused){ui.qFocused=1;sq.focus();sq.setSelectionRange(sq.value.length,sq.value.length)}}
  on('b-backup',()=>makeBackup(!!$('bk-img')?.checked));
  all('[data-install]',()=>doInstall());
  on('rp-cert',()=>makeCerts(ui.rep));
  const sl=$('s-logo');if(sl)sl.onchange=()=>setLogo(sl.files[0]);
  on('s-logo-reset',()=>run(()=>setDoc(doc(db,'settings','temple'),{logo:''},{merge:true}),'ใช้ตราเริ่มต้นแล้ว'));
  bindSlip();
  if(document.getElementById('qr'))drawQR();
}
function sheet(html,cls,hold){
  document.querySelector('.sheet')?.remove();
  const ov=document.createElement('div');ov.className='sheet';if(hold)ov.dataset.hold='1';ov.setAttribute('role','dialog');ov.innerHTML=`<div class="sheet-box ${cls||''}">${html}</div>`;
  document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov&&!hold)ov.remove()});ov.addEventListener('keydown',e=>{if(e.key==='Escape'&&!hold)ov.remove()});
  ov.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>ov.remove());
  ov.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{ov.remove();ui={};go(b.dataset.go)});
  return ov;
}
function openMore(){
  const items=navItems().slice(4);
  sheet(`<h3>เมนูเพิ่มเติม</h3><div class="more">${items.map(([h,i,l,b])=>`<button data-go="${h}" ${isActive(h)?'aria-current="page"':''}>${ic(i,24)}<span>${l}</span>${b?`<span class="badge">${b}</span>`:''}</button>`).join('')}</div><button class="btn" data-close>ปิด</button>`);
}

function bindSlip(){
  const f=document.getElementById('f-slip');
  const again=document.getElementById('slip-again');if(again)again.onclick=()=>{ui.slipDone=null;ui.slipOpenAt=Date.now();document.getElementById('slipform').innerHTML=slipForm(cur());bind()};
  if(!f)return;
  const $=s=>document.getElementById(s);
  const sc=$('slip-close');if(sc)sc.onclick=()=>{ui.slipFor=null;$('slipform').innerHTML=''};
  const anonOn=()=>$('sl-anon').checked;
  const nameCnt=()=>{const n=$('sl-name').value.length;$('sl-ncnt').textContent=n>40?`${n}/200 ตัวอักษร`:''};nameCnt();autosize($('sl-name'));
  $('sl-anon').onchange=()=>{ui.giveAnon=anonOn();$('sl-nlbl').textContent=ui.giveAnon?'ชื่อของท่าน (ไม่บังคับ · ไม่แสดงในรายนาม เห็นเฉพาะเจ้าหน้าที่)':'ชื่อผู้ทำบุญ (แสดงในรายนาม)';check()};
  const check=()=>{const okN=$('sl-name').value.trim()||anonOn(),okA=parseAmt($('sl-amt').value),okI=!!ui.slipImg;$('sl-submit').disabled=!(okN&&okA&&okI);$('sl-hint').textContent=!okN?'ขั้นที่ 1: ใส่ชื่อผู้ทำบุญ':!okA?'ขั้นที่ 1: ใส่จำนวนเงิน':!okI?'ขั้นที่ 3: แนบรูปสลิปก่อนส่ง':'พร้อมส่งแล้ว';$('sl-hint').classList.toggle('ready',!!(okN&&okA&&okI))};
  $('sl-name').oninput=()=>{ui.giveName=$('sl-name').value;nameCnt();check()};
  $('sl-name').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();$('sl-amt').focus()}};
  $('sl-amt').oninput=()=>{ui.qrAmt=$('sl-amt').value;check();clearTimeout(f.qt);f.qt=setTimeout(drawQR,300)};
  if(!ui.slipOpenAt)ui.slipOpenAt=Date.now();
  if(!f.dataset.t)f.dataset.t=String(ui.slipOpenAt||(ui.slipOpenAt=Date.now()));
  $('sl-want').onchange=e=>{$('sl-rc').hidden=!e.target.checked;if(e.target.checked&&!$('sl-rname').value)$('sl-rname').value=$('sl-name').value};
  const showImg=img=>{$('sl-prev').innerHTML=`<img src="${img}" alt="ตัวอย่างสลิป"><small>${ic('check',14)} แนบสลิปแล้ว · แตะเพื่อเปลี่ยนรูป</small>`;$('sl-drop').classList.add('has')};
  if(ui.slipImg)showImg(ui.slipImg);check();
  $('sl-img').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const img=await compressImage(file,1100,.72);ui.slipImg=img;showImg(img);check()}catch(err){toast('อ่านรูปไม่ได้ ลองเลือกรูปใหม่')}};
  f.onsubmit=async e=>{e.preventDefault();
    if($('sl-web').value){ui.slipDone='1';$('slipform').innerHTML=slipForm(cur());bindSlip();return}
    if(Date.now()-(ui.slipOpenAt||0)<4000){toast('กรุณาตรวจข้อมูลอีกครั้งก่อนส่ง');return}
    const sent=LS.get('wat-slip-sent',[]).filter(t=>Date.now()-t<600000);if(sent.length>=3){toast('ส่งสลิปได้ไม่เกิน 3 ใบใน 10 นาที กรุณารอสักครู่',5000);return}
    const anon=anonOn(),typed=$('sl-name').value.replace(/\s+/g,' ').trim(),name=anon?ANON:typed,amount=parseAmt($('sl-amt').value),want=$('sl-want').checked;
    if(!name){toast('กรุณาใส่ชื่อผู้ทำบุญ');return}if(!amount){toast('กรุณาใส่จำนวนเงิน');return}const img=ui.slipImg;if(!img){toast('ต้องแนบรูปสลิปก่อนส่ง');$('sl-drop').scrollIntoView({behavior:'smooth',block:'center'});return}
    let receipt=null;
    if(want){receipt={receiptName:$('sl-rname').value.trim()||typed||name,taxId:$('sl-tax').value.replace(/\D/g,''),address:$('sl-addr').value.trim(),phone:$('sl-phone').value.trim(),note:$('sl-rnote').value.trim()};
      if(!taxOk(receipt.taxId)){toast('เลขประจำตัวผู้เสียภาษีต้องเป็น 13 หลักที่ถูกต้อง',4000);return}
      if(!$('sl-consent').checked){toast('กรุณาติ๊กยินยอมการใช้ข้อมูลเพื่อออกใบอนุโมทนา',4000);return}}
    const data={campaignId:f.dataset.c,name:name.slice(0,200),anon,realName:anon?typed.slice(0,200):'',amount,date:$('sl-date').value||today(),note:$('sl-note').value.trim().slice(0,300),wantReceipt:want,receipt,img,imgHash:cyrb53(img),status:'pending',createdAt:serverTimestamp()};
    const btn=f.querySelector('[type=submit]');btn.disabled=true;btn.textContent='กำลังส่ง…';
    try{await sendSlip(data);LS.set('wat-slip-sent',[...sent,Date.now()]);ui.slipOpenAt=null;ui.slipDone=want?'r':'1';ui.slipImg=null;ui.giveName='';ui.qrAmt='';$('slipform').innerHTML=slipForm(cur());bind();toast('ส่งข้อมูลแล้ว ขออนุโมทนาบุญ');$('slipform').scrollIntoView({behavior:'smooth',block:'start'})}
    catch(err){console.error(err);btn.disabled=false;btn.textContent='ส่งข้อมูลทำบุญ';toast(err.wait?err.message:'ส่งไม่สำเร็จ ('+(err.code||'error')+') ลองอีกครั้ง',5000)}};
}
/* ส่งสลิป: เซิร์ฟเวอร์จำกัด 1 ใบต่อนาที และ 10 ใบต่อวัน ต่อเครื่อง (ตรวจในกฎ Firestore ไม่ใช่แค่ในหน้าเว็บ) */
async function sendSlip(data){
  const id='s'+uid();
  if(DEMO){await setDoc(doc(db,'slips',id),{...data,uid:'demo-anon'});return}
  if(!auth.currentUser)await F.signInAnonymously(auth);
  const me=auth.currentUser.uid,qref=doc(db,'slipQuota',me);
  const q=await getDoc(qref).catch(()=>null),old=q&&q.exists()?q.data():null,now=Date.now();
  if(old&&now-tsMs(old.lastAt)<60000)throw Object.assign(new Error('กรุณารอ 1 นาทีก่อนส่งสลิปใบถัดไป'),{wait:1});
  const inDay=old&&now-tsMs(old.windowStart)<86400000;
  if(inDay&&old.n>=10)throw Object.assign(new Error('เครื่องนี้ส่งสลิปครบ 10 ใบใน 24 ชั่วโมงแล้ว กรุณาติดต่อวัด'),{wait:1});
  const w=writeBatch(db);
  w.set(doc(db,'slips',id),{...data,uid:me});
  w.set(qref,inDay?{lastAt:serverTimestamp(),windowStart:old.windowStart,n:old.n+1}:{lastAt:serverTimestamp(),windowStart:serverTimestamp(),n:1});
  await w.commit();
}
function privacySheet(){
  const t=S.temple;
  sheet(`<div class="row"><h3>${ic('eye',20)} นโยบายความเป็นส่วนตัว</h3><span class="spacer"></span><button class="iconbtn ghost sm" data-close aria-label="ปิด">${ic('x',18)}</button></div>
  <div class="policy"><p>${esc(t.name||'วัด')} เก็บข้อมูลเท่าที่จำเป็นต่อการรับทำบุญ ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</p>
  <h4>ข้อมูลที่แสดงต่อสาธารณะ</h4><p>ชื่อผู้ทำบุญ ยอดเงิน (ยกเว้นงานที่ตั้งให้ซ่อนยอด) และวันที่ แสดงในรายนามของงานบุญนั้น เพื่อความโปร่งใส หากไม่ต้องการ เลือก “ไม่ประสงค์ออกนาม” ได้</p>
  <h4>ข้อมูลที่ไม่แสดงต่อสาธารณะ</h4><p>รูปสลิป ชื่อจริงของผู้ไม่ประสงค์ออกนาม เห็นได้เฉพาะเจ้าหน้าที่ ส่วนเลขประจำตัวผู้เสียภาษี ที่อยู่ และเบอร์โทร สำหรับออกใบอนุโมทนา เห็นได้เฉพาะแอดมิน และใช้เพื่อแจ้งกรมสรรพากร (e-Donation) เท่านั้น</p>
  <h4>การขอแก้ไขหรือลบ</h4><p>ติดต่อวัด${t.phone?' โทร '+esc(t.phone):''}${t.facebook?' หรือ Facebook ของวัด':''} เพื่อขอแก้ชื่อ ขอเปลี่ยนเป็นไม่ออกนาม หรือขอลบข้อมูลได้ทุกเมื่อ</p></div>
  <div class="row"><span class="spacer"></span><button class="btn" data-close>เข้าใจแล้ว</button></div>`);
}
function compressImage(file,max,q){
  return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{let w=im.naturalWidth,h=im.naturalHeight;const s=Math.min(1,max/Math.max(w,h));w=Math.round(w*s);h=Math.round(h*s);
    const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);let out=c.toDataURL('image/jpeg',q);
    let qq=q;while(out.length>650000&&qq>.35){qq-=.1;out=c.toDataURL('image/jpeg',qq)}res(out)};im.onerror=rej;im.src=fr.result};fr.onerror=rej;fr.readAsDataURL(file)});
}
async function approveSlip(id){
  const s=S.slips.find(x=>x.id===id);if(!s||!user)return;
  const amount=parseAmt(document.getElementById('sa-'+id)?.value)||s.amount;
  const dk='d'+uid();
  await run(async()=>{const w=writeBatch(db);
    w.set(doc(db,'donations',dk),{campaignId:s.campaignId,name:s.name,amount,date:s.date||today(),note:s.note||'',wantReceipt:!!s.wantReceipt,receiptSent:false,source:'slip',method:'transfer',createdAt:serverTimestamp(),createdBy:user.uid,createdByName:user.displayName||user.email});
    if(s.wantReceipt&&s.receipt)w.set(doc(db,'receipts',dk),{donationId:dk,campaignId:s.campaignId,donorName:s.realName||s.name,receiptName:s.receipt.receiptName||s.name,taxId:s.receipt.taxId||'',address:s.receipt.address||'',phone:s.receipt.phone||'',note:s.receipt.note||'',amount,date:s.date||today(),status:'pending',createdAt:serverTimestamp(),createdBy:user.uid});
    w.update(doc(db,'slips',id),{status:'approved',donationId:dk,amount,checkedBy:user.uid,checkedAt:serverTimestamp()});
    addLog(w,'approve','slip',id,`ยืนยันสลิป ${s.name} ${baht(amount)}${amount!==s.amount?` (สลิประบุ ${baht(s.amount)})`:''} · ${S.campaigns.find(c=>c.id===s.campaignId)?.title||''}`);
    await w.commit()},'ยืนยันแล้ว ลงรายนามเรียบร้อย');
}

function bindBatch(){
  const body=document.getElementById('bt-body');if(!body)return;
  const $=s=>document.getElementById(s);
  const rowOf=el=>{const tr=el.closest('.bt-row');return tr&&draft.rows.find(r=>r.k===tr.dataset.k)};
  const redrawRow=r=>{const i=draft.rows.indexOf(r),el=body.querySelector(`.bt-row[data-k="${r.k}"]`);if(el){el.outerHTML=rowHTML(r,i);growAll(body.querySelector(`.bt-row[data-k="${r.k}"]`))}};
  growAll(body);
  /* รายชื่อแนะนำ (ใช้แทน datalist เพราะช่องชื่อเป็นแบบหลายบรรทัด) */
  let sg=null,sgI=-1;
  const sgClose=()=>{sg?.remove();sg=null;sgI=-1};
  const sgPick=(ta,v)=>{ta.value=v;autosize(ta);ta.dispatchEvent(new Event('input',{bubbles:true}));sgClose();ta.closest('.bt-row').querySelector('[data-f="amount"]').focus()};
  const sgShow=ta=>{const q=normName(ta.value);sgClose();if(q.length<1)return;
    const l=names().filter(n=>{const k=normName(n);return k.includes(q)&&k!==q}).sort((a,b)=>normName(a).indexOf(q)-normName(b).indexOf(q)).slice(0,6);if(!l.length)return;
    sg=document.createElement('div');sg.className='sugg';sg.setAttribute('role','listbox');
    sg.innerHTML=l.map((n,i)=>`<button type="button" role="option" data-i="${i}">${esc(n)}</button>`).join('');
    sg.addEventListener('mousedown',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();sgPick(ta,l[+b.dataset.i])});
    sg._l=l;ta.closest('.namebox').appendChild(sg)};
  body.addEventListener('focusout',e=>{if(e.target.dataset.f==='name')setTimeout(sgClose,120)});
  const grow=()=>{if(!draft.rows.some(x=>rowState(x)==='empty')){const add=blank(2),start=draft.rows.length;draft.rows.push(...add);body.insertAdjacentHTML('beforeend',add.map((x,i)=>rowHTML(x,start+i)).join(''))}};
  const changed=e=>{const r=rowOf(e.target);if(!r||!e.target.dataset.f)return;const f=e.target.dataset.f;
    if(f==='receipt'){r.receipt=e.target.checked;if(r.receipt&&!r.rName)r.rName=r.name;redrawRow(r);if(r.receipt)body.querySelector(`.bt-row[data-k="${r.k}"] [data-f="taxId"]`)?.focus()}
    else r[f]=e.target.value;
    body.querySelector(`.bt-row[data-k="${r.k}"]`).className='bt-row st-'+rowState(r);
    grow();saveDraft();updateBatchSum();scheduleAuto()};
  body.addEventListener('input',e=>{if(e.target.dataset.f!=='receipt')changed(e);if(e.target.dataset.f==='name'&&e.isTrusted)sgShow(e.target)});
  body.addEventListener('change',e=>{if(e.target.dataset.f==='receipt')changed(e)});
  body.addEventListener('keydown',e=>{
    if(sg&&e.target.dataset.f==='name'&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const bs=[...sg.children];sgI=(sgI+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length;bs.forEach((b,i)=>b.classList.toggle('on',i===sgI));return}
    if(sg&&e.key==='Escape'){sgClose();return}
    if(e.key!=='Enter'||e.isComposing||e.target.type==='checkbox')return;e.preventDefault();
    if(sg&&sgI>=0&&e.target.dataset.f==='name'){sgPick(e.target,sg._l[sgI]);return}
    sgClose();
    const tr=e.target.closest('.bt-row'),f=e.target.dataset.f;
    if(f==='name'){tr.querySelector('[data-f="amount"]').focus();return}
    let next=tr.nextElementSibling;if(!next){draft.rows.push(...blank(2));saveDraft();redrawRows();next=body.querySelector(`.bt-row[data-k="${tr.dataset.k}"]`).nextElementSibling}
    (next.querySelector('[data-f="name"]')||next.querySelector('[data-f="amount"]')).focus()});
  body.addEventListener('paste',e=>{
    if(e.target.dataset.f!=='name')return;const t=(e.clipboardData||window.clipboardData)?.getData('text')||'';
    if(!/\n/.test(t.trim())&&!/\t/.test(t))return;e.preventDefault();
    const rows=parseLines(t);if(!rows.length)return;
    const i=draft.rows.findIndex(r=>r.k===e.target.closest('.bt-row').dataset.k);
    const tail=draft.rows.slice(i+1).filter(r=>rowState(r)!=='empty');
    draft.rows=[...draft.rows.slice(0,i),...rows,...tail];padRows();saveDraft();redrawRows();scheduleAuto();toast('วางแล้ว '+rows.length+' แถว ตรวจดูแล้วกดบันทึก')});
  body.addEventListener('click',e=>{
    const rm=e.target.closest('[data-rm]');if(rm){draft.rows=draft.rows.filter(r=>r.k!==rm.dataset.rm);padRows();saveDraft();redrawRows();scheduleAuto();return}
    const pen=e.target.closest('[data-pen]');if(pen){const r=draft.rows.find(x=>x.k===pen.dataset.pen);clearTimeout(autoTimer);openPad(img=>{if(!img)return;r.img=img;redrawRow(r);body.querySelector(`.bt-row[data-k="${r.k}"]`).className='bt-row st-'+rowState(r);grow();saveDraft();updateBatchSum();body.querySelector(`.bt-row[data-k="${r.k}"] [data-f="amount"]`)?.focus()});return}
    const un=e.target.closest('[data-unimg]');if(un){const r=draft.rows.find(x=>x.k===un.dataset.unimg);r.img='';redrawRow(r);saveDraft();updateBatchSum()}});
  $('bt-date').onchange=e=>{draft.date=e.target.value||today();saveDraft();scheduleAuto()};
  $('bt-auto').onchange=e=>{autoOn=e.target.checked;LS.set('wat-auto',autoOn);updateBatchSum();if(autoOn)scheduleAuto();else clearTimeout(autoTimer)};
  $('bt-add').onclick=()=>{draft.rows.push(...blank(5));saveDraft();redrawRows()};
  $('bt-clear').onclick=e=>{const b=e.currentTarget;if(b.dataset.sure){draft.rows=blank(3);saveDraft();redrawRows();b.textContent='ล้างตาราง';delete b.dataset.sure;clearTimeout(autoTimer)}else{b.dataset.sure='1';b.textContent='กดอีกครั้งเพื่อยืนยัน'}};
  $('bt-save').onclick=()=>saveBatch(false);
  $('bt-close').onclick=()=>{clearTimeout(autoTimer);ui.batch=false;ui.keepScroll=true;render(true)};
}

/* each row is its own document, so several staff can enter names at the same time without overwriting each other;
   the offline cache keeps rows when the internet drops and syncs later */
async function saveBatch(auto){
  clearTimeout(autoTimer);
  if(document.querySelector('.sheet'))return;
  const c=cur();if(!c||!draft||busy||!isStaff()||!user)return;
  const ok=draft.rows.filter(r=>rowState(r)==='ok');
  if(!ok.length){if(!auto)toast('ยังไม่มีแถวที่กรอกครบ (ชื่อ + จำนวนเงิน)');return}
  const badTax=ok.filter(r=>r.receipt&&r.taxId&&!taxOk(r.taxId));
  if(badTax.length&&!auto){toast('เลขผู้เสียภาษีบางแถวไม่ถูกต้อง ตรวจแถวสีเหลืองอีกครั้ง',4000)}
  const date=draft.date||today(),okKeys=new Set(ok.map(r=>r.k)),prevRows=draft.rows;
  const b=writeBatch(db);
  ok.forEach(r=>{const nm=r.name.trim()||'(ลายมือ)';
    b.set(doc(db,'donations',r.k),{campaignId:c.id,name:nm.slice(0,200),...(r.img?{nameImg:r.img}:{}),amount:parseAmt(r.amount),date,note:r.note.trim().slice(0,500),wantReceipt:!!r.receipt,receiptSent:false,source:'staff',method:draft.method||'cash',createdAt:serverTimestamp(),createdBy:user.uid,createdByName:user.displayName||user.email});
    if(r.receipt)b.set(doc(db,'receipts',r.k),{donationId:r.k,campaignId:c.id,donorName:nm,receiptName:(r.rName||r.name).trim(),taxId:String(r.taxId||'').replace(/\D/g,''),address:(r.addr||'').trim(),phone:(r.phone||'').trim(),note:(r.rNote||'').trim(),amount:parseAmt(r.amount),date,status:'pending',createdAt:serverTimestamp(),createdBy:user.uid})});
  const ae=document.activeElement,keepK=ae&&ae.closest&&ae.closest('#bt-body .bt-row')?.dataset.k,keepF=ae?.dataset?.f;
  draft.rows=draft.rows.filter(r=>!okKeys.has(r.k));padRows();saveDraft();redrawRows();
  const back=(keepK&&!okKeys.has(keepK)&&app.querySelector(`.bt-row[data-k="${keepK}"] [data-f="${keepF}"]`))||(ae&&ae.closest&&ae.closest('#bt-body')?app.querySelector('#bt-body .bt-row.st-empty [data-f="name"]'):null);back&&back.focus();
  const total=ok.reduce((a,r)=>a+parseAmt(r.amount),0),rc=ok.filter(r=>r.receipt).length;
  busy=true;updateBatchSum();
  const t=setTimeout(()=>{if(busy)toast('บันทึกไว้ในเครื่องแล้ว จะส่งขึ้นระบบเมื่อมีอินเทอร์เน็ต',4000)},2500);
  addLog(b,'create','donation',c.id,`เพิ่ม ${ok.length} รายการ รวม ${baht(total)} (${PAY[draft.method||'cash']}) · ${c.title}: `+ok.slice(0,12).map(r=>`${r.name.trim()||'(ลายมือ)'} ${num(parseAmt(r.amount))}`).join(', ')+(ok.length>12?' …':''),{ids:ok.map(r=>r.k)});
  try{await b.commit();toast(`บันทึก ${ok.length} รายการ รวม ${baht(total)}${rc?` · ส่งคำขอใบอนุโมทนา ${rc} รายการถึงแอดมินแล้ว`:''}`,3500)}
  catch(e){console.error(e);const keep=draft.rows.filter(r=>rowState(r)!=='empty');draft.rows=[...prevRows.filter(r=>okKeys.has(r.k)),...keep];padRows();saveDraft();if(document.getElementById('bt-body'))redrawRows();
    toast(e.code==='permission-denied'?'บันทึกไม่ได้: บัญชีนี้ไม่มีสิทธิ์เจ้าหน้าที่':'บันทึกไม่สำเร็จ ('+(e.code||'error')+') รายการยังอยู่ในตาราง',5000)}
  finally{clearTimeout(t);busy=false;updateBatchSum()}
}

/* ---------- handwriting pad (Apple Pencil, stylus, finger or mouse) ---------- */
function openPad(done){
  const ov=sheet(`<div class="row"><h3>${ic('pen',20)} เขียนชื่อผู้ทำบุญ</h3><span class="spacer"></span><button class="iconbtn ghost sm" data-close aria-label="ปิด">${ic('x',18)}</button></div>
  <canvas class="pad" id="pad" aria-label="พื้นที่เขียนลายมือ"></canvas>
  <p class="note">เขียนด้วยปากกาหรือนิ้วในกรอบ ใช้ได้ทั้ง iPad และแท็บเล็ต</p>
  <div class="row"><button class="btn" id="pad-clear">${ic('trash',16)} ล้าง</button><span class="spacer"></span><button class="btn ghost" data-close>ยกเลิก</button><button class="btn primary" id="pad-ok">${ic('check',17)} ใช้ลายมือนี้</button></div>`,'wide',true);
  const cv=ov.querySelector('#pad'),x=cv.getContext('2d'),dpr=Math.max(1,window.devicePixelRatio||1);
  const fit=()=>{const r=cv.getBoundingClientRect();cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);x.setTransform(dpr,0,0,dpr,0,0);x.lineCap='round';x.lineJoin='round';x.strokeStyle='#171927';redraw()};
  let strokes=[],curS=null;
  const redraw=()=>{x.clearRect(0,0,cv.width,cv.height);
    x.save();x.strokeStyle='#e5e7f0';x.setLineDash([6,6]);x.beginPath();const h=cv.height/dpr;x.moveTo(16,h*0.72);x.lineTo(cv.width/dpr-16,h*0.72);x.stroke();x.restore();
    strokes.forEach(s=>{for(let i=1;i<s.length;i++){x.lineWidth=s[i].w;x.beginPath();x.moveTo(s[i-1].x,s[i-1].y);x.lineTo(s[i].x,s[i].y);x.stroke()}})};
  const pt=e=>{const r=cv.getBoundingClientRect();const p=e.pointerType==='pen'?(e.pressure||.5):.5;return{x:e.clientX-r.left,y:e.clientY-r.top,w:e.pointerType==='mouse'?3.2:1.6+p*4.2}};
  cv.addEventListener('pointerdown',e=>{e.preventDefault();cv.setPointerCapture(e.pointerId);curS=[pt(e)];strokes.push(curS)});
  cv.addEventListener('pointermove',e=>{if(!curS)return;e.preventDefault();const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];evs.forEach(ev=>{const p=pt(ev),l=curS[curS.length-1];curS.push(p);x.lineWidth=p.w;x.beginPath();x.moveTo(l.x,l.y);x.lineTo(p.x,p.y);x.stroke()})});
  const end=()=>{curS=null};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  requestAnimationFrame(fit);
  ov.querySelector('#pad-clear').onclick=()=>{strokes=[];redraw()};
  ov.querySelector('#pad-ok').onclick=()=>{
    const pts=strokes.flat();if(!pts.length){toast('ยังไม่ได้เขียน');return}
    let x0=Math.min(...pts.map(p=>p.x))-8,y0=Math.min(...pts.map(p=>p.y))-8,x1=Math.max(...pts.map(p=>p.x))+8,y1=Math.max(...pts.map(p=>p.y))+8;
    const w=x1-x0,h=y1-y0,H=72,sc=Math.min(H/h,600/w,1.5),out=document.createElement('canvas');out.width=Math.ceil(w*sc);out.height=Math.ceil(h*sc);
    const o=out.getContext('2d');o.lineCap='round';o.lineJoin='round';o.strokeStyle='#171927';
    strokes.forEach(s=>{for(let i=1;i<s.length;i++){o.lineWidth=Math.max(1.2,s[i].w*sc);o.beginPath();o.moveTo((s[i-1].x-x0)*sc,(s[i-1].y-y0)*sc);o.lineTo((s[i].x-x0)*sc,(s[i].y-y0)*sc);o.stroke()}});
    ov.remove();done(out.toDataURL('image/png'))};
}

/* ---------- PromptPay QR (EMVCo payload) ---------- */
function crc16(s){let c=0xFFFF;for(let i=0;i<s.length;i++){c^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++)c=(c&0x8000)?((c<<1)^0x1021)&0xFFFF:(c<<1)&0xFFFF}return c.toString(16).toUpperCase().padStart(4,'0')}
function promptpayPayload(id,amount){
  const f=(t,v)=>t+String(v.length).padStart(2,'0')+v,d=String(id).replace(/\D/g,'');
  const acc=d.length>=15?f('03',d):d.length===13?f('02',d):f('01',('0000000000000'+'66'+d.replace(/^0/,'')).slice(-13));
  const body=f('00','01')+f('01',amount?'12':'11')+f('29',f('00','A000000677010111')+acc)+f('53','764')+(amount?f('54',amount.toFixed(2)):'')+f('58','TH')+'6304';
  return body+crc16(body);
}
const scriptCache={};
function loadScript(urls){
  const key=urls[0];if(scriptCache[key])return scriptCache[key];
  return scriptCache[key]=new Promise((res,rej)=>{let i=0;const next=()=>{if(i>=urls.length){delete scriptCache[key];rej(new Error('load failed'));return}const s=document.createElement('script');s.src=urls[i++];s.onload=()=>res();s.onerror=()=>{s.remove();next()};document.head.appendChild(s)};next()});
}
const QR_URLS=['https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js','https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js','https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js','https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'];
async function drawQR(){
  const cv=document.getElementById('qr');if(!cv)return;const c=cur();if(!c)return;
  const accs=accountsFor(c).filter(a=>a.promptpay),a=accs.find(x=>x.id===ui.qrAcct)||accs[0];if(!a)return;
  const amt=Number(String(ui.qrAmt||'').replace(/[^\d.]/g,''))||0;
  const x=cv.getContext('2d');
  try{await loadScript(['https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js','https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js','https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js','https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'])}
  catch(e){x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);x.fillStyle='#171927';x.font='bold 16px sans-serif';x.textAlign='center';x.fillText('โหลดคิวอาร์ไม่ได้',cv.width/2,cv.height/2-8);x.font='14px sans-serif';x.fillText('ใช้เลขพร้อมเพย์ด้านล่างแทน',cv.width/2,cv.height/2+16);return}
  const q=window.qrcode(0,'M');q.addData(promptpayPayload(a.promptpay,amt));q.make();
  const n=q.getModuleCount(),cell=Math.floor(cv.width/(n+2)),off=Math.floor((cv.width-cell*n)/2);
  x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);x.fillStyle='#171927';
  for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))x.fillRect(off+k*cell,off+r*cell,cell,cell);
  const qa=cv.parentElement.querySelector('.qa');if(qa)qa.innerHTML=`${esc(a.name||acctTitle(a))}<br>${esc(a.promptpay)}${amt?` · ${baht(amt)}`:''}`;
}

/* ---------- files ---------- */
const csvCell=v=>{v=String(v??'');return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const beDate=d=>{if(!d)return'';const [y,m,dd]=d.split('-');return `${+dd}/${+m}/${+y+543}`};
async function downloadBlob(blob,name){
  if(window.claude?.use){try{const d=await window.claude.use('downloads');if(d){await d.save({filename:name,data:blob});return true}}catch(e){if(e&&e.code==='declined')return false}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);return true;
}
const stamp=()=>{const d=new Date();return (d.getFullYear()+543)+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')};
const safeName=s=>s.replace(/[\\/:*?"<>|]+/g,'').slice(0,70);
const csvBlob=rows=>new Blob(['﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
async function exportCsv(v){
  const rows=reportRows(v);if(!rows.length){toast('ไม่มีรายการในช่วงนี้');return}
  const t=reportTitle(v),out=[['ลำดับ','วันที่','ชื่อผู้ทำบุญ','จำนวนเงิน (บาท)','ใบอนุโมทนา','หมายเหตุ','งานบุญ','ประเภท','ปี พ.ศ.']];let tot=0;
  rows.forEach(({c,d},i)=>{tot+=d.amount;out.push([i+1,beDate(d.date),d.name,d.amount,d.wantReceipt?(d.receiptSent?'ออกแล้ว':'ขอใบ'):'',d.note||'',c.title,c.type,campYear(c)])});
  out.push([],['','','รวมทั้งหมด',tot,'','',`${rows.length} รายการ`]);
  if(await downloadBlob(csvBlob(out),safeName(`รายงานทำบุญ-${t.p}`)+'.csv'))toast('ส่งออก '+rows.length+' รายการแล้ว');
}
async function exportReceipts(){
  const tab=ui.rTab||'pending',list=S.receipts.filter(r=>tab==='pending'?r.status!=='issued':r.status==='issued');
  const out=[['ชื่อในใบอนุโมทนา','เลขประจำตัวผู้เสียภาษี','ที่อยู่','โทร','จำนวนเงิน','วันที่','งานบุญ','ผู้ทำบุญ','หมายเหตุ','สถานะ','เลขอ้างอิง']];
  list.forEach(r=>out.push([r.receiptName||r.donorName,"'"+(r.taxId||''),r.address||'',r.phone||'',r.amount,beDate(r.date),S.campaigns.find(c=>c.id===r.campaignId)?.title||'',r.donorName,r.note||'',r.status==='issued'?'ออกแล้ว':'รอออก',r.ref||'']));
  if(await downloadBlob(csvBlob(out),'คำขอใบอนุโมทนา-'+stamp()+'.csv'))toast('ส่งออกแล้ว');
}

/* ---------- PDF report: pages drawn on canvas (Thai text renders exactly), wrapped in a small PDF ---------- */
function pdfFromJpegs(pages,size){
  const [PW,PH]=size||[595.28,841.89];
  const enc=new TextEncoder(),parts=[];let len=0;const offs=[];
  const push=v=>{const b=typeof v==='string'?enc.encode(v):v;parts.push(b);len+=b.length};
  const obj=(i,fn)=>{offs[i]=len;push(i+' 0 obj\n');fn();push('\nendobj\n')};
  push('%PDF-1.4\n');push(new Uint8Array([37,226,227,207,211,10]));
  const n=pages.length;
  obj(1,()=>push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2,()=>push(`<< /Type /Pages /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] /Count ${n} >>`));
  pages.forEach((p,i)=>{const po=3+i*3,co=po+1,io=po+2,cs=`q ${PW} 0 0 ${PH} 0 0 cm /Im${i} Do Q`;
    obj(po,()=>push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im${i} ${io} 0 R >> >> /Contents ${co} 0 R >>`));
    obj(co,()=>push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(io,()=>{push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`);push(p.bytes);push('\nendstream')})});
  const xref=len,total=3+n*3;let x=`xref\n0 ${total}\n0000000000 65535 f \n`;for(let i=1;i<total;i++)x+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
  push(x+`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts,{type:'application/pdf'});
}
const loadImg=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src});
async function makeReport(v){
  const rows=reportRows(v);if(!rows.length){toast('ไม่มีรายการในช่วงนี้');return}
  toast('กำลังสร้าง PDF…',8000);
  try{await Promise.all([400,600,700,800].map(w=>document.fonts.load(FONT(w,24))))}catch(e){}
  const imgs=await Promise.all(rows.map(r=>r.d.nameImg?loadImg(r.d.nameImg):null));
  const W=1240,H=1754,M=84,RH=46,t=reportTitle(v),single=v.camp!=='all';
  const cols=single?[['ลำดับ',80,'c'],['วันที่',170,'l'],['ชื่อผู้ทำบุญ',570,'l'],['ใบอนุโมทนา',90,'c'],['จำนวนเงิน (บาท)',162,'r']]:[['ลำดับ',76,'c'],['วันที่',150,'l'],['ชื่อผู้ทำบุญ',370,'l'],['งานบุญ',300,'l'],['ใบ',50,'c'],['จำนวนเงิน',126,'r']];
  const clip=(x,s,w)=>{s=String(s);if(x.measureText(s).width<=w)return s;while(s&&x.measureText(s+'…').width>w)s=s.slice(0,-1);return s+'…'};
  const pages=[];let i=0,pg=0;const now=new Date();
  const per1=Math.floor((H-M-360-130)/RH),per=Math.floor((H-M-150-130)/RH);
  const totalPages=rows.length<=per1?1:1+Math.ceil((rows.length-per1)/per);
  const byCamp=new Map();rows.forEach(({c,d})=>byCamp.set(c.id,{c,n:(byCamp.get(c.id)?.n||0)+1,s:(byCamp.get(c.id)?.s||0)+d.amount}));
  const tot=rows.reduce((a,r)=>a+r.d.amount,0);
  const needSummary=true;let summaryDone=false;
  while(i<rows.length||!summaryDone){
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
    x.fillStyle='#fff';x.fillRect(0,0,W,H);x.textBaseline='middle';
    let y=M;
    if(pg===0){
      const g=x.createLinearGradient(M,0,W-M,0);g.addColorStop(0,'#ff7a18');g.addColorStop(.5,'#ff3d77');g.addColorStop(1,'#7c4dff');x.fillStyle=g;x.fillRect(M,y,W-2*M,10);
      y+=56;const lg=await drawLogo(x,W-M-56,y+10,56);x.fillStyle='#171927';x.font=FONT(800,44);x.fillText(clip(x,S.temple.name||'',W-2*M-(lg?140:0)),M,y);
      y+=50;x.font=FONT(700,32);x.fillStyle='#ff3d77';x.fillText('รายงานการทำบุญ',M,y);
      y+=46;x.fillStyle='#171927';x.font=FONT(600,26);x.fillText(clip(x,`ช่วงเวลา: ${t.p}`,W-2*M),M,y);
      y+=38;x.fillText(clip(x,`งานบุญ: ${t.c}`,W-2*M),M,y);
      y+=36;x.fillStyle='#6a6f86';x.font=FONT(400,22);x.fillText(`พิมพ์เมื่อ ${now.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})} เวลา ${now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} น. · ${num(rows.length)} รายการ · รวม ${baht(tot)}`,M,y);
      y+=48;
    }else{x.fillStyle='#6a6f86';x.font=FONT(600,22);x.fillText(clip(x,`${S.temple.name} · รายงานการทำบุญ ${t.p}`,W-2*M),M,y+10);y+=56}
    if(i<rows.length){
      x.fillStyle='#f3f4fa';x.fillRect(M,y,W-2*M,RH+4);x.fillStyle='#171927';x.font=FONT(700,22);
      let cx=M;cols.forEach(([h,w,al])=>{x.textAlign=al==='r'?'right':al==='c'?'center':'left';x.fillText(h,al==='r'?cx+w-14:al==='c'?cx+w/2:cx+14,y+RH/2+2);cx+=w});y+=RH+4;
      const lim=pg===0?per1:per;
      for(let k=0;k<lim&&i<rows.length;k++,i++){
        const {c,d}=rows[i];if(k%2){x.fillStyle='#fafafe';x.fillRect(M,y,W-2*M,RH)}
        x.strokeStyle='#eceef5';x.lineWidth=1;x.beginPath();x.moveTo(M,y+RH);x.lineTo(W-M,y+RH);x.stroke();
        x.fillStyle='#171927';x.font=FONT(400,22);let cx=M;
        const cells=single?[String(i+1),beDate(d.date),'#name',d.wantReceipt?(d.receiptSent?'ออกแล้ว':'ขอใบ'):'',num(d.amount)]:[String(i+1),beDate(d.date),'#name',c.title,d.wantReceipt?'✓':'',num(d.amount)];
        cols.forEach(([h,w,al],j)=>{const v2=cells[j];
          if(v2==='#name'){const im=imgs[i];if(im){const ih=RH-10,iw=Math.min(w-28,im.width*ih/im.height);x.drawImage(im,cx+14,y+5,iw,ih)}else{x.textAlign='left';x.font=FONT(600,22);x.fillText(clip(x,d.name,w-28),cx+14,y+RH/2+2);x.font=FONT(400,22)}}
          else{x.textAlign=al==='r'?'right':al==='c'?'center':'left';if(j===cols.length-1)x.font=FONT(700,22);x.fillText(clip(x,v2,w-28),al==='r'?cx+w-14:al==='c'?cx+w/2:cx+14,y+RH/2+2);x.font=FONT(400,22)}
          cx+=w});
        y+=RH;
      }
    }
    if(i>=rows.length&&!summaryDone){
      const need=70+byCamp.size*40+60;
      if(H-M-60-y>need){
        y+=30;x.textAlign='left';x.fillStyle='#171927';x.font=FONT(800,26);x.fillText('สรุปตามงานบุญ',M,y);y+=24;
        [...byCamp.values()].forEach(({c,n,s})=>{y+=40;x.font=FONT(400,22);x.fillStyle='#171927';x.textAlign='left';x.fillText(clip(x,c.title,W-2*M-420),M+14,y);x.fillStyle='#6a6f86';x.textAlign='right';x.fillText(`${num(n)} รายการ`,W-M-220,y);x.fillStyle='#171927';x.font=FONT(700,22);x.fillText(baht(s),W-M-14,y)});
        y+=24;const g=x.createLinearGradient(M,0,W-M,0);g.addColorStop(0,'#ff7a18');g.addColorStop(1,'#ff3d77');x.fillStyle=g;x.fillRect(M,y,W-2*M,64);
        x.fillStyle='#fff';x.font=FONT(800,26);x.textAlign='left';x.fillText(`รวมทั้งหมด ${num(rows.length)} รายการ`,M+18,y+33);x.textAlign='right';x.fillText(baht(tot),W-M-18,y+33);
        summaryDone=true;
      }
    }
    x.textAlign='center';x.fillStyle='#9aa0b8';x.font=FONT(400,20);x.fillText(`หน้า ${pg+1}`,W/2,H-M/2);
    const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',.86));
    pages.push({w:W,h:H,bytes:new Uint8Array(await blob.arrayBuffer())});pg++;
    if(pg>400)break;
  }
  const pdf=pdfFromJpegs(pages);
  if(await downloadBlob(pdf,safeName(`รายงานทำบุญ-${t.p}${single?'-'+t.c:''}`)+'.pdf'))toast(`สร้าง PDF ${pages.length} หน้าแล้ว`,3500);
}
/* ---------- import from the old single-page version ---------- */
let impData=null;
async function readImport(file){
  impData=null;document.getElementById('imp-go').disabled=true;if(!file)return;
  try{const d=JSON.parse(await file.text());if(!Array.isArray(d.campaigns))throw new Error('format');if(d.format==='wat-tambun-backup'){const by=new Map();(d.donations||[]).forEach(x=>{if(!by.has(x.campaignId))by.set(x.campaignId,[]);by.get(x.campaignId).push(x)});d.campaigns.forEach(c=>c.donors=by.get(c.id)||[])}impData=d;previewImport()}
  catch(e){document.getElementById('imp-preview').textContent='อ่านไฟล์ไม่ได้ ตรวจว่าเป็นไฟล์ ข้อมูลจากระบบเดิม.json'}
}
function previewImport(){
  if(!impData)return;const skip=document.getElementById('imp-skipex').checked;
  const camps=impData.campaigns.filter(c=>!(skip&&c.example)),dn=camps.reduce((a,c)=>a+(c.donors||[]).length,0);
  document.getElementById('imp-preview').innerHTML=(impData.format==='wat-tambun-backup'?`ไฟล์สำรองเมื่อ ${new Date(impData.exportedAt).toLocaleString('th-TH')} · ${(impData.receipts||[]).length} คำขอใบอนุโมทนา · `:'')+`พบ ${camps.length} งานบุญ · ${dn} รายชื่อ · ${(impData.accounts||[]).length} บัญชี${skip?` (ข้ามงานตัวอย่าง ${impData.campaigns.length-camps.length} งาน)`:''}`;
  document.getElementById('imp-go').disabled=!camps.length&&!(impData.accounts||[]).length;
}
async function doImport(){
  if(!impData||!isAdmin())return;const skip=document.getElementById('imp-skipex').checked,d=impData;
  const camps=d.campaigns.filter(c=>!(skip&&c.example));
  const ops=[];
  ops.push([doc(db,'settings','temple'),{name:d.temple?.name||S.temple.name,place:d.temple?.place||'',types:cleanTypes([...(d.types||[]),...S.types])},true]);
  (d.accounts||[]).forEach(a=>ops.push([doc(db,'accounts',a.id),{label:a.label||'',bank:a.bank||'',name:a.name||'',no:a.no||'',promptpay:a.promptpay||'',isDefault:!!a.isDefault}]));
  camps.forEach(c=>ops.push([doc(db,'campaigns',c.id),{type:c.type||'ทั่วไป',title:c.title||'',desc:c.desc||'',year:Number(c.year)||campYear(c),goal:Number(c.goal)||0,date:c.date||'',acctIds:c.acctIds||[],hideAmt:!!c.hideAmt,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}]));
  camps.forEach(c=>(c.donors||[]).forEach(x=>{const amt=Math.round(Number(x.amount)||0);if(!x.name||amt<=0)return;
    const extra={};if(typeof x.nameImg==='string'&&x.nameImg.startsWith('data:image/png'))extra.nameImg=x.nameImg;if(PAY[x.method])extra.method=x.method;if(x.createdByName)extra.createdByName=String(x.createdByName).slice(0,120);if(['staff','slip','import'].includes(x.source))extra.source=x.source;else extra.source='import';
    ops.push([doc(db,'donations',String(x.k||uid()).replace(/[^\w-]/g,'')),{campaignId:c.id,name:String(x.name).slice(0,200),amount:amt,date:/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')?x.date:today(),note:String(x.note||'').slice(0,500),wantReceipt:!!x.wantReceipt,receiptSent:!!x.receiptSent,...extra,createdAt:serverTimestamp(),createdBy:user.uid}])}));
  if(d.format==='wat-tambun-backup'){
    const t=d.temple||{};ops[0][1]={...ops[0][1],address:t.address||'',phone:t.phone||'',line:t.line||'',facebook:t.facebook||'',footerNote:t.footerNote||'',signer:t.signer||'',signerTitle:t.signerTitle||''};
    const ids=new Set(camps.map(c=>c.id));
    (d.receipts||[]).filter(r=>ids.has(r.campaignId)).forEach(r=>{const {id,createdAt,issuedAt,...rest}=r;ops.push([doc(db,'receipts',id),{...rest,createdAt:serverTimestamp(),createdBy:user.uid}])});
    (d.closings||[]).forEach(c=>{const {id,at,...rest}=c;ops.push([doc(db,'closings',id),{...rest,at:serverTimestamp()}])});
    (d.slips||[]).filter(x=>x.img&&ids.has(x.campaignId)).forEach(x=>{const {id,createdAt,checkedAt,...rest}=x;ops.push([doc(db,'slips',id),{...rest,createdAt:serverTimestamp()}])});
  }
  ops.push([doc(db,'logs','l'+uid()),logData('restore','data','',`นำเข้าข้อมูล ${camps.length} งานบุญ ${camps.reduce((a,c)=>a+(c.donors||[]).length,0)} รายชื่อ${d.format==='wat-tambun-backup'?' จากไฟล์สำรอง':' จากระบบเดิม'}`)]);
  const btn=document.getElementById('imp-go');btn.disabled=true;
  const ok=await run(async()=>{for(let i=0;i<ops.length;i+=400){const b=writeBatch(db);ops.slice(i,i+400).forEach(([ref,data,merge])=>b.set(ref,data,merge?{merge:true}:{}));await b.commit();btn.textContent=`กำลังนำเข้า ${Math.min(i+400,ops.length)}/${ops.length}`}},`นำเข้าข้อมูลแล้ว ${camps.length} งานบุญ`);
  btn.textContent='นำเข้าข้อมูล';if(ok){impData=null;ui={};go('home')}else btn.disabled=false;
}

/* ---------- snapshot image of a campaign's total right now ---------- */
const TYPEC=[['#ff7a18','#ff3d77'],['#ff4f9a','#a855f7'],['#2f7cf6','#06b6d4'],['#10b981','#65a30d'],['#f59e0b','#f97316'],['#8b5cf6','#6366f1'],['#0ea5e9','#16a34a']];
const FONT=(w,px)=>`${w} ${px}px "Noto Sans Thai", "Sarabun", sans-serif`;
function segs(t){try{return [...new Intl.Segmenter('th',{granularity:'word'}).segment(t)].map(x=>x.segment)}catch(e){return [...t]}}
function wrapText(ctx,text,maxW,maxLines){const out=[];let line='',cut=false;for(const w of segs(text)){const t=line+w;if(ctx.measureText(t).width>maxW&&line){if(out.length===maxLines-1){cut=true;break}out.push(line);line=w.trimStart()}else line=t}out.push(line);if(cut){let l=out[out.length-1];while(l&&ctx.measureText(l+'…').width>maxW)l=l.slice(0,-1);out[out.length-1]=l+'…'}return out}
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
async function drawSnap(c){
  try{await Promise.all([400,600,700,800].map(w=>document.fonts.load(FONT(w,40))))}catch(e){}
  const W=1080,H=1350,L=80,CW=W-160,cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
  const OR='#ffffff',MUT='rgba(255,255,255,.82)';
  const TC=TYPEC[tidx(c.type)];let g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,TC[0]);g.addColorStop(1,TC[1]);x.fillStyle=g;x.fillRect(0,0,W,H);
  x.fillStyle='rgba(255,255,255,.12)';x.beginPath();x.arc(W-60,80,260,0,Math.PI*2);x.fill();x.strokeStyle='rgba(255,255,255,.1)';x.lineWidth=60;x.beginPath();x.arc(60,H-260,220,0,Math.PI*2);x.stroke();
    x.textBaseline='alphabetic';x.textAlign='left';
  // header
  const hasLogo=await drawLogo(x,L+36,106,40);if(!hasLogo){rr(x,L,70,72,72,20);x.fillStyle='rgba(255,255,255,.25)';x.fill();}

  x.fillStyle='#fff';x.font=FONT(700,38);x.fillText(wrapText(x,S.temple.name||'',CW-110,1)[0],L+96,102);
  x.fillStyle=MUT;x.font=FONT(500,26);x.fillText('ขอเชิญร่วมทำบุญ',L+96,138);
  // type pill + title
  let y=230;x.font=FONT(700,28);const tt=`${c.type} · ปี ${campYear(c)}`,tw=x.measureText(tt).width+44;rr(x,L,y-36,tw,50,25);x.fillStyle='rgba(255,255,255,.25)';x.fill();x.fillStyle='#fff';x.fillText(tt,L+22,y);
  y+=86;x.font=FONT(700,66);x.fillStyle='#fff';const tl=wrapText(x,c.title,CW,2);tl.forEach((l,i)=>x.fillText(l,L,y+i*80));y+=(tl.length-1)*80;
  // total
  const now=new Date(),dTxt=now.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}),hTxt=now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  const showAmt=!c.hideAmt||isStaff(),s=stats(c).total,pct=c.goal?Math.min(100,s/c.goal*100):0;
  y+=78;x.fillStyle=MUT;x.font=FONT(600,28);x.fillText(`ยอดทำบุญ ณ ${dTxt} · ${hTxt} น.`,L,y);
  y+=150;x.fillStyle='#fff';x.font=FONT(800,156);const bigTxt=showAmt?baht(s):num(stats(c).n);x.fillText(bigTxt,L-6,y);
  if(!showAmt){const bw=x.measureText(bigTxt).width;x.fillStyle=MUT;x.font=FONT(600,40);x.fillText('ผู้ร่วมบุญ',L+bw+20,y)}
  if(c.goal&&showAmt){y+=50;rr(x,L,y,CW,22,11);x.fillStyle='rgba(255,255,255,.25)';x.fill();
    if(pct>0){const bw=Math.max(22,CW*pct/100),bg=x.createLinearGradient(L,0,L+bw,0);bg.addColorStop(0,'#fff');bg.addColorStop(1,'#fff');rr(x,L,y,bw,22,11);x.fillStyle=bg;x.fill()}
    y+=66;x.fillStyle='#fff';x.font=FONT(700,32);x.fillText(`${Math.round(pct)}%`,L,y);x.fillStyle=MUT;x.font=FONT(500,30);x.fillText(`ของเป้าหมาย ${baht(c.goal)}`,L+x.measureText(`${Math.round(pct)}%  `).width+20,y)}
  // stats
  const stats=[];if(showAmt)stats.push(['+'+baht(stats(c).today),'วันนี้','#fff']);stats.push([num(stats(c).n),'ผู้ร่วมบุญ','#fff']);if(c.date)stats.push([thDate(c.date),'วันงาน','#fff']);
  y+=50;const gap=14,bw=(CW-gap*(stats.length-1))/stats.length;
  stats.forEach((st,i)=>{const bx=L+i*(bw+gap);rr(x,bx,y,bw,124,22);x.fillStyle='rgba(255,255,255,.18)';x.fill();x.strokeStyle='rgba(255,255,255,.25)';x.lineWidth=1.5;x.stroke();
    x.fillStyle=st[2];x.font=FONT(800,st[0].length>9?36:46);x.fillText(wrapText(x,st[0],bw-40,1)[0],bx+22,y+66);x.fillStyle=MUT;x.font=FONT(500,24);x.fillText(st[1],bx+22,y+104)});
  // bank cards
  const accs=accountsFor(c).slice(0,2),cardH=accs.length>1?150:190,by0=H-150-cardH;
  if(accs.length){x.fillStyle=MUT;x.font=FONT(600,26);x.fillText('ร่วมทำบุญได้ที่',L,by0-22);
    const cw2=accs.length>1?(CW-gap)/2:CW;
    accs.forEach((a,i)=>{const bx=L+i*(cw2+gap);const gg=x.createLinearGradient(bx,by0,bx+cw2,by0+cardH);gg.addColorStop(0,i?'#2a2d40':'#1d2030');gg.addColorStop(1,i?'#3a2c52':'#33364a');
      rr(x,bx,by0,cw2,cardH,26);x.fillStyle=gg;x.fill();
      x.fillStyle='rgba(255,255,255,.85)';x.font=FONT(600,24);x.fillText(wrapText(x,a.bank||acctTitle(a),cw2-48,1)[0],bx+26,by0+44);
      x.fillStyle='#fff';x.font=FONT(800,accs.length>1?38:56);x.fillText(wrapText(x,a.no||('พร้อมเพย์ '+a.promptpay),cw2-48,1)[0],bx+26,by0+(accs.length>1?96:116));
      x.fillStyle='rgba(255,255,255,.85)';x.font=FONT(500,accs.length>1?20:26);x.fillText(wrapText(x,(a.name||'')+(a.no&&a.promptpay?` · พร้อมเพย์ ${a.promptpay}`:''),cw2-48,1)[0],bx+26,by0+cardH-26)});}
  // footer
  x.fillStyle=OR;x.font=FONT(700,40);x.fillText('ขออนุโมทนาบุญ',L,H-70);
  x.textAlign='right';x.fillStyle=MUT;x.font=FONT(500,24);x.fillText(`${num(stats(c).n)} รายการ`,W-L,H-74);
  return cv;
}
async function openSnap(c){
  if(!c)return;toast('กำลังสร้างภาพ…');
  const cv=await drawSnap(c);const url=cv.toDataURL('image/png');
  const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
  const fname=safeName('ยอดทำบุญ-'+c.title)+'-'+stamp()+'.png';
  const file=typeof File!=='undefined'?new File([blob],fname,{type:'image/png'}):null;
  let canShare=false;try{canShare=!!(file&&navigator.canShare&&navigator.canShare({files:[file]}))}catch(e){}
  const ov=sheet(`<img class="full" alt="ภาพสรุปยอดทำบุญ ${esc(c.title)}" src="${url}"><div class="row">${canShare?`<button class="btn primary" id="snap-share">${ic('share',17)} ส่งต่อ</button>`:''}<button class="btn ${canShare?'':'primary'}" id="snap-save">${ic('download',17)} บันทึกภาพ</button><span class="spacer"></span><button class="btn ghost" data-close>ปิด</button></div><p class="note">หรือกดค้างที่ภาพ (มือถือ) แล้วเลือกบันทึกรูป</p>`);
  toast('สร้างภาพแล้ว');
  ov.querySelector('#snap-save').onclick=async()=>{if(await downloadBlob(blob,fname))toast('บันทึกภาพแล้ว')};
  const sh=ov.querySelector('#snap-share');if(sh)sh.onclick=async()=>{try{await navigator.share({files:[file],title:c.title})}catch(e){}};
}


/* =====================================================================
   v4 additions: audit log, edit, payment method + daily closing, backup,
   slip duplicate check, big-screen mode, keepsake certificate, search, install
   ===================================================================== */
const PAY={cash:'เงินสด',transfer:'โอนเข้าบัญชี',qr:'สแกน QR'};
const payPill=m=>m?`<span class="pill pay-${m}">${PAY[m]||m}</span>`:'';
const logData=(action,target,id,summary,detail)=>({action,target,targetId:id||'',summary:String(summary||'').slice(0,500),detail:detail?JSON.stringify(detail).slice(0,4000):'',by:user?.uid||'',byName:user?.displayName||user?.email||'',at:serverTimestamp()});
const addLog=(w,...a)=>w.set(doc(db,'logs','l'+uid()),logData(...a));
const ACT={create:['เพิ่ม','ok'],update:['แก้ไข','info'],delete:['ลบ','bad'],approve:['ยืนยันสลิป','ok'],reject:['ปฏิเสธสลิป','bad'],issue:['ออกใบ','ok'],close:['ปิดยอด','info'],settings:['ตั้งค่า','info'],restore:['กู้ข้อมูล','wait'],backup:['สำรองข้อมูล','info']};
const TGT={donation:'รายการทำบุญ',campaign:'งานบุญ',account:'บัญชี',slip:'สลิป',receipt:'ใบอนุโมทนา',settings:'ตั้งค่า',role:'เจ้าหน้าที่',closing:'ปิดยอด',data:'ข้อมูล'};
const donorSnap=d=>({name:d.name,amount:d.amount,date:d.date,method:d.method||'',note:d.note||'',wantReceipt:!!d.wantReceipt});

/* ---------- donor row actions (⋯) ---------- */
function donorMenu(k){
  const d=findDon(k);if(!d)return;const c=S.campaigns.find(x=>x.id===d.campaignId);
  const ov=sheet(`<div class="row"><h3>${d.nameImg?'ลายมือชื่อ':esc(d.name)}</h3><span class="spacer"></span><button class="iconbtn ghost sm" data-close aria-label="ปิด">${ic('x',18)}</button></div>
  ${d.nameImg?`<img class="hw" style="height:56px" src="${esc(d.nameImg)}" alt="ลายมือชื่อ">`:''}
  <dl class="kv"><dt>งานบุญ</dt><dd>${esc(c?.title||'-')}</dd><dt>วันที่</dt><dd>${thDateLong(d.date)}</dd><dt>จำนวน</dt><dd>${baht(d.amount)}</dd><dt>วิธีรับเงิน</dt><dd>${PAY[d.method]||'ไม่ระบุ'}</dd><dt>ผู้บันทึก</dt><dd>${esc(d.createdByName||(d.source==='slip'?'จากสลิป':'-'))}</dd>${d.editedAt?`<dt>แก้ไขล่าสุด</dt><dd>${new Date(tsMs(d.editedAt)).toLocaleString('th-TH')}</dd>`:''}</dl>
  <div class="menu-list">
    <button class="btn block" id="dm-cert">${ic('heart',17)} พิมพ์ใบอนุโมทนาบัตร (ที่ระลึก)</button>
    <button class="btn block" id="dm-hist">${ic('users',17)} ดูประวัติการทำบุญของท่านนี้</button>
    ${isAdmin()?`<button class="btn block" id="dm-edit">${ic('edit',17)} แก้ไขรายการ</button><button class="btn block danger" id="dm-del">${ic('trash',17)} ลบรายการ</button>`:''}
  </div>`);
  ov.querySelector('#dm-cert').onclick=()=>{ov.remove();openCert(d)};
  ov.querySelector('#dm-hist').onclick=()=>{ov.remove();ui={q:d.name,_keep:1};go('search')};
  const ed=ov.querySelector('#dm-edit');if(ed)ed.onclick=()=>{ov.remove();editDonation(d)};
  const del=ov.querySelector('#dm-del');if(del)del.onclick=()=>{
    if(!del.dataset.sure){del.dataset.sure='1';del.innerHTML=`${ic('trash',17)} กดอีกครั้งเพื่อยืนยันลบ`;del.classList.add('solid');return}
    ov.remove();run(async()=>{const w=writeBatch(db);w.delete(doc(db,'donations',d.k));if(S.receipts.some(r=>r.id===d.k))w.delete(doc(db,'receipts',d.k));
      addLog(w,'delete','donation',d.k,`ลบ ${d.name} ${baht(d.amount)} (${c?.title||''})`,{before:donorSnap(d)});await w.commit()},'ลบรายการแล้ว (บันทึกในประวัติแล้ว)')};
}
function editDonation(d){
  const ov=sheet(`<form class="form" id="f-edit"><div class="row"><h3>${ic('edit',20)} แก้ไขรายการ</h3><span class="spacer"></span><button type="button" class="iconbtn ghost sm" data-close aria-label="ปิด">${ic('x',18)}</button></div>
  <label class="f">ชื่อผู้ทำบุญ<textarea id="ed-name" class="autogrow nm" rows="1" required maxlength="200">${esc(d.name)}</textarea></label>
  <div class="grid2"><label class="f">จำนวนเงิน (บาท)<input id="ed-amt" inputmode="decimal" required value="${esc(d.amount)}"></label><label class="f">วันที่<input id="ed-date" type="date" value="${esc(d.date)}"></label></div>
  <label class="f">วิธีรับเงิน<select id="ed-pay">${Object.entries(PAY).map(([k,v])=>`<option value="${k}" ${d.method===k?'selected':''}>${v}</option>`).join('')}</select></label>
  <label class="f">หมายเหตุ<input id="ed-note" maxlength="500" value="${esc(d.note||'')}"></label>
  <label class="f">เหตุผลที่แก้ไข (บันทึกในประวัติ)<input id="ed-why" required placeholder="เช่น พิมพ์ยอดผิด"></label>
  <div class="row"><span class="spacer"></span><button type="button" class="btn ghost" data-close>ยกเลิก</button><button class="btn primary" type="submit">${ic('check',17)} บันทึก</button></div></form>`,'',true);
  growAll(ov);
  ov.querySelector('#f-edit').onsubmit=async e=>{e.preventDefault();const q=s=>ov.querySelector(s).value.trim();
    const after={name:q('#ed-name'),amount:parseAmt(q('#ed-amt')),date:q('#ed-date')||d.date,method:q('#ed-pay'),note:q('#ed-note')};
    if(!after.name||!after.amount){toast('กรุณาใส่ชื่อและจำนวนเงิน');return}
    const before=donorSnap(d),ch=Object.keys(after).filter(k=>String(after[k])!==String(before[k]??''));
    if(!ch.length){ov.remove();return}
    const ok=await run(async()=>{const w=writeBatch(db);w.update(doc(db,'donations',d.k),{...after,editedAt:serverTimestamp(),editedBy:user.uid});
      if(S.receipts.some(r=>r.id===d.k))w.update(doc(db,'receipts',d.k),{amount:after.amount,date:after.date,donorName:after.name});
      addLog(w,'update','donation',d.k,`แก้ไข ${before.name}: `+ch.map(k=>`${({name:'ชื่อ',amount:'ยอด',date:'วันที่',method:'วิธีรับเงิน',note:'หมายเหตุ'})[k]} ${k==='amount'?baht(before[k]):k==='method'?(PAY[before[k]]||'-'):before[k]||'-'} → ${k==='amount'?baht(after[k]):k==='method'?PAY[after[k]]:after[k]||'-'}`).join(', ')+` · เหตุผล: ${q('#ed-why')}`,{before,after,reason:q('#ed-why')});
      await w.commit()},'แก้ไขแล้ว');
    if(ok)ov.remove()};
}

/* ---------- admin: history ---------- */
function logsPage(){
  const f=ui.lf||(ui.lf={date:'',act:'all',q:''});
  const list=S.logs.filter(l=>(!f.date||ymd(new Date(tsMs(l.at)))===f.date)&&(f.act==='all'||l.action===f.act)&&(!f.q||(l.summary+' '+l.byName).toLowerCase().includes(f.q.toLowerCase()))).slice(0,300);
  return `<p class="note">ทุกการเพิ่ม แก้ไข และลบ จะถูกบันทึกไว้ที่นี่ แก้หรือลบประวัติไม่ได้ แม้แต่แอดมิน</p>
  <div class="card form"><div class="grid3"><label class="f">วันที่<input type="date" id="lf-date" value="${esc(f.date)}"></label>
  <label class="f">ประเภท<select id="lf-act"><option value="all">ทั้งหมด</option>${Object.entries(ACT).map(([k,[l]])=>`<option value="${k}" ${f.act===k?'selected':''}>${l}</option>`).join('')}</select></label>
  <label class="f">ค้นหา<input id="lf-q" value="${esc(f.q)}" placeholder="ชื่อ หรือ ผู้ทำรายการ"></label></div>
  <div class="row"><span class="note">${num(list.length)} รายการ${S.logs.length>=500?' (แสดงล่าสุด 500 รายการ)':''}</span><span class="spacer"></span>${list.length?`<button class="btn sm" id="lf-csv">${ic('download',15)} Excel</button>`:''}</div></div>
  <div class="dl">${list.length?list.map(l=>{const [al,cls]=ACT[l.action]||[l.action,'info'];return `<div class="dr log">${avatar(l.byName||'?')}<div class="dr-main"><span class="dr-sub"><span class="pill ${cls}">${al}${TGT[l.target]?' '+TGT[l.target]:''}</span><span>${new Date(tsMs(l.at)).toLocaleString('th-TH',{day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</span><span>โดย ${esc(l.byName||'-')}</span></span><span class="dr-name" style="font-weight:600">${esc(l.summary)}</span></div><span></span><span></span></div>`}).join(''):'<div class="empty">ยังไม่มีประวัติ</div>'}</div>`;
}

/* ---------- staff: daily closing (count the cash box) ---------- */
function closingPage(){
  const day=ui.cday||(ui.cday=today());
  if(!S.day||S.day.day!==day)return `<div class="row"><label class="f" style="max-width:220px">วันที่<input type="date" id="c-day" value="${esc(day)}"></label></div><div class="loading"><div class="sk"></div></div>`;
  const list=S.day.list;
  const people=new Map();
  list.forEach(d=>{const id=d.source==='slip'?'slip':(d.createdBy||'?');const p=people.get(id)||{id,name:d.source==='slip'?'สลิปจากผู้ทำบุญ (ออนไลน์)':(d.createdByName||'ไม่ทราบชื่อ'),cash:0,transfer:0,qr:0,none:0,n:0};p[d.method in PAY?d.method:'none']+=d.amount;p.n++;people.set(id,p)});
  if(user&&isStaff()&&!people.has(user.uid))people.set(user.uid,{id:user.uid,name:user.displayName||user.email,cash:0,transfer:0,qr:0,none:0,n:0});
  const tot=k=>[...people.values()].reduce((a,p)=>a+p[k],0);
  const byCamp=new Map();list.forEach(d=>{const c=S.campaigns.find(x=>x.id===d.campaignId);const v=byCamp.get(d.campaignId)||{t:c?.title||'-',s:0,n:0};v.s+=d.amount;v.n++;byCamp.set(d.campaignId,v)});
  return `<p class="note">เลือกวัน นับเงินสดที่แต่ละคนรับไว้ แล้วกรอกยอดที่นับได้ ระบบจะเทียบกับยอดที่บันทึกและเก็บผลไว้ในประวัติ</p>
  <div class="row"><label class="f" style="max-width:220px">วันที่<input type="date" id="c-day" value="${esc(day)}"></label><span class="spacer"></span>${isAdmin()&&list.length?`<button class="btn sm" id="c-csv">${ic('download',15)} Excel</button>`:''}</div>
  <div class="preview"><div><b>${baht(tot('cash'))}</b><span>${PAY.cash}</span></div><div><b>${baht(tot('transfer'))}</b><span>${PAY.transfer}</span></div><div><b>${baht(tot('qr'))}</b><span>${PAY.qr}</span></div>${tot('none')?`<div><b>${baht(tot('none'))}</b><span>ไม่ระบุวิธี</span></div>`:''}<div><b>${num(list.length)}</b><span>รายการ</span></div></div>
  <div class="list">${[...people.values()].map(p=>{const cl=S.closings.find(x=>x.id===`${day}_${p.id}`),mine=user&&p.id===user.uid,can=p.id!=='slip'&&(mine||isAdmin());
    const st=cl?(cl.diff===0?'<span class="pill ok">ปิดยอดแล้ว · ตรงกัน</span>':cl.diff<0?`<span class="pill bad">ปิดยอดแล้ว · ขาด ${baht(-cl.diff)}</span>`:`<span class="pill wait">ปิดยอดแล้ว · เกิน ${baht(cl.diff)}</span>`):p.id==='slip'?'':'<span class="pill wait">ยังไม่ปิดยอด</span>';
    return `<article class="card"><div class="row">${avatar(p.name)}<b>${esc(p.name)}</b>${mine?'<span class="pill info">คุณ</span>':''}<span class="spacer"></span>${st}</div>
    <div class="paygrid"><div><span>${PAY.cash}</span><b>${baht(p.cash)}</b></div><div><span>${PAY.transfer}</span><b>${baht(p.transfer)}</b></div><div><span>${PAY.qr}</span><b>${baht(p.qr)}</b></div><div><span>รายการ</span><b>${num(p.n)}</b></div></div>
    ${can?`<div class="row"><label class="f" style="max-width:200px">เงินสดที่นับได้จริง (บาท)<input id="cc-${p.id}" inputmode="decimal" value="${cl?esc(cl.counted):''}" placeholder="${num(p.cash)}"></label><label class="f" style="flex:1;min-width:160px">หมายเหตุ<input id="cn-${p.id}" value="${esc(cl?.note||'')}" placeholder="เช่น ฝากเข้าบัญชีแล้ว"></label><button class="btn primary" data-close-day="${p.id}" data-cash="${p.cash}" data-name="${esc(p.name)}" style="align-self:end">${ic('check',17)} ${cl?'ปิดยอดใหม่':'ปิดยอด'}</button></div>`:''}
    ${cl?`<p class="note">นับได้ ${baht(cl.counted)} · ระบบ ${baht(cl.systemCash)} · บันทึกโดย ${esc(cl.byName||'-')} เมื่อ ${new Date(tsMs(cl.at)).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} น.${cl.note?' · '+esc(cl.note):''}</p>`:''}</article>`}).join('')}</div>
  ${byCamp.size?`<div class="card"><h3>แยกตามงานบุญ</h3><dl class="kv">${[...byCamp.values()].map(v=>`<dt>${esc(v.t)}</dt><dd>${baht(v.s)} · ${v.n} รายการ</dd>`).join('')}</dl></div>`:''}`;
}
async function closeDay(pid,cash,name){
  const day=ui.cday,counted=Number(String(document.getElementById('cc-'+pid)?.value||'').replace(/[^\d.]/g,''));
  if(document.getElementById('cc-'+pid).value.trim()===''){toast('กรอกยอดเงินสดที่นับได้ก่อน');return}
  const note=(document.getElementById('cn-'+pid)?.value||'').trim(),diff=Math.round(counted-cash);
  await run(async()=>{const w=writeBatch(db);w.set(doc(db,'closings',`${day}_${pid}`),{date:day,uid:pid,name,systemCash:cash,counted,diff,note,by:user.uid,byName:user.displayName||user.email,at:serverTimestamp()});
    addLog(w,'close','closing',`${day}_${pid}`,`ปิดยอด ${thDate(day)} ของ ${name}: ระบบ ${baht(cash)} นับได้ ${baht(counted)} ${diff===0?'(ตรงกัน)':diff<0?`(ขาด ${baht(-diff)})`:`(เกิน ${baht(diff)})`}`);await w.commit()},diff===0?'ปิดยอดแล้ว ยอดตรงกัน':'ปิดยอดแล้ว ยอดไม่ตรง บันทึกไว้ในประวัติ');
}

/* ---------- staff: search donors ---------- */
const normName=s=>String(s||'').replace(/^(คุณ|นาย|นางสาว|นาง)\s*/,'').replace(/\s+/g,' ').trim().toLowerCase();
function searchPage(){
  return `<div class="card form"><label class="f">พิมพ์ชื่อผู้ทำบุญ<input id="s-q" value="${esc(ui.q||'')}" placeholder="เช่น สมชาย" autocomplete="off"></label><p class="note">ค้นได้ทุกปีทุกงานบุญ</p></div><div id="s-res">${searchResults()}</div>`;
}
function searchResults(){
  const q=ui.q||'';const nq=normName(q);
  if(!S.allDon&&nq)return '<div class="card empty">กำลังโหลดรายชื่อทั้งหมด…</div>';
  const groups=new Map();
  if(nq.length>=1)S.donations.forEach(d=>{const n=normName(d.name);if(!n.includes(nq))return;const g=groups.get(n)||{name:d.name,list:[],s:0};g.list.push(d);g.s+=d.amount;groups.set(n,g)});
  const res=[...groups.values()].sort((a,b)=>b.list.length-a.list.length).slice(0,60);
  return `${nq?`<p class="note">พบ ${res.length} ชื่อ</p><div class="list">${res.map(g=>`<article class="card"><div class="row">${avatar(g.name)}<b style="font-size:1.05rem">${esc(g.name)}</b><span class="spacer"></span><span class="pill info">${g.list.length} ครั้ง</span><b class="num">${baht(g.s)}</b></div>
   <div class="dl">${g.list.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(d=>{const c=S.campaigns.find(x=>x.id===d.campaignId);return `<div class="dr"><span class="avatar ${gcls(c?.type)}" style="width:30px;height:30px;font-size:.75rem">${c?campYear(c)%100:''}</span><div class="dr-main"><span class="dr-name" style="font-weight:600">${esc(c?.title||'-')}</span><span class="dr-sub"><span>${thDate(d.date)}</span>${payPill(d.method)}${d.wantReceipt?'<span class="pill info">ขอใบ</span>':''}</span></div><div class="dr-amt">${baht(d.amount)}</div><span></span></div>`}).join('')}</div></article>`).join('')||'<div class="card empty">ไม่พบชื่อนี้</div>'}</div>`:''}`;
}
let nameList=null,nameListAt=0;
function countNames(list){const m=new Map();list.forEach(d=>{if(d.nameImg||!d.name||d.name===ANON)return;const n=d.name.trim();m.set(n,(m.get(n)||0)+1)});return m}
function cacheNames(){const m=countNames(S.allDon||[]);LS.set('wat-names',{at:Date.now(),list:[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,1500).map(x=>x[0])});nameList=null}
function names(){if(nameList&&Date.now()-nameListAt<30000)return nameList;const m=countNames(S.donations);const cached=LS.get('wat-names',{}).list||[];cached.forEach((n,i)=>{if(!m.has(n))m.set(n,0.5-i/1e5)});nameList=[ANON,...[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,1200).map(x=>x[0])];nameListAt=Date.now();return nameList}

/* ---------- big screen (TV / projector) mode ---------- */
let tvSeen=null;
function tvHTML(c){
  return `<div class="tv ${gcls(c.type)}" id="tv"><div class="tv-blobs"><i></i><i></i><i></i></div>
  <header class="tv-top">${logoEl()}<div><b>${esc(S.temple.name)}</b><span id="tv-clock"></span></div><span class="spacer"></span><button class="tv-btn" id="tv-full">${ic('eye',18)} เต็มจอ</button><button class="tv-btn" id="tv-exit">${ic('x',18)} ออก</button></header>
  <main class="tv-main"><section class="tv-left"><span class="tv-tag">${esc(c.type)} · ปี พ.ศ. ${campYear(c)}</span><h1>${esc(c.title)}</h1><div id="tv-num"></div></section>
  <aside class="tv-right" id="tv-qr"></aside></main>
  <section class="tv-feed"><h2>${ic('heart',22)} ขออนุโมทนาบุญ</h2><div id="tv-list" class="tv-list"></div></section>
  <div id="tv-pop" class="tv-pop" hidden></div><canvas id="tv-fx" class="tv-fx"></canvas></div>`;
}
function tvUpdate(c,first){
  const hide=c.hideAmt,s=stats(c).total,pct=c.goal?Math.min(100,s/c.goal*100):0,R=120,C=2*Math.PI*R;
  const n=document.getElementById('tv-num');if(!n)return;
  n.innerHTML=`<div class="tv-total">${hide?cnt('tvp-'+c.id,stats(c).n,'int'):cnt('tva-'+c.id,s,'baht')}</div><div class="tv-sub">${hide?'รายการผู้ร่วมบุญ':`ร่วมบุญแล้ว ${num(stats(c).n)} รายการ${c.goal?` · เป้าหมาย ${baht(c.goal)}`:''}`}</div>
  ${c.goal&&!hide?`<div class="tv-ring"><svg viewBox="0 0 280 280"><circle cx="140" cy="140" r="${R}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="22"/><circle cx="140" cy="140" r="${R}" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct/100)}" style="transition:stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)"/></svg><b>${cnt('tvr-'+c.id,pct,'pct')}</b></div>`:''}`;
  const latest=[...c.donors].sort((a,b)=>tsMs(b.createdAt)-tsMs(a.createdAt)).slice(0,8);
  document.getElementById('tv-list').innerHTML=latest.map((d,i)=>`<div class="tv-item${tvSeen&&!tvSeen.has(d.k)?' new':''}" style="--i:${i}">${d.nameImg?`<img src="${esc(d.nameImg)}" alt="ลายมือชื่อ">`:`<b>${esc(d.name)}</b>`}${hide?'':`<span>${baht(d.amount)}</span>`}</div>`).join('')||'<div class="tv-item"><b>ขอเชิญร่วมเป็นเจ้าภาพท่านแรก</b></div>';
  const fresh=tvSeen&&c.ready?c.donors.filter(d=>!tvSeen.has(d.k)):[];if(c.ready)tvSeen=new Set(c.donors.map(d=>d.k));
  countUp(n);
  if(fresh.length&&!first){const d=fresh.sort((a,b)=>b.amount-a.amount)[0];const p=document.getElementById('tv-pop');
    p.innerHTML=`<span>ขออนุโมทนาบุญ</span>${d.nameImg?`<img src="${esc(d.nameImg)}" alt="">`:`<b>${esc(d.name)}</b>`}${hide?'':`<em>${baht(d.amount)}</em>`}${fresh.length>1?`<small>และอีก ${fresh.length-1} ท่าน</small>`:''}<small class="tv-bless">${esc(bless('tv'))}</small>`;
    p.hidden=false;p.classList.remove('show');void p.offsetWidth;p.classList.add('show');clearTimeout(p.t);p.t=setTimeout(()=>{p.hidden=true},5200);confetti()}
}
async function tvQR(c){
  const box=document.getElementById('tv-qr');if(!box)return;const a=accountsFor(c).find(x=>x.promptpay)||null;
  if(!a){const b=accountsFor(c).find(x=>x.no);box.innerHTML=b?`<div class="tv-card"><span>โอนเข้าบัญชี</span><b>${esc(b.bank)}</b><strong>${esc(b.no)}</strong><small>${esc(b.name||'')}</small></div>`:'';return}
  box.innerHTML=`<div class="tv-card"><span>สแกนร่วมทำบุญ</span><canvas id="tvq" width="300" height="300"></canvas><b>พร้อมเพย์ ${esc(a.promptpay)}</b><small>${esc(a.name||'')}</small></div>`;
  try{await loadScript(QR_URLS);const q=window.qrcode(0,'M');q.addData(promptpayPayload(a.promptpay,0));q.make();const cv=document.getElementById('tvq'),x=cv.getContext('2d'),nn=q.getModuleCount(),cell=Math.floor(cv.width/(nn+2)),off=Math.floor((cv.width-cell*nn)/2);x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);x.fillStyle='#171927';for(let r=0;r<nn;r++)for(let k=0;k<nn;k++)if(q.isDark(r,k))x.fillRect(off+k*cell,off+r*cell,cell,cell)}catch(e){box.querySelector('canvas')?.remove()}
}
let tvClock=null,wakeLock=null;
function tvStart(c){
  tvSeen=null;tvUpdate(c,true);if(c.ready)tvSeen=new Set(c.donors.map(d=>d.k));tvQR(c);
  const tick=()=>{const el=document.getElementById('tv-clock');if(!el){clearInterval(tvClock);return}const d=new Date();el.textContent=d.toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' · '+d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})+' น.'};
  clearInterval(tvClock);tick();tvClock=setInterval(tick,15000);
  document.getElementById('tv-full').onclick=()=>{const el=document.documentElement;(el.requestFullscreen?el.requestFullscreen():Promise.reject()).catch(()=>toast('เครื่องนี้เปิดเต็มจอไม่ได้ กด F11 แทน'))};
  document.getElementById('tv-exit').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();go(c.id)};
  try{navigator.wakeLock?.request('screen').then(l=>wakeLock=l).catch(()=>{})}catch(e){}
}
function confetti(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const cv=document.getElementById('tv-fx');if(!cv)return;const x=cv.getContext('2d');cv.width=innerWidth;cv.height=innerHeight;
  const cols=['#ffb300','#ff3d77','#7c4dff','#12b5a6','#2f7cf6','#ffffff'];
  const ps=Array.from({length:160},()=>({x:cv.width/2+(Math.random()-.5)*200,y:cv.height*.45,vx:(Math.random()-.5)*16,vy:-Math.random()*16-4,s:Math.random()*8+5,r:Math.random()*6,c:cols[Math.random()*cols.length|0]}));
  const t0=performance.now();const step=t=>{const k=(t-t0)/1000;x.clearRect(0,0,cv.width,cv.height);ps.forEach(p=>{p.vy+=.45;p.x+=p.vx;p.y+=p.vy;p.r+=.1;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.globalAlpha=Math.max(0,1-k/2.6);x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);x.restore()});if(k<2.6)requestAnimationFrame(step);else x.clearRect(0,0,cv.width,cv.height)};requestAnimationFrame(step);
}

/* ---------- keepsake certificate (ใบอนุโมทนาบัตร ที่ระลึก) ---------- */
function bahtText(n){
  n=Math.round(Number(n)||0);if(!n)return'ศูนย์บาทถ้วน';
  const D=['','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'],P=['','สิบ','ร้อย','พัน','หมื่น','แสน'];
  const six=s=>{let o='';const L=s.length;for(let i=0;i<L;i++){const d=+s[i],p=L-i-1;if(!d)continue;if(p===1&&d===1)o+='สิบ';else if(p===1&&d===2)o+='ยี่สิบ';else if(p===0&&d===1&&L>1)o+='เอ็ด';else o+=D[d]+P[p]}return o};
  let s=String(n);const parts=[];while(s.length>6){parts.unshift(s.slice(-6));s=s.slice(0,-6)}parts.unshift(s);
  return parts.map((p,i)=>six(String(+p))+(i<parts.length-1?'ล้าน':'')).join('')+'บาทถ้วน';
}
async function drawCert(d){
  const c=S.campaigns.find(x=>x.id===d.campaignId)||{title:'',type:''};
  try{await Promise.all([400,600,700,800].map(w=>document.fonts.load(FONT(w,40))))}catch(e){}
  const W=1754,H=1240,cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');const TC=TYPEC[tidx(c.type)];
  x.fillStyle='#fffdf8';x.fillRect(0,0,W,H);
  let g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,TC[0]);g.addColorStop(1,TC[1]);
  x.strokeStyle=g;x.lineWidth=26;x.strokeRect(40,40,W-80,H-80);x.lineWidth=3;x.strokeRect(78,78,W-156,H-156);
  [[78,78],[W-78,78],[78,H-78],[W-78,H-78]].forEach(([cx,cy])=>{x.fillStyle=g;x.beginPath();x.arc(cx,cy,22,0,Math.PI*2);x.fill()});
  x.save();x.globalAlpha=.06;x.strokeStyle=TC[1];x.lineWidth=26;x.beginPath();x.arc(W/2,H/2+40,330,0,Math.PI*2);x.stroke();for(let k=0;k<8;k++){const a=k*Math.PI/4;x.beginPath();x.moveTo(W/2+Math.cos(a)*70,H/2+40+Math.sin(a)*70);x.lineTo(W/2+Math.cos(a)*330,H/2+40+Math.sin(a)*330);x.stroke()}x.restore();
  x.textAlign='center';x.textBaseline='alphabetic';
  if(!await drawLogo(x,W/2,182,70)){x.fillStyle=g;x.beginPath();x.arc(W/2,190,54,0,Math.PI*2);x.fill()}
  x.fillStyle='#171927';x.font=FONT(700,40);x.fillText(wrapText(x,S.temple.name||'',1300,1)[0],W/2,300);
  x.fillStyle=g;x.font=FONT(800,96);x.fillText('ใบอนุโมทนาบัตร',W/2,408);
  x.fillStyle='#a87920';x.font=FONT(500,26);x.fillText(bless('pali'),W/2,470);
  x.fillStyle='#454a63';x.font=FONT(500,34);x.fillText('ขออนุโมทนาบุญแด่',W/2,522);
  let y=606;
  if(d.nameImg){const im=await loadImg(d.nameImg);if(im){const h=110,w=Math.min(1100,im.width*h/im.height);x.drawImage(im,W/2-w/2,y-95,w,h)}}
  else{x.fillStyle='#171927';x.font=FONT(800,72);x.fillText(wrapText(x,d.name,1350,1)[0],W/2,y)}
  x.strokeStyle='#d8dae6';x.lineWidth=2;x.beginPath();x.moveTo(W/2-520,y+30);x.lineTo(W/2+520,y+30);x.stroke();
  y+=86;x.fillStyle='#454a63';x.font=FONT(500,32);x.fillText('ที่ได้ร่วมทำบุญ',W/2,y);
  y+=54;x.fillStyle='#171927';x.font=FONT(700,44);wrapText(x,c.title,1350,2).forEach((l,i)=>x.fillText(l,W/2,y+i*56));y+=(wrapText(x,c.title,1350,2).length-1)*56;
  y+=62;x.font=FONT(700,38);x.fillText(`เป็นจำนวนเงิน ${num(d.amount)} บาท (${bahtText(d.amount)})`,W/2,y);
  y+=52;x.fillStyle='#454a63';x.font=FONT(500,27);wrapText(x,bless('cert'),1480,3).forEach((l,i)=>x.fillText(l,W/2,y+i*38));
  const sy=H-230;x.textAlign='center';
  x.fillStyle='#454a63';x.font=FONT(500,28);x.fillText(`ให้ไว้ ณ วันที่ ${thDateLong(d.date)}`,430,sy+20);
  x.strokeStyle='#9aa0b8';x.lineWidth=2;x.beginPath();x.moveTo(W-680,sy);x.lineTo(W-220,sy);x.stroke();
  x.fillStyle='#171927';x.font=FONT(700,30);x.fillText(S.temple.signer?`(${S.temple.signer})`:'(.......................................)',W-450,sy+44);
  x.fillStyle='#454a63';x.font=FONT(500,26);x.fillText(S.temple.signerTitle||'เจ้าอาวาส',W-450,sy+84);
  x.fillStyle='#9aa0b8';x.font=FONT(400,20);x.fillText(`เลขที่ ${String(d.k).slice(-8).toUpperCase()} · ใบอนุโมทนาบัตรนี้มอบเป็นที่ระลึก มิใช่หลักฐานการลดหย่อนภาษี`,W/2,H-108);
  return cv;
}
async function openCert(d){
  toast('กำลังสร้างใบอนุโมทนาบัตร…');const cv=await drawCert(d);const url=cv.toDataURL('image/png');
  const ov=sheet(`<img class="full" src="${url}" alt="ใบอนุโมทนาบัตรของ ${esc(d.name)}"><div class="row"><button class="btn primary" id="ct-pdf">${ic('download',17)} PDF (A5)</button><button class="btn" id="ct-png">${ic('image',17)} รูปภาพ</button><span class="spacer"></span><button class="btn ghost" data-close>ปิด</button></div><p class="note">ตั้งชื่อผู้ลงนามได้ที่เมนูตั้งค่าวัด</p>`,'wide');
  const nm=safeName('ใบอนุโมทนาบัตร-'+d.name);
  ov.querySelector('#ct-png').onclick=async()=>{const b=await new Promise(r=>cv.toBlob(r,'image/png'));if(await downloadBlob(b,nm+'.png'))toast('บันทึกแล้ว')};
  ov.querySelector('#ct-pdf').onclick=async()=>{const b=await new Promise(r=>cv.toBlob(r,'image/jpeg',.9));const pdf=pdfFromJpegs([{w:cv.width,h:cv.height,bytes:new Uint8Array(await b.arrayBuffer())}],[595.28,419.53]);if(await downloadBlob(pdf,nm+'.pdf'))toast('บันทึกแล้ว')};
}
async function makeCerts(v){
  const rows=reportRows(v).slice(0,300);if(!rows.length){toast('ไม่มีรายการในช่วงนี้');return}
  toast(`กำลังสร้าง ${rows.length} ใบ…`,9000);const pages=[];
  for(const {d} of rows){const cv=await drawCert(d);const b=await new Promise(r=>cv.toBlob(r,'image/jpeg',.85));pages.push({w:cv.width,h:cv.height,bytes:new Uint8Array(await b.arrayBuffer())})}
  const t=reportTitle(v);if(await downloadBlob(pdfFromJpegs(pages,[595.28,419.53]),safeName('ใบอนุโมทนาบัตร-'+t.p)+'.pdf'))toast(`สร้างใบอนุโมทนาบัตร ${pages.length} ใบแล้ว`,3500);
}

/* ---------- backup ---------- */
async function makeBackup(withSlipImg){
  toast('กำลังรวบรวมข้อมูลทั้งหมด…',8000);
  await loadAll(1);
  let slips=[],logs=S.logs;
  try{const [a,b]=await Promise.all([getDocs(collection(db,'slips')),getDocs(collection(db,'logs'))]);slips=a.docs.map(d=>({id:d.id,...d.data()}));logs=b.docs.map(d=>({id:d.id,...d.data()}))}catch(e){console.warn(e);slips=S.slips}
  const rep=(k,v)=>{if(v&&typeof v==='object'&&!Array.isArray(v)){if(typeof v.toMillis==='function')return v.toMillis();if('seconds' in v&&'nanoseconds' in v)return v.seconds*1000+Math.round(v.nanoseconds/1e6);if('_ts' in v&&Object.keys(v).length<=2)return v._ts}return v};
  const data={format:'wat-tambun-backup',version:1,exportedAt:new Date().toISOString(),temple:S.temple,types:S.types,accounts:S.accounts,
    campaigns:S.campaigns.map(({donors,...c})=>c),donations:S.donations,receipts:S.receipts,slips:slips.map(s=>withSlipImg?s:{...s,img:''}),closings:S.closings,logs};
  const blob=new Blob([JSON.stringify(data,rep)],{type:'application/json'});
  if(await downloadBlob(blob,`สำรองข้อมูล-ระบบทำบุญ-${stamp()}.json`)){toast('สำรองข้อมูลแล้ว เก็บไฟล์ไว้ในที่ปลอดภัย',4000);
    run(async()=>{const w=writeBatch(db);w.set(doc(db,'settings','temple'),{lastBackupAt:serverTimestamp()},{merge:true});addLog(w,'backup','data','',`สำรองข้อมูล ${S.donations.length} รายการ`);await w.commit()})}
}

/* ---------- slip duplicate check ---------- */
function cyrb53(str){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0,ch;i<str.length;i++){ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677)}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (4294967296*(2097151&h2)+(h1>>>0)).toString(36)}
function checkDup(s){
  if(S.dup[s.id])return;S.dup[s.id]={wait:true};
  const sl=collection(db,'slips');
  Promise.all([s.imgHash?getDocs(query(sl,where('imgHash','==',s.imgHash),limit(5))):Promise.resolve({docs:[]}),
    getDocs(query(collection(db,'donations'),where('campaignId','==',s.campaignId),where('date','==',s.date),where('amount','==',s.amount),limit(3))),
    getDocs(query(sl,where('campaignId','==',s.campaignId),where('date','==',s.date),where('amount','==',s.amount),limit(5)))])
  .then(([a,b,c])=>{const m=q=>q.docs.map(d=>({id:d.id,k:d.id,...d.data()}));S.dup[s.id]={same:m(a).filter(o=>o.id!==s.id),near:m(b),nearS:m(c).filter(o=>o.id!==s.id&&o.status!=='rejected')};softRefresh()})
  .catch(e=>{console.warn('dup',e);S.dup[s.id]={same:[],near:[],nearS:[]}});
}
function dupInfo(s){
  const r=S.dup[s.id]||{};
  const same=r.same||S.slips.filter(o=>o.id!==s.id&&o.imgHash&&o.imgHash===s.imgHash);
  if(same.length)return `<span class="pill bad">${ic('eye',12)} รูปสลิปซ้ำกับของ ${esc(same[0].name)}</span>`;
  const near=r.near||S.donations.filter(d=>d.campaignId===s.campaignId&&d.date===s.date&&d.amount===s.amount&&d.k!==s.donationId);
  const nearS=r.nearS||S.slips.filter(o=>o.id!==s.id&&o.campaignId===s.campaignId&&o.date===s.date&&o.amount===s.amount&&o.status!=='rejected');
  if(near.length||nearS.length)return `<span class="pill wait">${ic('eye',12)} อาจซ้ำ: ยอด ${baht(s.amount)} วันเดียวกันกับ ${esc((near[0]||nearS[0]).name)}</span>`;
  return '';
}

/* ---------- install as an app ---------- */
let installEvt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;document.querySelectorAll('[data-install]').forEach(b=>b.hidden=false)});
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isStandalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
const canInstall=()=>!DEMO&&!isStandalone&&(installEvt||isIOS);
async function doInstall(){
  if(installEvt){installEvt.prompt();await installEvt.userChoice.catch(()=>{});installEvt=null;document.querySelectorAll('[data-install]').forEach(b=>b.hidden=true);return}
  sheet(`<h3>${ic('download',20)} ติดตั้งเป็นแอปบน iPhone / iPad</h3><ol class="steps"><li>กดปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ที่แถบล่างของ Safari</li><li>เลื่อนลงแล้วเลือก <b>เพิ่มไปยังหน้าจอโฮม</b></li><li>กด <b>เพิ่ม</b> จะได้ไอคอนวัดบนหน้าจอเหมือนแอปจริง</li></ol><button class="btn" data-close>เข้าใจแล้ว</button>`);
}


/* ---------- welcome page (first screen) ---------- */
function landing(){
  const t=S.temple,y=activeYear(),open=S.campaigns.filter(c=>campYear(c)===y).slice(0,3);
  const staffBtn=DEMO?`<button class="lbtn ghost" id="lw-demo">${ic('users',18)} ทดลองเป็นเจ้าหน้าที่</button>`:user?(isStaff()?`<button class="lbtn ghost" data-go="home">${ic('users',18)} หน้าจัดการ (${isAdmin()?'แอดมิน':'เจ้าหน้าที่'})</button>`:''):`<button class="lbtn ghost" id="b-login">${ic('login',18)} เจ้าหน้าที่วัด เข้าสู่ระบบ</button>`;
  return `<div class="welcome"><div class="w-glow"><i></i><i></i><i></i><i></i></div>
  <main class="w-main">
    <div class="w-hero"><div class="w-logo"><img src="${esc(logoSrc())}" alt="ตรา${esc(t.name||'วัด')}"></div></div>
    <div class="w-body">
      <span class="w-eyebrow">${ic('heart',14)} ระบบทำบุญออนไลน์</span>
      <h1>${esc(t.name||'ระบบทำบุญวัด')}</h1>
      ${t.place?`<p class="w-place">${ic('pin',15)} ${esc(t.place)}</p>`:''}
      <p class="w-bless">“${esc(bless('welcome'))}”</p>
      <ul class="w-feats"><li>${ic('qr',15)}<span>สแกน QR</span></li><li>${ic('upload',15)}<span>ส่งสลิป</span></li><li>${ic('receipt',15)}<span>ขอใบอนุโมทนา</span></li><li>${ic('users',15)}<span>ดูรายนาม</span></li></ul>
      <div class="w-actions"><button class="lbtn gold" data-go="home">${ic('heart',20)} เข้าสู่ระบบทำบุญ</button>${staffBtn}</div>
      ${open.length?`<section class="w-open"><h2>งานบุญที่เปิดรับ ปี พ.ศ. ${y}</h2><div class="w-list">${open.map(c=>`<button class="w-row ${gcls(c.type)}" data-go="${c.id}"><span class="w-bar"></span><span class="w-txt"><b>${esc(c.title)}</b><small>${esc(c.type)} · ${num(stats(c).n)} ผู้ร่วมบุญ${c.date?' · วันงาน '+thDate(c.date):''}</small></span><span class="w-chev">${ic('back',16)}</span></button>`).join('')}</div></section>`:''}
    </div>
  </main>
  <footer class="w-foot"><span>${[t.address,t.phone&&'โทร '+t.phone].filter(Boolean).map(esc).join(' · ')||esc(t.footerNote||'ขออนุโมทนาบุญ')}</span>${!DEMO?`<button class="linkbtn" data-install ${canInstall()?'':'hidden'}>${ic('download',14)} ติดตั้งแอป</button>`:''}</footer></div>`;
}
function bindLanding(){const d=document.getElementById('lw-demo');if(d)d.onclick=()=>{window.__setDemo('staff');go('home')}}
async function setLogo(file){
  if(!file)return;
  try{const url=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const S2=360,c=document.createElement('canvas');c.width=S2;c.height=S2;const x=c.getContext('2d');const s=Math.min(im.naturalWidth,im.naturalHeight);x.drawImage(im,(im.naturalWidth-s)/2,(im.naturalHeight-s)/2,s,s,0,0,S2,S2);let u=c.toDataURL('image/webp',.86);if(!u.startsWith('data:image/webp'))u=c.toDataURL('image/jpeg',.88);res(u)};im.onerror=rej;im.src=fr.result};fr.onerror=rej;fr.readAsDataURL(file)});
    await run(()=>setDoc(doc(db,'settings','temple'),{logo:url},{merge:true}),'เปลี่ยนตราวัดแล้ว',['settings','settings','temple','เปลี่ยนตราวัด'])}catch(e){toast('อ่านรูปไม่ได้ ลองเลือกรูปใหม่')}
}
async function drawLogo(x,cx,cy,r){const im=await loadImg(logoSrc());if(!im)return false;x.save();x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.closePath();x.clip();x.drawImage(im,cx-r,cy-r,r*2,r*2);x.restore();return true}

window.addEventListener('hashchange',()=>{document.querySelectorAll('.sheet').forEach(x=>x.remove());const c=cur();const m=location.hash.match(/^#y(\d{4})$/);if(m){yearFilter=+m[1]}if(ui._keep){delete ui._keep}else ui=c&&ui.batch?{batch:true,focusFirst:ui.focusFirst}:{};if(!tvCamp()){clearInterval(tvClock);try{wakeLock?.release()}catch(e){}}render()});
if(DEMO){watchPrivate();window.__demo={F,S,db}}
render();
