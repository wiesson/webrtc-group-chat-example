const PORT = 8080;
const http = require("http");
const fs = require("fs");

const server = http.createServer((req, res) => {
  fs.readFile(__dirname + "/index.html", (err, data) => {
    res.writeHead(200);
    res.end(data);
  });
});

const io = require("socket.io").listen(server);
io.path("/api");

server.listen(PORT, null, () => {
  console.log("Listening on port " + PORT);
});

/*************************/
/*** INTERESTING STUFF ***/
/*************************/
let channels = {};
let sockets = {};

/**
 * Users will connect to the signaling server, after which they'll issue a "join"
 * to join a particular channel. The signaling server keeps track of all sockets
 * who are in a channel, and on join will send out 'addPeer' events to each pair
 * of users in a channel. When clients receive the 'addPeer' even they'll begin
 * setting up an RTCPeerConnection with one another. During this process they'll
 * need to relay ICECandidate information to one another, as well as SessionDescription
 * information. After all of that happens, they'll finally be able to complete
 * the peer connection and will be streaming audio/video between eachother.
 */
io.sockets.on("connection", (socket) => {
  socket.channels = {};
  sockets[socket.id] = socket;

  console.log("[" + socket.id + "] connection accepted");
  socket.on("disconnect", () => {
    for (const channel in socket.channels) {
      part(channel);
    }
    console.log("[" + socket.id + "] disconnected");
    delete sockets[socket.id];
  });

  socket.on("join", (config) => {
    console.log("[" + socket.id + "] join ", config);
    const { channel, userData } = config;

    if (channel in socket.channels) {
      console.log("[" + socket.id + "] ERROR: already joined ", channel);
      return;
    }

    if (!(channel in channels)) {
      channels[channel] = {};
    }

    for (const id in channels[channel]) {
      channels[channel][id].emit("addPeer", {
        peerId: socket.id,
        shouldCreateOffer: false,
      });
      socket.emit("addPeer", { peerId: id, shouldCreateOffer: true, userData });
    }

    channels[channel][socket.id] = socket;
    socket.channels[channel] = channel;
  });

  function part(channel) {
    console.log("[" + socket.id + "] part ");

    if (!(channel in socket.channels)) {
      console.log("[" + socket.id + "] ERROR: not in ", channel);
      return;
    }

    delete socket.channels[channel];
    delete channels[channel][socket.id];

    for (const id in channels[channel]) {
      channels[channel][id].emit("removePeer", { peerId: socket.id });
      socket.emit("removePeer", { peerId: id });
    }
  }
  socket.on("part", part);

  socket.on("relayICECandidate", (config) => {
    const { peerId, iceCandidate } = config;
    console.log(
      "[" + socket.id + "] relaying ICE candidate to [" + peerId + "] ",
      iceCandidate
    );

    if (peerId in sockets) {
      sockets[peerId].emit("iceCandidate", {
        peerId: socket.id,
        iceCandidate,
      });
    }
  });

  socket.on("relaySessionDescription", (config) => {
    const { peerId, sessionDescription } = config;
    console.log(
      "[" + socket.id + "] relaying session description to [" + peerId + "] ",
      sessionDescription
    );

    if (peerId in sockets) {
      sockets[peerId].emit("sessionDescription", {
        peerId: socket.id,
        sessionDescription,
      });
    }
  });
});
