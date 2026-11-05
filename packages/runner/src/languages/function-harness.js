const identifier=value=>{if(!/^[A-Za-z_$][\w$]*$/.test(value))throw Error('Invalid function entry');return value;};
const cString=value=>JSON.stringify(String(value));
const array=value=>`{${value.map(Number).join(',')}}`;
export function buildFunctionSource(language,code,problem,testCases){
 const method=identifier(problem?.entry?.methodName||'solution');
 if(language==='javascript')return `const __crFs = require('node:fs');\n(async()=>{\nconst __crArgs = JSON.parse(__crFs.readFileSync(0,'utf8'));\n${code}\nconst __crTarget = ${problem?.entry?.type==='class-method'?`new ${identifier(problem.entry.className||'Solution')}()`:'null'};\nconst __crValue = await ${problem?.entry?.type==='class-method'?`__crTarget.${method}`:method}(...__crArgs);\nprocess.stdout.write(JSON.stringify(__crValue === undefined ? __crArgs[0] : __crValue));\n})().catch(e=>{console.error(e.stack);process.exitCode=1;});`;
 if(language!=='c')throw Error('Unsupported function harness');
 const supported=['twoSum','reverseString','isPalindrome','fizzBuzz','singleNumber','containsDuplicate','fib','isAnagram','lengthOfLastWord','addDigits'];
 if(!supported.includes(method))throw Error('Unsupported C function signature');
 const branches=testCases.map((tc,i)=>{
  const a=tc.args;let run;
  if(method==='twoSum')run=`int values[]=${array(a[0])};int n=0;int *r=twoSum(values,${a[0].length},${Number(a[1])},&n);cr_ints(r,n);`;
  else if(method==='reverseString')run=`char text[]=${cString(a[0].join(''))};reverseString(text,${a[0].length});putchar('[');for(int j=0;j<${a[0].length};j++){if(j)putchar(',');char x[]={text[j],0};cr_string(x);}putchar(']');`;
  else if(method==='fizzBuzz')run=`int n=0;char **r=fizzBuzz(${Number(a[0])},&n);putchar('[');for(int j=0;j<n;j++){if(j)putchar(',');cr_string(r[j]);}putchar(']');`;
  else if(['singleNumber','containsDuplicate'].includes(method))run=`int values[]=${array(a[0])};${method==='containsDuplicate'?`printf("%s",${method}(values,${a[0].length})?"true":"false");`:`printf("%d",${method}(values,${a[0].length}));`}`;
  else if(method==='isAnagram')run=`char a[]=${cString(a[0])},b[]=${cString(a[1])};printf("%s",isAnagram(a,b)?"true":"false");`;
  else if(method==='lengthOfLastWord')run=`char text[]=${cString(a[0])};printf("%d",lengthOfLastWord(text));`;
  else run=method==='isPalindrome'?`printf("%s",isPalindrome(${Number(a[0])})?"true":"false");`:`printf("%d",${method}(${Number(a[0])}));`;
  return `case ${i}: {${run}break;}`;
 }).join('\n');
 return `#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdbool.h>\n#include <ctype.h>\n${code}\nstatic void cr_string(const char *s){putchar('"');for(;*s;s++){unsigned char c=*s;if(c=='"'||c=='\\\\'){putchar('\\\\');putchar(c);}else if(c<32)printf("\\\\u%04x",c);else putchar(c);}putchar('"');}\nstatic void cr_ints(const int *v,int n){putchar('[');for(int j=0;j<n;j++){if(j)putchar(',');printf("%d",v[j]);}putchar(']');}\nint main(void){int index;if(scanf("%d",&index)!=1)return 2;switch(index){${branches}\ndefault:return 2;}return 0;}\n`;
}
export function functionCases(language,testCases){
 return testCases.map((tc,index)=>({id:index,input:language==='c'?String(index):JSON.stringify(tc.args||[]),expected:JSON.stringify(tc.expected),marks:1}));
}
export function sameFunctionValue(actual,expected,method){
 try{const value=JSON.parse(actual);if(method==='twoSum'&&Array.isArray(value)&&Array.isArray(expected))return JSON.stringify([...value].sort((a,b)=>a-b))===JSON.stringify([...expected].sort((a,b)=>a-b));return JSON.stringify(value)===JSON.stringify(expected);}catch{return false;}
}
