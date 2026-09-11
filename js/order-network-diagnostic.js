(function(){'use strict';
const endpoint='https://handbook-orders-ai-staging.samanthayaosy.workers.dev/orders/recognize';
const state={origin:window.location.origin||'N/A',endpoint,stage:'not_started',httpStatus:'N/A',errorName:'N/A',errorCode:'N/A'};
const labels={origin:'Origin',endpoint:'Endpoint',stage:'Fetch stage',httpStatus:'HTTP status',errorName:'Error name',errorCode:'Error code'};
function render(){const root=document.querySelector('#orderScreenshotNetworkDiagnostic');if(!root)return;for(const [key,label] of Object.entries(labels)){const field=root.querySelector(`[data-network-diagnostic="${key}"]`);if(field)field.textContent=`${label}: ${state[key]}`;}}
function reset(){Object.assign(state,{origin:window.location.origin||'N/A',endpoint,stage:'not_started',httpStatus:'N/A',errorName:'N/A',errorCode:'N/A'});render();}
function record(update={}){Object.assign(state,update);render();}
async function checkHealth(){reset();record({stage:'before_fetch'});try{const response=await fetch(`${new URL(endpoint).origin}/orders/health`);record({stage:'response_received',httpStatus:response.status,errorCode:response.ok?'':'http_error'});}catch(error){record({stage:'fetch_rejected',errorName:error?.name||'Error',errorCode:error?.name==='AbortError'?'cancelled':'network_error'});}}
window.OrderScreenshotNetworkDiagnostic={reset,record};
reset();
document.querySelector('#orderScreenshotHealthCheck')?.addEventListener('click',checkHealth);
})();
