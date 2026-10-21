import { NextResponse } from 'next/server';
import { SubmissionHistoryService } from '@coderank/core/services/SubmissionHistoryService';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { routeError } from '@/lib/route-response';
export async function GET(request,{params}){
 try{const {rows,next}=await SubmissionHistoryService.faculty(await authenticateRequest(request),(await params).id,new URL(request.url).searchParams);
  return NextResponse.json(rows,{headers:{'X-Next-Cursor':next,'Cache-Control':'no-store'}});
 }catch(error){return routeError(error);}
}
