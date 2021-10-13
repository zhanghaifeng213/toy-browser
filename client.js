const net = require("net");
const parser = require("./parser.js");
class Request {
  // method,url=host + port + path
  // body: k/v
  // headers
  constructor(options) {
    this.method = options.method || "GET";
    this.host = options.host;
    this.port = options.port || 80;
    this.path = options.path || "/";
    this.body = options.body || {};
    this.headers = options.headers || {};
    if (!this.headers["Content-Type"]) {
      this.headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    if (this.headers["Content-Type"] === "application/json") {
      this.bodyText = JSON.stringify(this.body);
    } else if (
      this.headers["Content-Type"] === "application/x-www-form-urlencoded"
    ) {
      this.bodyText = Object.keys(this.body)
        .map(key => `${key} = ${encodeURIComponent(this.body[key])}`)
        .join("&");
    }

    this.headers["Content-Length"] = this.bodyText.length;
  }

  toString() {
    return `${this.method} ${this.path} HTTP/1.1\r
${Object.keys(this.headers)
  .map(key => `${key}: ${this.headers[key]}`)
  .join("\r\n")}\r\n
${this.bodyText}\r\n`;
  }

  send(connection) {
    return new Promise((resolve, reject) => {
      const parser = new ResponseParser();
      if (connection) {
        connection.write(this.toString());
      } else {
        connection = net.createConnection(
          {
            host: this.host,
            port: this.port
          },
          () => {
            connection.write(this.toString());
          }
        );
      }

      connection.on("data", data => {
        console.log("connection on data",data.toString());
        // console.log(data.toString());
        // console.log("----end----");

        parser.receive(data.toString());
        // console.log(parser.isFinished);

        if (parser.isFinished) {
          // console.log("isFinished");
          // console.log(parser.getResponse());
          resolve(parser.getResponse());
        }
        connection.end();
      });
      connection.on("error", err => {
        reject(err);
        connection.end();
      });
      connection.on("end", () => {
        console.log("disconnected from server");
      });
    });
  }
}

class Response {}

class ResponseParser {
  constructor() {
    this.WAITING_STATUS_LINE = 0;
    this.WAITING_STATUS_LINE_END = 1;
    this.WAITING_HEADER_NAME = 2;
    this.WAITING_HEADER_SPACE = 3;
    this.WAITING_HEADER_VALUE = 4;
    this.WAITING_HEADER_LINE_END = 5;
    this.WAITING_HEADER_BLOCK_END = 6;
    this.WAITING_BODY = 7;

    this.current = this.WAITING_STATUS_LINE;
    this.statusLine = "";
    this.headers = {};
    this.headerName = "";
    this.headerValue = "";
    this.badyPaser = null;
  }
  isFinished() {
    return this.bodyParser && this.bodyParser.isFinished;
  }
  getResponse() {
    this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([\s\S]+)/);
    return {
      statusCode: RegExp.$1,
      statusText: RegExp.$2,
      headers: this.headers,
      body: this.bodyParser.content.join("")
    };
  }
  receive(string) {
    for (let i = 0; i < string.length; i++) {
      this.receiveChar(string.charAt(i));
    }
  }
  receiveChar(char) {
    if (this.current === this.WAITING_STATUS_LINE) {
      if (char === "\r") {
        // console.log("\\r");
        this.current = this.WAITING_STATUS_LINE_END;
      } else if (char === "\n") {
        // console.log("\\n");
        this.current = this.WAITING_HEADER_NAME;
      } else {
        this.statusLine += char;
      }
    } else if (this.current === this.WAITING_STATUS_LINE_END) {
      if (char === "\n") {
        // console.log("\\n");
        this.current = this.WAITING_HEADER_NAME;
      }
    } else if (this.current === this.WAITING_HEADER_NAME) {
      if (char === ":") {
        this.current = this.WAITING_HEADER_SPACE;
      } else if (char === "\r") {
        this.current = this.WAITING_HEADER_BLOCK_END;
        // this.current = this.WAITING_BODY;
        if (this.headers["Transfer-Encoding"] === "chunked") {
          this.bodyParser = new TrunkedBodyParser();
        }
      } else {
        this.headerName += char;
      }
    } else if (this.current === this.WAITING_HEADER_SPACE) {
      if (char === " ") {
        this.current = this.WAITING_HEADER_VALUE;
      }
    } else if (this.current === this.WAITING_HEADER_VALUE) {
      if (char === "\r") {
        this.current = this.WAITING_HEADER_LINE_END;
        this.headers[this.headerName] = this.headerValue;
        this.headerName = "";
        this.headerValue = "";
      } else {
        this.headerValue += char;
      }
    } else if (this.current === this.WAITING_HEADER_LINE_END) {
      if (char === "\n") {
        this.current = this.WAITING_HEADER_NAME;
      }
    } else if (this.current === this.WAITING_HEADER_BLOCK_END) {
      if (char === "\n") {
        this.current = this.WAITING_BODY;
      }
    } else if (this.current === this.WAITING_BODY) {
      // console.log("WAITING_BODY");
      // console.log(char);
      this.bodyParser.receiveChar(char);
    }
  }
}

