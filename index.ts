import * as crypto from "crypto";
import * as http from "http";
import * as fs from "fs";
import * as mime from "mime-types";
import * as path from "path";
import * as net from "net";
import { StringDecoder } from "string_decoder";
import * as timers from "timers";
import * as tsnode from "ts-node";
import * as url from "url";
import * as animations from "./animations";
import * as ledmatrix from "./ledmatrix";

const requireFromString = require("require-from-string");

const compiler = tsnode.register({
    typeCheck: true,
    skipProject: true,
    compilerOptions: {
        target: "es6",
        module: "commonjs",
        moduleResolution: "node",
        sourceMap: "true",
    },
});

const mx = ledmatrix.create();

let programText = "";
let anim = animations.life();

async function renderFrame() {
    const delay = await anim.render(mx);
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

        case "/leds":
            if (req.method !== "GET") {
                resp.writeHead(404);
                break;
            }
            resp.writeHead(200, { "Content-Type": "application/json" });
            await resp.write(JSON.stringify({
                width: mx.getWidth(),
                height: mx.getHeight(),
                content: mx.framebuffer().toString("base64"),
            }));
            break;

        case "/program":
            if (req.method === "GET") {
                await resp.write(programText);
            } else if (req.method === "PATCH") {
                // upload a new program
                const text = await new Promise<string>((resolve, reject) => {
                    let s = "";
                    const decoder = new StringDecoder();
                    req.on("data", (chunk) => {
                        s += decoder.write(chunk);
                    });
                    req.on("end", () => {
                        resolve(s + decoder.end());
                    });
                    req.on("error", reject);
                });

                let compiled: string;
                try {
                    compiled = compiler.compile(text, "program.ts");
                } catch (error) {
                    resp.writeHead(400);
                    await resp.write(error.message);
                    break;
                }

                const program = requireFromString(compiled);
                if (program.render === undefined) {
                    resp.writeHead(400);
                    break;
                }
                programText = text;
                anim = <animations.Animation>program;
            } else {
                resp.writeHead(404);
            }
            break;

        case "/animations.d.ts":
        case "/colors.d.ts":
        case "/editor.html":
        case "/index.html":
        case "/ledmatrix.d.ts":
        case "/main.css":
        case "/renderer.js":
            if (req.method !== "GET") {
                console.log(req.method);
                resp.writeHead(404);
                break;
            }

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
