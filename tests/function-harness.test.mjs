import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { buildFunctionSource,functionCases,sameFunctionValue } from '../packages/runner/src/function-harness.js';
import { STATIC_PROBLEMS } from '../apps/web/src/lib/problems.js';
const hasGcc = (() => {
 try { execSync('gcc --version', { stdio: 'ignore' }); return true; } catch { return false; }
})();
const languages = ['javascript', ...(hasGcc ? ['c'] : [])];
const c={
 twoSum:'int* twoSum(int*a,int n,int target,int*size){static int r[2];for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)if(a[i]+a[j]==target){r[0]=j;r[1]=i;*size=2;return r;}*size=0;return r;}',
 reverseString:'void reverseString(char*s,int n){for(int i=0;i<n/2;i++){char c=s[i];s[i]=s[n-1-i];s[n-1-i]=c;}}',
 isPalindrome:'bool isPalindrome(int x){if(x<0)return false;long r=0,n=x;while(n){r=r*10+n%10;n/=10;}return r==x;}',
 fizzBuzz:'char** fizzBuzz(int n,int*size){char**r=malloc(n*sizeof(char*));*size=n;for(int i=1;i<=n;i++){r[i-1]=malloc(32);if(i%15==0)strcpy(r[i-1],"FizzBuzz");else if(i%3==0)strcpy(r[i-1],"Fizz");else if(i%5==0)strcpy(r[i-1],"Buzz");else sprintf(r[i-1],"%d",i);}return r;}',
 singleNumber:'int singleNumber(int*a,int n){int r=0;for(int i=0;i<n;i++)r^=a[i];return r;}',
 containsDuplicate:'bool containsDuplicate(int*a,int n){for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)if(a[i]==a[j])return true;return false;}',
 fib:'int fib(int n){int a=0,b=1;for(int i=0;i<n;i++){int c=a+b;a=b;b=c;}return a;}',
 isAnagram:'bool isAnagram(char*a,char*b){int counts[256]={0};for(;*a;a++)counts[(unsigned char)*a]++;for(;*b;b++)counts[(unsigned char)*b]--;for(int i=0;i<256;i++)if(counts[i])return false;return true;}',
 lengthOfLastWord:'int lengthOfLastWord(char*s){int i=strlen(s)-1,n=0;while(i>=0&&s[i]==32)i--;while(i>=0&&s[i]!=32){n++;i--;}return n;}',
 addDigits:'int addDigits(int n){return n==0?0:1+(n-1)%9;}'
};
const js={
 twoSum:'twoSum(a,t){for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i]+a[j]===t)return [j,i];}',
 reverseString:'reverseString(a){a.reverse();}',isPalindrome:'isPalindrome(x){return x>=0&&String(x)===String(x).split("").reverse().join("");}',
 fizzBuzz:'fizzBuzz(n){return Array.from({length:n},(_,i)=>(++i%3?"":"Fizz")+(i%5?"":"Buzz")||String(i));}',
 singleNumber:'singleNumber(a){return a.reduce((r,n)=>r^n,0);}',containsDuplicate:'containsDuplicate(a){return new Set(a).size!==a.length;}',
 fib:'fib(n){let a=0,b=1;while(n--)[a,b]=[b,a+b];return a;}',isAnagram:'isAnagram(a,b){return [...a].sort().join("")===[...b].sort().join("");}',
 lengthOfLastWord:'lengthOfLastWord(s){return s.trim().split(/ +/).at(-1).length;}',addDigits:'addDigits(n){return n===0?0:1+(n-1)%9;}'
};
for(const problem of Object.values(STATIC_PROBLEMS))for(const language of languages)test(`${language} real harness: ${problem.slug}`,()=>{
 const method=problem.entry.methodName,dir=mkdtempSync(fileURLToPath(new URL('../.harness-',import.meta.url)));
 try{
  const source=buildFunctionSource(language,language==='c'?c[method]:`class Solution {${js[method]}}`,problem,problem.testCases);
  const file=path.join(dir,language==='c'?'source.c':'source.cjs');writeFileSync(file,source);
  if(language==='c')execFileSync('gcc',['-std=c11','-Wall','-Werror=implicit-function-declaration',file,'-o',path.join(dir,'solution')],{timeout:10000,stdio:'pipe'});
  for(const [i,tc] of functionCases(language,problem.testCases).entries()){
   const output=execFileSync(language==='c'?path.join(dir,'solution'):process.execPath,language==='c'?[]:[file],{input:tc.input,timeout:3000,encoding:'utf8'});
   assert.ok(sameFunctionValue(output,problem.testCases[i].expected,method),`${output} !== ${tc.expected}`);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('function comparison rejects invalid output and incorrect values',()=>{
 assert.equal(sameFunctionValue('not-json',1,'fib'),false);assert.equal(sameFunctionValue('[1,2]',[0,1],'twoSum'),false);
});
