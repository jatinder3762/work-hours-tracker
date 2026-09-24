window.initAuthUI=()=>{
  const form=document.getElementById('authForm');
  const email=document.getElementById('email');
  const password=document.getElementById('password');
  const note=document.getElementById('authNote');
  const button=form?.querySelector('button[type="submit"],button:not([type])');
  if(!form||!email||!password||!note||!button)return;

  note.setAttribute('role','alert');
  note.setAttribute('aria-live','polite');

  const clearError=()=>{
    note.textContent='';
    note.classList.remove('auth-error','auth-success');
    email.removeAttribute('aria-invalid');
    password.removeAttribute('aria-invalid');
  };

  const showError=(message)=>{
    note.textContent=message;
    note.classList.remove('auth-success');
    note.classList.add('auth-error');
    email.setAttribute('aria-invalid','true');
    password.setAttribute('aria-invalid','true');
  };

  const showSuccess=(message)=>{
    note.textContent=message;
    note.classList.remove('auth-error');
    note.classList.add('auth-success');
    email.removeAttribute('aria-invalid');
    password.removeAttribute('aria-invalid');
  };

  const friendlyMessage=(error)=>{
    const message=(error?.message||'').toLowerCase();
    if(message.includes('invalid login credentials'))return 'Incorrect email or password. Please check your details and try again.';
    if(message.includes('email not confirmed'))return 'Please confirm your email address before signing in.';
    if(message.includes('too many')||message.includes('rate limit'))return 'Too many sign-in attempts. Please wait a few minutes and try again.';
    if(message.includes('failed to fetch')||message.includes('network'))return 'Unable to connect. Check your internet connection and try again.';
    return 'We could not sign you in right now. Please try again.';
  };

  email.addEventListener('input',clearError);
  password.addEventListener('input',clearError);

  const hoursLabel=document.querySelector('#workHours')?.previousElementSibling;
  const earningsLabel=document.querySelector('#workEarn')?.previousElementSibling;
  if(hoursLabel)hoursLabel.textContent='All-time hours';
  if(earningsLabel)earningsLabel.textContent='All-time estimated gross';

  const signupButton=document.getElementById('signupBtn');
  if(signupButton){
    document.body.insertAdjacentHTML('beforeend','<div id="signupModal" class="modal" hidden><div class="card modal-card"><div class="modal-handle"></div><p class="eyebrow">NEW ACCOUNT</p><h2>Create your account</h2><p class="muted signup-intro">Use a real email address. We will send a confirmation link before the account can be used.</p><form id="signupForm" class="form"><label>Email address<input id="signupEmail" type="email" autocomplete="email" required></label><label>Password<input id="signupPassword" type="password" autocomplete="new-password" minlength="8" required><small>At least 8 characters</small></label><label>Confirm password<input id="signupConfirm" type="password" autocomplete="new-password" minlength="8" required></label><label class="bot-field" aria-hidden="true">Leave this empty<input id="signupWebsite" type="text" tabindex="-1" autocomplete="off"></label><div id="signupNote" class="form-note" role="alert" aria-live="polite"></div><div class="modal-actions"><button id="cancelSignup" type="button" class="btn secondary">Cancel</button><button id="createAccount" type="submit" class="btn primary">Create account</button></div></form></div></div>');
    const signupModal=document.getElementById('signupModal');
    const signupForm=document.getElementById('signupForm');
    const signupEmail=document.getElementById('signupEmail');
    const signupPassword=document.getElementById('signupPassword');
    const signupConfirm=document.getElementById('signupConfirm');
    const signupWebsite=document.getElementById('signupWebsite');
    const signupNote=document.getElementById('signupNote');
    const createAccount=document.getElementById('createAccount');

    const signupError=(message)=>{
      signupNote.textContent=message;
      signupNote.className='form-note auth-error';
    };
    const closeSignup=()=>{signupModal.hidden=true;signupNote.textContent='';signupForm.reset()};
    document.getElementById('cancelSignup').onclick=closeSignup;
    signupButton.onclick=()=>{
      signupEmail.value=email.value.trim();
      signupModal.hidden=false;
      window.setTimeout(()=>signupEmail.focus(),50);
    };

    signupForm.onsubmit=async(event)=>{
      event.preventDefault();
      signupNote.textContent='';
      const emailValue=signupEmail.value.trim();
      const passwordValue=signupPassword.value;
      if(signupWebsite.value)return closeSignup();
      if(!emailValue)return signupError('Enter a valid email address.');
      if(passwordValue.length<8)return signupError('Use a password with at least 8 characters.');
      if(passwordValue!==signupConfirm.value)return signupError('The passwords do not match.');
      const lastAttempt=Number(localStorage.getItem('myTrackerSignupAttempt')||0);
      if(Date.now()-lastAttempt<60000)return signupError('Please wait one minute before trying to create another account.');

      createAccount.disabled=true;
      createAccount.textContent='Creating…';
      signupForm.setAttribute('aria-busy','true');
      try{
        const {error}=await sb.auth.signUp({email:emailValue,password:passwordValue,options:{emailRedirectTo:location.href.split('#')[0]}});
        localStorage.setItem('myTrackerSignupAttempt',String(Date.now()));
        if(error){
          const message=(error.message||'').toLowerCase();
          if(message.includes('already registered')||message.includes('already exists'))signupError('An account already exists for this email. Try signing in or reset the password.');
          else if(message.includes('password'))signupError('This password does not meet the security requirements.');
          else if(message.includes('rate')||message.includes('too many'))signupError('Too many signup attempts. Please wait and try again later.');
          else if(message.includes('captcha'))signupError('The security check could not be completed. Please try again.');
          else signupError(error.message||'We could not create the account. Please try again.');
          return;
        }
        closeSignup();
        email.value=emailValue;
        window.openTrackerSignIn?.();
        showSuccess('Account created. Check your email and confirm your address before signing in.');
      }catch(error){
        signupError('Unable to connect. Check your internet connection and try again.');
      }finally{
        createAccount.disabled=false;
        createAccount.textContent='Create account';
        signupForm.removeAttribute('aria-busy');
      }
    };
  }

  form.onsubmit=async(event)=>{
    event.preventDefault();
    clearError();
    const emailValue=email.value.trim();
    const passwordValue=password.value;
    if(!emailValue){showError('Enter your email address.');email.focus();return;}
    if(!passwordValue){showError('Enter your password.');password.focus();return;}

    button.disabled=true;
    button.textContent='Signing in…';
    form.setAttribute('aria-busy','true');
    try{
      const {error}=await sb.auth.signInWithPassword({email:emailValue,password:passwordValue});
      if(error)showError(friendlyMessage(error));
    }catch(error){
      showError(friendlyMessage(error));
    }finally{
      button.disabled=false;
      button.textContent='Sign in';
      form.removeAttribute('aria-busy');
    }
  };
};
