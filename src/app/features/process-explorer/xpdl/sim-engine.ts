// @ts-nocheck
/*
 * The simulator and parameter-impact engine of the "XPDL Workflow Explorer", lifted unchanged from the original and
 * wrapped in a factory so it works on any loaded process (the original used page globals).
 *
 * Differences from the original, all removals of things that were specific to one customer process:
 *  - the dictionaries of hand-written hints and the fixed list of "order inputs" (HS, HR, SETUP);
 *  - the response suggestions for six named variables (picks): the generic rule is kept.
 * Everything else is the original text. Verified against the original by xpdl/sim-engine.spec.ts.
 */
import { hv, hline, hcond, hn, graphOf, outcomeOf, inputVars } from './engine';

export function makeSim(D) {
const HR = {}, SETC = {};
const KEYWORDS=['then','else','end'];
function lex(s){const re=/\s*(\[[^\]]+\]|"[^"]*"|\d+(?:\.\d+)?|:=|!=|>=|<=|[=<>&|()+,;]|[A-Za-z_]\w*)/y;const T=[];let pos=0,m;for(;;){re.lastIndex=pos;m=re.exec(s);if(!m)break;T.push(m[1]);pos=re.lastIndex}if(s.slice(pos).trim())throw new Error('unreadable text near: '+s.slice(pos,pos+20).trim());return T}
function parse(src,mode){const T=lex(src);let i=0;const pk=()=>T[i],nx=()=>T[i++],kw=(x,w)=>x&&x.toLowerCase()===w;
function prim(){const t=nx();if(t===undefined)throw new Error('unexpected end');if(t==='('){const e=or();if(nx()!==')')throw new Error('missing )');return e}
if(t[0]==='[')return{t:'v',n:t.slice(1,-1)};if(t[0]==='"')return{t:'c',s:t.slice(1,-1)};if(/^\d/.test(t))return{t:'c',s:t};
if(kw(t,'getitem')){nx();const a=or();nx();const b=or();nx();return{t:'get',a,b}}if(/^[A-Za-z_]\w*$/.test(t)&&pk()==='('){nx();const args=[];if(pk()!==')'){args.push(or());while(pk()===','){nx();args.push(or())}}nx();return{t:'fn',n:t,args}}throw new Error('unexpected '+t)}
function add(){let l=prim();while(pk()==='+'){nx();l={t:'add',l,r:prim()}}return l}
function cmp(){const l=add();const o=pk();if(['=','!=','>','<','>=','<='].includes(o)){nx();return{t:'cmp',o,l,r:add()}}return l}
function and(){let l=cmp();while(pk()==='&'){nx();l={t:'and',l,r:cmp()}}return l}
function or(){let l=and();while(pk()==='|'){nx();l={t:'or',l,r:and()}}return l}
function stmts(stop){const L=[];while(i<T.length&&!stop.includes((pk()||'').toLowerCase())){if(pk()===';'){nx();continue}L.push(stmt())}return L}
function stmt(){const t=pk();if(kw(t,'if')){nx();const c=or();if(!kw(nx(),'then'))throw new Error('expected then');const a=stmts(['else','end']);let b=[];if(kw(pk(),'else')){nx();b=stmts(['end'])}if(!kw(nx(),'end'))throw new Error('expected end');return{t:'if',c,a,b}}
if(t&&t[0]==='['){nx();if(nx()!==':=')throw new Error('expected :=');return{t:'set',n:t.slice(1,-1),e:or()}}throw new Error('cannot read statement at '+t)}
if(mode==='expr'){const e=or();if(i<T.length)throw new Error('extra text '+T[i]);return e}return stmts([])}
const dflt=n=>/trials|trails/i.test(n)?0:'null';
const numv=x=>(x!==''&&x!=null&&!isNaN(+x))?+x:NaN;
function ev(n,V){switch(n.t){case'c':return n.s;case'v':return n.n in V?V[n.n]:dflt(n.n);case'fn':return'<'+n.n+'>';
case'add':{const a=ev(n.l,V),b=ev(n.r,V);return(!isNaN(numv(a))&&!isNaN(numv(b)))?numv(a)+numv(b):String(a)+String(b)}
case'get':{const l=String(ev(n.a,V)).split(/[,;|]/);const x=l[numv(ev(n.b,V))-1];return x===undefined?'null':x.trim()}
case'cmp':{const a=ev(n.l,V),b=ev(n.r,V);if(n.o==='=')return String(a)===String(b);if(n.o==='!=')return String(a)!==String(b);const x=numv(a),y=numv(b);if(isNaN(x)||isNaN(y))return false;return n.o==='>'?x>y:n.o==='<'?x<y:n.o==='>='?x>=y:x<=y}
case'and':return ev(n.l,V)&&ev(n.r,V);case'or':return ev(n.l,V)||ev(n.r,V)}}
function exec(L,V){for(const s of L){if(s.t==='set')V[s.n]=ev(s.e,V);else if(ev(s.c,V))exec(s.a,V);else exec(s.b,V)}}
const cache={};const cp=(k,s,m)=>cache[k+m]||(cache[k+m]=parse(s,m));
const AM={};D.acts.forEach(a=>AM[a.id]=a);
function newSim(V0){return{V:{...V0},cur:startAct().id,path:[],edges:[],log:[],n:0,done:false,wait:null,chg:new Set()}}
function lg(S,m,c){if(S.nolog)return;S.log.push({m,c})}
function pickT(S,id){const outs=D.trs.filter(t=>t.f===id),hit=[],def=[];for(const t of outs){if(!t.cond){def.push(t);continue}try{if(ev(cp(t.id,t.cond,'expr'),S.V))hit.push(t)}catch(e){lg(S,'⚠ Could not evaluate condition on "'+(t.name||t.id)+'": '+e.message,'w')}}
if(hit.length>1)lg(S,'Several conditions were true; the first one is taken ('+hit.map(t=>AM[t.t].name).join(' / ')+')','w');return hit[0]||def[0]||null}
function moveOn(S){const t=pickT(S,S.cur);if(!t){lg(S,'⚠ No outgoing transition matched. The simulation stopped here.','w');S.done=true;return}S.edges.push(t.id);const why=t.cond?'condition true':'default path';if(D.trs.filter(x=>x.f===S.cur).length>1)lg(S,'  → '+AM[t.t].name+(t.name?' ['+t.name+']':'')+' ('+why+')','d');S.cur=t.t;S.path.push(t.t)}
function simStep(S){if(S.done||S.wait)return;const a=AM[S.cur];if(!S.path.length)S.path.push(S.cur);S.n++;S.chg=new Set();const before={...S.V};lg(S,a.name,'a');
if(a.k==='end'){S.done=true;lg(S,'✔ Process reached the End event.','ok');return}
if(a.k==='script'){try{exec(cp(a.id,a.src,'stmt'),S.V)}catch(e){lg(S,'⚠ Script not executed ('+e.message+'). Edit variables manually if needed.','w')}}
else if(a.k==='ws'||a.k==='user'){S.wait=a;return}
else if(a.k==='app')lg(S,'  stored procedure "'+(a.det['Stored procedure / app']||'')+'" executed','d');
for(const k in S.V)if(String(S.V[k])!==String(before[k]))S.chg.add(k),lg(S,'  '+k+' = '+S.V[k],'d');moveOn(S)}
function simSubmit(S,vals,timeout){const a=S.wait;if(!a)return;S.chg=new Set();for(const k in vals){if(String(S.V[k])!==String(vals[k]))S.chg.add(k);S.V[k]=vals[k];lg(S,'  '+k+' = '+vals[k],'d')}S.wait=null;
if(timeout){const t=D.acts.find(x=>x.k==='timer'&&x.tgt===a.id);if(t){lg(S,'⏱ Timeout: '+t.name,'w');S.cur=t.id;S.path.push(t.id);return}}moveOn(S)}
function simRun(S,max){let n=0;while(!S.done&&!S.wait&&n++<(max||300))simStep(S);if(n>=(max||300)&&!S.done&&!S.wait){lg(S,'⚠ Stopped after '+n+' steps (possible endless loop).','w');S.done=true}}
function startAct(){return D.acts.find(a=>a.k==='start')||D.acts.find(a=>a.k!=='timer'&&!D.trs.some(t=>t.t===a.id))||D.acts[0]}
const AN=(()=>{const asg=new Set(),outv=new Set(),ins=new Set(),iov=new Set(),cv={};
D.acts.forEach(a=>{(a.src||'').replace(/\[([^\]]+)\]\s*:=/g,(m,v)=>{asg.add(v);return m});a.outs.forEach(v=>outv.add(v));a.ins.forEach(v=>ins.add(v));a.io.forEach(v=>iov.add(v))});
D.trs.forEach(t=>{const f=AM[t.f].name,to=AM[t.t].name,seen=new Set();(t.cond||'').replace(/\[([^\]]+)\]/g,(m,v)=>{if(!cv[v])cv[v]={uses:[],lits:[]};if(!seen.has(v)){seen.add(v);cv[v].uses.push(f+' → '+to)}return m});
(t.cond||'').replace(/\[([^\]]+)\]\s*(?:!=|>=|<=|=|>|<)\s*(?:"([^"]*)"|(\d+(?:\.\d+)?))/g,(m,v,s,n)=>{const l=s!==undefined?s:n;if(l!==''&&!cv[v].lits.includes(l))cv[v].lits.push(l);return m})});
return{cv,inputs:[...new Set([...Object.keys(cv),...ins])].filter(v=>!asg.has(v)&&!outv.has(v)&&!iov.has(v))}})();
function picks(v){const c=AN.cv[v];const lt=c?c.lits.filter(x=>isNaN(+x)).slice(0,3):[];return lt.length?[...lt,'down','null'].slice(0,4):['Success','down','null']}
const rxq=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const impAll=()=>{const s=new Set();D.trs.forEach(t=>(t.cond.match(/\[[^\]]+\]/g)||[]).forEach(x=>s.add(x.slice(1,-1))));D.acts.forEach(a=>{(a.src.match(/\[[^\]]+\]/g)||[]).forEach(x=>s.add(x.slice(1,-1)));a.ins.forEach(x=>s.add(x))});return[...s].sort((a,b)=>a.localeCompare(b))};
function litsFor(v){const L=[],re=new RegExp('\\['+rxq(v)+'\\]\\s*!?=\\s*"([^"]*)"','g');const add=t=>{let m;re.lastIndex=0;while(m=re.exec(t||''))if(m[1]!==''&&!L.includes(m[1]))L.push(m[1])};D.trs.forEach(t=>add(t.cond));D.acts.forEach(a=>add(a.src));return L}
function impTaint(v){const T=new Set([v]),why={},parsed=[];D.acts.forEach(a=>{if(a.src&&/(:=|\[)/.test(a.src)){try{parsed.push([a,cp(a.id,a.src,'stmt')])}catch(e){}}});
const deps=n=>{const s=new Set(),w=x=>{if(!x||typeof x!=='object')return;if(x.t==='v')s.add(x.n);['l','r','a','b'].forEach(k=>w(x[k]));if(x.args)x.args.forEach(w)};w(n);return s};
let ch=true,g=0;const walk=(L,ctx,a)=>L.forEach(st=>{if(st.t==='set'){const d=deps(st.e),via=[...d,...ctx].filter(x=>T.has(x));if(via.length&&!T.has(st.n)){T.add(st.n);why[st.n]={act:a.name,via};ch=true}}else{const c2=new Set([...ctx,...deps(st.c)]);walk(st.a,c2,a);walk(st.b,c2,a)}});
while(ch&&g++<25){ch=false;parsed.forEach(([a,st])=>walk(st,new Set(),a))}
const conds=[];D.trs.forEach(t=>{if(!t.cond)return;let d;try{d=deps(cp(t.id,t.cond,'expr'))}catch(e){return}const direct=d.has(v),via=[...d].filter(x=>T.has(x)&&x!==v);if(direct||via.length)conds.push({f:AM[t.f].name,to:AM[t.t].name,cond:t.cond,direct,via})});
const readers=parsed.filter(([a])=>[...T].some(x=>a.src.includes('['+x+']'))).map(([a])=>({name:a.name,direct:a.src.includes('['+v+']'),sets:Object.entries(why).filter(([k,w])=>w.act===a.name).map(([k])=>k),lines:a.src.split(/\r?\n/).map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean).map(hline).filter(Boolean)}));
const passed=[];D.acts.forEach(a=>{(a.params||'').split(', ').forEach(e=>{const i=e.lastIndexOf('=');if(i<0)return;if(e.slice(i+1).trim()===v){const l=e.slice(0,i).trim().split(/\s+/);passed.push({act:a.name,kind:a.k,formal:l[l.length-1],mode:l.length>1?l[0]:''})}})});
return{T,why,conds,readers,passed,vals:litsFor(v)}}
function impExplore(v,val,devMax,tl,T){const t0=performance.now(),g=graphOf(D),IN=inputVars(D),RFc={},LCc={};
const rf=id=>RFc[id]||(RFc[id]=(()=>{const s=new Set(),f=x=>(x||'').replace(/\[([^\]]+)\]/g,(m,y)=>{s.add(y);return m});f(AM[id].src);D.trs.filter(t=>t.f===id).forEach(t=>f(t.cond));return[...s]})());
const candIn=u=>LCc[u]||(LCc[u]=(()=>{if(SETC[u]&&SETC[u][2])return[...SETC[u][2]];const o=litsFor(u);o.push('__other__');return o.slice(0,7)})());
const prod=ls=>ls.reduce((a,l)=>a.flatMap(x=>l.map(y=>[...x,y])),[[]]);
const cl=S=>({V:{...S.V},cur:S.cur,path:S.path.slice(),edges:S.edges.slice(),log:[],n:S.n,done:S.done,wait:S.wait,chg:new Set(),nolog:true,dev:S.dev,assume:S.assume.slice(),vis:{...S.vis}});
const found=new Map();let steps=0,raw=0,partial=false;
const rec=S=>{raw++;const p=S.path.slice(),e=[];let k=0;for(let i=0;i<p.length-1;i++){const t=D.trs.find(x=>x.id===S.edges[k]&&x.f===p[i]&&x.t===p[i+1]);if(t){e.push({to:p[i+1],t});k++}else e.push({to:p[i+1],timeout:true})}
const names=p.filter(id=>['ws','app','user','timer'].includes(AM[id].k)).map(id=>AM[id].name),out=outcomeOf(g,p),sig=out+'|'+names.join('>');let f=found.get(sig);
if(!f){const d={};T.forEach(x=>{if(x!==v&&x in S.V)d[x]=S.V[x]});f={sig,out,names,p,e,assume:S.assume.slice(),dev:S.dev,derived:d,n:1,alts:[]};found.set(sig,f)}else{f.n++;const a=S.assume.join(' ; ');if(f.alts.length<3&&a!==f.assume.join(' ; ')&&!f.alts.some(x=>x.join(' ; ')===a))f.alts.push(S.assume.slice())}};
const root=newSim({[v]:val});root.nolog=true;root.dev=0;root.assume=[];root.vis={};const stack=[root];
while(stack.length){if(performance.now()-t0>tl||raw>4000||steps>250000){partial=true;break}
const S=stack.pop();
for(;;){if(S.done){if(!S.abort)rec(S);break}
if(S.wait){const a=S.wait;
if(a.k==='ws'){const outs=a.outs.slice(0,2);if(!outs.length){simSubmit(S,{},false);continue}
const lists=outs.map(o=>picks(o).slice(0,4)),opts=[];prod(lists).forEach(cb=>{const d=cb.reduce((n,x,j)=>n+(x===lists[j][0]?0:1),0);if(S.dev+d<=devMax)opts.push({cb,d})});
for(let i=opts.length-1;i>=0;i--){const C=cl(S),{cb,d}=opts[i],vals={};outs.forEach((o,j)=>{vals[o]=cb[j];if(d)C.assume.push('“'+a.name+'”: '+hv(o)+' = '+cb[j])});C.dev+=d;simSubmit(C,vals,false);stack.push(C)}break}
const tm=D.acts.find(x=>x.k==='timer'&&x.tgt===a.id),iv=a.io.find(x=>HR[x]),base=iv?picks(iv):[null],opts=base.map(b=>({vals:b!==null?{[iv]:b}:{},to:false,d:0,txt:b!==null?hv(iv)+' = '+b:''}));
if(tm&&S.dev+1<=devMax)opts.push({vals:{},to:true,d:1,txt:'timeout on “'+a.name+'”'});
for(let i=opts.length-1;i>=0;i--){const C=cl(S),o=opts[i];C.dev+=o.d;if(o.txt)C.assume.push(o.txt);simSubmit(C,o.vals,o.to);stack.push(C)}break}
const need=rf(S.cur).filter(u=>u!==v&&IN(u)&&!(u in S.V)).slice(0,3);
if(need.length){const combos=prod(need.map(candIn));for(let i=combos.length-1;i>=0;i--){const C=cl(S);need.forEach((u,j)=>{C.V[u]=combos[i][j];C.assume.push(hv(u)+' = '+(combos[i][j]==='__other__'?'any other value':combos[i][j]))});stack.push(C)}break}
S.vis[S.cur]=(S.vis[S.cur]||0)+1;if(S.vis[S.cur]>5||S.n>700)break;
steps++;simStep(S)}}
return{found:[...found.values()],partial,raw}}
return { newSim, simStep, simSubmit, simRun, startAct, AN, AM, picks, litsFor, impAll, impTaint, impExplore, ev, cp };
}
