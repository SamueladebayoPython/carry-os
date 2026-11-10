/* Carry OS: mocked frontend. Typed port of the approved prototype (same markup, same behaviour). */
export type ChainId = 'ETH' | 'SOL' | 'NEAR' | 'RH';
type Held = 's' | 'w' | 'x'; // s = secured in vault, w = in external wallet, x = released
type Tab = 'd' | 'v' | 'a';
type FlowKind = 'secure' | 'withdraw' | 'bene' | 'sell';
interface Nft { id: number; n: string; c: string; ch: ChainId; t: string; ct: string; held: Held; b: string | null; h: { from: string; to: string }[]; list?: string }
interface Wallet { ch: ChainId; addr: string }
interface Flow { m: string; s?: string; p?: string; v?: string; a?: string | null; k?: FlowKind; n?: number; er?: number; h?: number }
interface State { r: 'in' | 'app'; busy: number; user: string | null; w: Wallet | 'x' | null; fl: Flow | null; fail: boolean; tab: Tab; sel: number | null; ld: number; f: ChainId | ''; q: string; s: '' | 's' | 'w'; items: Nft[] }

let appRoot: HTMLElement | null = null;
const $ = <T extends HTMLElement = HTMLElement>(q: string): T => (appRoot ?? document).querySelector(q) as T;
const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (char) => {
  switch (char) {
    case '&': return '&amp;';
    case '<': return '&lt;';
    case '>': return '&gt;';
    case '"': return '&quot;';
    default: return '&#39;';
  }
});
const CH: Record<string, string> = { ETH: 'Ethereum', SOL: 'Solana', NEAR: 'NEAR', RH: 'Robinhood Chain' };
const short = (a: string | null) => { const s = a ?? ''; return s.length > 20 ? s.slice(0, 8) + '…' + s.slice(-6) : s };
const hx = (n: number) =>'0x'+[...Array(40)].map((_,i)=>'0123456789abcdef'[(n*7919+i*104729+i*i*31)%16]).join('');
const NM=['Orbit Ape','Neon Warden','Drift Monk','Pixel Ronin','Ember Fox','Glass Pilot','Haze Rider','Moss Oracle','Tin Prophet','Static Kid','Velvet Ghost','Cloud Smith'];
const CHs: ChainId[] = ['NEAR','ETH','SOL','NEAR','RH','ETH','NEAR','SOL','NEAR','ETH','RH','NEAR'];
const W = () => S.w as Wallet; // only called where a supported wallet is connected
const selItem = () => S.items.find(x => x.id == S.sel) as Nft; // only called while an NFT is open
const S: State = {r:'in',busy:0,user:null,w:null,fl:null,fail:false,tab:'d',sel:null,ld:0,f:'',q:'',s:'',
items:NM.map((n,i): Nft=>({id:i+1,n:n+' #'+(100+i*37),c:['Genesis Apes','Paras Pass','Mintbase Orbits','Few & Far'][i%4],ch:CHs[i],t:''+(100+i*37),ct:CHs[i]=='NEAR'?'col'+i+'.sample.near':hx(i),held:i<4?'s':'w',b:i<4?'maya.near':null,h:[]}))};
function art(s: number){let x=s*9301+49297;const r=()=>(x=(x*9301+49297)%233280)/233280,P=(a: string[])=>a[r()*a.length|0];
const bg=P(['#2F6BFF','#F2B84B','#4FC38A','#EF6A4C','#9B7BFF','#2DD4D4','#F08CB4','#26304A']),sk=P(['#8B5A3C','#B9835A','#7BD389','#E8C9A0','#5B8DEF','#C9C9D6','#6B4A3A']),sh=P(['#151C2E','#EF6A4C','#F2B84B','#fff','#2B63F0']),hc=P(['#151C2E','#EF6A4C','#F2B84B','#9B7BFF','#E9EDF5']);
let o=`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Sample NFT artwork"><rect width="100" height="100" fill="${bg}"/><path d="M12 100Q12 72 50 72Q88 72 88 100Z" fill="${sh}"/><circle cx="26" cy="52" r="6" fill="${sk}"/><circle cx="74" cy="52" r="6" fill="${sk}"/><rect x="28" y="28" width="44" height="46" rx="16" fill="${sk}"/>`;
o+=r()<.45?`<rect x="30" y="43" width="40" height="10" rx="5" fill="#111"/><rect x="33" y="45" width="15" height="6" rx="3" fill="${P(['#4ADEFF','#FF4D8D','#FFD84A'])}"/>`:`<circle cx="40" cy="49" r="4" fill="#fff"/><circle cx="60" cy="49" r="4" fill="#fff"/><circle cx="41" cy="49" r="2" fill="#111"/><circle cx="61" cy="49" r="2" fill="#111"/>`;
o+=`<rect x="${42}" y="63" width="${8+r()*10}" height="3" rx="1.5" fill="#111" opacity=".7"/>`;
const m=r();o+=m<.3?`<path d="M26 36Q26 14 50 14Q74 14 74 36Z" fill="${hc}"/><rect x="24" y="32" width="52" height="7" rx="3.5" fill="${hc}"/>`:m<.6?`<path d="M28 34Q28 18 50 18Q72 18 72 34Z" fill="${hc}"/><rect x="48" y="30" width="34" height="6" rx="3" fill="${hc}"/>`:m<.8?`<path d="M28 36L32 16L40 30L48 12L56 30L66 16L72 36Z" fill="${hc}"/>`:'';
return o+'</svg>'}
const img=(i: Nft, c: number)=>`<div class="img">${art(i.id*17+5)}${c?`<span class="chain">${esc(i.ch)}</span>`:''}</div>`;
const card=(i: Nft, k: number)=>`<button class="card" data-a="open" data-i="${i.id}" style="animation-delay:${Math.min(k,12)*30}ms">${img(i,1)}<div class="cm"><b>${esc(i.n)}</b><span class="st ${i.held=='s'?'ok':'wn'}">${i.held=='s'?'✓ Secured':'Not secured'}</span></div></button>`;
const foot=()=>`<div class="foot"><span>Demo only. Sign-in, wallets, NFTs, and transactions are simulated; no assets move.</span><label><input type="checkbox" data-a="fail" ${S.fail?'checked':''}> Simulate a failed transaction</label></div>`;
const flt=(l: Nft[])=>l.filter(i=>(!S.f||i.ch==S.f)&&i.n.toLowerCase().includes(S.q.toLowerCase()));
const gridH=(l: Nft[])=>{l=flt(l);return l.length?`<div class="grid">${l.map(card).join('')}</div>`:`<div class="empty"><h3>No matches</h3><p class="sub">Try another chain or search term.</p></div>`};
const tools=()=>`<div class="tb"><div class="chips">${['',...Object.keys(CH)].map(c=>`<button class="chip ${S.f==c?'on':''}" data-a="f" data-c="${c}">${c?CH[c]:'All'}</button>`).join('')}</div><input class="sr" id="q" placeholder="Search NFTs" value="${esc(S.q)}" aria-label="Search NFTs"></div>`;
const sk=()=>`<div class="grid">${'<div class="sk"></div>'.repeat(8)}</div>`;
function signin(){const L: [number, string, string, string, string][]=[[5,'Orbit Ape','NEAR','maya.near','vault.near'],[2,'Neon Warden','Ethereum','0x7a3f…c21e','0x91d0…4be7'],[9,'Drift Monk','Solana','9xQe…Lm4Z','Hv2k…pR8d']];
return`<div class="land"><div class="scr"><div class="lh"><div class="logo"><i>c</i>carry.os</div><nav><a href="#how">Secure</a><a href="#how">Beneficiary</a><a href="#how">Chains</a><a href="#how">Withdraw</a></nav>${S.busy==1?'<button class="btn" disabled>Signing in…</button>':`<button class="btn" data-a="login">${S.busy==-1?'Retry sign-in':'Sign in with NEAR'}</button>`}</div>
<section class="hero"><h1>Secure your NFTs.<br><em>Choose who receives them.</em></h1><p>Move valuable NFTs out of everyday wallets into a custody vault on their own chain. Change who can receive them without ever moving them.</p>${S.busy==-1?'<p style="color:var(--er);margin-top:16px">NEAR sign-in was cancelled. Use Retry sign-in above.</p>':''}
<div class="fan">${L.map(l=>`<div class="hc"><div class="img">${art(l[0]*17+5)}<span class="chain">${l[2]}</span></div><div class="cm"><b>${l[1]}</b><span class="st ok">Secured</span></div><div class="meta"><span>Beneficiary<b>${l[3]}</b></span><span>Vault<b>${l[4]}</b></span></div></div>`).join('')}</div></section></div>
<section class="how" id="how"><div><span>01 · Secured</span><h3>In the vault</h3><p>NFTs held by Carry custody on their original chain. Never bridged.</p></div><div><span>02 · Unsecured</span><h3>Still in your wallet</h3><p>Connecting a wallet only reads it. Nothing moves until you approve.</p></div><div><span>03 · Beneficiary</span><h3>Who receives it</h3><p>Your wallet gets compromised? Prove a new one and switch, with the NFT still in custody.</p></div></section><div style="padding:0 48px 48px">${foot()}</div></div>`}
function shell(c: string){const n=(t: string,l: string,x='')=>`<button class="ni ${S.tab==t?'on':''}" data-a="tab" data-t="${t}">${l}${x}</button>`;
return`<div class="app"><aside><div class="logo"><i>c</i>carry.os</div><div class="acct"><div class="av">M</div><div><b>${esc(S.user)}</b><small>NEAR account</small></div></div><div><div class="gl">Custody</div>${n('d','Dashboard')}${n('v','Vault',`<span class="mono">${S.items.filter(i=>i.held=='s').length}</span>`)}<div class="gl" style="margin-top:16px">Settings</div>${n('a','Account')}</div></aside><main>${c}${foot()}</main></div><div class="bn"><button class="${S.tab=='d'?'on':''}" data-a="tab" data-t="d">Dashboard</button><button class="${S.tab=='v'?'on':''}" data-a="tab" data-t="v">Vault</button><button class="${S.tab=='a'?'on':''}" data-a="tab" data-t="a">Account</button></div>`}
const wbtn=()=>S.w&&S.w!=='x'?`<button class="btn2 mono" data-a="m" data-m="wallet">${CH[W().ch]} · ${esc(short(W().addr))}</button>`:`<button class="btn" data-a="m" data-m="connect">Connect wallet</button>`;
const cur=(i: Nft)=>({NEAR:'NEAR',ETH:'ETH',SOL:'SOL',RH:'ETH'})[i.ch];
const dl=()=>{const ws=S.w&&S.w!=='x';return S.items.filter(i=>(i.held=='s'||(ws&&i.held=='w'&&i.ch==W().ch))&&(!S.s||(S.s=='s')==(i.held=='s')))};
const TR=[['Background',['Blue','Gold','Mint','Coral','Violet','Teal','Rose','Slate']],['Skin',['Umber','Bronze','Jade','Sand','Azure','Ash']],['Headwear',['Beanie','Cap','Spikes','None']],['Eyes',['Round','Visor']],['Rarity',['Common','Uncommon','Rare','Epic']]];
const traits=(i: Nft)=>TR.map((t,k)=>[t[0],t[1][(i.id*(k+3)+k*5)%t[1].length]]);
const rows=(l: Nft[])=>l.length?`<div class="vl">${l.map((i,k)=>`<div class="vr" style="animation-delay:${Math.min(k,12)*30}ms">${img(i,1)}<button data-a="open" data-i="${i.id}"><b>${esc(i.n)}</b><small>${esc(i.c)}</small></button><div><small>${CH[i.ch]}</small><span class="st ok">✓ Custody verified</span>${i.list?`<small>Listed · ${esc(i.list)} ${cur(i)}</small>`:''}</div><div><small>Beneficiary</small><span class="mono">${esc(short(i.b))}</span></div><div class="row"><button class="btn" data-a="vm" data-i="${i.id}" data-m="sell">Sell</button><button class="btn2" data-a="vm" data-i="${i.id}" data-m="manage">Manage</button></div></div>`).join('')}</div>`:`<div class="empty"><h3>No matches</h3><p class="sub">Try another chain or search term.</p></div>`;
function dash(){const ws=S.w&&S.w!=='x',l=dl(),all=S.items.filter(i=>i.held=='s'||(ws&&i.held=='w'&&i.ch==W().ch)),n=all.filter(i=>i.held=='s').length;
return`<div class="top"><div><h2>Dashboard</h2><p class="sub">${all.length} NFT${all.length==1?'':'s'} · ${n} secured · ${all.length-n} not secured</p></div>${wbtn()}</div>`+(S.w==='x'?`<div class="note">This network isn't supported yet. Carry works with Ethereum, Solana, NEAR and Robinhood Chain. <button class="btn2" style="margin-left:8px" data-a="m" data-m="connect">Switch wallet</button></div>`:!S.w&&all.length?`<div class="note">Connect a wallet to discover NFTs that aren't secured yet. <button class="btn" style="margin-left:8px" data-a="m" data-m="connect">Connect wallet</button></div>`:'')+(S.ld?sk():all.length?`<div class="tb"><div class="chips">${[['','All'],['w','Not secured'],['s','Secured']].map(c=>`<button class="chip ${S.s==c[0]?'on':''}" data-a="st" data-s="${c[0]}">${c[1]}</button>`).join('')}</div><input class="sr" id="q" placeholder="Search NFTs" value="${esc(S.q)}" aria-label="Search NFTs"></div><div id="g">${gridH(l)}</div>`:`<div class="empty"><h3>${ws?'No NFTs found':'No NFTs yet'}</h3><p class="sub">${ws?'This wallet holds no NFTs on '+CH[W().ch]+'.':'Connect a wallet to discover your NFTs.'}</p>${ws?'':'<button class="btn" data-a="m" data-m="connect">Connect wallet</button>'}</div>`)}
function vault(){const l=S.items.filter(i=>i.held=='s');return`<div class="top"><div><h2>Vault</h2><p class="sub">${l.length} NFT${l.length==1?'':'s'} held in Carry custody contracts</p></div>${wbtn()}</div>`+(S.ld?sk():l.length?tools()+`<div id="g">${rows(flt(l))}</div>`:`<div class="empty"><h3>Your vault is empty</h3><p class="sub">An NFT appears here only after its deposit is verified on-chain. Find NFTs to secure on your dashboard.</p><button class="btn" data-a="tab" data-t="d">Go to dashboard</button></div>`)}
function detail(){const i=selItem(),s=i.held=='s';return`<button class="back" data-a="back">← Back</button><div class="det">${img(i,1)}<div><span class="st ${s?'ok':'wn'}">${s?'✓ Secured · verified on-chain':'Not secured'}</span><h2 style="margin:8px 0;font-size:36px">${esc(i.n)}</h2><p class="sub">${esc(i.c)}</p>
${s?`<div class="who"><div><small>Carry identity</small>${esc(S.user)}</div><div><small>Held by</small>Carry vault</div><div><small>Beneficiary</small><span class="mono">${esc(short(i.b))}</span></div></div>`:'<div style="height:24px"></div>'}
<dl style="margin-top:0"><dt>Blockchain</dt><dd>${CH[i.ch]}</dd><dt>Contract</dt><dd class="mono">${esc(i.ct)}</dd><dt>Token ID</dt><dd>${esc(i.t)}</dd>${s?`<dt>Custody vault</dt><dd class="mono">${hx(i.id+50)}</dd><dt>Beneficiary</dt><dd class="mono">${esc(i.b)}</dd><dt>Deposit tx</dt><dd class="mono">${hx(i.id+9).slice(0,18)}… (sample)</dd><dt>Listing</dt><dd>${i.list?esc(i.list)+' '+cur(i):'Not listed'}</dd><dt>History</dt><dd>${i.h.length?i.h.map(h=>`${esc(h.from)} → ${esc(h.to)}`).join('<br>'):'No beneficiary changes'}</dd>`:`<dt>Held by</dt><dd class="mono">${S.w&&S.w!=='x'?esc(W().addr):'External wallet'}</dd>`}</dl>
<div class="sub" style="margin-bottom:8px">Attributes</div><div class="tr">${traits(i).map(t=>`<div><small>${t[0]}</small>${t[1]}</div>`).join('')}</div>
${s?`<p class="note">This NFT is held by the custody vault, not your wallet.</p><div class="row"><button class="btn big" data-a="m" data-m="sell">Sell NFT</button><button class="btn2 big" data-a="m" data-m="manage">Manage security</button></div>`:`<p class="note">Securing transfers this NFT into the Carry custody vault on ${CH[i.ch]}. It can only be sold after it is secured.</p><button class="btn big" data-a="m" data-m="secure">Secure NFT</button>`}</div></div>`}
const account=()=>`<div class="top"><h2>Account</h2></div><dl style="max-width:640px"><dt>NEAR account</dt><dd class="mono">${esc(S.user)}</dd><dt>Wallet</dt><dd class="mono">${S.w&&S.w!=='x'?W().addr:'None connected'}</dd><dt>Network</dt><dd>${S.w&&S.w!=='x'?CH[W().ch]:'—'}</dd></dl><div class="row"><button class="btn2" data-a="m" data-m="connect">Switch wallet</button><button class="btn2" data-a="disc">Disconnect wallet</button><button class="btn2 danger" data-a="out">Sign out</button></div><p class="note" style="margin-top:24px;max-width:640px">Signing in proves who you are. It does not give Carry access to any wallet.</p>`;
const mini=(i: Nft)=>`<div class="mini">${img(i,0)}<div><b>${esc(i.n)}</b><br><span class="sub">${esc(i.c)} · ${CH[i.ch]}</span></div></div>`;
function modal(){const f=S.fl;if(!f)return'';const i=selItem();let b='';
if(f.m=='connect'){b=f.s=='load'?`<h3>Connecting…</h3><p class="sub">Approve the request in ${esc(f.p)}.</p>`:f.s=='rej'?`<h3>Connection rejected</h3><p class="sub" style="margin-bottom:16px">You declined in your wallet. Nothing was connected.</p><button class="btn" data-a="m" data-m="connect">Try again</button>`:`<h3>Connect a wallet</h3><p class="sub" style="margin-bottom:16px">This only lets Carry read NFTs. It is separate from signing in and authorises no transfer.</p>${[['MetaMask','ETH'],['Phantom','SOL'],['Meteor Wallet','NEAR'],['Robinhood Wallet','RH'],['Lace','X']].map(p=>`<button class="opt" data-a="conn" data-p="${p[0]}" data-c="${p[1]}"><span>${p[0]}</span><span class="sub">${p[1]=='X'?'Unsupported network':CH[p[1]]}</span></button>`).join('')}`}
else if(f.m=='wallet')b=`<h3>Wallet</h3><p class="mono" style="margin-bottom:24px;word-break:break-all">${esc(W().addr)}</p><div class="row"><button class="btn2" data-a="m" data-m="connect">Switch wallet</button><button class="btn2 danger" data-a="disc">Disconnect</button></div>`;
else if(f.m=='secure')b=`<h3>Secure this NFT</h3>${mini(i)}<dl style="margin:0 0 24px;grid-template-columns:100px 1fr"><dt>From</dt><dd class="mono">${S.w?esc(short(W().addr)):'—'}</dd><dt>To vault</dt><dd class="mono">${short(hx(i.id+50))}</dd><dt>Network</dt><dd>${CH[i.ch]}</dd></dl><ol class="steps" style="margin:0 0 16px"><li class="d"><b>1</b>You approve a transfer in your wallet</li><li class="d"><b>2</b>The NFT moves into the Carry vault on ${CH[i.ch]}</li><li class="d"><b>3</b>Carry verifies custody on-chain. Only then does it show as secured</li></ol><div class="row"><button class="btn big" data-a="go" data-k="secure">Approve in wallet</button><button class="btn2 big" data-a="x">Cancel</button></div>`;
else if(f.m=='manage')b=`<h3>Manage security</h3>${mini(i)}<dl style="margin:0 0 24px;grid-template-columns:110px 1fr"><dt>Status</dt><dd>Custody verified on-chain</dd><dt>Vault</dt><dd class="mono">${short(hx(i.id+50))}</dd><dt>Network</dt><dd>${CH[i.ch]}</dd><dt>Beneficiary</dt><dd class="mono">${esc(short(i.b))}</dd></dl><p class="note">Your NFT stays in the vault. Changing the beneficiary never moves it.</p><div class="row"><button class="btn big" data-a="m" data-m="bene">Change beneficiary</button><button class="btn2 big" data-a="m" data-m="withdraw">Withdraw NFT</button></div>`;
else if(f.m=='sell')b=`<h3>Sell this NFT</h3>${mini(i)}<label class="sub">Asking price (${cur(i)})</label><input class="in mono" id="pr" type="number" min="0" step="any" value="2.5" style="margin:8px 0 16px"><dl style="margin:0 0 24px;grid-template-columns:110px 1fr"><dt>Network</dt><dd>${CH[i.ch]}</dd><dt>Custody</dt><dd>Carry vault, verified</dd><dt>Proceeds to</dt><dd class="mono">${esc(short(i.b))}</dd></dl><p class="note">The NFT stays in the vault until a buyer completes the sale. The vault releases it only to the buyer, and proceeds go to the authorised beneficiary.</p><div class="row"><button class="btn big" data-a="go" data-k="sell">Confirm listing</button><button class="btn2 big" data-a="x">Cancel</button></div>`;
else if(f.m=='withdraw')b=`<h3>Withdraw NFT</h3>${mini(i)}<p class="sub">It will be released only to the current beneficiary:</p><p class="mono" style="font-size:15px;padding:16px;border-radius:12px;background:var(--s2);margin:8px 0 24px;word-break:break-all">${esc(i.b)}</p><div class="row"><button class="btn big" data-a="go" data-k="withdraw">Confirm withdrawal</button><button class="btn2 big" data-a="x">Cancel</button></div>`;
else if(f.m=='bene'){const v=f.v;b=`<h3>Change beneficiary</h3>${mini(i)}<p class="sub" style="margin-bottom:16px">Current: <span class="mono">${esc(short(i.b))}</span>. The NFT stays in custody. The old beneficiary loses access once the on-chain change is verified.</p><label class="sub">New beneficiary</label><input class="in mono" id="nb" placeholder="e.g. rescue.near" value="${esc(f.a||'')}" style="margin:8px 0">${v=='ok'?'<p style="color:var(--ok)">Ownership proven. Signature verified.</p>':v=='load'?'<p class="sub">Waiting for wallet signature…</p>':'<p class="sub">Sign a message from this wallet to prove you control it.</p>'}<div class="row" style="margin-top:24px">${v=='ok'?'<button class="btn big" data-a="go" data-k="bene">Authorise change</button>':'<button class="btn big" data-a="ver">Prove ownership</button>'}<button class="btn2 big" data-a="x">Cancel</button></div>`}
else if(f.m=='tx'){const T=['Awaiting wallet approval','Transaction submitted','Confirming on blockchain','Verifying operation'],n=f.n as number,L={secure:'Securing',withdraw:'Withdrawing',bene:'Changing beneficiary for',sell:'Listing'}[f.k as FlowKind];
b=`<h3>${n==4?'Verified':f.er?'Transaction failed':L+' '+esc(i.n)}</h3><ol class="steps">${T.map((t,j)=>`<li class="${f.er&&j==n?'x':j<n?'d':j==n?'a':''}"><b>${j<n?'✓':f.er&&j==n?'!':j+1}</b>${t}</li>`).join('')}</ol>${n>0?`<p class="mono sub">${CH[i.ch]} · ${hx(f.h as number).slice(0,22)}… (sample)</p>`:''}${f.er?`<p style="color:var(--er);margin-top:8px">The network rejected this operation. Nothing changed. Your NFT is where it was.</p><button class="btn big" style="margin-top:16px" data-a="x">Close</button>`:n==4?`<p class="sub">${{secure:'Custody verified. This NFT now shows as secured.',withdraw:'Release verified. The NFT was sent to the beneficiary.',bene:'On-chain change verified. The new beneficiary is authorised.',sell:'Listing verified. Your NFT is listed and stays in custody until it sells.'}[f.k as FlowKind]}</p><button class="btn big" style="margin-top:16px" data-a="done">Done</button>`:'<p class="sub">Nothing is final until the operation is verified.</p>'}`}
return`<div class="scrim" data-a="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="Carry action">${b}</div></div>`}
function R(){if(!appRoot)return;const keep=$<HTMLInputElement>('#nb')?.value;
appRoot.innerHTML=(S.r=='in'?signin():shell(S.sel&&S.tab!='a'?detail():S.tab=='v'?vault():S.tab=='d'?dash():account()))+modal();
const e=$<HTMLInputElement>('#nb');if(e&&keep!=null&&S.fl?.m=='bene'&&keep)e.value=keep}
function load(){S.ld=1;R();setTimeout(()=>{S.ld=0;R()},700)}
function run(k: FlowKind, a: string | null){const i=selItem();const f: Flow & { n: number }=S.fl={m:'tx',k,n:0,a,h:Date.now()%9999};const adv=()=>{if(S.fl!==f)return;if(S.fail&&f.n==2){f.er=1;R();return}f.n++;if(f.n==4){if(k=='secure'){i.held='s';i.b=S.user}if(k=='bene'){i.h.push({from:short(i.b),to:short(f.a ?? null)});i.b=f.a ?? null}if(k=='withdraw')i.held='x';if(k=='sell')i.list=f.a ?? undefined}R();if(f.n<4)setTimeout(adv,1100)};R();setTimeout(adv,1100)}
const onInput=(e: Event)=>{const el=e.target as HTMLInputElement;if(el.id=='q'){S.q=el.value;const grid=$<HTMLDivElement>('#g');if(grid)grid.innerHTML=S.tab=='v'?rows(flt(S.items.filter(i=>i.held=='s'))):gridH(dl())}};
const onKeyDown=(e: KeyboardEvent)=>{if(e.key=='Escape'&&S.fl&&S.fl.m!='tx'){S.fl=null;R()}};
const onChange=(e: Event)=>{const el=e.target as HTMLInputElement;if(el.dataset.a=='fail')S.fail=el.checked};
const onClick=(e: MouseEvent)=>{const t=(e.target as HTMLElement).closest<HTMLElement>('[data-a]');if(!t)return;const a=t.dataset.a,d=t.dataset as Record<string,string>;
if(a=='scrim'){if(e.target==t&&S.fl&&S.fl.m!='tx'){S.fl=null;R()}return}
if(a=='fail')return;
if(a=='login'){S.busy=1;R();setTimeout(()=>{if(S.fail){S.busy=-1}else{S.busy=0;S.user='maya.near';S.r='app';S.tab='d';load();return}R()},1000)}
if(a=='tab'){S.tab=d.t as Tab;S.sel=null;S.q='';S.f='';S.s='';if(d.t!='a')load();else R()}
if(a=='f'){S.f=d.c as State['f'];R()}if(a=='st'){S.s=d.s as State['s'];R()}if(a=='vm'){S.sel=+d.i;S.fl={m:d.m,s:''};R()}
if(a=='open'){S.sel=+d.i;R()}if(a=='back'){S.sel=null;R()}
if(a=='m'){S.fl={m:d.m,s:''};R()}if(a=='x'){S.fl=null;R()}
if(a=='conn'){if(d.c=='X'){S.w='x';S.fl=null;S.tab='d';S.sel=null;R();return}S.fl={m:'connect',s:'load',p:d.p};R();setTimeout(()=>{if(S.fail){S.fl={m:'connect',s:'rej'};R();return}S.w={ch:d.c as ChainId,addr:d.c=='NEAR'?'maya-wallet.near':hx(d.c.length*11)};S.fl=null;S.tab='d';S.sel=null;S.q='';load()},900)}
if(a=='disc'){S.w=null;S.fl=null;R()}
if(a=='out'){S.r='in';S.user=null;S.w=null;S.sel=null;R()}
if(a=='go'){run(d.k as FlowKind,d.k=='bene'?$<HTMLInputElement>('#nb').value.trim():d.k=='sell'?($<HTMLInputElement>('#pr').value||'1'):null)}
if(a=='ver'){const v=$<HTMLInputElement>('#nb').value.trim();if(!v)return;const f=S.fl as Flow;f.a=v;f.v='load';R();setTimeout(()=>{if(S.fl&&S.fl.m=='bene'){S.fl.v='ok';R()}},900)}
if(a=='done'){const k=(S.fl as Flow).k;S.fl=null;if(k=='secure'){S.sel=null;S.tab='v'}if(k=='withdraw')S.sel=null;R()}};

/** Mounts the demo into a React-owned host and returns a listener cleanup function. */
export function mountCarry(root: HTMLElement): () => void {
  appRoot = root;
  const ac = new AbortController();
  const o = { signal: ac.signal };
  root.addEventListener('input', onInput, o);
  root.addEventListener('change', onChange, o);
  root.addEventListener('click', onClick, o);
  root.addEventListener('keydown', onKeyDown, o);
  R();
  return () => {
    ac.abort();
    if (appRoot === root) appRoot = null;
    root.replaceChildren();
  };
}