class TrunkedBodyParser {
  constructor() {
    this.WAITING_LENGTH = 0;
    this.WAITING_LENGTH_LINE_END = 1;
    this.READING_TRUNK = 2;
    this.WAITING_NEW_LINE = 3;
    this.WAITING_NEW_LINE_END = 4;
    this.FINISHED_NEW_LINE = 5;
    this.FINISHED_NEW_LINE_END = 6;
    this.length = 0;
    this.content = [];
    this.isFinished = false;
    this.current = this.WAITING_LENGTH;
  }
  receiveChar(char) {
    // console.log("char");
    // console.log(char);
    // console.log("JSON.stringify(char)");
    // console.log(JSON.stringify(char));
    // console.log("char.charCodeAt(0)");
    // console.log(char.charCodeAt(0));
    // console.log("Number(char)");
    // console.log(Number(char));
    // console.log("this.current");
    // console.log(this.current);
    if (this.current === this.WAITING_LENGTH) {
      if (char === "\r") {
        if (this.length === 0) {
          this.current = this.FINISHED_NEW_LINE;
        } else {
          this.current = this.WAITING_LENGTH_LINE_END;
        }
      } else {
        this.length *= 16;
        this.length += char.charCodeAt(0) - "0".charCodeAt(0);
        // console.log("this.length");
        // console.log(this.length);
        // this.length += Number(char);
        // console.log("this.length");
        // console.log(JSON.stringify(char));
        // // console.log(Number(char));
        // console.log(this.length);
        // console.log(char.charCodeAt(0));
        // console.log("0".charCodeAt(0));
        // console.log(char.charCodeAt(0) - "0".charCodeAt(0));
      }
    } else if (this.current === this.WAITING_LENGTH_LINE_END) {
      if (char === "\n") {
        this.current = this.READING_TRUNK;
      }
    } else if (this.current === this.READING_TRUNK) {
      this.content.push(char);
      this.length--;
      // console.log("this.content");
      // console.log(this.content);
      // console.log(this.length);
      // console.log(this.current);
      // console.log(this.length === 0);
      if (this.length === 0) {
        // console.log("WAITING_NEW_LINE");
        this.current = this.WAITING_NEW_LINE;
      }
    } else if (this.current === this.WAITING_NEW_LINE) {
      if (char === "\r") {
        this.current = this.WAITING_NEW_LINE_END;
      }
    } else if (this.current === this.WAITING_NEW_LINE_END) {
      if (char === "\n") {
        this.current = this.WAITING_LENGTH;
      }
    } else if (this.current === this.FINISHED_NEW_LINE) {
      if (char === "\r") {
        this.current = this.FINISHED_NEW_LINE_END;
      }
    } else if (this.current === this.FINISHED_NEW_LINE_END) {
      if (char === "\n") {
        this.isFinished = true;
      }
    }
  }
}

void (async function() {
  let request = new Request({
    method: "POST",
    host: "127.0.0.1",
    port: "8088",
    path: "/",
    headers: {
      ["X-Foo2"]: "customed",
      ["Content-Type"]: "application/json"
    },
    body: {
      name: "winter"
    }
  });

  let response = await request.send();
  let dom = parser.parseHTML(response.body);
  console.log('dom', dom);
})();

// const client = net.createConnection(
//   {
//     host: "127.0.0.1",
//     port: 8088
//   },
//   () => {
//     console.log("connected to server!");
//     let request = new Request({
//       method: "POST",
//       host: "127.0.0.1",
//       port: "8088",
//       path: "/",
//       headers: {
//         ["X-Foo2"]: "customed"
//       },
//       body: {
//         name: "winter"
//       }
//     });

//     console.log(request.toString());
//     client.write(request.toString());

//     //     client.write(`
//     // POST / HTTP/1.1\r
//     // Content-Type: application/x-www-form-urlencoded\r
//     // Content-Length: 11\r
//     // \r
//     // name=winter`);
//   }
// );

// client.on("data", data => {
//   console.log(data.toString());
//   client.end();
// });
// client.on("end", () => {
//   console.log("disconnected from server");
// });
