'use strict';

//Loading dependencies & initializing express
var os = require('os');
var express = require('express');
var app = express();
var http = require('http');
//For signalling in WebRTC
var socketIO = require('socket.io');


app.use(express.static('public'))

app.get("/", function(req, res){
	res.render("index.ejs");
});

var server = http.createServer(app);

server.listen(process.env.PORT || 3000);

var io = socketIO(server);

io.sockets.on('connection', function(wsServer) {

	// Convenience function to log server messages on the client.
	// Arguments is an array like object which contains all the arguments of log(). 
	// To push all the arguments of log() in array, we have to use apply().
	function log() {
	  var array = ['Message from server:'];
	  array.push.apply(array, arguments);
	  wsServer.emit('log', array);
	}
  
    
    //Defining Socket Connections
    wsServer.on('message', function(message, room) {
	  log('Client said: ', message);
	  // for a real app, would be room-only (not broadcast)
	  wsServer.in(room).emit('message', message, room);
	});
  
	wsServer.on('create or join', function(room) {
	  log('Received request to create or join room ' + room);
  
	  var clientsInRoom = io.sockets.adapter.rooms.has(room);
      var numClients = clientsInRoom ? io.sockets.adapter.rooms.get(room)?.size : 0;
	  log('Room ' + room + ' now has ' + numClients + ' client(s)');
  
	  if (numClients === 0) {
		wsServer.join(room);
		log('Client ID ' + wsServer.id + ' created room ' + room);
		wsServer.emit('created', room, wsServer.id);
	  } else if (numClients === 1) {
		log('Client ID ' + wsServer.id + ' joined room ' + room);
		io.sockets.in(room).emit('join', room);
		wsServer.join(room);
		wsServer.emit('joined', room, wsServer.id);
		io.sockets.in(room).emit('ready');
	  } else { // max two clients
		wsServer.emit('full', room);
	  }
	});
  
	wsServer.on('ipaddr', function() {
	  var ifaces = os.networkInterfaces();
	  for (var dev in ifaces) {
		ifaces[dev].forEach(function(details) {
		  if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
			wsServer.emit('ipaddr', details.address);
		  }
		});
	  }
	});
  
	wsServer.on('bye', function(room){
	  console.log('received bye'+room);
	});
  
  });