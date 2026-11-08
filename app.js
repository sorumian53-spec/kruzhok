(function(){
'use strict';

/* =====================================================================
   Кружок: сайт знакомств по интересам. Версия 5.
   ===================================================================== */

/* ---------- настройки и подключение ---------- */
const CFG=window.KRUZHOK_CONFIG||{};
const URL_OK=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(CFG.url||'');
const KEY_OK=typeof CFG.key==='string'&&CFG.key.length>20&&!/[А-Яа-яЁё]/.test(CFG.key);
function keyProblem(k){
  if(/^sb_secret_/.test(k))return true;
  const p=String(k).split('.');
  if(p.length===3){try{const j=JSON.parse(atob(p[1].replace(/-/g,'+').replace(/_/g,'/')));if(j.role==='service_role')return true;}catch(e){}}
  return false;
}
const SECRET_KEY=KEY_OK&&keyProblem(CFG.key);
const LIB_OK=!!(window.supabase&&window.supabase.createClient);
const SB_OK=URL_OK&&KEY_OK&&!SECRET_KEY&&LIB_OK;
const BASE=URL_OK?CFG.url.replace(/\/+$/,''):'';
const sb=SB_OK?window.supabase.createClient(BASE,CFG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null;

/* ---------- вспомогательное ---------- */
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plural=(n,f)=>{const a=Math.abs(n)%100,b=a%10;if(a>10&&a<20)return f[2];if(b>1&&b<5)return f[1];if(b===1)return f[0];return f[2];};
const ageText=n=>n+' '+plural(n,['год','года','лет']);
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hueOf=id=>{let h=0;const s=String(id);for(let k=0;k<s.length;k++)h=(h*31+s.charCodeAt(k))%360;return h;};
const cityKey=s=>String(s||'').trim().toLowerCase().replace(/ё/g,'е').replace(/-/g,' ').replace(/\s+/g,' ');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const CATS={sport:'Спорт и активность',games:'Игры',creative:'Творчество',music:'Музыка',culture:'Кино, книги, театр',travel:'Путешествия и походы',food:'Еда и напитки',learning:'Учёба и языки',tech:'Технологии',other:'Другое'};
const FORMATS={offline:'Офлайн',online:'Онлайн',both:'Онлайн и офлайн'};
const NOTIFY={all:'Все новые встречи',fit:'Только подходящие мне',off:'Не уведомлять'};
const REASONS={spam:'Спам или реклама',abuse:'Оскорбления или угрозы',fake:'Фальшивый профиль',photo:'Неприемлемое фото',scam:'Мошенничество',other:'Другое'};
const TARGETS={user:'Профиль',topic:'Тема',comment:'Ответ в теме',chat:'Сообщение в чате',dm:'Личное сообщение',interest:'Интерес',meetup:'Встреча'};
const GENDER={any:'для всех',f:'только женщины',m:'только мужчины'};
const GHOST={name:'Пользователь',hue:200};
const HUES=[190,40,350,260,120,300];
const PCOLS='id,name,age,city,gender,about,photo_url,created_at';
const RX={like:'\u{1F44D}',heart:'\u2764\uFE0F',laugh:'\u{1F602}',fire:'\u{1F525}',clap:'\u{1F44F}'};
const FOUNDERS_N=1000;

function ago(iso){
  const s=(Date.now()-new Date(iso).getTime())/1000;
  if(s<60)return 'только что';
  const m=Math.floor(s/60);if(m<60)return m+' мин назад';
  const h=Math.floor(m/60);if(h<24)return h+' ч назад';
  const d=Math.floor(h/24);if(d===1)return 'вчера';
  if(d<7)return d+' '+plural(d,['день','дня','дней'])+' назад';
  return new Date(iso).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
}
const clock=iso=>new Date(iso).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
function when(d){return d.toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'long'})+', '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});}

