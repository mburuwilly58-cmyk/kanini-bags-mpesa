var DB={get:function(k,d){try{return JSON.parse(localStorage.getItem(k)||d)}catch(e){return JSON.parse(d)}},set:function(k,v){localStorage.setItem(k,JSON.stringify(v))},products:function(){return this.get('kc_prods','[]')},setProducts:function(d){this.set('kc_prods',d)},orders:function(){return this.get('kc_ords','[]')},setOrders:function(d){this.set('kc_ords',d)}};
var IMG={travel:'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=280&fit=crop',backpack:'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=400&h=280&fit=crop',handbag:'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=280&fit=crop',laptop:'https://images.unsplash.com/photo-1622560480654-d96214fdc887?w=400&h=280&fit=crop',fb:'https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?w=400&h=280&fit=crop'};
var cart=[],activeCat='All',currentPage='store',checkoutData=null,stkTimer=null;

function $(id){return document.getElementById(id)}
function fmtKES(n){return'KES '+parseInt(n).toLocaleString('en-KE')}
function uid(){return'KBI-'+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,6).toUpperCase()}
function now(){return new Date().toISOString().split('T')[0]}
function nw(){return new Date().toLocaleString('en-KE')}
function fp(id){return DB.products().find(function(p){return p.id===id})}
function ss(p){if(p.stock<=0)return{l:'Out of Stock',c:'be',css:'out'};if(p.stock<=p.thresh)return{l:'Low Stock',c:'bp2',css:'low'};return{l:'In Stock',c:'bs',css:'in'}}
function toast(m,e){var d=document.createElement('div');d.className='toast'+(e?' err':'');d.textContent=(e?'❌ ':'✅ ')+m;document.body.appendChild(d);setTimeout(function(){d.style.opacity='0';d.style.transition='all .3s';setTimeout(function(){d.remove()},300)},2500)}

function seed(){
  if(DB.products().length===0){
    DB.setProducts([{id:'p1',name:'Premium Leather Travel Bag',cat:'Travel Bag',price:5500,stock:22,thresh:5,desc:'Genuine leather for trips.',img:IMG.travel},{id:'p2',name:'Urban Canvas Backpack',cat:'Backpack',price:2800,stock:45,thresh:10,desc:'Heavy-duty canvas, padded laptop.',img:IMG.backpack},{id:'p3',name:'Elegant Ladies Handbag',cat:'Handbag',price:3800,stock:16,thresh:5,desc:'Vegan leather, gold hardware.',img:IMG.handbag},{id:'p4',name:'Slim Laptop Sleeve',cat:'Laptop Bag',price:1900,stock:3,thresh:5,desc:'Waterproof neoprene.',img:IMG.laptop},{id:'p5',name:'Eco Cotton Tote',cat:'Tote Bag',price:1200,stock:58,thresh:10,desc:'100% organic cotton.',img:IMG.fb},{id:'p6',name:'Pro Sports Duffel',cat:'Duffel Bag',price:4200,stock:14,thresh:5,desc:'50L with shoe compartment.',img:IMG.fb},{id:'p7',name:'Kids School Bag',cat:'School Bag',price:1600,stock:32,thresh:8,desc:'Lightweight, fun prints.',img:IMG.fb},{id:'p8',name:'Leather Messenger',cat:'Messenger Bag',price:3200,stock:9,thresh:5,desc:'Full-grain leather, fits tablet.',img:IMG.fb}]);
  }
}
seed();

function sp(p){
  currentPage=p;
  $('pg-store').style.display=p==='store'?'block':'none';
  $('pg-orders').style.display=p==='orders'?'block':'none';
  $('pg-track').style.display=p==='track'?'block':'none';
  $('pg-admin').style.display=p==='admin'?'block':'none';
  if(p==='store')rs();if(p==='orders')ro();if(p==='admin')loadAdmin();
  window.scrollTo({top:0,behavior:'smooth'});
}

