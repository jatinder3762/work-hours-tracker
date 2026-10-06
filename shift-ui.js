window.initShiftUI=()=>{
  const form=document.getElementById('shiftForm');
  const saveButton=document.getElementById('saveBtn');
  if(!form||!saveButton)return;
  const editor=$('shiftEditor'), action=$('shiftAction'), summary=$('selectedShiftSummary'), choices=$('shiftChoices');
  action.hidden=true;
  editor.hidden=false;
  let actionRequest=0;
  const displayDate=date=>dt(date).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  const selectedShifts=()=>current&&selected?shifts.filter(shift=>shift.workplaceId===current.id&&shift.date===selected):[];
  const updateSummary=()=>{
    const matches=selectedShifts();
    const times=[...matches].sort((a,b)=>a.start.localeCompare(b.start)).map(shift=>`${shift.start}–${shift.end}`).join(', ');
    summary.textContent=!selected?'Select a date to add or edit a shift.':matches.length?`${displayDate(selected)} • ${matches.reduce((total,shift)=>total+h(shift),0).toFixed(2)} h • ${matches.length} ${matches.length===1?'shift':'shifts'} • ${times}`:`${displayDate(selected)} • No shift recorded`;
  };
  const baseCancel=cancel;
  cancel=function(){actionRequest++;baseCancel();editor.hidden=false};
  const displayShift=(shift,locked=false)=>{
    baseCancel();
    form.hidden=false;
    form.querySelectorAll('input,select').forEach(field=>field.disabled=false);
    saveButton.hidden=false;
    saveButton.disabled=false;
    if(shift){
      editing=shift.id;
      $('date').value=shift.date;
      $('start').value=shift.start;
      $('end').value=shift.end;
      $('breakMin').value=shift.breakMin;
      $('formTitle').textContent=locked?'View paid shift':'Edit shift';
      saveButton.textContent='Update shift';
      msg(locked?'This shift is in a paid period. Unlock the period to edit it.':shift.rate==null?'Rate not assigned.':'Recorded rate: '+cash(shift.rate)+'/h');
    }else{
      $('date').value=selected||'';
      $('formTitle').textContent=selected?`Add shift · ${displayDate(selected)}`:'Select a date to add a shift';
    }
    if(locked||!selected){form.querySelectorAll('input,select').forEach(field=>field.disabled=true);saveButton.hidden=true}
    $('cancelEdit').hidden=false;
    $('cancelEdit').textContent='Reset form';
    choices.querySelectorAll('button').forEach(button=>button.classList.toggle('active',button.dataset.shiftId===shift?.id));
  };
  const paidOn=async date=>{
    const {data,error}=await sb.from('pay_periods').select('period_start').eq('workplace_id',current.id).eq('user_id',user.id).eq('paid',true).lte('period_start',date).gte('period_end',date).limit(1);
    if(error)throw error;
    return !!data?.length;
  };
  const updateEditor=async()=>{
    const workplaceId=current?.id,date=selected,token=++actionRequest;
    editor.hidden=false;
    updateSummary();
    choices.hidden=true;
    choices.replaceChildren();
    displayShift(null);
    if(!workplaceId||!date)return;
    const invalidDate=dateError(date);
    if(invalidDate){form.querySelectorAll('input,select').forEach(field=>field.disabled=true);saveButton.hidden=true;msg(invalidDate,true);return}
    form.querySelectorAll('input,select').forEach(field=>field.disabled=true);
    saveButton.disabled=true;
    msg('Checking pay status…');
    try{
      const locked=await paidOn(date);
      if(token!==actionRequest||current?.id!==workplaceId||selected!==date)return;
      const matches=selectedShifts().sort((a,b)=>a.start.localeCompare(b.start));
      if(matches.length>1){
        choices.hidden=false;
        matches.forEach(shift=>{
          const button=document.createElement('button');
          button.type='button';button.className='btn secondary shift-choice';
          button.dataset.shiftId=shift.id;
          button.textContent=`${shift.start}–${shift.end} • ${h(shift).toFixed(2)} h`;
          button.onclick=()=>displayShift(shift,locked);
          choices.appendChild(button);
        });
      }
      displayShift(matches[0],locked);
      if(locked&&!matches.length)msg('This date is in a paid period. Unlock the period before adding a shift.',true);
    }catch(error){
      if(token!==actionRequest||current?.id!==workplaceId||selected!==date)return;
      form.querySelectorAll('input,select').forEach(field=>field.disabled=true);
      saveButton.hidden=true;
      msg(error.message||'Unable to check the pay period. Try selecting the date again.',true);
    }
  };
  $('cancelEdit').onclick=()=>updateEditor();

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
  const monthName=date=>date.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  calendar=function(items){
    syncBounds();
    const container=$('calendar');
    container.replaceChildren();
    const shiftMap=new Map();
    items.forEach(shift=>{
      if(!shiftMap.has(shift.date))shiftMap.set(shift.date,[]);
      shiftMap.get(shift.date).push(shift);
    });
    const month=new Date(viewDate.getFullYear(),viewDate.getMonth(),1);
    let first=new Date(month),last=new Date(month.getFullYear(),month.getMonth()+1,0);
    const today=new Date(),range=period(current,today);
    const showingCurrentMonth=month.getFullYear()===today.getFullYear()&&month.getMonth()===today.getMonth();
    // Include the full current pay period without stacking or repeating months.
    if(showingCurrentMonth){
      if(range.start<day(first))first=dt(range.start);
      if(range.end>day(last))last=dt(range.end);
    }
    const gridStart=new Date(first.getFullYear(),first.getMonth(),first.getDate()-first.getDay());
    const gridEnd=new Date(last.getFullYear(),last.getMonth(),last.getDate()+6-last.getDay());
    const dates=[];
    for(let date=new Date(gridStart);date<=gridEnd;date.setDate(date.getDate()+1))dates.push(day(date));
    const weeks=dates.length/7;
    {
      const panel=document.createElement('section');panel.className='calendar-month';
      $('monthLabel').textContent=monthName(month);
      const context=document.createElement('p');context.className='calendar-period-context muted';
      context.textContent=showingCurrentMonth?`Full current pay period: ${displayDate(range.start)}–${displayDate(range.end)}`:'Weekly totals include all seven days, including dates from adjacent months.';
      panel.appendChild(context);
      const weekdays=document.createElement('div');weekdays.className='calendar-weekdays';
      ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(name=>{const label=document.createElement('span');label.textContent=name;weekdays.appendChild(label)});
      panel.appendChild(weekdays);
      for(let row=0;row<weeks;row++){
        const week=document.createElement('div');week.className='calendar-week';
        const weekItems=[];
        for(let column=0;column<7;column++){
          const date=dates[row*7+column];
          const daily=shiftMap.get(date)||[];
          weekItems.push(...daily);
          const cell=document.createElement('button');cell.type='button';cell.className='day';cell.dataset.date=date;
          if(date.slice(0,7)!==day(month).slice(0,7)){cell.classList.add('outside-month');if(showingCurrentMonth&&date>=range.start&&date<=range.end)cell.classList.add('in-current-period')}
          if(date===selected)cell.classList.add('selected');
          if(date===day(new Date()))cell.classList.add('today');
          const number=document.createElement('b');number.textContent=date.slice(0,7)===day(month).slice(0,7)?String(Number(date.slice(-2))):displayDate(date);cell.appendChild(number);
          cell.setAttribute('aria-pressed',String(date===selected));
          if(daily.length){
            const hours=document.createElement('span');hours.textContent=daily.reduce((sum,shift)=>sum+h(shift),0).toFixed(2)+' h';cell.appendChild(hours);
            const earnings=document.createElement('small');earnings.textContent=has(daily)?cash(total(daily)):'Rate needed';cell.appendChild(earnings);
          }
          const error=dateError(date);
          cell.title=error||`${dt(date).toLocaleDateString()}${daily.length?' • '+daily.reduce((sum,shift)=>sum+h(shift),0).toFixed(2)+' h • '+(has(daily)?cash(total(daily)):'Rate needed'):''}`;
          if(error)cell.disabled=true;
          cell.onclick=()=>{selected=date;calendar(items)};
          week.appendChild(cell);
        }
        const start=dates[row*7];
        const end=dates[row*7+6];
        const summary=document.createElement('div');summary.className='calendar-week-total';
        summary.textContent=`${displayDate(start)}–${displayDate(end)} · ${weekItems.reduce((sum,shift)=>sum+h(shift),0).toFixed(2)} h · ${weekItems.length?(has(weekItems)?cash(total(weekItems)):'Rate needed'):'—'}`;
        panel.append(week,summary);
      }
      container.appendChild(panel);
    }
    updateEditor();
  };

  $('prevMonth').setAttribute('aria-label','Previous month');
  $('nextMonth').setAttribute('aria-label','Next month');
  const currentPeriodButton=document.createElement('button');
  currentPeriodButton.type='button';currentPeriodButton.className='btn secondary';
  currentPeriodButton.id='currentPeriodBtn';currentPeriodButton.textContent='Current period';
  currentPeriodButton.onclick=()=>{$('todayBtn').click()};
  $('todayBtn').after(currentPeriodButton);

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
