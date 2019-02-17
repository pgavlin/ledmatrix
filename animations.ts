import * as fs from "fs";
import * as ledmatrix from "./ledmatrix";

export interface Animation {
    render(mx: ledmatrix.LedMatrix): Promise<number>;
};

function slides(path: string): Animation {
    const anim: any = {
        frames: JSON.parse(fs.readFileSync(path).toString()).map((frame: any) => {
            const bytes = Buffer.from(frame.content, "base64");
            const pixels = [];
            for (let i = 0; i < bytes.length; i += 3) {
                pixels.push({r: bytes[i], g: bytes[i+1], b: bytes[i+2]});
            }

            return {
                duration: frame.duration,
                pixels: pixels,
            };
        }),
        index: 0,
    };
    return {
        render(mx: ledmatrix.LedMatrix): Promise<number> {
            const frame = anim.frames[anim.index];
            const pixels = frame.pixels;
            const w = mx.getWidth();
            for (let i = 0; i < pixels.length; i++) {
                const x = Math.floor(i % w), y = Math.floor(i / w);
                const {r, g, b} = pixels[i];
                mx.setPixel(x, y, r, g, b);
            }
            anim.index = (anim.index + 1) % anim.frames.length;
            return Promise.resolve(frame.duration);
        },
    };
}

export const pulumipus = slides("./pulumipus.json");
