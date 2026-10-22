import { Executor } from './Executor.js';
import { buildFunctionSource,functionCases,sameFunctionValue } from './function-harness.js';
export async function runFunctionProblem(language,payload){
 const testCases=payload.testCases||[];
 if(!testCases.length)throw Error('Test cases required');
 const functions=testCases.some(tc=>typeof tc.input!=='string');
 const code=functions?buildFunctionSource(language,payload.code,payload.problem,testCases):payload.code;
 const executor=new Executor(language,code);
 try{
  const compile=await executor.compile();if(!compile.success)return {status:'compile_error',summary:'Compile Error',compileError:compile.error,cases:[]};
  const results=await executor.runBatch(functions?functionCases(language,testCases):testCases);
  if(functions)for(const [index,result] of results.entries()){
   result.passed=result.exitCode===0&&sameFunctionValue(result.actualOutput,testCases[index].expected,payload.problem?.entry?.methodName);
   result.marksAwarded=result.passed?1:0;
  }
  const passed=results.every(r=>r.passed);
  return {status:passed?'accepted':'wrong_answer',summary:passed?'Accepted':'Wrong Answer',cases:results};
 }finally{await executor.cleanup();}
}