function errText(e){
  const m=(e&&e.message)||String(e||'');
  const c=e&&e.code;
  if(/Invalid login credentials/i.test(m))return 'Неверная почта или пароль.';
  if(/already registered|already been registered/i.test(m))return 'Эта почта уже зарегистрирована. Попробуйте войти.';
  if(/Password should be at least/i.test(m))return 'Пароль слишком короткий: нужно не меньше 6 символов.';
  if(/valid email|invalid format|Unable to validate email/i.test(m))return 'Проверьте адрес почты.';
  if(/rate limit|too many/i.test(m))return 'Слишком много попыток. Подождите немного и повторите.';
  if(c==='23505'){
    if(/reports_once_open/.test(m))return 'Вы уже отправили жалобу на это. Мы её рассматриваем.';
    if(/interests_title/.test(m))return 'Такой интерес уже есть. Найдите его в списке и вступите.';
    return 'Такая запись уже есть.';
  }
  if(c==='42501'||/row-level security|permission denied/i.test(m))return 'Это действие недоступно. Возможно, вы не участник интереса, у вас нет общего интереса с этим человеком или аккаунт ограничен.';
  if(/Failed to fetch|NetworkError|Load failed|network/i.test(m))return 'Нет связи с сервером. Проверьте интернет и повторите.';
  if(/Database error saving new user/i.test(m))return 'Не удалось создать профиль. Проверьте, что вам есть 18 лет, а город и остальные поля заполнены.';
  if(c==='23514'||/check constraint/i.test(m))return 'Проверьте значения полей: что-то не подходит по длине или формату.';
  return m||'Что-то пошло не так. Повторите попытку.';
}
const safePhoto=u=>(u&&BASE&&String(u).indexOf(BASE+'/storage/v1/object/public/avatars/')===0)?u:null;
const safeUrl=u=>/^https?:\/\/[^\s<>"']+$/i.test(String(u||''))?u:null;

/* ---------- состояние ---------- */
const state={
  session:null,me:null,status:{is_admin:false,banned:false},
  view:'home',arg:null,tab:null,pendingTab:null,topic:null,
  q:'',onlyMine:false,cat:'',fmt:'',
  f:{city:'',interest:'',gender:'',age:'',format:''},
  after:null,authMode:'signup',notice:'',photoFile:null,photoUrl:null,
  loaded:false,loadError:'',unreadN:0,unreadDM:0,unreadChat:0,openReports:0,adminTab:'reports',installEvt:null
};
let PEOPLE={},I=[],M=[],LINKS={},BLOCKED=new Set(),NOTES=[];
let CONVOS=null,ADMIN={reports:[],banned:new Set(),cities:[]};
let UNREAD={},REACT={},FOUNDERS=new Set();
let V4=true,HAS_DMRX=true,BANS={},MYBANS=new Set();
let HAS_PH=true,HAS_FR=true,HAS_RE=true,HAS_PO=true,HAS_PIN=true,HAS_ST=true,HAS_IMG=true,FRIENDS=[];
const COMPOSE={chat:{},dm:{}};
const pcols=()=>HAS_PH?PCOLS+',photos':PCOLS;
const INT_COLS='id,title,description,hue,owner_id,category,tags,format,city,created_at';
const live={chatId:null,chatSig:'',threadId:null,threadSig:''};
const MSG={};
const cache={chat:{},dm:{}};
const interest=id=>I.find(i=>i.id===id);
const who=id=>PEOPLE[id]||GHOST;
const has=arr=>!!(state.me&&arr.includes(state.me.id));
const isMe=id=>!!(state.me&&state.me.id===id);
const curTab=i=>state.tab||(has(i.members)?'chat':'talks');
function clearData(){FRIENDS=[];PUSH.synced=false;PEOPLE={};I=[];M=[];LINKS={};BLOCKED=new Set();NOTES=[];CONVOS=null;state.me=null;state.loaded=false;state.status={is_admin:false,banned:false};state.unreadN=0;state.unreadDM=0;state.unreadChat=0;UNREAD={};REACT={};FOUNDERS=new Set();BANS={};MYBANS=new Set();state.openReports=0;live.chatId=null;live.threadId=null;cache.chat={};cache.dm={};ADMIN.loaded=false;}

/* ---------- загрузка данных ---------- */
let loadSeq=0;
async function reload(){
  if(!state.session){clearData();return;}
  const seq=++loadSeq;
  const since=new Date(Date.now()-3*3600*1000).toISOString();
  const res=await Promise.all([
    sb.from('profiles').select(pcols()),
    sb.from('interests').select(V4?INT_COLS+',photo_url,rules':INT_COLS).order('created_at',{ascending:false}),
    sb.from('interest_members').select('interest_id,user_id,notify,joined_at'),
    sb.from('meetups').select('id,interest_id,host_id,title,description,format,city,place,starts_at,age_min,age_max,gender,max_people,created_at').gte('starts_at',since).order('starts_at',{ascending:true}),
    sb.from('meetup_going').select('meetup_id,user_id'),
    sb.from('meetup_links').select('meetup_id,url'),
    sb.from('topics').select('id,interest_id,author_id,title,body,created_at').order('created_at',{ascending:false}),
    sb.from('comments').select('id,topic_id,author_id,body,created_at').order('created_at',{ascending:true}),
    sb.from('blocks').select('blocked_id'),
    sb.from('notifications').select('id,kind,title,body,link,read_at,created_at').order('created_at',{ascending:false}).limit(40),
    sb.rpc('my_status'),
    sb.rpc('chat_unread'),
    sb.from('interest_bans').select('interest_id,user_id,created_at'),
    sb.from('friendships').select('id,requester_id,addressee_id,status')
  ]);
  if(res[1].error&&V4&&(res[1].error.code==='42703'||/photo_url|rules/.test(res[1].error.message||''))){
    V4=false;
    res[1]=await sb.from('interests').select(INT_COLS).order('created_at',{ascending:false});
  }
  if(res[0].error&&HAS_PH&&(res[0].error.code==='42703'||/photos/.test(res[0].error.message||''))){
    HAS_PH=false;
    res[0]=await sb.from('profiles').select(PCOLS);
  }
  const bad=res.slice(0,11).find(r=>r.error);
  if(bad)throw bad.error;
  if(seq!==loadSeq)return;
  const uid=state.session.user.id;
  const people={};
  res[0].data.forEach(p=>{people[p.id]=mkPerson(p);});
  const byI={};
  const ints=res[1].data.map(r=>{const o={id:r.id,title:r.title,desc:r.description,hue:r.hue,owner:r.owner_id,cat:r.category||'other',tags:r.tags||[],format:r.format||'both',city:r.city||'',photo:V4?safePhoto(r.photo_url):null,rules:V4?(r.rules||''):'',members:[],joined:{},notify:'all',topics:[]};byI[o.id]=o;return o;});
  res[2].data.forEach(r=>{const o=byI[r.interest_id];if(!o)return;o.members.push(r.user_id);o.joined[r.user_id]=r.joined_at;if(r.user_id===uid)o.notify=r.notify||'all';});
  const byT={};
  res[6].data.forEach(r=>{const o=byI[r.interest_id];if(!o)return;const t={id:r.id,title:r.title,a:r.author_id,text:r.body||'',at:r.created_at,comments:[]};byT[t.id]=t;o.topics.push(t);});
  res[7].data.forEach(r=>{const t=byT[r.topic_id];if(t)t.comments.push({id:r.id,a:r.author_id,t:r.body,at:r.created_at});});
  const byM={};
  const meets=res[3].data.map(r=>{const o={id:r.id,interestId:r.interest_id,host:r.host_id,title:r.title,desc:r.description||'',format:r.format||'offline',city:r.city||'',place:r.place,when:new Date(r.starts_at),ageMin:r.age_min,ageMax:r.age_max,g:r.gender,max:r.max_people,created:r.created_at?new Date(r.created_at):null,going:[]};byM[o.id]=o;return o;});
  res[4].data.forEach(r=>{const o=byM[r.meetup_id];if(o)o.going.push(r.user_id);});
  const links={};res[5].data.forEach(r=>{links[r.meetup_id]=r.url;});
  PEOPLE=people;I=ints;M=meets;LINKS=links;
  const bans={},myb=new Set();
  if(res[12]&&!res[12].error)(res[12].data||[]).forEach(r=>{if(r.user_id===uid)myb.add(r.interest_id);(bans[r.interest_id]=bans[r.interest_id]||[]).push({user:r.user_id,at:r.created_at});});
  BANS=bans;MYBANS=myb;
  HAS_FR=!!(res[13]&&!res[13].error);
  FRIENDS=HAS_FR?(res[13].data||[]).map(r=>({id:r.id,from:r.requester_id,to:r.addressee_id,status:r.status})):[];
  state.frIn=FRIENDS.filter(f=>f.status==='pending'&&f.to===uid).length;
  BLOCKED=new Set(res[8].data.map(r=>r.blocked_id));
  NOTES=res[9].data;
  const st=(res[10].data&&res[10].data[0])||{};
  state.status={is_admin:!!st.is_admin,banned:!!st.banned};
  state.me=people[uid]||null;
  FOUNDERS=new Set(Object.values(people).sort((a,b)=>String(a.since).localeCompare(String(b.since))).slice(0,FOUNDERS_N).map(p=>p.id));
  applyUnread(res[11]);
  state.unreadN=NOTES.filter(n=>!n.read_at).length;
  state.loaded=true;
}
function mkPerson(p){return {id:p.id,name:p.name,age:p.age,city:p.city,g:p.gender,about:p.about||'',photo:safePhoto(p.photo_url),hue:hueOf(p.id),since:p.created_at||'',photos:HAS_PH?(p.photos||[]).map(safePhoto).filter(Boolean):[]};}
function applyUnread(res){
  if(!res||res.error)return;
  const m={};(res.data||[]).forEach(r=>{m[r.interest_id]=r.unread;});
  if(live.chatId&&state.view==='interest')m[live.chatId]=0;
  UNREAD=m;state.unreadChat=Object.values(m).reduce((a,b)=>a+b,0);
}
function markSeen(id){
  if(!id||document.hidden||!state.session)return;
  UNREAD[id]=0;state.unreadChat=Object.values(UNREAD).reduce((a,b)=>a+b,0);renderTop();
  sb.rpc('mark_chat_seen',{p_interest:id}).then(()=>{},()=>{});
}
async function ensurePeople(ids){
  const miss=[...new Set(ids)].filter(id=>id&&!PEOPLE[id]);
  if(!miss.length)return;
  const r=await sb.from('profiles').select(pcols()).in('id',miss);
  if(!r.error)r.data.forEach(p=>{PEOPLE[p.id]=mkPerson(p);});
}
async function refreshCounts(){
  if(!state.session||!state.me)return;
  try{
    const jobs=[
      sb.from('notifications').select('id',{count:'exact',head:true}).is('read_at',null),
      sb.from('direct_messages').select('id',{count:'exact',head:true}).eq('recipient_id',state.me.id).is('read_at',null),
      sb.rpc('my_status'),
      sb.rpc('chat_unread'),
      sb.from('friendships').select('id',{count:'exact',head:true}).eq('addressee_id',state.me.id).eq('status','pending')
    ];
    if(state.status.is_admin)jobs.push(sb.from('reports').select('id',{count:'exact',head:true}).eq('status','open'));
    const r=await Promise.all(jobs);
    if(!r[0].error)state.unreadN=r[0].count||0;
    if(!r[1].error)state.unreadDM=r[1].count||0;
    if(r[4]&&!r[4].error)state.frIn=r[4].count||0;
    if(r[5]&&!r[5].error)state.openReports=r[5].count||0;
    applyUnread(r[3]);
    const st=!r[2].error&&r[2].data&&r[2].data[0];
    if(st&&(!!st.banned!==state.status.banned||!!st.is_admin!==state.status.is_admin)){
      state.status={is_admin:!!st.is_admin,banned:!!st.banned};
      if(!document.querySelector('#ov')||$('#ov').hidden)render();
    }
    renderTop();
  }catch(e){}
}

/* ---------- кусочки интерфейса ---------- */
function av(p,size){
  const cls='av av-'+(size||'md');
  if(p&&p.photo)return '<span class="'+cls+'"><img src="'+esc(p.photo)+'" alt=""></span>';
  const name=(p&&p.name)||'?';
  return '<span class="'+cls+' tint" style="--h:'+(p&&p.hue!=null?p.hue:200)+'">'+esc(name.trim().charAt(0)||'?')+'</span>';
}
const avLink=(id,size)=>PEOPLE[id]?'<a href="#user-'+esc(id)+'" aria-label="Профиль: '+esc(who(id).name)+'">'+av(who(id),size)+'</a>':av(GHOST,size);
const pLink=id=>PEOPLE[id]?'<a class="plink" href="#user-'+esc(id)+'">'+esc(who(id).name)+'</a>':'<span class="plink">'+esc(who(id).name)+'</span>';
const badge=(i,lg)=>i.photo?'<span class="badge pic'+(lg?' lg':'')+'"><img src="'+esc(i.photo)+'" alt=""></span>':'<span class="badge'+(lg?' lg':'')+' tint" style="--h:'+esc(i.hue)+'">'+esc((i.title||'?').charAt(0))+'</span>';
const ownerMod=i=>!!(V4&&i&&isMe(i.owner));
function fld(label,id,inner){return '<div class="field"><label for="'+id+'">'+label+'</label>'+inner+'</div>';}
function opts(arr,val){return arr.map(a=>'<option value="'+esc(a[0])+'"'+(a[0]===val?' selected':'')+'>'+esc(a[1])+'</option>').join('');}
function segs(name,items,val,label){
  return '<div class="segs" role="radiogroup" aria-label="'+esc(label)+'">'+items.map(it=>'<label class="seg"><input type="radio" name="'+name+'" value="'+esc(it[0])+'"'+(it[0]===val?' checked':'')+'><span>'+esc(it[1])+'</span></label>').join('')+'</div>';
}
function genderSegs(name,val){return segs(name,[['f','Женщина'],['m','Мужчина']],val,'Пол');}
function swatches(val){
  return '<div class="swatches" role="radiogroup" aria-label="Цвет">'+HUES.map((h,k)=>'<label class="sw" style="--h:'+h+'"><input type="radio" name="hue" value="'+h+'"'+((val==null?k===0:h===val)?' checked':'')+'><span class="c"></span><span class="sr">Цвет '+(k+1)+'</span></label>').join('')+'</div>';
}
function cityField(id,label,value,ph){
  return '<div class="field"><label for="'+id+'">'+label+'</label><div class="combo"><input type="text" id="'+id+'" class="cityin" data-list="'+id+'-list" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="'+id+'-list" autocomplete="off" maxlength="60" placeholder="'+esc(ph||'Начните вводить город')+'" value="'+esc(value||'')+'"><ul class="combo-list" id="'+id+'-list" role="listbox" hidden></ul></div></div>';
}
function shared(a,b){return I.some(i=>i.members.includes(a)&&i.members.includes(b));}
function commonWith(id){return I.filter(i=>has(i.members)&&i.members.includes(id));}
function canDM(id){return !!state.me&&id!==state.me.id&&(shared(state.me.id,id)||isFriend(id))&&!BLOCKED.has(id);}
function catChip(i){return '<span class="chip plain">'+esc(CATS[i.cat]||CATS.other)+'</span>';}
function fmtChip(i){return '<span class="chip plain">'+esc(FORMATS[i.format]||'')+(i.city&&i.format!=='online'?' · '+esc(i.city):'')+'</span>';}

function cardInterest(i){
  const joined=has(i.members),n=i.members.length;
  return '<article class="icard"><a class="icard-main" href="#interest-'+esc(i.id)+'">'+badge(i)+'<h3>'+esc(i.title)+'</h3>'+
    '<div class="chips-row">'+catChip(i)+fmtChip(i)+'</div><p>'+esc(i.desc)+'</p>'+
    (i.tags.length?'<div class="icard-tags">'+i.tags.slice(0,4).map(t=>'<span class="tag">'+esc(t)+'</span>').join('')+'</div>':'')+'</a>'+
    '<div class="icard-foot"><span class="meta">'+n+' '+plural(n,['участник','участника','участников'])+(joined&&UNREAD[i.id]?' <span class="count" title="Новые сообщения в чате">'+UNREAD[i.id]+'</span>':'')+'</span>'+
    (MYBANS.has(i.id)&&!joined?'<button class="btn sm" type="button" disabled>Доступ закрыт</button>':'<button class="btn sm'+(joined?' on':' primary')+'" type="button" data-act="join-interest" data-id="'+esc(i.id)+'">'+(joined?'Вы участник':'Вступить')+'</button>')+'</div></article>';
}

function cardMeetup(m){
  const it=interest(m.interestId)||{title:'Интерес',hue:200,id:''};
  const d=m.when,going=has(m.going),full=m.going.length>=m.max;
  const online=m.format==='online';
  const month=d.toLocaleDateString('ru-RU',{month:'short'}).replace('.','');
  const wd=d.toLocaleDateString('ru-RU',{weekday:'short'});
  const time=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  const faces=m.going.slice(0,4).map(id=>avLink(id,'sm')).join('');
  const url=going&&LINKS[m.id]?safeUrl(LINKS[m.id]):null;
  const mine=state.me&&m.host===state.me.id;
  const canDel=mine||state.status.is_admin||ownerMod(it);
  return '<article class="mcard"><div class="date"><b>'+d.getDate()+'</b><span>'+esc(month)+'</span></div>'+
    '<div class="mbody"><div class="chips-row"><a class="chip tint" style="--h:'+esc(it.hue)+'" href="#interest-'+esc(it.id)+'">'+esc(it.title)+'</a><span class="chip plain">'+(online?'Онлайн':'Офлайн')+'</span></div>'+
    '<h3>'+esc(m.title)+'</h3>'+
    '<p class="meta">'+esc(wd)+', '+esc(time)+' · '+(online?'Платформа: '+esc(m.place):esc(m.place)+', '+esc(m.city))+'</p>'+
    '<p class="meta">Возраст '+m.ageMin+'–'+m.ageMax+' · '+GENDER[m.g]+(m.host?' · Организатор: '+pLink(m.host):'')+'</p>'+
    (m.desc?'<p class="desc">'+esc(m.desc)+'</p>':'')+
    (online&&going?'<p class="linkrow">'+(url?'Ссылка: <a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(url)+'</a>':'Ссылку организатор не указал.')+'</p>':'')+
    (online&&!going?'<p class="meta">Ссылка станет видна после записи.</p>':'')+'</div>'+
    '<div class="maside"><div class="going">'+faces+'</div><span class="meta">'+m.going.length+' из '+m.max+'</span>'+
    '<button class="btn sm'+(going?' on':' primary')+'" type="button" data-act="join-meetup" data-id="'+esc(m.id)+'"'+(full&&!going?' disabled':'')+'>'+(going?'Вы идёте':(full?'Мест нет':'Пойду'))+'</button>'+
    '<div class="acts">'+remBtn(m)+'<button class="lnk" type="button" data-act="share-meetup" data-id="'+esc(m.id)+'">Поделиться</button>'+(canDel?'<button class="lnk danger" type="button" data-act="del-meetup" data-id="'+esc(m.id)+'">Удалить</button>':'')+
    (!mine?'<button class="lnk" type="button" data-act="report" data-type="meetup" data-id="'+esc(m.id)+'">Пожаловаться</button>':'')+'</div></div></article>';
}

function personCard(p,common){
  const names=common.slice(0,3).map(i=>esc(i.title)).join(', ');
  return '<article class="pcard"><div class="top2">'+avLink(p.id,'md')+'<div>'+pLink(p.id)+'<span class="meta">'+ageText(p.age)+' · '+esc(p.city)+'</span></div></div>'+
    (common.length?'<p class="common">Общие интересы: '+names+(common.length>3?' и ещё '+(common.length-3):'')+'</p>':'')+
    '<div class="row"><a class="btn sm" href="#user-'+esc(p.id)+'">Профиль</a>'+(canDM(p.id)?'<a class="btn sm primary" href="#messages-'+esc(p.id)+'">Написать</a>':'')+'</div></article>';
}

/* ---------- рекомендации ---------- */
function recoPeople(){
  const me=state.me;
  const out=[];
  Object.values(PEOPLE).forEach(p=>{
    if(p.id===me.id||BLOCKED.has(p.id))return;
    const common=commonWith(p.id);
    if(!common.length)return;
    out.push({p,common,score:common.length*3+(p.city===me.city?2:0)-Math.min(Math.abs(p.age-me.age),20)/20});
  });
  return out.sort((a,b)=>b.score-a.score).slice(0,6);
}
function recoInterests(){
  const me=state.me;
  const mates=new Set();
  I.forEach(i=>{if(has(i.members))i.members.forEach(id=>{if(id!==me.id)mates.add(id);});});
  const out=[];
  I.forEach(i=>{
    if(has(i.members))return;
    const overlap=i.members.filter(id=>mates.has(id)).length;
    const local=i.members.filter(id=>PEOPLE[id]&&PEOPLE[id].city===me.city).length;
    const score=overlap*3+local*2+(i.city&&i.city===me.city?3:0)+Math.log(1+i.members.length);
    out.push({i,overlap,local,score});
  });
  return out.sort((a,b)=>b.score-a.score).slice(0,4);
}
function fitsMe(m){
  const me=state.me;
  if(me.age<m.ageMin||me.age>m.ageMax)return false;
  if(m.g!=='any'&&m.g!==me.g)return false;
  return true;
}

/* ---------- экраны: общее ---------- */
function vSetup(){
  let why;
  if(!URL_OK||!KEY_OK)why='Сайт пока не подключён к базе данных. Откройте файл <code>config.js</code> и вставьте адрес проекта и публичный ключ из Supabase.';
  else if(SECRET_KEY)why='В файле <code>config.js</code> указан секретный ключ. Его нельзя использовать на сайте. Замените его на публичный ключ «anon public» («publishable key») и никому не показывайте секретный.';
  else why='Не загрузилась библиотека <code>supabase.js</code>. Проверьте, что файл лежит рядом с <code>index.html</code> и загружен на хостинг.';
  return '<div class="vhead"><h1>Нужна настройка</h1></div><div class="banner" role="alert"><p>'+why+'</p></div>';
}
function vLoading(){return '<p class="meta" style="padding:24px 0">Загружаем…</p>';}
function vLoadError(){
  return '<div class="banner" role="alert"><p>Не удалось загрузить данные: '+esc(state.loadError)+'</p><p style="margin-top:6px">Если вы только что обновили сайт, проверьте, что в Supabase выполнен новый файл <code>database.sql</code>.</p></div><p style="margin-top:14px"><button class="btn primary" type="button" data-act="retry">Повторить</button></p>';
}
function vGate(v){
  const titles={welcome:'Выбор интересов',interests:'Интересы',meetups:'Встречи',messages:'Сообщения',thread:'Сообщения',notifications:'Уведомления',interest:'Интерес',user:'Профиль человека',admin:'Модерация'};
  return '<div class="vhead"><h1>'+(titles[v]||'Кружок')+'</h1></div><div class="empty"><p>Это видят только зарегистрированные пользователи.</p><div class="row"><a class="btn primary" href="#profile">Войти или зарегистрироваться</a></div></div>';
}
function vNoProfile(){
  return '<div class="banner" role="alert"><p>Для этого входа не нашёлся профиль. Выйдите и зарегистрируйтесь заново.</p></div><p style="margin-top:14px"><button class="btn" type="button" data-act="logout">Выйти</button></p>';
}
function bannedBanner(){
  return '<div class="banner" role="alert" style="margin-bottom:18px"><p>Ваш аккаунт ограничен модератором. Вы можете читать, но не можете писать и создавать новое.</p></div>';
}

/* ---------- главная ---------- */
function how(h,t,p){return '<div><span class="dot" style="background:oklch(.72 .13 '+h+')"></span><h3>'+t+'</h3><p class="meta" style="font-size:.95rem">'+p+'</p></div>';}
function vHome(){
  const logged=!!state.session;
  const buttons=logged
    ?'<a class="btn primary" href="#interests">Смотреть интересы</a><button class="btn" type="button" data-act="new-interest">Создать свой интерес</button>'
    :'<a class="btn primary" href="#profile">Зарегистрироваться</a><a class="btn" href="#profile" data-act="to-login">Войти</a>';
  const hero='<section class="hero"><div class="hero-text"><p class="eyebrow">Знакомства по интересам</p>'+
    '<h1>'+(logged&&state.me?esc(state.me.name.split(' ')[0])+', найдите людей со своими интересами':'Найдите людей, которым интересно то же, что и вам')+'</h1>'+
    '<p class="lead">Создайте свой интерес или вступите в чужой. Общайтесь в чате, назначайте встречи в своём городе или онлайн.</p>'+
    '<div class="row">'+buttons+'</div></div>'+
    '<svg class="hero-art" viewBox="0 0 420 360" role="img" aria-label="Три пересекающихся круга: бег, книги, кофе. В середине вы."><circle class="hc c1" cx="150" cy="130" r="110"/><circle class="hc c2" cx="270" cy="130" r="110"/><circle class="hc c3" cx="210" cy="230" r="110"/>'+
    '<text x="100" y="112" text-anchor="middle">Бег</text><text x="320" y="112" text-anchor="middle">Книги</text><text x="210" y="300" text-anchor="middle">Кофе</text>'+
    '<circle class="you" cx="210" cy="168" r="22"/><text class="you-t" x="210" y="173" text-anchor="middle">Вы</text></svg></section>';
  if(!logged||!state.loaded||!state.me){
    return hero+installCard(false)+'<section class="section"><h2 style="margin-bottom:18px">Как устроен сайт</h2><div class="how-grid">'+
      how(190,'Свой интерес','Придумайте любой интерес, опишите его и задайте параметры.')+
      how(40,'Присоединяйтесь','Вступайте в интересы, где уже собираются люди, и общайтесь в общем чате.')+
      how(350,'Встречи','Участники интереса назначают встречи онлайн и офлайн. Фильтры по городу, возрасту и полу помогут найти подходящую.')+
      how(260,'Знакомства','Пишите людям с общими интересами в личные сообщения.')+'</div></section>';
  }
  const mine=M.filter(m=>has(m.going)).sort((a,b)=>a.when-b.when).slice(0,3);
  const near=M.filter(m=>!has(m.going)&&fitsMe(m)&&(m.format==='online'||m.city===state.me.city)&&m.going.length<m.max).sort((a,b)=>a.when-b.when).slice(0,3);
  const ri=recoInterests(),rp=recoPeople();
  let html=hero+installCard(false);
  const hasInt=I.some(i=>has(i.members));
  if(!hasInt)html+=welcomeBanner();
  else html+=soonCard()+feedHtml()+inviteCard();
  if(mine.length)html+='<section class="section"><div class="rowhead"><h2>Вы идёте</h2><a class="btn sm" href="#meetups">Все встречи</a></div><div class="mlist">'+mine.map(cardMeetup).join('')+'</div></section>';
  html+='<section class="section"><div class="rowhead"><h2>Интересы для вас</h2><a class="btn sm" href="#interests">Все интересы</a></div>'+
    (ri.length?'<div class="grid">'+ri.map(x=>cardInterest(x.i)).join('')+'</div>':'<div class="empty"><p>Интересов пока нет. Создайте первый.</p><button class="btn primary" type="button" data-act="new-interest">Создать интерес</button></div>')+'</section>';
  if(rp.length)html+='<section class="section"><div class="rowhead"><h2>Люди с общими интересами</h2></div><div class="reco">'+rp.map(x=>personCard(x.p,x.common)).join('')+'</div></section>';
  html+=gatherCard();
  html+='<section class="section"><div class="rowhead"><h2>Встречи для вас</h2><a class="btn sm" href="#meetups">Все встречи</a></div>'+
    (near.length?'<div class="mlist">'+near.map(cardMeetup).join('')+'</div>':'<div class="empty"><p>Подходящих встреч в вашем городе и онлайн пока нет.</p><a class="btn" href="#meetups">Посмотреть все встречи</a></div>')+'</section>';
  return html;
}

/* ---------- интересы ---------- */
function vInterests(){
  return '<div class="vhead"><h1>Интересы</h1><button class="btn primary" type="button" data-act="new-interest">Создать интерес</button></div>'+
    '<div class="tools"><div class="search"><label class="sr" for="q">Поиск по интересам</label><input type="search" id="q" placeholder="Поиск: бег, книги, кофе" value="'+esc(state.q)+'"></div>'+
    '<label class="sr" for="cat">Категория</label><select id="cat" style="width:auto">'+opts([['','Все категории']].concat(Object.entries(CATS)),state.cat)+'</select>'+
    '<label class="sr" for="fmt">Формат</label><select id="fmt" style="width:auto">'+opts([['','Любой формат'],['offline','Офлайн'],['online','Онлайн']],state.fmt)+'</select>'+
    '<button class="btn'+(state.onlyMine?' on':'')+'" type="button" data-act="toggle-mine" aria-pressed="'+state.onlyMine+'">Только мои</button></div>'+
    '<p class="meta" id="icount" style="margin-bottom:12px"></p><div id="ihint"></div><div class="grid" id="igrid"></div>';
}
function fillInterests(){
  if(!$('#igrid'))return;
  const q=state.q.trim(),k=cityKey(q);
  const list=I.filter(i=>{
    if(state.onlyMine&&!has(i.members))return false;
    if(state.cat&&i.cat!==state.cat)return false;
    if(state.fmt&&i.format!==state.fmt&&i.format!=='both')return false;
    if(!k)return true;
    const hay=cityKey(i.title+' '+i.desc+' '+i.tags.join(' ')+' '+(CATS[i.cat]||'')+' '+i.city);
    return k.split(' ').every(w=>hay.includes(w));
  });
  $('#icount').textContent='Найдено: '+list.length;
  const exact=q&&I.some(i=>cityKey(i.title)===k);
  $('#ihint').innerHTML=(q.length>=2&&!exact)
    ?'<div class="create-hint"><p>'+(list.length?'Не нашли то, что искали?':'Интереса «'+esc(q)+'» пока никто не создал.')+'</p><button class="btn primary" type="button" data-act="new-interest" data-title="'+esc(q)+'">Создать интерес «'+esc(q.length>30?q.slice(0,30)+'…':q)+'»</button></div>':'';
  $('#igrid').innerHTML=list.length?list.map(cardInterest).join(''):
    (q?'':'<div class="empty" style="grid-column:1/-1"><p>'+(state.onlyMine?'Вы пока не вступили ни в один интерес.':'Интересов с такими параметрами нет.')+'</p><button class="btn primary" type="button" data-act="new-interest">Создать интерес</button></div>');
}

function vInterest(){
  const i=interest(state.arg);
  if(!i)return '<div class="empty"><p>Такого интереса нет.</p><a class="btn" href="#interests">К списку интересов</a></div>';
  const joined=has(i.members),n=i.members.length;
  const ownerHtml=i.owner&&PEOPLE[i.owner]?pLink(i.owner)+(isMe(i.owner)?' (вы)':''):'команда «Кружка»';
  const meets=M.filter(m=>m.interestId===i.id).length;
  const tab=curTab(i);
  const unreadHere=has(i.members)&&tab!=='chat'&&UNREAD[i.id]?' <span class="count">'+UNREAD[i.id]+'</span>':'';
  const tabs=[['chat','Чат'+unreadHere],['talks','Обсуждения ('+i.topics.length+')'],['meets','Встречи ('+meets+')'],['people','Участники ('+n+')']];
  const mineOwner=isMe(i.owner);
  const actions='<div class="actions">'+
    (joined?'<div class="notify"><label for="notify-sel">Уведомления о встречах</label><select id="notify-sel">'+opts(Object.entries(NOTIFY),i.notify)+'</select></div>':'')+
    '<button class="btn" type="button" data-act="share-interest" data-id="'+esc(i.id)+'">Поделиться</button>'+
    (MYBANS.has(i.id)&&!joined?'<button class="btn" type="button" disabled>Доступ закрыт</button>':'<button class="btn'+(joined?' on':' primary')+'" type="button" data-act="join-interest" data-id="'+esc(i.id)+'">'+(joined?'Вы участник':'Вступить')+'</button>')+'</div>';
  const sub='<div class="subtools">'+(mineOwner?'<button class="lnk" type="button" data-act="edit-interest" data-id="'+esc(i.id)+'">Редактировать</button>':'')+
    ((mineOwner||state.status.is_admin)?'<button class="lnk danger" type="button" data-act="del-interest" data-id="'+esc(i.id)+'">Удалить интерес</button>':'')+
    (!mineOwner?'<button class="lnk" type="button" data-act="report" data-type="interest" data-id="'+esc(i.id)+'">Пожаловаться</button>':'')+'</div>';
  return '<a class="back" href="#interests">← Все интересы</a>'+
    '<header class="ihead">'+badge(i,true)+'<div><h1>'+esc(i.title)+'</h1><div class="chips-row">'+catChip(i)+fmtChip(i)+'</div><p class="lead">'+esc(i.desc)+'</p>'+
    (i.tags.length?'<div class="icard-tags">'+i.tags.map(t=>'<span class="tag">'+esc(t)+'</span>').join('')+'</div>':'')+
    (i.rules?'<details class="rules"><summary>Правила интереса</summary><p>'+esc(i.rules)+'</p></details>':'')+
    '<p class="meta">Создал(а): '+ownerHtml+' · '+n+' '+plural(n,['участник','участника','участников'])+'</p>'+sub+
    (ownerMod(i)?'<p class="hint modhint">Вы создатель: можете редактировать интерес, удалять чужие сообщения, темы и встречи и исключать участников.</p>':'')+'</div>'+actions+'</header>'+
    '<div class="tabs2" role="tablist">'+tabs.map(t=>'<button type="button" role="tab" aria-selected="'+(tab===t[0])+'" data-act="tab" data-tab="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>'+
    '<div>'+tabBody(i,tab)+'</div>';
}
function tabBody(i,tab){
  if(tab==='chat')return chatTab(i);
  if(tab==='talks')return state.topic?topicView(i):talksList(i);
  if(tab==='meets')return meetsTab(i);
  return peopleTab(i);
}
function chatTab(i){
  if(!has(i.members)&&MYBANS.has(i.id))return '<div class="empty"><p>Создатель интереса закрыл вам доступ в этот чат.</p></div>';
  if(!has(i.members))return '<div class="empty"><p>Общий чат видят и пишут в него только участники интереса.</p><button class="btn primary" type="button" data-act="join-interest" data-id="'+esc(i.id)+'">Вступить в интерес</button></div>';
  return '<div class="chat"><div id="chat-pins"></div><div class="chat-list" id="chat-list" aria-live="polite" aria-label="Сообщения чата">'+(cache.chat[i.id]||'<p class="meta empty-chat">Загружаем…</p>')+'</div>'+
    '<div class="hints" id="chat-hints"></div><p class="typing" id="typing-chat" aria-live="polite"></p><div class="cbar" id="cbar-chat" hidden></div><p class="limwarn" id="lim-chat" role="alert" hidden></p><form class="chat-form" id="chat-form" novalidate><label class="sr" for="chat-in">Сообщение</label><textarea id="chat-in" rows="1" autocomplete="off" placeholder="Напишите сообщение и познакомьтесь"></textarea>'+attachBtn('chat')+(HAS_PO?'<button class="btn" type="button" data-act="poll-new" title="Создать опрос" aria-label="Создать опрос">📊</button>':'')+'<button class="btn primary" type="submit">Отправить</button></form>'+
    '<p class="hint">Новые сообщения появляются сами, каждые несколько секунд. Будьте вежливы: на грубость можно пожаловаться.<span class="desk-only"> Enter отправляет, Shift+Enter переносит строку.</span></p></div>';
}
function talksList(i){
  const head='<div class="rowhead"><h2>Обсуждения</h2><button class="btn primary sm" type="button" data-act="new-topic">Новая тема</button></div>';
  const topics=i.topics.filter(t=>!BLOCKED.has(t.a));
  if(!topics.length)return head+'<div class="empty"><p>Пока нет тем. Начните первое обсуждение.</p></div>';
  return head+'<div class="topics">'+topics.map(t=>{const c=t.comments.length;return '<button class="topic" type="button" data-act="open-topic" data-id="'+esc(t.id)+'"><b>'+esc(t.title)+'</b><span class="meta">'+esc(who(t.a).name)+' · '+c+' '+plural(c,['ответ','ответа','ответов'])+' · '+esc(ago(t.at))+'</span></button>';}).join('')+'</div>';
}
function topicView(i){
  const t=i.topics.find(x=>x.id===state.topic);
  if(!t){state.topic=null;return talksList(i);}
  const own=isMe(t.a),admin=state.status.is_admin||ownerMod(i);
  return '<button class="back" type="button" data-act="close-topic">← Все темы</button><h2>'+esc(t.title)+'</h2>'+
    '<p class="meta" style="margin-top:6px">Начал(а): '+pLink(t.a)+' · '+esc(ago(t.at))+'</p>'+
    (t.text?'<p class="topic-text">'+esc(t.text)+'</p>':'')+
    '<div class="subtools">'+((own||admin)?'<button class="lnk danger" type="button" data-act="del-topic" data-id="'+esc(t.id)+'">Удалить тему</button>':'')+(!own?'<button class="lnk" type="button" data-act="report" data-type="topic" data-id="'+esc(t.id)+'">Пожаловаться</button>':'')+'</div>'+
    '<div class="comments">'+t.comments.filter(c=>!BLOCKED.has(c.a)).map(c=>'<div class="comment">'+avLink(c.a,'md')+'<div><p>'+pLink(c.a)+' <span class="meta">'+esc(ago(c.at))+'</span></p><p>'+esc(c.t)+'</p>'+
      '<p class="macts" style="display:flex;gap:12px">'+((isMe(c.a)||admin)?'<button class="lnk danger" type="button" data-act="del-comment" data-id="'+esc(c.id)+'">Удалить</button>':'')+(!isMe(c.a)?'<button class="lnk" type="button" data-act="report" data-type="comment" data-id="'+esc(c.id)+'">Пожаловаться</button>':'')+'</p></div></div>').join('')+'</div>'+
    '<form class="reply" id="reply" novalidate><label class="sr" for="c-text">Ваш ответ</label><textarea id="c-text" placeholder="Напишите ответ" rows="3" maxlength="2000"></textarea><button class="btn primary" type="submit">Отправить</button></form>';
}
function meetsTab(i){
  const list=M.filter(m=>m.interestId===i.id).sort((a,b)=>a.when-b.when);
  const head='<div class="rowhead"><h2>Встречи</h2><button class="btn primary sm" type="button" data-act="new-meetup" data-id="'+esc(i.id)+'">Создать встречу</button></div>';
  return head+(list.length?'<div class="mlist">'+list.map(cardMeetup).join('')+'</div>':'<div class="empty"><p>Встреч пока нет. Назначьте первую: все участники интереса получат уведомление.</p></div>');
}
function peopleTab(i){
  const mod=ownerMod(i)||(V4&&state.status.is_admin);
  const head='<div class="rowhead"><h2>Участники</h2></div>'+(ownerMod(i)?'<p class="hint" style="margin-bottom:10px">Кнопка «Исключить» закрывает человеку доступ в интерес. Вернуть доступ можно в списке исключённых ниже.</p>':'');
  let out=head;
  if(!i.members.length)out+='<div class="empty"><p>Пока никого нет. Станьте первым участником.</p></div>';
  else out+='<div class="people">'+i.members.map(id=>{
    const p=who(id);
    const kick=mod&&id!==i.owner&&!isMe(id)?'<button class="btn sm warn" type="button" data-act="kick" data-id="'+esc(id)+'">Исключить</button>':'';
    const dm=canDM(id)?'<a class="btn sm" href="#messages-'+esc(id)+'">Написать</a>':'';
    return '<div class="person">'+avLink(id,'md')+'<div><span class="pn">'+pLink(id)+(isMe(id)?' (вы)':'')+(id===i.owner?' <span class="chip plain">создатель</span>':'')+'</span><span class="meta">'+(p.age?ageText(p.age):'')+(p.city?' · '+esc(p.city):'')+'</span></div>'+((dm||kick)?'<span class="pacts">'+dm+kick+'</span>':'')+'</div>';
  }).join('')+'</div>';
  const bl=(BANS[i.id]||[]).filter(b=>b.user!==(state.me&&state.me.id));
  if(mod&&bl.length)out+='<h3 class="subhead">Исключённые ('+bl.length+')</h3><div class="people">'+bl.map(b=>'<div class="person">'+av(who(b.user),'md')+'<div>'+pLink(b.user)+'<span class="meta">исключён(а) '+esc(ago(b.at))+'</span></div><span class="pacts"><button class="btn sm" type="button" data-act="unban" data-id="'+esc(b.user)+'">Вернуть доступ</button></span></div>').join('')+'</div>';
  return out;
}

/* ---------- встречи ---------- */
function citiesForFilter(){
  const s=new Set();
  M.forEach(m=>{if(m.city)s.add(m.city);});
  if(state.me&&state.me.city)s.add(state.me.city);
  return [...s].sort((a,b)=>a.localeCompare(b,'ru'));
}
function vMeetups(){
  const f=state.f;
  return '<div class="vhead"><h1>Встречи</h1><button class="btn primary" type="button" data-act="new-meetup">Создать встречу</button></div>'+SAFE_TIPS+
    '<form class="filters" id="mf" novalidate>'+
    fld('Город','f-city','<select id="f-city">'+opts([['','Все города']].concat(citiesForFilter().map(c=>[c,c])),f.city)+'</select>')+
    fld('Формат','f-format','<select id="f-format">'+opts([['','Любой'],['offline','Офлайн'],['online','Онлайн']],f.format)+'</select>')+
    fld('Интерес','f-interest','<select id="f-interest">'+opts([['','Все интересы']].concat(I.map(i=>[i.id,i.title])),f.interest)+'</select>')+
    fld('Ваш возраст','f-age','<input type="number" id="f-age" min="18" max="99" inputmode="numeric" placeholder="Любой" value="'+esc(f.age)+'">')+
    fld('Ваш пол','f-gender','<select id="f-gender">'+opts([['','Любой'],['f','Женщина'],['m','Мужчина']],f.gender)+'</select>')+
    '<button class="btn" type="button" data-act="reset-filters">Сбросить</button></form>'+
    '<p class="hint" style="margin-top:10px">Выбор города показывает встречи в этом городе и все онлайн-встречи. Возраст и пол оставляют только те встречи, куда вас пустят.</p>'+
    '<div class="fcount"><b id="mcount"></b></div><div class="mlist" id="mlist"></div>'+pastHtml();
}
function filtered(){
  const f=state.f,age=parseInt(f.age,10);
  return M.filter(m=>(!f.city||m.format==='online'||m.city===f.city)&&(!f.format||m.format===f.format)&&(!f.interest||m.interestId===f.interest)&&(!f.gender||m.g==='any'||m.g===f.gender)&&(!age||(age>=m.ageMin&&age<=m.ageMax))).sort((a,b)=>a.when-b.when);
}
function fillMeetups(){
  if(!$('#mlist'))return;
  const list=filtered();
  $('#mcount').textContent='Найдено: '+list.length+' '+plural(list.length,['встреча','встречи','встреч']);
  $('#mlist').innerHTML=list.length?list.map(cardMeetup).join(''):
    '<div class="empty"><p>По этим условиям встреч нет.</p><p class="meta">Измените фильтры или назначьте свою встречу.</p><div class="row"><button class="btn" type="button" data-act="reset-filters">Сбросить фильтры</button><button class="btn primary" type="button" data-act="new-meetup">Создать встречу</button></div></div>';
}

/* ---------- сообщения ---------- */
function vMessages(){
  const sug=recoPeople().filter(x=>canDM(x.p.id)).slice(0,6);
  return '<div class="vhead"><h1>Сообщения</h1></div><div id="convos">'+(CONVOS?convosHtml():'<p class="meta">Загружаем…</p>')+'</div>'+
    '<p class="hint" style="margin:14px 0 0">Написать можно друзьям и людям, с которыми у вас есть общий интерес. Вступайте в интересы и добавляйте людей в друзья.</p>'+
    (sug.length?'<section class="section"><h2 style="margin-bottom:14px">С кем можно познакомиться</h2><div class="reco">'+sug.map(x=>personCard(x.p,x.common)).join('')+'</div></section>':'');
}
async function loadConvos(){
  const r=await sb.from('direct_messages').select('id,sender_id,recipient_id,body,created_at,read_at').order('created_at',{ascending:false}).limit(300);
  if(r.error){const b=$('#convos');if(b)b.innerHTML='<p class="err">'+esc(errText(r.error))+'</p>';return;}
  const me=state.me.id,map=new Map();
  r.data.forEach(m=>{
    const o=m.sender_id===me?m.recipient_id:m.sender_id;
    if(BLOCKED.has(o))return;
    let c=map.get(o);
    if(!c){c={other:o,last:m,unread:0};map.set(o,c);}
    if(m.recipient_id===me&&!m.read_at)c.unread++;
  });
  CONVOS=[...map.values()];
  await ensurePeople(CONVOS.map(c=>c.other));
  const box=$('#convos');if(!box||state.view!=='messages')return;
  box.innerHTML=convosHtml();
}
function convosHtml(){
  const me=state.me.id;
  return CONVOS.length?'<div class="convos">'+CONVOS.map(c=>{const p=who(c.other);return '<a class="convo'+(c.unread?' unread':'')+'" href="#messages-'+esc(c.other)+'">'+av(p,'md')+'<div><b>'+esc(p.name)+'</b><span class="snip">'+(c.last.sender_id===me?'Вы: ':'')+esc(c.last.body)+'</span></div><span class="meta">'+esc(ago(c.last.created_at))+'</span>'+(c.unread?'<span class="count">'+c.unread+'</span>':'')+'</a>';}).join('')+'</div>':'<div class="empty"><p>Личных сообщений пока нет.</p><a class="btn primary" href="#interests">Найти интерес и знакомых</a></div>';
}
function vThread(){
  const id=state.arg;
  if(!UUID.test(id||'')||!PEOPLE[id]||id===state.me.id)return '<div class="empty"><p>Такого собеседника нет.</p><a class="btn" href="#messages">К сообщениям</a></div>';
  const p=PEOPLE[id];
  const can=canDM(id);
  const why=BLOCKED.has(id)?'Вы заблокировали этого человека. Разблокировать можно в его профиле.':'Писать можно друзьям и тем, с кем у вас есть общий интерес. Вступите в один из его интересов или добавьте человека в друзья.';
  const blocked=BLOCKED.has(id);
  return '<a class="back" href="#messages">← Все диалоги</a><div class="thread-head">'+avLink(id,'md')+'<div class="who">'+pLink(id)+'<span class="meta">'+ageText(p.age)+' · '+esc(p.city)+'</span></div>'+
    '<div class="th-acts">'+(HAS_FR&&!blocked&&frState(id)==='none'?'<button class="lnk" type="button" data-act="fr-add" data-id="'+esc(id)+'">В друзья</button>':'')+
    (blocked?'<button class="lnk" type="button" data-act="unblock" data-id="'+esc(id)+'">Разблокировать</button>':'<button class="lnk" type="button" data-act="block" data-id="'+esc(id)+'">Заблокировать</button>')+
    '<button class="lnk" type="button" data-act="report" data-type="user" data-id="'+esc(id)+'">Пожаловаться</button></div></div>'+
    '<div id="dm-safe"></div><div class="dm-list" id="dm-list" aria-live="polite">'+(cache.dm[id]||'<p class="meta empty-chat">Загружаем…</p>')+'</div>'+
    (can?'<p class="typing" id="typing-dm" aria-live="polite"></p><div class="hints" id="dm-hints"></div><div class="cbar" id="cbar-dm" hidden></div><p class="limwarn" id="lim-dm" role="alert" hidden></p><form class="chat-form" id="dm-form" novalidate style="margin-top:12px"><label class="sr" for="dm-in">Сообщение</label><textarea id="dm-in" rows="1" autocomplete="off" placeholder="Напишите сообщение"></textarea>'+attachBtn('dm')+'<button class="btn primary" type="submit">Отправить</button></form>'
      :'<div class="notice" style="margin-top:12px"><p>'+why+'</p></div>');
}
async function openThread(id){
  if(!UUID.test(id||'')||!PEOPLE[id])return;
  live.threadId=id;live.threadSig='';
  await pollThread(true);
}
async function pollThread(force){
  const o=live.threadId,me=state.me&&state.me.id;
  if(!o||!me||!$('#dm-list'))return;
  const r=await sb.from('direct_messages').select(msgCols('dm'))
    .or('and(sender_id.eq.'+me+',recipient_id.eq.'+o+'),and(sender_id.eq.'+o+',recipient_id.eq.'+me+')')
    .order('created_at',{ascending:false}).limit(100);
  if(r.error&&HAS_IMG&&/image_path/.test(r.error.message||'')){HAS_IMG=false;return pollThread(true);}
  if(r.error&&HAS_RE&&(r.error.code==='42703'||/reply_to|edited_at/.test(r.error.message||''))){HAS_RE=false;return pollThread(true);}
  if(r.error||o!==live.threadId||!$('#dm-list'))return;
  const msgs=r.data.slice().reverse();
  let rx=[];
  if(HAS_DMRX&&msgs.length){
    const rr=await sb.from('dm_reactions').select('message_id,user_id,reaction').in('message_id',msgs.map(m=>m.id));
    if(rr.error){if(rr.error.code==='42P01'||rr.error.code==='PGRST205'||/dm_reactions/.test(rr.error.message||''))HAS_DMRX=false;}
    else rx=rr.data||[];
    if(o!==live.threadId||!$('#dm-list'))return;
  }
  let st=null;
  if(HAS_ST){
    const sr=await sb.rpc('thread_status',{p_with:o});
    if(sr.error){if(missingErr(sr.error))HAS_ST=false;}else st=sr.data;
    if(o!==live.threadId||!$('#dm-list'))return;
  }
  const tl=$('#typing-dm');if(tl)tl.textContent=st&&st.typing?((PEOPLE[o]||{}).name||'Собеседник').split(' ')[0]+' печатает…':'';
  let lastReadId='';
  if(st&&st.read_upto){const up=new Date(st.read_upto).getTime();msgs.forEach(m=>{if(m.sender_id===me&&new Date(m.created_at).getTime()<=up)lastReadId=m.id;});}
  const showRead=m=>st?m.id===lastReadId:!!m.read_at;
  await signPhotos(msgs);
  if(o!==live.threadId||!$('#dm-list'))return;
  const sig=IMG.ver+msgs.map(m=>m.id+(showRead(m)?'r':'')+(m.edited_at||'')).join(',')+'|'+rx.map(x=>x.message_id+x.user_id+x.reaction).sort().join(',');
  if(msgs.some(m=>m.recipient_id===me&&!m.read_at)){
    if(CONVOS){const c=CONVOS.find(x=>x.other===o);if(c)c.unread=0;}
    sb.from('direct_messages').update({read_at:new Date().toISOString()}).eq('recipient_id',me).eq('sender_id',o).is('read_at',null).then(()=>refreshCounts());
  }
  if(sig===live.threadSig&&!force)return;
  live.threadSig=sig;
  msgs.forEach(m=>{MSG[m.id]={text:m.body,author:m.sender_id,dm:true,img:m.image_path||''};delete REACT[m.id];});
  rx.forEach(x=>{const o2=REACT[x.message_id]=REACT[x.message_id]||{};(o2[x.reaction]=o2[x.reaction]||[]).push(x.user_id);});
  const box=$('#dm-list');const near=box.scrollHeight-box.scrollTop-box.clientHeight<80;
  const openPk=pickersOpen(box);
  box.innerHTML=msgs.length?msgs.map(m=>{
    const mine=m.sender_id===me;
    return '<div class="dm'+(mine?' mine':'')+'" data-mid="'+esc(m.id)+'"><div class="bub">'+(m.reply_to?quoteHtml(m.reply_to):'')+picHtml(m)+(hideBody(m)?'':'<span class="bt">'+bodyHtml(m.id,m.body)+'</span>')+(m.edited_at?' <span class="edt">изменено</span>':'')+'</div>'+reactsHtml(m.id,'dm')+'<div class="meta"><span>'+esc(clock(m.created_at))+(mine&&showRead(m)?' · прочитано':'')+'</span>'+
      msgActs('dm',m,mine,mine?'<button class="lnk danger" type="button" data-act="del-dm" data-id="'+esc(m.id)+'">Удалить</button>':'')+'</div></div>';
  }).join(''):'<p class="meta empty-chat">Сообщений пока нет. Поздоровайтесь.</p>';
  cache.dm[o]=box.innerHTML;
  pickersRestore(box,openPk);
  const dh=$('#dm-hints');if(dh)dh.innerHTML=msgs.length?'':dmHints(o);
  const sf=$('#dm-safe');if(sf)sf.innerHTML=dmSafeHtml(msgs,o);
  updBar('dm');
  if(near||force)box.scrollTop=box.scrollHeight;
}

/* ---------- чат интереса ---------- */
async function openChat(id){live.chatId=id;live.chatSig='';await pollChat(true);}
async function pollChat(force){
  const id=live.chatId;
  if(!id||!$('#chat-list'))return;
  const r=await sb.from('chat_messages').select(msgCols('chat')).eq('interest_id',id).order('created_at',{ascending:false}).limit(100);
  if(r.error&&HAS_PO&&/poll_id/.test(r.error.message||'')){HAS_PO=false;return pollChat(true);}
  if(r.error&&HAS_IMG&&/image_path/.test(r.error.message||'')){HAS_IMG=false;return pollChat(true);}
  if(r.error&&HAS_RE&&(r.error.code==='42703'||/reply_to|edited_at/.test(r.error.message||''))){HAS_RE=false;return pollChat(true);}
  if(r.error||id!==live.chatId||!$('#chat-list'))return;
  const msgs=r.data.slice().reverse();
  await ensurePeople(msgs.map(m=>m.author_id));
  if(id!==live.chatId||!$('#chat-list'))return;
  const vis=msgs.filter(m=>!BLOCKED.has(m.author_id));
  let rx=[];
  if(vis.length){
    const rr=await sb.from('chat_reactions').select('message_id,user_id,reaction').in('message_id',vis.map(m=>m.id));
    if(!rr.error)rx=rr.data.filter(r=>!BLOCKED.has(r.user_id));
    if(id!==live.chatId||!$('#chat-list'))return;
    await ensurePeople(rx.map(r=>r.user_id));
  }
  await signPhotos(vis);
  if(id!==live.chatId||!$('#chat-list'))return;
  const ex=await loadChatExtras(id,vis);
  if(id!==live.chatId||!$('#chat-list'))return;
  const tl=$('#typing-chat');if(tl)tl.textContent=typingText(ex.typing);
  const pollSig=ex.polls?Object.keys(ex.polls).map(k=>k+(ex.polls[k].closed?'c':'')+ex.polls[k].opts.map(o=>o.cnt+(o.mine?'m':'')).join('.')).join(';'):'';
  const sig=IMG.ver+vis.map(m=>m.id+(m.edited_at||'')).join(',')+'|'+rx.map(r=>r.message_id+r.user_id+r.reaction).sort().join(',')+'|'+pollSig+'|'+ex.pins.map(x=>x.id).join(',');
  if(sig===live.chatSig&&!force)return;
  live.chatSig=sig;
  if(ex.polls)Object.assign(POLL,ex.polls);
  PINS=ex.pins;
  REACT={};rx.forEach(r=>{const o=REACT[r.message_id]=REACT[r.message_id]||{};(o[r.reaction]=o[r.reaction]||[]).push(r.user_id);});
  vis.forEach(m=>{MSG[m.id]={text:m.body,author:m.author_id,img:m.image_path||''};});
  ex.pins.forEach(x=>{if(!MSG[x.id])MSG[x.id]={text:x.text,author:x.author};});
  const pb=$('#chat-pins');if(pb)pb.innerHTML=pinsHtml();
  const box=$('#chat-list');const near=box.scrollHeight-box.scrollTop-box.clientHeight<80;
  const openPk=pickersOpen(box);
  box.innerHTML=vis.length?vis.map(m=>{
    const mine=isMe(m.author_id);
    const modDel=state.status.is_admin||ownerMod(interest(id));
    return '<div class="msg'+(mine?' mine':'')+'" data-mid="'+esc(m.id)+'">'+avLink(m.author_id,'sm')+'<div class="bub"><p class="mh">'+pLink(m.author_id)+'<span class="meta">'+esc(ago(m.created_at))+'</span></p>'+(m.reply_to?quoteHtml(m.reply_to):'')+(m.poll_id&&POLL[m.poll_id]?pollHtml(m):picHtml(m)+(hideBody(m)?'':'<p class="mt">'+bodyHtml(m.id,m.body)+(m.edited_at?' <span class="edt">изменено</span>':'')+'</p>'))+reactsHtml(m.id)+
      '<p class="macts">'+msgActs('chat',m,mine,((mine||modDel)?'<button class="lnk danger" type="button" data-act="del-chat" data-id="'+esc(m.id)+'">Удалить</button>':'')+(HAS_PIN&&modDel?'<button class="lnk" type="button" data-act="pin" data-id="'+esc(m.id)+'">Закрепить</button>':'')+(!mine?'<button class="lnk" type="button" data-act="report" data-type="chat" data-id="'+esc(m.id)+'">Пожаловаться</button>':''))+'</p></div></div>';
  }).join(''):'<p class="meta empty-chat">Пока тишина. Напишите первое сообщение.</p>';
  cache.chat[id]=box.innerHTML;
  pickersRestore(box,openPk);
  const ch=$('#chat-hints');
  const last=vis.length?new Date(vis[vis.length-1].created_at).getTime():0;
  if(ch)ch.innerHTML=(vis.length<4||Date.now()-last>24*3600e3)?chatHints(id):'';
  updBar('chat');
  if(near||force)box.scrollTop=box.scrollHeight;
  markSeen(id);
}

/* ---------- реакции, подсказки, «поделиться» ---------- */
function pickersOpen(box){return [...box.querySelectorAll('.rx-pick:not([hidden]) .rx.pick')].map(b=>b.dataset.id).filter((v,k,a)=>a.indexOf(v)===k);}
function pickersRestore(box,ids){
  ids.forEach(id=>{
    const b=box.querySelector('.rx-pick .rx.pick[data-id="'+id+'"]');if(!b)return;
    const pk=b.parentElement;pk.hidden=false;
    const add=pk.previousElementSibling;if(add)add.setAttribute('aria-expanded','true');
  });
}
function reactsHtml(mid,kind){
  const dm=kind==='dm';
  if(dm&&!HAS_DMRX)return '';
  const dk=dm?' data-kind="dm"':'';
  const r=REACT[mid]||{};
  const chips=Object.keys(RX).filter(k=>r[k]&&r[k].length).map(k=>{
    const mine=state.me&&r[k].includes(state.me.id);
    const names=r[k].map(id=>who(id).name).slice(0,8).join(', ');
    return '<button type="button" class="rx'+(mine?' on':'')+'" data-act="react"'+dk+' data-id="'+esc(mid)+'" data-r="'+k+'" title="'+esc(names)+'" aria-pressed="'+(!!mine)+'" aria-label="'+RX[k]+' '+r[k].length+': '+esc(names)+'">'+RX[k]+' <b>'+r[k].length+'</b></button>';
  }).join('');
  const pick=Object.keys(RX).map(k=>'<button type="button" class="rx pick" data-act="react"'+dk+' data-id="'+esc(mid)+'" data-r="'+k+'" aria-label="Поставить '+RX[k]+'">'+RX[k]+'</button>').join('');
  return '<div class="reacts">'+chips+'<span class="rx-wrap"><button type="button" class="rx add" data-act="react-menu" aria-label="Добавить реакцию" aria-expanded="false">+</button><span class="rx-pick" hidden>'+pick+'</span></span></div>';
}
const HINT_GEN=['Привет! Расскажите, как вы пришли в «{t}»?','Кто здесь давно? Подскажите новичку, с чего лучше начать.','Давайте знакомиться: напишите, откуда вы и что больше всего любите в «{t}».'];
const HINT_CAT={sport:'Кто на этой неделе идёт тренироваться? Присоединяйтесь!',games:'Во что играем в первую очередь? Предлагайте!',creative:'Покажите, над чем вы работаете сейчас?',music:'Что слушаете в последнее время? Поделитесь находкой.',culture:'Что недавно смотрели или читали и можете посоветовать?',travel:'Какое место рядом вы бы посоветовали посетить?',food:'Любимое место или рецепт? Делитесь.',learning:'Чему вы хотите научиться в первую очередь?',tech:'Над каким проектом вы работаете? Нужна ли помощь?',other:'Чем вы занимаетесь в свободное время?'};
function hintChips(list){
  return '<span class="hint-l">Не знаете, с чего начать? Нажмите на подсказку:</span>'+list.map(t=>'<button type="button" class="hint-chip" data-act="hint" data-text="'+esc(t)+'">'+esc(t)+'</button>').join('');
}
function chatHints(id){
  const i=interest(id);if(!i)return '';
  const h=hueOf(id)%HINT_GEN.length;
  const list=[HINT_GEN[h],HINT_GEN[(h+1)%HINT_GEN.length],HINT_CAT[i.cat]||HINT_CAT.other].map(t=>t.replace('{t}',i.title));
  return hintChips(list);
}
function dmHints(oid){
  const me=state.me,p=PEOPLE[oid],f=me.g==='f';
  const common=commonWith(oid);
  const list=[];
  if(common.length){
    list.push('Привет! '+(f?'Увидела':'Увидел')+', что мы оба в «'+common[0].title+'». Как давно вы этим занимаетесь?');
    list.push('Привет! Меня зовут '+me.name.split(' ')[0]+'. '+(f?'Захотела':'Захотел')+' познакомиться, потому что нас объединяет «'+common[0].title+'».');
  }
  if(p&&p.about){const a=p.about.replace(/\s+/g,' ').slice(0,60);list.push('Привет! '+(f?'Прочитала':'Прочитал')+' ваш профиль: «'+a+(p.about.length>60?'…':'')+'». Расскажете подробнее?');}
  if(!list.length)list.push('Привет! Давайте знакомиться.');
  return hintChips(list.slice(0,3));
}
function pageUrl(h){return location.origin+location.pathname+(h?'#'+h:'');}
async function shareIt(text,h){
  const url=pageUrl(h);
  if(navigator.share){try{await navigator.share({text,url});return;}catch(e){if(e&&e.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(text+' '+url);toast('Ссылка скопирована. Отправьте её друзьям.');return;}catch(e){}
  openModal('Поделиться','<p>Скопируйте и отправьте друзьям:</p><input type="text" id="share-url" readonly value="'+esc(text+' '+url)+'" style="margin-top:8px"><div class="row" style="margin-top:12px"><button class="btn" type="button" data-act="close">Закрыть</button></div>');
  const f=$('#share-url');if(f){f.focus();f.select();}
}
function openLink(link){
  const parts=String(link||'').split('|'),h=parts[0],tab=parts[1];
  if(!h||!/^[A-Za-z0-9_\-\/]+$/.test(h)||(tab&&!/^[a-z]+$/.test(tab)))return;
  if(tab){state.pendingTab=tab;if(h==='interest-'+state.arg)state.tab=tab;}
  go(h);
}
const foundBadge=id=>FOUNDERS.has(id)?'<span class="chip founder" title="Один из первых '+FOUNDERS_N+' участников">Один из первых</span>':'';

/* ---------- главная: «скоро», лента, приглашение ---------- */
function soonCard(){
  const now=Date.now();
  const m=M.filter(x=>has(x.going)&&x.when.getTime()>now-3*3600e3&&x.when.getTime()<now+72*3600e3).sort((a,b)=>a.when-b.when)[0];
  if(!m)return '';
  const it=interest(m.interestId)||{title:'',hue:200};
  const diff=m.when.getTime()-now;
  let label;
  if(diff<=0)label='Идёт сейчас';
  else if(diff<3600e3)label='Через '+Math.max(1,Math.floor(diff/60000))+' мин';
  else if(diff<24*3600e3){const h=Math.floor(diff/3600e3),mm=Math.floor((diff%3600e3)/60000);label='Через '+h+' ч'+(mm?' '+mm+' мин':'');}
  else{const t=new Date();t.setDate(t.getDate()+1);label=ymd(m.when)===ymd(t)?'Завтра в '+clock(m.when):when(m.when);}
  const online=m.format==='online';
  return '<section class="soon" aria-label="Ближайшая встреча"><div class="soon-when">'+esc(label)+'</div><div class="soon-body"><b>'+esc(m.title)+'</b><span class="meta">'+esc(it.title)+' · '+(online?'онлайн':esc(m.place)+', '+esc(m.city))+' · идут: '+m.going.length+'</span></div><a class="btn sm primary" href="#interest-'+esc(m.interestId)+'/meets">Открыть</a></section>';
}
const vb=(id,m,f)=>who(id).g==='f'?f:m;
function feedItems(){
  const me=state.me,now=Date.now(),week=now-7*86400e3,items=[];
  const lead=i=>'<span class="av av-sm tint" style="--h:'+esc(i.hue)+'">'+esc(i.title.charAt(0))+'</span>';
  I.filter(i=>has(i.members)).forEach(i=>{
    const n=UNREAD[i.id]||0;
    if(n)items.push({t:now,lead:lead(i),text:'В чате «'+i.title+'»: '+n+' '+plural(n,['новое сообщение','новых сообщения','новых сообщений']),sub:'Открыть чат',link:'interest-'+i.id+'|chat'});
    M.filter(m=>m.interestId===i.id&&m.created&&m.created.getTime()>week&&m.host&&m.host!==me.id&&!BLOCKED.has(m.host)&&m.when.getTime()>now).forEach(m=>{
      items.push({t:m.created.getTime(),lead:avLink0(m.host),text:who(m.host).name+' '+vb(m.host,'назначил','назначила')+' встречу «'+m.title+'»',sub:i.title+' · '+when(m.when),link:'interest-'+i.id+'|meets'});
    });
    i.topics.filter(t=>new Date(t.at).getTime()>week&&t.a!==me.id&&!BLOCKED.has(t.a)).forEach(t=>{
      items.push({t:new Date(t.at).getTime(),lead:avLink0(t.a),text:who(t.a).name+' '+vb(t.a,'начал','начала')+' тему «'+t.title+'»',sub:i.title,link:'interest-'+i.id+'|talks'});
    });
    const fresh=i.members.filter(u=>u!==me.id&&!BLOCKED.has(u)&&i.joined[u]&&new Date(i.joined[u]).getTime()>week);
    if(fresh.length){
      const t=Math.max.apply(null,fresh.map(u=>new Date(i.joined[u]).getTime()));
      items.push({t,lead:fresh.length===1?avLink0(fresh[0]):lead(i),text:fresh.length===1?who(fresh[0]).name+' '+vb(fresh[0],'вступил','вступила')+' в «'+i.title+'»':fresh.length+' '+plural(fresh.length,['новый участник','новых участника','новых участников'])+' в «'+i.title+'»',sub:'Познакомьтесь',link:'interest-'+i.id+'|people'});
    }
  });
  return items.sort((a,b)=>b.t-a.t).slice(0,8);
}
function avLink0(id){return av(who(id),'sm');}
function feedHtml(){
  const it=feedItems();
  if(!it.length)return '';
  return '<section class="section"><div class="rowhead"><h2>Что нового</h2></div><div class="feed">'+it.map(x=>'<button type="button" class="feed-item" data-act="open-link" data-link="'+esc(x.link)+'">'+x.lead+'<span class="ft"><b>'+esc(x.text)+'</b><span class="meta">'+esc(x.sub)+(x.t<Date.now()-60000?' · '+esc(ago(new Date(x.t).toISOString())):'')+'</span></span></button>').join('')+'</div></section>';
}
function inviteCard(){
  return '<section class="invite"><div><b>Позовите друзей</b><span class="meta">Чем больше людей, тем интереснее чаты и встречи. Отправьте приглашение в мессенджер.</span></div><button class="btn primary sm" type="button" data-act="share-site">Позвать друзей</button></section>';
}
function welcomeBanner(){
  return '<section class="invite"><div><b>Выберите, что вам интересно</b><span class="meta">Мы покажем людей, чаты и встречи по вашим интересам.</span></div><a class="btn primary sm" href="#welcome">Выбрать интересы</a></section>';
}
function vWelcome(){
  const mineN=I.filter(i=>has(i.members)).length;
  const list=I.slice().sort((a,b)=>b.members.length-a.members.length).slice(0,30);
  return '<div class="vhead"><h1>Что вам интересно?</h1></div><p class="lead" style="max-width:58ch;margin-bottom:18px">Отметьте несколько интересов. По ним мы подберём людей, чаты и встречи. Изменить выбор можно в любой момент.</p>'+
    (list.length?'<div class="pickgrid" role="group" aria-label="Интересы">'+list.map(i=>{const on=has(i.members),n=i.members.length;return '<button type="button" class="pick'+(on?' on':'')+'" data-act="join-interest" data-id="'+esc(i.id)+'" aria-pressed="'+on+'">'+badge(i)+'<span class="pt"><b>'+esc(i.title)+'</b><span class="meta">'+esc(CATS[i.cat]||CATS.other)+' · '+n+' '+plural(n,['участник','участника','участников'])+'</span></span><span class="tick" aria-hidden="true">'+(on?'\u2713':'+')+'</span></button>';}).join('')+'</div>':'<div class="empty"><p>Интересов пока нет. Создайте первый.</p></div>')+
    '<div class="stickybar"><span class="meta">Выбрано: '+mineN+'</span><button class="btn" type="button" data-act="new-interest">Создать свой</button><a class="btn" href="#interests">Все интересы</a><a class="btn primary" href="#home">Готово</a></div>';
}

/* ---------- человек ---------- */
function vUser(){
  const id=state.arg;
  if(!UUID.test(id||'')||!PEOPLE[id])return '<div class="empty"><p>Такого человека нет.</p><a class="btn" href="#interests">К интересам</a></div>';
  if(id===state.me.id)return vProfile();
  const p=PEOPLE[id],common=commonWith(id);
  const their=I.filter(i=>i.members.includes(id));
  const going=M.filter(m=>m.going.includes(id)).sort((a,b)=>a.when-b.when).slice(0,3);
  const blocked=BLOCKED.has(id);
  const urls=photoUrls(p);
  const fs=HAS_FR&&!blocked?frState(id):'';
  const frBtns=!HAS_FR||blocked?'':(fs==='none'?'<button class="btn" type="button" data-act="fr-add" data-id="'+esc(id)+'">Добавить в друзья</button>':
    fs==='out'?'<span class="chip plain">Заявка отправлена</span><button class="btn sm" type="button" data-act="fr-cancel" data-id="'+esc(id)+'">Отменить заявку</button>':
    fs==='in'?'<button class="btn primary" type="button" data-act="fr-accept" data-id="'+esc(id)+'">Принять заявку</button><button class="btn sm" type="button" data-act="fr-decline" data-id="'+esc(id)+'">Отклонить</button>':
    '<span class="chip founder">Вы друзья</span><button class="btn sm" type="button" data-act="fr-remove" data-id="'+esc(id)+'">Удалить из друзей</button>');
  const ava=urls.length?'<button type="button" class="avbtn" data-act="lightbox" data-id="'+esc(id)+'" data-i="0" aria-label="Открыть фото">'+av(p,'lg')+'</button>':av(p,'lg');
  return '<a class="back" href="javascript:history.back()" data-act="back">← Назад</a>'+
    '<div class="upage">'+ava+'<div><h1>'+esc(p.name)+'</h1><p class="meta">'+ageText(p.age)+' · '+esc(p.city)+' · '+(p.g==='f'?'женщина':'мужчина')+'</p>'+foundBadge(id)+
    (p.about?'<p class="about">'+esc(p.about)+'</p>':'')+
    (urls.length>1?'<div class="gal-row">'+urls.map((u,k)=>'<button type="button" class="gth" data-act="lightbox" data-id="'+esc(id)+'" data-i="'+k+'" aria-label="Фото '+(k+1)+'"><img src="'+esc(u)+'" alt=""></button>').join('')+'</div>':'')+
    '<div class="row">'+(canDM(id)?'<a class="btn primary" href="#messages-'+esc(id)+'">Написать</a>':(!blocked?'<span class="meta">Написать можно друзьям и людям с общим интересом.</span>':''))+frBtns+
    (blocked?'<button class="btn" type="button" data-act="unblock" data-id="'+esc(id)+'">Разблокировать</button>':'<button class="btn" type="button" data-act="block" data-id="'+esc(id)+'">Заблокировать</button>')+
    '<button class="btn" type="button" data-act="report" data-type="user" data-id="'+esc(id)+'">Пожаловаться</button></div>'+
    (state.status.is_admin?'<div class="row"><button class="btn warn sm" type="button" data-act="adm-ban" data-id="'+esc(id)+'">Ограничить</button><button class="btn sm" type="button" data-act="adm-unban" data-id="'+esc(id)+'">Снять ограничение</button></div>':'')+'</div></div>'+
    d_anketaView(id)+
    (common.length?'<section><h2 style="margin-bottom:12px">Общие интересы</h2><div class="chips">'+common.map(i=>'<a class="chip tint" style="--h:'+esc(i.hue)+';font-size:.95rem;padding:.35em .9em" href="#interest-'+esc(i.id)+'">'+esc(i.title)+'</a>').join('')+'</div></section>':'')+
    '<section class="section"><h2 style="margin-bottom:12px">Интересы</h2>'+(their.length?'<div class="chips">'+their.map(i=>'<a class="chip tint" style="--h:'+esc(i.hue)+';font-size:.95rem;padding:.35em .9em" href="#interest-'+esc(i.id)+'">'+esc(i.title)+'</a>').join('')+'</div>':'<p class="meta">Пока ни в каком.</p>')+'</section>'+
    (going.length?'<section class="section"><h2 style="margin-bottom:12px">Идёт на встречи</h2><div class="mlist">'+going.map(cardMeetup).join('')+'</div></section>':'')+hostRatingHtml(id);
}

/* ---------- уведомления ---------- */
function vNotes(){
  return '<div class="vhead"><h1>Уведомления</h1><button class="btn sm" type="button" data-act="read-all">Отметить все прочитанными</button></div>'+pushCard()+'<div id="notes"></div>'+
    '<p class="hint" style="margin-top:14px">Уведомления о новых встречах можно выключить внутри каждого интереса. Письма не отправляются: уведомления видны здесь, а на телефон приходят, если включить их выше.</p>';
}
function fillNotes(){
  const box=$('#notes');if(!box)return;
  box.innerHTML=NOTES.length?'<div class="notes">'+NOTES.map(n=>'<button class="note '+(n.read_at?'read':'unread')+'" type="button" data-act="open-note" data-id="'+esc(n.id)+'"><span class="dotu"></span><div><b>'+esc(n.title)+'</b><span>'+esc(n.body)+'</span><span class="meta">'+esc(ago(n.created_at))+'</span></div></button>').join('')+'</div>':'<div class="empty"><p>Пока ничего нового. Когда в ваших интересах появятся встречи, мы сообщим здесь.</p></div>';
}
async function loadNotes(){
  const r=await sb.from('notifications').select('id,kind,title,body,link,read_at,created_at').order('created_at',{ascending:false}).limit(40);
  if(!r.error){NOTES=r.data;state.unreadN=NOTES.filter(n=>!n.read_at).length;renderTop();}
  if(state.view==='notifications')fillNotes();
}

/* ---------- профиль ---------- */
function photoPick(){
  return '<div class="photo-pick"><span id="photo-prev">'+av({name:'?',hue:190,photo:state.photoUrl},'lg')+'</span><label class="btn pickbtn">Выбрать фото<input class="sr" type="file" id="photo" accept="image/*"></label></div>';
}
function vAuth(){
  const su=state.authMode==='signup';
  const tabs='<div class="tabs2" role="tablist"><button type="button" role="tab" aria-selected="'+su+'" data-act="auth-mode" data-mode="signup">Регистрация</button><button type="button" role="tab" aria-selected="'+(!su)+'" data-act="auth-mode" data-mode="login">Вход</button></div>';
  const notice=state.notice?'<div class="notice" role="status"><p>'+esc(state.notice)+'</p></div>':'';
  if(!su){
    return '<div class="vhead"><h1>Вход</h1></div>'+tabs+notice+
      '<form class="form" id="login" novalidate>'+fld('Почта','li-email','<input type="email" id="li-email" autocomplete="email">')+fld('Пароль','li-pw','<input type="password" id="li-pw" autocomplete="current-password">')+
      '<div id="cf-box" class="cfbox"></div><p class="err" id="err" role="alert"></p><div><button class="btn primary" type="submit" id="submit-btn">Войти</button></div></form>';
  }
  return '<div class="vhead"><h1>Регистрация</h1></div>'+tabs+notice+
    '<form class="form" id="signup" novalidate>'+photoPick()+
    fld('Почта','su-email','<input type="email" id="su-email" autocomplete="email" placeholder="name@example.com">')+
    fld('Пароль','su-pw','<input type="password" id="su-pw" autocomplete="new-password" minlength="6" placeholder="Не меньше 6 символов">')+
    fld('Имя','su-name','<input type="text" id="su-name" maxlength="40" autocomplete="given-name" placeholder="Например, Анна">')+
    '<div class="two">'+fld('Возраст','su-age','<input type="number" id="su-age" min="18" max="99" inputmode="numeric" placeholder="25">')+cityField('su-city','Город','','Начните вводить')+'</div>'+
    '<p class="hint" style="margin-top:-8px">Выберите город из подсказок. Если его нет в списке, впишите название целиком, и он добавится.</p>'+
    '<div class="field"><span class="lbl" id="sg-l">Пол</span><div class="segs" role="radiogroup" aria-labelledby="sg-l"><label class="seg"><input type="radio" name="sg" value="f"><span>Женщина</span></label><label class="seg"><input type="radio" name="sg" value="m"><span>Мужчина</span></label></div></div>'+
    fld('О себе','su-about','<textarea id="su-about" maxlength="300" placeholder="Пара слов о том, чем вы любите заниматься"></textarea>')+
    '<div class="check"><input type="checkbox" id="su-consent"><label for="su-consent">Я согласен(на) на обработку моих данных для работы сайта. Мне есть 18 лет.</label></div>'+
    '<details class="more"><summary>Какие данные мы храним</summary><p>Почту, имя, возраст, город, пол, текст «О себе» и фото, если вы его загрузили. Имя, возраст, город, пол, «О себе» и фото видят другие зарегистрированные пользователи. Почту и пароль не видит никто, кроме вас. Данные хранятся в облачном сервисе Supabase на серверах в Европе. Это тестовая версия. Профиль и все ваши данные можно удалить в любой момент на странице «Профиль».</p></details>'+
    '<div id="cf-box" class="cfbox"></div><p class="err" id="err" role="alert"></p><div><button class="btn primary" type="submit" id="submit-btn">Создать профиль</button></div></form>';
}
function vProfile(){
  const me=state.me;
  if(!me)return vNoProfile();
  const mine=I.filter(i=>has(i.members));
  const mymeets=M.filter(m=>has(m.going)).sort((a,b)=>a.when-b.when);
  const blocked=[...BLOCKED].filter(id=>PEOPLE[id]);
  return '<div class="pro"><span id="avatar-box">'+av(me,'lg')+'</span><div><h1>'+esc(me.name)+'</h1><p class="meta">'+ageText(me.age)+' · '+esc(me.city)+' · '+(me.g==='f'?'женщина':'мужчина')+'</p>'+foundBadge(me.id)+
    (me.about?'<p style="max-width:60ch;white-space:pre-wrap;overflow-wrap:anywhere">'+esc(me.about)+'</p>':'')+
    '<div class="row" style="margin-top:6px"><button class="btn sm" type="button" data-act="edit-profile">Редактировать</button>'+
    '<a class="btn sm" href="#friends">Друзья'+(state.frIn?'<span class="count">'+state.frIn+'</span>':'')+'</a>'+
    '<button class="btn sm" type="button" data-act="share-site">Позвать друзей</button>'+
    (state.status.is_admin?'<a class="btn sm" href="#admin">Модерация'+(state.openReports?'<span class="count">'+state.openReports+'</span>':'')+'</a>':'')+'</div></div></div>'+
    galleryHtml()+profileDatingCard()+privacyCard()+
    '<section class="section"><h2 style="margin-bottom:14px">Мои интересы</h2>'+(mine.length?'<div class="chips">'+mine.map(i=>'<a class="chip tint" style="--h:'+esc(i.hue)+';font-size:.95rem;padding:.35em .9em" href="#interest-'+esc(i.id)+'">'+esc(i.title)+'</a>').join('')+'</div>':'<div class="empty"><p>Вы пока не вступили ни в один интерес.</p><a class="btn primary" href="#interests">Найти интерес</a></div>')+'</section>'+
    '<section class="section"><h2 style="margin-bottom:14px">Мои встречи</h2>'+(mymeets.length?'<div class="mlist">'+mymeets.map(cardMeetup).join('')+'</div>':'<div class="empty"><p>Вы пока никуда не записаны.</p><a class="btn primary" href="#meetups">Найти встречу</a></div>')+'</section>'+
    (blocked.length?'<section class="section"><h2 style="margin-bottom:14px">Заблокированные</h2><div class="blist">'+blocked.map(id=>'<div class="brow"><span>'+esc(who(id).name)+'</span><button class="btn sm" type="button" data-act="unblock" data-id="'+esc(id)+'">Разблокировать</button></div>').join('')+'</div></section>':'')+
    '<section class="section"><h2 style="margin-bottom:14px">Телефон и уведомления</h2>'+installCard(true)+pushCard()+'</section>'+
    '<section class="section"><div class="row"><button class="btn warn" type="button" data-act="logout">Выйти</button><button class="btn warn" type="button" data-act="del-account">Удалить профиль</button></div></section>';
}

/* ---------- модерация ---------- */
function vAdmin(){
  if(!state.status.is_admin)return '<div class="empty"><p>Эта страница только для администратора.</p><a class="btn" href="#home">На главную</a></div>';
  const t=state.adminTab;
  const tabs=[['reports','Жалобы'+(state.openReports?' ('+state.openReports+')':'')],['people','Люди'],['cities','Новые города']];
  return '<div class="vhead"><h1>Модерация</h1></div><div class="tabs2" role="tablist">'+tabs.map(x=>'<button type="button" role="tab" aria-selected="'+(t===x[0])+'" data-act="admin-tab" data-tab="'+x[0]+'">'+x[1]+'</button>').join('')+'</div><div id="admin-body"><p class="meta">Загружаем…</p></div>';
}
async function loadAdmin(){
  if(!state.status.is_admin)return;
  const [rep,ban,cit]=await Promise.all([
    sb.from('reports').select('id,reporter_id,target_type,target_id,target_user_id,reason,details,snapshot,status,created_at').order('created_at',{ascending:false}).limit(100),
    sb.rpc('admin_banned_users'),
    sb.from('cities').select('id,label,created_at').eq('user_added',true).order('created_at',{ascending:false}).limit(200)
  ]);
  ADMIN.reports=rep.error?[]:rep.data;
  ADMIN.banned=new Set((ban.error?[]:ban.data).map(r=>r.id));
  ADMIN.cities=cit.error?[]:cit.data;
  ADMIN.loaded=true;
  await ensurePeople(ADMIN.reports.flatMap(r=>[r.reporter_id,r.target_user_id]));
  state.openReports=ADMIN.reports.filter(r=>r.status==='open').length;
  renderTop();
  fillAdmin();
}
function fillAdmin(){
  const box=$('#admin-body');if(!box||state.view!=='admin')return;
  const t=state.adminTab;
  if(t==='reports'){
    const open=ADMIN.reports.filter(r=>r.status==='open'),done=ADMIN.reports.filter(r=>r.status!=='open').slice(0,15);
    const card=r=>{
      const delTypes=['topic','comment','chat','interest','meetup'];
      return '<article class="rep"><div class="row"><b>'+esc(TARGETS[r.target_type]||r.target_type)+'</b><span class="chip plain">'+esc(REASONS[r.reason]||r.reason)+'</span><span class="meta">'+esc(ago(r.created_at))+'</span></div>'+
        '<p class="meta">От: '+(r.reporter_id&&PEOPLE[r.reporter_id]?pLink(r.reporter_id):'удалён')+' · На: '+(r.target_user_id&&PEOPLE[r.target_user_id]?pLink(r.target_user_id)+(ADMIN.banned.has(r.target_user_id)?' (ограничен)':''):'неизвестно')+'</p>'+
        (r.snapshot?'<p class="snip">'+esc(r.snapshot)+'</p>':'')+(r.details?'<p class="meta">Комментарий: '+esc(r.details)+'</p>':'')+
        (r.status==='open'?'<div class="row">'+(delTypes.includes(r.target_type)?'<button class="btn sm warn" type="button" data-act="adm-del" data-id="'+esc(r.id)+'">Удалить содержимое</button>':'')+
          (r.target_user_id&&!ADMIN.banned.has(r.target_user_id)?'<button class="btn sm warn" type="button" data-act="adm-ban" data-id="'+esc(r.target_user_id)+'" data-report="'+esc(r.id)+'">Ограничить человека</button>':'')+
          '<button class="btn sm" type="button" data-act="adm-done" data-id="'+esc(r.id)+'">Готово</button><button class="btn sm" type="button" data-act="adm-dismiss" data-id="'+esc(r.id)+'">Отклонить</button></div>':'<p class="meta">'+(r.status==='done'?'Обработана':'Отклонена')+'</p>')+'</article>';
    };
    box.innerHTML='<div class="reps">'+(open.length?open.map(card).join(''):'<div class="empty"><p>Новых жалоб нет.</p></div>')+(done.length?'<h2 style="margin-top:14px">Недавно обработанные</h2>'+done.map(card).join(''):'')+'</div>';
  }else if(t==='people'){
    const ppl=Object.values(PEOPLE).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
    box.innerHTML='<div class="reps">'+ppl.map(p=>'<div class="rowline"><span>'+pLink(p.id)+' <span class="meta">'+ageText(p.age)+' · '+esc(p.city)+'</span>'+(ADMIN.banned.has(p.id)?' <span class="chip plain">ограничен</span>':'')+'</span>'+
      (p.id===state.me.id?'':(ADMIN.banned.has(p.id)?'<button class="btn sm" type="button" data-act="adm-unban" data-id="'+esc(p.id)+'">Снять ограничение</button>':'<button class="btn sm warn" type="button" data-act="adm-ban" data-id="'+esc(p.id)+'">Ограничить</button>'))+'</div>').join('')+'</div>';
  }else{
    box.innerHTML='<p class="hint" style="margin-bottom:12px">Города, которые люди добавили сами. Если название лишнее или с ошибкой, удалите его: в профилях оно останется, но в подсказках больше не появится.</p><div class="reps">'+(ADMIN.cities.length?ADMIN.cities.map(c=>'<div class="rowline"><span>'+esc(c.label)+'</span><button class="btn sm warn" type="button" data-act="adm-city-del" data-id="'+esc(c.id)+'">Удалить</button></div>').join(''):'<div class="empty"><p>Добавленных людьми городов пока нет.</p></div>')+'</div>';
  }
}

/* ---------- отрисовка ---------- */
function renderTop(){
  const cur=state.view==='interest'?'interests':(state.view==='thread'?'messages':(['anketa','filter','test'].indexOf(state.view)>=0?'dating':state.view));
  const items=[['home','Главная'],['interests','Интересы'],['meetups','Встречи'],['messages','Сообщения'],['friends','Друзья'],['dating','Знакомства'],['profile','Профиль']];
  $('#nav').innerHTML=items.map(it=>'<a href="#'+it[0]+'"'+(it[0]===cur?' aria-current="page"':'')+'>'+it[1]+(it[0]==='messages'&&state.unreadDM?'<span class="count">'+state.unreadDM+'</span>':'')+(it[0]==='interests'&&state.unreadChat?'<span class="count">'+state.unreadChat+'</span>':'')+(it[0]==='friends'&&state.frIn?'<span class="count">'+state.frIn+'</span>':'')+'</a>').join('');
  if(state.session&&state.me){
    $('#acct').innerHTML='<a class="bell" href="#notifications" aria-label="Уведомления'+(state.unreadN?': '+state.unreadN+' новых':'')+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>'+(state.unreadN?'<span class="count">'+(state.unreadN>99?'99+':state.unreadN)+'</span>':'')+'</a>'+
      '<a class="me" href="#profile">'+av(state.me,'sm')+'<span class="nm">'+esc(state.me.name.split(' ')[0])+'</span></a>';
  }else $('#acct').innerHTML='<a class="btn primary sm" href="#profile">Войти</a>';
}
function render(){
  renderTop();
  const v=state.view;
  let html;
  const ready=state.session&&state.loaded&&state.me;
  if(!SB_OK)html=vSetup();
  else if(v==='home')html=vHome();
  else if(v==='profile'&&!state.session)html=vAuth();
  else if(!state.session)html=vGate(v);
  else if(!state.loaded)html=state.loadError?vLoadError():vLoading();
  else if(!state.me)html=vNoProfile();
  else html=({interests:vInterests,interest:vInterest,meetups:vMeetups,messages:vMessages,thread:vThread,user:vUser,friends:vFriends,dating:vDating,anketa:vAnketa,filter:vFilter,test:vTest,notifications:vNotes,profile:vProfile,admin:vAdmin,welcome:vWelcome}[v]||vHome)();
  $('#view').innerHTML=(ready&&state.status.banned?bannedBanner():'')+html;
  afterRender();
  growAll($('#view'));
}
/* капча Cloudflare Turnstile (если в config.js задан turnstile) */
const CAP={token:'',id:null};
const capKey=()=>((window.KRUZHOK_CONFIG||{}).turnstile||'');
const capOpt=()=>CAP.token?{captchaToken:CAP.token}:{};
function capReset(){CAP.token='';try{if(window.turnstile&&CAP.id!==null)window.turnstile.reset(CAP.id);}catch(e){}}
const capErr=e=>/captcha/i.test((e&&e.message)||'')?'Подтвердите, что вы не робот (галочка выше), и попробуйте ещё раз.':errText(e);
function capMount(){
  const box=document.getElementById('cf-box');if(!box||!capKey()||box.childElementCount)return;
  const draw=()=>{
    if(!window.turnstile||!document.getElementById('cf-box'))return;
    CAP.token='';
    try{CAP.id=window.turnstile.render('#cf-box',{sitekey:capKey(),callback:t=>{CAP.token=t;},'expired-callback':()=>{CAP.token='';},'error-callback':()=>{CAP.token='';},language:'ru'});}catch(e){}
  };
  if(window.turnstile)return draw();
  if(document.getElementById('cf-js'))return setTimeout(capMount,400);
  const sc=document.createElement('script');sc.id='cf-js';sc.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';sc.async=true;sc.onload=draw;document.head.appendChild(sc);
}
function afterRender(){
  capMount();
  const v=state.view;
  if(v==='interests')fillInterests();
  if(v==='meetups')fillMeetups();
  if(!state.session||!state.loaded||!state.me){live.chatId=null;live.threadId=null;return;}
  if(v==='interest'){const i=interest(state.arg);if(i&&curTab(i)==='chat'&&has(i.members))openChat(i.id);else live.chatId=null;}else live.chatId=null;
  if(v==='thread')openThread(state.arg);else live.threadId=null;
  if(v==='messages')loadConvos();
  if(v==='notifications'){fillNotes();loadNotes();}
  if(v==='interest'||v==='thread')updBar(v==='thread'?'dm':'chat');
  if(v==='notifications'||v==='profile')fillPush();
  if(v==='profile'||v==='user')loadDating();
  if(v==='profile')loadSettings();
  if(['home','meetups','interest','user'].includes(v))loadRem();
  if(v==='meetups')loadPast();
  limCheck('chat');limCheck('dm');
  if(v==='dating'&&DT.loaded&&DT.freshKey!==lastKey){DT.freshKey=lastKey;loadDating(true);}
  if(v==='admin'){if(ADMIN.loaded)fillAdmin();loadAdmin();}
}
const KEEP=/^(q|f-age|chat-in|dm-in|c-text|fr-q|an-.+|fl-.+)$/;
function renderKeep(){
  const a=document.activeElement,id=a&&a.id;
  const s=a&&a.selectionStart,e=a&&a.selectionEnd;
  const saved={};
  document.querySelectorAll('#view input[id],#view textarea[id]').forEach(n=>{if(KEEP.test(n.id)&&n.value)saved[n.id]=n.value;});
  render();
  Object.keys(saved).forEach(k=>{const n=document.getElementById(k);if(n&&!n.value)n.value=saved[k];});
  growAll($('#view'));
  if(id&&KEEP.test(id)){const n=document.getElementById(id);if(n){n.focus();try{n.setSelectionRange(s,e);}catch(x){}}}
}
let lastKey=null;
async function route(){
  const h=(location.hash||'#home').slice(1);
  let v='home',arg=null,m;
  let hashTab=null;
  if((m=h.match(/^interest-([^\/]+)(?:\/(chat|talks|meets|people))?$/))){v='interest';arg=m[1];hashTab=m[2]||null;}
  else if((m=h.match(/^user-(.+)$/))){v='user';arg=m[1];}
  else if((m=h.match(/^messages-(.+)$/))){v='thread';arg=m[1];}
  else if(['home','welcome','interests','meetups','messages','friends','notifications','profile','admin','dating','anketa','filter','test'].indexOf(h)>=0)v=h;
  const key=v+':'+arg;
  if(hashTab){if(key!==lastKey)state.pendingTab=hashTab;else state.tab=hashTab;}
  if(key!==lastKey){state.tab=state.pendingTab||null;state.pendingTab=null;state.topic=null;lastKey=key;DT.freshKey='';DT.theirs={};live.chatId=null;live.threadId=null;COMPOSE.chat={};COMPOSE.dm={};}
  state.view=v;state.arg=arg;
  if(v!=='home'&&v!=='profile'&&!state.session)state.after=h;
  closeModal();closeCrop();
  render();
  window.scrollTo(0,0);
  if(SB_OK&&state.session)await refresh();
}
async function refresh(){
  try{await reload();state.loadError='';if(!PUSH.synced){PUSH.synced=true;pushSync();}}catch(e){state.loadError=errText(e);}
  renderKeep();
  refreshCounts();
}
function go(h){if(location.hash==='#'+h)route();else location.hash=h;}

/* ---------- уведомления на экране и окна ---------- */
let tt=null;
function grow(t){
  if(!t||t.tagName!=='TEXTAREA'||!t.isConnected||t.offsetParent===null)return;
  t.style.height='auto';
  t.style.height=(t.scrollHeight+t.offsetHeight-t.clientHeight)+'px';
}
function growAll(root){(root||document).querySelectorAll('textarea').forEach(grow);}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),3800);}
let modalOpener=null;
function openModal(title,html){modalOpener=document.activeElement;$('#mt').textContent=title;$('#mb').innerHTML=html;$('#ov').hidden=false;growAll($('#mb'));const f=$('#mb input[type=text],#mb select,#mb textarea,#mb button.primary');if(f)f.focus();}
function closeModal(){if($('#ov').hidden)return;$('#ov').hidden=true;$('#mb').innerHTML='';confirmCb=null;if(modalOpener&&modalOpener.isConnected)try{modalOpener.focus();}catch(e){}}
const setErr=t=>{const e=$('#err');if(e)e.textContent=t;};
function needUser(){
  if(state.session&&state.me)return false;
  state.after=location.hash.slice(1)||'home';
  toast('Сначала зарегистрируйтесь или войдите.');
  go('profile');
  return true;
}
let busy=false;
async function run(fn){
  if(busy)return;
  busy=true;
  try{await fn();}catch(e){toast(errText(e));}
  finally{busy=false;}
}
async function submitting(fn){
  if(busy)return;
  const b=$('#submit-btn')||$('#mb button[type=submit]'),old=b&&b.textContent;
  busy=true;if(b){b.disabled=true;b.textContent='Подождите…';}
  try{await fn();}catch(e){setErr(errText(e));}
  finally{busy=false;if(b&&b.isConnected){b.disabled=false;b.textContent=old;}}
}
async function afterChange(){await reload();render();refreshCounts();}
let confirmCb=null;
function confirmModal(title,text,okText,cb,danger){
  confirmCb=cb;
  openModal(title,'<p>'+esc(text)+'</p><div class="row" style="margin-top:14px"><button class="btn'+(danger?' warn':' primary')+'" type="button" data-act="confirm-ok">'+esc(okText)+'</button><button class="btn" type="button" data-act="close">Отмена</button></div>');
}

/* ---------- подсказки городов ---------- */
let comboTimer=null,comboSeq=0;
function hideCombo(inp){
  const l=document.getElementById(inp.dataset.list);
  if(l){l.hidden=true;l.innerHTML='';}
  inp.setAttribute('aria-expanded','false');inp.removeAttribute('aria-activedescendant');
}
async function suggestCities(inp){
  const q=inp.value.trim();
  const list=document.getElementById(inp.dataset.list);
  if(!list||!SB_OK)return;
  if(q.length<1){hideCombo(inp);return;}
  const seq=++comboSeq;
  let rows=[];
  try{const r=await sb.rpc('search_cities',{q});if(r.error)throw r.error;rows=r.data||[];}catch(e){rows=[];}
  if(seq!==comboSeq||document.activeElement!==inp)return;
  const k=cityKey(q);
  const exact=rows.some(r=>cityKey(r.label)===k);
  let html=rows.map((r,n)=>'<li role="option" id="'+inp.id+'-o'+n+'" data-label="'+esc(r.label)+'"><span>'+esc(r.label)+'</span><span class="r">'+esc(r.region||'')+'</span></li>').join('');
  if(!exact&&q.length>=2)html+='<li role="option" class="new" id="'+inp.id+'-o'+rows.length+'" data-label="'+esc(q)+'">Добавить «'+esc(q)+'» как новый город</li>';
  list.innerHTML=html;list.hidden=!html;
  inp.setAttribute('aria-expanded',html?'true':'false');
}
function pickCity(li){
  const list=li.parentElement,inp=document.querySelector('[data-list="'+list.id+'"]');
  if(!inp)return;
  inp.value=li.dataset.label;
  hideCombo(inp);
}
function moveCombo(inp,dir){
  const list=document.getElementById(inp.dataset.list);if(!list||list.hidden)return false;
  const items=[...list.querySelectorAll('li')];if(!items.length)return false;
  let k=items.findIndex(li=>li.getAttribute('aria-selected')==='true');
  if(k>=0)items[k].setAttribute('aria-selected','false');
  k=(k+dir+items.length)%items.length;
  items[k].setAttribute('aria-selected','true');inp.setAttribute('aria-activedescendant',items[k].id);
  items[k].scrollIntoView({block:'nearest'});
  return true;
}

/* ---------- действия ---------- */
async function toggleInterest(id){
  if(needUser())return;
  const i=interest(id),uid=state.me.id;
  if(has(i.members)){
    const r=await sb.from('interest_members').delete().eq('interest_id',id).eq('user_id',uid);
    if(r.error)throw r.error;
    toast('Вы вышли из «'+i.title+'»');
  }else{
    if(MYBANS.has(id)){toast('Создатель интереса закрыл вам доступ.');return;}
    const r=await sb.from('interest_members').insert({interest_id:id,user_id:uid});
    if(r.error)throw r.error;
    toast('Вы вступили в «'+i.title+'»');
  }
  await afterChange();
}
function eligibility(m){
  const me=state.me;
  if(me.age<m.ageMin||me.age>m.ageMax)return 'Эта встреча для возраста '+m.ageMin+'–'+m.ageMax+'.';
  if(m.g!=='any'&&m.g!==me.g)return m.g==='f'?'Эта встреча только для женщин.':'Эта встреча только для мужчин.';
  return '';
}
async function toggleMeetup(id){
  if(needUser())return;
  const m=M.find(x=>x.id===id);
  if(has(m.going)){
    const r=await sb.from('meetup_going').delete().eq('meetup_id',id).eq('user_id',state.me.id);
    if(r.error)throw r.error;
    toast('Вы отказались от встречи.');
  }else{
    const why=eligibility(m);if(why){toast(why);return;}
    if(m.going.length>=m.max){toast('Мест больше нет.');return;}
    const r=await sb.rpc('join_meetup',{p_meetup:id});
    if(r.error)throw r.error;
    toast('Вы записались: '+m.title);
  }
  await afterChange();
}
async function logout(){
  await pushForget();
  await sb.auth.signOut({scope:'local'});
  state.session=null;clearData();state.notice='';
  toast('Вы вышли из аккаунта.');
  go('home');
}
async function removeRow(table,id,okMsg){
  const r=await sb.from(table).delete().eq('id',id);
  if(r.error)throw r.error;
  toast(okMsg);
}

/* ---------- окна с формами ---------- */
function tagsFrom(s){
  const seen=new Set(),out=[];
  String(s||'').split(/[,;\n]/).forEach(x=>{const t=x.replace(/^#+/,'').trim().slice(0,24);const k=t.toLowerCase();if(t&&!seen.has(k)){seen.add(k);out.push(t);}});
  return out.slice(0,5);
}
function niPhotoBox(){
  const b=$('#ni-photobox');if(!b)return;
  const p=state.niPhoto||{},has=!!p.url;
  b.innerHTML='<div class="photo-pick"><span id="ni-prev"></span><div class="pp-btns"><label class="btn sm pickbtn">'+(has?'Заменить картинку':'Выбрать картинку')+'<input class="sr" type="file" id="ni-photo" accept="image/*"></label>'+(has?'<button class="btn sm" type="button" data-act="ni-photo-edit">Изменить кадр</button><button class="lnk danger" type="button" data-act="ni-photo-clear">Убрать</button>':'')+'</div></div><p class="hint">Перед загрузкой можно выбрать, какая часть картинки попадёт в кружок. Без картинки будет цветная буква.</p>';
  niPrevRefresh();
}
function niPrevRefresh(){
  const pv=$('#ni-prev');if(!pv)return;
  const p=state.niPhoto||{};
  const h=parseInt((document.querySelector('input[name=hue]:checked')||{value:190}).value,10);
  const t=($('#ni-title')||{}).value||'?';
  pv.innerHTML=badge({photo:p.url||null,hue:h,title:t.trim()||'?'},true);
}
function openInterestForm(i,prefill){
  if(needUser())return;
  const e=!!i;
  state.niPhoto={file:null,url:e?(i.photo||null):null,remove:false,orig:e?(i.photo||null):null};
  openModal(e?'Редактировать интерес':'Новый интерес',
    '<form id="f-ni" data-id="'+esc(e?i.id:'')+'" novalidate>'+
    fld('Название','ni-title','<input type="text" id="ni-title" maxlength="40" placeholder="Например, Скалолазание" value="'+esc(e?i.title:(prefill||''))+'" autocomplete="off">')+
    '<div class="similar" id="ni-sim" hidden></div>'+
    fld('Описание','ni-desc','<textarea id="ni-desc" maxlength="200" placeholder="Чем вы занимаетесь и кого ждёте">'+esc(e?i.desc:'')+'</textarea>')+
    fld('Категория','ni-cat','<select id="ni-cat">'+opts(Object.entries(CATS),e?i.cat:'other')+'</select>')+
    '<div class="field"><span class="lbl">Формат</span>'+segs('nfmt',[['offline','Офлайн'],['online','Онлайн'],['both','Оба']],e?i.format:'both','Формат')+'</div>'+
    '<div id="ni-cityw">'+cityField('ni-city','Город (по желанию)',e?i.city:'','Если интерес привязан к городу')+'</div>'+
    fld('Теги (до 5, через запятую)','ni-tags','<input type="text" id="ni-tags" maxlength="120" placeholder="например: новички, выходные, горы" value="'+esc(e?i.tags.join(', '):'')+'">')+
    (V4?fld('Правила интереса (по желанию)','ni-rules','<textarea id="ni-rules" rows="2" maxlength="600" placeholder="Например: без рекламы и грубости, пишем по теме">'+esc(e?i.rules:'')+'</textarea>'):'')+
    (V4?'<div class="field"><span class="lbl">Картинка интереса (по желанию)</span><div id="ni-photobox"></div></div>':'')+
    '<div class="field"><span class="lbl">Цвет</span>'+swatches(e?i.hue:null)+'</div>'+
    '<p class="err" id="err" role="alert"></p><button class="btn primary" type="submit">'+(e?'Сохранить':'Создать интерес')+'</button></form>');
  niPhotoBox();
  if(!e)showSimilar();
  syncCityVisibility();
}
function syncCityVisibility(){
  const w=$('#ni-cityw');if(!w)return;
  const f=document.querySelector('input[name=nfmt]:checked');
  w.hidden=!!(f&&f.value==='online');
}
function showSimilar(){
  const box=$('#ni-sim'),inp=$('#ni-title');if(!box||!inp||$('#f-ni').dataset.id)return;
  const k=cityKey(inp.value);
  if(k.length<2){box.hidden=true;return;}
  const sim=I.filter(i=>{const t=cityKey(i.title);return t===k||t.includes(k)||k.includes(t);}).slice(0,4);
  box.hidden=!sim.length;
  box.innerHTML=sim.length?'Уже есть похожие: '+sim.map(i=>'<a href="#interest-'+esc(i.id)+'">'+esc(i.title)+'</a>').join(', ')+'. Лучше вступить в существующий, чтобы людей не разделять.':'';
}
function openMeetupForm(preId){
  if(needUser())return;
  const mine=I.filter(i=>has(i.members));
  if(!mine.length){toast('Чтобы создать встречу, сначала вступите в интерес.');return;}
  const sel=preId&&mine.some(i=>i.id===preId)?preId:(state.view==='interest'&&mine.some(i=>i.id===state.arg)?state.arg:mine[0].id);
  if(preId&&!mine.some(i=>i.id===preId)){toast('Создавать встречи могут только участники интереса. Сначала вступите в него.');return;}
  const soon=new Date();soon.setDate(soon.getDate()+3);
  openModal('Новая встреча',
    '<form id="f-nm" novalidate>'+
    fld('Интерес','mu-int','<select id="mu-int">'+opts(mine.map(i=>[i.id,i.title]),sel)+'</select>')+
    fld('Название','mu-title','<input type="text" id="mu-title" maxlength="60" placeholder="Например, Вечер настолок" autocomplete="off">')+
    fld('Подробности (по желанию)','mu-desc','<textarea id="mu-desc" maxlength="400" placeholder="Что будет, что взять с собой" style="min-height:70px"></textarea>')+
    '<div class="field"><span class="lbl">Формат</span>'+segs('mfmt',[['offline','Офлайн'],['online','Онлайн']],'offline','Формат встречи')+'</div>'+
    '<div id="mu-off">'+cityField('mu-city','Город',state.me.city,'')+fld('Место','mu-place','<input type="text" id="mu-place" maxlength="80" placeholder="Кафе, парк, адрес" autocomplete="off">')+'</div>'+
    '<div id="mu-on" hidden>'+fld('Платформа','mu-plat','<input type="text" id="mu-plat" maxlength="80" placeholder="Zoom, Telegram, Discord…" autocomplete="off">')+fld('Ссылка (видна только записавшимся)','mu-link','<input type="text" id="mu-link" maxlength="300" placeholder="https://…" autocomplete="off">')+'</div>'+
    '<div class="two">'+fld('Дата','mu-date','<input type="date" id="mu-date" min="'+ymd(new Date())+'" value="'+ymd(soon)+'">')+fld('Время','mu-time','<input type="time" id="mu-time" value="18:00">')+'</div>'+
    '<div class="two">'+fld('Возраст от','mu-amin','<input type="number" id="mu-amin" min="18" max="99" value="18">')+fld('Возраст до','mu-amax','<input type="number" id="mu-amax" min="18" max="99" value="45">')+'</div>'+
    '<div class="two">'+fld('Кто может прийти','mu-g','<select id="mu-g">'+opts([['any','Все'],['f','Только женщины'],['m','Только мужчины']],'any')+'</select>')+fld('Мест','mu-max','<input type="number" id="mu-max" min="2" max="100" value="10">')+'</div>'+
    '<p class="hint">Участники интереса получат уведомление, если не отключили его.</p>'+
    '<p class="err" id="err" role="alert"></p><button class="btn primary" type="submit">Создать встречу</button></form>');
}
function syncMeetupFormat(){
  const f=document.querySelector('input[name=mfmt]:checked');if(!f)return;
  const on=f.value==='online';
  const a=$('#mu-off'),b=$('#mu-on');if(a)a.hidden=on;if(b)b.hidden=!on;
}
function openTopicForm(){
  if(needUser())return;
  const i=interest(state.arg);
  if(!has(i.members)){toast('Вступите в интерес, чтобы начинать обсуждения.');return;}
  openModal('Новая тема',
    '<form id="f-nt" novalidate>'+fld('Тема','nt-title','<input type="text" id="nt-title" maxlength="90" placeholder="О чём хотите поговорить?" autocomplete="off">')+
    fld('Сообщение','nt-text','<textarea id="nt-text" maxlength="2000" placeholder="Расскажите подробнее"></textarea>')+
    '<p class="err" id="err" role="alert"></p><button class="btn primary" type="submit">Опубликовать</button></form>');
}
function openProfileForm(){
  const me=state.me;
  openModal('Редактировать профиль',
    '<form id="f-pe" novalidate>'+fld('Имя','pe-name','<input type="text" id="pe-name" maxlength="40" value="'+esc(me.name)+'">')+
    '<div class="two">'+fld('Возраст','pe-age','<input type="number" id="pe-age" min="18" max="99" value="'+esc(me.age)+'">')+cityField('pe-city','Город',me.city,'')+'</div>'+
    '<div class="field"><span class="lbl">Пол</span>'+genderSegs('pg',me.g)+'</div>'+
    fld('О себе','pe-about','<textarea id="pe-about" maxlength="300">'+esc(me.about)+'</textarea>')+
    '<p class="err" id="err" role="alert"></p><button class="btn primary" type="submit">Сохранить</button></form>');
}
const reportCtx={};
function openReport(type,id){
  if(needUser())return;
  let uid=null,snap='';
  if(type==='user'){uid=id;snap=who(id).name+(PEOPLE[id]&&PEOPLE[id].about?': '+PEOPLE[id].about:'');if(state.view==='thread'&&state.arg===id){const last=Object.values(MSG).filter(m=>m.dm&&m.author===id).slice(-3).map(m=>m.text);if(last.length)snap=who(id).name+': '+last.join(' / ');}}
  else if(type==='chat'||type==='dm'){const m=MSG[id];if(m){uid=m.author;snap=m.text;}}
  else if(type==='topic'){I.forEach(i=>i.topics.forEach(t=>{if(t.id===id){uid=t.a;snap=t.title+(t.text?'\n'+t.text:'');}}));}
  else if(type==='comment'){I.forEach(i=>i.topics.forEach(t=>t.comments.forEach(c=>{if(c.id===id){uid=c.a;snap=c.t;}})));}
  else if(type==='interest'){const i=interest(id);if(i){uid=i.owner;snap=i.title+': '+i.desc;}}
  else if(type==='meetup'){const m=M.find(x=>x.id===id);if(m){uid=m.host;snap=m.title+(m.desc?': '+m.desc:'');}}
  reportCtx.type=type;reportCtx.id=id;reportCtx.uid=uid;reportCtx.snap=snap.slice(0,300);
  openModal('Пожаловаться',
    '<form id="f-rep" novalidate><p class="meta">'+esc(TARGETS[type]||'')+(snap?': «'+esc(snap.slice(0,120))+(snap.length>120?'…':'')+'»':'')+'</p>'+
    fld('Причина','rp-reason','<select id="rp-reason">'+opts(Object.entries(REASONS),'abuse')+'</select>')+
    fld('Комментарий (по желанию)','rp-details','<textarea id="rp-details" maxlength="300" style="min-height:70px"></textarea>')+
    '<p class="hint">Жалобу увидит только модератор. Человеку она не показывается.</p>'+
    '<p class="err" id="err" role="alert"></p><button class="btn primary" type="submit">Отправить жалобу</button></form>');
}

/* ---------- фото ---------- */
function resizeImage(file,max){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      const k=Math.min(1,max/Math.max(img.width,img.height));
      const w=Math.max(1,Math.round(img.width*k)),h=Math.max(1,Math.round(img.height*k));
      const c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      c.toBlob(b=>b?resolve(b):reject(new Error('Не удалось обработать фото.')),'image/jpeg',0.85);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Не удалось открыть этот файл как изображение.'));};
    img.src=url;
  });
}
async function uploadImage(file){
  const uid=state.session.user.id;
  const blob=file._crop?file:await resizeImage(file,512);
  const path=uid+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,7)+'.jpg';
  const up=await sb.storage.from('avatars').upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600'});
  if(up.error)throw up.error;
  return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
function removeStored(url){
  const k=String(url||'').indexOf('/avatars/');
  if(k<0)return;
  try{sb.storage.from('avatars').remove([decodeURIComponent(String(url).slice(k+9))]).then(()=>{},()=>{});}catch(e){}
}
async function uploadAvatar(file){
  const uid=state.session.user.id;
  const url=await uploadImage(file);
  const old=state.me&&state.me.photo;
  const upd=await sb.from('profiles').update({photo_url:url}).eq('id',uid);
  if(upd.error){removeStored(url);throw upd.error;}
  removeStored(old);
}

/* ---------- ответы и правка сообщений ---------- */
const snip=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();n=n||70;return s.length>n?s.slice(0,n)+'…':s;};
function msgCols(kind){
  const b=kind==='dm'?'id,sender_id,recipient_id,body,created_at,read_at':'id,author_id,body,created_at';
  let c=HAS_RE?b+',reply_to,edited_at':b;
  if(kind==='chat'&&HAS_PO)c+=',poll_id';
  if(HAS_IMG)c+=',image_path';
  return c;
}
function quoteHtml(rid){
  const q=MSG[rid];
  if(!q)return '<div class="quote gone"><span>Сообщение удалено или скрыто</span></div>';
  return '<button type="button" class="quote" data-act="jump" data-id="'+esc(rid)+'"><b>'+esc(who(q.author).name)+'</b><span>'+esc(snip(q.text))+'</span></button>';
}
function updBar(kind){
  const b=$('#cbar-'+kind);if(!b)return;
  const c=COMPOSE[kind]||{},id=c.edit||c.reply;
  if(!id){b.innerHTML='';b.hidden=true;return;}
  const m=MSG[id];
  b.hidden=false;
  b.innerHTML='<div class="cq"><b>'+(c.edit?'Изменение сообщения':'Ответ: '+esc(who(m&&m.author).name))+'</b><span>'+esc(snip(m?m.text:'Сообщение',90))+'</span></div><button type="button" class="lnk" data-act="cancel-compose" data-kind="'+kind+'">Отмена</button>';
}
function msgInput(kind){return $(kind==='dm'?'#dm-in':'#chat-in');}
const MSG_MAX=10000,SPOIL_AT=3000;
async function submitMsg(kind){
  const dm=kind==='dm',inp=msgInput(kind),txt=inp.value.trim();
  if(!txt)return;
  if(txt.length>MSG_MAX){limCheck(kind);toast('Превышен лимит в '+MSG_MAX+' символов.');return;}
  const tbl=dm?'direct_messages':'chat_messages',c=COMPOSE[kind]||{};
  if(c.edit){
    const old=MSG[c.edit];
    if(!old||old.text!==txt){
      const r=await sb.from(tbl).update({body:txt}).eq('id',c.edit);
      if(r.error)throw r.error;
      toast('Сообщение изменено.');
    }
  }else{
    let row;
    if(dm){const o=state.arg;if(!UUID.test(o||''))return;row={sender_id:state.me.id,recipient_id:o,body:txt};}
    else{const i=interest(state.arg);if(!i)return;row={interest_id:i.id,author_id:state.me.id,body:txt};}
    if(c.reply&&HAS_RE)row.reply_to=c.reply;
    const r=await sb.from(tbl).insert(row);
    if(r.error)throw r.error;
  }
  COMPOSE[kind]={};updBar(kind);
  inp.value='';grow(inp);limCheck(kind);
  await (dm?pollThread(true):pollChat(true));
}
const sendChat=()=>submitMsg('chat');
const sendDM=()=>submitMsg('dm');
function msgActs(kind,m,mine,extra){
  if(!HAS_RE)return extra||'';
  return '<button class="lnk" type="button" data-act="reply" data-kind="'+kind+'" data-id="'+esc(m.id)+'">Ответить</button>'+
    (mine&&!m._noedit&&!m.poll_id?'<button class="lnk" type="button" data-act="edit-msg" data-kind="'+kind+'" data-id="'+esc(m.id)+'">Изменить</button>':'')+(extra||'');
}

/* ---------- редактор фото: выбрать, какая часть попадёт в кружок ---------- */
const CROP={base:null,cx:0,cy:0,z:1,S:280,done:null,drag:null};
function loadImg(src,cors){
  return new Promise((res,rej)=>{
    const im=new Image();if(cors)im.crossOrigin='anonymous';
    im.onload=()=>res(im);im.onerror=()=>rej(new Error('Не удалось открыть изображение.'));im.src=src;
  });
}
function toBase(im){
  const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;
  const k=Math.min(1,1600/Math.max(iw,ih));
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(iw*k));c.height=Math.max(1,Math.round(ih*k));
  c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  return c;
}
function cropGeom(){
  const b=CROP.base,S=CROP.S;
  const sc=Math.max(S/b.width,S/b.height)*CROP.z,half=S/(2*sc);
  CROP.cx=Math.min(Math.max(CROP.cx,half),b.width-half);
  CROP.cy=Math.min(Math.max(CROP.cy,half),b.height-half);
  return {sc,half};
}
function cropDraw(){
  const cv=$('#crop-cv');if(!cv||!CROP.base)return;
  const g=cropGeom(),c=cv.getContext('2d');
  c.fillStyle='#fff';c.fillRect(0,0,CROP.S,CROP.S);
  c.drawImage(CROP.base,CROP.cx-g.half,CROP.cy-g.half,2*g.half,2*g.half,0,0,CROP.S,CROP.S);
}
function openCropper(im,done){
  CROP.base=toBase(im);CROP.cx=CROP.base.width/2;CROP.cy=CROP.base.height/2;CROP.z=1;CROP.done=done;CROP.drag=null;
  $('#mb2').innerHTML='<div class="crop-wrap"><canvas id="crop-cv" width="'+CROP.S+'" height="'+CROP.S+'" aria-label="Область фото. Перетащите, чтобы сдвинуть."></canvas><span class="crop-ring" aria-hidden="true"></span></div>'+
    '<p class="meta" style="text-align:center">Перетащите фото пальцем или мышкой и подберите масштаб. В кружок попадёт то, что внутри круга.</p>'+
    '<label class="crop-z"><span>Масштаб</span><input type="range" id="crop-zoom" min="100" max="400" value="100"></label>'+
    '<div class="row" style="justify-content:center"><button type="button" class="btn sm" data-act="crop-rot">Повернуть</button></div>'+
    '<div class="row"><button type="button" class="btn primary" data-act="crop-ok">Готово</button><button type="button" class="btn" data-act="crop-cancel">Отмена</button></div>';
  $('#ov2').hidden=false;
  cropDraw();
  const cv=$('#crop-cv');
  cv.addEventListener('pointerdown',e=>{CROP.drag={x:e.clientX,y:e.clientY,cx:CROP.cx,cy:CROP.cy};try{cv.setPointerCapture(e.pointerId);}catch(x){}});
  cv.addEventListener('pointermove',e=>{
    const d=CROP.drag;if(!d)return;
    const k=CROP.S/cv.getBoundingClientRect().width,g=cropGeom();
    CROP.cx=d.cx-(e.clientX-d.x)*k/g.sc;CROP.cy=d.cy-(e.clientY-d.y)*k/g.sc;cropDraw();
  });
  const end=()=>{CROP.drag=null;};
  cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  cv.addEventListener('wheel',e=>{e.preventDefault();const z=Math.min(4,Math.max(1,CROP.z*(e.deltaY<0?1.08:1/1.08)));CROP.z=z;const s=$('#crop-zoom');if(s)s.value=Math.round(z*100);cropDraw();},{passive:false});
  const f=$('#ov2 button.primary');if(f)f.focus();
}
function closeCrop(){
  if($('#ov2').hidden)return;
  $('#ov2').hidden=true;$('#mb2').innerHTML='';CROP.base=null;CROP.done=null;
}
function cropRot(){
  const b=CROP.base;if(!b)return;
  const c=document.createElement('canvas');c.width=b.height;c.height=b.width;
  const x=c.getContext('2d');x.translate(c.width/2,c.height/2);x.rotate(Math.PI/2);x.drawImage(b,-b.width/2,-b.height/2);
  CROP.base=c;CROP.cx=c.width/2;CROP.cy=c.height/2;CROP.z=1;
  const s=$('#crop-zoom');if(s)s.value=100;
  cropDraw();
}
function cropOut(){
  const g=cropGeom(),c=document.createElement('canvas');c.width=c.height=512;
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,512,512);
  x.drawImage(CROP.base,CROP.cx-g.half,CROP.cy-g.half,2*g.half,2*g.half,0,0,512,512);
  return new Promise((res,rej)=>c.toBlob(b=>{if(!b)return rej(new Error('Не удалось обработать фото.'));b._crop=true;res(b);},'image/jpeg',0.88));
}
async function cropFile(file,done){
  if(!file)return;
  if(file.size>15*1024*1024){toast('Файл слишком большой. Выберите фото до 15 МБ.');return;}
  const u=URL.createObjectURL(file);
  try{openCropper(await loadImg(u),done);}
  catch(e){toast('Не удалось открыть этот файл как изображение.');}
  finally{URL.revokeObjectURL(u);}
}
async function cropUrl(url,done){
  try{openCropper(await loadImg(url,true),done);}
  catch(e){toast('Не удалось открыть фото для правки. Загрузите его заново.');}
}
function blobToUrl(blob){return new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(blob);});}
async function setNiBlob(blob){
  const url=await blobToUrl(blob);
  state.niPhoto={file:blob,url,remove:false,orig:(state.niPhoto||{}).orig||null};
  niPhotoBox();
}

