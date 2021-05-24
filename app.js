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
    useUnifiedTopology : true
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
    if(req.isAuthenticated()) {
        console.log(req.user);
        res.render("app",{image : req.user.profile,username : req.user.username});
    }else {
        req.session.failureMsg = "Login into your account."
        res.redirect("/login");
    }
});

app.post("/register",upload.single("image"),(req,res) => {
    console.log(req.file.filename);
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

function createSocketConnection() {
    io.on("connection",(socket) => {
        console.log("Made socket connection");
    })
}



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
