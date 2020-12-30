class Request {}

class Response {}
const net = require("net");
// net.connect({
//   host: "127.0.0.1",
//   port: 8088,
//   onread: {
//     // Reuses a 4KiB Buffer for every read from the socket.
//     buffer: Buffer.alloc(4 * 1024),
//     callback: function(nread, buf) {
//       // Received data is available in `buf` from 0 to `nread`.
//       console.log(buf.toString("utf8", 0, nread));
//     }
//   }
// });
// const net = require('net');
const client = net.createConnection(
  {
    host: "127.0.0.1",
    port: 8088
  },
  () => {
    // 'connect' listener.
    console.log("connected to server!");

    client.write(`
POST / HTTP/1.1\r
Content-Type: application/x-www-form-urlencoded\r
Content-Length: 11\r
\r
name=winter`);
  }
);
client.on("data", data => {
  console.log(data.toString());
  client.end();
});
client.on("end", () => {
  console.log("disconnected from server");
});
