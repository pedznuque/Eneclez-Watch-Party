function isWebtorUrl(value) {
    try { const u=new URL(value); return u.protocol==='https:'&&['webtor.io','www.webtor.io'].includes(u.hostname)&&!u.username&&!u.password&&!u.port; } catch { return false; }
}
function isWebtorVideoUrl(value) {
    return isWebtorUrl(value)&&/^\/[a-f0-9]{40}(?:\/|$)/i.test(new URL(value).pathname);
}
// Installed in the provider page, like the existing browser link detector.
// The browser reports only after decoded playback starts. Native first-party
// forms, captions and player controls remain owned by Webtor.
function webtorPageRuntime(role) {
    if(location.protocol!=='https:'||!['webtor.io','www.webtor.io'].includes(location.hostname))return null;
    const key='watch-party-webtor-selection';
    let saved=null;try{saved=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
    const model=window.__watchPartyWebtorPage ||= {role,selection:saved,announced:false};
    model.role=role;
    function selection(form) {
        const hash=/^\/([a-f0-9]{40})(?:\/|$)/i.exec(location.pathname)?.[1] || /^https:\/\/webtor\.io\/([a-f0-9]{40})/i.exec(model.selection?.url||'')?.[1];
        if(!hash)return null;
        const data=form?new FormData(form):null;
        const path=document.querySelector('#file[data-status-file]')?.getAttribute('data-status-file') || data?.get('path') || data?.get('file') || new URL(location.href).searchParams.get('file') || (model.selection?.url?new URL(model.selection.url).searchParams.get('file'):'');
        if(!path||typeof path!=='string'||path.length>4096||/[\x00-\x1f]/.test(path))return null;
        const url=new URL('https://webtor.io/'+hash.toLowerCase());url.searchParams.set('file',path);
        const slash=path.lastIndexOf('/');if(slash>=0)url.searchParams.set('pwd',path.slice(0,slash)||'/');
        return {url:url.href,title:path.split(/[\\/]/).pop()||'Webtor video'};
    }
    function onPlaying(video) {
        if(model.role!=='browser'||video?.tagName!=='VIDEO'||!video.matches('.wt-player video,video.player')||video.readyState<2||!video.videoWidth)return;
        const picked=selection()||model.selection;if(!picked)return;
        video.muted=true;video.pause();
        if(model.announced===picked.url)return;
        model.announced=picked.url;model.selection=picked;
        console.info('__WATCH_PARTY_VIDEO_SELECTED__'+JSON.stringify({...picked,action:'play'}));
        let style=document.getElementById('watch-party-webtor-preview');
        if(!style){style=document.createElement('style');style.id='watch-party-webtor-preview';document.head.append(style);}
        style.textContent='.wt-player-stage,.wt-player-mount{display:none!important}';
    }
    if(!model.bound){
        model.bound=true;
        const keepNativeForm=event=>{
            const form=event.type==='submit'?event.target:event.target.closest?.('button,input[type="submit"]')?.form;if(form?.tagName!=='FORM')return;
            const action=new URL(form.action,location.href);
            if(action.origin!==location.origin||!/^\/stream-video\/?$/.test(action.pathname))return;
            // Preserve the real POST and its session; never replay its URL.
            form.target='_self';if(event.submitter)event.submitter.formTarget='_self';
            const picked=selection(form);if(picked){model.selection=picked;model.announced=false;try{sessionStorage.setItem(key,JSON.stringify(picked));}catch{}}
            document.getElementById('watch-party-webtor-preview')?.remove();
        };
        document.addEventListener('submit',keepNativeForm,true);
        document.addEventListener('click',keepNativeForm,true);
        document.addEventListener('playing',event=>onPlaying(event.target),true);
    }
    // Webtor also creates hidden codec-probe videos. Those are not the movie
    // and must never trigger handoff or make the upper player look ready.
    const video=document.querySelector('.wt-player video,video.player');
    if(role==='browser'){
        if(video){video.muted=true;if(!video.paused)onPlaying(video);}
        return {ready:false};
    }
    if(!video){
        const forms=Array.from(document.forms).filter(form=>{const u=new URL(form.action,location.href);return u.origin===location.origin&&/^\/stream-video\/?$/.test(u.pathname);});
        if(forms.length===1&&!model.started){model.started=true;forms[0].requestSubmit();}
        const error=/^CSRF token mismatch/i.test(document.body?.innerText?.trim()||'')?'Webtor rejected the session. Retry the video.':'';
        return {ready:false,error,needsInteraction:/\/(login|auth)(\/|$)/.test(location.pathname)};
    }
    const ready=video.readyState>=2&&video.videoWidth>0;
    if(ready&&!video.closest('.watch-party-webtor-target')){
        const target=video.closest('.wt-player,.video-js,.plyr')||video.parentElement;
        if(target&&target!==document.body){
            target.classList.add('watch-party-webtor-target');
            for(let node=target;node.parentElement;node=node.parentElement){node.parentElement.classList.add('watch-party-webtor-ancestor');for(const sibling of node.parentElement.children)if(sibling!==node)sibling.classList.add('watch-party-webtor-hidden');}
            const modal=document.getElementById('subtitles');for(let node=modal;node;node=node.parentElement)node.classList.remove('watch-party-webtor-hidden');
            const style=document.createElement('style');style.textContent=`html,body{margin:0!important;padding:0!important;height:100%!important;overflow:hidden!important;background:#000!important}.watch-party-webtor-hidden{display:none!important}.watch-party-webtor-ancestor{position:static!important;transform:none!important;contain:none!important}.watch-party-webtor-target{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;max-width:none!important;background:#000!important;z-index:100!important}.watch-party-webtor-target video{width:100%!important;height:100%!important;object-fit:contain!important}`;document.head.append(style);
        }
    }
    if(video.paused&&!model.hasPlayed)video.play().catch(()=>{});
    if(!video.paused)model.hasPlayed=true;
    return {ready,error:video.error?.message||'',selection:selection()||model.selection};
}
// Adapter for the app's existing player interface. Native provider handlers
// still own transcoder seeks and lazy subtitle loading.
function webtorControlRuntime() {
    if(location.protocol!=='https:'||!['webtor.io','www.webtor.io'].includes(location.hostname))return null;
    const movie=()=>document.querySelector('.wt-player video,video.player');
    if(!movie())return null;
    if(window.watchPartyPlayer?.provider==='webtor')return window.watchPartyPlayer.getState();
    const control={requestedPaused:movie().paused,pending:null,error:''};
    const style=document.createElement('style');style.id='watch-party-webtor-app-controls';
    style.textContent='.wt-player-controls{opacity:0!important;visibility:hidden!important;pointer-events:none!important}.wt-player-top-overlay,.wt-player-top,.wt-player-topbar,.wt-player-title,.wt-player-top-share,.wt-player-overlay--play{display:none!important}.watch-party-webtor-target{pointer-events:none!important}#subtitles,#subtitles *{pointer-events:auto!important}';
    document.head.append(style);
    function state(){
        const video=movie();if(!video)return {provider:'webtor',ready:false,paused:true,duration:0,currentTime:0};
        video.controls=false;
        const offset=Math.max(0,Number(video.dataset.runOffset)||0);
        const full=Number(video.dataset.duration)||Number(document.querySelector('.wt-player-progress')?.getAttribute('aria-valuemax'));
        const duration=Number.isFinite(full)&&full>0?full:Number.isFinite(video.duration)?video.duration:0;
        const actual=(Number(video.currentTime)||0)+offset;
        if(control.pending&&(Math.abs(actual-control.pending.time)<1.5&&!video.seeking&&video.readyState>=2))control.pending=null;
        if(control.pending&&Date.now()-control.pending.at>45000){control.pending=null;control.error='Webtor could not finish seeking. Retry that position.';}
        return {provider:'webtor',ready:video.readyState>=2&&video.videoWidth>0,currentTime:control.pending?.time??actual,duration,paused:video.paused,requestedPaused:control.requestedPaused,
            ended:video.ended&&(!duration||actual>=duration-1),seeking:Boolean(control.pending||video.seeking||video.dataset.transferSeeking),buffering:video.readyState<3,
            videoWidth:video.videoWidth,videoHeight:video.videoHeight,error:control.error,subtitles:subtitleChoices(),subtitleSettings:Boolean(document.getElementById('subtitles'))};
    }
    function subtitleChoices(){
        const items=Array.from(document.querySelectorAll('#subtitles .subtitle[data-id]'));
        if(items.length)return items.map(item=>({id:item.dataset.id,label:item.dataset.id==='none'?'Off':item.dataset.label||item.dataset.srclang||item.textContent.trim()||'Subtitle',selected:item.dataset.default==='true',disabled:item.dataset.locked==='true'||item.disabled}));
        return [{id:'none',label:'Off',selected:!Array.from(movie()?.textTracks||[]).some(track=>track.mode==='showing')},...Array.from(movie()?.textTracks||[]).filter(track=>['captions','subtitles'].includes(track.kind)).map((track,index)=>({id:'native:'+index,label:track.label||track.language||`Track ${index+1}`,selected:track.mode==='showing'}))];
    }
    async function pause(paused){
        const video=movie();if(!video)return state();control.requestedPaused=Boolean(paused);
        if(window.__watchPartyWebtorPage)window.__watchPartyWebtorPage.hasPlayed=true;
        window.dispatchEvent(new CustomEvent(paused?'player_paused':'player_play'));
        if(paused)video.pause();
        else if(video.paused){
            const button=document.querySelector('.wt-player-btn--play');
            if(button&&!button.disabled)button.click();
            else if(!button)await video.play().catch(error=>{control.error=error.message;});
        }
        return state();
    }
    async function seek(time,resume){
        if(!Number.isFinite(time)||time<0)return state();
        const before=state(),video=movie();if(!video||before.seeking)return before;
        const target=Math.max(0,Math.min(before.duration||time,time));
        await pause(!resume);control.error='';
        const bar=document.querySelector('.wt-player-progress'),rect=bar?.getBoundingClientRect();
        if(bar&&rect.width>0&&before.duration>0&&!bar.classList.contains('wt-player-progress--disabled')){
            control.pending={time:target,at:Date.now()};
            const point={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',button:0,clientX:rect.left+rect.width*target/before.duration,clientY:rect.top+rect.height/2};
            bar.dispatchEvent(new PointerEvent('pointerdown',point));document.dispatchEvent(new PointerEvent('pointerup',point));
        }else if(!video.dataset.sessionSeekUrl){video.currentTime=Math.max(0,target-(Number(video.dataset.runOffset)||0));}
        else control.error='Webtor is not ready to seek. Wait for buffering to finish.';
        return state();
    }
    window.watchPartyPlayer={provider:'webtor',getState:state,getQualityCapabilities:()=>({manual:false}),setPaused:pause,seekTo:seek,
        async syncTo(time,paused,options={}){const before=state();if(!before.seeking&&Math.abs(before.currentTime-time)>1.15)await seek(time,!paused&&!options.paused);else await pause(Boolean(paused||options.paused));return state();},
        setVolume(value){const video=movie();if(video){video.volume=Math.max(0,Math.min(1,Number(value)/100));video.muted=Number(value)<=0;}return state();},
        selectSubtitle(id){
            const item=Array.from(document.querySelectorAll('#subtitles .subtitle[data-id]')).find(item=>item.dataset.id===id);
            if(item){if(item.dataset.locked!=='true'&&!item.disabled)item.click();}
            else{const tracks=Array.from(movie()?.textTracks||[]).filter(track=>['captions','subtitles'].includes(track.kind));tracks.forEach((track,index)=>track.mode=id==='native:'+index?'showing':'disabled');}
            return state();
        },
        showSubtitleSettings(){const modal=document.getElementById('subtitles');if(modal){for(let node=modal;node;node=node.parentElement)node.classList.remove('watch-party-webtor-hidden');modal.showModal?.();}return state();}
    };
    return state();
}
if(typeof module!=='undefined'&&module.exports)module.exports={isWebtorUrl,isWebtorVideoUrl,webtorPageRuntime,webtorControlRuntime};
