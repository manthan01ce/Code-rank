import { NextResponse } from 'next/server';
export function routeError(error){
 if(!error.status)console.error('API operation failed:',error);
 return NextResponse.json({error:error.status?error.message:'Internal server error'},{status:error.status||500});
}
export function pageResponse(rows,limit){
 return NextResponse.json(rows,{headers:{'X-Next-Cursor':rows.length===Number(limit)?String(rows.at(-1).id):'','Cache-Control':'no-store'}});
}

export async function jsonBody(request){
 let body;
 try{body=await request.json();}catch{throw {status:400,message:'Invalid JSON payload'};}
 if(!body || typeof body !== 'object' || Array.isArray(body)) throw {status:400,message:'Expected a JSON object'};
 return body;
}
