window.initPayPeriodUI=()=>{
  const formatDate=value=>dt(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  const periodLabel=work=>`${freq(work.pay_frequency)} pay period`;
  const periodShifts=(work,range)=>ws(work.id).filter(shift=>shift.date>=range.start&&shift.date<=range.end);
  const shiftHours=list=>list.reduce((sum,shift)=>sum+h(shift),0);
  const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const utcDay=value=>Date.UTC(+value.slice(0,4),+value.slice(5,7)-1,+value.slice(8,10))/86400000;
  const fromUtcDay=value=>new Date(value*86400000).toISOString().slice(0,10);
  const basePeriod=period;
  period=function(work,date=new Date()){
    if(work.pay_frequency==='monthly'||!work.pay_anchor_date)return basePeriod(work,date);
    const length=work.pay_frequency==='weekly'?7:14;
    const anchor=utcDay(work.pay_anchor_date);
    const target=utcDay(day(date));
    const start=anchor+Math.floor((target-anchor)/length)*length;
    return{start:fromUtcDay(start),end:fromUtcDay(start+length-1)};
  };

  const weekSelect=document.createElement('label');
  weekSelect.id='weekStartLabel';
  weekSelect.innerHTML='<span>Week starts on</span><select id="weekStart">'+weekdays.map((name,index)=>`<option value="${index}">${name}</option>`).join('')+'</select><small id="weekEndNote" class="muted"></small>';
  $('anchorLabel').insertAdjacentElement('beforebegin',weekSelect);
  $('workForm').querySelector('.modal-actions').insertAdjacentHTML('beforebegin','<p id="periodSettingsNote" class="auth-error" role="alert"></p>');
  const anchorInput=$('payAnchor');
  const syncWeekFields=()=>{
    const weekly=$('payFrequency').value!=='monthly';
    weekSelect.hidden=!weekly;
    $('anchorLabel').firstChild.textContent=weekly?'First pay-period start date':'Monthly pay-period start date';
    if(!weekly)return;
    const chosen=anchorInput.value?dt(anchorInput.value).getDay():1;
    $('weekStart').value=String(chosen);
    $('weekEndNote').textContent=`Ends ${weekdays[(chosen+6)%7]}. Bi-weekly periods span two weeks.`;
  };
  const baseWorkModal=workModal;
  workModal=function(work){baseWorkModal(work);$('periodSettingsNote').textContent='';syncWeekFields()};
  $('payFrequency').addEventListener('change',syncWeekFields);
  anchorInput.addEventListener('change',syncWeekFields);
  $('weekStart').addEventListener('change',()=>{
    const chosen=+$('weekStart').value;
    const reference=anchorInput.value?dt(anchorInput.value):new Date();
    reference.setDate(reference.getDate()-((reference.getDay()-chosen+7)%7));
    anchorInput.value=day(reference);
    syncWeekFields();
  });
  const baseWorkSubmit=$('workForm').onsubmit;
  $('workForm').onsubmit=async event=>{
    event.preventDefault();
    const id=$('workId').value;
    const previous=works.find(work=>work.id===id);
    const next={...previous,pay_frequency:$('payFrequency').value,pay_anchor_date:anchorInput.value||null};
    const note=$('periodSettingsNote');
    note.textContent='';
    if(next.pay_frequency!=='monthly'&&(!next.pay_anchor_date||dt(next.pay_anchor_date).getDay()!==+$('weekStart').value)){
      note.textContent='Choose a start day and a matching first pay-period date.';return;
    }
    if(previous&&(previous.pay_frequency!==next.pay_frequency||previous.pay_anchor_date!==next.pay_anchor_date)){
      const {data,error}=await sb.from('pay_periods').select('period_start,period_end').eq('workplace_id',id).eq('paid',true);
      if(error){note.textContent=error.message||'Unable to check paid history.';return}
      if((data||[]).some(saved=>{const range=period(next,dt(saved.period_start));return range.start!==saved.period_start||range.end!==saved.period_end})){
        note.textContent='This change would move an already paid period. Unlock affected periods before changing the pay schedule.';return;
      }
    }
    return baseWorkSubmit(event);
  };

  const ensureSummary=()=>{
    let summary=document.getElementById('paySummary');
    if(summary)return summary;
    summary=document.createElement('section');
    summary.id='paySummary';
    summary.className='card pay-summary';
    summary.innerHTML='<div class="pay-summary-head"><div><p class="eyebrow">PAY SUMMARY</p><h2 id="currentPeriodDates">Current pay period</h2><span id="currentPeriodStatus" class="badge warning">Unpaid</span></div><button id="currentPeriodAction" class="btn primary">Mark Paid</button></div><div class="pay-summary-grid"><div><small>Paid hours</small><strong id="paidHoursTotal">0.00 h</strong></div><div><small>Paid earnings</small><strong id="paidEarningsTotal">CA$0.00</strong></div><div><small>All-time hours</small><strong id="allTimeHoursTotal">0.00 h</strong></div><div><small>All-time earnings</small><strong id="allTimeEarningsTotal">CA$0.00</strong></div></div>';
    document.querySelector('#workplaceView .stats')?.insertAdjacentElement('afterend',summary);
    document.getElementById('currentPeriodAction').onclick=markCurrentPaid;
    return summary;
  };

  const enhanceDashboard=async()=>{
    const cards=[...document.querySelectorAll('#workplaces .work-card')];
    if(!cards.length)return;
    const used=new Set();
    const matches=[];
    cards.forEach(card=>{
      const name=card.querySelector('h3')?.textContent;
      const work=works.find(item=>!used.has(item.id)&&item.name===name);
      if(!work)return;
      used.add(work.id);
      const range=period(work);
      const list=periodShifts(work,range);
      const metrics=card.querySelectorAll('.metric');
      if(metrics[0]){metrics[0].querySelector('strong').textContent=shiftHours(list).toFixed(2)+' h';metrics[0].querySelector('small').textContent='CURRENT PERIOD'}
      if(metrics[1]){metrics[1].querySelector('strong').textContent=has(list)?cash(total(list)):'—';metrics[1].querySelector('small').textContent='CURRENT EARNINGS'}
      const meta=card.querySelector('.meta');
      if(meta)meta.innerHTML=`${periodLabel(work)} · ${formatDate(range.start)}–${formatDate(range.end)} <span class="badge period-card-status warning">Unpaid</span>`;
      matches.push({work,range,card});
    });
    try{
      const {data}=await sb.from('pay_periods').select('workplace_id,period_start,period_end,paid').eq('paid',true);
      matches.forEach(({work,range,card})=>{
        const paid=(data||[]).some(item=>item.workplace_id===work.id&&item.period_start===range.start&&item.period_end===range.end);
        const badge=card.querySelector('.period-card-status');
        if(paid){badge.textContent='Paid';badge.className='badge period-card-status success'}
      });
    }catch(_error){}
  };

  const updateWorkSummary=async()=>{
    if(!current)return;
    ensureSummary();
    const workplaceId=current.id;
    const range=period(current);
    const all=ws(workplaceId);
    const currentList=periodShifts(current,range);
    const hoursLabel=$('workHours')?.previousElementSibling;
    const earningsLabel=$('workEarn')?.previousElementSibling;
    if(hoursLabel)hoursLabel.textContent='Current period hours';
    if(earningsLabel)earningsLabel.textContent='Current period earnings';
    $('workHours').textContent=shiftHours(currentList).toFixed(2)+' h';
    $('workEarn').textContent=has(currentList)?cash(total(currentList)):'—';
    $('workFreq').textContent=freq(current.pay_frequency);
    $('currentPeriodDates').textContent=`${formatDate(range.start)} – ${formatDate(range.end)}`;
    $('allTimeHoursTotal').textContent=shiftHours(all).toFixed(2)+' h';
    $('allTimeEarningsTotal').textContent=has(all)?cash(total(all)):'—';

    try{
      const {data,error}=await sb.from('pay_periods').select('*').eq('workplace_id',workplaceId).eq('paid',true);
      if(error)throw error;
      if(!current||current.id!==workplaceId)return;
      const paidPeriods=data||[];
      const paidList=all.filter(shift=>paidPeriods.some(item=>shift.date>=item.period_start&&shift.date<=item.period_end));
      $('paidHoursTotal').textContent=shiftHours(paidList).toFixed(2)+' h';
      $('paidEarningsTotal').textContent=has(paidList)?cash(total(paidList)):'—';
      const isPaid=paidPeriods.some(item=>item.period_start===range.start&&item.period_end===range.end);
      const badge=$('currentPeriodStatus');
      const action=$('currentPeriodAction');
      badge.textContent=isPaid?'Paid':'Unpaid';
      badge.className='badge '+(isPaid?'success':'warning');
      action.textContent=isPaid?'View Paid Period':'Mark Paid';
      action.className='btn '+(isPaid?'secondary':'primary');
      action.dataset.paid=String(isPaid);
    }catch(error){msg(error.message||'Unable to load pay status.',true)}
  };

  async function markCurrentPaid(){
    if(!current)return;
    if(this.dataset.paid==='true'){$('payBtn').click();return;}
    const range=period(current);
    const list=periodShifts(current,range);
    if(!list.length){msg('Add at least one shift before marking this period paid.',true);return;}
    if(!confirm(`Mark ${formatDate(range.start)} – ${formatDate(range.end)} as paid and lock its shifts?`))return;
    this.disabled=true;this.textContent='Saving…';
    try{
      const {error}=await sb.from('pay_periods').upsert({user_id:user.id,workplace_id:current.id,period_start:range.start,period_end:range.end,paid:true,paid_at:new Date().toISOString()},{onConflict:'workplace_id,period_start,period_end'});
      if(error)throw error;
      await updateWorkSummary();
      if(!$('historyContent').hidden)await renderPay();
      msg('Pay period marked paid. Its shifts are now locked.');
    }catch(error){msg(error.message||'Unable to mark this period paid.',true)}finally{this.disabled=false}
  }

  const baseRenderDash=renderDash;
  renderDash=function(){baseRenderDash();enhanceDashboard()};
  const baseRenderWork=renderWork;
  renderWork=function(){baseRenderWork();updateWorkSummary();if(!$('historyContent').hidden)renderPay()};

  const history=document.createElement('section');
  history.id='periodHistory';
  history.className='card period-history';
  history.innerHTML='<div class="card-head"><div><p class="eyebrow">PAY HISTORY</p><h2>Weeks and pay periods</h2></div><button type="button" id="historyToggle" class="btn secondary" aria-expanded="false" aria-controls="historyContent">Show periods</button></div><div id="historyContent" hidden><p class="muted">Choose the week start in Workplace settings. Mark a period paid after its shifts have been paid.</p><div class="table-wrap"><table><thead><tr><th>Period</th><th>Dates</th><th>Worked hours</th><th>Estimated gross</th><th>Status</th><th>Action</th></tr></thead><tbody id="periodRows"></tbody></table></div><button type="button" id="historyMore" class="btn secondary" hidden>Show earlier periods</button></div>';
  ensureSummary().insertAdjacentElement('afterend',history);
  let visiblePeriods=12;
  $('historyToggle').onclick=()=>{
    $('historyContent').hidden=!$('historyContent').hidden;
    $('historyToggle').setAttribute('aria-expanded',String(!$('historyContent').hidden));
    $('historyToggle').textContent=$('historyContent').hidden?'Show periods':'Hide periods';
    if(!$('historyContent').hidden)renderPay();
  };
  $('historyMore').onclick=()=>{visiblePeriods+=12;renderPay()};

  renderPay=async function(){
    if(!current)return;
    const workplaceId=current.id;
    const {data,error}=await sb.from('pay_periods').select('*').eq('workplace_id',workplaceId).order('period_start',{ascending:false});
    if(!current||current.id!==workplaceId)return;
    if(error){$('payPeriods').innerHTML='<p class="auth-error">Unable to load pay periods.</p>';$('periodRows').innerHTML='<tr><td colspan="6">Unable to load pay periods.</td></tr>';return}
    const saved=new Map((data||[]).map(item=>[`${item.period_start}|${item.period_end}`,item]));
    const ranges=new Map(saved);
    const now=period(current);
    if(!ranges.has(`${now.start}|${now.end}`))ranges.set(`${now.start}|${now.end}`,{period_start:now.start,period_end:now.end,paid:false});
    ws(workplaceId).forEach(shift=>{
      const range=period(current,dt(shift.date));
      const key=`${range.start}|${range.end}`;
      const overlapsPaid=(data||[]).some(item=>item.paid&&item.period_start<=range.end&&item.period_end>=range.start);
      if(!ranges.has(key)&&!overlapsPaid)ranges.set(key,{period_start:range.start,period_end:range.end,paid:false});
    });
    const dates=ws(workplaceId).map(shift=>shift.date).concat((data||[]).map(item=>item.period_start));
    if(dates.length){
      const oldest=period(current,dt(dates.sort()[0])).start;
      const step=current.pay_frequency==='monthly'?null:current.pay_frequency==='weekly'?7:14;
      let cursor=now.start;
      for(let index=0;index<520&&cursor>=oldest;index++){
        const range=period(current,dt(cursor));
        const overlapsPaid=(data||[]).some(item=>item.paid&&item.period_start<=range.end&&item.period_end>=range.start);
        const key=`${range.start}|${range.end}`;
        if(!ranges.has(key)&&!overlapsPaid)ranges.set(key,{period_start:range.start,period_end:range.end,paid:false});
        cursor=step?fromUtcDay(utcDay(cursor)-step):day(new Date(dt(cursor).getFullYear(),dt(cursor).getMonth()-1,1));
        if(!step)cursor=period(current,dt(cursor)).start;
      }
    }
    const periods=[...ranges.values()].sort((a,b)=>b.period_start.localeCompare(a.period_start));
    $('payPeriods').innerHTML='';
    $('periodRows').innerHTML='';
    $('historyMore').hidden=periods.length<=visiblePeriods;
    if(!periods.length)$('periodRows').innerHTML='<tr><td colspan="6">No pay periods yet.</td></tr>';
    periods.slice(0,Math.max(visiblePeriods,24)).forEach((item,index)=>{
      const list=ws(workplaceId).filter(shift=>shift.date>=item.period_start&&shift.date<=item.period_end);
      const row=document.createElement('div');
      row.className='shift pay-period-row';
      row.innerHTML=`<div><strong>${formatDate(item.period_start)} – ${formatDate(item.period_end)}</strong><small>${shiftHours(list).toFixed(2)} h${has(list)?' • '+cash(total(list)):''} • ${periodLabel(current)}</small></div><button class="btn ${item.paid?'success':'warning'}">${item.paid?'Paid · Unlock':'Mark Paid'}</button>`;
      const onAction=async button=>{
        button.disabled=true;
        try{
        if(item.paid){
          const accountPassword=prompt('Enter your account password to unlock this pay period:');
          if(!accountPassword)return;
          const {error:authError}=await sb.auth.signInWithPassword({email:user.email,password:accountPassword});
          if(authError){alert('Incorrect password.');return}
          const {error:updateError}=await sb.from('pay_periods').update({paid:false,paid_at:null}).eq('workplace_id',workplaceId).eq('period_start',item.period_start).eq('period_end',item.period_end).eq('user_id',user.id);
          if(updateError){alert(updateError.message);return}
        }else{
          if(!list.length){alert('Add at least one shift before marking this period paid.');return}
          if(!confirm('Mark this period paid and lock its shifts?'))return;
          const {error:saveError}=await sb.from('pay_periods').upsert({user_id:user.id,workplace_id:workplaceId,period_start:item.period_start,period_end:item.period_end,paid:true,paid_at:new Date().toISOString()},{onConflict:'workplace_id,period_start,period_end'});
          if(saveError){alert(saveError.message);return}
        }
        await renderPay();await updateWorkSummary();enhanceDashboard();
        }finally{button.disabled=false}
      };
      row.querySelector('button').onclick=function(){onAction(this)};
      if(index<24)$('payPeriods').appendChild(row);
      if(index<visiblePeriods){
        const tableRow=document.createElement('tr');
        tableRow.innerHTML=`<td>${index+1}</td><td>${formatDate(item.period_start)} – ${formatDate(item.period_end)}</td><td>${shiftHours(list).toFixed(2)} h</td><td>${has(list)?cash(total(list)):'—'}</td><td><span class="badge ${item.paid?'success':'warning'}">${item.paid?'Paid':'Unpaid'}</span></td><td><button type="button" class="btn ${item.paid?'secondary':'primary'}">${item.paid?'Unlock':'Mark Paid'}</button></td>`;
        tableRow.querySelector('button').onclick=function(){onAction(this)};
        $('periodRows').appendChild(tableRow);
      }
    });
  };

  ensureSummary();
  if(current)updateWorkSummary();
};