function rs(){
  var prods=DB.products();
  var cats=['All'].concat([].concat.apply([],new Set(prods.map(function(p){return p.cat}).sort())).filter(function(v,i,a){return a.indexOf(v)===i}));
  $('cf').innerHTML=cats.map(function(c){return'<button class="cc'+(c===activeCat?' active':'')+'" onclick="sc(\''+c+'\')">'+c+'</button>'}).join('');
  var f=activeCat==='All'?prods:prods.filter(function(p){return p.cat===activeCat});
  $('store-prods').innerHTML=f.map(function(p){
    var s=ss(p),tag='',dis='';
    if(p.stock<=0){tag='<div class="pb bo">Sold Out</div>';dis=' disabled'}
    else if(p.stock<=p.thresh)tag='<div class="pb blw">Low Stock</div>';
    else tag='<div class="pb bn">New</div>';
    return'<div class="pc"><div class="piw">'+tag+'<img class="pi" src="'+p.img+'" loading="lazy" onerror="this.src=\''+IMG.fb+'\'"></div><div class="pbd"><h3>'+p.name+'</h3><div class="ppc">'+p.cat+'</div><div class="ppr">'+fmtKES(p.price)+'</div><div class="ps '+s.css+'"><span class="sd"></span>'+s.l+' · '+p.stock+' left</div><button class="btn btn-pri btn-sm" onclick="ac(\''+p.id+'\')"'+dis+' style="width:100%">'+(p.stock<=0?'Sold Out':'🛒 Add to Cart')+'</button></div></div>';
  }).join('');
}
function sc(c){activeCat=c;rs();document.getElementById('store-prods').scrollIntoView({behavior:'smooth'})}

function ac(pid){
  requireAuth(function(){
    var p=fp(pid);if(!p||p.stock<=0)return;
    var ex=cart.find(function(x){return x.pid===pid});
    if(ex){if(ex.qty>=p.stock){toast('Max stock!',true);return}ex.qty++}
    else cart.push({pid:pid,qty:1});
    rc();toast('Added!');
  });
}
function rc(){
  $('cc').textContent=cart.reduce(function(s,x){return s+x.qty},0);
  if(cart.length===0){$('ci').innerHTML='<div class="ce"><div class="ei">🛒</div><p>Empty cart</p></div>';$('cttv').textContent='KES 0';$('bco').disabled=true;return}
  var total=0;
  $('ci').innerHTML=cart.map(function(x){var p=fp(x.pid);if(!p)return'';var st=p.price*x.qty;total+=st;
    return'<div class="ci"><img class="cim" src="'+p.img+'" onerror="this.src=\''+IMG.fb+'\'"><div class="cii"><div class="cin">'+p.name+'</div><div class="ciq"><button onclick="qc(\''+x.pid+'\',-1)">\u2212</button><span>'+x.qty+'</span><button onclick="qc(\''+x.pid+'\',1)">+</button></div></div><div class="cit">'+fmtKES(st)+'</div></div>';
  }).join('');
  $('cttv').textContent=fmtKES(total);$('bco').disabled=false;
}
function qc(pid,d){var x=cart.find(function(x){return x.pid===pid});if(!x)return;var p=fp(pid);x.qty+=d;if(x.qty<1){cart=cart.filter(function(c){return c.pid!==pid})}else if(x.qty>p.stock){x.qty=p.stock;toast('Max!',true)}rc()}
function tc(){$('co').classList.toggle('open')}

function oc(){
  if(cart.length===0)return;
  requireAuth(function(){
    var total=cart.reduce(function(s,x){var p=fp(x.pid);return s+(p?p.price*x.qty:0)},0);
    $('cot').textContent=fmtKES(total);
    $('co').classList.remove('open');
    $('cm').classList.add('open');
  });
}
function cc(){$('cm').classList.remove('open');checkoutData=null}

