import { NextResponse } from 'next/server';
import { PracticalManagementService as service } from '@coderank/core/services/PracticalManagementService';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { publishPractical } from '@/lib/practical-events';
import { routeError, jsonBody } from '@/lib/route-response';
export async function POST(request,{params}){
 try{const user=await authenticateRequest(request);service.faculty(user);
  const practical=await service.mutate(user,(await params).id,'extend',await jsonBody(request));
  publishPractical('updated',practical);return NextResponse.json({success:true,message:`Extra time granted successfully. New deadline: ${new Date(practical.end_time).toLocaleString()}`,practical});
 }catch(error){return routeError(error);}
}
