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

  const profile=document.createElement('section');
  profile.id='accountView';
  profile.className='view page profile-page';
  profile.hidden=true;
  profile.innerHTML=`<div class="page-heading"><div><p class="eyebrow">YOUR ACCOUNT</p><h1>Profile & settings</h1><p class="muted">Keep your personal details and sign-in information up to date.</p></div></div>
    <div class="profile-grid"><div class="profile-main">
      <section class="card profile-hero"><span id="profileAvatar" class="profile-avatar" aria-hidden="true">M</span><div><p class="eyebrow">MY TRACKER MEMBER</p><h2 id="profileName">Your profile</h2><p id="profileHeroEmail" class="muted"></p><small id="profileJoined" class="muted"></small></div></section>
      <section class="card profile-card"><div class="profile-card-head"><div><p class="eyebrow">PERSONAL DETAILS</p><h2>About you</h2><p class="muted">Only you can edit these details.</p></div></div>
        <form id="profileForm" class="form"><div class="profile-fields"><label>First name<input id="profileFirstName" autocomplete="given-name" maxlength="60" placeholder="First name"></label><label>Last name<input id="profileLastName" autocomplete="family-name" maxlength="60" placeholder="Last name"></label><label>Phone <span>(optional)</span><input id="profilePhone" type="tel" autocomplete="tel" maxlength="30" placeholder="Your phone number"></label><label>City <span>(optional)</span><input id="profileCity" autocomplete="address-level2" maxlength="80" placeholder="Your city"></label></div><p id="profileMessage" class="profile-message" role="status" aria-live="polite"></p><div class="profile-form-actions"><button id="profileSave" type="submit" class="btn primary">Save changes</button></div></form>
      </section>
    </div><aside class="profile-side">
      <section class="card profile-card"><p class="eyebrow">SIGN-IN DETAILS</p><h2>Email address</h2><p id="profileEmail" class="profile-email"></p><p class="muted profile-note">This is the email you use to sign in. Email changes are not available here yet.</p></section>
      <section class="card profile-card"><p class="eyebrow">SECURITY</p><h2>Password</h2><p class="muted">Keep your account protected with a strong password.</p><button id="profileChangePassword" type="button" class="btn secondary">Change password</button></section>
    </aside></div>`;
  document.getElementById('reportsView').insertAdjacentElement('afterend',profile);
  const get=id=>document.getElementById(id);
  const baseShow=show;
  show=function(id){
    profile.hidden=id!=='accountView';
    if(id==='accountView'){
      for(const view of ['dashboardView','workplaceView','reportsView'])get(view).hidden=true;
    }else baseShow(id);
    for(const [name,button] of [['dashboardView',get('dashNav')],['reportsView',get('reportsNav')],['accountView',accountButton]])button.classList.toggle('active',name===id);
    for(const [name,button] of [['dashboardView',get('mDash')],['reportsView',get('mReports')],['accountView',mobileButton]])button?.classList.toggle('active',name===id);
  };
  const displayName=person=>{
    const meta=person?.user_metadata||{};
    return [meta.first_name,meta.last_name].filter(Boolean).join(' ')||meta.full_name||'My Tracker member';
  };
  const syncProfile=person=>{
    if(!person)return;
    const meta=person.user_metadata||{},name=displayName(person);
    get('profileFirstName').value=meta.first_name||'';
    get('profileLastName').value=meta.last_name||'';
    get('profilePhone').value=meta.contact_phone||'';
    get('profileCity').value=meta.city||'';
    get('profileName').textContent=name;
    get('profileAvatar').textContent=([meta.first_name?.[0],meta.last_name?.[0]].filter(Boolean).join('')||name[0]||'M').toUpperCase();
    get('profileEmail').textContent=person.email||'';
    get('profileHeroEmail').textContent=person.email||'';
    get('profileJoined').textContent=person.created_at?`Member since ${new Date(person.created_at).toLocaleDateString(undefined,{month:'long',year:'numeric'})}`:'';
    document.querySelector('.sidebar .avatar').textContent=get('profileAvatar').textContent;
  };
  const openProfile=()=>{
    if(!window.myTrackerHasSession||!user)return;
    syncProfile(user);
    get('profileMessage').textContent='';
    get('profileMessage').classList.remove('is-error');
    show('accountView');
    window.scrollTo({top:0,behavior:'smooth'});
  };
  window.showAccountPage=openProfile;
  accountButton.onclick=openProfile;
  mobileButton.onclick=openProfile;
  get('profileForm').onsubmit=async event=>{
    event.preventDefault();
    if(!user)return;
    const first_name=get('profileFirstName').value.trim(),last_name=get('profileLastName').value.trim();
    const contact_phone=get('profilePhone').value.trim(),city=get('profileCity').value.trim();
    const message=get('profileMessage'),button=get('profileSave'),accountId=user.id;
    message.textContent='';message.classList.remove('is-error');
    button.disabled=true;button.textContent='Saving…';
    try{
      const {data,error}=await sb.auth.updateUser({data:{first_name,last_name,full_name:[first_name,last_name].filter(Boolean).join(' '),contact_phone,city}});
      if(error)throw error;
      if(user?.id!==accountId)return;
      user=data.user||user;
      syncProfile(user);
      message.textContent='Your profile has been saved.';
    }catch(error){message.classList.add('is-error');message.textContent=error?.message||'Could not save your profile. Please try again.'}
    finally{button.disabled=false;button.textContent='Save changes'}
  };

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
  let recovery=false;
  const close=()=>{
    if(recovery)return;
    modal.hidden=true;
    get('accountPasswordForm').reset();
  };
  const open=(isRecovery=false)=>{
    if(!isRecovery&&!window.myTrackerHasSession)return;
    recovery=isRecovery;
    get('accountTitle').textContent=isRecovery?'Set a new password':'Change password';
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
  get('profileChangePassword').onclick=()=>open(false);
  get('accountCancel').onclick=close;
  modal.onclick=event=>{if(event.target===modal)close()};
  get('accountDone').onclick=()=>{recovery=false;close()};
  window.addEventListener('mytracker:auth',event=>{
    const {event:authEvent,session}=event.detail;
    if(session?.user){
      window.myTrackerAccountEmail=session.user.email;
      get('accountEmail').textContent=session.user.email;
      get('userEmailSide').textContent=session.user.email;
      if(get('accountView').hidden)syncProfile(session.user);
      else if(authEvent!=='USER_UPDATED')syncProfile(session.user);
    }
    if(authEvent==='PASSWORD_RECOVERY'&&session?.user)open(true);
    if(authEvent==='SIGNED_OUT'){
      window.myTrackerRecoveryPending=false;
      window.myTrackerAccountEmail='';
      recovery=false;
      modal.hidden=true;
      get('accountPasswordForm').reset();
      get('userEmailSide').textContent='—';
      profile.hidden=true;
      get('dashboardView').hidden=false;
      get('profileForm').reset();
      get('profileMessage').textContent='';
    }
  });
  if(window.myTrackerRecoveryPending&&window.myTrackerHasSession)open(true);
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