function smf(){
  var name=$('con').value.trim(),phone=$('cop').value.trim(),addr=$('coa').value.trim(),email=$('coe').value.trim();
  if(!name||!phone)return toast('Name + phone required',true);
  var pn=phone.replace(/[^0-9]/g,'');
  if(pn.startsWith('0'))pn='254'+pn.slice(1);else if(pn.length===9&&pn.startsWith('7'))pn='254'+pn;else if(!pn.startsWith('254'))pn='254'+pn;
  var total=cart.reduce(function(s,x){var p=fp(x.pid);return s+(p?p.price*x.qty:0)},0);
  checkoutData={name:name,phone:phone,pn:pn,addr:addr,email:email,total:total,items:cart.slice()};
  $('cm').classList.remove('open');
  showMpesaPin(total);
}

function showMpesaPin(amount){
  $('mad').textContent=fmtKES(amount);
  $('mtd').textContent='Pay to: Kanini Bags (174379)';
  $('stkw').className='stk-wait';
  $('stkw').innerHTML='<div class="stk-spin"></div>';
  $('pf').textContent='Sending STK Push...';$('pf').style.color='var(--mu)';
  $('mpo').classList.add('open');

  stkPush(checkoutData.pn,amount).then(function(r){
    $('pf').innerHTML='📲 Check your phone<br>Enter your M-Pesa PIN';
    $('pf').style.color='var(--pri)';
    pollStk(r.checkoutRequestId);
  }).catch(function(e){
    stkFail(e.message);
  });
}

