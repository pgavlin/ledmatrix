import * as crypto from "crypto";
import * as http from "http";
import * as fs from "fs";
import * as mime from "mime-types";
import * as os from "os";
import * as path from "path";
import * as qrcode from "qrcode";
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
		target: "esnext",
		module: "commonjs",
		moduleResolution: "node",
		sourceMap: "true",
	},
});

const addresses = [];
for (const addrs of Object.values(os.networkInterfaces())) {
	addresses.push(...addrs.filter(addr => !addr.internal));
}

const ipv4Addresses = addresses.filter(addr => addr.family == "IPv4");
const ipv6Addresses = addresses.filter(addr => addr.family == "IPv6");

const link = ipv4Addresses.length != 0 ? `http://${ipv4Addresses[0].address}:8080` :
	ipv6Addresses.length != 0 ? `http://${ipv6Addresses[0].address}:8080` :
		"https://www.youtube.com/watch?v=GFq6wH5JR2A";

const code = qrcode.create(link);

const mx = ledmatrix.create();

let programText = "";
let anim = animations.life();
let lastQR: number | undefined = undefined;

async function renderQR(mx: ledmatrix.LedMatrix): Promise<number> {
	const mw = mx.getWidth();
	const mh = mx.getHeight();

	const xo = Math.round((mw - code.modules.size) / 2);
	const yo = Math.round((mh - code.modules.size) / 2);

	mx.clear();
	for (let y = 0; y < code.modules.size; y++) {
		for (let x = 0; x < code.modules.size; x++) {
			const bit = code.modules.data[y * code.modules.size + x] ? 255 : 0;
			mx.setPixel(xo + x, yo + y, bit, bit, bit);
		}
	}
	return 10000;
}

async function renderFrame() {
	async function render() {
		const now = Date.now();
		if (code.modules.size < mx.getWidth() && (lastQR === undefined || (now - lastQR!) >= 70000)) {
			lastQR = now;
			return await renderQR(mx);
		}
		return await anim.render(mx);
	}

	const delay = await render();
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