/* ---------- мои фотографии: основное и до трёх дополнительных ---------- */
function photoUrls(p){return [p.photo].concat(p.photos||[]).filter(Boolean);}
async function savePhotos(main,extra,drop){
  const upd={};
  if(main!==undefined)upd.photo_url=main;
  if(extra!==undefined)upd.photos=extra;
  const r=await sb.from('profiles').update(upd).eq('id',state.me.id);
  if(r.error)throw r.error;
  (drop||[]).forEach(removeStored);
}
function galleryHtml(){
  const me=state.me,ex=me.photos||[];
  const tile=(img,label,acts)=>'<figure class="gi"><span class="gi-img">'+img+'</span><figcaption>'+label+'</figcaption><div class="gi-acts">'+acts+'</div></figure>';
  const mainImg=me.photo?'<img src="'+esc(me.photo)+'" alt="Основное фото">':'<span class="gi-ph tint" style="--h:'+esc(me.hue)+'">'+esc(me.name.charAt(0))+'</span>';
  let h=tile(mainImg,'Основное',
    '<label class="btn sm pickbtn">'+(me.photo?'Заменить':'Добавить фото')+'<input class="sr" type="file" id="photo-change" accept="image/*"></label>'+
    (me.photo?'<button class="lnk" type="button" data-act="ph-edit" data-id="main">Изменить кадр</button><button class="lnk danger" type="button" data-act="ph-del" data-id="main">Удалить</button>':''));
  ex.forEach((u,k)=>{h+=tile('<img src="'+esc(u)+'" alt="Дополнительное фото '+(k+1)+'">','Фото '+(k+1),
    '<button class="lnk" type="button" data-act="ph-main" data-id="'+k+'">Сделать основным</button><button class="lnk" type="button" data-act="ph-edit" data-id="'+k+'">Изменить кадр</button><button class="lnk danger" type="button" data-act="ph-del" data-id="'+k+'">Удалить</button>');});
  if(HAS_PH&&ex.length<3&&me.photo)h+='<label class="gi add"><span>+</span>Добавить ещё фото<input class="sr" type="file" id="ph-new" accept="image/*"></label>';
  return '<section class="section"><h2 style="margin-bottom:6px">Мои фото</h2><p class="hint" style="margin:0 0 12px">'+(HAS_PH?'Основное фото и ещё до трёх дополнительных. ':'')+'Перед загрузкой можно выбрать, какая часть фото попадёт в кружок.</p><div class="gal">'+h+'</div></section>';
}
let LBX={urls:[],i:0,name:''};
function lbDraw(first){
  const L=LBX;
  const body='<div class="lb"><img src="'+esc(L.urls[L.i])+'" alt="Фото: '+esc(L.name)+'"></div>'+(L.urls.length>1?'<div class="row lb-n"><button class="btn sm" type="button" data-act="lb-prev" aria-label="Предыдущее фото">←</button><span class="meta">'+(L.i+1)+' из '+L.urls.length+'</span><button class="btn sm" type="button" data-act="lb-next" aria-label="Следующее фото">→</button></div>':'');
  if(first)openModal(L.name,body);else $('#mb').innerHTML=body;
}
function lbOpen(pid,i){
  const p=who(pid),urls=photoUrls(p);
  if(!urls.length)return;
  LBX={urls,i:Math.max(0,Math.min(i||0,urls.length-1)),name:p.name};lbDraw(true);
}

