// ════════════════ M-PESA ════════════════
// Credentials live in the server's .env and never reach the browser.
// Daraja sends no CORS headers, so all calls go through our own /api routes.
const MPESA = { accountRef: 'Kanini Bags' };

// ════════════════ DATABASE ════════════════
const DB={
  rd(k,d){try{return JSON.parse(localStorage.getItem(k)||d)}catch(e){return JSON.parse(d)}},
  wr(k,v){localStorage.setItem(k,JSON.stringify(v))},
  getP(){return this.rd('kb_p','[]')},saveP(d){this.wr('kb_p',d)},
  getS(){return this.rd('kb_s','[]')},saveS(d){this.wr('kb_s',d)},
  getC(){return this.rd('kb_c','[]')},saveC(d){this.wr('kb_c',d)},
  getO(){return this.rd('kb_o','[]')},saveO(d){this.wr('kb_o',d)},
  getAccts(){return this.rd('kb_a','[]')},saveAccts(d){this.wr('kb_a',d)},
};
let cart=[],adminUser=null,customerSession=null;

// ════════════════ CUSTOMER ACCOUNT SYSTEM ════════════════
function updateNavForCustomer(){
  var si=document.getElementById('nav-signin-btn');
  var ub=document.getElementById('nav-user-btn');
  var nd=document.getElementById('nav-user-name-disp');
  if(!si||!ub)return;
  if(customerSession){
    si.style.display='none';ub.style.display='flex';
    nd.textContent=customerSession.name.split(' ')[0];
  }else{
    si.style.display='';ub.style.display='none';
  }
}
function toggleUserDropdown(e){
  e.stopPropagation();
  document.getElementById('nav-user-dropdown').classList.toggle('open');
}
function closeUserDropdown(){
  document.getElementById('nav-user-dropdown').classList.remove('open');
}
document.addEventListener('click',function(){closeUserDropdown()});

function customerSignup(){
  var nm=document.getElementById('signup-name').value.trim();
  var ph=document.getElementById('signup-phone').value.trim();
  var em=document.getElementById('signup-email').value.trim();
  var pw=document.getElementById('signup-password').value.trim();
  var ad=document.getElementById('signup-address').value.trim();
  if(!nm||!ph||!pw)return alert('Please fill name, phone, and password');
  if(pw.length<6)return alert('Password must be at least 6 characters');
  var accts=DB.getAccts();
  if(accts.find(function(a){return a.email===em&&em||a.phone===ph})){
    return alert('An account with this email or phone already exists. Please sign in instead.');
  }
  var newAcct={id:uid(),name:nm,phone:ph,email:em,password:pw,address:ad,created:new Date().toISOString().split('T')[0]};
  accts.push(newAcct);DB.saveAccts(accts);
  customerSession={id:newAcct.id,name:newAcct.name,phone:newAcct.phone,email:newAcct.email,address:newAcct.address};
  localStorage.setItem('kb_cust_session',JSON.stringify(customerSession));
  updateNavForCustomer();navigateTo('page-store');
  toast('Account created! Welcome, '+nm.split(' ')[0]+'!');
}

function customerLogin(){
  var em=document.getElementById('login-email').value.trim();
  var pw=document.getElementById('login-password').value.trim();
  if(!em||!pw)return alert('Please enter your email/phone and password');
  var accts=DB.getAccts();
  var acct=accts.find(function(a){return (a.email===em||a.phone===em)&&a.password===pw});
  if(!acct)return alert('Invalid credentials. Check your email/phone and password.');
  customerSession={id:acct.id,name:acct.name,phone:acct.phone,email:acct.email,address:acct.address};
  localStorage.setItem('kb_cust_session',JSON.stringify(customerSession));
  updateNavForCustomer();navigateTo('page-store');
  toast('Welcome back, '+acct.name.split(' ')[0]+'!');
}

function customerLogout(){
  customerSession=null;localStorage.removeItem('kb_cust_session');
  updateNavForCustomer();navigateTo('page-store');toast('Signed out','info');
}

// Restore session
(function(){
  try{var s=JSON.parse(localStorage.getItem('kb_cust_session'));if(s&&s.id)customerSession=s}catch(e){}
  setTimeout(updateNavForCustomer,100);
})();

// ════════════════ CUSTOMER ACCOUNT PAGE ════════════════
function setAccountTab(tab){
  document.querySelectorAll('.account-tab').forEach(function(t){t.classList.remove('active')});
  document.getElementById('acct-tab-'+tab).classList.add('active');
  document.getElementById('acct-content-orders').style.display=tab==='orders'?'block':'none';
  document.getElementById('acct-content-profile').style.display=tab==='profile'?'block':'none';
  if(tab==='orders')renderCustomerOrders();
  if(tab==='profile')renderCustomerProfile();
}

function renderCustomerOrders(){
  if(!customerSession){navigateTo('page-auth');return}
  document.getElementById('account-welcome-name').textContent=customerSession.name;
  var orders=DB.getO().filter(function(o){
    return o.customerAccountId===customerSession.id||
           o.customerPhone===customerSession.phone||
           o.customerEmail===customerSession.email;
  });
  var div=document.getElementById('customer-orders-list');
  if(orders.length===0){
    div.innerHTML='<div class="empty-state"><div class="empty-state-icon">📋</div><h3>No orders yet</h3><p style="color:var(--muted);margin-top:4px">Start shopping and your orders will appear here!</p><button class="btn btn-primary" onclick="navigateTo(\'page-store\')" style="margin-top:14px">🛍 Browse Bags</button></div>';
    return;
  }
  var stages=['Confirmed','Processing','Shipped','Delivered'];
  div.innerHTML=[...orders].reverse().map(function(o){
    var idx=stages.indexOf(o.status),cancelled=o.status==='Cancelled';
    var sc=cancelled?'cancelled':idx>=3?'delivered':idx>=2?'shipped':idx>=1?'processing':'pending';
    var pct=cancelled?'0%':idx>=0?((idx+1)/stages.length*90)+'%':'15%';
    return '<div class="order-history-item"><div class="order-history-hdr"><span class="order-card-id">📦 '+o.id+'</span><span class="status-chip '+sc+'">'+o.status+'</span></div><div class="track-progress"><div class="track-progress-line"></div><div class="track-progress-fill" style="width:'+pct+'"></div>'+stages.map(function(s,i){return '<div class="track-step"><div class="track-dot'+(i<=idx?' done':i===idx&&!cancelled?' current':'')+'"></div><span class="track-lbl'+(i<=idx?' done':'')+'">'+s+'</span></div>'}).join('')+'</div><div class="order-history-items">'+o.items+'</div><div class="order-details" style="margin-top:8px"><strong>Total:</strong> '+fmtKES(o.total)+' | <strong>Date:</strong> '+o.date+' | <strong>Payment:</strong> M-Pesa</div></div>';
  }).join('');
}

