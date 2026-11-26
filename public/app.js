import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { firebaseConfig, googleOAuthClientId } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const state = { user:null, token:null, channel:null, videos:[], analytics:null, performance:new Map(), autoOptimize:localStorage.getItem("jowi-auto-optimize")!=="off" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const scopes = ["https://www.googleapis.com/auth/youtube.readonly","https://www.googleapis.com/auth/yt-analytics.readonly","https://www.googleapis.com/auth/youtube.force-ssl"];
const dateRange = () => { const end=new Date(); end.setUTCDate(end.getUTCDate()-2); const start=new Date(end); start.setUTCDate(start.getUTCDate()-27); return {startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10)}; };

function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),4200)}
function number(v){return Number(v||0).toLocaleString()}
function dateLabel(d){return new Date(d).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function setConnected(on){$("setup-banner").hidden=on;$("connect-btn").textContent=on?"YouTube connected":"Connect YouTube";$("signout").hidden=!state.user}
function showView(name){document.querySelectorAll(".view").forEach(v=>v.hidden=true);$(name+"-view").hidden=false;document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name));$("page-title").textContent=({overview:"Channel overview",videos:"Video optimizer",insights:"Audience insights"})[name];$("crumb").textContent=name.toUpperCase()}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.go)));
async function signIn(){try{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});await signInWithPopup(auth,provider)}catch(e){toast("Sign-in failed: "+e.message)}}
onAuthStateChanged(auth,user=>{state.user=user;$("user-name").textContent=user?.displayName||"Not signed in";$("user-email").textContent=user?.email||"Connect your account";$("user-avatar").textContent=(user?.displayName||"J").slice(0,1).toUpperCase();$("signout").hidden=!user;if(!user){state.token=null;state.channel=null;state.videos=[];setConnected(false)}});
$("signout").addEventListener("click",async()=>{state.token=null;state.channel=null;await signOut(auth);toast("Signed out.")});
$("connect-btn").addEventListener("click",connectYouTube);$("setup-connect").addEventListener("click",connectYouTube);
$("refresh-videos").addEventListener("click",()=>loadChannelData(true));
$("refresh-insights").addEventListener("click",()=>loadInsights());
$("toggle-auto-optimize").addEventListener("click",()=>{state.autoOptimize=!state.autoOptimize;localStorage.setItem("jowi-auto-optimize",state.autoOptimize?"on":"off");renderAutoOptimizeStatus("Setting saved on this device.");if(state.autoOptimize)runAutoOptimization()});