/* ---------- друзья ---------- */
const frRec=id=>FRIENDS.find(f=>f.from===id||f.to===id);
function frState(id){
  const f=frRec(id);
  if(!f)return 'none';
  if(f.status==='accepted')return 'friend';
  return f.from===state.me.id?'out':'in';
}
const isFriend=id=>HAS_FR&&!!state.me&&frState(id)==='friend';
function frActs(id){
  const s=frState(id),e=esc(id);
  if(BLOCKED.has(id))return '<button class="btn sm" type="button" data-act="unblock" data-id="'+e+'">Разблокировать</button>';
  if(s==='none')return '<button class="btn sm primary" type="button" data-act="fr-add" data-id="'+e+'">Добавить в друзья</button>';
  if(s==='out')return '<span class="meta">Заявка отправлена</span><button class="lnk" type="button" data-act="fr-cancel" data-id="'+e+'">Отменить</button>';
  if(s==='in')return '<button class="btn sm primary" type="button" data-act="fr-accept" data-id="'+e+'">Принять</button><button class="btn sm" type="button" data-act="fr-decline" data-id="'+e+'">Отклонить</button>';
  return '<a class="btn sm primary" href="#messages-'+e+'">Написать</a><button class="lnk danger" type="button" data-act="fr-remove" data-id="'+e+'">Удалить из друзей</button>';
}
function frRow(id,acts){
  const p=who(id);
  return '<div class="frow">'+avLink(id,'md')+'<div class="fr-i">'+pLink(id)+'<span class="meta">'+ageText(p.age)+' · '+esc(p.city)+'</span></div><div class="fr-a">'+(acts==null?frActs(id):acts)+'</div></div>';
}
function frFindHtml(){
  const q=(($('#fr-q')||{}).value||'').trim().toLowerCase();
  let ids;
  if(q)ids=Object.keys(PEOPLE).filter(id=>id!==state.me.id&&!BLOCKED.has(id)&&PEOPLE[id].name.toLowerCase().indexOf(q)>=0).slice(0,12);
  else ids=recoPeople().map(x=>x.p.id).filter(id=>frState(id)==='none'&&!BLOCKED.has(id)).slice(0,6);
  if(!ids.length)return '<p class="meta">'+(q?'Никого не нашли. Проверьте, как пишется имя.':'Подсказки появятся, когда вы вступите в интересы. Или найдите человека по имени.')+'</p>';
  return '<div class="flist">'+ids.map(id=>frRow(id)).join('')+'</div>';
}
function fillFriendsFind(){const b=$('#fr-find');if(b)b.innerHTML=frFindHtml();}
function vFriends(){
  if(!HAS_FR)return '<div class="vhead"><h1>Друзья</h1></div><div class="empty"><p>Раздел появится после обновления базы данных.</p></div>';
  const me=state.me.id,ok=id=>!!PEOPLE[id];
  const inc=FRIENDS.filter(f=>f.status==='pending'&&f.to===me&&ok(f.from)).map(f=>f.from);
  const out=FRIENDS.filter(f=>f.status==='pending'&&f.from===me&&ok(f.to)).map(f=>f.to);
  const fr=FRIENDS.filter(f=>f.status==='accepted').map(f=>f.from===me?f.to:f.from).filter(ok);
  const bl=[...BLOCKED].filter(ok);
  const sec=(t,n,body)=>'<section class="section"><h2 style="margin-bottom:12px">'+t+(n!=null?' <span class="meta">('+n+')</span>':'')+'</h2>'+body+'</section>';
  return '<div class="vhead"><h1>Друзья</h1></div>'+
    (inc.length?sec('Заявки в друзья',inc.length,'<div class="flist">'+inc.map(id=>frRow(id)).join('')+'</div>'):'')+
    sec('Мои друзья',fr.length,fr.length?'<div class="flist">'+fr.map(id=>frRow(id)).join('')+'</div>':'<div class="empty"><p>Друзей пока нет. Найдите человека ниже или откройте чей-нибудь профиль и нажмите «Добавить в друзья».</p></div>')+
    (out.length?sec('Отправленные заявки',out.length,'<div class="flist">'+out.map(id=>frRow(id)).join('')+'</div>'):'')+
    sec('Найти человека',null,'<div class="field"><label class="sr" for="fr-q">Имя</label><input type="text" id="fr-q" maxlength="40" placeholder="Начните вводить имя" autocomplete="off"></div><div id="fr-find">'+frFindHtml()+'</div><p class="hint">Друзьям можно писать личные сообщения, даже если у вас нет общего интереса.</p>')+
    (bl.length?sec('Заблокированные',bl.length,'<div class="flist">'+bl.map(id=>frRow(id)).join('')+'</div><p class="hint">Заблокированный человек не может вам писать и отправлять заявки, а его сообщения скрыты от вас.</p>'):'');
}
async function frWrite(p,okMsg){
  const r=await p;
  if(r.error)throw r.error;
  if(okMsg)toast(okMsg);
  await afterChange();
}

