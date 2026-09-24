window.initPayPeriodUI=()=>{
  const formatDate=value=>dt(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  const formatRange=(start,end)=>`${formatDate(start)}${start.slice(0,4)===end.slice(0,4)?'':' '+start.slice(0,4)} – ${dt(end).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;
  const periodLabel=work=>`${freq(work.pay_frequency)} pay period`;
  const payStatus=item=>item.paid?'paid':+item.amount_received>0?'partial':'unpaid';
  const statusName=item=>item.paid?'Paid':+item.amount_received>0?'Partially paid':'Unpaid';
  const statusButtons=item=>{
    const selected=payStatus(item);
    return `<div class="pay-status-toggle" role="group" aria-label="Payment status for ${formatRange(item.period_start,item.period_end)}">${[['unpaid','Unpaid'],['partial','Partial'],['paid','Paid']].map(([value,label])=>`<button type="button" class="btn pay-status-choice ${selected===value?'is-'+value:''}" data-status="${value}" aria-pressed="${selected===value}">${label}</button>`).join('')}</div>`;
  };
  const periodShifts=(work,range)=>ws(work.id).filter(shift=>shift.date>=range.start&&shift.date<=range.end);
  const shiftHours=list=>list.reduce((sum,shift)=>sum+h(shift),0);
  const partialProgress=(list,amount)=>{
    const hours=shiftHours(list),gross=total(list);
    const valid=list.length>0&&list.every(shift=>shift.rate!=null&&shift.rate>0)&&gross>0;
    const covered=valid?Math.min(hours,Math.max(0,hours*(+amount||0)/gross)):0;
    return{valid,hours,gross,covered,pending:Math.max(0,hours-covered)};
  };
  const sharePeriod=window.createPeriodSharing({h,dt,formatRange});
  const buildPeriodHistory=(work,shiftDates,savedPeriods,currentRange)=>{
    // Preserve paid and partially paid ranges. Regenerate untouched unpaid rows
    // from the current schedule so old week anchors cannot count shifts twice.
    const recorded=savedPeriods.filter(item=>item.paid||+item.amount_received>0);
    const ranges=new Map(recorded.map(item=>[`${item.period_start}|${item.period_end}`,item]));
    const addRange=range=>{
      const key=`${range.start}|${range.end}`;
      if(ranges.has(key))return;
      if(recorded.some(item=>item.period_start<=range.end&&item.period_end>=range.start))return;
      ranges.set(key,{period_start:range.start,period_end:range.end,paid:false});
    };
    addRange(currentRange);
    shiftDates.forEach(date=>addRange(period(work,dt(date))));
    const dates=shiftDates.concat(recorded.map(item=>item.period_start));
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
      const {data,error}=await sb.from('pay_periods').select('*').eq('workplace_id',id);
      if(error){note.textContent=error.message||'Unable to check paid history.';return}
      if((data||[]).some(saved=>{
        if(!saved.paid&&!(+saved.amount_received>0))return false;
        const range=period(next,dt(saved.period_start));
        return range.start!==saved.period_start||range.end!==saved.period_end;
      })){
        note.textContent='This change would move a period with recorded payment. Clear or unlock that period before changing the pay schedule.';return;
      }
    }
    return await baseWorkSubmit(event);
    }catch(error){note.textContent=error.message||'Unable to save workplace.'}
    finally{saveButton.disabled=false;saveButton.classList.remove('is-loading');saveButton.removeAttribute('aria-busy')}
  };

  let currentPeriodRecord=null;
  let calendarStatusWorkId=null;
  let calendarStatusRows=[];
  let calendarStatusLoaded=false;
  const calendarLegend=document.createElement('div');
  calendarLegend.className='calendar-pay-legend';
  calendarLegend.hidden=true;
  calendarLegend.setAttribute('aria-label','Pay period colours');
  calendarLegend.innerHTML='<span><i class="legend-paid" aria-hidden="true"></i>Paid</span><span><i class="legend-partial" aria-hidden="true"></i>Partially paid</span><span><i class="legend-current" aria-hidden="true"></i>Current period</span><small>Colours show pay periods, not worked shifts.</small>';
  document.querySelector('.calendar-card .calendar-head').before(calendarLegend);
  const baseStatusCalendar=calendar;
  const calendarPayStatus=(date,rows,range,today)=>{
    const saved=rows.filter(item=>date>=item.period_start&&date<=item.period_end);
    if(saved.some(item=>item.paid))return 'paid';
    if(saved.some(item=>+item.amount_received>0))return 'partial';
    return date>=range.start&&date<=range.end&&date<=today?'current':null;
  };
  const paintCalendarStatus=()=>{
    calendarLegend.hidden=!current||!calendarStatusLoaded||calendarStatusWorkId!==current.id;
    if(calendarLegend.hidden){document.querySelectorAll('#calendar .day').forEach(cell=>{cell.classList.remove('pay-day-paid','pay-day-partial','pay-day-current');cell.removeAttribute('aria-label');if(cell.dataset.baseTitle!==undefined)cell.title=cell.dataset.baseTitle});return}
    const currentRange=period(current),today=day(new Date());
    document.querySelectorAll('#calendar .day:not(.blank)').forEach(cell=>{
      const number=Number(cell.querySelector('b')?.textContent);
      if(!number)return;
      const date=day(new Date(viewDate.getFullYear(),viewDate.getMonth(),number));
      const status=calendarPayStatus(date,calendarStatusRows,currentRange,today);
      cell.classList.remove('pay-day-paid','pay-day-partial','pay-day-current');
      if(status)cell.classList.add('pay-day-'+status);
      const label=status==='paid'?'Fully paid period':status==='partial'?'Partially paid period':status==='current'?'Current pay period':null;
      if(cell.dataset.baseTitle===undefined)cell.dataset.baseTitle=cell.title;
      cell.title=[cell.dataset.baseTitle,label].filter(Boolean).join(' • ');
      if(label){
        const worked=cell.querySelector('span')?.textContent;
        cell.setAttribute('aria-label',[dt(date).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}),worked?`${worked} worked`:null,label].filter(Boolean).join(', '));
      }else cell.removeAttribute('aria-label');
    });
  };
  calendar=function(items){
    if(current?.id!==calendarStatusWorkId){calendarStatusWorkId=current?.id||null;calendarStatusRows=[];calendarStatusLoaded=false}
    baseStatusCalendar(items);
    paintCalendarStatus();
  };
  let choiceContext=null;
  const choiceModal=document.createElement('div');
  choiceModal.id='paymentChoiceModal';
  choiceModal.className='modal';
  choiceModal.hidden=true;
  choiceModal.innerHTML='<div class="card modal-card payment-choice-card"><p class="eyebrow">RECORD PAYMENT</p><h2 id="choiceDates">Pay period</h2><p class="muted">Choose how much of this period has been paid.</p><div class="payment-choices"><button type="button" id="chooseFullPayment" class="btn primary">Fully paid</button><button type="button" id="choosePartialPayment" class="btn secondary">Partially paid</button></div><form id="partialPaymentForm" class="form" hidden><label>Total amount received so far (CAD)<input id="partialAmount" type="number" min="0.01" step="0.01" inputmode="decimal" required></label><p id="partialEstimate" class="partial-estimate muted"></p><p class="muted payment-disclaimer">Hours are estimated from recorded gross rates. Paycheck deductions can change the amount received. Partial payment keeps the period open.</p><button id="savePartialPayment" class="btn primary wide">Record partial payment</button></form><p id="paymentChoiceError" class="auth-error" role="alert" hidden></p><div class="modal-actions"><button type="button" id="cancelPaymentChoice" class="btn secondary">Cancel</button></div></div>';
  document.body.appendChild(choiceModal);
  const closeChoice=()=>{choiceModal.hidden=true;choiceContext=null;$('partialPaymentForm').hidden=true;$('paymentChoiceError').hidden=true};
  $('cancelPaymentChoice').onclick=closeChoice;
  choiceModal.onclick=event=>{if(event.target===choiceModal)closeChoice()};
  const choiceError=message=>{$('paymentChoiceError').textContent=message;$('paymentChoiceError').hidden=false};
  const refreshPaymentViews=async()=>{await Promise.all([renderPay(),updateWorkSummary()]);enhanceDashboard()};
  const openPaymentChoice=(item,list,work,showPartial=false)=>{
    choiceContext={item,list,work};
    $('choiceDates').textContent=formatRange(item.period_start,item.period_end);
    $('partialAmount').value=+item.amount_received>0?(+item.amount_received).toFixed(2):'';
    $('partialPaymentForm').hidden=true;$('paymentChoiceError').hidden=true;
    choiceModal.hidden=false;
    if(showPartial)$('choosePartialPayment').click();
  };
  const updatePartialEstimate=()=>{
    if(!choiceContext)return;
    const info=partialProgress(choiceContext.list,+$('partialAmount').value);
    $('partialEstimate').textContent=info.valid?`Estimated paid ${info.covered.toFixed(2)} h · Pending ${info.pending.toFixed(2)} h of ${info.hours.toFixed(2)} h`:'Each shift needs a positive hourly rate before paid hours can be calculated.';
  };
  $('partialAmount').oninput=updatePartialEstimate;
  $('choosePartialPayment').onclick=async function(){
    if(!choiceContext)return;
    if(!partialProgress(choiceContext.list,0).valid){choiceError('Add a positive rate to every shift before recording a partial payment.');return}
    this.disabled=true;this.classList.add('is-loading');
    try{
      const {error}=await sb.from('pay_periods').select('amount_received').limit(1);
      if(error){choiceError('Partial payments need the new Supabase database migration before they can be saved.');return}
      $('paymentChoiceError').hidden=true;$('partialPaymentForm').hidden=false;updatePartialEstimate();
      $('partialAmount').focus();
    }catch(error){choiceError(error.message||'Unable to check partial payments.')}
    finally{this.disabled=false;this.classList.remove('is-loading')}
  };
  $('chooseFullPayment').onclick=async function(){
    if(!choiceContext)return;
    const {item,list,work}=choiceContext;
    if(!list.length){choiceError('Add at least one shift before marking this period fully paid.');return}
    if(!confirm(`Have all ${shiftHours(list).toFixed(2)} hours been fully paid? This will lock the entire period.`))return;
    this.disabled=true;this.classList.add('is-loading');
    try{
      const payload={user_id:user.id,workplace_id:work.id,period_start:item.period_start,period_end:item.period_end,paid:true,paid_at:new Date().toISOString()};
      if(+item.amount_received>0)payload.amount_received=+item.amount_received;
      const {error}=await sb.from('pay_periods').upsert(payload,{onConflict:'workplace_id,period_start,period_end'});
      if(error)throw error;
      closeChoice();await refreshPaymentViews();
      msg('Period marked fully paid. Its shifts are now locked.');
    }catch(error){choiceError(error.message||'Unable to mark this period fully paid.')}
    finally{this.disabled=false;this.classList.remove('is-loading')}
  };
  $('partialPaymentForm').onsubmit=async event=>{
    event.preventDefault();
    if(!choiceContext)return;
    const {item,list,work}=choiceContext,info=partialProgress(list,+$('partialAmount').value);
    const amount=+$('partialAmount').value;
    if(!Number.isFinite(amount)||amount<=0||!info.valid){choiceError('Enter a valid amount and make sure every shift has a positive rate.');return}
    if(amount>=info.gross){choiceError('This covers the estimated full period. Choose Fully paid once all hours are confirmed paid.');return}
    const button=$('savePartialPayment');button.disabled=true;button.classList.add('is-loading');
    try{
      const {error}=await sb.from('pay_periods').upsert({user_id:user.id,workplace_id:work.id,period_start:item.period_start,period_end:item.period_end,paid:false,paid_at:null,amount_received:Math.round(amount*100)/100},{onConflict:'workplace_id,period_start,period_end'});
      if(error)throw error;
      closeChoice();await refreshPaymentViews();
      msg(`Partial payment recorded. Estimated ${info.covered.toFixed(2)} h covered; ${info.pending.toFixed(2)} h pending.`);
    }catch(error){choiceError(error.message||'Unable to record partial payment.')}
    finally{button.disabled=false;button.classList.remove('is-loading')}
  };

  const ensureSummary=()=>{
    let summary=document.getElementById('paySummary');
    if(summary)return summary;
    summary=document.createElement('section');
    summary.id='paySummary';
    summary.className='card pay-summary';
    summary.innerHTML='<div class="pay-summary-head"><div><p class="eyebrow">PAY SUMMARY</p><h2 id="currentPeriodDates">Current pay period</h2><span id="currentPeriodStatus" class="badge warning">Unpaid</span></div><button id="currentPeriodAction" class="btn primary">Record payment</button></div><div class="pay-summary-grid"><div><small>Paid hours (estimated)</small><strong id="paidHoursTotal">0.00 h</strong></div><div><small>Current pending hours</small><strong id="pendingHoursTotal">0.00 h</strong></div><div><small>Fully paid earnings (est.)</small><strong id="paidEarningsTotal">CA$0.00</strong></div><div><small>All-time hours</small><strong id="allTimeHoursTotal">0.00 h</strong></div><div><small>All-time earnings</small><strong id="allTimeEarningsTotal">CA$0.00</strong></div></div>';
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
      const {data}=await sb.from('pay_periods').select('*');
      matches.forEach(({work,range,card})=>{
        const item=(data||[]).find(row=>row.workplace_id===work.id&&row.period_start===range.start&&row.period_end===range.end);
        const badge=card.querySelector('.period-card-status');
        if(item){badge.textContent=statusName(item);badge.className='badge period-card-status '+(item.paid?'success':+item.amount_received>0?'partial':'warning')}
      });
    }catch(_error){}
  };

  let summaryRequest=0;
  const updateWorkSummary=async()=>{
    if(!current)return;
    const requestId=++summaryRequest;
    ensureSummary();
    const workplaceId=current.id;
    const range=period(current);
    const all=ws(workplaceId);
    const currentList=periodShifts(current,range);
    let rateHelp=document.getElementById('rateHelp');
    if(!rateHelp){
      rateHelp=document.createElement('div');
      rateHelp.id='rateHelp';
      rateHelp.className='rate-help';
      rateHelp.innerHTML='<div><strong>Earnings need an hourly rate</strong><p>Some saved shifts have no rate. Add a rate effective on or before those shifts, then choose to apply it to unrated shifts.</p></div><button type="button" class="btn primary">Add hourly rate</button>';
      document.querySelector('#workplaceView .stats')?.insertAdjacentElement('beforebegin',rateHelp);
      rateHelp.querySelector('button').onclick=()=>{$('workSettings').click();$('addRate').click()};
    }
    rateHelp.hidden=!all.some(shift=>shift.rate==null)||!all.length;
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
      const {data,error}=await sb.from('pay_periods').select('*').eq('workplace_id',workplaceId);
      if(error)throw error;
      if(!current||current.id!==workplaceId||requestId!==summaryRequest)return;
      const periods=data||[];
      calendarStatusWorkId=workplaceId;
      calendarStatusRows=periods;
      calendarStatusLoaded=true;
      paintCalendarStatus();
      const paidPeriods=periods.filter(item=>item.paid);
      const partialPeriods=periods.filter(item=>!item.paid&&+item.amount_received>0);
      const paidList=all.filter(shift=>paidPeriods.some(item=>shift.date>=item.period_start&&shift.date<=item.period_end));
      const partialHours=partialPeriods.reduce((sum,item)=>sum+partialProgress(all.filter(shift=>shift.date>=item.period_start&&shift.date<=item.period_end),item.amount_received).covered,0);
      $('paidHoursTotal').textContent=(shiftHours(paidList)+partialHours).toFixed(2)+' h';
      $('paidEarningsTotal').textContent=has(paidList)?cash(total(paidList)):'—';
      currentPeriodRecord=periods.find(item=>item.period_start===range.start&&item.period_end===range.end)||null;
      const currentCovered=currentPeriodRecord?.paid?shiftHours(currentList):partialProgress(currentList,currentPeriodRecord?.amount_received).covered;
      $('pendingHoursTotal').textContent=Math.max(0,shiftHours(currentList)-currentCovered).toFixed(2)+' h';
      const isPaid=!!currentPeriodRecord?.paid;
      const badge=$('currentPeriodStatus');
      const action=$('currentPeriodAction');
      badge.textContent=statusName(currentPeriodRecord||{});
      badge.className='badge '+(isPaid?'success':+currentPeriodRecord?.amount_received>0?'partial':'warning');
      action.textContent=isPaid?'View Paid Period':+currentPeriodRecord?.amount_received>0?'Manage payment':'Record payment';
      action.className='btn '+(isPaid?'secondary':'primary');
      action.dataset.paid=String(isPaid);
    }catch(error){if(requestId===summaryRequest){calendarStatusLoaded=false;paintCalendarStatus();msg(error.message||'Unable to load pay status.',true)}}
    finally{if(current?.id===workplaceId&&requestId===summaryRequest){currentAction.disabled=false;currentAction.classList.remove('is-loading')}}
  };

  async function markCurrentPaid(){
    if(!current)return;
    if(this.dataset.paid==='true'){$('payBtn').click();return;}
    const range=period(current);
    const list=periodShifts(current,range);
    if(!list.length){msg('Add at least one shift before marking this period paid.',true);return;}
    openPaymentChoice(currentPeriodRecord||{period_start:range.start,period_end:range.end,paid:false,amount_received:0},list,current);
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
  let browsingCalendar=false;
  for(const id of ['prevMonth','nextMonth','todayBtn']){
    const button=$(id),previousClick=button.onclick;
    button.onclick=function(...args){browsingCalendar=true;try{return previousClick.apply(this,args)}finally{browsingCalendar=false}};
  }
  renderWork=function(){baseRenderWork();if(!browsingCalendar){updateWorkSummary();if(!$('historyContent').hidden)renderPay()}};

  const history=document.createElement('section');
  history.id='periodHistory';
  history.className='card period-history';
  history.innerHTML='<div class="card-head"><div><p class="eyebrow">PAY HISTORY</p><h2>Weeks and pay periods</h2></div><button type="button" id="historyToggle" class="btn secondary" aria-expanded="false" aria-controls="historyContent">Show periods</button></div><div id="historyContent" hidden><p class="muted">Select Paid to choose full or partial payment. Only fully paid periods lock their shifts. Returning a fully paid period to Unpaid requires your account password.</p><div class="table-wrap"><table><thead><tr><th>Period</th><th>Dates</th><th>Worked hours</th><th>Estimated gross</th><th>Status / share</th></tr></thead><tbody id="periodRows"></tbody></table></div><button type="button" id="historyMore" class="btn secondary" hidden>Show earlier periods</button></div>';
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
      const progress=partialProgress(list,item.amount_received);
      const detail=!item.paid&&+item.amount_received>0?`${cash(+item.amount_received)} received · ${progress.covered.toFixed(2)} h est. covered · ${progress.pending.toFixed(2)} h pending`:'';
      const row=document.createElement('div');
      row.className='shift pay-period-row';
      row.innerHTML=`<div><strong>${formatRange(item.period_start,item.period_end)}</strong><small>${shiftHours(list).toFixed(2)} h${has(list)?' • '+cash(total(list)):''} • ${periodLabel(work)}</small>${detail?`<small class="partial-detail">${detail}</small>`:''}</div><div class="period-row-controls">${statusButtons(item)}<button type="button" class="btn secondary period-share-action">↗ Share</button></div>`;
      const onAction=async(button,target)=>{
        if(target==='paid'){if(!item.paid)openPaymentChoice(item,list,work);return}
        if(target==='partial'){
          if(item.paid){alert('Unlock this fully paid period first.');return}
          openPaymentChoice(item,list,work,true);return;
        }
        if(payStatus(item)==='unpaid')return;
        const buttons=button.closest('.pay-status-toggle').querySelectorAll('button');
        buttons.forEach(choice=>choice.disabled=true);
        button.classList.add('is-loading');
        try{
        if(item.paid){
          const accountPassword=prompt('Enter your account password to unlock this pay period:');
          if(!accountPassword)return;
          const {error:authError}=await sb.auth.signInWithPassword({email:user.email,password:accountPassword});
          if(authError){alert('Incorrect password.');return}
        }else{
          if(!confirm('Clear the recorded partial payment and mark this period Unpaid?'))return;
        }
        const changes={paid:false,paid_at:null};
        if(+item.amount_received>0)changes.amount_received=0;
        const {error:updateError}=await sb.from('pay_periods').update(changes).eq('workplace_id',workplaceId).eq('period_start',item.period_start).eq('period_end',item.period_end).eq('user_id',user.id);
        if(updateError)throw updateError;
        await refreshPaymentViews();
        }catch(error){alert(error.message||'Unable to update pay status.')}
        finally{buttons.forEach(choice=>choice.disabled=false);button.classList.remove('is-loading')}
      };
      const bindChoices=container=>container.querySelectorAll('.pay-status-choice').forEach(button=>{button.onclick=function(){onAction(this,this.dataset.status)}});
      bindChoices(row);
      const bindShare=container=>{container.querySelector('.period-share-action').onclick=function(){sharePeriod({work,range:item,shifts:list,button:this})}};
      bindShare(row);
      if(index<24)$('payPeriods').appendChild(row);
      if(index<visiblePeriods){
        const tableRow=document.createElement('tr');
        tableRow.innerHTML=`<td data-label="Period">${index+1}</td><td data-label="Dates">${formatRange(item.period_start,item.period_end)}</td><td data-label="Worked hours">${shiftHours(list).toFixed(2)} h${detail?`<small class="partial-detail">${detail}</small>`:''}</td><td data-label="Estimated gross">${has(list)?cash(total(list)):'—'}</td><td data-label="Status / share"><div class="period-row-controls">${statusButtons(item)}<button type="button" class="btn secondary period-share-action">↗ Share</button></div></td>`;
        bindChoices(tableRow);
        bindShare(tableRow);
        $('periodRows').appendChild(tableRow);
      }
    });
  };

  ensureSummary();
  if(current)updateWorkSummary();
};
