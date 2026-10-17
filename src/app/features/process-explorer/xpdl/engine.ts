// @ts-nocheck
/*
 * The analysis engine of the "XPDL Workflow Explorer", lifted unchanged from the original single-page tool: parser,
 * validation checks, expression syntax, version diff (technical and business), route analysis.
 *
 * It is deliberately kept as the original text so that its results stay identical to the tool people already know.
 * That is verified by a differential test (see docs/XPDL_EXPLORER_MIGRATION_PLAN.md). The typed API used by the rest
 * of the application is in ./index.ts; do not import from this file elsewhere.
 *
 * Only the pure logic is here. Everything that built HTML or touched the page was rewritten as Angular components.
 */


// ---- parser, layout, expression syntax, validation checks (original lines 38-267) ----
const STD_TOP=['PackageHeader','RedefinableHeader','ConformanceClass','Script','ExternalPackages','ExternalPackage','TypeDeclarations','Participants','Applications','DataFields','Pools','WorkflowProcesses','ExtendedAttributes','Namespaces','Associations','Artifacts'];
const NSV={'http://www.wfmc.org/2008/XPDL2.1':'XPDL 2.1','http://www.wfmc.org/2009/XPDL2.2':'XPDL 2.2','http://www.wfmc.org/2012/XPDL2.2':'XPDL 2.2','http://www.wfmc.org/2002/XPDL1.0':'XPDL 1.0'};
function xpdlToData(text,fname,pi){
pi=pi||0;
const doc=new DOMParser().parseFromString(text,'application/xml');
const pe=doc.getElementsByTagName('parsererror')[0];
if(pe)throw new Error('The file is not well-formed XML. '+(pe.textContent||'').trim().split('\n')[0].slice(0,160));
const root=doc.documentElement;
const all=(e,n)=>[...e.getElementsByTagNameNS('*',n)],first=(e,n)=>e.getElementsByTagNameNS('*',n)[0]||null,kids=(e,n)=>e?[...e.children].filter(c=>c.localName===n):[],kid=(e,n)=>kids(e,n)[0]||null;
const procEls=all(root,'WorkflowProcess');
if(!procEls.length)throw new Error('No WorkflowProcess element found. This does not look like an XPDL file.');
const wp=procEls[Math.min(pi,procEls.length-1)];
const M={file:fname,size:text.length,ns:root.namespaceURI||'',pkg:root.getAttribute('Name')||root.getAttribute('Id')||'',proc:wp.getAttribute('Name')||wp.getAttribute('Id')||'',procs:procEls.map(p=>p.getAttribute('Name')||p.getAttribute('Id')||'(unnamed)'),pi,checks:[]};
const chk=(s,l,d,items,fix,cat)=>M.checks.push({s,l,d,items:items||[],fix:fix||'',cat:cat||''});
chk('ok','Well-formed XML','The file parsed without errors.');
const ver=NSV[M.ns];M.ver=ver||'non-standard XPDL';
chk(ver?'ok':'warn','XPDL namespace',ver?'The namespace identifies '+ver+'.':(M.ns?'Unknown namespace '+M.ns+'.':'No namespace declared. Standard XPDL 2.x uses xmlns="http://www.wfmc.org/2008/XPDL2.1", so a strict XSD validation would fail.'));
const bad=[...new Set([...root.children].map(c=>c.localName).filter(n=>!STD_TOP.includes(n)))];
chk(root.localName==='Package'&&!bad.length?'ok':'warn','Package structure',root.localName!=='Package'?'The root element is '+root.localName+', not Package.':bad.length?'Non-standard or misspelled elements directly under Package: '+bad.join(', ')+'.':'Only standard top-level elements are used.');
const df={},apps={};
all(root,'DataField').forEach(d=>df[d.getAttribute('Id')]=d.getAttribute('Name')||d.getAttribute('Id'));
all(root,'Application').forEach(a=>apps[a.getAttribute('Id')]=a.getAttribute('Name')||a.getAttribute('Id'));
const actEls=kids(kid(wp,'Activities'),'Activity'),trEls=kids(kid(wp,'Transitions'),'Transition');
const nameOf={};actEls.forEach(a=>nameOf[a.getAttribute('Id')]=a.getAttribute('Name')||a.getAttribute('Id'));
const acts=actEls.map(a=>{const id=a.getAttribute('Id'),name=a.getAttribute('Name')||id,det={};let k='task',tgt=null,ins=[],outs=[],io=[],src='';const has=n=>first(a,n);
if(has('StartEvent'))k='start';else if(has('EndEvent'))k='end';
else if(has('IntermediateEvent')){k='timer';const ie=has('IntermediateEvent');tgt=ie.getAttribute('Target');det['Attached to']=nameOf[tgt]||'';if(ie.getAttribute('Trigger'))det.Trigger=ie.getAttribute('Trigger')}
else if(has('Route')){k='gw';const r=has('Route');det.Gateway=[r.getAttribute('GatewayDirection'),r.getAttribute('GatewayType')].filter(Boolean).join(' / ')||'Route'}
else if(has('TaskService')){k='ws';const o=has('WebServiceOperation');if(o)det['Web service operation']=o.getAttribute('OperationName')||''}
else if(has('TaskApplication')){k='app';const t=has('TaskApplication');det['Stored procedure / app']=apps[t.getAttribute('Id')]||t.getAttribute('Id')||''}
else if(has('Tool')){k='app';det['Stored procedure / app']=has('Tool').getAttribute('Id')||''}
else if(has('TaskUser')||has('UserTask'))k='user';
else if(has('TaskScript'))k='script';
else if(has('SubFlow'))det['Sub-process']=has('SubFlow').getAttribute('Id')||'';
const sc=has('Script');if(sc&&sc.textContent.trim()){src=sc.textContent;if(k==='script')det.Script=src.trim().slice(0,700)}
const fp=has('FormalParameters'),ap=has('ActualParameters');
if(fp&&ap&&(k==='ws'||k==='app')){const f=[...fp.children],q=[...ap.children];f.forEach((p,i)=>{const v=q[i]&&df[(q[i].textContent||'').trim()];if(v)((p.getAttribute('Mode')||'').toUpperCase()==='OUT'?outs:ins).push(v)})}
if(k==='user'&&fp)io=[...fp.children].filter(p=>p.getAttribute('Mode')==='INOUT'&&!/_Action|retry_close/.test(p.getAttribute('Name')||'')).map(p=>p.getAttribute('Name')).slice(0,6);
if(k==='user'){const pf=has('Performer');if(pf&&pf.textContent.trim())det.Performer=pf.textContent.trim()}
const er=has('ExternalReference'),loc=er?(er.getAttribute('location')||er.getAttribute('xref')||''):'';
const rs=all(a,'TransitionRestriction').map(r=>{const j=first(r,'Join'),s=first(r,'Split');return(j?'Join '+(j.getAttribute('Type')||''):'')+(s?(j?', ':'')+'Split '+(s.getAttribute('Type')||''):'')}).join('; ');
const dE=has('Deadline'),dc=dE&&first(dE,'DeadlineCondition'),de=dE&&first(dE,'ExceptionName'),dl=dE?[dc&&dc.textContent.trim(),dE.getAttribute('Execution'),de&&de.textContent.trim()].filter(Boolean).join(' / '):'';
const params=(fp&&ap)?[...fp.children].map((p,i)=>(p.getAttribute('Mode')||'')+' '+(p.getAttribute('Name')||p.getAttribute('Id')||'')+'='+(df[((ap.children[i]&&ap.children[i].textContent)||'').trim()]||((ap.children[i]&&ap.children[i].textContent)||'').trim())).join(', '):'';
return{id,name,k,det,tgt,ins,outs,io,src,loc,rs,dl,params,x:null,y:null,w:null,h:null}});
const trsAll=trEls.map(t=>{const c=kid(t,'Condition'),d=kid(t,'Description');const ct=(c&&c.getAttribute('Type'))||'';let cond=c?(c.textContent||'').trim():'';if(/OTHERWISE|DEFAULT/i.test(ct))cond='';return{ct,id:t.getAttribute('Id'),f:t.getAttribute('From'),t:t.getAttribute('To'),name:t.getAttribute('Name')||'',cond,desc:d?(d.textContent||'').trim():''}});
// checks
const ids=acts.map(a=>a.id),aset=new Set(ids);
const dupA=ids.filter((x,i)=>ids.indexOf(x)!==i);
chk(dupA.length?'fail':'ok','Unique activity IDs',dupA.length?'Duplicates: '+[...new Set(dupA)].slice(0,6).join(', '):acts.length+' activities, all IDs unique.');
const tids=trsAll.map(t=>t.id),dupT=tids.filter((x,i)=>tids.indexOf(x)!==i);
chk(dupT.length?'fail':'ok','Unique transition IDs',dupT.length?'Duplicates: '+[...new Set(dupT)].slice(0,6).join(', '):trsAll.length+' transitions, all IDs unique.');
const badT=trsAll.filter(t=>!aset.has(t.f)||!aset.has(t.t));
chk(badT.length?'fail':'ok','Transitions point to existing activities',badT.length?badT.length+' transition(s) reference a missing activity: '+badT.slice(0,5).map(t=>t.id).join(', '):'All From/To references resolve.');
const trs=trsAll.filter(t=>aset.has(t.f)&&aset.has(t.t));
const tset=new Set(tids);let nref=0,badRef=0,dupRef=0;
actEls.forEach(a=>{const seen=new Set();all(a,'TransitionRef').forEach(r=>{nref++;const id=r.getAttribute('Id');if(!tset.has(id))badRef++;if(seen.has(id))dupRef++;seen.add(id)})});
if(nref)chk(badRef?'fail':dupRef?'warn':'ok','TransitionRef entries',badRef?badRef+' reference(s) point to undefined transitions.':dupRef?'All resolve, but '+dupRef+' are repeated inside the same activity (redundant markup).':'All '+nref+' references resolve.');
const badApp=all(wp,'TaskApplication').filter(t=>!(t.getAttribute('Id') in apps));
chk(badApp.length?'fail':'ok','Application references',badApp.length?badApp.length+' TaskApplication(s) use an undefined Application Id.':'All application references resolve.');
const starts=acts.filter(a=>a.k==='start'),ends=acts.filter(a=>a.k==='end');
chk(starts.length===1?'ok':'warn','Start event',starts.length===1?'One start event: '+starts[0].name+'.':starts.length?starts.length+' start events.':'No explicit start event. Start points are inferred from activities with no incoming transition.');
chk(ends.length?'ok':'warn','End event',ends.length?ends.length+' end event(s): '+ends.map(a=>a.name).join(', ')+'.':'No explicit end event.');
const out={},inn={};trs.forEach(t=>{(out[t.f]=out[t.f]||[]).push(t.t);(inn[t.t]=inn[t.t]||[]).push(t.f)});
const timersOf={};acts.filter(a=>a.k==='timer'&&a.tgt).forEach(a=>(timersOf[a.tgt]=timersOf[a.tgt]||[]).push(a.id));
const startIds=(starts.length?starts:acts.filter(a=>a.k!=='timer'&&!inn[a.id])).map(a=>a.id);
const seen=new Set(),st=[...startIds];while(st.length){const n=st.pop();if(seen.has(n))continue;seen.add(n);(out[n]||[]).forEach(x=>st.push(x));(timersOf[n]||[]).forEach(x=>st.push(x))}
const unreach=acts.filter(a=>!seen.has(a.id)),dead=acts.filter(a=>a.k!=='end'&&!(out[a.id]||[]).length);
chk(unreach.length?'warn':'ok','Reachability',unreach.length?unreach.length+' activit'+(unreach.length>1?'ies':'y')+' cannot be reached from the start: '+unreach.slice(0,6).map(a=>a.name).join(', ')+'.':'Every activity is reachable from the start (timeout events count as reachable through the task they are attached to).');
chk(dead.length?'warn':'ok','Dead ends',dead.length?dead.length+' non-end activit'+(dead.length>1?'ies have':'y has')+' no outgoing transition: '+dead.slice(0,6).map(a=>a.name).join(', ')+'.':'No activity is a dead end.');
const risky=acts.filter(a=>{const o=trs.filter(t=>t.f===a.id);return a.k==='gw'&&o.length>1&&o.every(t=>t.cond)});
if(risky.length)chk('warn','Gateways without a default path',risky.length+' gateway(s) have only conditional paths. If no condition is true the process would stop: '+risky.slice(0,5).map(a=>a.name).join(', ')+'.');
const cred=[...new Set(all(root,'ExtendedAttribute').filter(e=>/password|passwd|pwd|secret|token|jdbc:/i.test((e.getAttribute('Name')||'')+' '+(e.getAttribute('Value')||e.textContent||''))).map(e=>e.getAttribute('Name')||'(unnamed)'))];
chk(cred.length?'fail':'ok','Credentials in the file',cred.length?'Possible plaintext credentials in extended attribute(s): '+cred.join(', ')+'. The values are not shown here. Remove them and rotate the password if the file has been shared.':'No password-like extended attributes found.');
const hosts=new Set();(text.match(/https?:\/\/[A-Za-z0-9.\-]+(?::\d+)?/g)||[]).forEach(u=>{if(/\./.test(u.replace(/^https?:\/\//,''))&&!/w3\.org|wfmc\.org|xmlsoap|schemas\.|purl\.org|xmlns/.test(u))hosts.add(u.replace(/^https?:\/\//,''))});
chk(hosts.size>1?'warn':'ok','Service endpoints',hosts.size?hosts.size+' distinct host(s): '+[...hosts].slice(0,6).join(', ')+(hosts.size>1?'. Different hosts in one file often mean mixed environments (test and production).':'.'):'No http(s) endpoints found.');
// layout
const cells={};all(root,'mxCell').forEach(c=>cells[c.getAttribute('id')]=c);
const cellOf={};Object.values(cells).forEach(c=>{if(c.getAttribute('vertex')==='1'&&aset.has(c.getAttribute('value')))cellOf[c.getAttribute('value')]=c});
const geo=c=>{const g=kid(c,'mxGeometry');let x=+g.getAttribute('x')||0,y=+g.getAttribute('y')||0;const w=+g.getAttribute('width')||20,h=+g.getAttribute('height')||20;const pc=cells[c.getAttribute('parent')];if(g.getAttribute('relative')==='1'&&pc&&kid(pc,'mxGeometry')){const pg=kid(pc,'mxGeometry');x=(+pg.getAttribute('x')||0)+x*(+pg.getAttribute('width'));y=(+pg.getAttribute('y')||0)+y*(+pg.getAttribute('height'))}return[x,y,w,h]};
acts.forEach((a,i)=>{const c=cellOf[a.id];if(c&&kid(c,'mxGeometry')){[a.x,a.y,a.w,a.h]=geo(c);return}const ng=first(actEls[i],'NodeGraphicsInfo'),co=ng&&first(ng,'Coordinates');if(co&&co.getAttribute('XCoordinate')!=null){a.x=+co.getAttribute('XCoordinate');a.y=+co.getAttribute('YCoordinate');a.w=+ng.getAttribute('Width')||0;a.h=+ng.getAttribute('Height')||0}});
const SZ={start:[26,26],end:[26,26],timer:[20,20],gw:[40,40]};
acts.forEach(a=>{const s=SZ[a.k]||[110,50];if(!a.w)a.w=s[0];if(!a.h)a.h=s[1]});
if(acts.some(a=>a.x==null||isNaN(a.x))){M.layout='automatic';autoLayout(acts,trs,startIds)}else M.layout='from file';
deepChecks({root,actEls,acts,trsAll,trs,df,nameOf,chk,all,first,cells,cellOf,aset});
// counts
const K={};acts.forEach(a=>K[a.k]=(K[a.k]||0)+1);
M.kinds=K;M.nAct=acts.length;M.nTr=trs.length;M.starts=starts.map(a=>a.name);M.ends=ends.map(a=>a.name);
M.ws=[...new Set(acts.filter(a=>a.k==='ws').map(a=>a.det['Web service operation']||a.name))];
M.apps=[...new Set(acts.filter(a=>a.k==='app').map(a=>a.det['Stored procedure / app']||a.name))];
M.users=acts.filter(a=>a.k==='user').map(a=>a.name);
M.timers=acts.filter(a=>a.k==='timer').map(a=>a.name+(a.det['Attached to']?' (on '+a.det['Attached to']+')':''));
const vc={};trs.forEach(t=>(t.cond.match(/\[[^\]]+\]/g)||[]).forEach(v=>vc[v.slice(1,-1)]=(vc[v.slice(1,-1)]||0)+1));
M.vars=Object.entries(vc).sort((a,b)=>b[1]-a[1]).slice(0,10);
M.participants=all(root,'Participant').length;M.datafields=all(root,'DataField').length;M.applications=Object.keys(apps).length;M.lanes=all(root,'Lane').length;
const hdr=(el,pre)=>{const o={};if(el)[...el.children].forEach(c=>{if(!c.children.length&&(c.textContent||'').trim())o[pre+c.localName]=c.textContent.trim()});return o};
const header={...hdr(kid(root,'PackageHeader'),'package.'),...hdr(kid(root,'RedefinableHeader'),'package.'),...hdr(kid(wp,'ProcessHeader'),'process.'),...hdr(kid(wp,'RedefinableHeader'),'process.'),'package.name':root.getAttribute('Name')||'','process.name':M.proc};
if(wp.getAttribute('AccessLevel'))header['process.accessLevel']=wp.getAttribute('AccessLevel');
const hsh=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return(h>>>0).toString(36)};
const dts=d=>{const t=first(d,'DataType');if(!t)return'';const b=first(t,'BasicType'),dc=first(t,'DeclaredType');return b?b.getAttribute('Type'):dc?dc.getAttribute('Id'):(t.children[0]?t.children[0].localName:'')};
const dfs=all(root,'DataField').map(d=>{const iv=first(d,'InitialValue');return{scope:d.parentNode.parentNode.localName==='Package'?'package':'process',name:d.getAttribute('Name')||d.getAttribute('Id'),type:dts(d),init:iv?(iv.textContent||'').trim():''}});
const apl=all(root,'Application').map(a=>{const er=first(a,'ExternalReference');return{name:a.getAttribute('Name')||a.getAttribute('Id'),sig:[...all(a,'FormalParameter')].map(p=>(p.getAttribute('Mode')||'')+' '+(p.getAttribute('Id')||p.getAttribute('Name')||'')).join(', ')+(er?' | '+(er.getAttribute('location')||er.getAttribute('xref')||''):'')}});
const pts=all(root,'Participant').map(p=>{const t=first(p,'ParticipantType');return{name:p.getAttribute('Name')||p.getAttribute('Id'),type:t?t.getAttribute('Type'):''}});
const ext=all(root,'ExtendedAttribute').slice(0,3000).map(e=>{const o=e.parentNode.parentNode,sc=o.localName+':'+(o.localName==='Activity'?(nameOf[o.getAttribute('Id')]||o.getAttribute('Id')):(o.getAttribute('Name')||o.getAttribute('Id')||'')),n=e.getAttribute('Name')||'',v=e.getAttribute('Value')||(e.textContent||'').trim(),sens=/password|passwd|pwd|secret|token|jdbc:/i.test(n+' '+v);return{scope:sc,name:n,h:hsh(v),v:sens?null:v.slice(0,160),long:v.length>160,sens}});
const nrm=m=>{m=(m||'IN').toUpperCase();return m==='OUT'?'OUT':m==='INOUT'?'INOUT':'IN'};
const dty=p=>{const b=first(p,'BasicType'),d=first(p,'DeclaredType');return b?b.getAttribute('Type')||'':d?d.getAttribute('Id')||'':''};
const pOf=p=>({name:p.getAttribute('Name')||p.getAttribute('Id')||'',mode:nrm(p.getAttribute('Mode')),type:dty(p),req:p.getAttribute('Required')==='true'});
const appList=all(root,'Application').map(a=>{const ty=kid(a,'Type'),ws=ty&&kid(ty,'WebService'),ejb=ty&&kid(ty,'Ejb'),er0=first(a,'ExternalReference');let kind='other',tech={};
if(ws){kind='ws';const op=first(ws,'WebServiceOperation'),sv=first(ws,'Service'),er=first(ws,'ExternalReference');tech={operation:op?op.getAttribute('OperationName')||'':'',service:sv?sv.getAttribute('ServiceName')||'':'',endpoint:er?er.getAttribute('Location')||'':''}}
else if(ejb){kind='db';const t=x=>{const e=first(ejb,x);return e?(e.textContent||'').trim():''};tech={procedure:t('HomeClass'),connection:t('JndiName'),method:t('Method')}}
else if(er0&&/^https?:/i.test(er0.getAttribute('location')||er0.getAttribute('Location')||'')){kind='ws';tech={endpoint:er0.getAttribute('location')||er0.getAttribute('Location')||''}}
else if(ty&&ty.children[0])tech={type:ty.children[0].localName};
const fp=first(a,'FormalParameters');return{id:a.getAttribute('Id'),name:a.getAttribute('Name')||a.getAttribute('Id'),kind,tech,params:fp?[...fp.children].map(pOf):[],usedBy:[]}});
const byId={},byOp={},pseudo={};appList.forEach(a=>{byId[a.id]=a;if(a.kind==='ws'&&a.tech.operation)(byOp[a.tech.operation]=byOp[a.tech.operation]||[]).push(a)});
actEls.forEach((el,i)=>{let app=null;const ta=first(el,'TaskApplication'),op=first(el,'WebServiceOperation'),fp=first(el,'FormalParameters'),ap=first(el,'ActualParameters');
if(ta)app=byId[ta.getAttribute('Id')];else if(first(el,'TaskService')&&op){const o=op.getAttribute('OperationName')||'';app=(byOp[o]||[])[0];if(!app){app=pseudo[o];if(!app){const er=first(el,'ExternalReference'),sv=first(el,'Service');app=pseudo[o]={id:'ws:'+o,name:o,kind:'ws',tech:{operation:o,service:sv?sv.getAttribute('ServiceName')||'':'',endpoint:er?er.getAttribute('Location')||'':''},params:fp?[...fp.children].map(pOf):[],usedBy:[]};appList.push(app)}}}
if(!app)return;const map=fp?[...fp.children].map((p,j)=>{const t=ap&&ap.children[j]?(ap.children[j].textContent||'').trim():'';return{name:p.getAttribute('Name')||p.getAttribute('Id')||'',mode:nrm(p.getAttribute('Mode')),to:t?(df[t]||t):''}}):[];app.usedBy.push({act:acts[i].name,map})});
M.integ=appList;

return{D:{acts,trs},M,X:{header,dfs,apl,pts,ext}}}
function autoLayout(acts,trs,startIds){const out={};trs.forEach(t=>(out[t.f]=out[t.f]||[]).push(t.t));const dep={},q=[...(startIds.length?startIds:[acts[0].id])];q.forEach(i=>dep[i]=0);for(let i=0;i<q.length;i++){(out[q[i]]||[]).forEach(n=>{if(dep[n]===undefined){dep[n]=dep[q[i]]+1;q.push(n)}})}
const md=Math.max(0,...Object.values(dep));const by={};acts.filter(a=>a.k!=='timer').forEach(a=>{const d=dep[a.id]===undefined?md+1:dep[a.id];(by[d]=by[d]||[]).push(a)});
Object.entries(by).forEach(([d,l])=>l.forEach((a,i)=>{a.x=20+d*170;a.y=20+i*90+(50-a.h)/2}));
acts.filter(a=>a.k==='timer').forEach((a,i)=>{const t=acts.find(x=>x.id===a.tgt);if(t){a.x=t.x+t.w*0.65;a.y=t.y+t.h-10}else{a.x=20;a.y=20+i*40}})}
function xlex(s){const re=/\s*(\[[^\]]+\]|"[^"]*"|\d+(?:\.\d+)?|:=|!=|>=|<=|[=<>&|()+,;]|[A-Za-z_]\w*)/y;const T=[];let pos=0,m;for(;;){re.lastIndex=pos;m=re.exec(s);if(!m)break;T.push(m[1]);pos=re.lastIndex}if(s.slice(pos).trim())throw new Error('unreadable text near: '+s.slice(pos,pos+20).trim());return T}
function xparse(src,mode){const T=xlex(src);let i=0;const pk=()=>T[i],nx=()=>T[i++],kw=(x,w)=>x&&x.toLowerCase()===w;
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

const KNOWN_EL=['Package','PackageHeader','RedefinableHeader','ConformanceClass','ExternalPackages','ExternalPackage','TypeDeclarations','TypeDeclaration','Participants','Participant','ParticipantType','Applications','Application','DataFields','DataField','DataType','BasicType','DeclaredType','InitialValue','Length','Pools','Pool','Lanes','Lane','WorkflowProcesses','WorkflowProcess','ProcessHeader','Activities','Activity','Transitions','Transition','Condition','Description','ExtendedAttributes','ExtendedAttribute','FormalParameters','FormalParameter','ActualParameters','ActualParameter','Implementation','TaskService','TaskApplication','TaskScript','TaskUser','TaskManual','TaskSend','TaskReceive','SubFlow','Route','StartEvent','EndEvent','IntermediateEvent','TransitionRestrictions','TransitionRestriction','TransitionRefs','TransitionRef','Performers','Performer','Deadline','DeadlineCondition','ExceptionName','StartMode','FinishMode','Priority','Documentation','ExternalReference','WebServiceOperation','WebService','MessageIn','MessageOut','DataFieldRef','NodeGraphicsInfos','NodeGraphicsInfo','ConnectorGraphicsInfos','Coordinates','Namespaces','Associations','Artifacts','Assignments','Assignment','Expression','ArrayType','ListType','RecordType','UnionType','EnumerationType','EnumerationValue','SchemaType','ActivitySet','ActivitySets','BlockActivity','TimeEstimation','SimulationInformation','XPDLVersion','Countrykey','PriorityUnit','CostUnit','WaitingTime','WorkingTime','Responsible','Responsibles','Created','Vendor','Author','Version','ValidFrom','ValidTo'];
const ENUMS=[['WorkflowProcess','AccessLevel',['PUBLIC','PRIVATE'],'AccessLevel'],['FormalParameter','Mode',['IN','OUT','INOUT'],'Parameter Mode'],['Condition','Type',['CONDITION','OTHERWISE','EXCEPTION','DEFAULTEXCEPTION'],'Condition Type'],['Route','GatewayType',['Exclusive','Inclusive','Parallel','Complex','EventBasedExclusive','EventBasedParallel'],'GatewayType'],['ParticipantType','Type',['RESOURCE_SET','RESOURCE','ROLE','ORGANIZATIONAL_UNIT','HUMAN','SYSTEM'],'ParticipantType']];
function lev(a,b){const m=[];for(let i=0;i<=a.length;i++){m[i]=[i];for(let j=1;j<=b.length;j++)m[i][j]=i?0:j}for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return m[a.length][b.length]}
function sccs(nodes,adj){let idx=0;const st=[],on=new Set(),ix={},low={},res=[];const dfs=v=>{ix[v]=low[v]=idx++;st.push(v);on.add(v);(adj[v]||[]).forEach(w=>{if(ix[w]===undefined){dfs(w);low[v]=Math.min(low[v],low[w])}else if(on.has(w))low[v]=Math.min(low[v],ix[w])});if(low[v]===ix[v]){const c=[];let w;do{w=st.pop();on.delete(w);c.push(w)}while(w!==v);res.push(c)}};nodes.forEach(v=>{if(ix[v]===undefined)dfs(v)});return res}
function deepChecks(c){const{root,actEls,acts,trsAll,trs,df,nameOf,chk,all,first,cells,cellOf,aset}=c;
const lab=el=>{for(let p=el;p&&p.nodeType===1;p=p.parentNode){const t=p.localName,n=p.getAttribute('Name')||p.getAttribute('Id')||'';if(t==='Activity')return'Activity “'+(nameOf[p.getAttribute('Id')]||n)+'” ('+p.getAttribute('Id')+')';if(t==='Transition')return'Transition '+n;if(t==='Application'||t==='DataField'||t==='Participant'||t==='WorkflowProcess'||t==='Package')return t+' “'+n+'”'+(p.getAttribute('Name')&&p.getAttribute('Id')?' ('+p.getAttribute('Id')+')':'')}return'File'};
const an=i=>'Activity “'+acts[i].name+'”',sens=/password|passwd|pwd|secret|token|jdbc:/i;
const add=(bad,warnIf,label,okText,badText,items,fix,cat)=>chk(bad.length?warnIf:'ok',label,bad.length?badText:okText,items||bad,bad.length?fix:'',cat);
// duplicates among siblings
const dx=[],di=[],dr=[];
for(const e of all(root,'*')){if(e.children.length<2)continue;const g={};[...e.children].forEach(x=>{const t=x.localName;if(t==='Activity'||t==='Transition'||t==='TransitionRef'||/^mx/.test(t)||t==='lane'||t==='FormalParameter')return;const id=t==='ExtendedAttribute'?(x.getAttribute('Name')||'').trim().toLowerCase():(x.getAttribute('Id')||x.getAttribute('Name'));if(!id)return;(g[t+'\u0001'+id]=g[t+'\u0001'+id]||[]).push(x)});
for(const k in g){const l=g[k];if(l.length<2)continue;const[t,id]=k.split('\u0001'),w=lab(e)+' › '+e.localName;
if(t==='ExtendedAttribute'){const vals=l.map(x=>x.getAttribute('Value')||(x.textContent||'').trim()),dv=[...new Set(vals)],hid=sens.test(id+' '+vals.join(' '));dx.push({conf:dv.length>1,t:w+': attribute “'+(l[0].getAttribute('Name')||'')+'” is configured '+l.length+' times'+([...new Set(l.map(x=>x.getAttribute('Name')))].length>1?' (spelled differently: '+[...new Set(l.map(x=>x.getAttribute('Name')))].join(' / ')+')':'')+(dv.length>1?' with '+dv.length+' different values'+(hid?' (values hidden)':' ('+dv.slice(0,4).map(v=>'“'+v.slice(0,40)+'”').join(', ')+')'):' (same value repeated)')})}
else if(['MessageIn','MessageOut','TransitionRestriction','Performer','Split','Join','ExternalReference','WebServiceOperation'].includes(t))dr.push(w+': <'+t+'> “'+id+'” is repeated '+l.length+' times');
else di.push(w+': <'+t+'> Id “'+id+'” is used '+l.length+' times'+(t==='FormalParameter'?' (modes: '+l.map(x=>x.getAttribute('Mode')||'?').join(', ')+')':''))}}
const dp=[];all(root,'FormalParameters').forEach(fp=>{const ps=[...fp.children],w=lab(fp)+' › FormalParameters',nm={},ids={},byN={};ps.forEach(p=>{const n=(p.getAttribute('Name')||p.getAttribute('Id')||'').trim(),m=(p.getAttribute('Mode')||'IN').toUpperCase(),id=p.getAttribute('Id');(nm[n+'\u0001'+m]=nm[n+'\u0001'+m]||[]).push(p);if(id)(ids[id+'\u0001'+m]=ids[id+'\u0001'+m]||[]).push(p);(byN[n]=byN[n]||new Set()).add(m)});
Object.entries(nm).forEach(([k,l])=>{if(l.length>1){const[n,m]=k.split('\u0001');dp.push(w+': parameter “'+n+'” ('+m+') is defined '+l.length+' times (Ids: '+l.slice(0,4).map(x=>x.getAttribute('Id')).join(', ')+(l.length>4?'…':'')+')')}});
Object.entries(ids).forEach(([k,l])=>{if(l.length>1){const[i,m]=k.split('\u0001');dp.push(w+': Id “'+i+'” ('+m+') is used by '+l.length+' parameters')}});
Object.entries(byN).forEach(([n,s])=>{if(s.has('INOUT')&&s.size>1)dp.push(w+': parameter “'+n+'” is declared both INOUT and '+[...s].filter(x=>x!=='INOUT').join('/'))})});
chk(dx.some(x=>x.conf)?'fail':dx.length?'warn':'ok','Duplicate attribute names on the same element',dx.length?dx.length+' attribute name(s) are configured more than once on the same element'+(dx.some(x=>x.conf)?', some with conflicting values, so the engine may use any one of them.':'.'):'No element repeats an extended attribute name.',dx.map(x=>x.t),dx.length?'Keep one ExtendedAttribute per Name on each element. If the values differ, decide which is correct and delete the others.':'','Duplicates');
add(di,'fail','Duplicate IDs among sibling elements','Every Id is unique within its list.',di.length+' element(s) share an Id with a sibling in the same list.',di,'Give each element in the same list a unique Id.','Duplicates');
add(dp,'fail','Duplicate parameters (same name and mode)','No activity or application defines the same parameter twice.',dp.length+' duplicate parameter definition(s) in '+Object.keys(dp.reduce((o,x)=>(o[x.split(' › ')[0]]=1,o),{})).length+' place(s): '+Object.entries(dp.reduce((o,x)=>{const k=x.split(' › ')[0];o[k]=(o[k]||0)+1;return o},{})).map(([k,n])=>k+' ['+n+']').join('; ')+'. The same name or Id with different modes (IN and OUT) is allowed and is not reported.',dp,'Delete the repeated parameter definitions, keeping one per name and mode.','Duplicates');
add(dr,'warn','Redundant repeated elements','No repeated copies found.',dr.length+' element group(s) are repeated with the same identifier.',dr,'Remove the repeated copies. They add nothing and bloat the file.','Duplicates');
const dn={};all(root,'DataField').forEach(d=>{const n=d.getAttribute('Name');if(n){const k=d.parentNode.parentNode.localName+'|'+n;(dn[k]=dn[k]||[]).push(d)}});
const dnd=Object.entries(dn).filter(([k,l])=>l.length>1).map(([k,l])=>'Data field name “'+k.split('|')[1]+'” appears '+l.length+' times in the same scope (Ids: '+l.map(x=>x.getAttribute('Id')).join(', ')+')');
add(dnd,'fail','Duplicate data field names','Data field names are unique within their scope.',dnd.length+' data field name(s) are defined more than once.',dnd,'Rename or delete the duplicate data fields so each name means one thing.','Duplicates');
const gn={};acts.forEach(a=>{if(a.name&&a.k!=='gw')(gn[a.name]=gn[a.name]||[]).push(a.id)});const dan=Object.entries(gn).filter(([k,l])=>l.length>1).map(([k,l])=>'Name “'+k+'” is used by '+l.length+' activities ('+l.slice(0,4).join(', ')+')');
add(dan,'warn','Duplicate activity names','Activity names are unique.',dan.length+' activity name(s) are used more than once, which makes diagrams and reports ambiguous.',dan,'Give each activity a distinct name.','Naming');
const en=actEls.map((e,i)=>[e,i]).filter(([e,i])=>!(e.getAttribute('Name')||'').trim()||e.getAttribute('Name')!==e.getAttribute('Name').trim()).map(([e,i])=>'Activity '+e.getAttribute('Id')+': name is empty or has leading/trailing spaces');
add(en,'warn','Empty or untidy activity names','All activities have clean names.',en.length+' activity name(s) are empty or padded with spaces.',en,'Give the activity a readable name without extra spaces.','Naming');
// references and parameters
const pm=[];actEls.forEach((a,i)=>{const fp=first(a,'FormalParameters'),ap=first(a,'ActualParameters');if(fp&&ap&&fp.children.length!==ap.children.length)pm.push(an(i)+': '+fp.children.length+' formal vs '+ap.children.length+' actual parameters')});
add(pm,'fail','Parameter count mismatch','Formal and actual parameter counts match.',pm.length+' activit'+(pm.length>1?'ies pass':'y passes')+' a different number of values than it declares.',pm,'Make the ActualParameters list match the FormalParameters list one to one.','References');
const dfIds=new Set(Object.keys(df)),dfN=new Set(Object.values(df)),ur=[];
actEls.forEach((a,i)=>{const ap=first(a,'ActualParameters');if(ap)[...ap.children].forEach(p=>{const t=(p.textContent||'').trim();if(t&&/^[\w.\-]+$/.test(t)&&!dfIds.has(t)&&!dfN.has(t))ur.push(an(i)+': parameter value “'+t+'” is not a defined data field')})});
add(ur,'warn','Parameters pointing to unknown data fields','Every parameter value maps to a defined data field.',ur.length+' parameter value(s) do not match any data field.',ur,'Define the missing data field or correct the reference.','References');
const vu={},addv=(v,w)=>{(vu[v]=vu[v]||new Set()).add(w)};
trs.forEach(t=>(t.cond.match(/\[[^\]]+\]/g)||[]).forEach(v=>addv(v.slice(1,-1),'condition '+(nameOf[t.f]||t.f)+' → '+(nameOf[t.t]||t.t))));acts.forEach(a=>(a.src.match(/\[[^\]]+\]/g)||[]).forEach(v=>addv(v.slice(1,-1),'script “'+a.name+'”')));
const undef=Object.keys(vu).filter(v=>!dfN.has(v)&&!dfIds.has(v)).map(v=>'['+v+'] is used in '+[...vu[v]].slice(0,2).join(' and ')+' but is not a defined data field');
add(undef,'warn','Variables used but not defined','All variables used in conditions and scripts are defined.',undef.length+' variable(s) are used but not defined as data fields.',undef,'Add a DataField with that name, or fix the spelling in the condition or script.','Data');
const used=new Set(Object.keys(vu));actEls.forEach(a=>{const ap=first(a,'ActualParameters');if(ap)[...ap.children].forEach(p=>{const t=(p.textContent||'').trim();if(df[t])used.add(df[t]);used.add(t)});all(a,'FormalParameter').forEach(p=>used.add(p.getAttribute('Name')||''));all(a,'DataFieldRef').forEach(p=>{const i=p.getAttribute('Id')||p.getAttribute('Name')||'';used.add(i);if(df[i])used.add(df[i])})});
const unu=all(root,'DataField').map(d=>d.getAttribute('Name')||d.getAttribute('Id')).filter(n=>!used.has(n));
add(unu,'info','Unused data fields','Every data field is used.',unu.length+' data field(s) are never read or written by a condition, script or parameter.',unu.map(n=>'Data field “'+n+'”'),'Delete unused data fields to keep the model clear.','Data');
const ref=new Set();actEls.forEach(a=>[a,...all(a,'*')].forEach(e=>[...e.attributes].forEach(t=>ref.add(t.value))));
const uap=all(root,'Application').filter(a=>!ref.has(a.getAttribute('Id'))).map(a=>'Application “'+(a.getAttribute('Name')||a.getAttribute('Id'))+'”');
add(uap,'info','Unused applications','Every application is used by an activity.',uap.length+' application(s) are defined but never used by an activity.',uap,'Remove applications that no activity calls.','Integration');
const pids=new Set(all(root,'Participant').map(p=>p.getAttribute('Id'))),bp=[];actEls.forEach((a,i)=>all(a,'Performer').forEach(p=>{const t=(p.textContent||'').trim();if(t&&!pids.has(t))bp.push(an(i)+': performer “'+t+'” is not a defined participant')}));
add(bp,'fail','Performers that do not exist','All performers refer to defined participants.',bp.length+' performer(s) are not defined.',bp,'Define the participant or change the performer.','References');
const np=actEls.map((e,i)=>[e,i]).filter(([e,i])=>acts[i].k==='user'&&!(first(e,'Performer')&&first(e,'Performer').textContent.trim())).map(([e,i])=>an(i)+': no performer assigned');
add(np,'info','User tasks without a performer','All user tasks have a performer.',np.length+' user task(s) have no performer. They depend on automatic assignment.',np,'Assign a participant if people should be selected explicitly.','References');
const td=all(root,'TypeDeclaration').map(t=>t.getAttribute('Id')),bd=all(root,'DeclaredType').filter(d=>!td.includes(d.getAttribute('Id'))).map(d=>lab(d)+': declared type “'+d.getAttribute('Id')+'” is not defined');
add(bd,'fail','Undefined declared types','All declared types exist.',bd.length+' declared type reference(s) have no TypeDeclaration.',bd,'Add the TypeDeclaration or correct the type name.','References');
// enumerations and spelling
ENUMS.forEach(([tag,attr,ok,label])=>{const bad={};all(root,tag).forEach(e=>{const v=e.getAttribute(attr);if(v!=null&&v!==''&&!ok.includes(v))bad[v]=(bad[v]||0)+1});const l=Object.entries(bad).map(([v,n])=>'<'+tag+' '+attr+'="'+v+'"> ×'+n+(ok.find(x=>x.toLowerCase()===v.toLowerCase())?' (casing: expected '+ok.find(x=>x.toLowerCase()===v.toLowerCase())+')':' (expected one of '+ok.join(', ')+')'));add(l,'warn','Non-standard '+label+' values','All '+label+' values are standard.',l.length+' non-standard value(s).',l,'Use the standard value so other XPDL tools read it correctly.','File')});
const bt={};all(root,'BasicType').forEach(e=>{const v=e.getAttribute('Type');if(v&&!['STRING','FLOAT','INTEGER','REFERENCE','DATETIME','BOOLEAN','PERFORMER'].includes(v))bt[v]=(bt[v]||0)+1});const btl=Object.entries(bt).map(([v,n])=>'Type “'+v+'” ×'+n);
add(btl,'info','Non-standard data types','Only standard XPDL data types are used.',btl.length+' non-standard data type name(s) are used. They are fine for the vendor tool but not portable.',btl,'Map them to STRING, INTEGER, FLOAT, DATETIME or BOOLEAN if you need portability.','File');
const nm=[...new Set(all(root,'*').map(e=>e.localName))],typo=[];nm.forEach(n=>{if(n.length<6||KNOWN_EL.includes(n)||/^mx/.test(n))return;const b=KNOWN_EL.filter(k=>Math.abs(k.length-n.length)<=2).map(k=>[k,lev(n,k)]).sort((a,b)=>a[1]-b[1])[0];if(b&&b[1]<=2)typo.push('<'+n+'> looks like a misspelling of <'+b[0]+'>')});
add(typo,'warn','Misspelled element names','No misspelled standard element names found.',typo.length+' element name(s) look misspelled.',typo,'Correct the element name so other XPDL tools recognize it.','File');
// flow
const adj={};trs.forEach(t=>(adj[t.f]=adj[t.f]||[]).push(t.t));acts.filter(a=>a.k==='timer'&&aset.has(a.tgt)).forEach(a=>(adj[a.tgt]=adj[a.tgt]||[]).push(a.id));
const endIds=new Set(acts.filter(a=>a.k==='end').map(a=>a.id)),nn=Object.fromEntries(acts.map(a=>[a.id,a.name])),traps=[];
sccs(acts.map(a=>a.id),adj).forEach(cc=>{const s=new Set(cc),loop=cc.length>1||(adj[cc[0]]||[]).includes(cc[0]);if(loop&&!cc.some(n=>endIds.has(n))&&!cc.some(n=>(adj[n]||[]).some(w=>!s.has(w))))traps.push('Endless loop with no exit: '+cc.slice(0,8).map(n=>nn[n]).join(' → ')+(cc.length>8?'…':''))});
add(traps,'fail','Endless loops','Every loop has a way out.',traps.length+' loop(s) can never finish.',traps,'Add an exit path or a retry limit to the loop.','Flow');
const mdef=[];acts.forEach(a=>{if(a.k!=='gw')return;const o=trs.filter(t=>t.f===a.id),u=o.filter(t=>!t.cond);if(o.length>1&&u.length>1&&/Exclusive/i.test((a.det.Gateway||'')+(a.rs||'')))mdef.push('Gateway “'+a.name+'”: '+u.length+' paths have no condition ('+u.map(t=>nn[t.t]).slice(0,4).join(', ')+')')});
add(mdef,'warn','Several default paths on one decision','Each decision has at most one default path.',mdef.length+' exclusive decision(s) have more than one unconditional path, so the choice is ambiguous.',mdef,'Give all but one of the paths a condition.','Flow');
const fk=acts.filter(a=>a.k!=='gw'&&a.k!=='timer'&&!a.rs&&trs.filter(t=>t.f===a.id).length>1).map(a=>'Activity “'+a.name+'”: '+trs.filter(t=>t.f===a.id).length+' outgoing transitions but no split definition');
add(fk,'warn','Implicit forks','Branching happens only at gateways or defined splits.',fk.length+' activit'+(fk.length>1?'ies branch':'y branches')+' without a split or gateway.',fk,'Route the branches through a gateway or define a Split.','Flow');
const tmap={};trsAll.forEach(t=>tmap[t.id]=t);const sp=[];actEls.forEach((a,i)=>{const id=a.getAttribute('Id'),refs=[];all(a,'TransitionRestriction').forEach(r=>{const s=first(r,'Split');if(s)all(s,'TransitionRef').forEach(x=>refs.push(x.getAttribute('Id')))});if(!refs.length)return;refs.forEach(r=>{if(tmap[r]&&tmap[r].f!==id)sp.push(an(i)+': Split lists transition '+r+' which starts at “'+(nameOf[tmap[r].f]||tmap[r].f)+'”')});const miss=trsAll.filter(t=>t.f===id&&!refs.includes(t.id)).map(t=>t.id);if(miss.length)sp.push(an(i)+': '+miss.length+' outgoing transition(s) are missing from its Split ('+miss.slice(0,3).join(', ')+')')});
add(sp,'fail','Split definitions that do not match the transitions','Split definitions match the outgoing transitions.',sp.length+' split definition(s) disagree with the actual transitions.',sp,'Make the Split TransitionRefs list exactly the transitions that leave the activity.','References');
const cs=[];trs.forEach(t=>{if(!/\[/.test(t.cond))return;try{xparse(t.cond,'expr')}catch(e){cs.push((nameOf[t.f]||t.f)+' → '+(nameOf[t.t]||t.t)+': '+e.message+' in “'+t.cond.slice(0,90)+'”')}});
add(cs,'fail','Condition syntax errors','All conditions read correctly.',cs.length+' condition(s) cannot be read (brackets, quotes or operators).',cs,'Fix the condition text.','Flow');
const ec=trs.filter(t=>/^condition$/i.test(t.ct||'')&&!t.cond).map(t=>'Transition '+t.id+' ('+(nameOf[t.f]||t.f)+' → '+(nameOf[t.t]||t.t)+'): type CONDITION but the condition is empty');
add(ec,'warn','Empty conditions','No conditional transition is empty.',ec.length+' transition(s) are marked as conditional but have no condition.',ec,'Add the condition or mark the path as OTHERWISE.','Flow');
const ss=[];acts.forEach(a=>{if(a.k==='script'&&!a.src.trim())ss.push('Script “'+a.name+'”: the script is empty');else if(a.src&&/(:=|\[)/.test(a.src)){try{xparse(a.src,'stmt')}catch(e){ss.push('Script “'+a.name+'”: '+e.message)}}});
add(ss,'fail','Script problems','All scripts are present and read correctly.',ss.length+' script(s) are empty or have syntax problems.',ss,'Complete the script or fix the unbalanced if/then/end, brackets or quotes.','Flow');
const tt=acts.filter(a=>a.k==='timer'&&(!a.tgt||!aset.has(a.tgt))).map(a=>'Timeout “'+a.name+'”: attached to an activity that does not exist ('+(a.tgt||'none')+')');
add(tt,'fail','Timeouts attached to missing activities','Every timeout is attached to an existing activity.',tt.length+' timeout(s) point nowhere.',tt,'Attach the timeout to an existing activity.','References');
// integration
const wo=acts.filter(a=>a.k==='ws'&&!a.det['Web service operation']).map(a=>'Web service step “'+a.name+'”: no operation name'),we=acts.filter(a=>a.k==='ws'&&!a.loc).map(a=>'Web service step “'+a.name+'”: no endpoint address'),ht=acts.filter(a=>/^http:\/\//i.test(a.loc||'')).map(a=>'“'+a.name+'” calls '+a.loc.replace(/^(https?:\/\/[^\/]+).*$/,'$1'));
add(wo,'fail','Web service steps without an operation','All web service steps name their operation.',wo.length+' web service step(s) have no operation.',wo,'Set the WebServiceOperation name.','Integration');
add(we,'warn','Web service steps without an endpoint','All web service steps have an endpoint.',we.length+' web service step(s) have no endpoint address.',we,'Set the endpoint location.','Integration');
add(ht,'info','Unencrypted endpoints (http)','All endpoints use https.',ht.length+' step(s) call an http endpoint, so traffic is not encrypted.',ht,'Use https where the service supports it.','Security');
// diagram
const edges=Object.values(cells).filter(x=>x.getAttribute('edge')==='1');
if(edges.length||Object.keys(cellOf).length){const byId={};trsAll.forEach(t=>byId[t.id]=t);const actOf=id=>{let x=cells[id];while(x){const v=x.getAttribute('value');if(x.getAttribute('vertex')==='1'&&aset.has(v))return v;x=cells[x.getAttribute('parent')]}return null};
const dm=[],dl=[];edges.forEach(x=>{const s=x.getAttribute('source'),t=x.getAttribute('target'),v=x.getAttribute('value')||'';if((s&&!cells[s])||(t&&!cells[t]))dm.push('Diagram line '+(v||x.getAttribute('id'))+': connected to a shape that does not exist');else if(!s||!t)dl.push('Diagram line '+(v||x.getAttribute('id'))+': not connected at '+(!s&&!t?'both ends':!s?'its start':'its end'));const tr=byId[v];if(tr&&s&&t){const a=actOf(s),b=actOf(t);if(a&&b&&(a!==tr.f||b!==tr.t))dm.push('Transition '+v+': the diagram draws '+(nameOf[a]||a)+' → '+(nameOf[b]||b)+' but the process says '+(nameOf[tr.f]||tr.f)+' → '+(nameOf[tr.t]||tr.t))}});
add(dm,'fail','Diagram disagrees with the process','Diagram lines match the transitions.',dm.length+' diagram line(s) do not match the process definition.',dm,'Redraw the line or correct the transition so both agree.','Diagram');
add(dl,'warn','Loose diagram lines','All diagram lines are connected.',dl.length+' diagram line(s) are not connected at both ends.',dl,'Connect or delete the loose line.','Diagram');
const drawn=new Set(edges.map(x=>x.getAttribute('value'))),nt=trs.filter(t=>!drawn.has(t.id)).map(t=>'Transition '+t.id+' ('+(nameOf[t.f]||t.f)+' → '+(nameOf[t.t]||t.t)+') is not drawn'),ns=acts.filter(a=>!cellOf[a.id]).map(a=>'Activity “'+a.name+'” has no shape on the diagram');
add(nt.concat(ns),'warn','Items missing from the diagram','Every activity and transition is drawn.',(nt.length+ns.length)+' item(s) exist in the process but not on the diagram.',nt.concat(ns),'Redraw the missing items or delete them from the process.','Diagram');
const ov={};acts.forEach(a=>{if(cellOf[a.id]&&a.k!=='timer')(ov[a.x+','+a.y]=ov[a.x+','+a.y]||[]).push(a.name)});const ovl=Object.values(ov).filter(l=>l.length>1).map(l=>'Shapes placed on top of each other: '+l.join(', '));
add(ovl,'info','Overlapping shapes','No shapes overlap.',ovl.length+' group(s) of shapes sit at the same position.',ovl,'Move them apart so the diagram is readable.','Diagram')}}


// ---- activity kind labels (297) ----
const KLB={start:'Start event',end:'End event',gw:'Gateway',ws:'Web service call',app:'Stored procedure / app call',user:'User task',script:'Script task',timer:'Timeout event',task:'Task'};

// ---- technical diff of two versions (299-363) ----
function diffVersions(A,B){
const S=[];const mk=(key,title)=>{const s={key,title,items:[]};S.push(s);return s};
const sH=mk('hdr','Package and process info'),sA=mk('act','Activities'),sT=mk('tr','Transitions and conditions'),sG=mk('gw','Gateways'),sS=mk('scr','Scripts'),sW=mk('svc','Web services and applications'),sU=mk('usr','User tasks and timeouts'),sD=mk('df','Data fields'),sP=mk('pt','Participants'),sE=mk('ext','Extended attributes'),sL=mk('lay','Layout'),sV=mk('val','Validation findings');
const it=(s,t,x,d)=>s.items.push({t,x,d:d||[]});const nl=s=>(s===''||s==null)?'(empty)':String(s);const sh=(s,n)=>{s=String(s);return s.length>(n||150)?s.slice(0,n||150)+'…':s};
// header
const ha=A.X.header,hb=B.X.header;[...new Set([...Object.keys(ha),...Object.keys(hb)])].forEach(k=>{if(!(k in ha))it(sH,'add',k+': '+sh(hb[k]));else if(!(k in hb))it(sH,'del',k+': '+sh(ha[k]));else if(ha[k]!==hb[k])it(sH,'chg',k,['"'+sh(ha[k])+'" → "'+sh(hb[k])+'"'])});
// match activities
const aA=A.D.acts,aB=B.D.acts,byB={};aB.forEach(b=>byB[b.id]=b);
const pairs=[],used=new Set(),restA=[];let byName=0;
aA.forEach(a=>{const b=byB[a.id];if(b&&b.name===a.name){pairs.push([a,b]);used.add(b.id)}else restA.push(a)});
const restB=aB.filter(b=>!used.has(b.id)),cnt=l=>{const c={};l.forEach(x=>c[x.name]=(c[x.name]||0)+1);return c},cA=cnt(restA),cB=cnt(restB),left=[];
restA.forEach(a=>{const c=restB.filter(b=>!used.has(b.id)&&b.name===a.name);if(c.length===1&&cA[a.name]===1&&cB[a.name]===1){pairs.push([a,c[0]]);used.add(c[0].id);byName++}else left.push(a)});
const removed=[],renamed=[];left.forEach(a=>{const b=restB.find(x=>!used.has(x.id)&&x.id===a.id);if(b){pairs.push([a,b]);used.add(b.id);renamed.push([a,b])}else removed.push(a)});
const added=aB.filter(b=>!used.has(b.id));
const desc=a=>KLB[a.k]+(a.det['Web service operation']?', operation '+a.det['Web service operation']:'')+(a.det['Stored procedure / app']?', '+a.det['Stored procedure / app']:'');
added.forEach(b=>it(sA,'add',b.name,[desc(b)]));removed.forEach(a=>it(sA,'del',a.name,[desc(a)]));
renamed.forEach(([a,b])=>it(sA,'chg','Renamed: "'+a.name+'" → "'+b.name+'"',['Same activity ID '+a.id]));
const lines=s=>(s||'').split(/\r?\n/).map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean);
const ctn=l=>{const c={};l.forEach(x=>c[x]=(c[x]||0)+1);return c};
const ldiff=(a,b)=>{const ca=ctn(a),cb=ctn(b),ta={...cb},tb={...ca},rem=[],ad=[];a.forEach(l=>{if(ta[l]>0)ta[l]--;else rem.push(l)});b.forEach(l=>{if(tb[l]>0)tb[l]--;else ad.push(l)});return{rem,ad}};
const dv=(a,b,k)=>[(a.det[k]||''),(b.det[k]||'')];
pairs.forEach(([a,b])=>{const nm=b.name;
if(a.k!==b.k)it(sA,'chg',nm+': type changed',[KLB[a.k]+' → '+KLB[b.k]]);
const ls=ldiff(lines(a.src),lines(b.src));if(ls.rem.length||ls.ad.length)it(sS,'chg',nm,[...ls.rem.slice(0,10).map(l=>'− '+sh(l,170)),...(ls.rem.length>10?['− … '+(ls.rem.length-10)+' more removed lines']:[]),...ls.ad.slice(0,10).map(l=>'+ '+sh(l,170)),...(ls.ad.length>10?['+ … '+(ls.ad.length-10)+' more added lines']:[])]);
const w=[];let [x,y]=dv(a,b,'Web service operation');if(x!==y)w.push('Operation: '+nl(x)+' → '+nl(y));[x,y]=dv(a,b,'Stored procedure / app');if(x!==y)w.push('Application: '+nl(x)+' → '+nl(y));if(a.loc!==b.loc)w.push('Endpoint: '+nl(a.loc)+' → '+nl(b.loc));if(a.params!==b.params)w.push('Parameters: '+nl(sh(a.params,200))+' → '+nl(sh(b.params,200)));
if(w.length)it(sW,'chg',nm,w);
const g=[];[x,y]=dv(a,b,'Gateway');if(x!==y)g.push('Gateway type: '+nl(x)+' → '+nl(y));if(a.rs!==b.rs)g.push('Split/join: '+nl(a.rs)+' → '+nl(b.rs));if(g.length)it(sG,'chg',nm,g);
const u=[];[x,y]=dv(a,b,'Performer');if(x!==y)u.push('Performer: '+nl(x)+' → '+nl(y));if(a.io.join()!==b.io.join())u.push('Editable fields: '+nl(a.io.join(', '))+' → '+nl(b.io.join(', ')));if(a.dl!==b.dl)u.push('Deadline: '+nl(a.dl)+' → '+nl(b.dl));[x,y]=dv(a,b,'Trigger');if(x!==y)u.push('Trigger: '+nl(x)+' → '+nl(y));[x,y]=dv(a,b,'Attached to');if(x!==y)u.push('Attached to: '+nl(x)+' → '+nl(y));if(u.length)it(sU,'chg',nm,u)});
[[added,'add'],[removed,'del']].forEach(([l,t])=>l.forEach(a=>{const s=a.k==='script'?sS:(a.k==='ws'||a.k==='app')?sW:(a.k==='user'||a.k==='timer')?sU:a.k==='gw'?sG:null;if(s&&s!==sA)it(s,t,a.name,[(t==='add'?'New ':'Removed ')+KLB[a.k].toLowerCase()])}));
// transitions
const cAm={},nm2={};pairs.forEach(([a,b])=>cAm[a.id]=b.id);aA.forEach(a=>nm2[cAm[a.id]||'A:'+a.id]=a.name);aB.forEach(b=>nm2[b.id]=b.name);
const key=(t,m,p)=>(m[t.f]||p+t.f)+'>'+(m[t.t]||p+t.t),lbl=(t,m,p)=>nm2[m[t.f]||p+t.f]+' → '+nm2[m[t.t]||p+t.t];
const gA={},gB={};A.D.trs.forEach(t=>(gA[key(t,cAm,'A:')]=gA[key(t,cAm,'A:')]||[]).push(t));B.D.trs.forEach(t=>(gB[key(t,{},'')]=gB[key(t,{},'')]||[]).push(t));
const cd=c=>c?'condition: '+sh(c,220):'default path (no condition)';
[...new Set([...Object.keys(gA),...Object.keys(gB)])].forEach(k=>{let la=[...(gA[k]||[])],lb=[...(gB[k]||[])];
for(let i=la.length-1;i>=0;i--){const j=lb.findIndex(t=>t.cond===la[i].cond&&t.name===la[i].name);if(j>=0){la.splice(i,1);lb.splice(j,1)}}
while(la.length&&lb.length){const a=la.shift(),b=lb.shift(),d=[];if(a.cond!==b.cond)d.push('Condition: '+nl(sh(a.cond,200))+' → '+nl(sh(b.cond,200)));if(a.name!==b.name)d.push('Label: '+nl(a.name)+' → '+nl(b.name));it(sT,'chg',lbl(b,{},''),d)}
la.forEach(t=>it(sT,'del',lbl(t,cAm,'A:'),[cd(t.cond)]));lb.forEach(t=>it(sT,'add',lbl(t,{},''),[cd(t.cond)]))});
// data fields
const mapBy=(l,f)=>{const m={};l.forEach(x=>m[f(x)]=x);return m};
const dA=mapBy(A.X.dfs,d=>d.scope+':'+d.name),dB=mapBy(B.X.dfs,d=>d.scope+':'+d.name);
[...new Set([...Object.keys(dA),...Object.keys(dB)])].forEach(k=>{const a=dA[k],b=dB[k];if(!a)it(sD,'add',b.name,[b.scope+' field'+(b.type?', type '+b.type:'')]);else if(!b)it(sD,'del',a.name,[a.scope+' field'+(a.type?', type '+a.type:'')]);else{const d=[];if(a.type!==b.type)d.push('Type: '+nl(a.type)+' → '+nl(b.type));if(a.init!==b.init)d.push('Initial value: '+nl(sh(a.init))+' → '+nl(sh(b.init)));if(d.length)it(sD,'chg',a.name,d)}});
const pA=mapBy(A.X.apl,x=>x.name),pB=mapBy(B.X.apl,x=>x.name);
[...new Set([...Object.keys(pA),...Object.keys(pB)])].forEach(k=>{const a=pA[k],b=pB[k];if(!a)it(sW,'add','Application '+k,[sh(b.sig,200)]);else if(!b)it(sW,'del','Application '+k,[sh(a.sig,200)]);else if(a.sig!==b.sig)it(sW,'chg','Application '+k,['Signature: '+sh(a.sig,200)+' → '+sh(b.sig,200)])});
const qA=mapBy(A.X.pts,x=>x.name),qB=mapBy(B.X.pts,x=>x.name);
[...new Set([...Object.keys(qA),...Object.keys(qB)])].forEach(k=>{const a=qA[k],b=qB[k];if(!a)it(sP,'add',k,[b.type]);else if(!b)it(sP,'del',k,[a.type]);else if(a.type!==b.type)it(sP,'chg',k,['Type: '+nl(a.type)+' → '+nl(b.type)])});
const an=new Map();pairs.forEach(([a,b])=>an.set(a.name,b.name));
const xg=(l,isA)=>{const g={};l.forEach(x=>{const sc=isA&&x.scope.startsWith('Activity:')?'Activity:'+(an.get(x.scope.slice(9))||x.scope.slice(9)):x.scope;(g[sc]=g[sc]||{})[x.name]=x});return g};
const xa=xg(A.X.ext,true),xb=xg(B.X.ext,false),sv=x=>x.sens?'(value hidden)':x.long?'(long value)':'"'+x.v+'"';
const grpTxt=(o,t)=>{const n=Object.keys(o);return[n.slice(0,8).join(', ')+(n.length>8?'…':'')]};
[...new Set([...Object.keys(xa),...Object.keys(xb)])].forEach(sc=>{const a=xa[sc],b=xb[sc];
if(!a){it(sE,'add',sc+' ('+Object.keys(b).length+' attributes)',grpTxt(b));return}
if(!b){it(sE,'del',sc+' ('+Object.keys(a).length+' attributes)',grpTxt(a));return}
[...new Set([...Object.keys(a),...Object.keys(b)])].forEach(n=>{const x=a[n],y=b[n];if(!x)it(sE,'add',sc+' | '+n,[sv(y)]);else if(!y)it(sE,'del',sc+' | '+n,[sv(x)]);else if(x.h!==y.h)it(sE,'chg',sc+' | '+n,[(x.sens||x.long)?'Value changed (not shown)':sv(x)+' → '+sv(y)])})});
// layout
if(A.M.layout==='from file'&&B.M.layout==='from file'){const mv=pairs.filter(([a,b])=>Math.abs(a.x-b.x)>2||Math.abs(a.y-b.y)>2);if(mv.length)it(sL,'chg',mv.length+' activit'+(mv.length>1?'ies':'y')+' moved on the diagram',['Position only, no logic change: '+mv.slice(0,8).map(p=>p[1].name).join(', ')+(mv.length>8?'…':'')])}
// validation
const vA=mapBy(A.M.checks,c=>c.l),vB=mapBy(B.M.checks,c=>c.l);
Object.keys(vB).forEach(k=>{const a=vA[k],b=vB[k];if(!a)it(sV,'add',k,[b.s+': '+sh(b.d,200)]);else if(a.s!==b.s)it(sV,'chg',k+': '+a.s+' → '+b.s,[sh(b.d,220)]);else if(a.d!==b.d)it(sV,'chg',k,[sh(a.d,200)+' → '+sh(b.d,200)])});
Object.keys(vA).forEach(k=>{if(!vB[k])it(sV,'del',k,[])});
const kA=A.M.kinds,kB=B.M.kinds;
const rows=[['Activities',A.M.nAct,B.M.nAct],['Transitions',A.M.nTr,B.M.nTr],...Object.keys({...kA,...kB}).map(k=>[KLB[k]+'s',kA[k]||0,kB[k]||0]),['Data fields',A.X.dfs.length,B.X.dfs.length],['Applications',A.X.apl.length,B.X.apl.length],['Participants',A.X.pts.length,B.X.pts.length]];
const notes=['Activities matched: '+pairs.length+(byName?' ('+byName+' by name because the ID changed)':'')+', added '+added.length+', removed '+removed.length+'.'];
if(A.M.proc!==B.M.proc)notes.push('The process names differ: "'+A.M.proc+'" and "'+B.M.proc+'".');
return{S,rows,notes,A:A.M,B:B.M,biz:bizDiff(A,B,{pairs,added,removed,renamed,S})}}

// ---- plain-text diff (375) ----
function diffText(r){const sg={add:'[+]',del:'[-]',chg:'[~]'};let o='Compare: '+r.A.file+' (A) vs '+r.B.file+' (B)\n'+r.notes.join('\n')+'\n';r.S.forEach(s=>{if(!s.items.length)return;o+='\n## '+s.title+' ('+s.items.length+')\n';s.items.forEach(i=>{o+=sg[i.t]+' '+i.x+'\n';i.d.forEach(d=>o+='    '+d+'\n')})});return o}

// ---- business wording helpers (376-386) ----
function hv(v){let s=String(v).replace(/(_procattribs|_\d+)+$/i,'').replace(/_/g,' ').trim();return s.replace(/\b(trials|trails)\b/i,'attempts')}
function hcond(c){return String(c||'').replace(/\[([^\]]+)\]/g,(m,v)=>hv(v)).replace(/!=/g,' is not ').replace(/>=/g,' is at least ').replace(/<=/g,' is at most ').replace(/=/g,' is ').replace(/>/g,' is more than ').replace(/</g,' is less than ').replace(/&/g,' AND ').replace(/\|/g,' OR ').replace(/"null"/g,'empty').replace(/"([^"]*)"/g,"'$1'").replace(/\s+/g,' ').trim()}
function hline(l){l=l.trim().replace(/;$/,'');let m;if(/^(end|else)$/i.test(l))return'';
if(m=l.match(/^if\s*(.*?)\s*then$/i))return'when '+hcond(m[1].replace(/^\((.*)\)$/,'$1'));
if(m=l.match(/^\[([^\]]+)\]\s*:=\s*\[([^\]]+)\]\s*\+\s*(\d+)$/))return m[1]===m[2]?'increases '+hv(m[1])+' by '+m[3]:'sets '+hv(m[1])+' to '+hv(m[2])+' + '+m[3];
if(m=l.match(/^\[([^\]]+)\]\s*:=\s*GetItem\(\s*\[([^\]]+)\]\s*,\s*(\d+)\s*\)$/i))return'takes item '+m[3]+' of '+hv(m[2])+' into '+hv(m[1]);
if(m=l.match(/^\[([^\]]+)\]\s*:=\s*"([^"]*)"$/))return'sets '+hv(m[1])+' to "'+m[2]+'"';
if(m=l.match(/^\[([^\]]+)\]\s*:=\s*(.+)$/))return'sets '+hv(m[1])+' to '+hcond(m[2]);
return hcond(l)}
const NOUN={start:'start of the process',end:'end of the process',gw:'decision point',ws:'system call',app:'database/system action',user:'manual step',script:'automatic calculation',timer:'timeout',task:'step'};
const THEMES=['Risks','Scenarios','Process steps','Routing and decisions','Retries and timeouts','System integrations','Manual steps','Automatic calculations','Data','Roles','Configuration','Layout'];

