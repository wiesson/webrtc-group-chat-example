import * as http from "http";
import * as fs from "fs";
import * as io from "socket.io";

const PORT = 8080;

type OnJoin = {
  channelId: string;
  uid: string;
};

type OnRelayICECandidate = {
  sid: string;
  iceCandidate: RTCIceCandidate;
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");

  if (req.url === "/client") {
    fs.readFile(__dirname + "/index.html", (err, data) => {
      res.writeHead(200);
      res.end(data);
    });
    return;
  }
});

const socket = io.listen(server);

type SocketWithUser = { uid: string; channelId: string } & io.Socket;

socket.on("connection", (socket: SocketWithUser) => {
  socket.on("join", ({ channelId, uid }: OnJoin) => {
    socket.channelId = channelId;
    socket.uid = uid;

    socket.join(channelId, () => {
      console.log(`${uid}/${socket.id} joined ${channelId}`);
      socket.to(channelId).emit("addPeer", {
        sid: socket.id,
        uid: socket.uid,
      });

      console.log("socket.adapter.rooms");
      console.log(socket.adapter.rooms[channelId]);
    });
  });

  socket.on(
    "relayICECandidate",
    ({ sid, iceCandidate }: OnRelayICECandidate) => {
      console.log(`[${socket.id}] relaying ICE candidate to [${sid}] `);
      socket.to(sid).emit("iceCandidate", { sid: socket.id, iceCandidate });
    }
  );

  socket.on("relaySessionDescription", ({ sid, sessionDescription }) => {
    console.log(
      `${socket.id} sent session description to ${sid} with type ${sessionDescription.type}`
    );

    socket
      .to(sid)
      .emit("sessionDescription", { sid: socket.id, sessionDescription });
  });

  socket.on("leave", ({ channelId }) => {
    console.log(`${socket.uid}/${socket.id} left ${channelId}`);
    leaveChannel(socket.id, socket.uid, channelId);
  });

  socket.on("disconnect", () => {
    console.log(`${socket.uid}/${socket.id} disconnected`);
    leaveChannel(socket.id, socket.uid, socket.channelId);
  });

  function leaveChannel(sid: string, uid: string, channelId: string) {
    socket.leave(channelId);
    socket.to(channelId).emit("removePeer", { sid, uid });
  }
});

server.listen(PORT, "", () => {
  console.log("Listening on port " + PORT);
});
