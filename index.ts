import * as crypto from "crypto";
import * as http from "http";
import * as fs from "fs";
import * as mime from "mime-types";
import * as path from "path";
import * as net from "net";
import * as timers from "timers";
import * as url from "url";
import * as animations from "./animations";
import * as ledmatrix from "./ledmatrix";

const mx = ledmatrix.create();

async function renderFrame() {
    const delay = await animations.pulumipus.render(mx);
    mx.update();
    timers.setTimeout(renderFrame, delay);
}
renderFrame();
 
const host = "localhost";
const port = 8080;

const server = new http.Server();
server.on("request", async (req: http.IncomingMessage, resp: http.ServerResponse) => {
    const u = new url.URL(req.url!, `http://${host}:${port}`);
    const p = u.pathname.toLowerCase();
    switch (p) {
        case "/":
            u.pathname = "/index.html";
            resp.writeHead(301, { "Location": u.href });
            break;

        case "/framebuffer":
           
            resp.writeHead(200, { "Content-Type": "application/json" });
            await resp.write(JSON.stringify({
                width: mx.getWidth(),
                height: mx.getHeight(),
                content: mx.framebuffer().toString("base64"),
            }));
            break;

        case "/index.html":
        case "/main.css":
        case "/renderer.js":
            resp.writeHead(200, { "Content-Type": mime.contentType(path.extname(p)) || "text/plain" });
            await resp.write(await new Promise((resolve) => fs.readFile(`.${p}`, (_, data) => resolve(data))));
            break;
    }
    resp.end();
});

server.listen(port, host, () => {
    const addr = <net.AddressInfo>server.address();
    console.log(`listening on http://${addr.address}:${addr.port}`);
});