// ---- business diff (387-443) ----
function bizDiff(A,B,c){const o=[];const add=(imp,theme,text,d)=>o.push({imp,theme,text,d:d||[]}),q=s=>'“'+s+'”',nl=s=>s?s:'(none)';
const nA={},nB={};A.D.acts.forEach(a=>nA[a.id]=a);B.D.acts.forEach(b=>nB[b.id]=b);
const near=(id,G,N)=>{const i=[...new Set(G.D.trs.filter(t=>t.t===id&&N[t.f]).map(t=>N[t.f].name))],u=[...new Set(G.D.trs.filter(t=>t.f===id&&N[t.t]).map(t=>N[t.t].name))];const f=l=>l.slice(0,2).map(q).join(' / ')+(l.length>2?'…':'');return(i.length||u.length)?' ('+(i.length?'after '+f(i):'')+(i.length&&u.length?', ':'')+(u.length?'before '+f(u):'')+')':''};
c.added.forEach(b=>{const x=b.k==='ws'&&b.det['Web service operation']?', calling service '+b.det['Web service operation']:b.k==='app'&&b.det['Stored procedure / app']?', running '+b.det['Stored procedure / app']:b.k==='timer'?' on '+q(b.det['Attached to']||'?'):'';add(b.k==='timer'?'med':'high',b.k==='timer'?'Retries and timeouts':'Process steps','A new '+NOUN[b.k]+' '+q(b.name)+' was added'+x+near(b.id,B,nB)+'.')});
c.removed.forEach(a=>add(a.k==='timer'?'med':'high',a.k==='timer'?'Retries and timeouts':'Process steps','The '+NOUN[a.k]+' '+q(a.name)+' was removed'+near(a.id,A,nA)+'.'));
c.renamed.forEach(([a,b])=>add('low','Process steps',q(a.name)+' was renamed to '+q(b.name)+' (same behaviour).'));
const lines=s=>(s||'').split(/\r?\n/).map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean),ctn=l=>{const k={};l.forEach(x=>k[x]=(k[x]||0)+1);return k};
const ldiff=(a,b)=>{const ca=ctn(a),cb=ctn(b),ta={...cb},tb={...ca},rem=[],ad=[];a.forEach(l=>{if(ta[l]>0)ta[l]--;else rem.push(l)});b.forEach(l=>{if(tb[l]>0)tb[l]--;else ad.push(l)});return{rem,ad}};
c.pairs.forEach(([a,b])=>{const n=q(b.name);
if(a.k!==b.k)add('high','Process steps',n+' changed from a '+NOUN[a.k]+' to a '+NOUN[b.k]+'.');
const L=ldiff(lines(a.src),lines(b.src)),rm=L.rem.map(hline).filter(Boolean),ad=L.ad.map(hline).filter(Boolean);
if(rm.length||ad.length)add('med','Automatic calculations','The automatic logic in '+n+' changed.',[...rm.slice(0,4).map(x=>'No longer: '+x),...ad.slice(0,4).map(x=>'Now: '+x)]);
const oa=a.det['Web service operation'],ob=b.det['Web service operation'],pa=a.det['Stored procedure / app'],pb=b.det['Stored procedure / app'];
if(oa!==ob)add('med','System integrations',n+' now calls service '+nl(ob)+' instead of '+nl(oa)+'.');
if(pa!==pb)add('med','System integrations',n+' now runs '+nl(pb)+' instead of '+nl(pa)+'.');
if(a.loc!==b.loc)add('med','System integrations',n+' now uses a different service endpoint.',[nl(a.loc)+' → '+nl(b.loc)]);
if(a.params!==b.params&&oa===ob&&pa===pb)add('low','System integrations','The information sent to or received from '+n+' changed.');
if(a.det.Gateway!==b.det.Gateway||a.rs!==b.rs)add('high','Routing and decisions','How the decision point '+n+' combines its paths changed ('+nl(a.det.Gateway||a.rs)+' → '+nl(b.det.Gateway||b.rs)+').');
if((a.det.Performer||'')!==(b.det.Performer||''))add('med','Manual steps','Who handles '+n+' changed from '+nl(a.det.Performer)+' to '+nl(b.det.Performer)+'.');
const ia=a.io.filter(x=>!b.io.includes(x)),ib=b.io.filter(x=>!a.io.includes(x));if(ia.length||ib.length)add('low','Manual steps','The information captured in '+n+' changed.',[...(ib.length?['Added: '+ib.map(hv).join(', ')]:[]),...(ia.length?['Removed: '+ia.map(hv).join(', ')]:[])]);
if(a.dl!==b.dl)add('med','Retries and timeouts','The time limit on '+n+' changed from '+nl(a.dl)+' to '+nl(b.dl)+'.');
const ta=a.det['Attached to'],tb=b.det['Attached to'];if(a.k==='timer'&&ta!==tb)add('med','Retries and timeouts','The timeout '+n+' now applies to '+q(nl(tb))+' instead of '+q(nl(ta))+'.');
else if((a.det.Trigger||'')!==(b.det.Trigger||''))add('med','Retries and timeouts','The timeout '+n+' now fires on a different trigger ('+nl(a.det.Trigger)+' → '+nl(b.det.Trigger)+').')});
// transitions
const cAm={};c.pairs.forEach(([a,b])=>cAm[a.id]=b.id);
const nmA=t=>(cAm[t]?nB[cAm[t]]:nA[t]).name,key=(t,m,p)=>(m[t.f]||p+t.f)+'>'+(m[t.t]||p+t.t);
const gA={},gB={};A.D.trs.forEach(t=>{const k=key(t,cAm,'A:');(gA[k]=gA[k]||[]).push(t)});B.D.trs.forEach(t=>{const k=key(t,{},'');(gB[k]=gB[k]||[]).push(t)});
const ct=x=>x?' It applies when '+hcond(x)+'.':' It was a default path (no condition).';
[...new Set([...Object.keys(gA),...Object.keys(gB)])].forEach(k=>{const la=[...(gA[k]||[])],lb=[...(gB[k]||[])];
for(let i=la.length-1;i>=0;i--){const j=lb.findIndex(t=>t.cond===la[i].cond&&t.name===la[i].name);if(j>=0){la.splice(i,1);lb.splice(j,1)}}
while(la.length&&lb.length){const a=la.shift(),b=lb.shift(),p=q(nB[b.f].name)+' → '+q(nB[b.t].name);
if(a.cond!==b.cond){const na=a.cond.match(/\d+(?:\.\d+)?/g)||[],nb=b.cond.match(/\d+(?:\.\d+)?/g)||[],rt=/trials|trails/i.test(a.cond+b.cond);
if(a.cond&&b.cond&&a.cond.replace(/\d+(?:\.\d+)?/g,'#')===b.cond.replace(/\d+(?:\.\d+)?/g,'#')){const i=na.findIndex((x,j)=>x!==nb[j]);add('high',rt?'Retries and timeouts':'Routing and decisions',(rt?'The maximum number of retries':'A threshold')+' on the path '+p+' changed from '+na[i]+' to '+nb[i]+'.',['Rule now: '+hcond(b.cond)])}
else add('high','Routing and decisions','The rule for the path '+p+' changed.',['Before: '+(a.cond?hcond(a.cond):'default path (no condition)'),'Now: '+(b.cond?hcond(b.cond):'default path (no condition)')])}
else if(a.name!==b.name)add('low','Routing and decisions','The label of the path '+p+' changed from “'+a.name+'” to “'+b.name+'”.')}
la.forEach(t=>add('high','Routing and decisions','The path '+q(nmA(t.f))+' → '+q(nmA(t.t))+' was removed.'+ct(t.cond)));
lb.forEach(t=>add('high','Routing and decisions','A new path from '+q(nB[t.f].name)+' to '+q(nB[t.t].name)+' was added.'+ct(t.cond)))});
// scenarios
try{const IA=analyse(A.D),IB=analyse(B.D),nmA=id=>{const x=cAm[id];return x&&nB[x]?nB[x].name:nA[id].name},nmB=id=>nB[id].name,K=['ws','app','user','timer'];
const sg=(I,nm)=>{const m=new Map();I.paths.forEach(pe=>{const k=pe.p.filter(id=>K.includes(I.g.A[id].k)).map(nm).join(' > ');if(!m.has(k)||m.get(k).steps>pe.steps)m.set(k,pe)});return m};
const SA=sg(IA,nmA),SB=sg(IB,nmB),rm=[...SA.keys()].filter(k=>!SB.has(k)),ad=[...SB.keys()].filter(k=>!SA.has(k));
const ex=l=>l.sort((x,y)=>x.length-y.length).slice(0,3).map(k=>k?k.split(' > ').map(q).join(' → '):'(no system checks or manual steps)');
if(rm.length)add('high','Scenarios',rm.length+' scenario'+(rm.length>1?'s':'')+' (distinct sequences of system checks and manual steps) can no longer happen.',ex(rm));
if(ad.length)add('high','Scenarios',ad.length+' new scenario'+(ad.length>1?'s':'')+' can now happen.',ex(ad));
const oA=new Set(IA.paths.map(pe=>outcomeOf(IA.g,pe.p,nmA))),oB=new Set(IB.paths.map(pe=>outcomeOf(IB.g,pe.p,nmB)));
oB.forEach(x=>{if(!oA.has(x))add('high','Scenarios','The process can now end as '+x+'.')});oA.forEach(x=>{if(!oB.has(x))add('high','Scenarios','The process can no longer end as '+x+'.')});
if(IA.happy&&IB.happy){const hs=(I,nm)=>new Set(I.happy.p.filter(id=>K.slice(0,2).includes(I.g.A[id].k)).map(nm)),ha=hs(IA,nmA),hb=hs(IB,nmB);hb.forEach(x=>{if(!ha.has(x))add('med','Scenarios','The standard path now passes through '+q(x)+'.')});ha.forEach(x=>{if(!hb.has(x))add('med','Scenarios','The standard path no longer passes through '+q(x)+'.')})}
if(IA.all!==IB.all)add('low','Scenarios','The number of possible end-to-end routes changed from '+IA.all+' to '+IB.all+'.')}catch(e){}
// data, roles, config, validation, layout
const dm=(l)=>{const m={};l.forEach(x=>m[x.scope+':'+x.name]=x);return m},dA=dm(A.X.dfs),dB=dm(B.X.dfs);
[...new Set([...Object.keys(dA),...Object.keys(dB)])].forEach(k=>{const a=dA[k],b=dB[k];if(!a)add('med','Data','New information is now tracked: '+hv(b.name)+'.');else if(!b)add('med','Data','Information is no longer tracked: '+hv(a.name)+'.');else{if(a.init!==b.init)add('med','Data','The default value of '+hv(a.name)+' changed from '+nl(a.init)+' to '+nl(b.init)+'.');if(a.type!==b.type)add('low','Data','The data type of '+hv(a.name)+' changed ('+nl(a.type)+' → '+nl(b.type)+').')}});
const qa=new Set(A.X.pts.map(p=>p.name)),qb=new Set(B.X.pts.map(p=>p.name));qb.forEach(n=>{if(!qa.has(n))add('med','Roles','A new role or team was added: '+n+'.')});qa.forEach(n=>{if(!qb.has(n))add('med','Roles','A role or team was removed: '+n+'.')});
const S=k=>c.S.find(s=>s.key===k).items;
const ex=S('ext');if(ex.length){add('low','Configuration',ex.length+' technical setting'+(ex.length>1?'s':'')+' changed (see Technical details).');if(ex.some(i=>/not shown|hidden/.test(i.d.join(' '))))add('med','Configuration','Connection or security settings changed (the values are not shown).')}
S('val').forEach(i=>{if(/^(Dead ends|Reachability)/.test(i.x))add('high','Risks',(/^Dead/.test(i.x)?'Dead-end check: ':'Reachability check: ')+(i.d[0]||i.x));else if(/^Gateways without/.test(i.x))add('med','Risks',i.d[0]||i.x)});
const ly=S('lay');if(ly.length)add('low','Layout','Only the diagram layout changed ('+ly[0].x+'). No change in behaviour.');
const ord={high:0,med:1,low:2};o.sort((x,y)=>ord[x.imp]-ord[y.imp]||THEMES.indexOf(x.theme)-THEMES.indexOf(y.theme));return o}