/* ---------- установка на телефон и уведомления ---------- */
const VAPID_PUBLIC='BGkMnXUyXM5-Cp3jheRS7XQ2QfirUxwDW91I6EMTktClC9a0xkdaPq70C9NvEbJzYhO4Wnv0QeGK3DCtQ41ct7s';
const isStandalone=()=>!!((window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true);
function platform(){
  const ua=navigator.userAgent||'';
  if(/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1))return 'ios';
  if(/Android/.test(ua))return 'android';
  return 'desktop';
}
function installSteps(pl){
  const L={
    android:['<b>Android, браузер Chrome</b>','Откройте сайт в Chrome.','Нажмите три точки в правом верхнем углу.','Выберите «Установить приложение» (или «Добавить на главный экран») и подтвердите.','Значок «Кружка» появится среди приложений.'],
    ios:['<b>iPhone и iPad, браузер Safari</b>','Откройте сайт именно в Safari (в Chrome на iPhone установить нельзя).','Нажмите кнопку «Поделиться» (квадрат со стрелкой вверх) внизу экрана.','Прокрутите список вниз и выберите «На экран «Домой»», затем «Добавить».','Запускайте «Кружок» с экрана «Домой»: так он открывается как приложение и присылает уведомления.'],
    desktop:['<b>Компьютер, браузер Chrome или Edge</b>','Откройте сайт в браузере.','Справа в адресной строке нажмите значок установки (монитор со стрелкой).','Или откройте меню браузера и выберите «Установить Кружок».']
  }[pl];
  return '<div class="isteps">'+L[0]+'<ol>'+L.slice(1).map(s=>'<li>'+s+'</li>').join('')+'</ol></div>';
}
function installHelp(){
  const me=platform(),others=['android','ios','desktop'].filter(x=>x!==me);
  openModal('Установить «Кружок» на телефон',
    '<p>Так сайт получает свой значок на главном экране, открывается без адресной строки и может присылать уведомления.</p>'+
    (isStandalone()?'<p class="notice">Вы уже открыли «Кружок» как приложение.</p>':'')+
    (state.installEvt?'<button class="btn primary" type="button" data-act="install">Установить сразу</button>':'')+
    installSteps(me)+'<details class="more"><summary>Инструкции для других устройств</summary>'+others.map(installSteps).join('')+'</details>');
}
function installCard(always){
  if(isStandalone())return '';
  let hidden=false;try{hidden=!always&&localStorage.getItem('kr-inst-hide')==='1';}catch(e){}
  if(hidden)return '';
  return '<section class="inst" id="inst-card"><div class="inst-t"><b>Установите «Кружок» на телефон</b><span>Значок на главном экране, как у обычного приложения. Откроется без адресной строки, а ещё придут уведомления о сообщениях и встречах.</span></div><div class="row"><button class="btn primary sm" type="button" data-act="install-help">Как установить</button>'+(state.installEvt?'<button class="btn sm" type="button" data-act="install">Установить сразу</button>':'')+(always?'':'<button class="lnk" type="button" data-act="inst-hide">Скрыть</button>')+'</div></section>';
}
const PUSH={sub:false,synced:false};
const pushCan=()=>('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window);
function b64u(s){
  const b=(s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/'),r=atob(b),o=new Uint8Array(r.length);
  for(let i=0;i<r.length;i++)o[i]=r.charCodeAt(i);
  return o;
}
function pushHtml(){
  if(!SB_OK||!state.session)return '';
  const t='<b>Уведомления на телефон</b>';
  if(!pushCan()){
    const ios=platform()==='ios';
    return t+'<p>'+(ios?'На iPhone уведомления работают только после установки: добавьте сайт на экран «Домой» из Safari (нужна iOS 16.4 или новее) и откройте его оттуда.':'Этот браузер не поддерживает уведомления. Попробуйте Chrome.')+'</p>'+(ios&&!isStandalone()?'<button class="btn sm" type="button" data-act="install-help">Как добавить на экран «Домой»</button>':'');
  }
  if(Notification.permission==='denied')return t+'<p>Вы запретили уведомления для этого сайта. Разрешите их в настройках браузера (значок замка рядом с адресом, пункт «Уведомления») и обновите страницу.</p>';
  if(PUSH.sub&&Notification.permission==='granted')return '<b>Уведомления на этом устройстве включены</b><p>Мы сообщим о личных сообщениях, заявках в друзья и новых встречах, даже когда сайт закрыт.</p><div class="row"><button class="btn sm" type="button" data-act="push-test">Проверить уведомление</button><button class="btn sm" type="button" data-act="push-off">Выключить</button></div>';
  return t+'<p>Сообщим о личных сообщениях, заявках в друзья и новых встречах, даже когда сайт закрыт.</p><button class="btn primary sm" type="button" data-act="push-on">Включить уведомления</button>';
}
function pushCard(){return '<section class="push" id="push-box">'+pushHtml()+'</section>';}
function fillPush(){const b=$('#push-box');if(b)b.innerHTML=pushHtml();}
async function pushInit(){
  try{
    if(!pushCan())return;
    const reg=await navigator.serviceWorker.ready;
    const s=await reg.pushManager.getSubscription();
    PUSH.sub=!!s;fillPush();
  }catch(e){}
}
async function pushSync(){
  try{
    if(!pushCan()||Notification.permission!=='granted'||!state.session)return;
    const reg=await navigator.serviceWorker.ready;
    const s=await reg.pushManager.getSubscription();
    if(!s)return;
    const j=s.toJSON();
    await sb.rpc('save_push_subscription',{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth});
    PUSH.sub=true;fillPush();
  }catch(e){}
}
async function pushForget(){
  try{
    if(!pushCan())return;
    const reg=await navigator.serviceWorker.ready;
    const s=await reg.pushManager.getSubscription();
    if(s)await sb.rpc('delete_push_subscription',{p_endpoint:s.endpoint});
  }catch(e){}
}
function aboutModal(){
  openModal('О сайте','<p>«Кружок»: знакомства по интересам, пробная версия.</p><p class="meta">Список городов: <a href="https://github.com/hflabs/city" rel="noopener noreferrer" target="_blank">hflabs/city</a> (данные DaData.ru, лицензия CC BY-SA 4.0).</p>');
}

/* ---------- обработчики ---------- */
const ACT={
  'open-link':(id,el)=>openLink(el.dataset.link),
  'react-menu':(id,el)=>{const pk=el.nextElementSibling;if(!pk)return;pk.hidden=!pk.hidden;el.setAttribute('aria-expanded',String(!pk.hidden));},
  'react':(id,el)=>run(async()=>{
    if(needUser())return;
    const dm=el.dataset.kind==='dm',tbl=dm?'dm_reactions':'chat_reactions';
    const key=el.dataset.r,mine=((REACT[id]||{})[key]||[]).includes(state.me.id);
    const r=mine?await sb.from(tbl).delete().eq('message_id',id).eq('user_id',state.me.id).eq('reaction',key):await sb.from(tbl).insert({message_id:id,user_id:state.me.id,reaction:key});
    if(r.error)throw r.error;
    await (dm?pollThread(true):pollChat(true));
  }),
  'hint':(id,el)=>{const inp=$('#chat-in')||$('#dm-in');if(!inp)return;inp.value=el.dataset.text;grow(inp);inp.focus();try{inp.setSelectionRange(inp.value.length,inp.value.length);}catch(e){}},
  'share-site':()=>shareIt('Я в «Кружке»: знакомства по интересам, чаты и встречи рядом. Заходи!',''),
  'share-interest':id=>{const i=interest(id);if(i)shareIt('Интерес «'+i.title+'» в «Кружке»: '+(i.desc||'').slice(0,90),'interest-'+i.id);},
  'share-meetup':id=>{const m=M.find(x=>x.id===id);if(m)shareIt('Встреча «'+m.title+'», '+when(m.when)+'. Присоединяйтесь в «Кружке»!','interest-'+m.interestId+'/meets');},
  'install':()=>{const e=state.installEvt;if(!e)return;state.installEvt=null;try{e.prompt();}catch(x){}render();},
  'jump':id=>{const t=document.querySelector('[data-mid="'+id+'"]');if(!t)return;t.scrollIntoView({block:'center',behavior:'smooth'});t.classList.add('flash');setTimeout(()=>t.classList.remove('flash'),1600);},
  'reply':(id,el)=>{const k=el.dataset.kind;COMPOSE[k]={reply:id};updBar(k);const inp=msgInput(k);if(inp)inp.focus();},
  'edit-msg':(id,el)=>{const k=el.dataset.kind,m=MSG[id],inp=msgInput(k);if(!m||!inp)return;COMPOSE[k]={edit:id};inp.value=m.text;grow(inp);updBar(k);inp.focus();try{inp.setSelectionRange(inp.value.length,inp.value.length);}catch(e){}},
  'cancel-compose':(id,el)=>{const k=el.dataset.kind,c=COMPOSE[k]||{},inp=msgInput(k);if(c.edit&&inp){inp.value='';grow(inp);}COMPOSE[k]={};updBar(k);},
  'crop-ok':async()=>{const cb=CROP.done;if(!CROP.base||!cb)return;let blob;try{blob=await cropOut();}catch(e){toast('Не удалось обработать фото.');return;}closeCrop();cb(blob);},
  'crop-cancel':()=>closeCrop(),
  'crop-rot':()=>cropRot(),
  'ni-photo-edit':()=>{const p=state.niPhoto||{};if(p.url)cropUrl(p.url,setNiBlob);},
  'ph-edit':(id)=>{
    const me=state.me,main=id==='main',k=main?-1:parseInt(id,10),old=main?me.photo:(me.photos||[])[k];
    if(!old)return;
    cropUrl(old,blob=>run(async()=>{
      toast('Сохраняем фото…');
      const nu=await uploadImage(blob);
      try{if(main)await savePhotos(nu);else{const a=[...me.photos];a[k]=nu;await savePhotos(undefined,a);}}catch(e){removeStored(nu);throw e;}
      removeStored(old);await afterChange();toast('Фото обновлено.');
    }));
  },
  'ph-main':id=>run(async()=>{
    const me=state.me,k=parseInt(id,10),a=[...(me.photos||[])],np=a[k];if(!np)return;
    if(me.photo)a[k]=me.photo;else a.splice(k,1);
    await savePhotos(np,a);await afterChange();toast('Основное фото заменено.');
  }),
  'ph-del':id=>{
    const me=state.me,main=id==='main',k=main?-1:parseInt(id,10),old=main?me.photo:(me.photos||[])[k];
    if(!old)return;
    confirmModal('Удалить это фото?','Фото будет удалено с вашей страницы.','Удалить',()=>run(async()=>{
      if(main)await savePhotos(null,undefined,[old]);else{const a=[...me.photos];a.splice(k,1);await savePhotos(undefined,a,[old]);}
      closeModal();await afterChange();toast('Фото удалено.');
    }),true);
  },
  'lightbox':(id,el)=>lbOpen(id,parseInt(el.dataset.i,10)||0),
  'lb-prev':()=>{LBX.i=(LBX.i+LBX.urls.length-1)%LBX.urls.length;lbDraw(false);},
  'lb-next':()=>{LBX.i=(LBX.i+1)%LBX.urls.length;lbDraw(false);},
  'fr-add':id=>run(()=>frWrite(sb.from('friendships').insert({requester_id:state.me.id,addressee_id:id}),'Заявка отправлена.')),
  'fr-accept':id=>run(()=>{const f=frRec(id);if(!f)return;return frWrite(sb.from('friendships').update({status:'accepted'}).eq('id',f.id),'Теперь вы друзья.');}),
  'fr-decline':id=>run(()=>{const f=frRec(id);if(!f)return;return frWrite(sb.from('friendships').delete().eq('id',f.id),'Заявка отклонена.');}),
  'fr-cancel':id=>run(()=>{const f=frRec(id);if(!f)return;return frWrite(sb.from('friendships').delete().eq('id',f.id),'Заявка отменена.');}),
  'fr-remove':id=>{const f=frRec(id);if(!f)return;confirmModal('Удалить из друзей?',who(id).name+' перестанет быть вашим другом. Писать друг другу можно, если есть общий интерес.','Удалить',()=>run(async()=>{closeModal();await frWrite(sb.from('friendships').delete().eq('id',f.id),'Удалено из друзей.');}),true);},
  'install-help':()=>installHelp(),
  'inst-hide':()=>{try{localStorage.setItem('kr-inst-hide','1');}catch(e){}const c=$('#inst-card');if(c)c.remove();},
  'about':()=>aboutModal(),
  'push-on':()=>run(async()=>{
    if(!pushCan())return;
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){fillPush();toast('Уведомления не разрешены.');return;}
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(VAPID_PUBLIC)});
    const j=sub.toJSON();
    const r=await sb.rpc('save_push_subscription',{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth});
    if(r.error)throw r.error;
    PUSH.sub=true;fillPush();toast('Уведомления включены.');
  }),
  'push-test':()=>run(async()=>{
    const r=await sb.rpc('push_test');
    if(r.error)throw r.error;
    openModal('Проверка уведомлений','<p>'+esc(String(r.data||''))+'</p><div class="row" style="margin-top:14px"><button class="btn" type="button" data-act="close">Закрыть</button></div>');
  }),
  'push-off':()=>run(async()=>{
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    if(sub){await sb.rpc('delete_push_subscription',{p_endpoint:sub.endpoint});await sub.unsubscribe();}
    PUSH.sub=false;fillPush();toast('Уведомления выключены.');
  }),
  'join-interest':id=>run(()=>toggleInterest(id)),
  'new-interest':(id,el)=>openInterestForm(null,el&&el.dataset.title),
  'ni-photo-clear':()=>{state.niPhoto={file:null,url:null,remove:true,orig:(state.niPhoto||{}).orig||null};niPhotoBox();},
  'kick':id=>{
    const i=interest(state.arg);if(!i)return;
    const p=who(id);
    confirmModal('Исключить '+p.name+'?','Человек перестанет видеть чат интереса «'+i.title+'» и не сможет вступить снова, пока вы не вернёте ему доступ. Он получит уведомление.','Исключить',()=>run(async()=>{
      const r=await sb.rpc('kick_member',{p_interest:i.id,p_user:id});
      if(r.error)throw r.error;
      closeModal();toast(p.name+' исключён(а) из интереса.');await afterChange();
    }),true);
  },
  'unban':id=>{
    const i=interest(state.arg);if(!i)return;
    run(async()=>{
      const r=await sb.from('interest_bans').delete().eq('interest_id',i.id).eq('user_id',id);
      if(r.error)throw r.error;
      toast('Доступ возвращён: человек снова может вступить.');await afterChange();
    });
  },
  'edit-interest':id=>{const i=interest(id);if(i)openInterestForm(i);},
  'del-interest':id=>{const i=interest(id);if(!i)return;confirmModal('Удалить интерес?','«'+i.title+'» исчезнет вместе с чатом, обсуждениями и встречами. Это нельзя отменить.','Удалить',()=>run(async()=>{await removeRow('interests',id,'Интерес удалён.');if(isMe(i.owner))removeStored(i.photo);closeModal();go('interests');await afterChange();}),true);},
  'new-meetup':id=>openMeetupForm(id),
  'join-meetup':id=>run(()=>toggleMeetup(id)),
  'del-meetup':id=>{const m=M.find(x=>x.id===id);if(!m)return;confirmModal('Удалить встречу?','«'+m.title+'» будет удалена для всех, кто записался.','Удалить',()=>run(async()=>{await removeRow('meetups',id,'Встреча удалена.');closeModal();await afterChange();}),true);},
  'tab':(id,el)=>{state.tab=el.dataset.tab;state.topic=null;render();refresh();},
  'open-topic':id=>{state.topic=id;render();window.scrollTo(0,0);},
  'close-topic':()=>{state.topic=null;render();},
  'new-topic':()=>openTopicForm(),
  'del-topic':id=>confirmModal('Удалить тему?','Тема и все ответы в ней будут удалены.','Удалить',()=>run(async()=>{await removeRow('topics',id,'Тема удалена.');state.topic=null;closeModal();await afterChange();}),true),
  'del-comment':id=>run(async()=>{await removeRow('comments',id,'Ответ удалён.');await afterChange();}),
  'del-chat':id=>run(async()=>{const im=(MSG[id]||{}).img;await removeRow('chat_messages',id,'Сообщение удалено.');if(im)sb.storage.from('chat-photos').remove([im]).then(()=>{},()=>{});await pollChat(true);}),
  'del-dm':id=>run(async()=>{const im=(MSG[id]||{}).img;await removeRow('direct_messages',id,'Сообщение удалено.');if(im)sb.storage.from('chat-photos').remove([im]).then(()=>{},()=>{});await pollThread(true);}),
  'toggle-mine':()=>{state.onlyMine=!state.onlyMine;render();},
  'reset-filters':()=>{state.f={city:'',interest:'',gender:'',age:'',format:''};render();},
  'logout':()=>run(logout),
  'retry':()=>{state.loadError='';render();refresh();},
  'auth-mode':(id,el)=>{state.authMode=el.dataset.mode;state.notice='';render();},
  'to-login':()=>{state.authMode='login';state.notice='';},
  'close':()=>closeModal(),
  'back':()=>{if(history.length>1)history.back();else go('home');},
  'confirm-ok':()=>{const cb=confirmCb;confirmCb=null;if(cb)cb();},
  'report':(id,el)=>openReport(el.dataset.type,id),
  'block':id=>{const p=who(id);confirmModal('Заблокировать '+p.name+'?','Вы не сможете переписываться, а его сообщения в чатах и обсуждениях будут скрыты от вас. Разблокировать можно в любой момент.','Заблокировать',()=>run(async()=>{const r=await sb.from('blocks').insert({blocker_id:state.me.id,blocked_id:id});if(r.error)throw r.error;closeModal();toast('Человек заблокирован.');await afterChange();}),true);},
  'unblock':id=>run(async()=>{const r=await sb.from('blocks').delete().eq('blocker_id',state.me.id).eq('blocked_id',id);if(r.error)throw r.error;toast('Блокировка снята.');await afterChange();}),
  'edit-profile':()=>openProfileForm(),
  'del-account':()=>openModal('Удалить профиль?','<p>Будут удалены ваш профиль, фото, сообщения, темы, ответы и встречи, которые вы организовали. Интересы, которые вы создали, останутся у участников. Это нельзя отменить.</p><div class="check" style="margin-top:12px"><input type="checkbox" id="da-ok"><label for="da-ok">Да, я хочу удалить профиль и все свои данные</label></div><p class="err" id="err" role="alert"></p><div class="row" style="margin-top:14px"><button class="btn warn" type="button" data-act="del-account-ok">Удалить навсегда</button><button class="btn" type="button" data-act="close">Отмена</button></div>'),
  'del-account-ok':()=>{if(!$('#da-ok')||!$('#da-ok').checked){setErr('Поставьте галочку, чтобы подтвердить.');return;}run(deleteAccount);},
  'open-note':id=>{const n=NOTES.find(x=>x.id===id);if(!n)return;run(async()=>{
    if(!n.read_at){n.read_at=new Date().toISOString();state.unreadN=NOTES.filter(x=>!x.read_at).length;renderTop();await sb.from('notifications').update({read_at:n.read_at}).eq('id',id);}
    if(n.link)openLink(n.link);else fillNotes();
  });},
  'read-all':()=>run(async()=>{const r=await sb.from('notifications').update({read_at:new Date().toISOString()}).is('read_at',null);if(r.error)throw r.error;await loadNotes();}),
  'admin-tab':(id,el)=>{state.adminTab=el.dataset.tab;render();},
  'adm-ban':(id,el)=>run(async()=>{const r=await sb.rpc('admin_set_ban',{p_user:id,p_banned:true});if(r.error)throw r.error;ADMIN.banned.add(id);if(el&&el.dataset.report)await sb.rpc('resolve_report',{p_report:el.dataset.report,p_status:'done'});toast('Человек ограничен.');if(state.view==='admin')await loadAdmin();}),
  'adm-unban':id=>run(async()=>{const r=await sb.rpc('admin_set_ban',{p_user:id,p_banned:false});if(r.error)throw r.error;ADMIN.banned.delete(id);toast('Ограничение снято.');if(state.view==='admin')await loadAdmin();}),
  'adm-done':id=>run(async()=>{const r=await sb.rpc('resolve_report',{p_report:id,p_status:'done'});if(r.error)throw r.error;await loadAdmin();}),
  'adm-dismiss':id=>run(async()=>{const r=await sb.rpc('resolve_report',{p_report:id,p_status:'dismissed'});if(r.error)throw r.error;await loadAdmin();}),
  'adm-del':id=>run(async()=>{
    const rep=ADMIN.reports.find(x=>x.id===id);if(!rep)return;
    const tbl={topic:'topics',comment:'comments',chat:'chat_messages',interest:'interests',meetup:'meetups'}[rep.target_type];
    if(!tbl)return;
    const r=await sb.from(tbl).delete().eq('id',rep.target_id);if(r.error)throw r.error;
    await sb.rpc('resolve_report',{p_report:id,p_status:'done'});
    toast('Содержимое удалено, жалоба закрыта.');await loadAdmin();
  }),
  'adm-city-del':id=>run(async()=>{const r=await sb.from('cities').delete().eq('id',id);if(r.error)throw r.error;toast('Город удалён из подсказок.');await loadAdmin();})
};
async function deleteAccount(){
  const uid=state.session.user.id;
  try{const l=await sb.storage.from('avatars').list(uid);if(!l.error&&l.data&&l.data.length)await sb.storage.from('avatars').remove(l.data.map(f=>uid+'/'+f.name));}catch(e){}
  const r=await sb.rpc('delete_my_account');
  if(r.error)throw r.error;
  try{await sb.auth.signOut({scope:'local'});}catch(e){}
  state.session=null;clearData();
  closeModal();toast('Профиль удалён. Все ваши данные стёрты.');
  go('home');
}