// The PIN is entered on the phone's SIM prompt. Safaricom never sends it to us,
// and a web page that asks for an M-Pesa PIN is indistinguishable from phishing.
async function stkPush(phone,amount){
  // Send the basket too, so the admin can see what each payment was for.
  var items=(checkoutData&&checkoutData.items||[]).map(function(x){
    var p=fp(x.pid);
    return {name:p?p.name:'Unknown',qty:x.qty,price:p?p.price:0};
  });
  var r=await fetch('api/stk_push.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:phone,amount:amount,items:items})});
  var d=await r.json();
  if(!d.ok)throw new Error(d.error||'STK push failed');
  return d;
}

function pollStk(id){
  var tries=0,max=40;
  stkTimer=setInterval(function(){
    tries++;
    fetch('api/status.php?id='+encodeURIComponent(id)).then(function(r){return r.json()}).then(function(d){
      if(!d.ok)return;
      if(d.status==='SUCCESS'){stopStk();stkDone(d.receipt);return}
      if(d.status==='FAILED'){stopStk();stkFail(d.resultDesc||'Payment failed');return}
      $('pf').innerHTML='📲 Check your phone<br><small>Waiting for PIN · '+((max-tries)*3)+'s</small>';
      if(tries>=max){stopStk();stkFail('Timed out. If you were charged, keep ref '+id)}
    }).catch(function(){if(tries>=max)stopStk()});
  },3000);
}
function stopStk(){if(stkTimer){clearInterval(stkTimer);stkTimer=null}}

function stkDone(receipt){
  $('stkw').className='stk-wait done';
  $('stkw').innerHTML='<div class="stk-icon">✅</div>';
  $('pf').textContent='Payment confirmed';$('pf').style.color='var(--gn)';
  setTimeout(function(){$('mpo').classList.remove('open');completeOrder(receipt)},900);
}
function stkFail(msg){
  $('stkw').className='stk-wait done';
  $('stkw').innerHTML='<div class="stk-icon">❌</div>';
  $('pf').textContent=msg;$('pf').style.color='var(--rd)';
  setTimeout(function(){$('mpo').classList.remove('open');checkoutData=null},3500);
}
function cancelStk(){stopStk();$('mpo').classList.remove('open');checkoutData=null;toast('Cancelled')}

function completeOrder(receipt){
  if(!checkoutData)return;
  var cd=checkoutData;
  var orderId=uid();
  var prods=DB.products();
  cd.items.forEach(function(x){var i=prods.findIndex(function(p){return p.id===x.pid});if(i>=0)prods[i].stock=Math.max(0,prods[i].stock-x.qty)});
  DB.setProducts(prods);
  var order={id:orderId,customerName:cd.name,phone:cd.phone,phoneNum:cd.pn,address:cd.addr||'',email:cd.email||'',items:cd.items.map(function(x){var p=fp(x.pid);return p?p.name+' x'+x.qty:'Unknown'}),total:cd.total,date:now(),time:nw(),status:'Confirmed',mpesaRef:receipt,paymentMethod:'M-Pesa STK Push'};
  var orders=DB.orders();orders.push(order);DB.setOrders(orders);
  $('odc').innerHTML='<div class="rb ok"><div style="font-size:3rem;margin-bottom:6px">\u2705</div><h3 style="color:var(--gn);margin-bottom:12px">Payment Successful!</h3><div class="dg"><div class="di"><div class="lbl">Order ID</div><div class="val" style="color:var(--pri);font-size:.9rem"><strong>'+orderId+'</strong></div></div><div class="di"><div class="lbl">Customer</div><div class="val">'+cd.name+'</div></div><div class="di"><div class="lbl">M-Pesa Ref</div><div class="val"><span class="badge bs">'+receipt+'</span></div></div><div class="di"><div class="lbl">Total</div><div class="val" style="color:var(--pri);font-weight:700">'+fmtKES(cd.total)+'</div></div><div class="di"><div class="lbl">Phone</div><div class="val">'+cd.phone+'</div></div><div class="di"><div class="lbl">Date</div><div class="val">'+nw()+'</div></div><div class="di"><div class="lbl">Status</div><div class="val"><span class="badge bs">Confirmed</span></div></div><div class="di"><div class="lbl">Payment</div><div class="val">M-Pesa STK Push</div></div></div><p style="margin-top:12px;font-size:.78rem;color:var(--mu)">\ud83d\udca1 Save Order ID: <strong>'+orderId+'</strong></p><button class="btn btn-pri" onclick="finOrder()" style="margin-top:10px">Continue Shopping</button></div>';
  $('odm').classList.add('open');
  cart=[];rc();rs();checkoutData=null;
  toast('Order '+orderId+' confirmed!');
}
function finOrder(){$('odm').classList.remove('open')}

function ro(){
  var pf=($('opf').value||'').replace(/[^0-9]/g,''),sf=$('osf').value;
  var orders=DB.orders();
  if(pf)orders=orders.filter(function(o){return((o.phone||'')+(o.phoneNum||'')).replace(/[^0-9]/g,'').includes(pf)});
  if(sf)orders=orders.filter(function(o){return o.status===sf});
  orders=[].concat(orders).reverse();
  var stages=['Confirmed','Processing','Shipped','Delivered'],d=$('ol');
  if(orders.length===0){d.innerHTML='<div class="es"><div class="ei">\ud83d\udccb</div><p>No orders</p></div>';return}
  d.innerHTML=orders.map(function(o){
    var idx=stages.indexOf(o.status),c=o.status==='Cancelled';
    var sc=c?'Cancelled':idx>=3?'Delivered':idx>=2?'Shipped':idx>=1?'Processing':'Confirmed';
    var pct=c?'0%':idx>=0?((idx+1)/stages.length*90)+'%':'18%';
    var bc=sc==='Delivered'?'bs':sc==='Cancelled'?'be':sc==='Shipped'?'bpu':sc==='Processing'?'bi':'bs';
    var items=(Array.isArray(o.items)?o.items:[]).join(', ');
    return'<div class="ob"><div class="oh"><span class="oi">\ud83d\udce6 '+o.id+'</span><span class="badge '+bc+'">'+o.status+'</span></div><div class="prg"><div class="prl"></div><div class="prf" style="width:'+pct+'"></div>'+stages.map(function(s,i){return'<div class="st"><div class="sd2'+(i<=idx?' done':i===idx&&!c?' cur':'')+'"></div><span class="sl'+(i<=idx?' done':'')+'">'+s+'</span></div>'}).join('')+'</div><div class="dg"><div class="di"><div class="lbl">Customer</div><div class="val">'+o.customerName+'</div></div><div class="di"><div class="lbl">Phone</div><div class="val">'+o.phone+'</div></div><div class="di"><div class="lbl">Total</div><div class="val" style="color:var(--pri);font-weight:700">'+fmtKES(o.total)+'</div></div><div class="di"><div class="lbl">M-Pesa</div><div class="val">'+(o.mpesaRef||'\u2014')+'</div></div><div class="di"><div class="lbl">Items</div><div class="val" style="font-size:.75rem">'+items+'</div></div><div class="di"><div class="lbl">Date</div><div class="val">'+o.date+'</div></div></div><div style="margin-top:8px;text-align:right"><select onchange="uos(\''+o.id+'\',this.value)" style="padding:4px 8px;border-radius:6px;border:1px solid var(--bd);font-size:.7rem;font-family:inherit;cursor:pointer"><option value="">Update</option><option>Confirmed</option><option>Processing</option><option>Shipped</option><option>Delivered</option><option>Cancelled</option></select></div></div>';
  }).join('');
}

function uos(oid,ns){if(!ns)return;var orders=DB.orders();var i=orders.findIndex(function(o){return o.id===oid});if(i>=0){orders[i].status=ns;DB.setOrders(orders);ro();toast(oid+' \u2192 '+ns)}}

function ts(){
  var q=$('ti').value.trim();if(!q)return;
  var pn=q.replace(/[^0-9]/g,'');if(pn.startsWith('0'))pn='254'+pn.slice(1);
  var isPhone=pn.length>=10;
  var orders=DB.orders();
  var found=isPhone?orders.filter(function(o){return((o.phone||'')+(o.phoneNum||'')).replace(/[^0-9]/g,'').includes(pn)}):orders.filter(function(o){return(o.id||'').toUpperCase().includes(q.toUpperCase())||(o.customerName||'').toLowerCase().includes(q.toLowerCase())});
  var d=$('tr');
  if(!found.length){d.innerHTML='<div class="es"><div class="ei">\ud83d\udd0d</div><p>Not found: '+q+'</p></div>';return}
  var stages=['Confirmed','Processing','Shipped','Delivered'];
  d.innerHTML=[].concat(found).reverse().map(function(o){
    var idx=stages.indexOf(o.status),c=o.status==='Cancelled';
    var sc=c?'Cancelled':idx>=3?'Delivered':idx>=2?'Shipped':idx>=1?'Processing':'Confirmed';
    var pct=c?'0%':idx>=0?((idx+1)/stages.length*90)+'%':'18%';
    var bc=sc==='Delivered'?'bs':sc==='Cancelled'?'be':sc==='Shipped'?'bpu':sc==='Processing'?'bi':'bs';
    var items=(Array.isArray(o.items)?o.items:[]).join(', ');
    return'<div class="ob"><div class="oh"><span class="oi">\ud83d\udce6 '+o.id+'</span><span class="badge '+bc+'">'+o.status+'</span></div><div class="prg"><div class="prl"></div><div class="prf" style="width:'+pct+'"></div>'+stages.map(function(s,i){return'<div class="st"><div class="sd2'+(i<=idx?' done':i===idx&&!c?' cur':'')+'"></div><span class="sl'+(i<=idx?' done':'')+'">'+s+'</span></div>'}).join('')+'</div><div class="dg"><div class="di"><div class="lbl">Customer</div><div class="val">'+o.customerName+'</div></div><div class="di"><div class="lbl">Phone</div><div class="val">'+o.phone+'</div></div><div class="di"><div class="lbl">Total</div><div class="val" style="color:var(--pri);font-weight:700">'+fmtKES(o.total)+'</div></div><div class="di"><div class="lbl">Ref</div><div class="val">'+(o.mpesaRef||'\u2014')+'</div></div><div class="di"><div class="lbl">Items</div><div class="val" style="font-size:.75rem">'+items+'</div></div><div class="di"><div class="lbl">Date</div><div class="val">'+o.date+'</div></div></div></div>';
  }).join('');
}

rs();rc();

// ════════════════ AUTH ════════════════
var currentUser=null;

function openAuth(tab){switchAuth(tab||'in');$('am').classList.add('open')}
function closeAuth(){$('am').classList.remove('open');$('li-err').textContent='';$('su-err').textContent=''}
function switchAuth(tab){
  var isIn=tab==='in';
  $('at-in').classList.toggle('active',isIn);
  $('at-up').classList.toggle('active',!isIn);
  $('auth-pane-in').style.display=isIn?'block':'none';
  $('auth-pane-up').style.display=isIn?'none':'block';
  $('li-err').textContent='';$('su-err').textContent='';
}

async function postJSON(url,body){
  var r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});
  var d=await r.json();
  if(!d.ok)throw new Error(d.error||'Request failed');
  return d;
}

