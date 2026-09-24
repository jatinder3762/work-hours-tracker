window.initShiftUI=()=>{
  const form=document.getElementById('shiftForm');
  const saveButton=document.getElementById('saveBtn');
  if(!form||!saveButton)return;
  const editor=$('shiftEditor'), action=$('shiftAction'), summary=$('selectedShiftSummary'), choices=$('shiftChoices');
  const actionHome=action.parentElement;
  const mobileAction=document.createElement('div');
  mobileAction.className='mobile-shift-action';
  document.querySelector('.calendar-card .calendar-head').before(mobileAction);
  const mobileScreen=window.matchMedia('(max-width:720px)');
  const placeAction=()=>{(mobileScreen.matches?mobileAction:actionHome).appendChild(action)};
  mobileScreen.addEventListener('change',placeAction);
  placeAction();
  let actionRequest=0;
  const displayDate=date=>dt(date).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  const selectedShifts=()=>current&&selected?shifts.filter(shift=>shift.workplaceId===current.id&&shift.date===selected):[];
  const closeEditor=()=>{
    actionRequest++;
    editor.hidden=true;
    choices.hidden=true;
    choices.innerHTML='';
    form.hidden=false;
    form.querySelectorAll('input,select').forEach(field=>field.disabled=false);
    saveButton.hidden=false;
    action.setAttribute('aria-expanded','false');
  };
  const updateAction=()=>{
    const matches=selectedShifts();
    action.textContent=!selected?'＋ Add New Shift':matches.length>1?`View / Edit Shifts — ${displayDate(selected)}`:matches.length?`Edit Shift — ${displayDate(selected)}`:`＋ Add Shift — ${displayDate(selected)}`;
    const times=[...matches].sort((a,b)=>a.start.localeCompare(b.start)).map(shift=>`${shift.start}–${shift.end}`).join(', ');
    summary.textContent=!selected?'Select a date to add or edit a shift.':matches.length?`${displayDate(selected)} • ${matches.reduce((total,shift)=>total+h(shift),0).toFixed(2)} h • ${matches.length} ${matches.length===1?'shift':'shifts'} • ${times}`:`${displayDate(selected)} • No shift recorded`;
    if(selected&&matches.length){
      const date=selected,id=current.id;
      paidOn(date).then(locked=>{
        if(locked&&current?.id===id&&selected===date){
          action.textContent=`View ${matches.length===1?'Shift':'Shifts'} — ${displayDate(date)}`;
        }
      }).catch(()=>{});
    }
  };
  const showForm=(shift,locked=false)=>{
    cancel();
    editor.hidden=false;
    action.setAttribute('aria-expanded','true');
    if(shift){
      editing=shift.id;
      selected=shift.date;
      $('date').value=shift.date;
      $('start').value=shift.start;
      $('end').value=shift.end;
      $('breakMin').value=shift.breakMin;
      $('formTitle').textContent=locked?'View shift':'Edit shift';
      saveButton.textContent='Update shift';
      msg(locked?'This shift is in a paid period. Unlock the period to edit it.':shift.rate==null?'Rate not assigned.':'Recorded rate: '+cash(shift.rate)+'/h');
    }else{
      $('date').value=selected||day(new Date());
      $('formTitle').textContent='Add shift';
    }
    if(locked){form.querySelectorAll('input,select').forEach(field=>field.disabled=true);saveButton.hidden=true}
    $('cancelEdit').hidden=false;
    editor.scrollIntoView({behavior:'smooth',block:'nearest'});
  };
  const paidOn=async date=>{
    const {data,error}=await sb.from('pay_periods').select('period_start').eq('workplace_id',current.id).eq('user_id',user.id).eq('paid',true).lte('period_start',date).gte('period_end',date).limit(1);
    if(error)throw error;
    return !!data?.length;
  };
  action.onclick=async()=>{
    const workplaceId=current?.id,date=selected||day(new Date()),token=++actionRequest;
    action.disabled=true;action.classList.add('is-loading');
    try{
      const locked=await paidOn(date);
      if(token!==actionRequest||current?.id!==workplaceId||date!==(selected||day(new Date())))return;
      const matches=selectedShifts();
      if(locked&&!matches.length){msg('This date is in a paid period. Unlock the period before adding a shift.',true);return}
      if(matches.length>1){
        closeEditor();
        editor.hidden=false;form.hidden=true;choices.hidden=false;
        $('formTitle').textContent=locked?'View shifts':'Choose a shift to edit';
        matches.forEach(shift=>{
          const button=document.createElement('button');
          button.type='button';button.className='btn secondary shift-choice';
          button.textContent=`${shift.start}–${shift.end} • ${h(shift).toFixed(2)} h`;
          button.onclick=()=>showForm(shift,locked);
          choices.appendChild(button);
        });
        action.setAttribute('aria-expanded','true');
        editor.scrollIntoView({behavior:'smooth',block:'nearest'});
      }else showForm(matches[0],locked);
    }catch(error){msg(error.message||'Unable to check the pay period.',true)}
    finally{action.disabled=false;action.classList.remove('is-loading')}
  };
  const baseCancel=cancel;
  cancel=function(){baseCancel();closeEditor()};
  $('cancelEdit').onclick=cancel;

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
    updateAction();
  };

  const baseOpenWork=openWork;
  openWork=function(id){
    baseOpenWork(id);
    selected='';calendar(ws(current.id));
  };
  for(const id of ['prevMonth','nextMonth']){
    const button=$(id),baseClick=button.onclick;
    button.onclick=()=>{selected='';cancel();baseClick()};
  }
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
      msg(editingId?'Shift updated successfully.':'Shift saved successfully.');
    }catch(error){
      const saved=await verifyInterruptedSave({id:editingId,payload,startedAt});
      if(saved){
        cancel();
        try{await load()}catch(_error){}
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