// ---- business diff as text (450) ----
function bizText(r){let o='Business view: '+r.A.file+' (A) to '+r.B.file+' (B)\n';THEMES.forEach(t=>{const l=r.biz.filter(x=>x.theme===t);if(!l.length)return;o+='\n## '+t+'\n';l.forEach(i=>{o+='['+i.imp.toUpperCase()+'] '+i.text+'\n';i.d.forEach(d=>o+='    '+d+'\n')})});return o}

// ---- graph, business description of a step, route analysis (469-508) ----
function hn(s){return String(s||'').replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\s+/g,' ').trim()}
function graphOf(D){const A={},out={},inn={};D.acts.forEach(a=>A[a.id]=a);D.trs.forEach(t=>{(out[t.f]=out[t.f]||[]).push({to:t.t,t});(inn[t.t]=inn[t.t]||[]).push(t.f)});
D.acts.filter(a=>a.k==='timer'&&a.tgt&&A[a.tgt]).forEach(a=>{(out[a.tgt]=out[a.tgt]||[]).push({to:a.id,timeout:true});(inn[a.id]=inn[a.id]||[]).push(a.tgt)});
const start=(D.acts.find(a=>a.k==='start')||D.acts.find(a=>a.k!=='timer'&&!inn[a.id])||D.acts[0]).id;return{A,out,inn,start}}
function bizStep(a,G){const g=graphOf(G),ins=a.ins.map(hv),outs=a.outs.map(hv),l=s=>s.toLowerCase();
switch(a.k){case'start':return'The process begins here.';case'end':return'The process finishes here.';
case'timer':return'Timeout: if “'+(a.det['Attached to']||'the linked step')+'” is not completed in time, the flow continues here.';
case'ws':return'Asks an external system: '+l(hn(a.det['Web service operation']||a.name))+'.'+(ins.length?' Sends: '+ins.join(', ')+'.':'')+(outs.length?' Gets back: '+outs.join(', ')+'.':'');
case'app':return'Runs a system or database action: '+l(hn(a.det['Stored procedure / app']||a.name))+'.'+(ins.length?' Uses: '+ins.join(', ')+'.':'')+(outs.length?' Produces: '+outs.join(', ')+'.':'');
case'script':{const ls=(a.src||'').split(/\r?\n/).map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean).map(hline).filter(Boolean);return ls.length?'Automatic processing: '+ls.slice(0,4).join('; ')+(ls.length>4?'; and '+(ls.length-4)+' more rules':'')+'.':'Automatic processing step.'}
case'gw':{const o=g.out[a.id]||[];if(o.length>1)return'Decision: '+o.filter(e=>e.t).map(e=>(e.t.cond?'if '+hcond(e.t.cond):'otherwise')+' → “'+g.A[e.to].name+'”').join('; ')+'.';return(g.inn[a.id]||[]).length>1?'Brings alternative paths back together.':'Passes the flow on.'}
case'user':{const tm=G.acts.find(x=>x.k==='timer'&&x.tgt===a.id);return'A person handles this step'+(a.det.Performer?' ('+a.det.Performer+')':'')+'.'+(a.io.length?' They can enter: '+a.io.map(hv).join(', ')+'.':'')+(tm?' If nobody acts in time, “'+tm.name+'” fires.':'')}
default:return'Process step.'}}
function pathsOf(D,cap){const g=graphOf(D),res=[];let budget=600000,trunc=false;
const dfs=(n,p,e,vis)=>{if(res.length>=cap||budget--<=0){trunc=true;return}const o=g.out[n]||[];if(g.A[n].k==='end'||!o.length){res.push({p:[...p],e:[...e]});return}
for(const x of o){if(vis.has(x.to))continue;vis.add(x.to);p.push(x.to);e.push(x);dfs(x.to,p,e,vis);p.pop();e.pop();vis.delete(x.to)}};
dfs(g.start,[g.start],[],new Set([g.start]));return{g,paths:res,trunc}}
function inputVars(D){const asg=new Set(),out=new Set();D.acts.forEach(a=>{(a.src||'').replace(/\[([^\]]+)\]\s*:=/g,(m,v)=>{asg.add(v);return m});a.outs.forEach(v=>out.add(v));a.io.forEach(v=>out.add(v))});return v=>!asg.has(v)&&!out.has(v)}
function atoms(c){if(!c||/\|/.test(c))return null;const r=[];for(const p of c.split('&')){const m=p.trim().replace(/^\(+|\)+$/g,'').match(/^\[([^\]]+)\]\s*(!=|=)\s*"([^"]*)"$/);if(!m)return null;r.push([m[1],m[2],m[3]])}return r}
function feasible(edges,isIn){const eq={},ne={};for(const e of edges){if(!e.t||!e.t.cond)continue;const a=atoms(e.t.cond);if(!a)continue;for(const[v,o,l]of a){if(!isIn(v))continue;if(o==='='){if(eq[v]!==undefined&&eq[v]!==l)return false;if((ne[v]||[]).includes(l))return false;eq[v]=l}else{if(eq[v]===l)return false;(ne[v]=ne[v]||[]).push(l)}}}return true}
function outcomeOf(g,p,nm){nm=nm||(id=>g.A[id].name);const s=p.filter(id=>g.A[id].k!=='gw'&&g.A[id].k!=='end');if(!s.length)return'(end)';const t=nm(s[s.length-1]),pv=s.length>1?nm(s[s.length-2]):'';return pv?'“'+t+'” after “'+pv+'”':'“'+t+'”'}
const isDec=(g,id)=>g.A[id].k==='gw'&&(g.out[id]||[]).length>1;
function feats(g,pe){const f=new Set(['out:'+pe.out]);pe.p.forEach((id,i)=>{const k=g.A[id].k;if(k==='user'||k==='timer'||k==='ws'||k==='app')f.add('s:'+id);const e=pe.e[i];if(e&&e.t&&isDec(g,id))f.add('b:'+e.t.id)});return f}
function analyse(D){const I=pathsOf(D,5000),isIn=inputVars(D);I.paths=I.paths.filter(pe=>feasible(pe.e,isIn));I.paths.forEach(pe=>{pe.out=outcomeOf(I.g,pe.p);pe.f=feats(I.g,pe);pe.steps=pe.p.filter(id=>I.g.A[id].k!=='gw').length});I.all=I.paths.length;
const g=I.g,term=pe=>{const s=pe.p.filter(id=>g.A[id].k!=='gw'&&g.A[id].k!=='end');return s.length?g.A[s[s.length-1]].name:''};
const calm=I.paths.filter(pe=>!pe.p.some(id=>g.A[id].k==='user'||g.A[id].k==='timer')).sort((a,b)=>a.steps-b.steps);
const happy=calm.find(pe=>!/close|reject|cancel|fail|abort|stop/i.test(term(pe)+' '+pe.out))||calm[0]||I.paths.slice().sort((a,b)=>a.steps-b.steps)[0]||null;I.happy=happy;
const sc=[];if(happy){const cov=new Set(happy.f);sc.push(happy);while(sc.length<30){let best=null,bn=0;for(const pe of I.paths){let n=0;pe.f.forEach(x=>{if(!cov.has(x))n++});if(n>bn||(n===bn&&n>0&&best&&pe.steps<best.steps)){best=pe;bn=n}}if(!best||!bn)break;sc.push(best);best.f.forEach(x=>cov.add(x))}}
I.sc=sc;const he=new Set(happy?happy.e.filter(e=>e.t).map(e=>e.t.id):[]);
sc.forEach(pe=>{pe.dev=[];pe.p.forEach((id,i)=>{const e=pe.e[i];if(e&&e.t&&isDec(g,id)&&!he.has(e.t.id))pe.dev.push(e.t.cond?hcond(e.t.cond):'otherwise at “'+hn(g.A[id].name)+'”')})});
I.bo={};I.paths.forEach(pe=>pe.e.forEach((e,i)=>{if(e.t&&isDec(g,pe.p[i])){const m=I.bo[e.t.id]=I.bo[e.t.id]||{};m[pe.out]=(m[pe.out]||0)+1}}));return I}
function narr(g,pe){const L=[];pe.p.forEach((id,i)=>{const a=g.A[id],e=pe.e[i];if(a.k==='start'||a.k==='script'&&!/close|handler|reject|cancel|fail|stop|escalat/i.test(a.name))return;
if(a.k==='gw'){if(isDec(g,id)&&e&&e.t)L.push({k:'dec',x:(e.t.cond?'If '+hcond(e.t.cond):'Otherwise')+(!e.t.cond&&e.t.name?' ('+e.t.name+')':'')});return}
if(a.k==='ws')L.push({k:'sys',x:'Checks with an external system: '+hn(a.det['Web service operation']||a.name).toLowerCase()});
else if(a.k==='app')L.push({k:'sys',x:'Runs “'+(a.det['Stored procedure / app']||a.name)+'”'});
else if(a.k==='user')L.push({k:'man',x:'A person handles “'+a.name+'”'});
else if(a.k==='timer')L.push({k:'to',x:'Timeout: “'+(a.det['Attached to']||'')+'” took too long, so the flow continues at “'+a.name+'”'});
else if(a.k==='end')L.push({k:'end',x:'The process ends'});
else L.push({k:'sys',x:'Applies “'+a.name+'”'})});return L}
function scTitle(I,pe){const g=I.g;if(pe===I.happy)return'Standard path (everything goes well)';const tm=pe.p.find(id=>g.A[id].k==='timer');if(tm)return'Escalation after timeout: “'+g.A[tm].name+'”';const us=pe.p.find(id=>g.A[id].k==='user');if(us)return'Manual intervention at “'+g.A[us].name+'”';return'Ends as '+pe.out}

export {
  xpdlToData, autoLayout, xparse, diffVersions, diffText, bizDiff, bizText, hv, hcond, hline, hn, graphOf, bizStep,
  pathsOf, inputVars, feasible, outcomeOf, analyse, narr, scTitle, KLB, NOUN, THEMES
};
