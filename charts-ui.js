window.initChartUI=()=>{
  const monthKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const hours=list=>list.reduce((sum,shift)=>sum+h(shift),0);
  const colors=['#2962e8','#3878ed','#4c8eea','#13a8bc','#0e9c9f','#0a8d80','#08765d'];

  const dashboard=document.createElement('section');
  dashboard.id='hoursTrend';
  dashboard.className='card chart-card';
  dashboard.hidden=true;
  dashboard.innerHTML='<div class="chart-heading"><div><p class="eyebrow">WORK PATTERNS</p><h2>Hours over time</h2><p class="muted">All active workplaces · last six months</p></div></div><div class="month-chart" id="monthChart"></div>';
  document.querySelector('#dashboardView .period-card').insertAdjacentElement('afterend',dashboard);

  const workplace=document.createElement('section');
  workplace.id='weekdayChartCard';
  workplace.className='card chart-card weekday-card';
  workplace.hidden=true;
  workplace.innerHTML='<div class="chart-heading"><div><p class="eyebrow">CURRENT PAY PERIOD</p><h2>When you worked</h2><p class="muted">Hours by weekday</p></div></div><div class="weekday-content"><div class="weekday-donut" id="weekdayDonut"><div class="weekday-center"><strong id="weekdayTotal">0.00 h</strong><small>Total hours</small></div></div><div class="weekday-list" id="weekdayList"></div></div>';
  document.getElementById('paySummary').insertAdjacentElement('afterend',workplace);

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

  function renderWorkplaceChart(){
    if(!current){workplace.hidden=true;return}
    const range=period(current);
    const relevant=ws(current.id).filter(shift=>shift.date>=range.start&&shift.date<=range.end);
    workplace.hidden=!relevant.length;
    if(!relevant.length)return;
    const totals=Array.from({length:7},(_,weekday)=>hours(relevant.filter(shift=>dt(shift.date).getDay()===weekday)));
    const sum=totals.reduce((a,b)=>a+b,0);
    if(!sum){workplace.hidden=true;return}
    document.getElementById('weekdayTotal').textContent=`${sum.toFixed(2)} h`;
    const donut=document.getElementById('weekdayDonut');
    let offset=0;
    const slices=totals.map((value,index)=>{
      const from=offset;
      offset+=value/sum*100;
      return value?`${colors[index]} ${from}% ${offset}%`:null;
    }).filter(Boolean);
    donut.style.background=`conic-gradient(${slices.join(',')})`;
    donut.setAttribute('role','img');
    donut.setAttribute('aria-label','Current pay period: '+totals.map((value,index)=>`${new Date(2023,0,index+1).toLocaleDateString(undefined,{weekday:'long'})} ${value.toFixed(2)} hours`).join('; '));
    const legend=document.getElementById('weekdayList');
    legend.replaceChildren();
    totals.forEach((value,index)=>{
      if(!value)return;
      const row=document.createElement('div');
      row.className='weekday-row';
      const label=document.createElement('span');
      const dot=document.createElement('i');
      dot.style.background=colors[index];
      label.append(dot,document.createTextNode(new Date(2023,0,index+1).toLocaleDateString(undefined,{weekday:'long'})));
      const amount=document.createElement('strong');
      amount.textContent=`${value.toFixed(2)} h`;
      row.append(label,amount);
      legend.appendChild(row);
    });
  }

  const previousDash=renderDash;
  renderDash=function(){previousDash();renderDashboardChart()};
  const previousWork=renderWork;
  renderWork=function(){previousWork();renderWorkplaceChart()};
};
