const socket = io("http://localhost:3000");
if(socket != undefined) {
    let currentUser, targetUser;
    console.log("Socket connection made with server.");
    document.querySelector(".search-btn").addEventListener("click",function() {
        let searchedUser = document.querySelector(".search-user").value;
        document.querySelector(".search-user").value = "";
        if(!searchedUser) {
            return ;
        }

        // result of search
        socket.emit("search",searchedUser); 
        
    });

    // enables to see personal chat history
  
    document.querySelector(".content").addEventListener("click",function(event) {
        if(event.target && (event.target.className=="user" || event.target.id=="chat-username")) {
            // initializing currentUser and targetUser for a socket
            currentUser = document.getElementById("current-user").textContent;
            targetUser = event.target.textContent;

            targetUser = targetUser.trim();
    
            socket.emit("get chat",{currentUser,targetUser});
            
            // enables to send personal message
            document.querySelector(".enter").addEventListener("click",function(event) {
                let newMessage = document.querySelector(".new-message").value;
                document.querySelector(".new-message").value = "";
                if(!newMessage) {
                    return;
                }
                socket.emit("new message",{currentUser,targetUser,newMessage});

            });
        }
    });

    socket.on("search-result",function(foundUsers) {
        let users = "";
        if(foundUsers.length) {
            foundUsers.map(function(foundUser) {
                users += `<button><div class="user">
                    <p id="chat-username">${foundUser.username}</p>
                </div></button>`;
            });
        }else {
            users = `<div class="alert alert-warning alert-dismissible fade show alert-custom" role="alert">
                No such user found!
                <button type="button" class="btn-close dismiss-icon" data-bs-dismiss="alert" data-mdb-toggle="animation"
                data-mdb-animation-reset="true" data-mdb-animation="fade-in-down" aria-label="Close"></button>
            </div>`;
        }
        document.querySelector(".result").innerHTML = users;
    });

    socket.on("found chat",function({toUser,messages}) {
        let chatUser = `<p id="chat-username">${toUser.username}</p>`;
        let count = 0;
        document.querySelector(".chatting-user").innerHTML = chatUser;

        // adding user to chatted users section
        if(document.querySelector(".chatted-users").hasChildNodes()) {
            let chattedUsers = document.querySelector(".chatted-users").childNodes;
            for (let i = 0; i < chattedUsers.length; i++) {
                if(chattedUsers[i].textContent == toUser.username) {  // checking whether toUser is already in chatted users list
                    count += 1;
                }
              }
        }
        if(count == 0) {  // if toUser is a new chatted user
            document.querySelector(".chatted-users").innerHTML += `<div class="user">${chatUser}</div>`;  
        }  

        let chat = "";
        if(messages.length > 0) {
            messages.map(function(msg) {
                if(msg.owner == currentUser) {
                    chat += `<div class="sent-message">`;
                }else {
                    chat += `<div class="received-message">`;
                }
                chat +=`${msg.content}
                    <div class="time">
                        ${new Date(msg.time).toLocaleString("en-us",{hour : "numeric",minute : "numeric",hour12 : true})}
                    </div>
                </div>`;
            });
        } 
        document.querySelector(".messages").innerHTML = chat;
    }); 

    
    socket.on("new message",function(data) {  //new message sent  or     new message received  
        if((data.from == currentUser && data.to == targetUser) || (data.from == targetUser && data.to == currentUser)) {  
            return socket.emit("get chat",{currentUser,targetUser})
        }
    });

}else {
    console.log("Socket connection with server failed.");
}

// socket.on("new message",function(data) {
//     let newMsg = "";
//     if(data.from == currentUser && data.to == targetUser) {  // new message sent 
//         newMsg = `<div class="sent-message">`;
//     }else if(data.from == targetUser && data.to == currentUser) {  // new message received
//         newMsg = `<div class="received-message">`;
//     }
//     if(newMsg) {
//         console.log("Inside if(newMsg)");
//         newMsg +=`${data.msg.content}
//             <div class="time">
//                 ${new Date(data.msg.time).toLocaleString("en-us",{hour : "numeric",minute : "numeric",hour12 : true})}
//             </div>
//         </div>`;
//         document.querySelector(".messages").innerHTML += newMsg;
//     }
// });