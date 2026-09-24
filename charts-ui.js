window.initChartUI=()=>{
  const monthKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const hours=list=>list.reduce((sum,shift)=>sum+h(shift),0);

  const dashboard=document.createElement('section');
  dashboard.id='hoursTrend';
  dashboard.className='card chart-card';
  dashboard.hidden=true;
  dashboard.innerHTML='<div class="chart-heading"><div><p class="eyebrow">WORK PATTERNS</p><h2>Hours over time</h2><p class="muted">All active workplaces · last six months</p></div></div><div class="month-chart" id="monthChart"></div>';
  document.querySelector('#dashboardView .period-card').insertAdjacentElement('afterend',dashboard);

  const monthOverview=document.createElement('section');
  monthOverview.id='calendarOverview';
  monthOverview.className='calendar-overview';
  monthOverview.hidden=true;
  monthOverview.innerHTML='<div class="calendar-overview-head"><div><p class="eyebrow">MONTH AT A GLANCE</p><h3 id="overviewRange"></h3></div><div class="overview-totals"><div><small>Hours worked</small><strong id="overviewHours"></strong></div><div><small>Estimated gross</small><strong id="overviewEarnings"></strong></div></div></div><div id="dailyBars" class="daily-bars"></div><div id="dailyTicks" class="daily-ticks" aria-hidden="true"></div><p id="overviewHint" class="overview-hint" hidden></p>';
  document.getElementById('calendar').insertAdjacentElement('afterend',monthOverview);

  function renderDashboardChart(){
    const active=new Set(works.filter(work=>!work.archived).map(work=>work.id));
    const recorded=shifts.filter(shift=>active.has(shift.workplaceId));
    dashboard.hidden=!recorded.length;
    if(!recorded.length)return;
    const now=new Date(),months=Array.from({length:6},(_,index)=>new Date(now.getFullYear(),now.getMonth()-5+index,1));
    const values=months.map(date=>hours(recorded.filter(shift=>shift.date.slice(0,7)===monthKey(date))));
    const max=Math.max(1,...values);
    const chart=document.getElementById('monthChart');
    chart.replaceChildren();
    chart.setAttribute('role','img');
    chart.setAttribute('aria-label','Hours worked by month: '+months.map((date,index)=>`${date.toLocaleDateString(undefined,{month:'long',year:'numeric'})} ${values[index].toFixed(2)} hours`).join('; '));
    months.forEach((date,index)=>{
      const item=document.createElement('div');
      item.className='month-item';
      const value=document.createElement('strong');
      value.textContent=values[index]?`${values[index].toFixed(1)} h`:'0 h';
      const track=document.createElement('div');
      track.className='month-track';
      const bar=document.createElement('span');
      bar.className='month-bar';
      bar.style.height=values[index]?`${Math.max(5,values[index]/max*100)}%`:'0';
      track.appendChild(bar);
      const label=document.createElement('small');
      label.textContent=date.toLocaleDateString(undefined,{month:'short'});
      item.append(value,track,label);
      chart.appendChild(item);
    });
  }

  function renderMonthOverview(){
    if(!current){monthOverview.hidden=true;return}
    monthOverview.hidden=false;
    const year=viewDate.getFullYear(),month=viewDate.getMonth(),count=new Date(year,month+1,0).getDate();
    const relevant=ws(current.id).filter(shift=>shift.date.slice(0,7)===monthKey(viewDate));
    const daily=Array.from({length:count},()=>0);
    relevant.forEach(shift=>{daily[Number(shift.date.slice(8))-1]+=h(shift)});
    const max=Math.max(1,...daily),bars=document.getElementById('dailyBars'),ticks=document.getElementById('dailyTicks');
    bars.replaceChildren();ticks.replaceChildren();
    bars.style.setProperty('--day-count',count);
    ticks.style.setProperty('--day-count',count);
    document.getElementById('overviewRange').textContent=`${viewDate.toLocaleDateString(undefined,{month:'short'})} 1–${count}`;
    document.getElementById('overviewHours').textContent=`${hours(relevant).toFixed(2)} h`;
    document.getElementById('overviewEarnings').textContent=has(relevant)?cash(total(relevant)):'—';
    const hint=document.getElementById('overviewHint');
    hint.hidden=!!relevant.length&&has(relevant);
    hint.textContent=relevant.length?'Add a pay rate to see complete estimated earnings.':'No shifts recorded this month.';
    bars.setAttribute('role','img');
    bars.setAttribute('aria-label',`${viewDate.toLocaleDateString(undefined,{month:'long',year:'numeric'})} hours by day: ${daily.map((value,index)=>value?`${index+1}: ${value.toFixed(2)} hours`:null).filter(Boolean).join('; ')||'no hours recorded'}`);
    daily.forEach((value,index)=>{
      const column=document.createElement('span');
      column.className='daily-column'+(day(new Date(year,month,index+1))===selected?' is-selected':'');
      const bar=document.createElement('span');
      bar.className='daily-bar';
      bar.style.height=value?`${Math.max(5,value/max*100)}%`:'0';
      column.appendChild(bar);
      bars.appendChild(column);
      const tick=document.createElement('small');
      if(index===0||index===7||index===14||index===21||index===count-1)tick.textContent=String(index+1);
      ticks.appendChild(tick);
    });
  }

  const previousDash=renderDash;
  renderDash=function(){previousDash();renderDashboardChart()};
  const previousCalendar=calendar;
  calendar=function(items){previousCalendar(items);renderMonthOverview()};
};