function connectYouTube(){
 if(!state.user){signIn();return}
 if(!googleOAuthClientId||googleOAuthClientId.startsWith("REPLACE_")){toast("Google OAuth Client ID is missing from app configuration.");return}
 if(!window.google?.accounts?.oauth2){toast("Google authorization is loading. Please try again in a moment.");return}
 const client=google.accounts.oauth2.initTokenClient({client_id:googleOAuthClientId,scope:scopes.join(" "),callback:async response=>{if(response.error){toast("YouTube authorization failed: "+response.error);return}state.token=response.access_token;await loadChannelData()}});
 client.requestAccessToken({prompt:"consent"});
}
async function apiRequest(url){const r=await fetch(url,{headers:{Authorization:"Bearer "+state.token}});const data=await r.json();if(!r.ok)throw new Error(data.error?.message||"YouTube API request failed.");return data}
async function yt(path,params={}){if(!state.token)throw new Error("Connect YouTube first.");const url=new URL("https://www.googleapis.com/youtube/v3/"+path);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));return apiRequest(url)}
async function analytics(params){const url=new URL("https://youtubeanalytics.googleapis.com/v2/reports");Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));return apiRequest(url)}
async function report(params){const range=dateRange();return analytics({ids:"channel==MINE",...range,...params})}
async function loadChannelData(){
 try{toast("Loading channel data…");const ch=await yt("channels",{part:"snippet,statistics,contentDetails",mine:"true"});if(!ch.items?.length)throw new Error("No YouTube channel was found for the authorized Google account.");state.channel=ch.items[0];const uploads=state.channel.contentDetails.relatedPlaylists.uploads;const pl=await yt("playlistItems",{part:"snippet,contentDetails",playlistId:uploads,maxResults:"25"});const ids=(pl.items||[]).map(x=>x.contentDetails.videoId).join(",");const details=ids?await yt("videos",{part:"snippet,statistics,contentDetails",id:ids}):{items:[]};state.videos=details.items||[];renderVideos();$("metric-videos").textContent=number(state.channel.statistics.videoCount);$("last-updated").textContent="Updated "+new Date().toLocaleTimeString();$("recent-videos").innerHTML=state.videos.slice(0,4).map(videoRow).join("")||'<div class="empty-state">No uploaded videos found.</div>';$("topic-signals").innerHTML=topicSummary();setConnected(true);await loadOverviewAnalytics();await loadInsights();toast("Channel and available analytics loaded.")}catch(e){toast(e.message);console.error(e)}
}
async function loadOverviewAnalytics(){try{const r=await report({metrics:"views,estimatedMinutesWatched,subscribersGained"});const row=r.rows?.[0]||[0,0,0];$("metric-views").textContent=number(row[0]);$("metric-watch").textContent=(Number(row[1]||0)/60).toFixed(1);$("metric-subs").textContent=number(row[2]);$("views-change").textContent="Most recent 28 complete days"}catch(e){$("metric-views").textContent="—";$("metric-watch").textContent="—";$("metric-subs").textContent="—";$("views-change").textContent="Analytics not available yet";console.info("Overview analytics:",e.message)}}
async function loadInsights(){
 if(!state.token){toast("Connect YouTube to load audience insights.");return}
 toast("Refreshing audience insights…");
 const jobs=await Promise.allSettled([
  report({metrics:"views,estimatedMinutesWatched,subscribersGained",dimensions:"day",sort:"day"}),
  report({metrics:"views,estimatedMinutesWatched",dimensions:"insightTrafficSourceType",sort:"-views"}),
  report({metrics:"views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage",dimensions:"video",sort:"-views",maxResults:"10"})
 ]);
 const [daily,traffic,top]=jobs;
 if(daily.status==="fulfilled")renderDaily(daily.value);else renderReportError("daily-performance",daily.reason);
 if(traffic.status==="fulfilled")renderTraffic(traffic.value);else renderReportError("traffic-sources",traffic.reason);
 if(top.status==="fulfilled")renderTopVideos(top.value);else renderReportError("top-videos",top.reason);
 $("topic-signals").innerHTML=topicSummary();
 const dates=dateRange();$("report-window").textContent=dates.startDate.slice(5)+" – "+dates.endDate.slice(5);
 await runAutoOptimization();
}
function renderReportError(id,error){$(id).innerHTML='<div class="empty-state">This report is not available yet. '+escapeHtml(error?.message||"Try refreshing later.")+'</div>'}
function renderDaily(data){
 const rows=data.rows||[];if(!rows.length){$("daily-performance").innerHTML='<div class="empty-state">YouTube has not returned daily analytics for this period yet.</div>';return}
 const max=Math.max(1,...rows.map(r=>Number(r[1]||0)));
 $("daily-performance").innerHTML='<div class="bar-chart">'+rows.slice(-28).map(r=>'<div class="bar-col" title="'+escapeHtml(r[0])+': '+number(r[1])+' views"><div class="bar-value">'+(Number(r[1])?number(r[1]):"")+'</div><div class="bar-track"><i style="height:'+Math.max(2,Number(r[1]||0)/max*100)+'%"></i></div><small>'+escapeHtml(r[0].slice(5))+'</small></div>').join("")+'</div>';
}
function renderTraffic(data){
 const rows=(data.rows||[]).filter(r=>Number(r[1])>0);if(!rows.length){$("traffic-sources").innerHTML='<div class="empty-state">No traffic-source breakdown is available for this period yet.</div>';$("top-source").textContent="—";return}
 const total=rows.reduce((s,r)=>s+Number(r[1]||0),0);$("top-source").textContent=String(rows[0][0]).replace(/_/g," ").toLowerCase();
 $("traffic-sources").innerHTML=rows.slice(0,8).map(r=>'<div class="rank-row"><div><b>'+escapeHtml(String(r[0]).replace(/_/g," ").toLowerCase())+'</b><small>'+number(r[1])+' views · '+(total?Math.round(Number(r[1])/total*100):0)+'%</small></div><div class="rank-track"><i style="width:'+(total?Number(r[1])/total*100:0)+'%"></i></div></div>').join("");
}
function renderTopVideos(data){
 const rows=data.rows||[];state.performance=new Map(rows.map(r=>[r[0],{views:Number(r[1]||0),averageViewDuration:Number(r[3]||0),averageViewPercentage:Number(r[4]||0)}]));if(!rows.length){$("top-videos").innerHTML='<div class="empty-state">No video-level analytics are available for this period yet.</div>';$("top-video").textContent="—";$("avg-duration").textContent="—";return}
 const ids=rows.map(r=>r[0]);const lookup=new Map(state.videos.map(v=>[v.id,v.snippet.title]));$("top-video").textContent=(lookup.get(ids[0])||ids[0]).slice(0,26);
 const totalViews=rows.reduce((s,r)=>s+Number(r[1]||0),0);const weighted=rows.reduce((s,r)=>s+Number(r[1]||0)*Number(r[3]||0),0);$("avg-duration").textContent=totalViews?Math.round(weighted/totalViews)+" sec":"—";
 $("top-videos").innerHTML=rows.slice(0,8).map((r,i)=>'<div class="rank-row"><div><b>'+escapeHtml(lookup.get(r[0])||("Video "+(i+1)))+'</b><small>'+number(r[1])+' views · '+Math.round(Number(r[3]||0))+' sec avg view</small></div><span class="rank-number">#'+(i+1)+'</span></div>').join("");
}
function renderAutoOptimizeStatus(note=""){
 const el=$("auto-optimize-status");if(!el)return;
 el.innerHTML=state.autoOptimize
 ?'<b class="auto-on">Evidence-based automatic optimization is ON</b><span>For videos with at least 100 views, JOWI AI checks their YouTube Search terms. It may add a proven search phrase to the title only when that phrase generated at least 20 views for that video. It also removes duplicate hashtags and excess spacing. Original meaning is preserved.</span>'
 :'<b class="auto-off">Automatic updates are paused</b><span>Turn it on to allow evidence-gated search-title alignment and safe formatting cleanup. You can still review suggestions manually.</span>';
 if(note)el.insertAdjacentHTML("beforeend",'<small class="auto-note">'+escapeHtml(note)+'</small>');
 $("toggle-auto-optimize").textContent=state.autoOptimize?"Pause auto updates":"Enable auto updates";
}
function cleanMetadataText(value){
 let text=String(value||"").replace(/[ \t]+/g," ").replace(/\s+\n/g,"\n").trim();
 const seen=new Set();
 text=text.replace(/#[\p{L}\p{N}_]+/gu,tag=>{const key=tag.toLowerCase();if(seen.has(key))return "";seen.add(key);return tag});
 return text.replace(/ {2,}/g," ").replace(/\n{3,}/g,"\n\n").trim();
}
function safeSearchPhrase(value){
 const phrase=String(value||"").replace(/[^\p{L}\p{N}\s'-]/gu," ").replace(/\s+/g," ").trim();
 return phrase.length>=8&&phrase.length<=48&&phrase.split(" ").filter(Boolean).length>=2?phrase:"";
}
async function bestVideoSearchPhrase(videoId){
 const data=await report({metrics:"views",dimensions:"insightTrafficSourceDetail",filters:"video=="+videoId+";insightTrafficSourceType==YT_SEARCH",sort:"-views",maxResults:"10"});
 return (data.rows||[]).map(row=>({phrase:safeSearchPhrase(row[0]),views:Number(row[1]||0)})).find(row=>row.phrase&&row.views>=20)||null;
}
async function runAutoOptimization(){
 renderAutoOptimizeStatus();
 if(!state.autoOptimize||!state.token||!state.videos.length)return;
 let cleaned=0,aligned=0,waiting=0,failed=0,checked=0;
 for(const video of state.videos){
  const metrics=state.performance.get(video.id);
  if(!metrics||metrics.views<100){waiting++;continue}
  checked++;
  let title=cleanMetadataText(video.snippet.title);
  const description=cleanMetadataText(video.snippet.description);
  try{
   const search=await bestVideoSearchPhrase(video.id);
   if(search&&!title.toLocaleLowerCase().includes(search.phrase.toLocaleLowerCase())){
    const candidate=(search.phrase+" | "+title).trim();
    if(candidate.length<=100){title=candidate}
   }
   if(title!==video.snippet.title||description!==video.snippet.description){
    const titleChanged=title!==video.snippet.title;
    await applyMetadata(video,title,description,true);
    if(titleChanged)aligned++;else cleaned++;
   }
  }catch(e){failed++;console.warn("Automatic metadata optimization:",e.message)}
 }
 const note=aligned?aligned+" title(s) aligned with proven YouTube Search phrases.":cleaned?cleaned+" video(s) received safe formatting cleanup.":waiting?"Waiting for at least 100 reported views per video; no metadata changed.":checked?"No sufficiently strong search phrase or safe cleanup was found.":"No eligible video analytics were available yet.";
 renderAutoOptimizeStatus(note+(failed?" "+failed+" report/update(s) could not be completed.":""));
}
function videoRow(v){const s=v.snippet;return '<div class="video-row"><img class="thumb" src="'+(s.thumbnails?.medium?.url||"")+'" alt=""><div class="video-info"><b>'+escapeHtml(s.title)+'</b><small>'+dateLabel(s.publishedAt)+' · '+number(v.statistics?.viewCount)+' views</small></div><button class="video-action" data-opt="'+v.id+'">Optimize</button></div>'}
function titleSuggestion(title){let clean=title.replace(/\s+/g," ").trim();if(clean.length>68)clean=clean.slice(0,65).replace(/\s+\S*$/,"")+"…";return clean||"A clear, specific title explaining the viewer benefit"}
function descriptionSuggestion(v){const base=(v.snippet.description||"").trim();return base||v.snippet.title+". In this video, we explore the key ideas, practical steps and useful takeaways. Subscribe for more videos on this topic."}
function renderVideos(){const html=state.videos.map(v=>{const s=v.snippet;return '<div class="video-card"><img src="'+(s.thumbnails?.medium?.url||"")+'" alt=""><div><h4>'+escapeHtml(s.title)+'</h4><p>'+dateLabel(s.publishedAt)+' · '+number(v.statistics?.viewCount)+' views · '+number(v.statistics?.likeCount)+' likes</p><div class="suggestion"><label>Title review</label>'+escapeHtml(titleSuggestion(s.title))+'<small style="display:block;color:#91a1b9;margin-top:5px">A concise review draft, not a guaranteed performance prediction.</small></div><div class="suggestion"><label>Description review</label>'+escapeHtml((s.description||"Add a concise summary in the opening lines.").slice(0,220))+'</div><button class="apply-btn" data-opt="'+v.id+'">Review title & description</button></div></div>'}).join("");$("all-videos").innerHTML=html||'<div class="empty-state">No uploads found. Make sure the selected Google account owns a YouTube channel.</div>'}
function topicSummary(){const words={};state.videos.forEach(v=>(v.snippet.title+" "+(v.snippet.description||"").slice(0,180)).toLowerCase().match(/[a-z]{4,}/g)?.forEach(w=>{if(!["with","from","your","this","that","what","when","have","will","into","about","video","how","more","than","then","they","their","subscribe","channel"].includes(w))words[w]=(words[w]||0)+1}));const top=Object.entries(words).sort((a,b)=>b[1]-a[1]).slice(0,12);return top.length?top.map(([w,n])=>'<span class="topic-chip"><b>'+escapeHtml(w)+'</b><small>'+n+' mentions</small></span>').join(""):'<div class="empty-state">Not enough video titles to identify recurring topics yet.</div>'}
document.addEventListener("click",e=>{const b=e.target.closest("[data-opt]");if(!b)return;const v=state.videos.find(x=>x.id===b.dataset.opt);if(v)openReview(v)});
function openReview(v){const s=v.snippet;const newTitle=prompt("Review or edit the video title before applying:",titleSuggestion(s.title));if(newTitle===null)return;const newDescription=prompt("Review or edit the video description:",descriptionSuggestion(v));if(newDescription===null)return;if(!newTitle.trim()){toast("Title cannot be empty.");return}if(!confirm("Apply these changes to YouTube? Only this selected video's title and description will be updated."))return;applyMetadata(v,newTitle.trim(),newDescription)}
async function applyMetadata(v,title,description,silent=false){try{const body={id:v.id,snippet:{title,description,categoryId:v.snippet.categoryId||"22",tags:v.snippet.tags||[]}};const r=await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet",{method:"PUT",headers:{Authorization:"Bearer "+state.token,"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error?.message||"Could not update video.");if(!silent)toast("Video metadata updated.");const i=state.videos.findIndex(x=>x.id===v.id);if(i>=0)state.videos[i].snippet=data.snippet;renderVideos();$("recent-videos").innerHTML=state.videos.slice(0,4).map(videoRow).join("")}catch(e){if(!silent)toast("Update failed: "+e.message);throw e}}
renderAutoOptimizeStatus();
showView("overview");
