const test=require('node:test'),assert=require('node:assert/strict');
const {isWebtorUrl,isWebtorVideoUrl}=require('../src/js/webtor-provider');
test('Webtor provider accepts canonical HTTPS pages and rejects hostile URL forms',()=>{
    const hash='a'.repeat(40);
    assert.equal(isWebtorUrl('https://webtor.io/'),true);
    assert.equal(isWebtorVideoUrl('https://webtor.io/'),false);
    assert.equal(isWebtorVideoUrl(`https://webtor.io/${hash}?file=%2FSeason%2FEpisode02.mkv`),true);
    assert.equal(isWebtorVideoUrl('https://webtor.io/stream-video'),false);
    for(const url of [`https://webtor.io.evil.example/${hash}`,`http://webtor.io/${hash}`,`https://user:password@webtor.io/${hash}`,`https://webtor.io:9000/${hash}`])assert.equal(isWebtorUrl(url),false);
});
const vm=require('node:vm');
const {webtorControlRuntime,webtorPageRuntime}=require('../src/js/webtor-provider');
function controlFixture(){
    let now=0,seeks=0,events=0,end=600;
    const video={paused:false,currentTime:20,duration:30,readyState:4,videoWidth:320,videoHeight:180,seeking:false,ended:false,dataset:{duration:'600',runOffset:'0',sessionSeekUrl:'/session/seek'},textTracks:[],playbackRate:1,
        buffered:{length:1,start:()=>0,end:()=>end},pause(){this.paused=true},async play(){this.paused=false}};
    const bar={getBoundingClientRect:()=>({left:0,top:0,width:600,height:10}),classList:{contains:()=>false},dispatchEvent(){seeks++}};
    const document={head:{append(){}},createElement:()=>({}),getElementById:()=>null,querySelector:s=>s==='.wt-player video,video.player'?video:s==='.wt-player-progress'?bar:null,querySelectorAll:()=>[],dispatchEvent(event){const offset=Math.floor(event.clientX/30)*30;video.dataset.runOffset=String(offset);video.currentTime=event.clientX-offset}};
    const window={dispatchEvent(){events++}};
    const context={location:{protocol:'https:',hostname:'webtor.io'},document,window,Date:{now:()=>now},CustomEvent:class{},PointerEvent:class{constructor(type,options){Object.assign(this,options)}}};
    vm.runInNewContext(`(${webtorControlRuntime.toString()})()`,context);
    return {player:window.watchPartyPlayer,video,advance(ms){now+=ms},limit(value){end=value},get seeks(){return seeks},get events(){return events}};
}
test('nine minutes of guest heartbeats preserve the native session without repeated play or seek requests',async()=>{
    const f=controlFixture();
    for(let i=0;i<180;i++){
        f.video.currentTime=20+i*3;f.advance(3000);
        await f.player.syncTo(f.video.currentTime+.5,false,{paused:false});
    }
    assert.equal(f.seeks,0);assert.equal(f.events,0);assert.equal(f.video.paused,false);
    await f.player.syncTo(f.video.currentTime+2,false,{paused:false});
    assert.equal(f.seeks,0,'buffered drift correction stays local');
});
test('small unbuffered drift uses gentle rate correction while a real room jump seeks once',async()=>{
    const f=controlFixture();f.limit(20.5);
    await f.player.syncTo(22,false);assert.equal(f.seeks,0);assert.equal(f.video.playbackRate,1.03);
    f.advance(3000);await f.player.syncTo(80,false);assert.equal(f.seeks,1);
    assert.equal(f.player.getState().currentTime,80);
    f.video.dataset.transferSeeking='';
    for(let i=0;i<5;i++){f.advance(3000);await f.player.syncTo(80+i*3,false)}
    assert.equal(f.seeks,1);assert.equal(f.events,0,'heartbeat cannot replay native play during a session transfer');
    assert.equal(f.player.getState().seeking,true,'an empty transferSeeking attribute still means seeking');
});
test('room pause is applied once and buffering heartbeats do not restart the native player',async()=>{
    const f=controlFixture();await f.player.syncTo(20,true);await f.player.syncTo(20,true);
    assert.equal(f.events,1);assert.equal(f.video.paused,true);
    f.video.readyState=1;await f.player.syncTo(60,false);
    assert.equal(f.events,1);assert.equal(f.seeks,0);assert.equal(f.video.paused,true);
});
test('verification remains visible without automatic form submission or fake playback',()=>{
    let submitted=0,restored=0;
    const document={body:{innerText:'Checking that you are not a robot'},addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[{classList:{remove(){restored++}}}],getElementById:()=>({remove(){}}),forms:[{requestSubmit(){submitted++}}]};
    const state=vm.runInNewContext(`(${webtorPageRuntime.toString()})('player')`,{location:{protocol:'https:',hostname:'webtor.io'},sessionStorage:{getItem:()=>null},window:{},document});
    assert.equal(state.needsInteraction,true);assert.equal(state.interaction,'verification');assert.equal(state.ready,false);assert.equal(state.provider,'webtor');assert.equal(submitted,0);assert.equal(restored,1);
});
