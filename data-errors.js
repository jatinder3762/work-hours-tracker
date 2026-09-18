window.initDataErrorUI=()=>{
  const originalAlert=window.alert.bind(window);
  let retryAttempted=false;

  const panel=()=>{
    let element=document.getElementById('dataErrorPanel');
    if(element)return element;
    element=document.createElement('section');
    element.id='dataErrorPanel';
    element.className='data-error-panel';
    element.setAttribute('role','alert');
    element.setAttribute('aria-live','assertive');
    element.hidden=true;
    element.innerHTML='<div><strong>We couldn’t load your work data</strong><p id="dataErrorMessage">Checking the connection…</p><details id="dataErrorDetails" hidden><summary>Technical details</summary><code id="dataErrorCode"></code></details></div><div class="data-error-actions"><button id="retryDataLoad" class="btn primary">Retry</button><button id="signOutAfterError" class="btn secondary">Sign out</button></div>';
    document.body.appendChild(element);
    element.querySelector('#retryDataLoad').onclick=()=>location.reload();
    element.querySelector('#signOutAfterError').onclick=async()=>{try{await sb.auth.signOut()}finally{location.reload()}};
    return element;
  };

  const diagnose=async()=>{
    const box=panel();
    const message=box.querySelector('#dataErrorMessage');
    const details=box.querySelector('#dataErrorDetails');
    const code=box.querySelector('#dataErrorCode');
    box.hidden=false;
    message.textContent='Checking your secure connection…';
    details.hidden=true;

    try{
      const {data:sessionData,error:sessionError}=await sb.auth.getSession();
      if(sessionError||!sessionData?.session){
        message.textContent='Your sign-in session has expired. Sign out, then sign in again.';
        return;
      }

      const checks=[
        ['workplaces',sb.from('workplaces').select('id').limit(1)],
        ['shifts',sb.from('shifts').select('id').limit(1)],
        ['workplace_rates',sb.from('workplace_rates').select('id').limit(1)],
        ['user_preferences',sb.from('user_preferences').select('user_id').limit(1)]
      ];
      const results=await Promise.all(checks.map(async([name,request])=>[name,await request]));
      const failures=results.filter(([,result])=>result.error).map(([name,result])=>({name,error:result.error}));

      if(!failures.length&&!retryAttempted){
        retryAttempted=true;
        message.textContent='The connection was interrupted temporarily. Retrying now…';
        window.setTimeout(()=>load(),900);
        return;
      }

      if(!failures.length){
        message.textContent='The database connection is available, but loading did not finish. Tap Retry to refresh the app.';
        return;
      }

      const missing=failures.find(({error})=>error.code==='42P01'||/does not exist/i.test(error.message||''));
      const denied=failures.find(({error})=>error.code==='42501'||/permission denied/i.test(error.message||''));
      if(missing)message.textContent=`The ${missing.name} database table is missing. The latest Supabase migration must be applied.`;
      else if(denied)message.textContent=`Your signed-in account cannot access ${denied.name}. Its Supabase permissions need repair.`;
      else message.textContent='Supabase could not load your work data. The technical details below identify the exact problem.';

      details.hidden=false;
      code.textContent=failures.map(({name,error})=>`${name}: ${error.message||'Unknown error'}${error.code?` (${error.code})`:''}`).join('\n');
    }catch(error){
      message.textContent='Unable to reach Supabase. Check your internet connection, then tap Retry.';
      details.hidden=false;
      code.textContent=error?.message||'Network request failed';
    }
  };

  window.alert=(message)=>{
    if(String(message).includes('Rate History database update is not ready')){diagnose();return;}
    originalAlert(message);
  };
};