/* ---------- знакомства: анкета, тест, фильтр, подбор ---------- */
const DT={ok:true,loaded:false,busy:false,mine:null,priv:null,list:null,listErr:'',theirs:{},retake:false};
const d_GOALS=[['friend','Дружба'],['chat','Общение по интересам'],['dates','Свидания'],['relationship','Серьёзные отношения'],['family','Создать семью']];
const d_OPT={
  body:[['slim','Стройное'],['average','Среднее'],['athletic','Спортивное'],['curvy','С формами'],['plus','Крупное']],
  marital:[['single','Не женат / не замужем'],['divorced','В разводе'],['widowed','Вдовец / вдова'],['separated','Живу отдельно от супруга(и)']],
  children:[['none','Нет'],['have','Есть, живут со мной'],['have_apart','Есть, живут отдельно']],
  want_children:[['yes','Хочу'],['no','Не хочу'],['maybe','Возможно']],
  smoking:[['no','Не курю'],['sometimes','Иногда'],['yes','Курю']],
  alcohol:[['no','Не пью'],['sometimes','Иногда'],['yes','Пью']],
  education:[['school','Среднее'],['college','Среднее специальное'],['bachelor','Высшее (бакалавр)'],['master','Высшее (магистр, специалист)'],['phd','Учёная степень']],
  housing:[['own','Своё жильё'],['rent','Снимаю'],['parents','Живу с родителями'],['dorm','Общежитие']],
  pets:[['none','Нет'],['have','Есть'],['want','Хочу завести']]
};
const OPT_LABEL={goal:'Цель знакомства',height_cm:'Рост',weight_kg:'Вес',body:'Телосложение',marital:'Семейное положение',children:'Дети',want_children:'Хочу детей',smoking:'Курение',alcohol:'Алкоголь',education:'Образование',housing:'Жильё',pets:'Домашние животные',occupation:'Чем занимаюсь',religion:'Религия',languages:'Языки'};
const optName=(k,v)=>{const l=(k==='goal'?d_GOALS:d_OPT[k]||[]).find(x=>x[0]===v);return l?l[1]:'';};
const d_TRAITS=[['o','Открытость новому','любопытство, фантазия, тяга к необычному'],['c','Организованность','порядок, планы, ответственность'],['e','Общительность','энергия от общения, активность'],['a','Доброжелательность','сочувствие, доверие, мягкость'],['n','Эмоциональная чувствительность','склонность переживать и тревожиться']];
const d_QUIZ=['У меня богатое воображение.','Мне неинтересны абстрактные идеи.','Я люблю пробовать новое и необычное.','Я предпочитаю привычное и проверенное.',
 'Я довожу начатое до конца.','Я часто откладываю дела на потом.','Я люблю порядок и планы.','Я бываю небрежным и забывчивым.',
 'Мне легко знакомиться с новыми людьми.','На шумных встречах я предпочитаю держаться в стороне.','Рядом с людьми я заряжаюсь энергией.','Мне нужно много времени побыть одному, чтобы восстановиться.',
 'Я искренне сочувствую чужим проблемам.','Мне трудно уступать в спорах.','Я доверяю людям.','Иногда я бываю резким с людьми.',
 'Я часто беспокоюсь о разном.','Я редко чувствую тревогу и напряжение.','Моё настроение легко меняется.','Я спокойно переношу стресс.'];
