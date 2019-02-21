import * as fs from "fs";
import * as colors from "./colors";
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

export const adafruit = slides("./adafruit.json");
export const fizzbuzz = slides("./fizzbuzz.json");
export const lambda = slides("./lambda.json");
export const parrot = slides("./parrot.json");
export const pulumipus = slides("./pulumipus.json");
export const partypus = slides("./partypus.json");
export const partypusWalk = slides("./partypus-walk.json");

export function ball(): Animation {
    const state: any = {x: 0, y: 0, dx: 1.5, dy: 0.5, trail: <any[]>[]};
    return {
        render(mx: ledmatrix.LedMatrix): Promise<number> {
            state.x = state.x + state.dx;
            state.y = state.y + state.dy;
            if (state.x >= mx.getWidth() - 1) {
                state.x = mx.getWidth() - 1;
                state.dx = -state.dx;
            } else if (state.x <= 0) {
                state.x = 0;
                state.dx = -state.dx;
            }
            if (state.y >= mx.getHeight() - 1) {
                state.y = mx.getHeight() - 1;
                state.dy = -state.dy;
            } else if (state.y <= 0) {
                state.y = 0;
                state.dy = -state.dy;
            }

            state.trail.push({x: state.x, y: state.y});
            if (state.trail.length == 6) {
                state.trail = state.trail.slice(1, 5);
            }

            for (let y = 0; y < mx.getHeight(); y++) {
                for (let x = 0; x < mx.getWidth(); x++) {
                    mx.setPixel(x, y, 0.0, 0.0, 0.0);
                }
            }

            const step = 255 / 5;
            for (let i = state.trail.length - 1; i >= 0; i--) {
                const xy = state.trail[i];
                mx.setPixel(Math.floor(xy.x), Math.floor(xy.y), 255 - i * step, 255 - i * step, 255 - i * step);
            }

            return Promise.resolve(60);
        },
    };
}

// Conway's Game of Life
//
// - A cell's hue indicates its lineage. It is calculated from the average hue of the cell's parents.
// - A cell's saturation indicates its age. Older cells turn white.
// - The board is reseeded when it has gone stagnant, either because there are no longer any live cells or because the
//   average age of the live cells has grown too large.
export function life(): Animation {
    interface cell {
        age: number;
        live: boolean;
        color: colors.HSV;
        last: colors.HSV;
    };

    const palette = new Array<colors.HSV>(12);
    for (let i = 0; i < palette.length; i++) {
        palette[i] = {h: i * 360 / palette.length, s: 1.0, v: 1.0};
    }

    const grid = {
        cells: new Array<cell>(32 * 32),
        step: 0,
    };
    function seed() {
        for (let i = 0; i < grid.cells.length; i++) {
            const last = grid.cells[i] && grid.cells[i].color ? grid.cells[i].color : {h: 0, s: 1.0, v: 0};
            if (Math.random() >= 0.5) {
                grid.cells[i] = {age: 0, live: true, color: palette[Math.floor(Math.random() * palette.length)], last: last};
                if (last.v == 0) {
                    grid.cells[i].last.h = grid.cells[i].color.h;
                }
            } else {
                grid.cells[i] = {age: 0, live: false, color: {h: last.h, s: 1.0, v: 0}, last: last};
            }
        }
    }
    function neighbor(x: number, y: number, dx: number, dy: number): cell {
        let nx = x + dx, ny = y + dy;
        if (nx < 0) {
            nx = x + (32 - (-dx % 32));
        } else if (nx >= 32) {
            nx = nx % 32;
        }
        if (ny < 0) {
            ny = y + (32 - (-dy % 32));
        } else if (ny >= 32) {
            ny = ny % 32;
        }
        return grid.cells[nx + ny * 32];
    }
    function gen() {
        let age = 0, live = 0;
        const g = new Array<cell>(32 * 32);
        for (let x = 0; x < 32; x++) {
            for (let y = 0; y < 32; y++) {
                const idx = x + y * 32;

                const current = grid.cells[idx];
                const next: cell = {age: current.age, live: current.live, color: {...current.color}, last: {...current.color}};

                const neighbors = [
                    [-1, -1], [-1, 0], [-1, 1],
                    [ 0, -1],          [ 0, 1],
                    [ 1, -1], [ 1, 0], [ 1, 1],
                ].map(([dx, dy]) => neighbor(x, y, dx, dy));

                const liveNeighbors = neighbors.filter(n => n.live);
                switch (liveNeighbors.length) {
                    case 2:
                        next.age++;
                        age += next.age;
                        live++;
                        break;
                    case 3:
                        if (!current.live) {
                            next.live = true;
                            next.color = {h: liveNeighbors.reduce((acc, n) => acc + n.color.h, 0) / 3, s: 1.0, v: 1.0};
                        }
                        next.age++;
                        age += next.age;
                        live++;
                        break;
                    default:
                        next.live = false;
                        next.color.v = 0;
                        next.age = 0;
                        break;
                }
                g[idx] = next;
            }
        }

        const averageAge = age / live;
        if (age == 0 || averageAge > 10) {
            console.log("seeding");
            seed();
        } else {
            grid.cells = g;
        }
    }
    seed();
    return {
        render(mx: ledmatrix.LedMatrix): Promise<number> {
            if (grid.step == 0) {
                gen();
                grid.step = 50;
                return Promise.resolve(1000);
            }

            for (let i = 0; i < grid.cells.length; i++) {
                const cell = grid.cells[i];

                const x = Math.floor(i % 32), y = Math.floor(i / 32);
                const f = colors.clampHSV({h: cell.last.h, s: 1.0 - (cell.age - 1) / 10, v: cell.last.v})
                const t = colors.clampHSV({h: cell.color.h, s: 1.0 - (cell.age - 1) / 10, v: cell.color.v});
                const c = colors.interpolateHSV(f, t, 1.0 - grid.step / 50);
                const {r, g, b} = colors.hsvToRgb(c);
                mx.setPixel(x, y, r, g, b);
            }
            grid.step--;

            return Promise.resolve(20);
        }
    };
}
