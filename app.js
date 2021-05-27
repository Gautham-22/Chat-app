const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoConnection = require("connect-mongo");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
let multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

const dotenv = require("dotenv");
dotenv.config();

app.use(express.static("./public"));
app.use(express.urlencoded({extended : true}));
app.use(express.json());

// For using EJS
app.set("view engine","ejs");

// For image input - multer middleware
let storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now())
    }
});
 
let upload = multer({ storage: storage });


// DB Connection
mongoose.connect(process.env.LOCAL_CONNECTION_STRING,{
    useNewUrlParser : true,
    useUnifiedTopology : true,
    useCreateIndex : true,
    useFindAndModify : false
})
.then(() => {
    console.log("Database connection made to : ",process.env.LOCAL_CONNECTION_STRING);
})
.catch(err => {
    console.log(err);
    process.exit(1);
});

// For users collection
const userSchema = new mongoose.Schema({
    username : {
        type : String,
        unique : true
    },
    password : {
        type : String,
        unique : true
    },
    profile : {
        data : Buffer,
        contentType : String
    }
});
const User = mongoose.model("user",userSchema);

// For chats collection
const chatSchema = new mongoose.Schema({
    from : String,
    to : String,
    messages : Array
});
const Chat = mongoose.model("chat",chatSchema);


// Session
app.use(session({
    secret : process.env.SECRET,
    resave : false,
    saveUninitialized : true,
    store : MongoConnection.create({
        mongoUrl : process.env.LOCAL_CONNECTION_STRING
    }),
    cookie : {
        maxAge : 1000 * 60 * 60 * 24 * 7
    }
}));

// Passport
passport.use(new LocalStrategy(
    function(username,password,done) {
        User.findOne({username : username},(err,user) => {
            if(err) {
                return done(err);
            }
            if(!user) {
                return done(null,false);
            }
            if(validatePassword(password,user.password)) {
                return done(null,user);
            }else {
                return done(null,false);
            }
        })
    }
));
passport.serializeUser(function(user,done) {
    console.log("User authenticated!");
    return done(null,user.id);
});
passport.deserializeUser(function(userid,done) {
    User.findById(userid,(err,user) => {
        if(err) {
            return done(err);
        }
        return done(null,user);
    })
});

app.use(passport.initialize());
app.use(passport.session());

//Routes
app.get("/login",(req,res) => {
    let failureMsg = req.session.failureMsg;
    if(!failureMsg){
        return res.render("login",{invalid : false, message : ""});
    }
    req.session.failureMsg = "";
    return res.render("login",{invalid : true, message : failureMsg});
});

app.get("/login-failure",(req,res) => {
    req.session.failureMsg = "Invalid Credentials!";
    res.redirect("/login");
})

app.get("/logout",(req,res) => {
    req.logout();
    res.redirect("/login");
});

app.get("/personalChat",(req,res) => {
    let chattedUsernames = [], chattedUserprofiles = [], user;
    if(req.isAuthenticated()) {
        Chat.find({$or : [{from : req.user.username},{to : req.user.username}]},function(err,chats) {
            if(err) {
                console.log(err);
                process.exit(1);
            }
            if(chats.length > 0) {
                for(let i=0;i<chats.length;i++){
                    user = chats[i].from == req.user.username ? chats[i].to : chats[i].from;
                    User.findOne({username : user},function(err,chattedUser) {
                        if(!chattedUsernames.includes(chattedUser.username)) {
                            chattedUsernames.push(chattedUser.username);
                            chattedUserprofiles.push(chattedUser.profile);
                        }
                        if(i == chats.length - 1) {

                            res.render("app",{
                                image : req.user.profile,
                                username : req.user.username,
                                chattedUsernames : chattedUsernames,
                                chattedUserprofiles : chattedUserprofiles
                            });
                        }   
                    })
                }
            }else {
                res.render("app",{
                    image : req.user.profile,
                    username : req.user.username,
                    chattedUsernames : chattedUsernames,  // empty array 
                    chattedUserprofiles : chattedUserprofiles // empty array 
                });
            }
        })

    }else {
        req.session.failureMsg = "Login into your account."
        res.redirect("/login");
    }
});