const d_SCALE=['Совсем не про меня','Скорее не про меня','Когда как','Скорее про меня','Точно про меня'];
const dtDone=()=>!!(DT.priv&&DT.priv.psych_at);
const dtOn=()=>!!(DT.mine&&DT.mine.wants_dating&&DT.mine.visibility==='public');
const AN_FIELDS=['goal','height_cm','weight_kg','body','marital','children','want_children','smoking','alcohol','education','housing','pets','occupation','religion','languages','about_me','looking_text'];
function dtProgress(){
  const m=DT.mine||{},me=state.me;
  const filled=AN_FIELDS.filter(k=>m[k]!==null&&m[k]!==undefined&&m[k]!=='').length;
  const hasPhoto=!!(me&&me.photo),manyI=I.filter(i=>has(i.members)).length>=3;
  const miss=[];
  if(filled<AN_FIELDS.length)miss.push('заполнить ещё '+(AN_FIELDS.length-filled)+' '+plural(AN_FIELDS.length-filled,['поле','поля','полей'])+' анкеты');
  if(!dtDone())miss.push('пройти тест характера (3 минуты)');
  if(!hasPhoto)miss.push('добавить фото');
  if(!manyI)miss.push('вступить минимум в 3 интереса');
  const pct=Math.round(100*(filled+(dtDone()?3:0)+(hasPhoto?2:0)+(manyI?2:0))/(AN_FIELDS.length+7));
  return {pct,miss};
}
async function loadDating(force){
  if(!state.session||!state.me||DT.busy)return;
  if(DT.uid!==state.me.id){DT.uid=state.me.id;DT.loaded=false;DT.ok=true;DT.mine=null;DT.priv=null;DT.list=null;DT.theirs={};DT.retake=false;}
  if(DT.loaded&&!force)return;
  DT.busy=true;const uid=state.me.id;
  try{
    const [a,b]=await Promise.all([sb.from('dating_profiles').select('*').eq('user_id',uid).maybeSingle(),sb.from('dating_private').select('*').eq('user_id',uid).maybeSingle()]);
    const missing=e=>e&&(e.code==='PGRST205'||e.code==='42P01'||/does not exist|schema cache/i.test(e.message||''));
    if(missing(a.error)||missing(b.error)){DT.ok=false;}
    else if(a.error||b.error)throw (a.error||b.error);
    else{
      DT.ok=true;DT.mine=a.data||null;DT.priv=b.data||null;
      DT.list=null;DT.listErr='';
      if(dtOn()){
        const r=await sb.rpc('find_matches',{p_limit:60});
        if(r.error)DT.listErr=errText(r.error);else DT.list=r.data||[];
        sb.rpc('dating_touch_active').then(()=>{},()=>{});
      }
    }
    DT.loaded=true;
  }catch(e){DT.loadErr=errText(e);DT.loaded=true;}
  finally{DT.busy=false;}
  if(['dating','anketa','test','filter','profile'].includes(state.view))renderKeep();
}
// Своя строка: если она уже есть, обновляем (без user_id), иначе создаём.
function dtSave(tbl,row,exists){
  if(!exists)return sb.from(tbl).insert(row);
  const u=Object.assign({},row);delete u.user_id;
  return sb.from(tbl).update(u).eq('user_id',row.user_id);
}
async function loadTheirs(id){
  if(!DT.ok||id in DT.theirs)return;
  DT.theirs[id]=null;
  const r=await sb.from('dating_profiles').select('*').eq('user_id',id).maybeSingle();
  DT.theirs[id]=(!r.error&&r.data)||null;
  if(state.view==='user'&&state.arg===id)renderKeep();
}
const dtOff=()=>!DT.ok?'<div class="vhead"><h1>Знакомства</h1></div><div class="empty"><p>Раздел появится после обновления базы данных.</p></div>':'';
const d_selHtml=(id,key,cur,empty)=>'<select id="'+id+'"><option value="">'+(empty||'Не указывать')+'</option>'+(key==='goal'?d_GOALS:d_OPT[key]).map(o=>'<option value="'+o[0]+'"'+(cur===o[0]?' selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select>';
const d_fld=(label,inner,id)=>'<div class="field"><label'+(id?' for="'+id+'"':'')+'>'+label+'</label>'+inner+'</div>';
const d_numIn=(id,v,min,max)=>'<input type="number" inputmode="numeric" id="'+id+'" min="'+min+'" max="'+max+'" value="'+(v==null?'':esc(v))+'">';
const dtTabs=cur=>'<div class="tabs2" role="tablist">'+[['dating','Подбор'],['anketa','Моя анкета'],['filter','Кого ищу'],['test','Тест характера']].map(t=>'<a role="tab" href="#'+t[0]+'" aria-selected="'+(cur===t[0])+'">'+t[1]+'</a>').join('')+'</div>';
function dtLoading(){return '<div class="empty"><p>Загружаем…</p></div>';}

function vDating(){
  if(!DT.ok)return dtOff();
  if(!DT.loaded){loadDating();return '<div class="vhead"><h1>Знакомства</h1></div>'+dtLoading();}
  const m=DT.mine,pr=dtProgress();
  const head='<div class="vhead"><h1>Знакомства</h1></div>'+dtTabs('dating');
  if(!m||!m.wants_dating){
    return head+'<section class="section dtbox"><h2>Найдите близкого по духу человека</h2><p>Здесь подбирают людей по общим интересам, характеру и целям знакомства. Для этого нужно включить «Хочу знакомиться» и заполнить анкету: чем она полнее, тем больше шанс найти подходящего человека. Раздел доступен с 18 лет, и пользоваться им могут только те, кто сам открыл свою анкету, так честно для всех.</p><a class="btn primary" href="#anketa">Заполнить анкету</a></section>';
  }
  if(m.visibility!=='public'){
    return head+'<section class="section dtbox"><h2>Ваша анкета скрыта</h2><p>Подбор доступен тем, кто открыл свою анкету для других участников знакомств. Сейчас она видна только вам.</p><a class="btn primary" href="#anketa">Открыть анкету</a></section>';
  }
  const tips=SAFE_TIPS;
  const bar=pr.pct<100?'<div class="dtprog"><div class="dtp-top"><b>Анкета заполнена на '+pr.pct+'%</b><a href="#anketa">Дополнить</a></div><div class="bar"><i style="width:'+pr.pct+'%"></i></div><p class="hint">Чем полнее анкета, тем точнее подбор и выше шанс найти похожего человека.'+(pr.miss.length?' Осталось: '+esc(pr.miss.join(', '))+'.':'')+'</p></div>':'';
  let body;
  if(DT.listErr)body='<div class="empty"><p>'+esc(DT.listErr)+'</p></div>';
  else if(!DT.list)body=dtLoading();
  else if(!DT.list.length)body='<div class="empty"><p>Пока никого не нашлось. Попробуйте расширить фильтр «Кого ищу» (например, выбрать «любой город») или зайти позже: людей станет больше.</p><a class="btn" href="#filter">Настроить фильтр</a></div>';
  else body='<p class="hint" style="margin-bottom:10px">Найдено: '+DT.list.length+'. Процент показывает, насколько вы подходите друг другу по интересам, характеру, цели и образу жизни. Это ориентир, а не приговор.</p><div class="mlist">'+DT.list.map(d_dtCard).join('')+'</div>';
  return head+bar+body+tips;
}
function d_actText(iso){
  const d=(Date.now()-new Date(iso).getTime())/864e5;
  return d<1?'заходил(а) сегодня':d<7?'заходил(а) на этой неделе':'давно не заходил(а)';
}
function d_dtCard(x){
  const p=PEOPLE[x.user_id];if(!p)return '';
  const goal=(DT.theirs[x.user_id]&&DT.theirs[x.user_id].goal)||'';
  return '<article class="mcard dtcard"><a class="dtava" href="#user-'+esc(p.id)+'">'+av(p,'md')+'</a><div class="dtmain">'+
    '<h3><a class="plink" href="#user-'+esc(p.id)+'">'+esc(p.name)+'</a>, '+p.age+'</h3><p class="meta">'+esc(p.city)+' · '+esc(d_actText(x.last_active))+'</p>'+
    '<p class="dtl"><b>Интересы:</b> '+(x.shared?x.shared+' общих: '+esc((x.shared_titles||[]).slice(0,4).join(', ')):'общих пока нет')+'</p>'+
    '<p class="dtl"><b>Характер:</b> '+(x.psych_pct==null?'<span class="meta">тест не пройден'+(dtDone()?' им(ей)':'')+'</span>':x.psych_pct+'% совместимости')+'</p>'+
    (x.goal_pct==null?'':'<p class="dtl"><b>Цели:</b> '+(x.goal_pct>=100?'совпадают':x.goal_pct>=70?'близки':'разные')+'</p>')+
    '<div class="row"><a class="btn sm" href="#user-'+esc(p.id)+'">Анкета</a>'+(canDM(p.id)?'<a class="btn sm primary" href="#messages-'+esc(p.id)+'">Написать</a>':(HAS_FR&&frState(p.id)==='none'?'<button class="btn sm primary" type="button" data-act="fr-add" data-id="'+esc(p.id)+'">В друзья</button>':''))+'</div></div>'+
    '<div class="dtpct" aria-label="Совпадение '+x.score+'%"><b>'+x.score+'%</b><span>совпадение</span></div></article>';
}

function vAnketa(){
  if(!DT.ok)return dtOff();
  if(!DT.loaded){loadDating();return '<div class="vhead"><h1>Моя анкета</h1></div>'+dtLoading();}
  const m=DT.mine||{},pr=dtProgress();
  const fl=(k,t)=>d_fld(OPT_LABEL[k],d_selHtml('an-'+k,k,m[k]),'an-'+k);
  return '<div class="vhead"><h1>Моя анкета</h1></div>'+dtTabs('anketa')+
  '<form id="f-an" class="dtform">'+
  '<section class="section dtbox"><h2>Участие в знакомствах</h2>'+
    '<label class="chk"><input type="checkbox" id="an-wants"'+(m.wants_dating?' checked':'')+'> <span>Хочу знакомиться (раздел доступен только участникам, включившим эту настройку)</span></label>'+
    d_fld('Кто видит мою анкету','<select id="an-vis"><option value="public"'+(m.visibility==='public'?' selected':'')+'>Все, кто открыл свою анкету</option><option value="private"'+(m.visibility!=='public'?' selected':'')+'>Только я (скрыта)</option></select>','an-vis')+
    '<label class="chk"><input type="checkbox" id="an-consent"'+(m.consent_at?' checked':'')+'> <span>Я согласен(на) на обработку данных анкеты, включая необязательные (религия, дети, привычки), для подбора людей. Анкету видят только участники знакомств, результаты теста и фильтр не видит никто, кроме меня. Анкету можно скрыть или удалить в любой момент.</span></label></section>'+
  '<div class="dtprog"><div class="dtp-top"><b>Анкета заполнена на '+pr.pct+'%</b></div><div class="bar"><i style="width:'+pr.pct+'%"></i></div><p class="hint">Чем полнее анкета, тем больше вероятность найти похожего человека. Все поля необязательны, на любой вопрос можно не отвечать.'+(pr.miss.length?' Осталось: '+esc(pr.miss.join(', '))+'.':'')+'</p></div>'+
  '<section class="section"><h2>О себе</h2><div class="dtgrid">'+
    fl('goal')+d_fld('Рост, см',d_numIn('an-height_cm',m.height_cm,120,230),'an-height_cm')+d_fld('Вес, кг',d_numIn('an-weight_kg',m.weight_kg,30,250),'an-weight_kg')+
    fl('body')+fl('marital')+fl('children')+fl('want_children')+fl('smoking')+fl('alcohol')+fl('education')+fl('housing')+fl('pets')+
    d_fld('Чем занимаюсь','<input type="text" id="an-occupation" maxlength="60" value="'+esc(m.occupation||'')+'">','an-occupation')+
    d_fld('Религия','<input type="text" id="an-religion" maxlength="40" value="'+esc(m.religion||'')+'" placeholder="по желанию">','an-religion')+
    d_fld('Языки','<input type="text" id="an-languages" maxlength="80" value="'+esc(m.languages||'')+'">','an-languages')+'</div>'+
    d_fld('Расскажите о себе','<textarea id="an-about_me" rows="3" maxlength="1000">'+esc(m.about_me||'')+'</textarea>','an-about_me')+
    d_fld('Кого хочу найти','<textarea id="an-looking_text" rows="3" maxlength="500">'+esc(m.looking_text||'')+'</textarea>','an-looking_text')+'</section>'+
  '<p id="err" class="err" role="alert"></p><div class="row"><button class="btn primary" type="submit" id="submit-btn">Сохранить анкету</button>'+(DT.mine?'<button class="btn warn" type="button" data-act="an-del">Удалить анкету и тест</button>':'')+'</div></form>'+
  '<section class="section"><h2>Тест характера</h2><p>'+(dtDone()?'Вы прошли тест. Его можно пройти заново.':'Тест из 20 утверждений помогает оценить психологическую совместимость. Это самоописание, а не диагноз.')+'</p><a class="btn" href="#test">'+(dtDone()?'Посмотреть результат':'Пройти тест')+'</a></section>';
}
const d_vOf=id=>{const e=$('#'+id);return e?e.value.trim():'';};
const d_nOf=(id)=>{const v=d_vOf(id);return v===''?null:parseInt(v,10);};
async function saveAnketa(){
  const wants=$('#an-wants').checked,cons=$('#an-consent').checked;
  if(wants&&!cons){setErr('Поставьте галочку согласия на обработку данных, чтобы включить знакомства.');return;}
  const row={user_id:state.me.id,wants_dating:wants,visibility:d_vOf('an-vis')||'private',consent_at:cons?((DT.mine&&DT.mine.consent_at)||new Date().toISOString()):null};
  const num=(k,min,max)=>{const v=d_nOf('an-'+k);if(v!==null&&(isNaN(v)||v<min||v>max))throw new Error(OPT_LABEL[k]+': допустимо от '+min+' до '+max+'.');row[k]=v;};
  try{num('height_cm',120,230);num('weight_kg',30,250);}catch(e){setErr(e.message);return;}
  ['goal','body','marital','children','want_children','smoking','alcohol','education','housing','pets'].forEach(k=>{row[k]=d_vOf('an-'+k)||null;});
  ['occupation','religion','languages','about_me','looking_text'].forEach(k=>{row[k]=d_vOf('an-'+k)||null;});
  const r=await dtSave('dating_profiles',row,!!DT.mine);
  if(r.error)throw r.error;
  DT.loaded=false;await loadDating(true);
  toast(wants&&row.visibility==='public'?'Анкета сохранена. Подбор открыт.':'Анкета сохранена.');
  go(wants&&row.visibility==='public'?'dating':'anketa');
}

function vFilter(){
  if(!DT.ok)return dtOff();
  if(!DT.loaded){loadDating();return '<div class="vhead"><h1>Кого ищу</h1></div>'+dtLoading();}
  const s=DT.priv||{seek_gender:'any',seek_age_min:18,seek_age_max:99,seek_city:'same',seek_smoking:'any',seek_alcohol:'any',seek_children:'any',seek_goal:'any'};
  const sel=(id,cur,opts)=>'<select id="'+id+'">'+opts.map(o=>'<option value="'+o[0]+'"'+(cur===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select>';
  return '<div class="vhead"><h1>Кого ищу</h1></div>'+dtTabs('filter')+
  '<form id="f-flt" class="dtform"><p class="hint">Настройте, кого показывать в подборе. Фильтр видите только вы. Если человек не указал какой-то параметр, он всё равно может попасть в список.</p><div class="dtgrid">'+
    d_fld('Пол',sel('fl-gender',s.seek_gender,[['any','Любой'],['f','Женщина'],['m','Мужчина']]),'fl-gender')+
    d_fld('Город',sel('fl-city',s.seek_city,[['same','Только мой город'],['any','Любой город']]),'fl-city')+
    d_fld('Возраст от',d_numIn('fl-age1',s.seek_age_min,18,99),'fl-age1')+d_fld('Возраст до',d_numIn('fl-age2',s.seek_age_max,18,99),'fl-age2')+
    d_fld('Рост от, см',d_numIn('fl-h1',s.seek_height_min,120,230),'fl-h1')+d_fld('Рост до, см',d_numIn('fl-h2',s.seek_height_max,120,230),'fl-h2')+
    d_fld('Вес от, кг',d_numIn('fl-w1',s.seek_weight_min,30,250),'fl-w1')+d_fld('Вес до, кг',d_numIn('fl-w2',s.seek_weight_max,30,250),'fl-w2')+
    d_fld('Курение',sel('fl-smoke',s.seek_smoking,[['any','Не важно'],['no','Только некурящие']]),'fl-smoke')+
    d_fld('Алкоголь',sel('fl-alc',s.seek_alcohol,[['any','Не важно'],['no','Только не пьющие']]),'fl-alc')+
    d_fld('Дети',sel('fl-ch',s.seek_children,[['any','Не важно'],['none','Только без детей']]),'fl-ch')+
    d_fld('Цель знакомства',sel('fl-goal',s.seek_goal,[['any','Любая']].concat(d_GOALS)),'fl-goal')+
  '</div><p id="err" class="err" role="alert"></p><div class="row"><button class="btn primary" type="submit" id="submit-btn">Сохранить фильтр</button></div></form>';
}
async function saveFilter(){
  const g=id=>{const v=d_vOf(id);return v===''?null:parseInt(v,10);};
  const a1=g('fl-age1')||18,a2=g('fl-age2')||99;
  if(a1<18||a2>99||a1>a2){setErr('Возраст: от 18 до 99, и «от» не больше «до».');return;}
  const pairs=[['fl-h1','fl-h2','Рост'],['fl-w1','fl-w2','Вес']];
  for(const p of pairs){const x=g(p[0]),y=g(p[1]);if(x!==null&&y!==null&&x>y){setErr(p[2]+': «от» не должно быть больше «до».');return;}}
  const row={user_id:state.me.id,seek_gender:d_vOf('fl-gender'),seek_city:d_vOf('fl-city'),seek_age_min:a1,seek_age_max:a2,
    seek_height_min:g('fl-h1'),seek_height_max:g('fl-h2'),seek_weight_min:g('fl-w1'),seek_weight_max:g('fl-w2'),
    seek_smoking:d_vOf('fl-smoke'),seek_alcohol:d_vOf('fl-alc'),seek_children:d_vOf('fl-ch'),seek_goal:d_vOf('fl-goal')};
  const r=await dtSave('dating_private',row,!!DT.priv);
  if(r.error)throw r.error;
  DT.loaded=false;await loadDating(true);toast('Фильтр сохранён.');go('dating');
}

function vTest(){
  if(!DT.ok)return dtOff();
  if(!DT.loaded){loadDating();return '<div class="vhead"><h1>Тест характера</h1></div>'+dtLoading();}
  const head='<div class="vhead"><h1>Тест характера</h1></div>'+dtTabs('test');
  if(dtDone()&&!DT.retake){
    const p=DT.priv,lvl=v=>v>=67?'высокая':v>=34?'средняя':'низкая';
    return head+'<section class="section"><p>Ваш профиль по пяти чертам характера. Другие участники его не видят: им показывается только итоговый процент совместимости.</p>'+
      d_TRAITS.map(t=>{const v=p['p_'+t[0]];return '<div class="trait"><div class="dtp-top"><b>'+t[1]+'</b><span>'+v+'% · '+lvl(v)+'</span></div><div class="bar"><i style="width:'+v+'%"></i></div><p class="hint">'+t[2]+'</p></div>';}).join('')+
      '<p class="hint">Это самоописание, а не диагноз. Тест нужен, чтобы подбирать людей, с которыми вам, скорее всего, будет комфортно.</p>'+
      '<div class="row"><button class="btn" type="button" data-act="test-retake">Пройти заново</button><a class="btn primary" href="#dating">К подбору</a></div></section>';
  }
  return head+'<form id="f-test" class="dtform"><p>Оцените, насколько каждое утверждение подходит вам. Отвечайте не раздумывая: первый ответ обычно самый честный. Всего 20 утверждений.</p>'+
    d_QUIZ.map((q,i)=>'<fieldset class="q"><legend>'+(i+1)+'. '+esc(q)+'</legend><div class="scale">'+d_SCALE.map((s,k)=>'<label><input type="radio" name="q'+i+'" value="'+(k+1)+'"><span>'+(k+1)+'</span><small>'+s+'</small></label>').join('')+'</div></fieldset>').join('')+
    '<p id="err" class="err" role="alert"></p><div class="row"><button class="btn primary" type="submit" id="submit-btn">Показать результат</button></div></form>';
}
async function saveTest(){
  const ans=[];
  for(let i=0;i<20;i++){const c=document.querySelector('input[name=q'+i+']:checked');if(!c){setErr('Ответьте на вопрос '+(i+1)+'.');const f=document.querySelector('input[name=q'+i+']');if(f)f.scrollIntoView({block:'center'});return;}ans.push(parseInt(c.value,10));}
  const r=await sb.rpc('save_psych',{p_answers:ans});
  if(r.error)throw r.error;
  DT.retake=false;DT.loaded=false;await loadDating(true);toast('Результат сохранён.');
}
function d_anketaView(id){
  if(!DT.ok||state.me&&id===state.me.id)return '';
  if(!(id in DT.theirs)){loadTheirs(id);return '';}
  const a=DT.theirs[id];if(!a)return '';
  const rows=[];
  const add=(k,v)=>{if(v)rows.push('<div class="arow"><dt>'+OPT_LABEL[k]+'</dt><dd>'+esc(v)+'</dd></div>');};
  add('goal',optName('goal',a.goal));
  if(a.height_cm)add('height_cm',a.height_cm+' см');
  if(a.weight_kg)add('weight_kg',a.weight_kg+' кг');
  ['body','marital','children','want_children','smoking','alcohol','education','housing','pets'].forEach(k=>add(k,optName(k,a[k])));
  ['occupation','religion','languages'].forEach(k=>add(k,a[k]));
  const mt=DT.list&&DT.list.find(x=>x.user_id===id);
  return '<section class="section"><h2 style="margin-bottom:12px">Анкета</h2>'+
    (mt?'<p class="dtl"><span class="chip founder">Совпадение '+mt.score+'%</span> '+(mt.shared?'Общих интересов: '+mt.shared+'. ':'')+(mt.psych_pct!=null?'Характер: '+mt.psych_pct+'%.':'')+'</p>':'')+
    (rows.length?'<dl class="alist">'+rows.join('')+'</dl>':'')+
    (a.about_me?'<h3>О себе</h3><p class="about">'+esc(a.about_me)+'</p>':'')+
    (a.looking_text?'<h3>Кого ищет</h3><p class="about">'+esc(a.looking_text)+'</p>':'')+'</section>';
}
function profileDatingCard(){
  if(!DT.ok)return '';
  return '<section class="section"><h2 style="margin-bottom:14px">Знакомства</h2><p>'+(DT.mine&&DT.mine.wants_dating?'Подбор людей по интересам, характеру и целям.':'Заполните анкету и пройдите тест, чтобы найти близкого по духу человека. Чем полнее анкета, тем выше шанс.')+'</p><div class="row"><a class="btn primary" href="#'+(DT.mine&&DT.mine.wants_dating?'dating':'anketa')+'">'+(DT.mine&&DT.mine.wants_dating?'Открыть подбор':'Заполнить анкету')+'</a><a class="btn" href="#anketa">Моя анкета</a></div></section>';
}
Object.assign(ACT,{
  'test-retake':()=>{DT.retake=true;renderKeep();},
  'an-del':()=>openModal('Удалить анкету?','<p>Будут удалены ваша анкета, фильтр и результаты теста. Это нельзя отменить.</p><div class="row" style="margin-top:14px"><button class="btn warn" type="button" data-act="an-del-ok">Удалить</button><button class="btn" type="button" data-act="close">Отмена</button></div>'),
  'an-del-ok':()=>run(async()=>{
    const a=await sb.from('dating_profiles').delete().eq('user_id',state.me.id);if(a.error)throw a.error;
    const b=await sb.from('dating_private').delete().eq('user_id',state.me.id);if(b.error)throw b.error;
    closeModal();DT.mine=null;DT.priv=null;DT.list=null;DT.retake=false;DT.loaded=false;await loadDating(true);toast('Анкета удалена.');go('dating');
  })
});


/* ---------- этап 2: длинные сообщения, статусы, опросы, закрепления, приватность ---------- */
const SPOIL=new Set();
const POLL={};
let PINS=[];
const SET={loaded:false,ok:true,show_typing:true,show_read:true,show_active:true};
let typSent=0;
const missingErr=e=>!!e&&(e.code==='PGRST202'||e.code==='PGRST205'||e.code==='42P01'||e.code==='42883'||e.code==='42703'||/does not exist|schema cache|Could not find/i.test(e.message||''));
// Текст сообщения: длинное (больше 3000 знаков) сворачивается под кнопку.
function bodyHtml(id,text){
  text=String(text||'');
  if(text.length<=SPOIL_AT)return esc(text);
  const open=SPOIL.has(id);
  return esc(text.slice(0,SPOIL_AT))+'<span class="spoil-rest"'+(open?'':' hidden')+'>'+esc(text.slice(SPOIL_AT))+'</span> <button type="button" class="lnk spoil-btn" data-act="spoil" data-id="'+esc(id)+'" aria-expanded="'+open+'">'+(open?'Свернуть':'Показать остальное ('+(text.length-SPOIL_AT)+' зн.)')+'</button>';
}
function limCheck(kind){
  const inp=msgInput(kind),w=$('#lim-'+kind);if(!inp||!w)return;
  const n=inp.value.length;
  if(n>MSG_MAX){w.hidden=false;w.textContent='Превышен лимит в '+MSG_MAX+' символов: сейчас '+n+'. Сократите текст, чтобы отправить.';}
  else w.hidden=true;
}
function typingPing(kind,val){
  if(!HAS_ST||!SET.show_typing||!String(val).trim())return;
  const now=Date.now();if(now-typSent<3000)return;typSent=now;
  const target=kind==='dm'?state.arg:((interest(state.arg)||{}).id);if(!target)return;
  sb.rpc('set_typing',{p_kind:kind,p_target:target}).then(r=>{if(r.error&&missingErr(r.error))HAS_ST=false;},()=>{});
}
function typingText(ids){
  const names=ids.map(id=>(PEOPLE[id]||{}).name).filter(Boolean).map(n=>n.split(' ')[0]);
  if(!names.length)return '';
  return names.length===1?names[0]+' печатает…':names.length===2?names.join(' и ')+' печатают…':'Печатают несколько человек…';
}
function pollHtml(m){
  const p=POLL[m.poll_id];
  if(!p)return '<p class="mt">'+esc(m.body)+'</p>';
  const total=p.opts.reduce((a,o)=>a+o.cnt,0);
  const canClose=!p.closed&&(isMe(p.author)||state.status.is_admin||ownerMod(interest(state.arg)));
  return '<div class="poll"><p class="pq">📊 '+esc(p.q)+'</p><p class="meta">'+(p.multi?'Можно выбрать несколько ответов':'Один ответ')+(p.closed?' · опрос завершён':'')+'</p>'+
    p.opts.map(o=>{const pc=total?Math.round(100*o.cnt/total):0;
      return '<button type="button" class="popt'+(o.mine?' on':'')+'" data-act="vote" data-id="'+esc(o.id)+'"'+(p.closed?' disabled':'')+' aria-pressed="'+(!!o.mine)+'"><i style="width:'+pc+'%"></i><span class="pl">'+esc(o.text)+'</span><b>'+o.cnt+(total?' · '+pc+'%':'')+'</b></button>';}).join('')+
    '<p class="meta">Голосов: '+total+(p.closed?'':'. Нажмите на вариант ещё раз, чтобы убрать свой голос.')+'</p>'+(canClose?'<button class="lnk" type="button" data-act="poll-close" data-id="'+esc(m.poll_id)+'">Завершить опрос</button>':'')+'</div>';
}
function pinsHtml(){
  if(!PINS.length)return '';
  const i=interest(state.arg),mod=state.status.is_admin||ownerMod(i);
  return '<div class="pinsbox"><b>📌 Закреплено</b>'+PINS.map(p=>'<div class="pinrow"><button type="button" class="pinq" data-act="jump" data-id="'+esc(p.id)+'"><b>'+esc(who(p.author).name)+'</b><span>'+esc(snip(p.text,140))+'</span></button>'+(mod?'<button type="button" class="lnk" data-act="unpin" data-id="'+esc(p.id)+'">Открепить</button>':'')+'</div>').join('')+'</div>';
}
async function loadChatExtras(id,vis){
  const out={typing:[],pins:[],polls:null};
  const jobs=[];
  const pollIds=HAS_PO?[...new Set(vis.filter(m=>m.poll_id).map(m=>m.poll_id))]:[];
  if(pollIds.length)jobs.push((async()=>{
    const [a,b,c]=await Promise.all([sb.from('polls').select('id,question,multi,closed_at,author_id').in('id',pollIds),sb.from('poll_options').select('id,poll_id,text,pos').in('poll_id',pollIds),sb.rpc('poll_results',{p_polls:pollIds})]);
    if(a.error||b.error||c.error){if(missingErr(a.error||b.error||c.error))HAS_PO=false;return;}
    const res={};(c.data||[]).forEach(r=>{res[r.option_id]=r;});
    const o={};
    a.data.forEach(p=>{o[p.id]={q:p.question,multi:p.multi,closed:!!p.closed_at,author:p.author_id,opts:[]};});
    b.data.slice().sort((x,y)=>x.pos-y.pos).forEach(op=>{const p=o[op.poll_id];if(p){const r=res[op.id]||{};p.opts.push({id:op.id,text:op.text,cnt:r.cnt||0,mine:!!r.mine});}});
    out.polls=o;
  })());
  if(HAS_PIN)jobs.push((async()=>{
    const r=await sb.from('chat_pins').select('message_id,pinned_at').eq('interest_id',id).order('pinned_at',{ascending:false});
    if(r.error){if(missingErr(r.error))HAS_PIN=false;return;}
    const ids=r.data.map(x=>x.message_id);
    const have={};vis.forEach(m=>{have[m.id]=m;});
    const miss=ids.filter(x=>!have[x]);
    if(miss.length){const q=await sb.from('chat_messages').select('id,author_id,body').in('id',miss);if(!q.error)q.data.forEach(m=>{have[m.id]=m;});}
    await ensurePeople(ids.map(x=>have[x]&&have[x].author_id).filter(Boolean));
    out.pins=ids.map(x=>have[x]).filter(Boolean).filter(m=>!BLOCKED.has(m.author_id)).map(m=>({id:m.id,author:m.author_id,text:m.body}));
  })());
  if(HAS_ST)jobs.push((async()=>{
    const r=await sb.rpc('chat_status',{p_interest:id});
    if(r.error){if(missingErr(r.error))HAS_ST=false;return;}
    out.typing=(r.data||[]).filter(x=>!BLOCKED.has(x));
    await ensurePeople(out.typing);
  })());
  await Promise.all(jobs);
  return out;
}
async function loadSettings(){
  if(SET.loaded||!state.me)return;
  SET.loaded=true;
  let r=await sb.from('user_settings').select('show_typing,show_read,show_active,remind_meetups').eq('user_id',state.me.id).maybeSingle();
  if(r.error&&/remind_meetups/.test(r.error.message||'')){SET.noRemind=true;r=await sb.from('user_settings').select('show_typing,show_read,show_active').eq('user_id',state.me.id).maybeSingle();}
  if(r.error){if(missingErr(r.error)){SET.ok=false;HAS_ST=false;}else SET.loaded=false;}
  else if(r.data){SET.remind_meetups=r.data.remind_meetups;SET.show_typing=r.data.show_typing;SET.show_read=r.data.show_read;SET.show_active=r.data.show_active;SET.exists=true;}
  if(state.view==='profile')renderKeep();
}
function privacyCard(){
  if(!SET.ok)return '';
  const c=(id,on,t)=>'<label class="chk"><input type="checkbox" id="'+id+'"'+(on?' checked':'')+'> <span>'+t+'</span></label>';
  return '<section class="section"><h2 style="margin-bottom:14px">Приватность</h2><div class="dtbox">'+
    c('ps-typing',SET.show_typing,'Показывать, что я печатаю, и видеть, когда печатают другие')+
    c('ps-read',SET.show_read,'Показывать «прочитано» в личных сообщениях (если выключить, вы тоже не увидите «прочитано» у других)')+
    c('ps-active',SET.show_active,'Показывать в подборе знакомств, когда я заходил(а)')+
    (SET.noRemind?'':c('ps-remind',SET.remind_meetups!==false,'Напоминать о встречах, на которые я записан(а) (за день и за час)'))+'</div></section>';
}
async function saveSettings(){
  const row={user_id:state.me.id,show_typing:$('#ps-typing').checked,show_read:$('#ps-read').checked,show_active:$('#ps-active').checked};
  const rm=$('#ps-remind');if(rm&&!SET.noRemind)row.remind_meetups=rm.checked;
  let r=await dtSave('user_settings',row,!!SET.exists);
  if(r.error&&row.remind_meetups!==undefined&&/remind_meetups/.test(r.error.message||'')){SET.noRemind=true;delete row.remind_meetups;r=await dtSave('user_settings',row,!!SET.exists);}
  if(r.error)throw r.error;
  if(row.remind_meetups!==undefined)SET.remind_meetups=row.remind_meetups;
  SET.exists=true;SET.show_typing=row.show_typing;SET.show_read=row.show_read;SET.show_active=row.show_active;
  toast('Настройки сохранены.');
}
const SAFE_TIPS='<details class="tips"><summary>Советы по безопасности</summary><ul><li>Первую встречу назначайте в людном месте и днём.</li><li>Сообщите близким, куда и с кем идёте.</li><li>Не переводите деньги и не сообщайте коды, пароли и данные карт, даже если просит приятный собеседник.</li><li>Не торопитесь делиться адресом и местом работы.</li><li>Если что-то насторожило, заблокируйте человека и пожалуйтесь: мы проверим.</li></ul></details>';
function dmSafeHtml(msgs,o){
  const me=state.me.id;
  if(!msgs.length||isFriend(o)||msgs.some(m=>m.sender_id===me))return '';
  return '<div class="safebox" role="note"><b>Вы не знакомы с этим человеком.</b> Не переходите по подозрительным ссылкам, не переводите деньги и не сообщайте личные данные. Если что-то не так, <button class="lnk" type="button" data-act="block" data-id="'+esc(o)+'">заблокируйте</button> или <button class="lnk" type="button" data-act="report" data-type="user" data-id="'+esc(o)+'">пожалуйтесь</button>.</div>';
}
function pollForm(){
  const row=(k)=>'<input type="text" class="pl-o" maxlength="80" placeholder="Вариант '+k+'" aria-label="Вариант '+k+'">';
  return '<div class="dtform"><div class="field"><label for="pl-q">Вопрос</label><input type="text" id="pl-q" maxlength="200" placeholder="Например: когда встречаемся?"></div>'+
    '<div class="field"><label>Варианты ответа (от 2 до 6)</label><div id="pl-opts" class="plopts">'+row(1)+row(2)+'</div><button type="button" class="btn sm" data-act="poll-addopt" id="pl-add">Добавить вариант</button></div>'+
    '<label class="chk"><input type="checkbox" id="pl-multi"> <span>Можно выбрать несколько ответов</span></label>'+
    '<p id="err" class="err" role="alert"></p><div class="row"><button class="btn primary" type="button" data-act="poll-create">Создать опрос</button><button class="btn" type="button" data-act="close">Отмена</button></div></div>';
}
Object.assign(ACT,{
  'spoil':(id,el)=>{
    const t=el.previousElementSibling;if(!t||!t.classList.contains('spoil-rest'))return;
    const open=t.hidden;t.hidden=!open;
    if(open)SPOIL.add(id);else SPOIL.delete(id);
    const m=MSG[id],n=m?m.text.length-SPOIL_AT:0;
    el.textContent=open?'Свернуть':'Показать остальное ('+n+' зн.)';el.setAttribute('aria-expanded',String(open));
  },
  'vote':id=>run(async()=>{const r=await sb.rpc('cast_vote',{p_option:id});if(r.error)throw r.error;await pollChat(true);}),
  'poll-close':id=>run(async()=>{const r=await sb.rpc('close_poll',{p_poll:id});if(r.error)throw r.error;toast('Опрос завершён.');await pollChat(true);}),
  'poll-new':()=>openModal('Новый опрос',pollForm()),
  'poll-addopt':()=>{const box=$('#pl-opts');if(!box)return;const n=box.querySelectorAll('.pl-o').length;if(n>=6)return;box.insertAdjacentHTML('beforeend','<input type="text" class="pl-o" maxlength="80" placeholder="Вариант '+(n+1)+'" aria-label="Вариант '+(n+1)+'">');if(n+1>=6)$('#pl-add').hidden=true;const l=box.querySelectorAll('.pl-o');l[l.length-1].focus();},
  'poll-create':()=>run(async()=>{
    const i=interest(state.arg);if(!i)return;
    const q=($('#pl-q').value||'').trim(),opts=[...document.querySelectorAll('#pl-opts .pl-o')].map(x=>x.value.trim()).filter(Boolean);
    if(!q){setErr('Напишите вопрос.');return;}
    if(opts.length<2){setErr('Нужно хотя бы 2 варианта ответа.');return;}
    const r=await sb.rpc('create_poll',{p_interest:i.id,p_question:q,p_options:opts,p_multi:$('#pl-multi').checked});
    if(r.error){setErr(errText(r.error));return;}
    closeModal();await pollChat(true);toast('Опрос создан.');
  }),
  'pin':id=>run(async()=>{const r=await sb.rpc('pin_message',{p_message:id});if(r.error)throw r.error;toast('Сообщение закреплено.');await pollChat(true);}),
  'unpin':id=>run(async()=>{const r=await sb.rpc('unpin_message',{p_message:id});if(r.error)throw r.error;toast('Сообщение откреплено.');await pollChat(true);})
});

document.addEventListener('click',e=>{
  const li=e.target.closest('.combo-list li');
  if(li){pickCity(li);return;}
  const el=e.target.closest('[data-act]');
  if(el){
    const fn=ACT[el.dataset.act];
    if(fn){if(!(el.tagName==='A'&&el.dataset.act==='to-login'))e.preventDefault();fn(el.dataset.id,el);}
    return;
  }
  if(e.target.id==='ov')closeModal();
});
document.addEventListener('mousedown',e=>{const li=e.target.closest('.combo-list li');if(li){e.preventDefault();pickCity(li);}});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(!$('#ov2').hidden){closeCrop();return;}
    const cin=e.target&&(e.target.id==='chat-in'?'chat':(e.target.id==='dm-in'?'dm':null));
    if(cin&&(COMPOSE[cin].reply||COMPOSE[cin].edit)){const c=COMPOSE[cin];if(c.edit){e.target.value='';grow(e.target);}COMPOSE[cin]={};updBar(cin);return;}
    const open=document.querySelector('.combo-list:not([hidden])');
    if(open){const inp=document.querySelector('[data-list="'+open.id+'"]');if(inp)hideCombo(inp);return;}
    if(!$('#ov').hidden)closeModal();
    return;
  }
  const inp=e.target;
  if(inp&&(inp.id==='chat-in'||inp.id==='dm-in')&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!(window.matchMedia&&window.matchMedia('(pointer:coarse)').matches)){
    e.preventDefault();
    const sbtn=inp.form&&inp.form.querySelector('button[type=submit]');
    if(sbtn)sbtn.click();
    return;
  }
  if(inp&&inp.classList&&inp.classList.contains('cityin')){
    if(e.key==='ArrowDown'){if(moveCombo(inp,1))e.preventDefault();}
    else if(e.key==='ArrowUp'){if(moveCombo(inp,-1))e.preventDefault();}
    else if(e.key==='Enter'){
      const list=document.getElementById(inp.dataset.list);
      const sel=list&&!list.hidden&&list.querySelector('li[aria-selected="true"]');
      if(sel){e.preventDefault();pickCity(sel);}
    }
  }
});
document.addEventListener('focusout',e=>{if(e.target.classList&&e.target.classList.contains('cityin'))setTimeout(()=>{if(document.activeElement!==e.target)hideCombo(e.target);},150);});
document.addEventListener('input',e=>{
  const t=e.target,id=t.id;
  if(t.tagName==='TEXTAREA')grow(t);
  if(id==='chat-in'||id==='dm-in'){const k=id==='dm-in'?'dm':'chat';limCheck(k);typingPing(k,t.value);}
  if(id==='q'){state.q=t.value;fillInterests();}
  else if(id==='f-age'){state.f.age=t.value;fillMeetups();}
  else if(id==='fr-q')fillFriendsFind();
  else if(id==='crop-zoom'){CROP.z=(parseInt(t.value,10)||100)/100;cropDraw();}
  else if(id==='ni-title'){showSimilar();niPrevRefresh();}
  else if(t.classList&&t.classList.contains('cityin')){clearTimeout(comboTimer);comboTimer=setTimeout(()=>suggestCities(t),180);}
});
document.addEventListener('change',e=>{
  const t=e.target,id=t.id;
  if(id==='f-city'){state.f.city=t.value;fillMeetups();}
  else if(id==='f-format'){state.f.format=t.value;fillMeetups();}
  else if(id==='f-interest'){state.f.interest=t.value;fillMeetups();}
  else if(id==='f-gender'){state.f.gender=t.value;fillMeetups();}
  else if(id==='ps-typing'||id==='ps-read'||id==='ps-active'||id==='ps-remind')run(saveSettings);
  else if(id==='dm-photo'||id==='chat-photo'){const f=t.files&&t.files[0];t.value='';if(f)photoChosen(id==='dm-photo'?'dm':'chat',f);}
  else if(id==='cat'){state.cat=t.value;fillInterests();}
  else if(id==='fmt'){state.fmt=t.value;fillInterests();}
  else if(t.name==='nfmt')syncCityVisibility();
  else if(t.name==='hue')niPrevRefresh();
  else if(t.name==='mfmt')syncMeetupFormat();
  else if(id==='notify-sel'){
    const i=interest(state.arg);if(!i)return;
    const val=t.value;
    run(async()=>{const r=await sb.from('interest_members').update({notify:val}).eq('interest_id',i.id).eq('user_id',state.me.id);if(r.error)throw r.error;i.notify=val;toast('Сохранено: '+NOTIFY[val].toLowerCase()+'.');});
  }
  else if(id==='photo'){
    const file=t.files&&t.files[0];t.value='';
    cropFile(file,async blob=>{state.photoFile=blob;state.photoUrl=await blobToUrl(blob);const pv=$('#photo-prev');if(pv)pv.innerHTML='<span class="av av-lg"><img src="'+esc(state.photoUrl)+'" alt=""></span>';});
  }
  else if(id==='ni-photo'){
    const file=t.files&&t.files[0];t.value='';
    cropFile(file,setNiBlob);
  }
  else if(id==='photo-change'){
    const file=t.files&&t.files[0];t.value='';
    cropFile(file,blob=>run(async()=>{toast('Загружаем фото…');await uploadAvatar(blob);await afterChange();toast('Фото обновлено.');}));
  }
  else if(id==='ph-new'){
    const file=t.files&&t.files[0];t.value='';
    cropFile(file,blob=>run(async()=>{
      toast('Загружаем фото…');
      const url=await uploadImage(blob),me=state.me;
      try{await savePhotos(undefined,[...(me.photos||[]),url]);}catch(e){removeStored(url);throw e;}
      await afterChange();toast('Фото добавлено.');
    }));
  }

});

document.addEventListener('submit',e=>{
  e.preventDefault();
  if(!SB_OK)return;
  const id=e.target.id;
  if(id==='login')submitting(doLogin);
  else if(id==='signup')submitting(doSignup);
  else if(id==='f-ni')submitting(saveInterest);
  else if(id==='f-nm')submitting(createMeetup);
  else if(id==='f-nt')submitting(createTopic);
  else if(id==='f-pe')submitting(saveProfile);
  else if(id==='f-rep')submitting(sendReport);
  else if(id==='f-an')submitting(saveAnketa);
  else if(id==='f-flt')submitting(saveFilter);
  else if(id==='f-test')submitting(saveTest);
  else if(id==='reply')run(sendReply);
  else if(id==='chat-form')run(sendChat);
  else if(id==='dm-form')run(sendDM);
});

/* ---------- отправка форм ---------- */
async function afterAuth(msg,first){
  try{await reload();state.loadError='';}catch(e){state.loadError=errText(e);}
  const to=state.after||(first?'welcome':'home');state.after=null;state.notice='';
  toast(msg);
  go(to);
  refreshCounts();
}
async function doLogin(){
  const email=$('#li-email').value.trim(),pw=$('#li-pw').value;
  if(!email||!pw)return setErr('Введите почту и пароль.');
  const r=await sb.auth.signInWithPassword({email,password:pw,options:capOpt()});
  if(r.error){capReset();return setErr(capErr(r.error));}
  state.session=r.data.session;
  await afterAuth('С возвращением!');
}
async function doSignup(){
  const email=$('#su-email').value.trim(),pw=$('#su-pw').value,name=$('#su-name').value.trim();
  const age=parseInt($('#su-age').value,10),city=$('#su-city').value.trim(),about=$('#su-about').value.trim();
  const gr=document.querySelector('input[name=sg]:checked');
  if(!email||email.indexOf('@')<1)return setErr('Введите адрес почты.');
  if(pw.length<6)return setErr('Пароль должен быть не короче 6 символов.');
  if(!name)return setErr('Введите имя.');
  if(!(age>=18))return setErr('Сайт для тех, кому есть 18 лет.');
  if(age>99)return setErr('Проверьте возраст.');
  if(city.length<2)return setErr('Укажите город.');
  if(!gr)return setErr('Выберите пол.');
  if(!$('#su-consent').checked)return setErr('Поставьте галочку согласия, чтобы продолжить.');
  const r=await sb.auth.signUp({email,password:pw,options:Object.assign({data:{name,age,city,gender:gr.value,about,consent:'true'}},capOpt())});
  if(r.error){capReset();return setErr(capErr(r.error));}
  if(!r.data.session){
    state.notice='Мы отправили письмо на '+email+'. Перейдите по ссылке в нём, затем войдите.';
    state.authMode='login';render();return;
  }
  state.session=r.data.session;
  const file=state.photoFile;
  state.photoFile=null;state.photoUrl=null;
  if(file){
    try{await reload();await uploadAvatar(file);}
    catch(e){toast('Профиль создан, но фото загрузить не удалось. Попробуйте позже в профиле.');}
  }
  await afterAuth('Добро пожаловать, '+name.split(' ')[0]+'!',true);
}
async function saveProfile(){
  const name=$('#pe-name').value.trim(),age=parseInt($('#pe-age').value,10),city=$('#pe-city').value.trim(),about=$('#pe-about').value.trim();
  const gr=document.querySelector('input[name=pg]:checked');
  if(!name)return setErr('Введите имя.');
  if(!(age>=18&&age<=99))return setErr('Возраст от 18 до 99.');
  if(city.length<2)return setErr('Укажите город.');
  if(!gr)return setErr('Выберите пол.');
  const r=await sb.from('profiles').update({name,age,city,gender:gr.value,about}).eq('id',state.me.id);
  if(r.error)return setErr(errText(r.error));
  closeModal();toast('Профиль сохранён.');
  await afterChange();
}
async function saveInterest(){
  const f=$('#f-ni'),editId=f.dataset.id;
  const title=$('#ni-title').value.trim(),desc=$('#ni-desc').value.trim();
  if(title.length<2)return setErr('Название должно быть не короче 2 символов.');
  const fm=(document.querySelector('input[name=nfmt]:checked')||{value:'both'}).value;
  const row={
    title,description:desc||'Описание пока не добавлено.',
    hue:parseInt((document.querySelector('input[name=hue]:checked')||{value:190}).value,10),
    category:$('#ni-cat').value,format:fm,
    city:fm==='online'?null:($('#ni-city').value.trim()||null),
    tags:tagsFrom($('#ni-tags').value)
  };
  const np=state.niPhoto||{};
  let newUrl=null;
  if(V4){
    row.rules=$('#ni-rules')?$('#ni-rules').value.trim():'';
    if(np.file){newUrl=await uploadImage(np.file);row.photo_url=newUrl;}
    else if(np.remove&&np.orig)row.photo_url=null;
  }
  if(editId){
    const r=await sb.from('interests').update(row).eq('id',editId);
    if(r.error){if(newUrl)removeStored(newUrl);return setErr(errText(r.error));}
    if(np.orig&&(newUrl||np.remove))removeStored(np.orig);
    closeModal();toast('Интерес сохранён.');await afterChange();return;
  }
  row.owner_id=state.me.id;
  const r=await sb.from('interests').insert(row).select('id').single();
  if(r.error){if(newUrl)removeStored(newUrl);return setErr(errText(r.error));}
  closeModal();toast('Интерес создан. Вы в нём первый участник.');
  try{await reload();}catch(e){}
  state.pendingTab='chat';
  go('interest-'+r.data.id);
}
async function createMeetup(){
  const title=$('#mu-title').value.trim(),desc=$('#mu-desc').value.trim(),date=$('#mu-date').value,time=$('#mu-time').value||'18:00';
  const online=document.querySelector('input[name=mfmt]:checked').value==='online';
  const city=online?'':$('#mu-city').value.trim();
  const place=online?$('#mu-plat').value.trim():$('#mu-place').value.trim();
  const link=online?$('#mu-link').value.trim():'';
  const amin=parseInt($('#mu-amin').value,10),amax=parseInt($('#mu-amax').value,10),max=parseInt($('#mu-max').value,10);
  if(title.length<2)return setErr('Введите название встречи.');
  if(!online&&city.length<2)return setErr('Укажите город.');
  if(!place)return setErr(online?'Укажите платформу, например Zoom или Telegram.':'Укажите место.');
  if(link&&!/^https?:\/\/\S+$/i.test(link))return setErr('Ссылка должна начинаться с https://');
  if(!date)return setErr('Выберите дату.');
  if(!(amin>=18)||!(amax>=amin)||amax>99)return setErr('Проверьте возраст: от 18 лет, «до» не меньше «от».');
  if(!(max>=2&&max<=100))return setErr('Мест должно быть от 2 до 100.');
  const start=new Date(date+'T'+time);
  if(isNaN(start.getTime()))return setErr('Проверьте дату и время.');
  if(start.getTime()<Date.now())return setErr('Дата встречи должна быть в будущем.');
  const r=await sb.rpc('create_meetup',{p_interest:$('#mu-int').value,p_title:title,p_description:desc,p_format:online?'online':'offline',p_city:city||null,p_place:place,p_link:link||null,p_starts:start.toISOString(),p_age_min:amin,p_age_max:amax,p_gender:$('#mu-g').value,p_max:max});
  if(r.error)return setErr(errText(r.error));
  state.f={city:'',interest:'',gender:'',age:'',format:''};
  closeModal();toast('Встреча создана. Участники интереса получат уведомление.');
  if(state.view==='interest'){state.tab='meets';state.topic=null;}
  await afterChange();
}
async function createTopic(){
  const title=$('#nt-title').value.trim(),body=$('#nt-text').value.trim();
  if(title.length<2)return setErr('Введите тему.');
  const r=await sb.from('topics').insert({interest_id:state.arg,author_id:state.me.id,title,body}).select('id').single();
  if(r.error)return setErr(errText(r.error));
  closeModal();toast('Тема опубликована.');
  state.topic=r.data.id;
  await afterChange();
}
async function sendReply(){
  const i=interest(state.arg),t=i&&i.topics.find(x=>x.id===state.topic),txt=$('#c-text').value.trim();
  if(!t)return;
  if(needUser())return;
  if(!has(i.members)){toast('Вступите в интерес, чтобы писать в обсуждениях.');return;}
  if(!txt){toast('Напишите сообщение.');return;}
  const r=await sb.from('comments').insert({topic_id:t.id,author_id:state.me.id,body:txt});
  if(r.error)throw r.error;
  await afterChange();
}
async function sendReport(){
  const c=reportCtx;
  const r=await sb.from('reports').insert({reporter_id:state.me.id,target_type:c.type,target_id:c.id,target_user_id:c.uid||null,reason:$('#rp-reason').value,details:$('#rp-details').value.trim(),snapshot:c.snap||''});
  if(r.error)return setErr(errText(r.error));
  closeModal();toast('Спасибо, жалоба отправлена модератору.');
}

/* ---------- фоновое обновление ---------- */
let tick=0;
function live_tick(){
  if(!state.session||!state.loaded||!state.me||document.hidden)return;
  tick++;
  if(live.chatId)pollChat(false).catch(()=>{});
  if(live.threadId)pollThread(false).catch(()=>{});
  if(tick%5===0){
    refreshCounts();
    if(state.view==='notifications')loadNotes();
    if(state.view==='messages')loadConvos();
  }
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.session&&state.loaded){refreshCounts();if(live.chatId){markSeen(live.chatId);pollChat(false);}if(live.threadId)pollThread(false);}});

