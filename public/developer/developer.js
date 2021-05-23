const name = document.querySelector("#name");
const str = name.textContent;
const arr = str.split("");
name.innerHTML = "";
for(let i=0;i<arr.length;i++){
    name.innerHTML += "<span>" + arr[i] + "</span>";
}

function animateName(n){
    let char ;
    if(n%2 == 1){
        char = 0;
    }else {
        char = arr.length - 1;
    }
    let timer = setInterval(function(){
        const span = document.querySelectorAll("#name span")[char];
        if(n%2 == 1){
            span.classList.add("animation");
            char +=1;
            if( char == arr.length){
                complete();
                return;
            }
        }else {
            span.classList.remove("animation");
            char -=1;
            if( char == -1){
                complete();
                return;
            }
        }
    }, 50);

    function complete(){
        clearInterval(timer);
        timer = null;
    }
}

let count = 1;
let interval = setInterval(() => {
    animateName(count);
    count +=1;
}, 2000);