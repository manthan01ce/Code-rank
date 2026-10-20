import sql from '../../db/client.js';
import { positiveId } from '../practicals/PracticalManagementService.js';
const fail=message=>{throw {status:400,message};};
export function pageOptions(params){
 const limit=positiveId(params.get('limit')||100);if(limit>200)fail('Maximum page size is 200');
 return {limit,cursor:params.get('cursor')||null};
}
function decodeCursor(cursor,sort,direction){
 if(!cursor)return null;
 if(cursor.length>4096)fail('Invalid submission cursor');
 try{const c=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));if((sort==='marks'&&!Number.isFinite(Number(c.value)))||(sort==='submission_time'&&!Number.isFinite(Date.parse(c.value))))throw Error();if(c.sort!==sort||c.direction!==direction||!Number.isSafeInteger(c.id)||c.id<=0||!Number.isFinite(Date.parse(c.time))||!['string','number'].includes(typeof c.value))throw Error();return c;}catch{fail('Invalid submission cursor');}
}
export class SubmissionHistoryService {
 static async student(user,practicalId,options){
  if(!user||user.role!=='student')throw {status:401,message:'Unauthorized'};
  const {limit,cursor}=options;
  return sql.query(`SELECT s.id,s.language,s.status,s.raw_marks,s.normalized_marks,s.submitted_at,convert_from(s.code,'UTF8') code,p.title practical_title
   FROM practical_submissions s JOIN practicals p ON p.id=s.practical_id
   WHERE s.student_id=$1 AND ($2::int IS NULL OR p.id=$2) AND ($3::int IS NULL OR s.id<$3)
   ORDER BY s.id DESC LIMIT $4`,[user.id,practicalId?positiveId(practicalId):null,cursor?positiveId(cursor):null,limit]);
 }
 static async faculty(user,id,params){
  if(!user||user.role!=='faculty')throw {status:401,message:'Unauthorized'};
  id=positiveId(id);const {limit,cursor}=pageOptions(params);
  const owned=await sql.query('SELECT 1 FROM practicals p JOIN course_faculty f ON f.course_id=p.course_id WHERE p.id=$1 AND f.faculty_id=$2',[id,user.id]);
  if(!owned.length)throw {status:404,message:'Practical not found'};
  const sort=params.get('sortBy')||'submission_time',direction=(params.get('sortOrder')||'DESC').toUpperCase();
  const columns={marks:'s.normalized_marks',student_name:'u.name',submission_time:'s.submitted_at'};
  if(!Object.hasOwn(columns,sort)||!['ASC','DESC'].includes(direction))fail('Invalid submission sorting');
  const column=columns[sort],c=decodeCursor(cursor,sort,direction),values=[id,user.id],where=['s.practical_id=$1','EXISTS(SELECT 1 FROM course_faculty f WHERE f.course_id=p.course_id AND f.faculty_id=$2)'];
  const add=value=>{values.push(value);return `$${values.length}`;};
  const search=params.get('studentSearch');if(search){const key=add('%'+search.slice(0,200)+'%');where.push(`(u.name ILIKE ${key} OR u.email ILIKE ${key} OR u.extra_info->>'roll_number' ILIKE ${key} OR u.extra_info->>'division' ILIKE ${key})`);}
  const division=params.get('division');if(division&&division!=='all')where.push(`u.extra_info->>'division'=${add(division)}`);
  const status=params.get('status');if(status&&status!=='all'){if(['late','in-time'].includes(status))where.push(`s.is_late=${add(status==='late')}`);else where.push(`s.status=${add(status)}`);}
  for(const [key,operator] of [['fromDate','>='],['toDate','<']])if(params.get(key)){
   const value=params.get(key);if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||(!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))fail('Invalid date filter');
   where.push(`s.submitted_at ${operator} ${add(key==='toDate'?new Date(Date.parse(value)+86400000).toISOString():value)}`);
  }
  if(c){const v=add(c.value),op=direction==='ASC'?'>':'<';
   if(sort==='submission_time'){const i=add(c.id);where.push(`(s.submitted_at ${op} ${v} OR (s.submitted_at=${v} AND s.id<${i}))`);}
   else {const t=add(c.time),i=add(c.id);where.push(`(${column} ${op} ${v} OR (${column}=${v} AND (s.submitted_at<${t} OR (s.submitted_at=${t} AND s.id<${i}))))`);}
  }
  const rows=await sql.query(`SELECT s.id,s.student_id,s.practical_id,s.language,s.status,s.raw_marks,s.normalized_marks,s.execution_time_ms,s.is_late,s.submitted_at::text submitted_at,
    convert_from(s.code,'UTF8') code,u.name student_name,u.email student_email,u.extra_info->>'roll_number' roll_number,u.extra_info->>'batch' batch,u.extra_info->>'division' division,u.extra_info->>'department' department
    FROM practical_submissions s JOIN users u ON u.id=s.student_id JOIN practicals p ON p.id=s.practical_id
    WHERE ${where.join(' AND ')} ORDER BY ${column} ${direction},${sort==='submission_time'?'':'s.submitted_at DESC,'}s.id DESC LIMIT ${add(limit)}`,values);
  const last=rows.at(-1),next=rows.length===limit?Buffer.from(JSON.stringify({sort,direction,id:last.id,time:last.submitted_at,value:sort==='marks'?last.normalized_marks:sort==='student_name'?last.student_name:last.submitted_at})).toString('base64url'):'';
  return {rows,next};
 }
}
