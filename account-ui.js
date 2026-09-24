window.initAccountUI=()=>{
  const sideNav=document.querySelector('.side-nav');
  const accountButton=document.createElement('button');
  accountButton.id='accountNav';
  accountButton.type='button';
  accountButton.className='nav-item';
  accountButton.innerHTML='<span>◉</span> Account';
  sideNav.appendChild(accountButton);

  const mobileNav=document.getElementById('mobileNav');
  const mobileButton=document.createElement('button');
  mobileButton.id='mAccount';
  mobileButton.type='button';
  mobileButton.className='btn';
  mobileButton.textContent='Account';
  mobileNav.insertBefore(mobileButton,document.getElementById('mOut'));

  const modal=document.createElement('div');
  modal.id='accountModal';
  modal.className='modal';
  modal.hidden=true;
  modal.innerHTML=`<div class="card modal-card account-card" role="dialog" aria-modal="true" aria-labelledby="accountTitle">
    <div class="modal-handle"></div><p class="eyebrow">MY TRACKER ACCOUNT</p>
    <h2 id="accountTitle">Account settings</h2>
    <p id="accountDescription" class="muted">Update the password you use to sign in.</p>
    <p id="accountEmail" class="account-email"></p>
    <form id="accountPasswordForm" class="form">
      <label>New password<input id="accountPassword" type="password" autocomplete="new-password" minlength="8" required></label>
      <label>Confirm new password<input id="accountPasswordConfirm" type="password" autocomplete="new-password" minlength="8" required></label>
      <p id="accountMessage" class="form-note" role="alert" aria-live="polite"></p>
      <div class="modal-actions"><button id="accountCancel" type="button" class="btn secondary">Cancel</button><button id="accountSave" type="submit" class="btn primary">Update password</button></div>
    </form>
    <div id="accountSuccess" hidden><p class="form-note auth-success">Your password has been updated. Use it the next time you sign in.</p><button id="accountDone" type="button" class="btn primary wide">Done</button></div>
  </div>`;
  document.body.appendChild(modal);
  const get=id=>document.getElementById(id);
  let recovery=false;
  const close=()=>{
    if(recovery)return;
    modal.hidden=true;
    get('accountPasswordForm').reset();
  };
  const open=(isRecovery=false)=>{
    recovery=isRecovery;
    get('accountTitle').textContent=isRecovery?'Set a new password':'Account settings';
    get('accountDescription').textContent=isRecovery
      ?'Your recovery link signed you in. Set a new password to complete the reset.'
      :'Update the password you use to sign in.';
    get('accountEmail').textContent=window.myTrackerAccountEmail||'';
    get('accountMessage').textContent='';
    get('accountPasswordForm').reset();
    get('accountPasswordForm').hidden=false;
    get('accountSuccess').hidden=true;
    get('accountCancel').hidden=isRecovery;
    modal.hidden=false;
    get('accountPassword').focus();
  };
  window.showRecoveryUI=()=>open(true);
  accountButton.onclick=()=>open(false);
  mobileButton.onclick=()=>open(false);
  get('accountCancel').onclick=close;
  modal.onclick=event=>{if(event.target===modal)close()};
  get('accountDone').onclick=()=>{recovery=false;close()};
  window.addEventListener('mytracker:auth',event=>{
    const {event:authEvent,session}=event.detail;
    if(session?.user){
      window.myTrackerAccountEmail=session.user.email;
      get('accountEmail').textContent=session.user.email;
      get('userEmailSide').textContent=session.user.email;
    }
    if(authEvent==='PASSWORD_RECOVERY')open(true);
    if(authEvent==='SIGNED_OUT'){
      window.myTrackerRecoveryPending=false;
      window.myTrackerAccountEmail='';
      recovery=false;
      modal.hidden=true;
      get('accountPasswordForm').reset();
      get('userEmailSide').textContent='—';
    }
  });
  if(window.myTrackerRecoveryPending)open(true);
  else if(window.myTrackerAccountEmail){
    get('userEmailSide').textContent=window.myTrackerAccountEmail;
  }
  get('accountPasswordForm').onsubmit=async event=>{
    event.preventDefault();
    const password=get('accountPassword').value;
    const confirm=get('accountPasswordConfirm').value;
    const message=get('accountMessage');
    if(password.length<8){message.textContent='Use at least 8 characters.';return}
    if(password!==confirm){message.textContent='The passwords do not match.';return}
    const save=get('accountSave');
    save.disabled=true;
    save.textContent='Updating…';
    message.textContent='';
    try{
      const {error}=await sb.auth.updateUser({password});
      if(error){message.textContent=error.message||'Unable to update the password.';return}
      const wasRecovery=recovery;
      window.myTrackerRecoveryPending=false;
      recovery=false;
      get('accountPasswordForm').reset();
      get('accountPasswordForm').hidden=true;
      get('accountSuccess').hidden=false;
      // Remove any remaining recovery token from the address bar after use.
      if(wasRecovery&&(location.hash||location.search))history.replaceState(null,'',location.pathname);
    }catch(error){message.textContent='Unable to connect. Please try again.'}
    finally{save.disabled=false;save.textContent='Update password'}
  };
};
