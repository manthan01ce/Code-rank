import { SubmissionHistoryService, pageOptions } from '@coderank/core/services/SubmissionHistoryService';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { routeError, pageResponse } from '@/lib/route-response';
export async function GET(request){
 try{const options=pageOptions(new URL(request.url).searchParams);
  return pageResponse(await SubmissionHistoryService.student(await authenticateRequest(request),null,options),options.limit);
 }catch(error){return routeError(error);}
}
