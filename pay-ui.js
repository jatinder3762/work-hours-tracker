window.initPayPeriodUI=()=>{
  const formatDate=value=>dt(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  const formatRange=(start,end)=>`${formatDate(start)}${start.slice(0,4)===end.slice(0,4)?'':' '+start.slice(0,4)} – ${dt(end).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;
  const periodLabel=work=>`${freq(work.pay_frequency)} pay period`;
  const statusButtons=item=>`<div class="pay-status-toggle" role="group" aria-label="Payment status for ${formatRange(item.period_start,item.period_end)}"><button type="button" class="btn pay-status-choice ${item.paid?'':'is-unpaid'}" data-paid="false" aria-pressed="${!item.paid}">Unpaid</button><button type="button" class="btn pay-status-choice ${item.paid?'is-paid':''}" data-paid="true" aria-pressed="${!!item.paid}">Paid</button></div>`;
  const periodShifts=(work,range)=>ws(work.id).filter(shift=>shift.date>=range.start&&shift.date<=range.end);
  const shiftHours=list=>list.reduce((sum,shift)=>sum+h(shift),0);
  const sharePeriod=window.createPeriodSharing({h,dt,formatRange});
  const buildPeriodHistory=(work,shiftDates,savedPeriods,currentRange)=>{
    // Only paid records retain their historical boundaries. Unpaid rows are regenerated
    // from the workplace's current schedule so a changed week start cannot count hours twice.
    const paid=savedPeriods.filter(item=>item.paid);
    const ranges=new Map(paid.map(item=>[`${item.period_start}|${item.period_end}`,item]));
    const addRange=range=>{
      const key=`${range.start}|${range.end}`;
      if(ranges.has(key))return;
      if(paid.some(item=>item.period_start<=range.end&&item.period_end>=range.start))return;
      ranges.set(key,{period_start:range.start,period_end:range.end,paid:false});
    };
    addRange(currentRange);
    shiftDates.forEach(date=>addRange(period(work,dt(date))));
    const dates=shiftDates.concat(paid.map(item=>item.period_start));
    if(dates.length){
      const oldest=period(work,dt(dates.sort()[0])).start;
      const step=work.pay_frequency==='monthly'?null:work.pay_frequency==='weekly'?7:14;
      let cursor=currentRange.start;
      for(let index=0;index<520&&cursor>=oldest;index++){
        addRange(period(work,dt(cursor)));
        cursor=step?fromUtcDay(utcDay(cursor)-step):day(new Date(dt(cursor).getFullYear(),dt(cursor).getMonth()-1,1));
        if(!step)cursor=period(work,dt(cursor)).start;
      }
    }
    return [...ranges.values()].sort((a,b)=>b.period_start.localeCompare(a.period_start));
  };
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
  anchorInput.insertAdjacentHTML('afterend','<small class="muted">This is the earliest date you can enter a shift for this workplace. Choose an earlier date if you need to add previous unpaid weeks.</small>');
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
    const saveButton=$('workForm').querySelector('.modal-actions button:last-child');
    if(saveButton.disabled)return;
    const id=$('workId').value;
    const previous=works.find(work=>work.id===id);
    const next={...previous,pay_frequency:$('payFrequency').value,pay_anchor_date:anchorInput.value||null};
    const note=$('periodSettingsNote');
    note.textContent='';
    if(!next.pay_anchor_date){note.textContent='Choose the workplace start date before saving.';return}
    if(next.pay_frequency!=='monthly'&&dt(next.pay_anchor_date).getDay()!==+$('weekStart').value){
      note.textContent='Choose a start day and a matching first pay-period date.';return;
    }
    saveButton.disabled=true;saveButton.classList.add('is-loading');
    saveButton.setAttribute('aria-busy','true');
    try{
    if(previous&&(previous.pay_frequency!==next.pay_frequency||previous.pay_anchor_date!==next.pay_anchor_date)){
      const {data,error}=await sb.from('pay_periods').select('period_start,period_end').eq('workplace_id',id).eq('paid',true);
      if(error){note.textContent=error.message||'Unable to check paid history.';return}
      if((data||[]).some(saved=>{const range=period(next,dt(saved.period_start));return range.start!==saved.period_start||range.end!==saved.period_end})){
        note.textContent='This change would move an already paid period. Unlock affected periods before changing the pay schedule.';return;
      }
    }
    return await baseWorkSubmit(event);
    }catch(error){note.textContent=error.message||'Unable to save workplace.'}
    finally{saveButton.disabled=false;saveButton.classList.remove('is-loading');saveButton.removeAttribute('aria-busy')}
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

    const currentAction=$('currentPeriodAction');
    currentAction.disabled=true;
    currentAction.classList.add('is-loading');
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
    finally{if(current?.id===workplaceId){currentAction.disabled=false;currentAction.classList.remove('is-loading')}}
  };

  async function markCurrentPaid(){
    if(!current)return;
    if(this.dataset.paid==='true'){$('payBtn').click();return;}
    const range=period(current);
    const list=periodShifts(current,range);
    if(!list.length){msg('Add at least one shift before marking this period paid.',true);return;}
    if(!confirm(`Mark ${formatDate(range.start)} – ${formatDate(range.end)} as paid and lock its shifts?`))return;
    this.disabled=true;this.classList.add('is-loading');this.textContent='Saving…';
    try{
      const {error}=await sb.from('pay_periods').upsert({user_id:user.id,workplace_id:current.id,period_start:range.start,period_end:range.end,paid:true,paid_at:new Date().toISOString()},{onConflict:'workplace_id,period_start,period_end'});
      if(error)throw error;
      await updateWorkSummary();
      if(!$('historyContent').hidden)await renderPay();
      msg('Pay period marked paid. Its shifts are now locked.');
    }catch(error){msg(error.message||'Unable to mark this period paid.',true)}finally{this.disabled=false;this.classList.remove('is-loading')}
  }

  const baseRenderDash=renderDash;
  renderDash=function(){
    baseRenderDash();
    document.querySelectorAll('#workplaces .work-card').forEach(card=>{
      card.setAttribute('role','button');card.tabIndex=0;
      card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();card.click()}};
    });
    enhanceDashboard();
  };
  const baseRenderWork=renderWork;
  renderWork=function(){baseRenderWork();updateWorkSummary();if(!$('historyContent').hidden)renderPay()};

  const history=document.createElement('section');
  history.id='periodHistory';
  history.className='card period-history';
  history.innerHTML='<div class="card-head"><div><p class="eyebrow">PAY HISTORY</p><h2>Weeks and pay periods</h2></div><button type="button" id="historyToggle" class="btn secondary" aria-expanded="false" aria-controls="historyContent">Show periods</button></div><div id="historyContent" hidden><p class="muted">Choose the week start in Workplace settings. Select Paid after you receive payment. Switching back to Unpaid requires your account password.</p><div class="table-wrap"><table><thead><tr><th>Period</th><th>Dates</th><th>Worked hours</th><th>Estimated gross</th><th>Status / share</th></tr></thead><tbody id="periodRows"></tbody></table></div><button type="button" id="historyMore" class="btn secondary" hidden>Show earlier periods</button></div>';
  ensureSummary().insertAdjacentElement('afterend',history);
  let visiblePeriods=12;
  $('historyToggle').onclick=async function(){
    $('historyContent').hidden=!$('historyContent').hidden;
    $('historyToggle').setAttribute('aria-expanded',String(!$('historyContent').hidden));
    $('historyToggle').textContent=$('historyContent').hidden?'Show periods':'Hide periods';
    if(!$('historyContent').hidden){this.disabled=true;this.classList.add('is-loading');try{await renderPay()}finally{this.disabled=false;this.classList.remove('is-loading')}}
  };
  $('historyMore').onclick=async function(){visiblePeriods+=12;this.disabled=true;this.classList.add('is-loading');try{await renderPay()}finally{this.disabled=false;this.classList.remove('is-loading')}};
  const basePayClick=$('payBtn').onclick;
  $('payBtn').onclick=async function(){
    if(this.disabled)return;
    this.disabled=true;this.classList.add('is-loading');
    try{await basePayClick()}finally{this.disabled=false;this.classList.remove('is-loading')}
  };

  renderPay=async function(){
    if(!current)return;
    const workplaceId=current.id;
    if(!$('payModal').hidden)$('payPeriods').innerHTML='<div class="list-loading"><span class="spinner"></span> Loading pay periods…</div>';
    if(!$('historyContent').hidden)$('periodRows').innerHTML='<tr><td colspan="5"><span class="spinner"></span> Loading pay periods…</td></tr>';
    let data,error;
    try{({data,error}=await sb.from('pay_periods').select('*').eq('workplace_id',workplaceId).order('period_start',{ascending:false}))}
    catch(cause){error=cause}
    if(!current||current.id!==workplaceId)return;
    if(error){$('payPeriods').innerHTML='<p class="auth-error">Unable to load pay periods.</p>';$('periodRows').innerHTML='<tr><td colspan="5">Unable to load pay periods.</td></tr>';return}
    const periods=buildPeriodHistory(current,ws(workplaceId).map(shift=>shift.date),data||[],period(current));
    $('payPeriods').innerHTML='';
    $('periodRows').innerHTML='';
    $('historyMore').hidden=periods.length<=visiblePeriods;
    if(!periods.length)$('periodRows').innerHTML='<tr><td colspan="5">No pay periods yet.</td></tr>';
    periods.slice(0,Math.max(visiblePeriods,24)).forEach((item,index)=>{
      const list=ws(workplaceId).filter(shift=>shift.date>=item.period_start&&shift.date<=item.period_end);
      const work=current;
      const row=document.createElement('div');
      row.className='shift pay-period-row';
      row.innerHTML=`<div><strong>${formatRange(item.period_start,item.period_end)}</strong><small>${shiftHours(list).toFixed(2)} h${has(list)?' • '+cash(total(list)):''} • ${periodLabel(work)}</small></div><div class="period-row-controls">${statusButtons(item)}<button type="button" class="btn secondary period-share-action">↗ Share</button></div>`;
      const onAction=async(button,markPaid)=>{
        if(markPaid===!!item.paid)return;
        const buttons=button.closest('.pay-status-toggle').querySelectorAll('button');
        buttons.forEach(choice=>choice.disabled=true);
        button.classList.add('is-loading');
        try{
        if(!markPaid){
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
        }catch(error){alert(error.message||'Unable to update pay status.')}
        finally{buttons.forEach(choice=>choice.disabled=false);button.classList.remove('is-loading')}
      };
      const bindChoices=container=>container.querySelectorAll('.pay-status-choice').forEach(button=>{button.onclick=function(){onAction(this,this.dataset.paid==='true')}});
      bindChoices(row);
      const bindShare=container=>{container.querySelector('.period-share-action').onclick=function(){sharePeriod({work,range:item,shifts:list,button:this})}};
      bindShare(row);
      if(index<24)$('payPeriods').appendChild(row);
      if(index<visiblePeriods){
        const tableRow=document.createElement('tr');
        tableRow.innerHTML=`<td data-label="Period">${index+1}</td><td data-label="Dates">${formatRange(item.period_start,item.period_end)}</td><td data-label="Worked hours">${shiftHours(list).toFixed(2)} h</td><td data-label="Estimated gross">${has(list)?cash(total(list)):'—'}</td><td data-label="Status / share"><div class="period-row-controls">${statusButtons(item)}<button type="button" class="btn secondary period-share-action">↗ Share</button></div></td>`;
        bindChoices(tableRow);
        bindShare(tableRow);
        $('periodRows').appendChild(tableRow);
      }
    });
  };

  ensureSummary();
  if(current)updateWorkSummary();
};
