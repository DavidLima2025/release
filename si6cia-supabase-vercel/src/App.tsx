import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Check, CheckCircle2, Clock, Filter, LayoutDashboard, ListChecks, Lock, Plus, RotateCcw, Trash2, UserPlus, UserRound, Users } from 'lucide-react'
import { supabase } from './supabase'

const today = new Date().toISOString().slice(0, 10)
const statuses = ['A fazer', 'Atrasada', 'Paralisada', 'Risco de prazo', 'Concluída']
const types = ['Inteligência', 'Dossiê', 'Operacional', 'Relatório', 'Gestão']
const priorities = ['Baixa', 'Média', 'Alta', 'Crítica']

type User = { id:string; name:string; war_name:string; register?:string; unit?:string; role:string; email?:string; phone?:string; login:string; status:string }
type Workflow = { id:string; name:string; position:number }
type Demand = { id:string; title:string; type:string; status:string; priority:string; responsible_id:string|null; manager_id:string|null; date:string; internal_deadline:string|null; official_deadline:string|null; overdue_date:string|null; workflow_id:string|null; checklist:string[]; done:boolean[]; notes:string|null; responsible?:User|null; workflow?:Workflow|null }

function Badge({children,tone='default'}:{children:any;tone?:string}){return <span className={`badge ${tone}`}>{children}</span>}
function toneStatus(s:string){return s==='Concluída'?'low':s==='Atrasada'?'high':s==='Risco de prazo'?'medium':'default'}
function tonePriority(p:string){return p==='Crítica'||p==='Alta'?'high':p==='Média'?'medium':'low'}

function buildCalendarDays(monthDate:Date){
  const y=monthDate.getFullYear(), m=monthDate.getMonth(), first=new Date(y,m,1), last=new Date(y,m+1,0)
  const days:(string|null)[]=[]
  for(let i=0;i<first.getDay();i++)days.push(null)
  for(let d=1;d<=last.getDate();d++)days.push(new Date(y,m,d).toISOString().slice(0,10))
  while(days.length%7!==0)days.push(null)
  return days
}

