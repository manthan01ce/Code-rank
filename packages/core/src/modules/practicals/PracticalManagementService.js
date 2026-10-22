import sql from '../../db/client.js';
const fail=(status,message)=>{throw {status,message};};
export function positiveId(value) {
 const id=Number(value);if(!Number.isSafeInteger(id)||id<=0)fail(400,'Invalid identifier');return id;
}
export function validatePractical(body,action) {
 if(!body || typeof body!=='object' || Array.isArray(body))fail(400,'Invalid practical payload');
 const out={...body};
 if(action==='extend') {
  if(body.newEndTime) {if(!Number.isFinite(Date.parse(body.newEndTime)))fail(400,'Invalid deadline');}
  else if(!Number.isSafeInteger(Number(body.extraMinutes))||Number(body.extraMinutes)<1||Number(body.extraMinutes)>10080)fail(400,'Extra minutes must be between 1 and 10080');
  return out;
 }
 if(action==='delete')return {};
 for(const key of ['title','description'])if(typeof body[key]!=='string'||!body[key].trim()||body[key].length>(key==='title'?300:50000))fail(400,`Invalid ${key}`);
 for(const key of ['start_time','end_time'])if(body[key]&&!Number.isFinite(Date.parse(body[key])))fail(400,`Invalid ${key}`);
 if(body.start_time&&body.end_time&&Date.parse(body.start_time)>=Date.parse(body.end_time))fail(400,'End time must follow start time');
 if(action==='create')out.course_id=positiveId(body.course_id);
 if(body.test_cases!==undefined&&!Array.isArray(body.test_cases))fail(400,'Invalid test cases');
 const cases=body.test_cases||[];
 if(cases.length>20||(action==='create'&&!cases.length))fail(400,'Provide between 1 and 20 test cases');
 out.test_cases=cases.map((tc,i)=>{
  if(!tc||typeof tc.input!=='string'||typeof tc.expected!=='string'||Buffer.byteLength(tc.input)>131072||Buffer.byteLength(tc.expected)>131072)fail(400,'Invalid test case input or output');
  const marks=Number(tc.marks);if(tc.marks===null||tc.marks===''||!Number.isFinite(marks)||marks<0||marks>100000)fail(400,'Invalid marks');
  const result={...tc,marks,is_hidden:!!tc.is_hidden,label:tc.label||`Test Case ${i+1}`};
  for(const key of ['time_limit','memory_limit']){const v=tc[key];result[key]=(v===null||v===undefined||v==='')?null:Number(v);if(result[key]!==null&&(!Number.isFinite(result[key])||result[key]<=0||result[key]>(key==='time_limit'?30:512)))fail(400,`Invalid ${key}`);}
  return result;
 });
 return out;
}
export function databaseError(error) {
 if(error.code==='42501')fail(403,'Course authorization required');
 if(error.code==='P0002')fail(404,'Resource not found');
 if(['22023','23514'].includes(error.code))fail(409,error.message);
 throw error;
}
export class PracticalManagementService {
 static faculty(user){if(!user||user.role!=='faculty')fail(401,'Unauthorized');}
 static async mutate(user,id,action,body={}) {
  this.faculty(user);const payload=validatePractical(body,action);
  try {const [row]=await sql.query('SELECT coderank_mutate_practical($1,$2,$3,$4::jsonb) AS practical',[user.id,id===null?null:positiveId(id),action,JSON.stringify(payload)]);return row.practical;}catch(error){databaseError(error);}
 }
 static async list(user,courseId,{cursor=null,limit=100}={}) {
  this.faculty(user);limit=positiveId(limit);if(limit>200)fail(400,'Maximum page size is 200');
  return sql.query(`SELECT p.*,c.name course_name,c.course_code,
    (SELECT count(*)::int FROM practical_test_cases t WHERE t.practical_id=p.id) test_cases_count,
    (SELECT count(*)::int FROM practical_submissions s WHERE s.practical_id=p.id) submissions_count
    FROM practicals p JOIN courses c ON c.id=p.course_id
    WHERE EXISTS(SELECT 1 FROM course_faculty f WHERE f.course_id=p.course_id AND f.faculty_id=$1)
    AND ($2::int IS NULL OR p.course_id=$2) AND ($3::int IS NULL OR p.id<$3)
    ORDER BY p.id DESC LIMIT $4`,[user.id,courseId?positiveId(courseId):null,cursor?positiveId(cursor):null,limit]);
 }
 static async detail(user,id){
  this.faculty(user);id=positiveId(id);
  const [practical]=await sql.query(`SELECT p.*,(SELECT count(*)::int FROM practical_submissions s WHERE s.practical_id=p.id) submissions_count FROM practicals p
   WHERE p.id=$1 AND EXISTS(SELECT 1 FROM course_faculty f WHERE f.course_id=p.course_id AND f.faculty_id=$2)`,[id,user.id]);
  if(!practical)fail(404,'Practical not found');
  const test_cases=await sql.query('SELECT * FROM practical_test_cases WHERE practical_id=$1 ORDER BY order_index,id',[id]);
  return {...practical,test_cases};
 }
}
