'use strict';

//Defining some global utility variables
//https://dev.to/eneaslari/share-file-securely-peer-to-peer-with-webrtc-31d1

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var localVideo;
var peerConnection;
var remoteStream;
var remoteVideo;
var turnReady;
var room;
let file;
let displayMediaStream;
const senders = [];
const MAXIMUM_MESSAGE_SIZE = 65535;
const END_OF_FILE_MESSAGE = 'EOF';
var channel;

//Initialize turn/stun server here
var pcConfig = turnConfig;

var localStreamConstraints = {
    audio: true,
    video: true
  };


//Not prompting for room name
//var room = 'foo';

// Prompting for room name:
//var room = prompt('Enter room name:');

//Initializing socket.io
var socket = io.connect();

function enterIn(){
  room = document.querySelector('#roomName').value;
  console.log(room);

  if (room !== null || typeof room !== null) {
    socket.emit('create or join', room);
    console.log('Attempted to create or  join room', room);
  }
}
//Defining socket connections for signalling
socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
  createRoom();
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
  createRoom();
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});


//Driver code
socket.on('message', function(message, room) {
    console.log('Client received message:', message,  room);
    if (message === 'got user media') {
      maybeStart();
    } else if (message.type === 'offer') {
      if (!isInitiator && !isStarted) {
        maybeStart();
      }
      peerConnection.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    } else if (message.type === 'answer' && isStarted) {
      peerConnection.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate
      });
      peerConnection.addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
      handleRemoteHangup();
    }
});
  


//Function to send message in a room
function sendMessage(message, room) {
  console.log('Client sending message: ', message, room);
  socket.emit('message', message, room);
}


function createRoom(){
  //Displaying Local Stream and Remote Stream on webpage
  localVideo = document.querySelector('#localVideo');
  remoteVideo = document.querySelector('#remoteVideo');
  console.log("Going to find Local media");
  navigator.mediaDevices.getUserMedia(localStreamConstraints)
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });
}
//If found local stream
function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  if (isInitiator) {
    maybeStart();
  }else{
    console.log('Getting user media with constraints', localStreamConstraints);
    sendMessage('got user media', room);
  }
}



//If initiator, create the peer connection
function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    peerConnection.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

//Sending bye if user closes the window
window.onbeforeunload = function() {
  sendMessage('bye', room);
};

//Creating peer connection
function createPeerConnection() {
  try {
    peerConnection = new RTCPeerConnection(pcConfig);

    channel = peerConnection.createDataChannel("filetransfer");

    peerConnection.onicecandidate = handleIceCandidate;
    peerConnection.onaddstream = handleRemoteStreamAdded;
    peerConnection.onremovestream = handleRemoteStreamRemoved;
    peerConnection.ondatachannel = handleDataChannel;

    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleDataChannel(event) {
  console.log("handleDataChannel event= ");
  console.log(event);

  const channel  = event.channel;
  channel.binaryType = 'arraybuffer';

  const receivedBuffers = [];
  channel.onmessage = async (event) => {
    console.log("handleDataChannel onmessage event= "+ event);

    const { data } = event;
    try {
      if (data !== END_OF_FILE_MESSAGE) {
        receivedBuffers.push(data);
      } else {
        const arrayBuffer = receivedBuffers.reduce((acc, arrayBuffer) => {
          const tmp = new Uint8Array(acc.byteLength + arrayBuffer.byteLength);
          tmp.set(new Uint8Array(acc), 0);
          tmp.set(new Uint8Array(arrayBuffer), acc.byteLength);
          return tmp;
        }, new Uint8Array());
        const blob = new Blob([arrayBuffer]);
        channel.send("THE FILE IS READYYY")
        downloadFile(blob, channel.label);
        //channel.close();
      }
    } catch (err) {
      console.log('File transfer failed');
    }
  };
};

const shareFile = async () => {
  if (file) {
    const channelLabel = file.name;
    console.log(channelLabel);
    //const channel = peerConnection.createDataChannel(channelLabel);

    const state = channel.readyState;

    channel.binaryType = 'arraybuffer';
    console.log("data channel "+state);

    //channel.onopen = (event) => {
      console.log("data channel is opened");

      const arrayBuffer = file.arrayBuffer();
      console.log("data channel arrayBuffer");
      console.log(arrayBuffer);

      for (let i = 0; i < arrayBuffer.byteLength; i += MAXIMUM_MESSAGE_SIZE) {
        channel.send(arrayBuffer.slice(i, i + MAXIMUM_MESSAGE_SIZE));
      }
      channel.send(END_OF_FILE_MESSAGE);
    //};

    //channel.onclose;
  }
};



function downloadFile(blob, fileName) {
  const a = document.createElement('a');
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove()
};


//Function to handle Ice candidates
function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    }, room);
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  peerConnection.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  peerConnection.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  peerConnection.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription, room);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}


function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye',room);
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  peerConnection.close();
  peerConnection = null;
}

document.getElementById('share-file-button').addEventListener('click', () => {
  document.getElementById('select-file-dialog').style.display = 'block';
});

document.getElementById('ok-button').addEventListener('click', () => {
  shareFile();
});

document.getElementById('select-file-input').addEventListener('change', (event) => {
  file = event.target.files[0];
  document.getElementById('ok-button').disabled = !file;
});

document.getElementById('share-button').addEventListener('click', async () => {
  if (!displayMediaStream) {
    displayMediaStream = await navigator.mediaDevices.getDisplayMedia();
  }
  senders.find(sender => sender.track.kind === 'video').replaceTrack(displayMediaStream.getTracks()[0]);

  //show what you are showing in your "self-view" video.
  document.getElementById('self-view').srcObject = displayMediaStream;

  //hide the share button and display the "stop-sharing" one
  document.getElementById('share-button').style.display = 'none';
  document.getElementById('stop-share-button').style.display = 'inline';
});

document.getElementById('stop-share-button').addEventListener('click', async () => {
  senders.find(sender => sender.track.kind === 'video')
    .replaceTrack(userMediaStream.getTracks().find(track => track.kind === 'video'));
  document.getElementById('self-view').srcObject = userMediaStream;
  document.getElementById('share-button').style.display = 'inline';
  document.getElementById('stop-share-button').style.display = 'none';
});