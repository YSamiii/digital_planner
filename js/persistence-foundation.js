(function(){
  'use strict';
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
  window.PersistenceFoundation={loadCanonicalState};
})();