export default function App(){
  const [logged,setLogged]=useState(false)
  const [currentUser,setCurrentUser]=useState<User|null>(null)
  const [login,setLogin]=useState('')
  const [password,setPassword]=useState('')
  const [users,setUsers]=useState<User[]>([])
  const [workflows,setWorkflows]=useState<Workflow[]>([])
  const [demands,setDemands]=useState<Demand[]>([])
  const [selectedDate,setSelectedDate]=useState(today)
  const [monthDate,setMonthDate]=useState(new Date())
  const [message,setMessage]=useState('')
  const [screenStatus,setScreenStatus]=useState<string|null>(null)
  const [dayModal,setDayModal]=useState(false)
  const [dayMode,setDayMode]=useState<'view'|'create'>('view')
  const [selectedProcessId,setSelectedProcessId]=useState('')
  const [newWorkflow,setNewWorkflow]=useState('')

  const [userForm,setUserForm]=useState({name:'',war_name:'',register:'',unit:'',role:'Analista',email:'',phone:'',login:'',password:'',status:'Ativo'})
  const [demandForm,setDemandForm]=useState({title:'',type:'Inteligência',priority:'Média',responsible_id:'',date:today,internal_deadline:today,official_deadline:today,overdue_date:today,workflow_id:'',new_workflow:'',notes:''})

  function notify(t:string){setMessage(t);setTimeout(()=>setMessage(''),2500)}

  async function loadData(){
    const [u,w,d]=await Promise.all([
      supabase.from('app_users').select('id,name,war_name,register,unit,role,email,phone,login,status').order('created_at',{ascending:false}),
      supabase.from('workflows').select('*').order('position',{ascending:true}),
      supabase.from('demands').select('*, responsible:app_users(*), workflow:workflows(*)').order('created_at',{ascending:false})
    ])
    setUsers((u.data||[]) as User[])
    setWorkflows((w.data||[]) as Workflow[])
    setDemands((d.data||[]) as Demand[])
    if(!demandForm.workflow_id && w.data?.[0]?.id) setDemandForm(f=>({...f,workflow_id:w.data![0].id}))
  }

  useEffect(()=>{loadData()},[])
  useEffect(()=>{
    const ch=supabase.channel('si6-realtime')
      .on('postgres_changes',{event:'*',schema:'public',table:'demands'},loadData)
      .on('postgres_changes',{event:'*',schema:'public',table:'workflows'},loadData)
      .on('postgres_changes',{event:'*',schema:'public',table:'app_users'},loadData)
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[])

  async function doLogin(){
    const {data,error}=await supabase.rpc('login_user',{p_login:login,p_password:password})
    if(error||!data||data.length===0){alert('Usuário ou senha inválidos, ou usuário inativo.');return}
    setCurrentUser(data[0]);setLogged(true);notify('Login realizado.')
  }

  async function createUser(){
    if(!userForm.name||!userForm.login||!userForm.password){notify('Informe nome, login e senha.');return}
    const {error}=await supabase.rpc('create_app_user',{p_name:userForm.name,p_war_name:userForm.war_name||userForm.name,p_register:userForm.register,p_unit:userForm.unit,p_role:userForm.role,p_email:userForm.email,p_phone:userForm.phone,p_login:userForm.login,p_password:userForm.password,p_status:userForm.status})
    if(error){notify('Erro ao cadastrar usuário. Verifique login duplicado.');return}
    setUserForm({name:'',war_name:'',register:'',unit:'',role:'Analista',email:'',phone:'',login:'',password:'',status:'Ativo'})
    notify('Usuário cadastrado.');loadData()
  }

  async function addWorkflowFromName(raw:string){
    const name=raw.trim(); if(!name)return null
    const ex=workflows.find(w=>w.name.toLowerCase()===name.toLowerCase()); if(ex)return ex
    const {data,error}=await supabase.from('workflows').insert({name,position:workflows.length+1}).select().single()
    if(error){notify('Erro ao criar workflow.');return null}
    notify('Workflow criado.');await loadData();return data as Workflow
  }

  async function createDemand(){
    if(!demandForm.title){notify('Informe o título.');return}
    if(!demandForm.responsible_id){notify('Selecione um responsável cadastrado.');return}
    let workflow_id=demandForm.workflow_id
    if(demandForm.new_workflow.trim()){const w=await addWorkflowFromName(demandForm.new_workflow); if(w)workflow_id=w.id}
    const {error}=await supabase.from('demands').insert({title:demandForm.title,type:demandForm.type,status:'A fazer',priority:demandForm.priority,responsible_id:demandForm.responsible_id,manager_id:currentUser?.id||null,date:demandForm.date,internal_deadline:demandForm.internal_deadline,official_deadline:demandForm.official_deadline,overdue_date:demandForm.overdue_date,workflow_id,checklist:['Triar demanda','Executar atividade','Registrar conclusão'],done:[false,false,false],notes:demandForm.notes})
    if(error){notify('Erro ao cadastrar demanda.');return}
    setDemandForm(f=>({...f,title:'',notes:'',new_workflow:''}))
    setDayMode('view');notify('Demanda cadastrada.');loadData()
  }

  async function updateDemand(id:string,values:any){const {error}=await supabase.from('demands').update(values).eq('id',id); if(error)notify('Erro ao atualizar.'); else loadData()}
  async function deleteDemand(id:string){const {error}=await supabase.from('demands').delete().eq('id',id); if(error)notify('Erro ao excluir.'); else {notify('Demanda excluída.');loadData()}}
  async function postponeDemand(d:Demand){const nd=prompt('Nova data de atraso (AAAA-MM-DD):',d.overdue_date||d.internal_deadline||today); if(!nd)return; if(!/^\d{4}-\d{2}-\d{2}$/.test(nd)){notify('Data inválida.');return} await updateDemand(d.id,{overdue_date:nd,internal_deadline:nd,status:d.status==='Atrasada'?'A fazer':d.status}); notify('Demanda postergada.')}
  async function toggleChecklist(d:Demand,i:number){const done=[...(d.done||[])]; done[i]=!done[i]; await updateDemand(d.id,{done,status:done.every(Boolean)?'Concluída':d.status==='Concluída'?'A fazer':d.status})}

  const activeUsers=users.filter(u=>u.status==='Ativo')
  const counts=useMemo(()=>statuses.reduce((a:any,s)=>{a[s]=demands.filter(d=>d.status===s).length;return a},{}),[demands])
  const dayDemands=demands.filter(d=>d.date===selectedDate)
  const selectedProcess=demands.find(d=>d.id===selectedProcessId)||demands[0]
  const stepIndex=selectedProcess?Math.max(0,workflows.findIndex(w=>w.id===selectedProcess.workflow_id)):0
  const progress=selectedProcess&&workflows.length?Math.round(((stepIndex+1)/workflows.length)*100):0

  async function setProcessStep(w:Workflow){
    if(!selectedProcess)return
    const last=Math.max(...workflows.map(x=>x.position))
    await updateDemand(selectedProcess.id,{workflow_id:w.id,status:w.position===last?'Concluída':selectedProcess.status==='Concluída'?'A fazer':selectedProcess.status})
    notify('Etapa atualizada.')
  }

  if(!logged)return <main className="login"><section><div className="chip">Inteligência Operacional</div><h1>SI 6ª CIA</h1><p>Observar • Analisar • Antecipar</p><div className="owl">🦉</div><input placeholder="Usuário" value={login} onChange={e=>setLogin(e.target.value)}/><input placeholder="Senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()}/><button onClick={doLogin}><Lock size={18}/> Entrar</button><small>ADM padrão: ADM6CIA / 123456</small></section></main>

  return <div><header><div className="brand"><div>🦉</div><span><b>SI 6ª CIA</b><small>Centro de inteligência</small></span></div><nav><Badge tone="dark"><UserRound size={14}/> {currentUser?.war_name}</Badge><Badge tone="dark"><Users size={14}/> {activeUsers.length} ativos</Badge><button onClick={()=>{setLogged(false);setCurrentUser(null)}}>Sair</button></nav></header>{message&&<div className="toast"><CheckCircle2 size={16}/>{message}</div>}<main className="container">
    <section className="stats">{statuses.map((s,i)=><button key={s} className={`stat s${i}`} onClick={()=>setScreenStatus(s)}><span>{s}</span><b>{counts[s]||0}</b>{i===0?<ListChecks/>:i===1?<AlertTriangle/>:<Clock/>}</button>)}</section>

    {screenStatus?<section className="card"><div className="head"><h2>Demandas {screenStatus}</h2><button onClick={()=>setScreenStatus(null)}>Voltar</button></div><div className="list">{demands.filter(d=>d.status===screenStatus).map(d=><DemandCard key={d.id} d={d} update={updateDemand} del={deleteDemand} post={postponeDemand} toggle={toggleChecklist}/>)}</div></section>:
    <section className="card"><div className="head"><div><h2><CalendarDays/> Calendário visual de atividades</h2><p>Clique no dia para cadastrar ou visualizar demandas.</p></div><div className="month"><button onClick={()=>setMonthDate(new Date(monthDate.getFullYear(),monthDate.getMonth()-1,1))}>◀</button><b>{monthDate.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</b><button onClick={()=>setMonthDate(new Date(monthDate.getFullYear(),monthDate.getMonth()+1,1))}>▶</button></div></div><div className="calendar-wrap"><div><div className="week">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><b key={d}>{d}</b>)}</div><div className="cal">{buildCalendarDays(monthDate).map((date,i)=>{const list=date?demands.filter(d=>d.date===date):[];return <button key={`${date}-${i}`} disabled={!date} className={`day ${date===selectedDate?'sel':''} ${!date?'empty':''}`} onClick={()=>{setSelectedDate(date!);setDemandForm(f=>({...f,date:date!,internal_deadline:date!,official_deadline:date!,overdue_date:date!}));setDayMode('view');setDayModal(true)}}><b>{date?Number(date.slice(8,10)):''}</b>{list.length>0&&<em>{list.length}</em>}{list.slice(0,3).map(d=><small key={d.id}>{d.title}</small>)}</button>})}</div></div><aside><h3>{selectedDate.split('-').reverse().join('/')}</h3><button onClick={()=>{setDayMode('create');setDayModal(true)}}><Plus/> Cadastrar demanda</button><button onClick={()=>{setDayMode('view');setDayModal(true)}}>Ver demandas do dia</button><p>{dayDemands.length} demandas neste dia.</p></aside></div></section>}

    <section className="grid2"><section className="card"><h2><UserPlus/> Cadastro de usuários</h2><div className="form">{['name','war_name','register','unit','email','phone','login'].map(k=><input key={k} placeholder={k} value={(userForm as any)[k]} onChange={e=>setUserForm({...userForm,[k]:e.target.value})}/>) }<input placeholder="Senha provisória" type="password" value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})}/><select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})}>{['Administrador','Gestor','Analista','Colaborador'].map(r=><option key={r}>{r}</option>)}</select><button onClick={createUser}>Cadastrar</button></div></section><section className="card"><h2><Users/> Usuários</h2><div className="list">{users.map(u=><div className="item" key={u.id}><div><b>{u.war_name||u.name}</b><p>{u.role} • {u.status} • {u.login}</p></div></div>)}</div></section></section>

    <section className="grid2"><section className="card"><h2><Filter/> Workflow das tarefas</h2><div className="inline"><input placeholder="Novo workflow" value={newWorkflow} onChange={e=>setNewWorkflow(e.target.value)}/><button onClick={()=>addWorkflowFromName(newWorkflow).then(()=>setNewWorkflow(''))}>Criar workflow</button></div><div className="workflow">{workflows.map((w,i)=><div className="step" key={w.id}><span>{i+1}</span><b>{w.name}</b></div>)}</div></section><section className="card process"><h2><LayoutDashboard/> Acompanhamento do processo</h2><select value={selectedProcess?.id||''} onChange={e=>setSelectedProcessId(e.target.value)}>{demands.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select><div className="plabel"><b>{progress}%</b><span>{selectedProcess?.title}</span></div><div className="progress"><div style={{width:`${progress}%`}}/></div><div className="workflow">{workflows.map((w,i)=><button key={w.id} className={`step click ${i<=stepIndex?'done':''}`} onClick={()=>setProcessStep(w)}><span>{i+1}</span><b>{w.name}</b></button>)}</div></section></section>
  </main>{dayModal&&<div className="modalbg"><section className="modal"><div className="mhead"><h2>{selectedDate.split('-').reverse().join('/')}</h2><div><button onClick={()=>setDayMode('create')}>Cadastrar</button><button onClick={()=>setDayMode('view')}>Ver</button><button onClick={()=>setDayModal(false)}>Fechar</button></div></div><div className="mbody">{dayMode==='create'?<div className="form demand"><input placeholder="Título" value={demandForm.title} onChange={e=>setDemandForm({...demandForm,title:e.target.value})}/><select value={demandForm.responsible_id} onChange={e=>setDemandForm({...demandForm,responsible_id:e.target.value})}><option value="">Responsável cadastrado</option>{activeUsers.map(u=><option key={u.id} value={u.id}>{u.war_name||u.name}</option>)}</select><select value={demandForm.type} onChange={e=>setDemandForm({...demandForm,type:e.target.value})}>{types.map(t=><option key={t}>{t}</option>)}</select><select value={demandForm.priority} onChange={e=>setDemandForm({...demandForm,priority:e.target.value})}>{priorities.map(p=><option key={p}>{p}</option>)}</select><label>Data<input type="date" value={demandForm.date} onChange={e=>setDemandForm({...demandForm,date:e.target.value})}/></label><label>Prazo interno<input type="date" value={demandForm.internal_deadline} onChange={e=>setDemandForm({...demandForm,internal_deadline:e.target.value})}/></label><label>Prazo oficial<input type="date" value={demandForm.official_deadline} onChange={e=>setDemandForm({...demandForm,official_deadline:e.target.value})}/></label><label>Data para atraso<input type="date" value={demandForm.overdue_date} onChange={e=>setDemandForm({...demandForm,overdue_date:e.target.value})}/></label><select value={demandForm.workflow_id} onChange={e=>setDemandForm({...demandForm,workflow_id:e.target.value})}>{workflows.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><input placeholder="Criar workflow do zero" value={demandForm.new_workflow} onChange={e=>setDemandForm({...demandForm,new_workflow:e.target.value})}/><textarea placeholder="Informações" value={demandForm.notes} onChange={e=>setDemandForm({...demandForm,notes:e.target.value})}/><button onClick={createDemand}>Salvar demanda</button></div>:<div className="list">{dayDemands.map(d=><DemandCard key={d.id} d={d} update={updateDemand} del={deleteDemand} post={postponeDemand} toggle={toggleChecklist}/>)}</div>}</div></section></div>}</div>
}

function DemandCard({d,update,del,post,toggle}:any){
 const pct=Math.round(((d.done||[]).filter(Boolean).length/(d.checklist||[]).length)*100)
 return <div className="dcard"><div className="dhead"><div><h3>{d.title}</h3><p>{d.notes}</p><p><b>Responsável:</b> {d.responsible?.war_name||d.responsible?.name} • <b>Workflow:</b> {d.workflow?.name}</p><p><b>Data para atraso:</b> {d.overdue_date||d.internal_deadline}</p></div><div><Badge tone={toneStatus(d.status)}>{d.status}</Badge><Badge tone={tonePriority(d.priority)}>{d.priority}</Badge></div></div><div className="plabel"><b>{pct}%</b><span>Checklist</span></div><div className="progress"><div style={{width:`${pct}%`}}/></div><div className="checks">{(d.checklist||[]).map((c:string,i:number)=><label key={c}><input type="checkbox" checked={d.done?.[i]||false} onChange={()=>toggle(d,i)}/>{c}</label>)}</div><div className="actions"><button onClick={()=>update(d.id,{status:'Concluída',done:(d.checklist||[]).map(()=>true)})}><Check/> Feita</button><button onClick={()=>update(d.id,{status:'A fazer'})}><RotateCcw/> Reabrir</button><button onClick={()=>update(d.id,{status:'Paralisada'})}>Paralisar</button><button onClick={()=>post(d)}><Clock/> Postergar</button><button className="danger" onClick={()=>del(d.id)}><Trash2/> Excluir</button></div></div>
}
