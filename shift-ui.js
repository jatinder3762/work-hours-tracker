window.initShiftUI=()=>{
  const form=document.getElementById('shiftForm');
  const saveButton=document.getElementById('saveBtn');
  if(!form||!saveButton)return;

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

    const duplicate=shifts.some(shift=>shift.id!==editing&&shift.workplaceId===current.id&&shift.date===date&&shift.start===start&&shift.end===end&&shift.breakMin===breakMinutes);
    if(duplicate&&!confirm('This looks like a duplicate shift. Save anyway?'))return;

    const existing=shifts.find(shift=>shift.id===editing);
    const rate=existing&&existing.date===date?existing.rate:rf(current.id,date);
    const payload={user_id:user.id,workplace_id:current.id,shift_date:date,start_time:start,end_time:end,break_minutes:breakMinutes,hourly_rate_snapshot:rate};
    const editingId=editing;
    const startedAt=new Date(Date.now()-3000).toISOString();
    saveButton.disabled=true;
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
      if(editing===editingId)saveButton.textContent=editingId?'Update shift':'Save shift';
      form.removeAttribute('aria-busy');
    }
  };
};
