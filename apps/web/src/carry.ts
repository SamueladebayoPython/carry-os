/* NEAR testnet custody demonstration. */
import { connectNearWallet, depositNft, discoverNfts, disconnectNearWallet, getConnectedAccount, reassignBeneficiary, withdrawNft } from './near';

export type ChainId = 'NEAR';
type Held = 's' | 'w' | 'x'; // s = secured in vault, w = in external wallet, x = released
type Tab = 'd' | 'v' | 'a';
type FlowKind = 'secure' | 'withdraw' | 'bene';
interface Nft { id: number; n: string; c: string; ch: ChainId; t: string; ct: string; held: Held; ownerId: string; custodyStatus: 'not_secured' | 'secured' | 'withdrawal_pending' | 'inconsistent'; pendingWithdrawal: boolean; b: string | null; depositorId?: string | null; h: { from: string; to: string }[]; media?: string | null }
interface Wallet { ch: ChainId; addr: string }
interface Flow { m: string; s?: string; p?: string; v?: string; a?: string | null; k?: FlowKind; n?: number; er?: number; h?: number }
interface State { r: 'in' | 'app'; busy: number; user: string | null; w: Wallet | null; fl: Flow | null; fail: boolean; error: string | null; tab: Tab; sel: number | null; ld: number; f: ChainId | ''; q: string; s: '' | 's' | 'w'; items: Nft[] }

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
const CH: Record<ChainId, string> = { NEAR: 'NEAR testnet' };
const short = (a: string | null) => { const s = a ?? ''; return s.length > 20 ? s.slice(0, 8) + '…' + s.slice(-6) : s };
const W = () => S.w as Wallet; // only called where a supported wallet is connected
const selItem = () => S.items.find(x => x.id == S.sel) as Nft; // only called while an NFT is open
const S: State = {r:'in',busy:0,user:null,w:null,fl:null,fail:false,error:null,tab:'d',sel:null,ld:0,f:'',q:'',s:'',items:[]};
function art(s: number){let x=s*9301+49297;const r=()=>(x=(x*9301+49297)%233280)/233280,P=(a: string[])=>a[r()*a.length|0];
const bg=P(['#2F6BFF','#F2B84B','#4FC38A','#EF6A4C','#9B7BFF','#2DD4D4','#F08CB4','#26304A']),sk=P(['#8B5A3C','#B9835A','#7BD389','#E8C9A0','#5B8DEF','#C9C9D6','#6B4A3A']),sh=P(['#151C2E','#EF6A4C','#F2B84B','#fff','#2B63F0']),hc=P(['#151C2E','#EF6A4C','#F2B84B','#9B7BFF','#E9EDF5']);
let o=`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Sample NFT artwork"><rect width="100" height="100" fill="${bg}"/><path d="M12 100Q12 72 50 72Q88 72 88 100Z" fill="${sh}"/><circle cx="26" cy="52" r="6" fill="${sk}"/><circle cx="74" cy="52" r="6" fill="${sk}"/><rect x="28" y="28" width="44" height="46" rx="16" fill="${sk}"/>`;
o+=r()<.45?`<rect x="30" y="43" width="40" height="10" rx="5" fill="#111"/><rect x="33" y="45" width="15" height="6" rx="3" fill="${P(['#4ADEFF','#FF4D8D','#FFD84A'])}"/>`:`<circle cx="40" cy="49" r="4" fill="#fff"/><circle cx="60" cy="49" r="4" fill="#fff"/><circle cx="41" cy="49" r="2" fill="#111"/><circle cx="61" cy="49" r="2" fill="#111"/>`;
o+=`<rect x="${42}" y="63" width="${8+r()*10}" height="3" rx="1.5" fill="#111" opacity=".7"/>`;
const m=r();o+=m<.3?`<path d="M26 36Q26 14 50 14Q74 14 74 36Z" fill="${hc}"/><rect x="24" y="32" width="52" height="7" rx="3.5" fill="${hc}"/>`:m<.6?`<path d="M28 34Q28 18 50 18Q72 18 72 34Z" fill="${hc}"/><rect x="48" y="30" width="34" height="6" rx="3" fill="${hc}"/>`:m<.8?`<path d="M28 36L32 16L40 30L48 12L56 30L66 16L72 36Z" fill="${hc}"/>`:'';
return o+'</svg>'}
const img=(i: Nft, c: number)=>`<div class="img">${i.media?`<img src="${esc(i.media)}" alt="${esc(i.n)}" loading="lazy">`:art(i.id*17+5)}${c?`<span class="chain">NEAR testnet</span>`:''}</div>`;
const card=(i: Nft, k: number)=>`<button class="card" data-a="open" data-i="${i.id}" style="animation-delay:${Math.min(k,12)*30}ms">${img(i,1)}<div class="cm"><b>${esc(i.n)}</b><span class="st ${i.custodyStatus==='secured'?'ok':'wn'}">${i.custodyStatus==='secured'?'✓ Secured':i.custodyStatus==='withdrawal_pending'?'Withdrawal pending':i.custodyStatus==='inconsistent'?'⚠ State mismatch':'Not secured'}</span></div></button>`;
const foot=()=>`<div class="foot"><span>NEAR testnet demo · wallet approval is required for every transaction.</span></div>`;
const flt=(l: Nft[])=>l.filter(i=>(!S.f||i.ch==S.f)&&i.n.toLowerCase().includes(S.q.toLowerCase()));
const gridH=(l: Nft[])=>{l=flt(l);return l.length?`<div class="grid">${l.map(card).join('')}</div>`:`<div class="empty"><h3>No matches</h3><p class="sub">Try another chain or search term.</p></div>`};
const tools=()=>`<div class="tb"><div class="chips">${['',...Object.keys(CH)].map(c=>`<button class="chip ${S.f==c?'on':''}" data-a="f" data-c="${c}">${c?CH[c as ChainId]:'All'}</button>`).join('')}</div><input class="sr" id="q" placeholder="Search NFTs" value="${esc(S.q)}" aria-label="Search NFTs"></div>`;
const sk=()=>`<div class="grid">${'<div class="sk"></div>'.repeat(8)}</div>`;
function signin(){return`<div class="land"><div class="scr"><div class="lh"><div class="logo"><i>c</i>carry.os</div><nav><a href="#how">Secure</a><a href="#how">Beneficiary</a><a href="#how">NEAR testnet</a><a href="#how">Withdraw</a></nav>${S.busy==1?'<button class="btn" disabled>Connecting wallet…</button>':`<button class="btn" data-a="login">${S.busy==-1?'Retry wallet connection':'Connect NEAR wallet'}</button>`}</div>
<section class="hero"><h1>Secure your NFTs.<br><em>Choose who receives them.</em></h1><p>Connect a NEAR testnet wallet to discover NFTs in the configured demo collection. Each custody action requires a direct wallet signature.</p>${S.error?`<p style="color:var(--er);margin-top:16px">${esc(S.error)}</p>`:''}<div style="height:80px"></div></section></div>
<section class="how" id="how"><div><span>01 · Secure</span><h3>Deposit on NEAR</h3><p>Approve the NFT transfer into Carry custody on NEAR testnet.</p></div><div><span>02 · Assign</span><h3>Choose a beneficiary</h3><p>The original depositor signs any beneficiary change.</p></div><div><span>03 · Release</span><h3>Withdraw to the beneficiary</h3><p>Only the current beneficiary can authorize withdrawal.</p></div></section><div style="padding:0 48px 48px">${foot()}</div></div>`}
function shell(c: string){const n=(t: string,l: string,x='')=>`<button class="ni ${S.tab==t?'on':''}" data-a="tab" data-t="${t}">${l}${x}</button>`;
return`<div class="app"><aside><div class="logo"><i>c</i>carry.os</div><div class="acct"><div class="av">${esc(S.user?.slice(0,1).toUpperCase())}</div><div><b>${esc(S.user)}</b><small>NEAR testnet</small></div></div><div><div class="gl">Custody</div>${n('d','Dashboard')}${n('v','Vault',`<span class="mono">${S.items.filter(i=>i.held=='s').length}</span>`)}<div class="gl" style="margin-top:16px">Settings</div>${n('a','Account')}</div></aside><main>${c}${foot()}</main></div><div class="bn"><button class="${S.tab=='d'?'on':''}" data-a="tab" data-t="d">Dashboard</button><button class="${S.tab=='v'?'on':''}" data-a="tab" data-t="v">Vault</button><button class="${S.tab=='a'?'on':''}" data-a="tab" data-t="a">Account</button></div>`}
const wbtn=()=>S.w?`<button class="btn2 mono" data-a="m" data-m="wallet">NEAR · ${esc(short(W().addr))}</button>`:`<button class="btn" data-a="m" data-m="connect">Connect NEAR wallet</button>`;
const dl=()=>S.items.filter(i=>i.held=='s'||i.held=='x'||!!S.w&&i.held=='w').filter(i=>!S.s||(S.s=='s')==(i.held=='s'));
const rows=(l: Nft[])=>l.length?`<div class="vl">${l.map((i,k)=>`<div class="vr" style="animation-delay:${Math.min(k,12)*30}ms">${img(i,1)}<button data-a="open" data-i="${i.id}"><b>${esc(i.n)}</b><small>${esc(i.c)}</small></button><div><small>${CH[i.ch]}</small><span class="st ${i.custodyStatus==='secured'?'ok':'wn'}">${i.custodyStatus==='secured'?'✓ Ownership verified':i.custodyStatus==='withdrawal_pending'?'Withdrawal pending':'State mismatch'}</span></div><div><small>Beneficiary</small><span class="mono">${esc(short(i.b))}</span></div><div class="row"><button class="btn2" data-a="vm" data-i="${i.id}" data-m="manage">Manage</button></div></div>`).join('')}</div>`:`<div class="empty"><h3>No matches</h3><p class="sub">Try another search term.</p></div>`;
function dash(){const l=dl(),all=S.items,n=all.filter(i=>i.custodyStatus==='secured').length,walletCount=all.filter(i=>i.custodyStatus==='not_secured'&&i.ownerId===S.user).length,reviewCount=all.length-n-walletCount;
return`<div class="top"><div><h2>Dashboard</h2><p class="sub">${all.length} NFT${all.length==1?'':'s'} · ${n} secured · ${walletCount} in wallet${reviewCount?` · ${reviewCount} need custody review`:''}</p></div>${wbtn()}</div>${S.error?`<div class="note">${esc(S.error)}</div>`:''}${S.ld?sk():all.length?`<div class="tb"><div class="chips">${[['','All'],['w','Not secured'],['s','Secured']].map(c=>`<button class="chip ${S.s==c[0]?'on':''}" data-a="st" data-s="${c[0]}">${c[1]}</button>`).join('')}</div><input class="sr" id="q" placeholder="Search NFTs" value="${esc(S.q)}" aria-label="Search NFTs"></div><div id="g">${gridH(l)}</div>`:`<div class="empty"><h3>${S.w?'No NFTs found':'No NFTs yet'}</h3><p class="sub">${S.w?'The configured NEAR testnet collection has no NFTs for this account.':'Connect a NEAR testnet wallet to discover your NFTs.'}</p>${S.w?'':'<button class="btn" data-a="m" data-m="connect">Connect wallet</button>'}</div>`}`}
function vault(){const l=S.items.filter(i=>i.held=='s');return`<div class="top"><div><h2>Vault</h2><p class="sub">${l.length} NFT${l.length==1?'':'s'} verified in the NEAR testnet vault</p></div>${wbtn()}</div>`+(S.ld?sk():l.length?tools()+`<div id="g">${rows(flt(l))}</div>`:`<div class="empty"><h3>Your vault is empty</h3><p class="sub">An NFT appears here after the NEAR vault confirms its deposit on-chain.</p><button class="btn" data-a="tab" data-t="d">Go to dashboard</button></div>`)}
function detail(){const i=selItem(),s=i.custodyStatus==='secured';return`<button class="back" data-a="back">← Back</button><div class="det">${img(i,1)}<div><span class="st ${s?'ok':'wn'}">${s?'✓ Secured · ownership verified':i.custodyStatus==='withdrawal_pending'?'Withdrawal pending · verifying custody':i.custodyStatus==='inconsistent'?'Custody state mismatch':'Not secured'}</span><h2 style="margin:8px 0;font-size:36px">${esc(i.n)}</h2><p class="sub">${esc(i.c)}</p>
${s?`<div class="who"><div><small>Carry identity</small>${esc(S.user)}</div><div><small>Held by</small>Carry vault</div><div><small>Beneficiary</small><span class="mono">${esc(short(i.b))}</span></div></div>`:'<div style="height:24px"></div>'}
<dl style="margin-top:0"><dt>Blockchain</dt><dd>${CH[i.ch]}</dd><dt>Contract</dt><dd class="mono">${esc(i.ct)}</dd><dt>Token ID</dt><dd>${esc(i.t)}</dd>${s?`<dt>Custody vault</dt><dd class="mono">${esc(process.env.NEXT_PUBLIC_NEAR_VAULT_ID||'Not configured')}</dd><dt>Original depositor</dt><dd class="mono">${esc(i.depositorId||'—')}</dd><dt>Beneficiary</dt><dd class="mono">${esc(i.b)}</dd>`:`<dt>Held by</dt><dd class="mono">${S.w?esc(W().addr):'External wallet'}</dd>`}</dl>
${s?`<p class="note">This NFT's owner and custody record both confirm the NEAR vault.</p><div class="row"><button class="btn2 big" data-a="m" data-m="manage">Manage security</button></div>`:i.custodyStatus==='not_secured'?`<p class="note">This deposit transfers the NFT to the Carry custody vault on NEAR testnet.</p><button class="btn big" data-a="m" data-m="secure">Secure NFT</button>`:`<p class="note">The API reports ${esc(i.custodyStatus)}. Transaction actions are disabled until ownership and custody agree.</p>`}</div></div>`}
const account=()=>`<div class="top"><h2>Account</h2></div><dl style="max-width:640px"><dt>NEAR account</dt><dd class="mono">${esc(S.user)}</dd><dt>Wallet</dt><dd class="mono">${S.w?esc(W().addr):'None connected'}</dd><dt>Network</dt><dd>${S.w?CH[W().ch]:'—'}</dd></dl><div class="row"><button class="btn2" data-a="m" data-m="connect">Switch wallet</button><button class="btn2" data-a="disc">Disconnect wallet</button><button class="btn2 danger" data-a="out">Sign out</button></div><p class="note" style="margin-top:24px;max-width:640px">A Carry session does not authorize transactions. Every custody change requires a NEAR wallet signature.</p>`;
const mini=(i: Nft)=>`<div class="mini">${img(i,0)}<div><b>${esc(i.n)}</b><br><span class="sub">${esc(i.c)} · ${CH[i.ch]}</span></div></div>`;
function modal(){const f=S.fl;if(!f)return'';if(f.m=='connect')return`<div class="scrim" data-a="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="Connect NEAR wallet"><h3>Connect NEAR wallet</h3><p class="sub" style="margin-bottom:16px">Connect Meteor Wallet or MyNearWallet on NEAR testnet. Connection alone does not move or authorize any NFT.</p><button class="btn" data-a="conn">Open wallet selector</button><button class="btn2" style="margin-left:8px" data-a="x">Cancel</button></div></div>`;const i=selItem();let b='';
if(f.m=='wallet')b=`<h3>Wallet</h3><p class="mono" style="margin-bottom:24px;word-break:break-all">${esc(W().addr)}</p><div class="row"><button class="btn2" data-a="m" data-m="connect">Switch wallet</button><button class="btn2 danger" data-a="disc">Disconnect</button></div>`;
else if(f.m=='secure')b=`<h3>Secure this NFT</h3>${mini(i)}<dl style="margin:0 0 24px;grid-template-columns:100px 1fr"><dt>From</dt><dd class="mono">${S.w?esc(short(W().addr)):'—'}</dd><dt>To vault</dt><dd class="mono">${esc(process.env.NEXT_PUBLIC_NEAR_VAULT_ID||'Not configured')}</dd><dt>Network</dt><dd>${CH[i.ch]}</dd></dl><p class="note">The vault charges its storage deposit to the original depositor, then asks your wallet to approve the NFT transfer.</p><div class="row"><button class="btn big" data-a="go" data-k="secure">Approve in wallet</button><button class="btn2 big" data-a="x">Cancel</button></div>`;
else if(f.m=='manage')b=`<h3>Manage security</h3>${mini(i)}<dl style="margin:0 0 24px;grid-template-columns:110px 1fr"><dt>Status</dt><dd>${esc(i.custodyStatus)}</dd><dt>Vault</dt><dd class="mono">${esc(process.env.NEXT_PUBLIC_NEAR_VAULT_ID||'Not configured')}</dd><dt>Network</dt><dd>${CH[i.ch]}</dd><dt>Beneficiary</dt><dd class="mono">${esc(i.b)}</dd></dl><p class="note">Your NFT stays in the vault. Only the original depositor can change the beneficiary.</p><div class="row">${!i.pendingWithdrawal&&i.custodyStatus==='secured'&&S.user===i.depositorId?'<button class="btn big" data-a="m" data-m="bene">Change beneficiary</button>':''}${!i.pendingWithdrawal&&i.custodyStatus==='secured'&&S.user===i.b?'<button class="btn2 big" data-a="m" data-m="withdraw">Withdraw NFT</button>':''}</div>`;
else if(f.m=='withdraw')b=`<h3>Withdraw NFT</h3>${mini(i)}<p class="sub">It will be released only to the current beneficiary:</p><p class="mono" style="font-size:15px;padding:16px;border-radius:12px;background:var(--s2);margin:8px 0 24px;word-break:break-all">${esc(i.b)}</p><div class="row"><button class="btn big" data-a="go" data-k="withdraw">Confirm withdrawal</button><button class="btn2 big" data-a="x">Cancel</button></div>`;
else if(f.m=='bene')b=`<h3>Change beneficiary</h3>${mini(i)}<p class="sub" style="margin-bottom:16px">Only the original depositor ${esc(i.depositorId||'')} can authorize this change. The NFT remains in custody.</p><label class="sub">New NEAR beneficiary</label><input class="in mono" id="nb" placeholder="e.g. rescue.testnet" value="${esc(f.a||'')}" style="margin:8px 0"><div class="row" style="margin-top:24px"><button class="btn big" data-a="go" data-k="bene">Authorize in wallet</button><button class="btn2 big" data-a="x">Cancel</button></div>`
else if(f.m=='tx'){const T=['Wallet approval','Transaction submitted','Confirmed on blockchain','Verified from contract state'],n=f.n as number,L={secure:'Securing',withdraw:'Withdrawing',bene:'Changing beneficiary for'}[f.k as FlowKind];
b=`<h3>${n==4?'Verified':f.er?'Transaction failed':L+' '+esc(i.n)}</h3><ol class="steps">${T.map((t,j)=>`<li class="${f.er&&j==n?'x':j<n?'d':j==n?'a':''}"><b>${j<n?'✓':f.er&&j==n?'!':j+1}</b>${t}</li>`).join('')}</ol>${f.er?`<p style="color:var(--er);margin-top:8px">${esc(f.p||'The NEAR testnet rejected this operation.')}</p><button class="btn big" style="margin-top:16px" data-a="x">Close</button>`:n==4?`<p class="sub">${{secure:'The vault now reports this NFT in custody.',withdraw:'The NFT transfer to the current beneficiary is confirmed.',bene:'The vault now reports the new beneficiary.'}[f.k as FlowKind]}</p><button class="btn big" style="margin-top:16px" data-a="done">Done</button>`:'<p class="sub">Waiting for wallet approval and on-chain confirmation.</p>'}`}
return`<div class="scrim" data-a="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="Carry action">${b}</div></div>`}
function R(){if(!appRoot)return;const keep=$<HTMLInputElement>('#nb')?.value;
appRoot.innerHTML=(S.r=='in'?signin():shell(S.sel&&S.tab!='a'?detail():S.tab=='v'?vault():S.tab=='d'?dash():account()))+modal();
const e=$<HTMLInputElement>('#nb');if(e&&keep!=null&&S.fl?.m=='bene'&&keep)e.value=keep}
function toNfts(accountId: string, tokens: Awaited<ReturnType<typeof discoverNfts>>): Nft[] { return tokens.map((token,index)=>({id:index+1,n:token.title,c:'NEAR demo collection',ch:'NEAR',t:token.tokenId,ct:token.collectionId,held:token.secured?'s':token.ownerId===accountId?'w':'x',ownerId:token.ownerId,custodyStatus:token.custodyStatus,pendingWithdrawal:token.pendingWithdrawal,b:token.beneficiaryId,h:[],media:token.media,depositorId:token.depositorId})); }
async function load(){if(!S.user){S.ld=0;R();return}S.ld=1;S.error=null;R();try{S.items=toNfts(S.user,await discoverNfts(S.user))}catch(error){S.error=error instanceof Error?error.message:'Could not read the NEAR testnet contracts.'}finally{S.ld=0;R()}}
async function run(k: FlowKind, beneficiary: string | null){const i=selItem();const f: Flow & { n: number }=S.fl={m:'tx',k,n:0,a:beneficiary};R();try{if(k==='secure')await depositNft(i.t,S.user!);else if(k==='bene'){if(!beneficiary)throw new Error('Enter a valid NEAR beneficiary account.');await reassignBeneficiary(i.t,beneficiary)}else await withdrawNft(i.t);f.n=3;R();const refreshed=toNfts(S.user!,await discoverNfts(S.user!));S.items=refreshed;const updated=refreshed.find((token)=>token.t===i.t);if(k==='secure'&&(!updated?.held||updated.held!=='s'||updated.depositorId!==S.user))throw new Error('The transaction returned, but the vault does not report this NFT in custody for the connected depositor.');if(k==='bene'&&updated?.b!==beneficiary)throw new Error('The transaction returned, but the vault does not report the requested beneficiary.');if(k==='withdraw'&&(updated?.held!=='w'||updated.ownerId!==S.user))throw new Error('The transaction returned, but the NFT is not reported in the connected beneficiary wallet.');S.sel=updated?.id??null;f.n=4}catch(error){f.er=1;f.p=error instanceof Error?error.message:'The NEAR transaction failed.'}R()}
async function activateWallet(forceSelection=false){S.busy=1;S.error=null;S.fl=null;R();try{if(forceSelection&&S.w){await disconnectNearWallet();S.user=null;S.w=null;S.items=[];R()}const accountId=await connectNearWallet();S.user=accountId;S.w={ch:'NEAR',addr:accountId};S.r='app';S.tab='d';S.sel=null;await load()}catch(error){S.busy=-1;S.error=error instanceof Error?error.message:'Wallet connection failed.';R()}finally{S.busy=0}}
const onInput=(e: Event)=>{const el=e.target as HTMLInputElement;if(el.id=='q'){S.q=el.value;const grid=$<HTMLDivElement>('#g');if(grid)grid.innerHTML=S.tab=='v'?rows(flt(S.items.filter(i=>i.held=='s'))):gridH(dl())}};
const onKeyDown=(e: KeyboardEvent)=>{if(e.key=='Escape'&&S.fl&&S.fl.m!='tx'){S.fl=null;R()}};
const onClick=(e: MouseEvent)=>{const t=(e.target as HTMLElement).closest<HTMLElement>('[data-a]');if(!t)return;const a=t.dataset.a,d=t.dataset as Record<string,string>;
if(a=='scrim'){if(e.target==t&&S.fl&&S.fl.m!='tx'){S.fl=null;R()}return}
if(a=='login'){void activateWallet()}
if(a=='tab'){S.tab=d.t as Tab;S.sel=null;S.q='';S.f='';S.s='';if(d.t!='a')load();else R()}
if(a=='f'){S.f=d.c as State['f'];R()}if(a=='st'){S.s=d.s as State['s'];R()}if(a=='vm'){S.sel=Number(d.i);S.fl={m:d.m??'',s:''};R()}
if(a=='open'){S.sel=Number(d.i);R()}if(a=='back'){S.sel=null;R()}
if(a=='m'){S.fl={m:d.m??'',s:''};R()}if(a=='x'){S.fl=null;R()}
if(a=='conn'){void activateWallet(Boolean(S.w))}
if(a=='disc'||a=='out'){void disconnectNearWallet().catch(()=>undefined);S.r='in';S.user=null;S.w=null;S.items=[];S.fl=null;S.sel=null;S.tab='d';R()}
if(a=='go'){run(d.k as FlowKind,d.k=='bene'?$<HTMLInputElement>('#nb').value.trim():null)}
if(a=='done'){const k=(S.fl as Flow).k;S.fl=null;if(k=='secure'){S.sel=null;S.tab='v'}if(k=='withdraw')S.sel=null;R()}};

/** Mounts the demo into a React-owned host and returns a listener cleanup function. */
export function mountCarry(root: HTMLElement): () => void {
  appRoot = root;
  const ac = new AbortController();
  const o = { signal: ac.signal };
  root.addEventListener('input', onInput, o);
  root.addEventListener('click', onClick, o);
  root.addEventListener('keydown', onKeyDown, o);
  R();
  void getConnectedAccount().then((accountId) => {
    if (!accountId || appRoot !== root) return;
    S.user = accountId;
    S.w = { ch: 'NEAR', addr: accountId };
    S.r = 'app';
    void load();
  }).catch((error: unknown) => {
    if (appRoot === root) {
      S.error = error instanceof Error ? error.message : 'Could not restore the NEAR wallet connection.';
      R();
    }
  });
  return () => {
    ac.abort();
    if (appRoot === root) appRoot = null;
    root.replaceChildren();
  };
}
