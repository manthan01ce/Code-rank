import { NextResponse } from 'next/server';
import { MappingService } from '@coderank/core/services/MappingService';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { routeError, jsonBody } from '@/lib/route-response';
export async function GET(request){
 try{return NextResponse.json(await MappingService.list(await authenticateRequest(request)));}catch(error){return routeError(error);}
}
export async function POST(request){
 try{const user=await authenticateRequest(request);MappingService.admin(user);return NextResponse.json(await MappingService.replace(user,await jsonBody(request)));}catch(error){return routeError(error);}
}