function doLogin(){
  var err=$('li-err');err.className='auth-err';err.textContent='Signing in...';
  postJSON('api/auth_login.php',{email:$('li-email').value.trim(),password:$('li-pass').value}).then(function(d){
    setUser(d.user);closeAuth();toast('Welcome back, '+d.user.name.split(' ')[0]+'!');
    $('li-pass').value='';
  }).catch(function(e){err.textContent=e.message});
}

function doSignup(){
  var err=$('su-err');err.className='auth-err';err.textContent='Creating account...';
  postJSON('api/auth_signup.php',{
    name:$('su-name').value.trim(),email:$('su-email').value.trim(),
    phone:$('su-phone').value.trim(),address:$('su-addr').value.trim(),
    password:$('su-pass').value
  }).then(function(d){
    setUser(d.user);closeAuth();toast('Account created. Welcome, '+d.user.name.split(' ')[0]+'!');
    $('su-pass').value='';
  }).catch(function(e){err.textContent=e.message});
}

function doLogout(){
  postJSON('api/auth_logout.php').then(function(){
    setUser(null);toast('Signed out');
  }).catch(function(e){toast(e.message,true)});
}

function setUser(u){
  currentUser=u;
  var inEl=$('auth-in'),outEl=$('auth-out');
  // Hiding the link is cosmetic; admin_data.php enforces the real check.
  $('nav-admin').style.display=(u&&u.role==='admin')?'inline-block':'none';
  if(u){
    outEl.style.display='none';inEl.style.display='flex';
    $('nav-user').textContent=(u.role==='admin'?'🛡 ':'👤 ')+u.name.split(' ')[0];
    // Prefill checkout from the account so the customer isn't retyping it.
    if(u.name)$('con').value=u.name;
    if(u.phone)$('cop').value=u.phone;
    if(u.address)$('coa').value=u.address;
    if(u.email)$('coe').value=u.email;
  }else{
    outEl.style.display='inline-block';inEl.style.display='none';
    $('nav-user').textContent='';
  }
}

