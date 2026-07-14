function randomName(){
 const words=["Happy","Blue","Silent","Fast","Lucky","Cosmic","Little"];
 const animals=["Fox","Tiger","Cat","Wolf","Bear","Panda"];
 return words[Math.floor(Math.random()*words.length)] +
        animals[Math.floor(Math.random()*animals.length)] +
        Math.floor(Math.random()*999);
}

let savedName=localStorage.getItem("watchPartyName");

const nameInput=document.getElementById("username");

if(savedName){
 nameInput.value=savedName;
}else{
 const generated=randomName();
 nameInput.value=generated;
 localStorage.setItem("watchPartyName",generated);
}

nameInput.addEventListener("change",()=>{
 let value=nameInput.value.trim();

 if(value===""){
  value=randomName();
 }

 localStorage.setItem("watchPartyName",value);
 nameInput.value=value;
});


function generateRoomCode(){
 return Math.floor(100000 + Math.random()*900000).toString();
}


document.getElementById("create").onclick=()=>{

let room=generateRoomCode();

let name=nameInput.value.trim();

if(!name){
 name=randomName();
}

localStorage.setItem("watchPartyName",name);

document.getElementById("result").innerHTML=
`
<div class="room">
<h2>Room Created</h2>
<p>Code:</p>
<strong>${room}</strong>
<p>Host: ${name}</p>
</div>
`;

console.log({
room,
host:name
});

};


document.getElementById("join").onclick=()=>{

document.getElementById("result").innerHTML=
"Enter a room code to join.";

};