let rsz=null;
window.addEventListener('resize',()=>{clearTimeout(rsz);rsz=setTimeout(()=>growAll(),150);});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installEvt=e;if(state.view==='profile'&&state.me)render();});

/* ---------- запуск ---------- */
async function init(){
  window.addEventListener('hashchange',route);
  let CONFIRMED='';
  try{
    /* ссылка из письма: сайт#access_token=…&type=signup или #error=… */
    const hp=new URLSearchParams((location.hash||'').replace(/^#/,''));
    if(SB_OK&&hp.get('access_token')&&hp.get('refresh_token')){
      const r=await sb.auth.setSession({access_token:hp.get('access_token'),refresh_token:hp.get('refresh_token')});
      CONFIRMED=r.error?'fail':(hp.get('type')==='signup'?'signup':hp.get('type')==='email_change'?'email':'login');
      history.replaceState(null,'',location.pathname+location.search+'#home');
    }else if(hp.get('error')||hp.get('error_code')){
      CONFIRMED='bad';history.replaceState(null,'',location.pathname+location.search+'#profile');
    }
  }catch(e){CONFIRMED='fail';}
  if(SB_OK){
    try{const r=await sb.auth.getSession();state.session=r.data.session;}catch(e){}
    sb.auth.onAuthStateChange((ev,session)=>{
      state.session=session;
      if(ev==='SIGNED_OUT')setTimeout(()=>{clearData();render();},0);
    });
    setInterval(live_tick,4000);
  }
  if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
    navigator.serviceWorker.register('sw.js').then(()=>pushInit()).catch(()=>{});
    navigator.serviceWorker.addEventListener('message',e=>{const d=e.data;if(d&&d.type==='go')openLink(d.link);});
  }
  route();
  if(CONFIRMED==='signup'||CONFIRMED==='email')openModal('Почта подтверждена','<p>Готово! Адрес '+(CONFIRMED==='email'?'изменён':'подтверждён')+', вы вошли в свой аккаунт.</p><div class="row"><button class="btn primary" type="button" data-act="close">Продолжить</button></div>');
  else if(CONFIRMED==='bad'||CONFIRMED==='fail')openModal('Ссылка не сработала','<p>Ссылка из письма устарела или уже использована. Если вы уже подтверждали почту, просто войдите. Если нет, зарегистрируйтесь заново или запросите письмо ещё раз позже.</p><div class="row"><button class="btn primary" type="button" data-act="close">Понятно</button></div>');
  try{const g=new URLSearchParams(location.search).get('go');if(g){history.replaceState(null,'',location.pathname+location.hash);setTimeout(()=>openLink(g),0);}}catch(e){}
}
/* ---------- этап 3: фото в чатах, отзывы, напоминания, «собраться рядом» ---------- */
const IMG={urls:{},exp:{},ver:0};
const REV={ok:true,past:null,loading:false,cur:null,hostKey:''};
const HR={};
const REM={ok:true,loaded:false,map:{}};
const OLD_MS=30*864e5;
const uuid4=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);});
async function photoBlob(file){
  const url=URL.createObjectURL(file);
  try{
    const im=await loadImg(url);
    const w0=im.naturalWidth||im.width,h0=im.naturalHeight||im.height,k=Math.min(1,1280/Math.max(w0,h0));
    const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(w0*k));cv.height=Math.max(1,Math.round(h0*k));
    const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(im,0,0,cv.width,cv.height);
    let q=0.78,b=null;
    for(let n=0;n<4;n++){
      b=await new Promise(r=>cv.toBlob(r,'image/jpeg',q));
      if(b&&b.size<=900*1024)break;
      q-=0.12;
    }
    if(!b||b.size>1000*1024)throw new Error('Фото слишком большое. Выберите другое.');
    return b;
  }finally{URL.revokeObjectURL(url);}
}
function picHtml(m){
  if(!m.image_path)return '';
  if(Date.now()-new Date(m.created_at).getTime()>OLD_MS)return '<p class="meta pic-gone">Фото удалено: срок хранения 30 дней.</p>';
  const u=IMG.urls[m.image_path];
  if(!u)return '<p class="meta pic-gone">Фото недоступно.</p>';
  return '<button type="button" class="pic" data-act="pic" data-id="'+esc(m.image_path)+'" aria-label="Открыть фото"><img src="'+esc(u)+'" alt="Фото в сообщении" loading="lazy"></button>';
}
const hideBody=m=>!!(m.image_path&&m.body==='📷 Фото');
async function signPhotos(msgs){
  if(!HAS_IMG)return;
  const now=Date.now();
  const need=msgs.filter(m=>m.image_path&&now-new Date(m.created_at).getTime()<OLD_MS&&(!IMG.urls[m.image_path]||IMG.exp[m.image_path]<now)).map(m=>m.image_path);
  if(!need.length)return;
  try{
    const r=await sb.storage.from('chat-photos').createSignedUrls(need,3600);
    if(r.error)return;
    (r.data||[]).forEach(x=>{if(x.signedUrl&&x.path){IMG.urls[x.path]=x.signedUrl;IMG.exp[x.path]=now+50*60e3;}});
    IMG.ver++;
  }catch(e){}
}
const attachBtn=kind=>HAS_IMG?'<label class="btn attach" title="Отправить фото" aria-label="Отправить фото">📷<input type="file" id="'+kind+'-photo" accept="image/*" hidden></label>':'';
async function sendPhoto(kind,file){
  const dm=kind==='dm',inp=msgInput(kind);
  if(!file||!/^image\//.test(file.type||'')){toast('Выберите изображение.');return;}
  const cap=inp?inp.value.trim():'';
  if(cap.length>MSG_MAX){limCheck(kind);toast('Подпись слишком длинная.');return;}
  let row;
  if(dm){const o=state.arg;if(!UUID.test(o||'')){toast('Откройте диалог и повторите.');return;}row={sender_id:state.me.id,recipient_id:o};}
  else{const i=interest(state.arg);if(!i){toast('Откройте чат и повторите.');return;}row={interest_id:i.id,author_id:state.me.id};}
  const blob=await photoBlob(file);
  const path=(dm?'dm':'chat')+'/'+state.me.id+'/'+uuid4()+'.jpg';
  const up=await sb.storage.from('chat-photos').upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600'});
  if(up.error)throw up.error;
  row.body=cap||'📷 Фото';row.image_path=path;
  const c=COMPOSE[kind]||{};
  if(c.reply&&HAS_RE)row.reply_to=c.reply;
  const r=await sb.from(dm?'direct_messages':'chat_messages').insert(row);
  if(r.error){sb.storage.from('chat-photos').remove([path]).then(()=>{},()=>{});throw r.error;}
  COMPOSE[kind]={};updBar(kind);
  if(inp){inp.value='';grow(inp);limCheck(kind);}
  toast('Фото отправлено.');
  await (dm?pollThread(true):pollChat(true));
}
let PENDING_PHOTO=null;
async function runWait(fn){for(let i=0;i<100&&busy;i++)await new Promise(r=>setTimeout(r,100));if(busy){toast('Подождите секунду и повторите.');return;}return run(fn);}
function photoChosen(kind,file){
  let ok=false;try{ok=localStorage.getItem('kr-photo-ok')==='1';}catch(e){}
  if(ok)return runWait(()=>sendPhoto(kind,file));
  PENDING_PHOTO={kind,file};
  openModal('Отправить фото','<p>Фото сжимается и хранится на сервере <b>30 дней</b>, затем удаляется автоматически. Его видят только участники этого чата. Не отправляйте документы, банковские карты и другие личные данные.</p>'+
    '<label class="chk" style="margin-top:10px"><input type="checkbox" id="ph-never"> <span>Больше не показывать это предупреждение</span></label>'+
    '<div class="row" style="margin-top:14px"><button class="btn primary" type="button" data-act="photo-go">Отправить</button><button class="btn" type="button" data-act="photo-no">Отмена</button></div>');
}
/* отзывы */
async function loadPast(){
  if(!state.me||REV.loading||REV.past||!REV.ok)return;
  REV.loading=true;
  try{
    const me=state.me.id;
    const [a,b]=await Promise.all([
      sb.from('meetup_going').select('meetup_id,meetups(id,title,starts_at,host_id,interest_id)').eq('user_id',me),
      sb.from('meetup_reviews').select('meetup_id,rating,body').eq('reviewer_id',me)]);
    if(a.error||b.error){if(missingErr(a.error||b.error))REV.ok=false;REV.past=[];return;}
    const rv={};b.data.forEach(r=>{rv[r.meetup_id]=r;});
    const now=Date.now();
    REV.past=a.data.map(x=>x.meetups).filter(m=>m&&m.host_id!==me&&new Date(m.starts_at).getTime()<now&&now-new Date(m.starts_at).getTime()<90*864e5)
      .sort((x,y)=>new Date(y.starts_at)-new Date(x.starts_at)).map(m=>({id:m.id,title:m.title,when:new Date(m.starts_at),iid:m.interest_id,rating:(rv[m.id]||{}).rating||0,text:(rv[m.id]||{}).body||''}));
  }catch(e){REV.past=[];}
  finally{REV.loading=false;}
  if(state.view==='meetups'&&REV.past&&REV.past.length&&$('#ov').hidden)renderKeep();
}
const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);
function pastHtml(){
  if(!REV.ok||!REV.past||!REV.past.length)return '';
  return '<section class="section"><div class="rowhead"><h2>Вы были на встречах</h2></div><p class="hint">Оставьте отзыв: он поможет другим выбирать встречи и организаторов.</p><div class="mlist">'+
    REV.past.slice(0,6).map(m=>'<article class="mcard"><div class="mbody"><h3>'+esc(m.title)+'</h3><p class="meta">'+esc(m.when.toLocaleDateString('ru-RU',{day:'numeric',month:'long'}))+(m.rating?' · ваша оценка '+stars(m.rating):'')+'</p></div><div class="maside"><button class="btn sm'+(m.rating?'':' primary')+'" type="button" data-act="rev-open" data-id="'+esc(m.id)+'">'+(m.rating?'Изменить отзыв':'Оставить отзыв')+'</button></div></article>').join('')+'</div></section>';
}
function revForm(m){
  return '<div class="dtform"><p><b>'+esc(m.title)+'</b></p><div class="field"><span class="lbl">Ваша оценка</span><div class="stars" role="radiogroup" aria-label="Оценка">'+
    [1,2,3,4,5].map(n=>'<label><input type="radio" name="rv" value="'+n+'"'+(m.rating===n?' checked':'')+'><span aria-hidden="true">★</span><small class="sr">'+n+'</small></label>').join('')+'</div></div>'+
    '<div class="field"><label for="rv-body">Комментарий (по желанию)</label><textarea id="rv-body" rows="3" maxlength="500" placeholder="Как всё прошло?">'+esc(m.text)+'</textarea></div>'+
    '<p id="err" class="err" role="alert"></p><div class="row"><button class="btn primary" type="button" data-act="rev-send">Отправить</button><button class="btn" type="button" data-act="close">Отмена</button></div></div>';
}
async function loadHost(id){
  if(!state.session||id in HR)return;
  HR[id]=null;
  const a=await sb.rpc('host_rating',{p_user:id});
  if(a.error){if(missingErr(a.error))HR[id]=false;return;}
  const row=(a.data&&a.data[0])||{cnt:0};
  const out={avg:row.avg_rating,cnt:row.cnt||0,list:[]};
  if(out.cnt){
    const r=await sb.from('meetup_reviews').select('rating,body,created_at,reviewer_id,meetups!inner(title,host_id)').eq('meetups.host_id',id).order('created_at',{ascending:false}).limit(5);
    if(!r.error){out.list=r.data;await ensurePeople(r.data.map(x=>x.reviewer_id));}
  }
  HR[id]=out;
  if(out.cnt&&state.view==='user'&&state.arg===id&&$('#ov').hidden)renderKeep();
}
function hostRatingHtml(id){
  if(!(id in HR)){loadHost(id);return '';}
  const h=HR[id];
  if(!h||!h.cnt)return '';
  return '<section class="section"><h2 style="margin-bottom:10px">Отзывы о встречах</h2><p><b class="rate">'+stars(Math.round(h.avg))+'</b> '+h.avg+' из 5 · '+h.cnt+' '+plural(h.cnt,['отзыв','отзыва','отзывов'])+'</p>'+
    h.list.map(x=>'<div class="rvrow"><p class="meta">'+esc(who(x.reviewer_id).name.split(' ')[0])+' · «'+esc(x.meetups.title)+'» · '+stars(x.rating)+'</p>'+(x.body?'<p>'+esc(x.body)+'</p>':'')+'</div>').join('')+'</section>';
}
/* напоминания */
async function loadRem(){
  if(REM.loaded||!state.me||!REM.ok)return;
  REM.loaded=true;
  const r=await sb.from('meetup_going').select('meetup_id,remind').eq('user_id',state.me.id);
  if(r.error){if(missingErr(r.error))REM.ok=false;else REM.loaded=false;return;}
  r.data.forEach(x=>{REM.map[x.meetup_id]=x.remind!==false;});
  if(Object.keys(REM.map).length&&['home','meetups','interest'].includes(state.view)&&$('#ov').hidden)renderKeep();
}
const remBtn=m=>(REM.ok&&REM.loaded&&has(m.going)&&m.id in REM.map)?'<button class="lnk" type="button" data-act="remind-toggle" data-id="'+esc(m.id)+'" aria-pressed="'+REM.map[m.id]+'">'+(REM.map[m.id]?'Напоминание: вкл':'Напоминание: выкл')+'</button>':'';
/* собраться рядом */
function gatherCard(){
  if(!state.me||!state.loaded)return '';
  const now=Date.now();
  const soon=M.filter(m=>m.format==='offline'&&m.city===state.me.city&&m.when.getTime()>now&&m.when.getTime()<now+48*3600e3&&m.going.length<m.max).sort((a,b)=>a.when-b.when).slice(0,3);
  return '<section class="section dtbox"><h2>Собраться рядом</h2><p>Свободны сегодня? Назначьте встречу за минуту: участники интереса из вашего города получат уведомление.</p>'+
    (soon.length?'<p class="hint">Уже собираются в ближайшие 2 дня в городе «'+esc(state.me.city)+'»:</p><div class="mlist">'+soon.map(cardMeetup).join('')+'</div>':'<p class="hint">В ближайшие 2 дня в вашем городе встреч пока нет, можно стать первым.</p>')+
    '<div class="row"><button class="btn primary" type="button" data-act="gather-today">Собраться сегодня</button></div></section>';
}
Object.assign(ACT,{
  'pic':id=>{const u=IMG.urls[id];if(u)openModal('Фото','<img class="bigpic" src="'+esc(u)+'" alt="Фото из чата">');},
  'photo-go':()=>{const p=PENDING_PHOTO;PENDING_PHOTO=null;const nv=$('#ph-never');if(nv&&nv.checked){try{localStorage.setItem('kr-photo-ok','1');}catch(e){}}closeModal();if(p)runWait(()=>sendPhoto(p.kind,p.file));},
  'photo-no':()=>{PENDING_PHOTO=null;closeModal();},
  'rev-open':id=>{const m=(REV.past||[]).find(x=>x.id===id);if(!m)return;REV.cur=id;openModal('Отзыв о встрече',revForm(m));},
  'rev-send':()=>run(async()=>{
    const c=document.querySelector('input[name=rv]:checked');
    if(!c){setErr('Поставьте оценку от 1 до 5.');return;}
    const r=await sb.rpc('leave_review',{p_meetup:REV.cur,p_rating:parseInt(c.value,10),p_body:($('#rv-body').value||'').trim()});
    if(r.error){setErr(errText(r.error));return;}
    closeModal();toast('Спасибо за отзыв!');REV.past=null;REV.loading=false;await loadPast();renderKeep();
  }),
  'remind-toggle':id=>run(async()=>{
    const v=!REM.map[id];
    const r=await sb.from('meetup_going').update({remind:v}).eq('meetup_id',id).eq('user_id',state.me.id);
    if(r.error)throw r.error;
    REM.map[id]=v;toast(v?'Напоминание включено.':'Напоминание выключено.');renderKeep();
  }),
  'gather-today':()=>{
    openMeetupForm();
    const d=$('#mu-date'),t=$('#mu-time');if(!d||!t)return;
    const n=new Date();n.setHours(n.getHours()+2,0,0,0);
    if(n.getDate()!==new Date().getDate()){d.value=ymd(new Date(Date.now()+864e5));t.value='12:00';}
    else{d.value=ymd(n);t.value=String(n.getHours()).padStart(2,'0')+':00';}
    const ti=$('#mu-title');if(ti){ti.value='Встреча сегодня';ti.focus();ti.select();}
  }
});

init();
})();
