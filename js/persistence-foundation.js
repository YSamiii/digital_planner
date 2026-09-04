(function(){
  'use strict';
  const quotaCleanupHandlers=[];
  const quotaError=error=>/quota/i.test(String(error?.name||''))||/quota|storage.*full|space/i.test(String(error?.message||''));
  const byteLength=value=>{
    try{return new Blob([String(value??'')]).size;}catch(_){return String(value??'').length*2;}
  };
  /*
   * One canonical write path for normal saves and recovery writes.  It holds
   * the candidate only in memory, never creates staging/shadow keys, and can
   * retry exactly once after a registered, explicitly-safe transient cleanup.
   * Cleanup registrations are deliberately constrained: the canonical key,
   * snapshots, and forensic/recovery evidence may never be removed here.
   */
  function registerQuotaSafeCleanup(handler){
    if(typeof handler!=='function')throw new Error('Quota cleanup handler must be a function');
    quotaCleanupHandlers.push(handler);
    return ()=>{const index=quotaCleanupHandlers.indexOf(handler);if(index>=0)quotaCleanupHandlers.splice(index,1);};
  }
  function allowedCleanup(result,key){
    if(!result||result.safe!==true)return false;
    const removed=Array.isArray(result.removedKeys)?result.removedKeys:[];
    return removed.every(item=>{
      const candidate=String(item||'');
      return candidate!==String(key) && /^journal-planner-transient-/.test(candidate);
    });
  }
  function runCompactRetry(context){
    const actions=[];
    for(const handler of quotaCleanupHandlers){
      let result;
      try{result=handler({...context,attempt:'compact_retry'});}catch(error){actions.push({safe:false,error:String(error?.message||error)});continue;}
      if(!allowedCleanup(result,context.key)){actions.push({safe:false,rejected:true});continue;}
      actions.push({safe:true,removedKeys:[...(result.removedKeys||[])],releasedBytes:Number(result.releasedBytes||0)});
    }
    // A retry is still safe when there is no approved transient artifact: it
    // does not delete records, snapshots, evidence, or the candidate.
    return {attempted:true,actions,releasedBytes:actions.reduce((sum,item)=>sum+Number(item.releasedBytes||0),0)};
  }
  function commitCanonical({storage,key,payload,onAttempt,onSuccess,onFailure,verifyReadBack,compactRetry=true}){
    const candidate=String(payload??'');
    const info={key:String(key),candidateBytes:byteLength(candidate),stagingBytes:0,shadowBytes:0,temporaryBytes:0,retryCount:0,compact:null};
    const attempt=phase=>{
      try{
        onAttempt?.({phase,payload:candidate,...info});
        storage.setItem(key,candidate);
        const readBack=storage.getItem(key);
        if(readBack!==candidate)throw new Error('持久化 read-back 校验失败');
        const verified=typeof verifyReadBack==='function'?verifyReadBack(readBack):null;
        const result={ok:true,stage:'read-back',persisted:true,payloadBytes:info.candidateBytes,retryCount:info.retryCount,verified,commitFootprint:{candidateBytes:info.candidateBytes,stagingBytes:0,shadowBytes:0,temporaryBytes:0}};
        onSuccess?.({phase,payload:candidate,...result});
        return result;
      }catch(error){return {ok:false,error,stage:phase==='initial'?'localStorage.setItem':'compact-retry'};}
    };
    let result=attempt('initial');
    if(result.ok)return result;
    if(!quotaError(result.error)||compactRetry===false){const failure={ok:false,stage:result.stage,errorName:result.error?.name||'Error',message:result.error?.message||String(result.error||'保存失败'),persisted:false,retryCount:0,commitFootprint:{candidateBytes:info.candidateBytes,stagingBytes:0,shadowBytes:0,temporaryBytes:0}};onFailure?.(failure);return failure;}
    info.retryCount=1;info.compact=runCompactRetry({storage,key,payload:candidate,candidateBytes:info.candidateBytes});
    info.temporaryBytes=0;
    result=attempt('compact_retry');
    if(result.ok)return result;
    const failure={ok:false,stage:'compact-retry',errorName:result.error?.name||'Error',message:result.error?.message||String(result.error||'保存失败'),persisted:false,retryCount:1,compact:info.compact,commitFootprint:{candidateBytes:info.candidateBytes,stagingBytes:0,shadowBytes:0,temporaryBytes:0}};onFailure?.(failure);return failure;
  }
  function fallbackState(defaultState,hydrateState){
    try{return hydrate(defaultState(),hydrateState);}catch(_){return defaultState();}
  }
  function failure(defaultState,error,rawPresent,rawLength,source,hydrateState){
    return {state:fallbackState(defaultState,hydrateState),status:'load_failure',source:source||'canonical',error:{name:error?.name||'Error',message:error?.message||String(error||'Load failure')},canonicalRawPresent:rawPresent,canonicalRawLength:rawLength};
  }
  function parseState(raw,label){
    const parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error(`${label} state root is not an object`);
    return parsed;
  }
  function hydrate(candidate,hydrateState){
    return typeof hydrateState==='function'?hydrateState(candidate):candidate;
  }
  function loadCanonicalState({storage,key,legacyKeys=[],defaultState,hydrateState}){
    let canonicalRaw;
    try{canonicalRaw=storage.getItem(key);}catch(error){return failure(defaultState,error,null,null,'canonical',hydrateState);}
    if(canonicalRaw!==null){
      try{return {state:hydrate(parseState(canonicalRaw,'Canonical'),hydrateState),status:'loaded',source:'canonical',canonicalRawPresent:true,canonicalRawLength:canonicalRaw.length};}
      catch(error){return failure(defaultState,error,true,canonicalRaw.length,'canonical',hydrateState);}
    }
    for(const legacyKey of legacyKeys){
      let legacyRaw;
      try{legacyRaw=storage.getItem(legacyKey);}catch(error){return failure(defaultState,error,false,0,`legacy:${legacyKey}`,hydrateState);}
      if(legacyRaw===null)continue;
      try{return {state:hydrate(parseState(legacyRaw,`Legacy ${legacyKey}`),hydrateState),status:'loaded',source:`legacy:${legacyKey}`,canonicalRawPresent:false,canonicalRawLength:0};}
      catch(error){return failure(defaultState,error,false,0,`legacy:${legacyKey}`,hydrateState);}
    }
    try{return {state:hydrate(defaultState(),hydrateState),status:'new',source:'new',canonicalRawPresent:false,canonicalRawLength:0};}
    catch(error){return failure(defaultState,error,false,0,'new',hydrateState);}
  }
  const api={loadCanonicalState,commitCanonical,registerQuotaSafeCleanup,quotaError};
  if(typeof window!=='undefined')window.PersistenceFoundation=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