app.post("/register",upload.single("image"),(req,res) => {
    let {username,password} = req.body;
    let newUser = new User({
        username : username,
        password : genPassword(password),
        profile : {
            data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)),
            contentType: 'image/png'
        }
    });
    newUser.save(function() {
        console.log("Successfully added a new user.");
    });
    res.redirect("/login");
});

app.post("/login",passport.authenticate("local",{failureRedirect : "/login-failure",successRedirect : "/personalChat"}));

const server = app.listen(3000,() => {
    console.log("Server started listening on port 3000");
});

// Socket.io 
const io = require("socket.io")(server);


io.on("connection",(socket) => {
    console.log("Made socket connection");
    
    socket.on("search",function(searchedUser) {
        let resultUsernames = [], resultUserprofiles = [];
        User.find({username:searchedUser},function(err,users) {
            if(err) {
                console.log(err);
                return process.exit(1);
            }
            for(let i=0;i<users.length;i++) {
                resultUsernames.push(users[i].username);
                resultUserprofiles.push(users[i].profile);
            }
            io.to(socket.id).emit("search-result",{resultUsernames,resultUserprofiles});
        })
    });

    socket.on("get chat",function({currentUser,targetUser}) {
        let toUser, toUsername;
        let messages;
        User.findOne({username:targetUser},function(err,user) {
            toUser = user; 
            toUsername = user.username;
            Chat.findOne({from : currentUser,to : targetUser},function(err,chat1) {
                Chat.findOne({from : targetUser,to : currentUser},function(err,chat2) {
                    if(!chat1 && !chat2) {
                        messages = [];
                    }else if(chat1 && !chat2) {
                        messages = chat1.messages;
                    }else if(!chat1 && chat2) {
                        messages = chat2.messages;
                    }else {
                        messages = chat1.messages;
                        messages = messages.concat(chat2.messages);
                        messages.sort(function(a,b) {  // sorting messages with respect to time
                            let d1 = new Date(a.time);
                            let d2 = new Date(b.time);
                            return d1.getTime() - d2.getTime();
                        });
                    }
                    return io.to(socket.id).emit("found chat",{toUsername,messages});
                });
            });
        });
    });

    socket.on("new message",function({currentUser,targetUser,newMessage}) {
        let newMsg, messages;
        Chat.findOne({from : currentUser,to : targetUser},function(err,chat) {
            if(err) {
                console.log(err);
                return process.exit(1);
            }
            newMsg = {
                owner : currentUser,
                content : newMessage,
                time : new Date().toLocaleString("en-us")
            };
            if(!chat) {
                messages = [];
                messages.push(newMsg);
                let newChat = new Chat({
                    from : currentUser,
                    to : targetUser,
                    messages : messages
                });
                return newChat.save(function() {  // since save is async, we are emitting only after saving newMsg in db
                    console.log("Started a new chat.");
                    return io.emit("new message",{from : currentUser,to : targetUser,msg : newMsg});
                });
            }else {
                messages = chat.messages;
                messages.push(newMsg);
                Chat.findOneAndUpdate({from : currentUser,to : targetUser},{messages : messages},{useFindAndModify : false},function(err,initialChat){
                    if(err) {
                        console.log(err);
                        return process.exit(1);
                    }
                });
            }
            io.emit("new message",{from : currentUser,to : targetUser,msg : newMsg});
        });
    });
})



// For hashing
function genPassword(password) {
    let salt = bcrypt.genSaltSync(10);
    let hash = bcrypt.hashSync(password,salt);
    return hash;
}

function validatePassword(password,hash) {
    let validation = bcrypt.compareSync(password,hash);
    return validation;
}
