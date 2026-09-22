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

  const makeImage=async(work,range,shifts)=>{
    const grouped=new Map();
    shifts.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)).forEach(shift=>{
      if(!grouped.has(shift.date))grouped.set(shift.date,[]);
      grouped.get(shift.date).push(shift);
    });
    const days=[...grouped.entries()];
    const rowCount=Math.max(1,days.length);
    const width=760,height=630+rowCount*72;
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
    ctx.fillStyle='#edf3ff';ctx.fillRect(0,0,width,height);
    rounded(28,26,width-56,height-52,28,'#ffffff');
    const gradient=ctx.createLinearGradient(48,48,712,195);
    gradient.addColorStop(0,'#294fca');gradient.addColorStop(1,'#477bea');
    rounded(48,46,width-96,158,21,gradient);
    rounded(72,72,50,50,14,'#ffffff');
    write('M',84,109,'bold 31px Arial, sans-serif','#315ddc');
    write('MY TRACKER  /  WORK PERIOD',140,90,'bold 16px Arial, sans-serif','#d8e6ff');
    write(work.name,140,137,'bold 29px Arial, sans-serif','#ffffff',535);
    write('Personal work log',140,171,'17px Arial, sans-serif','#d8e6ff');

    write('SELECTED PERIOD',64,244,'bold 15px Arial, sans-serif','#50658d');
    write(formatRange(range.period_start,range.period_end),64,287,'bold 29px Arial, sans-serif','#17233d',615);
    rounded(64,307,range.paid?74:91,30,15,range.paid?'#e5f8ee':'#fff1d3');
    write(range.paid?'PAID':'UNPAID',78,328,'bold 13px Arial, sans-serif',range.paid?'#087355':'#8a5b0b');

    rounded(64,361,298,107,17,'#edf3ff');
    rounded(378,361,318,107,17,'#e8f7f1');
    write('WORKED HOURS',82,392,'bold 14px Arial, sans-serif','#5b6d8a');
    write(hours.toFixed(2)+' h',82,445,'bold 39px Arial, sans-serif','#17233d');
    write('SHIFTS LOGGED',397,392,'bold 14px Arial, sans-serif','#548775');
    write(String(shifts.length),397,445,'bold 39px Arial, sans-serif','#17233d');

    write('DAILY WORK',64,514,'bold 15px Arial, sans-serif','#315ddc');
    ctx.fillStyle='#dfe6f2';ctx.fillRect(64,531,632,1);
    if(!days.length){write('No shifts logged for this period',64,577,'19px Arial, sans-serif','#64748b')}
    days.forEach(([date,list],index)=>{
      const y=553+index*72;
      const dayHours=list.reduce((sum,shift)=>sum+h(shift),0);
      const parts=list.map(shift=>shift.start+'–'+shift.end).join('  ·  ');
      write(dt(date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}),64,y+13,'bold 18px Arial, sans-serif','#17233d',345);
      write(parts,64,y+39,'15px Arial, sans-serif','#68758d',495);
      ctx.textAlign='right';
      write(dayHours.toFixed(2)+' h',696,y+26,'bold 22px Arial, sans-serif','#17233d');
      ctx.textAlign='left';
      ctx.fillStyle='#e7ecf5';ctx.fillRect(64,y+57,632,1);
    });
    const footerY=553+rowCount*72;
    write('Personal work log. Hours exclude unpaid breaks.',64,footerY+12,'14px Arial, sans-serif','#68758d');
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Could not create the report image.')),'image/png'));
    const filename=`my-tracker-${range.period_start}-to-${range.period_end}.png`;
    return new File([blob],filename,{type:'image/png'});
  };

  return async({work,range,shifts,button})=>{
    if(button.disabled)return;
    button.disabled=true;button.classList.add('is-loading');
    try{
      const file=await makeImage(work,range,shifts);
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