// Sessions live in a cookie, so a refresh should keep you signed in.
var authReady=fetch('api/auth_me.php').then(function(r){return r.json()}).then(function(d){
  if(d.ok&&d.user)setUser(d.user);
}).catch(function(){/* signed out, or API unreachable */});

// Gate for actions that need an account. On a cold page load the session check
// may still be in flight, so wait for it rather than bouncing a signed-in user
// to the login modal. This is a convenience, not a security control — the real
// check is server-side in stk_push.php, since anyone can POST to the API directly.
function requireAuth(next){
  if(currentUser)return next();
  authReady.then(function(){
    if(currentUser)return next();
    openAuth('in');
    toast('Please sign in to continue',true);
  });
}

// ════════════════ ADMIN ════════════════
var admData=null,admActive='tx';

// Customer names, emails and item names are user-controlled and land in
// innerHTML below. Without escaping, a customer could sign up as
// <img src=x onerror=...> and run script in the admin's session.
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function admDate(ts){return ts?new Date(ts*1000).toLocaleString('en-KE'):'—'}
function admBadge(st){
  var m={SUCCESS:['bs','✅ Paid'],PENDING:['bp2','⏳ Pending'],FAILED:['be','❌ Failed']};
  var b=m[st]||['bp2',st];
  return '<span class="badge '+b[0]+'">'+b[1]+'</span>';
}

