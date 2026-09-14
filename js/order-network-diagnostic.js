(function(){'use strict';
const recognitionEndpoint='https://handbook-orders-ai-staging.samanthayaosy.workers.dev/orders/recognize';
const healthEndpoint=`${new URL(recognitionEndpoint).origin}/orders/health`;
const state={origin:window.location.origin||'N/A',endpoint:recognitionEndpoint,stage:'not_started',httpStatus:'N/A',errorName:'N/A',errorCode:'',errorMessage:'N/A',imageCount:'N/A',normalizedImageBytes:'N/A',requestBodyBytes:'N/A',bodyType:'N/A'};
const labels={origin:'Origin',endpoint:'Endpoint',stage:'Fetch stage',httpStatus:'HTTP status',errorName:'Error name',errorCode:'Error code',errorMessage:'Error message',imageCount:'Image count',normalizedImageBytes:'Normalized image bytes',requestBodyBytes:'Final JSON body bytes',bodyType:'Request body type'};
function render(){const root=document.querySelector('#orderScreenshotNetworkDiagnostic');if(!root)return;for(const [key,label] of Object.entries(labels)){const field=root.querySelector(`[data-network-diagnostic="${key}"]`);if(field)field.textContent=`${label}: ${state[key]}`;}}
function reset(update={}){Object.assign(state,{origin:window.location.origin||'N/A',endpoint:recognitionEndpoint,stage:'not_started',httpStatus:'N/A',errorName:'N/A',errorCode:'',errorMessage:'N/A'},update);render();}
function record(update={}){Object.assign(state,update);render();}
function beginRecognition(metadata={}){reset({endpoint:recognitionEndpoint,...metadata,stage:'before_fetch'});}
function byteLength(value){return new TextEncoder().encode(value).byteLength;}
async function probe(endpoint,options={}){reset({endpoint,stage:'before_fetch'});try{const response=await fetch(endpoint,options);record({stage:'response_received',httpStatus:response.status,errorCode:response.ok?'':'http_error'});return response;}catch(error){record({stage:'fetch_rejected',errorName:error?.name||'Error',errorCode:error?.name==='AbortError'?'cancelled':'network_error',errorMessage:error?.message||'N/A'});return null;}}
function postBodyForSize(targetBytes){const shellBytes=byteLength('{"padding":""}');return JSON.stringify({padding:'a'.repeat(Math.max(0,Math.floor(targetBytes)-shellBytes))});}
function checkHealthGet(){return probe(healthEndpoint);}
function checkHealthPost(){return probe(healthEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ping:true})});}
function checkSameSizePost(){if(!Number.isFinite(state.requestBodyBytes)){reset({endpoint:healthEndpoint,errorCode:'no_recognition_size',errorMessage:'Run recognition first.'});return null;}return probe(healthEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:postBodyForSize(state.requestBodyBytes)});}
window.OrderScreenshotNetworkDiagnostic={reset,record,beginRecognition};
reset();
document.querySelector('#orderScreenshotHealthGet')?.addEventListener('click',checkHealthGet);
document.querySelector('#orderScreenshotHealthPost')?.addEventListener('click',checkHealthPost);
document.querySelector('#orderScreenshotHealthSameSize')?.addEventListener('click',checkSameSizePost);
})();
