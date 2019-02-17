// TODO(pdg): import the LED matrix library and use it for real hardware

export interface LedMatrix {
    getWidth(): number;
    getHeight(): number;
    fill(red: number, green: number, blue: number): void;
    setPixel(x: number, y: number, red: number, green: number, blue: number): void;
    clear(): void;
    update(): void;

    framebuffer(): Buffer;
}

function clamp(v: number): number {
    return v < 0 ? 0 : v > 255 ? 255 : v;
}

export function create(): LedMatrix {
    const buffer = Buffer.alloc(32*32*3);
    const framebuffer = Buffer.alloc(buffer.length);
    return {
        getWidth() { return 32; },
        getHeight() { return 32; },
        fill(red: number, green: number, blue: number) {
            for (let x = 0; x < 32; x++) {
                for (let y = 0; y < 32; y++) {
                    const i = x * 3 + y * 32 * 3;
                    buffer[i+0] = clamp(red);
                    buffer[i+1] = clamp(green);
                    buffer[i+2] = clamp(blue);
                }
            }
        },
        setPixel(x: number, y: number, red: number, green: number, blue: number) {
            if (x < 0 || x > 31 || y < 0 || y > 31) {
                throw new Error("x and y coordinates must be between 0 and 31");
            }
            const i = x * 3 + y * 32 * 3;
            buffer[i+0] = clamp(red);
            buffer[i+1] = clamp(green);
            buffer[i+2] = clamp(blue);
        },
        clear() {
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] = 0;
            }
        },
        update() {
            buffer.copy(framebuffer);
        },
        framebuffer() {
            return framebuffer;
        },
    };
}
