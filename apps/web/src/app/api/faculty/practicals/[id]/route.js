import { NextResponse } from 'next/server';
import { PracticalManagementService as service } from '@coderank/core/services/PracticalManagementService';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { publishPractical } from '@/lib/practical-events';
import { routeError, jsonBody } from '@/lib/route-response';
export async function GET(request,{params}){
 try{return NextResponse.json(await service.detail(await authenticateRequest(request),(await params).id));}catch(error){return routeError(error);}
}
export async function PUT(request,{params}){
 try{const user=await authenticateRequest(request);service.faculty(user);
  const practical=await service.mutate(user,(await params).id,'update',await jsonBody(request));
  publishPractical('updated',practical);return NextResponse.json({success:true,practical});
 }catch(error){return routeError(error);}
}
export async function DELETE(request,{params}){
 try{const practical=await service.mutate(await authenticateRequest(request),(await params).id,'delete');
  publishPractical('deleted',practical);return NextResponse.json({success:true,message:'Practical archived. Existing grading history is preserved.'});
 }catch(error){return routeError(error);}
}
