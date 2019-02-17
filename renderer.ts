function base64_decode(data: string): Uint8Array {
    return new Uint8Array(<any>Array.prototype.map.call(atob(data), (c: string) => c.charCodeAt(0)));
}

function hex(r: number, g: number, b: number): string {
    return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
}

function redraw(framebuffer: any) {
    const canvas = <HTMLCanvasElement>document.getElementById("canvas")!;

    const rect = { x: 0, y: 0, w: 0, h: 0 };
    const frameAspect = framebuffer.width / framebuffer.height;
    const screenAspect = canvas.width / canvas.height;
    if (frameAspect > 1.0 == screenAspect > 1.0) {
        rect.w = canvas.width;
        rect.h = canvas.width / frameAspect;
        rect.y = (canvas.height - rect.h) / 2;
    } else {
        rect.h = canvas.height;
        rect.w = canvas.height * frameAspect;
        rect.x = (canvas.width - rect.w) / 2;
    }

    const ctx = <CanvasRenderingContext2D>canvas.getContext("2d");

    const pixelWidth = rect.w / framebuffer.width;
    const pixelHeight = rect.h / framebuffer.height;

    const outerRadius = (pixelWidth < pixelHeight ? pixelWidth : pixelHeight) / 2;
    const innerRadius = outerRadius / 2;

    const drawPixel = (x: number, y: number, r: number, g: number, b: number) => {
        const cx = rect.x + x * pixelWidth + pixelWidth / 2;
        const cy = rect.y + y * pixelHeight + pixelHeight / 2;

        if (r == 0 && g == 0 && b == 0) {
            ctx.fillStyle = hex(180, 163, 142);
            ctx.beginPath();
            ctx.arc(cx, cy, innerRadius * 0.8, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.closePath();
        } else {
            const rg = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius * 0.8);
            rg.addColorStop(0, hex(r, g, b));
            rg.addColorStop(1, "black");
            ctx.fillStyle = rg;

            ctx.beginPath();
            ctx.arc(cx, cy, outerRadius, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.closePath();
        }
    };

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < framebuffer.height; y++) {
        for (let x = 0; x < framebuffer.width; x++) {
            const i = x * 3 + y * framebuffer.width * 3;
            drawPixel(x, y, framebuffer.content[i], framebuffer.content[i+1], framebuffer.content[i+2]);
        }
    }
}

async function scheduleRedraw() {
    const resp = await (await window.fetch("/framebuffer")).json();
    resp.content = base64_decode(resp.content);
    window.requestAnimationFrame(() => {
        redraw(resp);
        scheduleRedraw();
    });
}

window.onload = () => {
    const canvas = <HTMLCanvasElement>document.getElementById("canvas");
    canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;
    scheduleRedraw();
};
