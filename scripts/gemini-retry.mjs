export async function fetchWithRetry(request,pause){
 for(let attempt=0;attempt<3;attempt++){
  let response;
  try{response=await request();}catch(error){if(attempt===2)throw error;}
  if(response&&(![500,502,503,504].includes(response.status)||attempt===2))return response;
  await response?.body?.cancel();
  await pause(15000*(attempt+1));
 }
}
