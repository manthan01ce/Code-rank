import { NextResponse } from 'next/server';
import { PracticalManagementService as service } from '@coderank/core/services/PracticalManagementService';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { publishPractical } from '@/lib/practical-events';
import { routeError, pageResponse, jsonBody } from '@/lib/route-response';
export async function GET(request){
 try{const params=new URL(request.url).searchParams,limit=params.get('limit')||100;
  return pageResponse(await service.list(await authenticateRequest(request),params.get('course_id'),{cursor:params.get('cursor'),limit}),limit);
 }catch(error){return routeError(error);}
}
export async function POST(request){
 try{const user=await authenticateRequest(request);service.faculty(user);
  const practical=await service.mutate(user,null,'create',await jsonBody(request));
  publishPractical('added',practical);return NextResponse.json({success:true,practical});
 }catch(error){return routeError(error);}
}
