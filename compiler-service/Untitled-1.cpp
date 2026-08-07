int studentname =prompt("Ente your name :", "Students");
console.log("prompt() returned:" studentname);
console.log("Type returnedby prompt():", typeof studentname);
if(studentname===null)
{
    alert("You cancelled the name entry.");
}else{
    studentname=studentname.trim();
    if(studentname==="")
    {
        alert("Name cannot be empty.");
    }else{
        alert(:Welcome, ${studentname}!);
    }
}