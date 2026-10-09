window.createPeriodSharing=({h,dt,formatRange})=>{
  const modal=document.createElement('div');
  modal.id='sharePeriodModal';
  modal.className='modal';
  modal.hidden=true;
  modal.innerHTML='<div class="card modal-card share-period-card"><div class="card-head"><div><p class="eyebrow">PERIOD REPORT</p><h2>Share your work</h2></div><button type="button" id="closePeriodShare" class="btn secondary" aria-label="Close share preview">Close</button></div><p class="muted">Review the image before choosing who receives it.</p><img id="periodSharePreview" alt="Preview of selected pay period report"><div class="share-period-actions"><button type="button" id="sendPeriodImage" class="btn primary">Share image</button><a id="downloadPeriodImage" class="btn secondary" download>Download PNG</a></div><p class="muted share-period-tip">On iPhone, you can also touch and hold the image to save it.</p></div>';
  document.body.appendChild(modal);
  let imageUrl='';
  let imageFile=null;
  const close=()=>{
    modal.hidden=true;
    $('periodSharePreview').removeAttribute('src');
    $('downloadPeriodImage').removeAttribute('href');
    if(imageUrl)URL.revokeObjectURL(imageUrl);
    imageUrl='';imageFile=null;
  };
  $('closePeriodShare').onclick=close;
  modal.onclick=event=>{if(event.target===modal)close()};
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden)close()});
  $('sendPeriodImage').onclick=async function(){
    if(!imageFile||!navigator.share)return;
    this.disabled=true;this.classList.add('is-loading');
    try{await navigator.share({files:[imageFile],title:'Work period report'})}
    catch(error){if(error.name!=='AbortError')alert('Sharing was unavailable. Download the image instead.')}
    finally{this.disabled=false;this.classList.remove('is-loading')}
  };

  const makeImage=async(work,range,shifts,earlier=[])=>{
    const theme=getComputedStyle(document.documentElement);
    const color=token=>theme.getPropertyValue('--'+token).trim();
    const grouped=new Map();
    shifts.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)).forEach(shift=>{
      if(!grouped.has(shift.date))grouped.set(shift.date,[]);
      grouped.get(shift.date).push(shift);
    });
    const days=[...grouped.entries()];
    const rowCount=Math.max(1,days.length);
    const amount=list=>list.every(shift=>shift.rate!=null&&Number.isFinite(+shift.rate))
      ?Math.round(list.reduce((sum,shift)=>sum+h(shift)*+shift.rate,0)*100)/100:null;
    const earnings=amount(shifts),received=Math.max(0,+range.amount_received||0);
    const pending=range.paid?0:earnings==null?null:Math.max(0,Math.round((earnings-received)*100)/100);
    const earlierPending=earlier.some(item=>item.pending==null)?null:Math.round(earlier.reduce((sum,item)=>sum+item.pending,0)*100)/100;
    const combined=pending==null||earlierPending==null?null:Math.round((pending+earlierPending)*100)/100;
    const money=value=>value==null?'Unavailable':new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',currencyDisplay:'code'}).format(value).replace('CAD','CA$');
    const priorHeight=100+earlier.length*54;
    const currentTop=(earlier.length?364+priorHeight:344)+39;
    const dailyTop=currentTop+239,footerY=dailyTop+49+rowCount*45;
    const width=760,height=footerY+55;
    const canvas=document.createElement('canvas');
    canvas.width=width*2;canvas.height=height*2;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('This browser cannot create the report image.');
    ctx.scale(2,2);
    const rounded=(x,y,w,height,r,color)=>{
      ctx.fillStyle=color;
      ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
      ctx.lineTo(x+w,y+height-r);ctx.quadraticCurveTo(x+w,y+height,x+w-r,y+height);
      ctx.lineTo(x+r,y+height);ctx.quadraticCurveTo(x,y+height,x,y+height-r);
      ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.fill();
    };
    const write=(value,x,y,font,color,maxWidth)=>{
      ctx.font=font;ctx.fillStyle=color;
      let label=String(value||'');
      if(maxWidth&&ctx.measureText(label).width>maxWidth){
        while(label.length>1&&ctx.measureText(label+'…').width>maxWidth)label=label.slice(0,-1);
        label+='…';
      }
      ctx.fillText(label,x,y);
    };
    const hours=shifts.reduce((sum,shift)=>sum+h(shift),0);
    ctx.fillStyle=color('brand-soft');ctx.fillRect(0,0,width,height);
    rounded(28,26,width-56,height-52,28,color('surface'));
    const gradient=ctx.createLinearGradient(48,48,712,195);
    gradient.addColorStop(0,color('brand'));gradient.addColorStop(1,color('brand'));
    rounded(48,46,width-96,158,21,gradient);
    rounded(72,72,50,50,14,color('surface'));
    write('M',84,109,'bold 31px Arial, sans-serif',color('brand'));
    write('MY TRACKER  /  WORK PERIOD',140,90,'bold 16px Arial, sans-serif',color('line'));
    write(work.name,140,137,'bold 29px Arial, sans-serif',color('surface'),535);
    write('Personal work log',140,171,'17px Arial, sans-serif',color('line'));

    rounded(64,228,632,116,17,color('brand'));
    write('TOTAL PENDING',82,260,'bold 15px Arial, sans-serif',color('surface'));
    write(money(combined),82,315,'bold 42px Arial, sans-serif',color('surface'),350);
    ctx.textAlign='right';write('Current + earlier periods',678,314,'15px Arial, sans-serif',color('surface'));ctx.textAlign='left';

    if(earlier.length){
      rounded(64,364,632,priorHeight,17,color('warning-soft'));
      write('PENDING BALANCE · EARLIER PERIODS',82,397,'bold 14px Arial, sans-serif',color('warning'));
      write(money(earlierPending),82,444,'bold 34px Arial, sans-serif',color('ink'),590);
      earlier.forEach((item,index)=>{
        const y=482+index*54;
        write(formatRange(item.period_start,item.period_end),82,y,'17px Arial, sans-serif',color('ink'),405);
        write(+item.amount_received>0?'Partially paid':'Unpaid',82,y+23,'13px Arial, sans-serif',color('muted'));
        ctx.textAlign='right';write(money(item.pending),678,y+10,'bold 20px Arial, sans-serif',color('ink'),165);ctx.textAlign='left';
      });
    }

    write('CURRENT PERIOD',64,currentTop,'bold 15px Arial, sans-serif',color('brand'));
    write(formatRange(range.period_start,range.period_end),64,currentTop+39,'bold 27px Arial, sans-serif',color('ink'),632);
    rounded(64,currentTop+61,308,100,17,color('brand-soft'));
    rounded(388,currentTop+61,308,100,17,color('brand-soft'));
    write('TOTAL HOURS',82,currentTop+89,'bold 13px Arial, sans-serif',color('muted'));
    write(hours.toFixed(2)+' h',82,currentTop+136,'bold 35px Arial, sans-serif',color('ink'),270);
    write('TOTAL EARNINGS',406,currentTop+89,'bold 13px Arial, sans-serif',color('muted'));
    write(money(earnings),406,currentTop+136,'bold 32px Arial, sans-serif',color('ink'),270);
    write(range.paid?'Fully paid':'Received '+money(received),64,currentTop+196,'16px Arial, sans-serif',color('muted'),300);
    ctx.textAlign='right';write('Pending '+money(pending),696,currentTop+196,'bold 16px Arial, sans-serif',color('ink'),315);ctx.textAlign='left';

    write('WORK DETAILS',64,dailyTop,'bold 14px Arial, sans-serif',color('brand'));
    ctx.fillStyle=color('line');ctx.fillRect(64,dailyTop+16,632,1);
    if(!days.length)write('No shifts logged for this period',64,dailyTop+49,'17px Arial, sans-serif',color('muted'));
    days.forEach(([date,list],index)=>{
      const y=dailyTop+49+index*45;
      write(dt(date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}),64,y,'17px Arial, sans-serif',color('ink'),470);
      ctx.textAlign='right';write(list.reduce((sum,shift)=>sum+h(shift),0).toFixed(2)+' h',696,y,'bold 18px Arial, sans-serif',color('ink'));ctx.textAlign='left';
      ctx.fillStyle=color('line');ctx.fillRect(64,y+16,632,1);
    });
    write('Amounts are estimates · As of '+new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}),64,footerY,'13px Arial, sans-serif',color('muted'),632);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Could not create the report image.')),'image/png'));
    const filename=`my-tracker-${range.period_start}-to-${range.period_end}.png`;
    return new File([blob],filename,{type:'image/png'});
  };

  return async({work,range,shifts,button,loadDetails})=>{
    if(button.disabled)return;
    button.disabled=true;button.classList.add('is-loading');
    try{
      const details=loadDetails?await loadDetails():{range,shifts,earlier:[]};
      const file=await makeImage(work,details.range,details.shifts,details.earlier);
      close();
      imageFile=file;imageUrl=URL.createObjectURL(file);
      $('periodSharePreview').src=imageUrl;
      $('downloadPeriodImage').href=imageUrl;
      $('downloadPeriodImage').download=file.name;
      $('sendPeriodImage').hidden=!(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})));
      modal.hidden=false;
    }catch(error){alert(error.message||'Could not create the period image.')}
    finally{button.disabled=false;button.classList.remove('is-loading')}
  };
};