function admTab(t){
  admActive=t;
  $('ad-t-tx').classList.toggle('active',t==='tx');
  $('ad-t-cu').classList.toggle('active',t==='cu');
  $('adm-pane-tx').style.display=t==='tx'?'block':'none';
  $('adm-pane-cu').style.display=t==='cu'?'block':'none';
}

function loadAdmin(){
  fetch('api/admin_data.php').then(function(r){return r.json()}).then(function(d){
    if(!d.ok){toast(d.error||'Could not load admin data',true);return}
    admData=d;renderAdmStats(d.stats);renderAdmTx(d.transactions);renderAdmCu(d.customers);
  }).catch(function(e){toast('Admin data failed: '+e.message,true)});
}

function renderAdmStats(s){
  var cards=[
    ['rev','Revenue',fmtKES(s.revenue||0)],
    ['ok','Paid',s.paid||0],
    ['pend','Pending',s.pending||0],
    ['fail','Failed',s.failed||0],
    ['','Customers',s.customers==null?'—':s.customers]
  ];
  $('adm-stats').innerHTML=cards.map(function(c){
    return '<div class="adm-card '+c[0]+'"><div class="lbl">'+c[1]+'</div><div class="val">'+c[2]+'</div></div>';
  }).join('');
}

function renderAdmTx(tx){
  if(!tx.length){$('adm-tx').innerHTML='<tr><td class="adm-empty">No transactions yet. They appear here as soon as a customer pays.</td></tr>';return}
  var head='<tr><th>When</th><th>Customer</th><th>Phone</th><th>Items</th><th>Amount</th><th>Status</th><th>Receipt</th></tr>';
  $('adm-tx').innerHTML=head+tx.map(function(t){
    var items=(t.items||[]).map(function(i){return esc(i.name)+' ×'+i.qty}).join(', ')||'—';
    var receipt=t.receipt?'<span class="adm-mono">'+esc(t.receipt)+'</span>'
                        :(t.reason?'<span class="adm-items">'+esc(t.reason)+'</span>':'—');
    return '<tr><td>'+admDate(t.created)+'</td><td>'+esc(t.customer||'—')+'<div class="adm-items">'+esc(t.email||'')+'</div></td>'+
      '<td class="adm-mono">'+esc(t.phone)+'</td><td class="adm-items">'+items+'</td>'+
      '<td><strong>'+fmtKES(t.amount)+'</strong></td><td>'+admBadge(t.status)+'</td><td>'+receipt+'</td></tr>';
  }).join('');
}

function renderAdmCu(cs){
  if(!cs||!cs.length){$('adm-cu').innerHTML='<tr><td class="adm-empty">No customers yet.</td></tr>';return}
  var head='<tr><th>Name</th><th>Email</th><th>Phone</th><th>Tier</th><th>Points</th><th>Spent</th><th>Joined</th></tr>';
  $('adm-cu').innerHTML=head+cs.map(function(c){
    return '<tr><td>'+esc(c.name)+'</td><td class="adm-items">'+esc(c.email)+'</td>'+
      '<td class="adm-mono">'+esc(c.phone)+'</td><td><span class="badge bp2">'+esc(c.customer_tier||'—')+'</span></td>'+
      '<td>'+esc(c.loyalty_points||0)+'</td><td>'+fmtKES(c.total_spent||0)+'</td>'+
      '<td class="adm-items">'+esc(c.created_at||'—')+'</td></tr>';
  }).join('');
}
