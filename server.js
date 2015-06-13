// Modules à installer :
// npm install express
// npm install body-parser
// npm install ejs
// npm install path
// npm install socket.io

var express = require("express");
var bodyParser = require("body-parser");
var path = require("path");

var serv = express();

// Tableau des notes
var tab_notes = [];
// Tableau des utilisateurs enregistrés
var tab_users = [];
// Tableau des messages du mini-chat
var tab_messages = [];
// Tableau des utlisateurs et de leur socket qui sont sur le mini-chat
var tab_connexions = [];

var MAX_MESSAGES = 100;
var MAX_NOTES = 10;
var MAX_USERS = 10;
var MAX_TEMPS = 86400000;

serv.set("view engine", "ejs");
serv.use(bodyParser.json());
serv.use(bodyParser.urlencoded({extended: true}));


// ACCEUIL
serv.get("/", function(req, res){
	res.render("acceuil.ejs");
});


// README 
serv.get("/readme", function(req, res){
	res.render("readme.ejs");
});


// SEND NOTE
serv.get("/note/:val", function(req, res){
	var note = parseInt(""+req.params.val);

	if(tab_notes.length == MAX_NOTES)
		tab_notes.shift();
	tab_notes.push(note);
	console.log("Ajout de la note "+note+" au tableau ["+tab_notes+"]");

	res.sendStatus(0);
});


// MOYENNE
serv.get("/moyenne", function(req, res){
	var v = 0;

	for(var i = 0; i < tab_notes.length; i++)
		v += tab_notes[i];

	var moyenne = v / tab_notes.length
	res.send(JSON.stringify(moyenne));
})


// IDENTIFICATION
serv.get("/identification", function(req, res){
	res.render("identification.ejs", {err_login: 0, err_signin: 0});
});


// SIGN IN
serv.post("/signin", function(req, res){
	check_user_time();
	if(tab_users.length < MAX_USERS){
		for(var  i = 0; i < tab_users.length; i++){
			if(tab_users[i]["login"] == req.body.login){
				res.send(JSON.stringify(2));
				return;
			}
		}

		if(req.body.password != req.body.password_c){
			res.send(JSON.stringify(3));
			return;
		}

		var id = [];
		id["etat_civil"] = req.body.etat_civil;
		id["nom"] = req.body.nom;
		id["prenom"] = req.body.prenom;
		id["login"] = req.body.login;
		id["password"] = req.body.password;
		var date = new Date();
		date.setTime(date.getTime() + MAX_TEMPS);
		id["date"] = date;

		tab_users.push(id);

		res.send(JSON.stringify(0));

	}else{
		res.send(JSON.stringify(1));
	}	
});

// Verifie pour chaque utilisateur enregistré si sont temps est dépassé,
// si oui, il est supprimé du tableau
function check_user_time(){
	var date = new Date();
	for (var i = tab_users.length -1; i > 0; i--){
		if(tab_users[i]["date"] < date)
			tab_users.splice(i, 1);
	}
}

// Get pour signin -> redirige vers la page de connexion
serv.get("/signin", function(req, res){
	res.render("identification.ejs", {err_login: 0, err_signin: 0});
});


// LOG IN
serv.post("/login", function(req, res){
	for(var i = 0; i < tab_connexions.length; i++){
		if(tab_connexions[i]["login"] == req.body.login){
			res.send(JSON.stringify(2));
			return;
		}
	}

	for(var i = 0; i < tab_users.length; i++){
		if(tab_users[i]["login"] == req.body.login &&
			tab_users[i]["password"] == req.body.password){
			var date = new Date();
			date.setTime(date.getTime() + MAX_TEMPS);
			tab_users[i]["date"] = date;
			res.send(JSON.stringify(0));
			return
		}
	}

	res.send(JSON.stringify(1));
});


// MINICHAT
serv.post("/minichat", function(req, res){
	var login = req.body["llogin"];
	var user = null;
	for(var i = 0; i < tab_users.length; i++){
		if(tab_users[i]["login"] == login)
			user = tab_users[i];
	}

	res.render("minichat.ejs", {login: user["login"],
								nom: user["nom"],
								prenom: user["prenom"],
								etat: user["etat_civil"]});
});


// Liste des personnes connectés sur le chat
serv.get("/minichat/connectes", function(req, res){
	var tab = [];
	for(var i = 0; i < tab_connexions.length; i++)
		tab.push(tab_connexions[i]["login"]);
	res.send(JSON.stringify(tab));
});



// ASSETS
serv.get("/assets/:filename", function(req, res){
	res.sendFile(path.join(__dirname, "/assets/"+req.params.filename));
});


// 404 ERROR
serv.use(function(req, res){
	res.status(404).send("404: Page not found");
});


var server = serv.listen(8080);


// SOCKETS
var io = require("socket.io").listen(server);

// Connexion d'un client
io.sockets.on("connection", function(socket){
	var tab = [];
	tab["login"] = socket.request._query["login"];
	tab["id"] = socket.id;
	tab["socket"] = socket;

	tab_connexions.push(tab);

	console.log("Client connecté : "+tab["login"]+" (id:"+tab["id"]+")");

	for(var i = 0; i < tab_messages.length; i++)
		socket.emit("message", tab_messages[i]);

	// Reception d'un message
	socket.on("message", function(message){
		if(tab_messages.length == MAX_MESSAGES)
			tab_messages.shift();
		tab_messages.push(message);
		
		for(var i = 0; i < tab_connexions.length; i++)
			tab_connexions[i]["socket"].emit("message", message);
	});

	// Deconnexion d'un client
	socket.on("disconnect", function(){
		for(var i = 0; i < tab_connexions.length; i++){
			if(tab_connexions[i]["id"].localeCompare(socket.id) == 0){
				console.log("Deconnexion de "+tab_connexions[i]["login"]);
				tab_connexions.splice(i, 1);
				return;
			}
		}
	});
});