function renderCustomerProfile(){
  if(!customerSession){navigateTo('page-auth');return}
  document.getElementById('account-welcome-name').textContent=customerSession.name;
  var accts=DB.getAccts();
  var a=accts.find(function(ac){return ac.id===customerSession.id});
  if(!a)return;
  document.getElementById('profile-avatar').textContent=a.name[0].toUpperCase();
  document.getElementById('profile-name').textContent=a.name;
  document.getElementById('profile-email').textContent=a.email||a.phone;
  document.getElementById('edit-profile-name').value=a.name;
  document.getElementById('edit-profile-phone').value=a.phone;
  document.getElementById('edit-profile-email').value=a.email||'';
  document.getElementById('edit-profile-address').value=a.address||'';
}

function saveProfile(){
  if(!customerSession)return;
  var accts=DB.getAccts();
  var idx=accts.findIndex(function(a){return a.id===customerSession.id});
  if(idx<0)return;
  var nm=document.getElementById('edit-profile-name').value.trim();
  var ph=document.getElementById('edit-profile-phone').value.trim();
  if(!nm||!ph)return alert('Name and phone are required');
  accts[idx].name=nm;accts[idx].phone=ph;
  accts[idx].email=document.getElementById('edit-profile-email').value.trim();
  accts[idx].address=document.getElementById('edit-profile-address').value.trim();
  DB.saveAccts(accts);
  customerSession.name=nm;customerSession.phone=ph;
  customerSession.email=accts[idx].email;customerSession.address=accts[idx].address;
  localStorage.setItem('kb_cust_session',JSON.stringify(customerSession));
  updateNavForCustomer();renderCustomerProfile();
  toast('Profile updated!');
}

function changeCustomerPassword(){
  var old=prompt('Enter your current password:');
  if(!old)return;
  var accts=DB.getAccts();
  var idx=accts.findIndex(function(a){return a.id===customerSession.id});
  if(idx<0||accts[idx].password!==old)return alert('Incorrect current password');
  var np=prompt('Enter new password (min 6 chars):');
  if(!np||np.length<6)return alert('Password must be at least 6 characters');
  accts[idx].password=np;DB.saveAccts(accts);
  toast('Password changed!');
}

// ════════════════ OVERRIDE: checkout to link order to customer ════════════════
// ════════════════ OVERRIDE: finalizeOrder to link to customer account ════════════════
var _origFinalizeOrder=finalizeOrder;
finalizeOrder=function(mpesaRef){
  if(customerSession){
    // Pre-fill or create customer record tied to account
    var custs=DB.getC();
    var cust=custs.find(function(c){return c.phone===customerSession.phone});
    if(!cust&&window._po){
      cust={id:uid(),name:customerSession.name,phone:customerSession.phone,email:customerSession.email||'',addr:customerSession.address||'',accountId:customerSession.id};
      custs.push(cust);DB.saveC(custs);
    }
  }
  _origFinalizeOrder(mpesaRef);
  // Tag the order with customer account ID
  if(customerSession){
    var orders=DB.getO();
    var lastOrder=orders[orders.length-1];
    if(lastOrder){
      lastOrder.customerAccountId=customerSession.id;
      DB.saveO(orders);
    }
  }
};


// ════════════════ SWITCH AUTH TAB ════════════════
function switchAuthTab(tab){
  document.querySelectorAll('.auth-tab').forEach(function(t){t.classList.remove('active')});
  document.querySelectorAll('.auth-form').forEach(function(f){f.classList.remove('active')});
  if(tab==='login'){
    document.querySelector('.auth-tab:first-child').classList.add('active');
    document.getElementById('auth-form-login').classList.add('active');
  }else{
    document.querySelector('.auth-tab:last-child').classList.add('active');
    document.getElementById('auth-form-signup').classList.add('active');
  }
}

const ADMINS=[
  {user:'admin',pass:'admin123',role:'Administrator'},
  {user:'willy',pass:'willy123',role:'Manager'},
  {user:'james',pass:'james123',role:'Manager'},
];

