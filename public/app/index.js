const socket = io("http://localhost:3000");

let username = "";

if(socket != undefined) {
    console.log("Socket connection made with server.");
}else {
    console.log("Socket connection with server failed.");
}


