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
            document.querySelector(".result").innerHTML = `<div class="result-placeholder">
                <span>Search results will appear here</span>
            </div>`;
        }
    });

    socket.on("search-result",function({resultUsernames,resultUserprofiles}) {
        let users = "";
        if(resultUsernames.length) {
            for(let i=0;i<resultUsernames.length;i++) {
                users += `<div class="user">
                    <img src="data:image/${resultUserprofiles[i].contentType};base64,
                    ${base64ArrayBuffer(resultUserprofiles[i].data)}" class="profile">
                    <span id="chat-username">${resultUsernames[i]}</span>
                </div>`;
            };
        }else {
            users = `<div class="result-placeholder">
                <span>No such user found !</span>
            </div>`;
        }
        document.querySelector(".result").innerHTML = users;
    });

    socket.on("found chat",function({toUsername,toUserprofile,messages}) {
        let chatUser = `<img src="data:image/${toUserprofile.contentType};base64,
        ${base64ArrayBuffer(toUserprofile.data)}" class="profile">
        <span id="chatting-username">${toUsername}</span>`;
        let count = 0;
        document.querySelector(".chatting-user").innerHTML = chatUser;

        // adding user to chatted users section
        if(document.querySelector(".chatted-users").hasChildNodes()) {
            let chattedUsers = document.querySelector(".chatted-users").childNodes;
            for (let i = 0; i < chattedUsers.length; i++) {
                if(chattedUsers[i].textContent.trim() == toUsername) {  // checking whether toUser is already in chatted users list
                    count += 1;
                }
              }
        }
        if(count == 0) {  // if toUser is a new chatted user
            document.querySelector(".chatted-users").innerHTML += `<div class="user">
                <img src="data:image/${toUserprofile.contentType};base64,
                ${base64ArrayBuffer(toUserprofile.data)}" class="profile">
                <span id="chat-username">${toUsername}</span>
            </div>`;  
        }  

        let chat = "";
        if(messages.length > 0) {
            messages.map(function(msg) {
                if(msg.owner == currentUser) {
                    chat += `<div class="sent-message">`;
                }else {
                    chat += `<div class="received-message">`;
                }
                chat +=`<div class="msg">
                        ${msg.content}
                    </div>
                    <div class="time">
                        ${new Date(msg.time).toLocaleString("en-us",{hour : "numeric",minute : "numeric",hour12 : true})}
                    </div>
                </div>`;
            });
        } 
        document.querySelector(".messages").innerHTML = chat;
        var messageScrollbar = document.querySelector(".messages");
        messageScrollbar.scrollTop = messageScrollbar.scrollHeight;
    }); 

    
    socket.on("new message",function(data) {  //new message sent  or     new message received  
        if((data.from == currentUser && data.to == targetUser) || (data.from == targetUser && data.to == currentUser)) {  
            return socket.emit("get chat",{currentUser,targetUser})
        }
    });

}else {
    console.log("Socket connection with server failed.");
}

// ArrayBuffer to base64 string

function base64ArrayBuffer(arrayBuffer) {
    var base64    = '';
    var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var bytes         = new Uint8Array(arrayBuffer);
    var byteLength    = bytes.byteLength;
    var byteRemainder = byteLength % 3;
    var mainLength    = byteLength - byteRemainder;
    var a, b, c, d;
    var chunk;
    // Main loop deals with bytes in chunks of 3
    for (var i = 0; i < mainLength; i = i + 3) {
      // Combine the three bytes into a single integer
      chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      // Use bitmasks to extract 6-bit segments from the triplet
      a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
      b = (chunk & 258048)   >> 12 ;// 258048   = (2^6 - 1) << 12
      c = (chunk & 4032)     >>  6 ;// 4032     = (2^6 - 1) << 6
      d = chunk & 63  ;             // 63       = 2^6 - 1
      // Convert the raw binary segments to the appropriate ASCII encoding
      base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
    }
    // Deal with the remaining bytes and padding
    if (byteRemainder == 1) {
      chunk = bytes[mainLength];
      a = (chunk & 252) >> 2 ;// 252 = (2^6 - 1) << 2
      // Set the 4 least significant bits to zero
      b = (chunk & 3)   << 4 ;// 3   = 2^2 - 1
      base64 += encodings[a] + encodings[b] + '==';
    } else if (byteRemainder == 2) {
      chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];
  
      a = (chunk & 64512) >> 10 ;// 64512 = (2^6 - 1) << 10
      b = (chunk & 1008)  >>  4; // 1008  = (2^6 - 1) << 4
  
      // Set the 2 least significant bits to zero
      c = (chunk & 15)    <<  2 ;// 15    = 2^4 - 1
  
      base64 += encodings[a] + encodings[b] + encodings[c] + '=';
    }
    return base64;
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