function seed(){
  if(DB.getP().length===0){
    DB.saveP([
      {id:'p1',name:'Premium Leather Travel Bag',cat:'Travel Bag',price:5500,stock:22,thresh:5,desc:'Genuine leather, perfect for business trips',emoji:'🧳'},
      {id:'p2',name:'Urban Canvas Backpack',cat:'Backpack',price:2800,stock:45,thresh:10,desc:'Durable canvas with padded laptop slot',emoji:'🎒'},
      {id:'p3',name:'Elegant Ladies Handbag',cat:'Handbag',price:3800,stock:16,thresh:5,desc:'Premium design with gold-tone accents',emoji:'👜'},
      {id:'p4',name:'Slim Laptop Sleeve 15in',cat:'Laptop Bag',price:1900,stock:3,thresh:5,desc:'Waterproof padded 15-inch sleeve',emoji:'💼'},
      {id:'p5',name:'Eco Cotton Tote Bag',cat:'Tote Bag',price:1200,stock:58,thresh:10,desc:'100% organic cotton, reusable',emoji:'🛍️'},
      {id:'p6',name:'Pro Sports Duffel Bag',cat:'Duffel Bag',price:4200,stock:14,thresh:5,desc:'Large capacity with ventilated shoe pocket',emoji:'🏀'},
      {id:'p7',name:'Kids School Bag Deluxe',cat:'School Bag',price:1600,stock:32,thresh:8,desc:'Lightweight, ergonomic, fun prints',emoji:'📚'},
      {id:'p8',name:'Leather Crossbody Messenger',cat:'Messenger Bag',price:3200,stock:9,thresh:5,desc:'Stylish everyday crossbody with pockets',emoji:'👝'},
    ]);
    DB.saveO([]);DB.saveS([]);DB.saveC([]);
  }
}
seed();

