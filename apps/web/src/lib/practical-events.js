import { io as socketClient } from 'socket.io-client';
import { createServiceToken } from '@coderank/core/security/service-token';
export function publishPractical(action, practical) {
 const deleted=action==='deleted',payload=deleted?practical.id:practical;
 try{
  if(global.io){global.io.to(`course_${practical.course_id}`).emit(`practical_${action}`,payload);return;}
  const socket=socketClient(process.env.REALTIME_URL||`http://127.0.0.1:${process.env.PORT||3000}`,{transports:['websocket'],auth:callback=>callback({serviceToken:createServiceToken()}),reconnection:false,timeout:1000});
  socket.emit(`faculty_practical_${action}`,deleted?{course_id:practical.course_id,practicalId:practical.id}:{course_id:practical.course_id,practical});
  const timer=setTimeout(()=>socket.disconnect(),1500);timer.unref?.();
 }catch(error){console.warn('Practical notification failed:',error.message);}
}
