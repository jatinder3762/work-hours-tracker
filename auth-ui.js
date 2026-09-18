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