// ════════════════ HELPERS ════════════════
const $=id=>document.getElementById(id);
function fmtKES(n){return 'KES '+n.toLocaleString('en-KE')}
function uid(){return 'kb_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function getProd(id){return DB.getP().find(p=>p.id===id)}
function getCust(id){return DB.getC().find(c=>c.id===id)}
function stockStatus(p){
  if(p.stock<=0)return{l:'Out of Stock',c:'badge-red',css:'bad',tag:'oos'};
  if(p.stock<=p.thresh)return{l:'Low Stock',c:'badge-orange',css:'warn',tag:'low'};
  return{l:'In Stock',c:'badge-green',css:'good',tag:'new'};
}
function toast(msg,type){
  type=type||'success';
  var icons={success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
  var d=document.createElement('div');
  d.className='toast toast-'+type;
  d.innerHTML='<span class="toast-icon">'+icons[type]+'</span>'+msg;
  $('toast-container').appendChild(d);
  setTimeout(function(){
    d.style.opacity='0';d.style.transform='translateX(40px)';d.style.transition='all 0.3s ease';
    setTimeout(function(){d.remove()},300);
  },3000);
}

// ════════════════ NAVIGATION ════════════════
function topFunction(){window.scrollTo({top:0,behavior:'smooth'})}
function navigateTo(id){
  if(id==='page-account'&&!customerSession){id='page-auth'}
  if(id==='page-auth'&&customerSession){id='page-account'}
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active')});
  document.getElementById(id).classList.add('active');
  if(id==='page-store'){renderStore();updateNavForCustomer()}
  if(id==='page-track')document.getElementById('track-result').innerHTML='';
  if(id==='page-account')setAccountTab('orders');
  if(id==='page-admin'){if(!adminUser){navigateTo('page-login');return}document.getElementById('admin-name-top').textContent='👤 '+adminUser.user+' ('+adminUser.role+')';document.getElementById('sidebar-admin-name').textContent=adminUser.user;document.getElementById('admin-avatar').textContent=adminUser.user[0].toUpperCase();showAdminPanel('dashboard')}
  updateNavForCustomer();
}
function doLogin(){
  var u=document.getElementById('login-user').value.trim().toLowerCase();
  var p=document.getElementById('login-pass').value.trim();
  var adm=ADMINS.find(function(a){return a.user===u&&a.pass===p});
  if(adm){adminUser=adm;navigateTo('page-admin');document.getElementById('admin-name-top').textContent='👤 '+adm.user+' ('+adm.role+')';document.getElementById('sidebar-admin-name').textContent=adm.user;document.getElementById('admin-avatar').textContent=adm.user[0].toUpperCase();toast('Welcome, '+adm.user+'!')}
  else alert('Invalid credentials. admin/admin123, willy/willy123, james/james123');
}
function logout(){adminUser=null;navigateTo('page-store');toast('Logged out','info')}

function showAdminPanel(name){
  document.querySelectorAll('.admin-panel').forEach(function(p){p.classList.remove('active')});
  document.querySelectorAll('.admin-nav a').forEach(function(a){a.classList.remove('active')});
  $('panel-'+name).classList.add('active');
  var pages=['dashboard','inventory','orders','sales','customers','reports'];
  var navs=document.querySelectorAll('.admin-nav a');
  navs[pages.indexOf(name)].classList.add('active');
  var fn=window['render'+name.charAt(0).toUpperCase()+name.slice(1)];
  if(fn)fn();
}
function doLogin(){
  var u=$('login-user').value.trim().toLowerCase();
  var p=$('login-pass').value.trim();
  var adm=ADMINS.find(function(a){return a.user===u&&a.pass===p});
  if(adm){
    adminUser=adm;navigateTo('page-admin');
    toast('Welcome, '+adm.user+'!');
  }else{
    alert('Invalid credentials. Try: admin/admin123, willy/willy123, james/james123');
  }
}
function logout(){adminUser=null;navigateTo('page-store');toast('Logged out','info')}

// ════════════════ STORE ════════════════
var activeCat='All';
function renderStore(){updateNavForCustomer();
  var prods=DB.getP();
  var cats=['All'].concat([...new Set(prods.map(function(p){return p.cat}).sort())]);
  $('cat-filter').innerHTML=cats.map(function(c){
    return '<div class="cat-chip'+(c===activeCat?' active':'')+'" onclick="setCat(\''+c+'\')">'+c+'</div>';
  }).join('');

  var filtered=activeCat==='All'?prods:prods.filter(function(p){return p.cat===activeCat});
  if(filtered.length===0){
    $('store-products').innerHTML='<div class="no-results"><div class="no-results-icon">🔍</div><p>No bags found in this category</p></div>';
  }else{
    $('store-products').innerHTML=filtered.map(function(p){
      var st=stockStatus(p),tag='';
      if(p.stock<=0)tag='<div class="product-tag oos">Sold Out</div>';
      else if(p.stock<=p.thresh)tag='<div class="product-tag low">Low Stock</div>';
      else if(p.price>=4000)tag='<div class="product-tag hot">Premium</div>';
      else tag='<div class="product-tag new">New</div>';
      var disabled=(p.stock<=0)?' disabled':'';
      var btnText=(p.stock<=0)?'Out of Stock':'🛒 Add to Cart';
      return '<div class="product-card">'+tag+'<div class="product-img-wrap">'+p.emoji+'</div><div class="product-body"><h3>'+p.emoji+' '+p.name+'</h3><div class="product-cat">'+p.cat+'</div><div class="product-price-row"><span class="product-price">'+fmtKES(p.price)+'</span></div><div class="product-stock '+st.css+'"><span class="stock-dot"></span>'+st.l+' · '+p.stock+' available</div><button class="btn btn-primary btn-add-cart" onclick="addToCart(\''+p.id+'\')"'+disabled+'>'+btnText+'</button></div></div>';
    }).join('');
  }
  var sales=DB.getS(),custs=DB.getC();
  $('hero-stat-prods').textContent=prods.length+'+';
  $('hero-stat-custs').textContent=Math.max(custs.length,500)+'+';
}
function setCat(c){activeCat=c;renderStore();$('products').scrollIntoView({behavior:'smooth'})}

// ════════════════ CART ════════════════
function addToCart(pid){
  var p=getProd(pid);if(!p||p.stock<=0)return;
  var ex=cart.find(function(ci){return ci.pid===pid});
  if(ex){
    if(ex.qty>=p.stock){toast('Max stock reached!','warning');return}
    ex.qty++;
  }else{
    cart.push({pid:pid,qty:1});
  }
  refreshCart();toast('Added to cart!');
}
function removeCartItem(pid){cart=cart.filter(function(ci){return ci.pid!==pid});refreshCart()}
function cartQtyDelta(pid,d){
  var ci=cart.find(function(ci){return ci.pid===pid});
  if(!ci)return;var p=getProd(pid);
  ci.qty+=d;
  if(ci.qty<1){removeCartItem(pid);return}
  if(ci.qty>p.stock){ci.qty=p.stock;toast('Max stock reached!','warning')}
  refreshCart();
}
function refreshCart(){
  var div=$('cart-items'),cnt=$('cart-count'),tot=$('cart-total'),btn=$('btn-checkout');
  cnt.textContent=cart.reduce(function(s,ci){return s+ci.qty},0);var cnt2=document.getElementById('cart-count-2');if(cnt2)cnt2.textContent=cnt.textContent;
  if(cart.length===0){
    div.innerHTML='<div class="cart-empty"><div class="cart-empty-icon">🛒</div><p>Your cart is empty</p><p style="font-size:.78rem">Browse our collection!</p></div>';
    tot.textContent='KES 0';btn.disabled=true;
  }else{
    var total=0;
    div.innerHTML=cart.map(function(ci){
      var p=getProd(ci.pid);if(!p)return'';
      var st=p.price*ci.qty;total+=st;
      return '<div class="cart-item"><div class="cart-item-img">'+p.emoji+'</div><div class="cart-item-info"><div class="cart-item-name">'+p.name+'</div><div class="cart-item-price">'+fmtKES(p.price)+' each</div><div class="cart-item-qty"><button onclick="cartQtyDelta(\''+ci.pid+'\',-1)">-</button><span>'+ci.qty+'</span><button onclick="cartQtyDelta(\''+ci.pid+'\',1)">+</button></div></div><div class="cart-item-total">'+fmtKES(st)+'</div><button class="cart-remove" onclick="removeCartItem(\''+ci.pid+'\')" title="Remove">🗑</button></div>';
    }).join('');
    tot.textContent=fmtKES(total);btn.disabled=false;
  }
}
function toggleCart(){
  var ov=$('cart-overlay');
  ov.classList.toggle('open');
  if(ov.classList.contains('open'))refreshCart();
}

// ════════════════ M-PESA API (via our backend) ════════════════
async function stkPush(phone,amount,reference){
  var r=await fetch('/api/stk/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:phone,amount:amount,reference:reference})});
  var d=await r.json();
  if(!d.ok)throw new Error(d.error||'STK push failed');
  return d;
}
async function stkStatus(checkoutID){
  var r=await fetch('/api/stk/status/'+encodeURIComponent(checkoutID));
  return await r.json();
}
// 07XXXXXXXX / 7XXXXXXXX / +2547XXXXXXXX -> 2547XXXXXXXX, or null if not valid.
function normalizePhone(input){
  var p=String(input||'').replace(/[\s\-+()]/g,'');
  if(p.startsWith('0'))p='254'+p.slice(1);
  else if(/^[17]\d{8}$/.test(p))p='254'+p;
  return /^254[17]\d{8}$/.test(p)?p:null;
}

// ════════════════ CHECKOUT ════════════════
function openCheckout(){
  if(cart.length===0)return;
  var total=cart.reduce(function(s,ci){var p=getProd(ci.pid);return s+(p?p.price*ci.qty:0)},0);
  $('co-total').textContent=fmtKES(total);
  $('checkout-form').style.display='block';
  $('checkout-mpesa').style.display='none';
  setCoStep(1);
  $('checkout-modal').classList.add('open');
}
function closeCheckout(){stopPolling();$('checkout-modal').classList.remove('open')}
function setCoStep(n){
  for(var i=1;i<=3;i++){$('cs-'+i).classList.remove('active','done');$('ca-'+i).classList.remove('active')}
  for(var i=1;i<n;i++)$('cs-'+i).classList.add('done');
  $('cs-'+n).classList.add('active');
  if(n>1)$('ca-'+(n-1)).classList.add('active');
}

function startMpesa(){
  var name=$('co-name').value.trim(),phone=$('co-phone').value.trim();
  if(!name||!phone)return alert('Please enter your name and phone number');
  var pn=normalizePhone(phone);
  if(!pn)return alert('Invalid phone! Use 07XX XXX XXX');

  var total=cart.reduce(function(s,ci){var p=getProd(ci.pid);return s+(p?p.price*ci.qty:0)},0);
  var amount=Math.max(1,total);
  window._po={name:name,phone:phone,phoneNum:pn,addr:$('co-address').value.trim(),email:$('co-email').value.trim(),total:total};
  $('checkout-form').style.display='none';setCoStep(2);
  var md=$('checkout-mpesa');md.style.display='block';
  md.innerHTML='<div class="mpesa-screen"><div style="font-size:3.5rem">📱</div><h3 style="color:var(--pri)">M-PESA</h3><div class="mpesa-amount">'+fmtKES(total)+'</div><div class="mpesa-phone">To: '+phone+'</div><div class="spinner"></div><div class="mpesa-msg">Sending STK Push...<br><small>Check your phone for M-Pesa PIN prompt</small></div></div>';

  stkPush(pn,amount,MPESA.accountRef).then(function(r){
    window._po.cid=r.checkoutRequestId;
    md.innerHTML='<div class="mpesa-screen"><div style="font-size:3rem">📲</div><h3 style="color:var(--green)">PIN Prompt Sent!</h3><div class="mpesa-amount">'+fmtKES(total)+'</div><div class="mpesa-phone">Ref: '+r.checkoutRequestId+'</div><div id="polling-msg" class="mpesa-msg">🔐 Enter your M-Pesa PIN<br><small>Waiting for confirmation...</small></div><div style="margin-top:16px"><button class="btn btn-secondary btn-block" onclick="cancelPayment()">❌ Cancel</button></div></div>';
    startPolling(r.checkoutRequestId);
  }).catch(function(e){
    md.innerHTML='<div class="mpesa-screen"><div style="font-size:3rem">❌</div><h3 style="color:var(--red)">STK Push Failed</h3><div class="mpesa-msg">'+e.message+'</div><button class="btn btn-secondary btn-block" onclick="cancelPayment()" style="margin-top:12px">Go Back</button></div>';
  });
}

function startPolling(checkoutID){
  var attempts=0,max=40,pe=$('polling-msg');
  window._poll=setInterval(function(){
    attempts++;
    stkStatus(checkoutID).then(function(r){
      if(!r.ok)return;
      if(r.status==='SUCCESS'){
        stopPolling();
        if(pe)pe.innerHTML='✅ Payment confirmed!<br><small>Receipt: '+(r.receipt||'N/A')+'</small>';
        completePayment(r.receipt||checkoutID);
        return;
      }
      if(r.status==='FAILED'){
        stopPolling();
        if(pe)pe.innerHTML='❌ '+(r.resultDesc||'Payment failed');
        return;
      }
      var left=(max-attempts)*3;
      if(pe)pe.innerHTML='⏳ Waiting for PIN...<br><small>Check your phone ('+left+'s left)</small>';
      if(attempts>=max){stopPolling();if(pe)pe.innerHTML='⏰ Timed out<br><small>No confirmation received. If you were charged, contact support with ref '+checkoutID+'</small>'}
    }).catch(function(){if(attempts>=max)stopPolling()});
  },3000);
}
function stopPolling(){if(window._poll){clearInterval(window._poll);window._poll=null}}
function cancelPayment(){stopPolling();window._po=null;closeCheckout();toast('Payment cancelled','info')}

function completePayment(mpesaRef){
  setCoStep(3);stopPolling();
  $('checkout-mpesa').innerHTML='<div class="mpesa-screen"><div style="font-size:5rem">✅</div><h3 style="color:var(--green)">Payment Confirmed!</h3><div class="mpesa-msg">M-Pesa Ref: '+mpesaRef+'</div><button class="btn btn-primary btn-block" onclick="finalizeOrder(\''+mpesaRef+'\')" style="margin-top:16px">📦 Complete Order</button></div>';
}
function finalizeOrder(mpesaRef){
  var o=window._po;if(!o){cancelPayment();return}window._po=null;
  var custs=DB.getC();
  var cust=custs.find(function(c){return c.phone===o.phone});
  if(!cust){cust={id:uid(),name:o.name,phone:o.phone,email:o.email||'',addr:o.addr||''};custs.push(cust);DB.saveC(custs)}
  var orderId='KBI-'+uid().slice(3,11).toUpperCase();
  var sales=DB.getS(),items=[],orderTotal=0;
  cart.forEach(function(ci){
    var p=getProd(ci.pid);if(!p||ci.qty>p.stock)return;
    var st=p.price*ci.qty;orderTotal+=st;
    items.push({name:p.name,qty:ci.qty,price:p.price,emoji:p.emoji,st:st});
    sales.push({id:uid(),pid:ci.pid,cid:cust.id,qty:ci.qty,upr:p.price,tot:st,date:new Date().toISOString().split('T')[0],pay:'M-Pesa',mpesaRef:mpesaRef,orderId:orderId});
    var prods=DB.getP(),pi=prods.findIndex(function(pr){return pr.id===ci.pid});
    if(pi>=0)prods[pi].stock-=ci.qty;
    DB.saveP(prods);
  });
  DB.saveS(sales);
  var orders=DB.getO();
  orders.push({id:orderId,customerName:o.name,customerPhone:o.phone,customerEmail:o.email||'',items:items.map(function(it){return it.emoji+' '+it.name+' x'+it.qty}).join(', '),total:orderTotal,date:new Date().toISOString().split('T')[0],status:'Confirmed',mpesaRef:mpesaRef,address:o.addr||''});
  DB.saveO(orders);
  var now=new Date();
  var rows=items.map(function(it){return '<div class="rrow"><span>'+it.emoji+' '+it.name+' x'+it.qty+'</span><span>'+fmtKES(it.st)+'</span></div>'}).join('');
  $('receipt-print').innerHTML='<div class="receipt"><div class="rhdr"><h1>Kanini Bags</h1><div style="font-size:11px;color:#555">Nairobi, Kenya | M-Pesa Secure</div></div><div class="rrow"><strong>Order:</strong><span>'+orderId+'</span></div><div class="rrow"><strong>Date:</strong><span>'+now.toLocaleDateString('en-KE')+'</span></div><div class="rrow"><strong>Customer:</strong><span>'+o.name+'</span></div><div class="rline"></div>'+rows+'<div class="rline"></div><div class="rrow rtotal"><strong>TOTAL:</strong><span>'+fmtKES(orderTotal)+'</span></div><div class="rrow"><strong>Payment:</strong><span>M-Pesa ('+mpesaRef+')</span></div><div class="rline"></div><div class="rftr">Track your order: '+orderId+'<br>Thank you!</div></div>';
  cart=[];refreshCart();closeCheckout();
  toast('Order '+orderId+' confirmed!','success');
  setTimeout(function(){window.print()},400);renderStore();
}

// ════════════════ ORDER TRACKING ════════════════
function trackOrder(){
  var q=$('track-input').value.trim();if(!q)return;
  var pn=normalizePhone(q);
  var orders=DB.getO(),found=[];
  if(pn){
    // Stored phones are whatever the customer typed, so normalize both sides.
    found=orders.filter(function(o){return o.customerPhone&&normalizePhone(o.customerPhone)===pn});
  }else{
    found=orders.filter(function(o){return o.id&&o.id.toUpperCase().indexOf(q.toUpperCase())>=0});
    if(!found.length)found=orders.filter(function(o){return o.customerName&&o.customerName.toLowerCase().indexOf(q.toLowerCase())>=0});
  }
  var rd=$('track-result');
  if(found.length===0){
    rd.innerHTML='<div class="order-card"><p style="text-align:center;color:var(--muted);padding:20px">😕 No orders found for "'+q+'"<br><small>Try your Order ID (KBI-XXXXXXXX) or phone number</small></p></div>';
    return;
  }
  var stages=['Confirmed','Processing','Shipped','Delivered'];
  rd.innerHTML=found.reverse().map(function(o){
    var idx=stages.indexOf(o.status),cancelled=o.status==='Cancelled';
    var sc=cancelled?'cancelled':idx>=3?'delivered':idx>=2?'shipped':idx>=1?'processing':'pending';
    var pct=cancelled?'0%':idx>=0?((idx+1)/stages.length*90)+'%':'15%';
    return '<div class="order-card"><div class="order-card-hdr"><span class="order-card-id">📦 '+o.id+'</span><span class="status-chip '+sc+'">'+o.status+'</span></div><div class="track-progress"><div class="track-progress-line"></div><div class="track-progress-fill" style="width:'+pct+'"></div>'+stages.map(function(s,i){return '<div class="track-step"><div class="track-dot'+(i<=idx?' done':i===idx&&!cancelled?' current':'')+'"></div><span class="track-lbl'+(i<=idx?' done':'')+'">'+s+'</span></div>'}).join('')+'</div><div class="order-details"><strong>Customer:</strong> '+o.customerName+'<br><strong>Phone:</strong> '+o.customerPhone+'<br><strong>Items:</strong> '+o.items+'<br><strong>Total:</strong> '+fmtKES(o.total)+'<br><strong>Date:</strong> '+o.date+'<br><strong>Payment:</strong> M-Pesa</div></div>';
  }).join('');
}

// ════════════════ ADMIN DASHBOARD ════════════════
function renderDashboard(){
  var prods=DB.getP(),sales=DB.getS(),custs=DB.getC(),orders=DB.getO();
  var rev=sales.reduce(function(s,sl){return s+sl.tot},0);
  var stock=prods.reduce(function(s,p){return s+p.stock},0);
  $('dash-stats').innerHTML='<div class="stat-card"><div class="stat-icon rev">💰</div><div class="stat-info"><h4>Total Revenue</h4><div class="val">'+fmtKES(rev)+'</div><div class="sub">'+sales.length+' sales</div></div></div><div class="stat-card"><div class="stat-icon stk">📦</div><div class="stat-info"><h4>Total Stock</h4><div class="val">'+stock+'</div><div class="sub">'+prods.length+' products</div></div></div><div class="stat-card"><div class="stat-icon cst">👥</div><div class="stat-info"><h4>Customers</h4><div class="val">'+custs.length+'</div><div class="sub">registered</div></div></div><div class="stat-card"><div class="stat-icon ord">📋</div><div class="stat-info"><h4>Orders</h4><div class="val">'+orders.length+'</div><div class="sub">total</div></div></div>';
  var ro=[...orders].reverse().slice(0,6);
  if(ro.length===0){
    $('dash-orders-tbl').innerHTML='<tr><td colspan="5" style="text-align:center;color:#aaa;padding:16px">No orders yet</td></tr>';
  }else{
    $('dash-orders-tbl').innerHTML=ro.map(function(o){
      var bc=o.status==='Delivered'?'badge-green':o.status==='Cancelled'?'badge-red':o.status==='Shipped'?'badge-purple':o.status==='Processing'?'badge-blue':'badge-orange';
      return '<tr><td><strong>'+o.id+'</strong></td><td>'+o.customerName+'</td><td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+o.items+'</td><td style="font-weight:700">'+fmtKES(o.total)+'</td><td><span class="badge '+bc+'">'+o.status+'</span></td></tr>';
    }).join('');
  }
  var low=prods.filter(function(p){return p.stock<=p.thresh});
  if(low.length===0){
    $('dash-lowstock').innerHTML='<p style="color:var(--green);text-align:center;padding:16px">✅ All products well-stocked!</p>';
  }else{
    $('dash-lowstock').innerHTML=low.map(function(p){
      var bg=p.stock===0?'var(--red)':'var(--orange)';
      var bc2=p.stock===0?'badge-red':'badge-orange';
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="width:34px;height:34px;border-radius:50%;background:'+bg+';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.7rem;flex-shrink:0">'+p.emoji+'</div><div style="flex:1"><div style="font-weight:600;font-size:.84rem">'+p.name+'</div><div style="font-size:.72rem;color:var(--muted)"><span class="badge '+bc2+'">'+(p.stock===0?'Out':'Low')+'</span> '+p.stock+' left</div></div><div style="font-weight:600;font-size:.84rem">'+fmtKES(p.price)+'</div></div>';
    }).join('');
  }
  var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var colors=['#7C3AED','#9B6DF0','#B794F4','#6D28D9','#7C3AED','#9B6DF0','#7C3AED','#9B6DF0','#B794F4','#6D28D9','#7C3AED','#9B6DF0'];
  var md={};months.forEach(function(m){md[m]=0});
  sales.forEach(function(s){var m=months[new Date(s.date).getMonth()];if(m)md[m]+=s.tot});
  var mx=Math.max.apply(null,Object.values(md));if(mx===0)mx=1;
  $('dash-chart').innerHTML=months.map(function(m,i){
    return '<div class="chart-bar-group"><div class="chart-bar" style="height:'+Math.max(4,Math.round(md[m]/mx*120))+'px;background:'+colors[i]+'" title="'+m+': '+fmtKES(md[m])+'"></div><span class="chart-bar-lbl">'+m+'</span></div>';
  }).join('');
}

function renderInventory(){
  var prods=DB.getP();
  if(prods.length===0){
    $('inv-table').innerHTML='<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px">No products yet. Click "+ Add Product" to add one!</td></tr>';
  }else{
    $('inv-table').innerHTML=prods.map(function(p){
      var st=stockStatus(p);
      return '<tr><td><strong>'+p.emoji+' '+p.name+'</strong><br><small style="color:#aaa">'+(p.desc||'')+'</small></td><td>'+p.cat+'</td><td>'+fmtKES(p.price)+'</td><td>'+p.stock+'</td><td><span class="badge '+st.c+'">'+st.l+'</span></td><td style="text-align:right"><div class="action-btns"><button class="btn btn-secondary btn-sm" onclick="editProduct(\''+p.id+'\')">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteProduct(\''+p.id+'\')">Del</button></div></td></tr>';
    }).join('');
  }
}

function openProdModal(id){
  $('prod-edit-id').value='';
  $('prod-modal-title').textContent='Add New Bag';
  ['prod-name','prod-price','prod-stock','prod-desc'].forEach(function(x){$(x).value=''});
  $('prod-thresh').value='5';
  $('prod-cat').value='Backpack';
  $('prod-emoji').value='🧳';
  if(id){
    var p=getProd(id);
    if(p){
      $('prod-edit-id').value=p.id;
      $('prod-modal-title').textContent='Edit Bag';
      $('prod-name').value=p.name;
      $('prod-price').value=p.price;
      $('prod-stock').value=p.stock;
      $('prod-thresh').value=p.thresh;
      $('prod-desc').value=p.desc||'';
      $('prod-cat').value=p.cat;
      $('prod-emoji').value=p.emoji;
    }
  }
  $('prod-modal').classList.add('open');
}
function closeProdModal(){$('prod-modal').classList.remove('open')}
function editProduct(id){openProdModal(id)}
function deleteProduct(id){
  if(!confirm('Delete this product?'))return;
  DB.saveP(DB.getP().filter(function(p){return p.id!==id}));
  renderInventory();renderDashboard();renderStore();
  toast('Product deleted','warning');
}
function saveProduct(){
  var nm=$('prod-name').value.trim();
  var pr=parseInt($('prod-price').value)||0;
  if(!nm||pr<=0)return alert('Please enter name and price');
  var st=parseInt($('prod-stock').value)||0;
  var th=parseInt($('prod-thresh').value)||5;
  var prods=DB.getP(),eid=$('prod-edit-id').value;
  if(eid){
    var idx=prods.findIndex(function(p){return p.id===eid});
    if(idx>=0){
      prods[idx].name=nm;
      prods[idx].cat=$('prod-cat').value;
      prods[idx].price=pr;
      prods[idx].stock=st;
      prods[idx].thresh=th;
      prods[idx].desc=$('prod-desc').value;
      prods[idx].emoji=$('prod-emoji').value;
    }
  }else{
    prods.push({id:uid(),name:nm,cat:$('prod-cat').value,price:pr,stock:st,thresh:th,desc:$('prod-desc').value,emoji:$('prod-emoji').value});
  }
  DB.saveP(prods);closeProdModal();
  renderInventory();renderDashboard();renderStore();
  toast(eid?'Product updated!':'Product added!');
}

function renderOrders(){
  var orders=DB.getO();
  if(orders.length===0){
    $('orders-table').innerHTML='<tr><td colspan="8" style="text-align:center;color:#aaa;padding:20px">No orders yet</td></tr>';
  }else{
    $('orders-table').innerHTML=[...orders].reverse().map(function(o){
      var bc=o.status==='Delivered'?'badge-green':o.status==='Cancelled'?'badge-red':o.status==='Shipped'?'badge-purple':o.status==='Processing'?'badge-blue':'badge-orange';
      return '<tr><td><strong>'+o.id+'</strong></td><td>'+o.customerName+'</td><td>'+o.customerPhone+'</td><td>'+o.date+'</td><td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+o.items+'</td><td><strong>'+fmtKES(o.total)+'</strong></td><td><span class="badge '+bc+'">'+o.status+'</span></td><td style="text-align:right"><select onchange="updateOrderStatus(\''+o.id+'\',this.value)" style="padding:5px 8px;border-radius:6px;border:1px solid #ddd;font-size:.75rem;font-family:inherit"><option value="">Update</option><option value="Confirmed">Confirmed</option><option value="Processing">Processing</option><option value="Shipped">Shipped</option><option value="Delivered">Delivered</option><option value="Cancelled">Cancelled</option></select></td></tr>';
    }).join('');
  }
}
function updateOrderStatus(orderId,newStatus){
  if(!newStatus)return;
  var orders=DB.getO();
  var idx=orders.findIndex(function(o){return o.id===orderId});
  if(idx>=0){orders[idx].status=newStatus;DB.saveO(orders);renderOrders();renderDashboard();toast('Order '+orderId+' -> '+newStatus)}
}

function renderSales(){
  var sales=DB.getS();
  if(sales.length===0){
    $('sales-table').innerHTML='<tr><td colspan="8" style="text-align:center;color:#aaa;padding:20px">No sales recorded</td></tr>';
  }else{
    $('sales-table').innerHTML=[...sales].reverse().slice(0,40).map(function(s){
      var p=getProd(s.pid),c=getCust(s.cid);
      return '<tr><td>'+s.date+'</td><td><strong>'+(s.orderId||'N/A')+'</strong></td><td>'+(c?c.name:'Walk-in')+'</td><td>'+(p?p.emoji+' '+p.name:'?')+'</td><td>'+s.qty+'</td><td><strong>'+fmtKES(s.tot)+'</strong></td><td><span class="badge badge-blue">'+(s.pay||'M-Pesa')+'</span></td><td style="text-align:right"><button class="btn btn-danger btn-sm" onclick="deleteSale(\''+s.id+'\')">Del</button></td></tr>';
    }).join('');
  }
}
function deleteSale(id){if(!confirm('Delete this sale record?'))return;DB.saveS(DB.getS().filter(function(s){return s.id!==id}));renderSales();renderDashboard()}

function renderCustomers(){
  var custs=DB.getC(),sales=DB.getS();
  if(custs.length===0){
    $('cust-table').innerHTML='<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px">No customers yet</td></tr>';
  }else{
    $('cust-table').innerHTML=custs.map(function(c){
      var cs=sales.filter(function(s){return s.cid===c.id});
      var sp=cs.reduce(function(s,sl){return s+sl.tot},0);
      return '<tr><td><strong>'+c.name+'</strong></td><td>'+c.phone+'</td><td>'+c.email+'</td><td>'+cs.length+'</td><td>'+fmtKES(sp)+'</td><td style="text-align:right"><button class="btn btn-danger btn-sm" onclick="deleteCust(\''+c.id+'\')">Del</button></td></tr>';
    }).join('');
  }
}
function deleteCust(id){if(!confirm('Delete this customer?'))return;DB.saveC(DB.getC().filter(function(c){return c.id!==id}));renderCustomers()}

function renderReports(){
  var prods=DB.getP(),sales=DB.getS(),orders=DB.getO();
  var rev=sales.reduce(function(s,sl){return s+sl.tot},0);
  var units=sales.reduce(function(s,sl){return s+sl.qty},0);
  var avg=sales.length?Math.round(rev/sales.length):0;
  $('rep-stats').innerHTML='<div class="stat-card"><div class="stat-icon rev">💰</div><div class="stat-info"><h4>Total Revenue</h4><div class="val">'+fmtKES(rev)+'</div><div class="sub">all time</div></div></div><div class="stat-card"><div class="stat-icon stk">📦</div><div class="stat-info"><h4>Bags Sold</h4><div class="val">'+units+'</div><div class="sub">'+sales.length+' sales</div></div></div><div class="stat-card"><div class="stat-icon cst">👥</div><div class="stat-info"><h4>Avg Order</h4><div class="val">'+fmtKES(avg)+'</div><div class="sub">per sale</div></div></div><div class="stat-card"><div class="stat-icon ord">📋</div><div class="stat-info"><h4>Orders</h4><div class="val">'+orders.length+'</div><div class="sub">total</div></div></div>';
  var ps={};
  sales.forEach(function(s){if(!ps[s.pid])ps[s.pid]={u:0,r:0};ps[s.pid].u+=s.qty;ps[s.pid].r+=s.tot});
  var tp=Object.entries(ps).sort(function(a,b){return b[1].r-a[1].r}).slice(0,5);
  if(tp.length===0){
    $('rep-topprod').innerHTML='<tr><td colspan="3" style="text-align:center;color:#aaa">No sales data</td></tr>';
  }else{
    $('rep-topprod').innerHTML=tp.map(function(e){var pid=e[0],d=e[1],p=getProd(pid);return '<tr><td><strong>'+(p?p.emoji+' '+p.name:'?')+'</strong></td><td>'+d.u+'</td><td>'+fmtKES(d.r)+'</td></tr>'}).join('');
  }
  var cs={};
  sales.forEach(function(s){if(!cs[s.cid])cs[s.cid]={o:0,s:0};cs[s.cid].o++;cs[s.cid].s+=s.tot});
  var tc=Object.entries(cs).sort(function(a,b){return b[1].s-a[1].s}).slice(0,5);
  if(tc.length===0){
    $('rep-topcust').innerHTML='<tr><td colspan="3" style="text-align:center;color:#aaa">No customer data</td></tr>';
  }else{
    $('rep-topcust').innerHTML=tc.map(function(e){var cid=e[0],d=e[1],c=getCust(cid);return '<tr><td><strong>'+(c?c.name:'?')+'</strong></td><td>'+d.o+'</td><td>'+fmtKES(d.s)+'</td></tr>'}).join('');
  }
}

// ════════════════ INIT ════════════════
renderStore();
