window.initShiftUI=()=>{
  const form=document.getElementById('shiftForm');
  const saveButton=document.getElementById('saveBtn');
  if(!form||!saveButton)return;

  const recentButton=document.createElement('button');
  recentButton.type='button';
  recentButton.id='recentToggle';
  recentButton.className='btn secondary';
  recentButton.textContent='Show recent shifts';
  recentButton.setAttribute('aria-expanded','false');
  recentButton.setAttribute('aria-controls','shiftList');
  document.querySelector('.shift-card .saved-title').appendChild(recentButton);
  $('shiftList').hidden=true;
  let recentOpen=false;
  let requestId=0;
  const startDate=()=>current?.pay_anchor_date||'';
  const dateError=(date,today=day(new Date()))=>{
    if(startDate()&&date<startDate())return `Shifts must be on or after the workplace start date (${dt(startDate()).toLocaleDateString()}).`;
    if(date>today)return 'Future shifts cannot be entered. Choose today or an earlier unpaid date.';
    return '';
  };
  const syncBounds=()=>{
    $('date').min=startDate();
    $('date').max=day(new Date());
  };
  const baseCalendar=calendar;
  calendar=function(items){
    syncBounds();
    baseCalendar(items);
    document.querySelectorAll('#calendar .day:not(.blank)').forEach(cell=>{
      const date=day(new Date(viewDate.getFullYear(),viewDate.getMonth(),Number(cell.querySelector('b').textContent)));
      if(dateError(date)){
        cell.disabled=true;
        cell.title=date>day(new Date())?'Future shifts cannot be entered.':'Before this workplace started.';
      }
    });
  };

  const renderRecent=items=>{
    const target=$('shiftList');
    target.innerHTML='';
    if(!items.length){target.innerHTML='<p class="muted">No shifts yet.</p>';return}
    const wrap=document.createElement('div');
    wrap.className='table-wrap';
    wrap.innerHTML='<table class="recent-table"><thead><tr><th>Date</th><th>Time</th><th>Hours</th><th>Gross</th><th>Actions</th></tr></thead><tbody></tbody></table>';
    const body=wrap.querySelector('tbody');
    items.forEach(shift=>{
      const row=document.createElement('tr');
      const gross=earn(shift);
      row.innerHTML=`<td>${dt(shift.date).toLocaleDateString()}</td><td>${safe(shift.start)}–${safe(shift.end)}<small>${shift.breakMin} min break</small></td><td>${h(shift).toFixed(2)} h</td><td>${gross==null?'—':cash(gross)}</td><td><div class="row-actions"><button type="button" class="btn secondary copy">Copy</button><button type="button" class="btn secondary edit">Edit</button><button type="button" class="btn secondary danger delete">Delete</button></div></td>`;
      row.querySelector('.copy').onclick=()=>{
        editing='';$('date').value=day(new Date());$('start').value=shift.start;$('end').value=shift.end;
        $('breakMin').value=shift.breakMin;$('formTitle').textContent='Copy shift';$('saveBtn').textContent='Save shift';$('cancelEdit').hidden=false;
        form.scrollIntoView({behavior:'smooth',block:'center'});
      };
      row.querySelector('.edit').onclick=()=>{
        editing=shift.id;selected=shift.date;$('date').value=shift.date;$('start').value=shift.start;
        $('end').value=shift.end;$('breakMin').value=shift.breakMin;$('formTitle').textContent='Edit shift';
        $('saveBtn').textContent='Update shift';$('cancelEdit').hidden=false;
        msg(shift.rate==null?'Rate not assigned.':'Recorded rate: '+cash(shift.rate)+'/h');
        form.scrollIntoView({behavior:'smooth',block:'center'});
      };
      row.querySelector('.delete').onclick=async function(){
        if(!confirm('Delete this shift?'))return;
        this.disabled=true;this.classList.add('is-loading');
        try{
          const {error}=await sb.from('shifts').delete().eq('id',shift.id).eq('user_id',user.id);
          if(error)throw error;
          await load();
          if(recentOpen)await fetchRecent();
        }catch(error){msg(error.message||'Unable to delete shift.',true)}
        finally{this.disabled=false;this.classList.remove('is-loading')}
      };
      body.appendChild(row);
    });
    target.appendChild(wrap);
  };
  const fetchRecent=async()=>{
    if(!recentOpen||!current||!user)return;
    const id=current.id,token=++requestId;
    recentButton.disabled=true;recentButton.classList.add('is-loading');
    $('shiftList').innerHTML='<div class="list-loading"><span class="spinner"></span> Loading shifts…</div>';
    $('shiftList').setAttribute('aria-busy','true');
    try{
      const {data,error}=await sb.from('shifts').select('*').eq('workplace_id',id).eq('user_id',user.id).order('shift_date',{ascending:false});
      if(error)throw error;
      if(token!==requestId||!recentOpen||current?.id!==id)return;
      renderRecent((data||[]).map(map));
    }catch(error){if(token===requestId&&recentOpen)$('shiftList').innerHTML='<p class="auth-error">'+safe(error.message||'Unable to load recent shifts.')+'</p>'}
    finally{if(token===requestId){recentButton.disabled=false;recentButton.classList.remove('is-loading');$('shiftList').removeAttribute('aria-busy')}}
  };
  list=function(){};
  const baseOpenWork=openWork;
  openWork=function(id){
    requestId++;recentOpen=false;$('shiftList').hidden=true;$('shiftList').innerHTML='';
    recentButton.textContent='Show recent shifts';recentButton.setAttribute('aria-expanded','false');
    baseOpenWork(id);
  };
  recentButton.onclick=async()=>{
    recentOpen=!recentOpen;
    $('shiftList').hidden=!recentOpen;
    recentButton.setAttribute('aria-expanded',String(recentOpen));
    recentButton.textContent=recentOpen?'Hide recent shifts':'Show recent shifts';
    if(recentOpen)await fetchRecent();else requestId++;
  };

  const friendlyShiftError=(error)=>{
    const message=String(error?.message||error||'').toLowerCase();
    if(message.includes('paid period'))return 'This shift belongs to a paid period. Unlock that pay period before changing it.';
    if(message.includes('jwt')||message.includes('session'))return 'Your session has expired. Sign out and sign in again.';
    if(message.includes('permission')||error?.code==='42501')return 'Your account does not have permission to save this shift.';
    if(message.includes('load failed')||message.includes('fetch')||message.includes('network'))return 'The connection was interrupted. We checked for the shift before allowing another save.';
    return error?.message||'The shift could not be saved. Please try again.';
  };

  const verifyInterruptedSave=async({id,payload,startedAt})=>{
    try{
      let query=sb.from('shifts').select('id').eq('user_id',user.id).eq('workplace_id',payload.workplace_id).eq('shift_date',payload.shift_date).eq('start_time',payload.start_time).eq('end_time',payload.end_time).eq('break_minutes',payload.break_minutes);
      query=id?query.eq('id',id):query.gte('created_at',startedAt);
      const {data,error}=await query.limit(1);
      return !error&&Array.isArray(data)&&data.length>0;
    }catch(_error){return false}
  };

  form.onsubmit=async(event)=>{
    event.preventDefault();
    if(!navigator.onLine){msg('You appear to be offline. Reconnect before saving this shift.',true);return;}
    if(!user||!current){msg('Your workplace session is not ready. Return to the dashboard and try again.',true);return;}

    const date=$('date').value;
    const start=$('start').value;
    const end=$('end').value;
    const breakMinutes=+$('breakMin').value;
    if(!date||!start||!end){msg('Enter the shift date, start time and end time.',true);return;}
    syncBounds();
    const invalidDate=dateError(date);
    if(invalidDate){msg(invalidDate,true);return}
    saveButton.disabled=true;
    saveButton.classList.add('is-loading');
    form.setAttribute('aria-busy','true');
    try{
      const {data:locked,error:periodError}=await sb.from('pay_periods').select('period_start').eq('workplace_id',current.id).eq('user_id',user.id).eq('paid',true).lte('period_start',date).gte('period_end',date).limit(1);
      if(periodError)throw periodError;
      if(locked?.length){msg('This date has already been paid. Unlock its pay period before changing shifts.',true);return}
    }catch(error){msg(error.message||'Unable to check whether this date has been paid.',true);return}
    finally{saveButton.disabled=false;saveButton.classList.remove('is-loading');form.removeAttribute('aria-busy')}

    const duplicate=shifts.some(shift=>shift.id!==editing&&shift.workplaceId===current.id&&shift.date===date&&shift.start===start&&shift.end===end&&shift.breakMin===breakMinutes);
    if(duplicate&&!confirm('This looks like a duplicate shift. Save anyway?'))return;

    const existing=shifts.find(shift=>shift.id===editing);
    const rate=existing&&existing.date===date?existing.rate:rf(current.id,date);
    const payload={user_id:user.id,workplace_id:current.id,shift_date:date,start_time:start,end_time:end,break_minutes:breakMinutes,hourly_rate_snapshot:rate};
    const editingId=editing;
    const startedAt=new Date(Date.now()-3000).toISOString();
    saveButton.disabled=true;
    saveButton.classList.add('is-loading');
    saveButton.textContent=editingId?'Updating…':'Saving…';
    form.setAttribute('aria-busy','true');
    msg('');

    try{
      const result=editingId?await sb.from('shifts').update(payload).eq('id',editingId).eq('user_id',user.id):await sb.from('shifts').insert(payload);
      if(result.error)throw result.error;
      cancel();
      await load();
      if(recentOpen)await fetchRecent();
      msg(editingId?'Shift updated successfully.':'Shift saved successfully.');
    }catch(error){
      const saved=await verifyInterruptedSave({id:editingId,payload,startedAt});
      if(saved){
        cancel();
        try{await load();if(recentOpen)await fetchRecent()}catch(_error){}
        msg(editingId?'Shift updated successfully.':'Shift saved successfully.');
      }else{
        msg(friendlyShiftError(error),true);
      }
    }finally{
      saveButton.disabled=false;
      saveButton.classList.remove('is-loading');
      if(editing===editingId)saveButton.textContent=editingId?'Update shift':'Save shift';
      form.removeAttribute('aria-busy');
    }
  };
};
