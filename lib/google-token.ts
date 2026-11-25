import {createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey} from 'jose';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export async function verifyGoogleToken(token:string,clientId:string,nonce:string,keys:JWTVerifyGetKey=googleKeys){
  const {payload}=await jwtVerify(token,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId,algorithms:['RS256'],clockTolerance:5,maxTokenAge:'10m',requiredClaims:['sub','email','email_verified','nonce','iat','exp']});
  if(payload.nonce!==nonce || payload.email_verified!==true || typeof payload.email!=='string' || typeof payload.sub!=='string' || !payload.sub || payload.sub.length>255 || (payload.azp!==undefined && payload.azp!==clientId))throw new Error('Invalid Google identity');
  return {subject:payload.sub,email:payload.email.toLowerCase(),name:typeof payload.name==='string'?payload.name.slice(0,80):'New trader'};
}
