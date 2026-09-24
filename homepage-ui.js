window.initHomepageUI=()=>{
  const home=document.getElementById('welcome');
  const shell=document.getElementById('appShell');
  const signIn=document.getElementById('authGate');
  const email=document.getElementById('email');
  const password=document.getElementById('password');
  const closeSignIn=()=>{
    signIn.hidden=true;
    password.value='';
    document.getElementById('authNote').textContent='';
  };
  const openSignIn=()=>{
    if(window.myTrackerHasSession)return;
    signIn.hidden=false;
    email.focus();
  };
  window.openTrackerSignIn=openSignIn;
  window.myTrackerAuthState=loggedIn=>{
    home.hidden=loggedIn;
    shell.hidden=!loggedIn;
    closeSignIn();
  };
  document.querySelectorAll('[data-home-signin]').forEach(button=>button.onclick=openSignIn);
  document.querySelectorAll('[data-home-signup]').forEach(button=>button.onclick=()=>document.getElementById('signupBtn').click());
  document.getElementById('closeSignIn').onclick=closeSignIn;
  signIn.onclick=event=>{if(event.target===signIn)closeSignIn()};
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!signIn.hidden)closeSignIn()});
  if(typeof window.myTrackerHasSession==='boolean')window.myTrackerAuthState(window.myTrackerHasSession);
};
