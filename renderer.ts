function base64_decode(data: string): Uint8Array {
    return new Uint8Array(<any>Array.prototype.map.call(atob(data), (c: string) => c.charCodeAt(0)));
}

function hex(r: number, g: number, b: number): string {
    return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
}

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }
    const log = gl.getShaderInfoLog(shader)!;
    gl.deleteShader(shader);
    throw new Error(log);
}

function linkProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    const log = gl.getProgramInfoLog(program)!;
    gl.deleteProgram(program);
    throw new Error(log);
}

function createAndLinkProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    return linkProgram(gl, vertexShader, fragmentShader);
}

function rectangle(x: number, y: number, w: number, h: number): number[] {
    const x1 = x, x2 = x + w, y1 = y, y2 = y + h;
    return [
         x1, y1,
         x2, y1,
         x1, y2,
         x1, y2,
         x2, y1,
         x2, y2,
    ];
}

function initGl(): (leds: any) => void {
    // Get A WebGL context
    const canvas = <HTMLCanvasElement>document.getElementById("canvas")!;
    const gl = <WebGLRenderingContext>canvas.getContext("webgl");
    if (!gl) {
        throw new Error("WebGL is not available");
    }

    gl.getExtension("GL_OES_standard_derivatives");

    // shader sources
    const vertexSource =
`
attribute vec4 a_position;

void main() {
    gl_Position = a_position;
}
`;

    function genPsfs(n: number): string {
        let s = "";
        for (let y = 0; y < n; y++) {
            const yc = y - Math.floor(n / 2);
            for (let x = 0; x < n; x++) {
                const xc = x - Math.floor(n / 2);
                s += `\n    psf(nearestLedIndex + vec2(${xc}, ${yc}), normalized, acc);`;
            }
        }
        return s;
    }

    const fragmentSource =
`
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec2 u_gridDimensions;

void psf(in vec2 ledIndex, in vec2 point, inout vec4 acc) {
    vec2 ledCenter = ledIndex / u_gridDimensions + vec2(0.5, 0.5) / u_gridDimensions;
    vec2 texCoord = vec2(ledIndex.x, u_gridDimensions.y - ledIndex.y - 1.0) / u_gridDimensions;
    vec4 ledColor = texture2D(u_image, vec2(texCoord.x, texCoord.y));

    float r = length(ledCenter - point);

    float delta = 0.001;
    float scale = 1.0 - smoothstep(0.005 - delta, 0.005 + delta, r);
    acc += vec4(vec3(180.0, 163.0, 142.0) * scale / 255.0, 1.0);

    if (ledColor.w == 0.0) {
        return;
    }

    if (r < 0.1) {
        float theta = atan(r) * 700.0;

        float f0 = 2.61e6 * exp(-pow(theta / 0.02, 2.0));
        float f1 = 20.91 / pow(theta + 0.02, 3.0);
        float f2 = 72.37 / pow(theta + 0.02, 2.0);

        float scale = 0.282 * f0 + 0.478 * f1 + 0.207 * f2;

        acc = acc + vec4(ledColor.xyz, 1.0) * scale;
    }
}

void main() {
    // normalize the fragment and coordinates
    vec2 normalized = gl_FragCoord.xy / u_resolution;
    vec2 nearestLedIndex = floor(normalized * u_gridDimensions);

    vec4 acc = vec4(0.0, 0.0, 0.0, 1.0);
    ${genPsfs(7)}
    gl_FragColor = acc;
}
`;

    // setup GLSL programs
    const program = createAndLinkProgram(gl, vertexSource, fragmentSource);

    function getLocations(program: WebGLProgram) {
        return {
            position: gl.getAttribLocation(program, "a_position"),
            resolution: gl.getUniformLocation(program, "u_resolution"),
            image: gl.getUniformLocation(program, "u_image"),
            gridDimensions: gl.getUniformLocation(program, "u_gridDimensions"),
        };
    }

    // look up where the vertex data needs to go.
    const locations = getLocations(program);

    // Create a buffer to put three 2d clip space points in
    const positionBuffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Set a rectangle the same size as the image.
    const positions = rectangle(-1, -1, 2, 2);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

//    const baseTexture = gl.createTexture();
//    gl.bindTexture(gl.TEXTURE_2D, baseTexture);
//
//    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
//    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
//    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
//    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set up texture so we are working with pixels.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    let buffer: Uint8Array | undefined;
    return (leds: any) => {
        // Clear the OpenGL canvas.
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Tell it to use our program (pair of shaders)
        gl.useProgram(program);

        // Turn on the position attribute
        gl.enableVertexAttribArray(locations.position);

        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        // Tell the position attribute how to get data out of positionBuffer
        gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

        // both buffers are the same size
        gl.uniform2f(locations.resolution, gl.canvas.width, gl.canvas.height);

        // set the grid dimensions
        gl.uniform2f(locations.gridDimensions, leds.width, leds.height);

        // Create a texture for the LEDs we're drawing.
        //
        // TODO: add an explicit black border to avoid artifacts due to texture wrapping
        if (buffer === undefined || buffer.length != leds.width * leds.height * 4) {
            buffer = new Uint8Array(leds.width * leds.height * 4);
        }
        for (let y = 0; y < leds.height; y++) {
            for (let x = 0; x < leds.width; x++) {
                const lidx = x * 3 + y * leds.width * 3;
                const r = leds.content[lidx];
                const g = leds.content[lidx + 1];
                const b = leds.content[lidx + 2];

                const bidx = x * 4 + y * leds.width * 4;
                buffer[bidx] = r;
                buffer[bidx + 1] = g;
                buffer[bidx + 2] = b;
                buffer[bidx + 3] = r != 0 || g != 0 || b != 0 ? 1.0 : 0.0;
            }
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, leds.width, leds.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, buffer);

        // draw
        gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);

        // both buffers are the same size
        gl.uniform2f(locations.resolution, gl.canvas.width, gl.canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);
    };
}

let last = undefined;
async function scheduleRedraw(render: (leds: any) => void) {
    const t = Date.now();
    const leds = await (await window.fetch("/leds")).json();
    leds.content = base64_decode(leds.content);
    window.requestAnimationFrame(() => {
        render(leds);
        scheduleRedraw(render);
    });
    last = t;
}

window.onload = async () => {
    const canvas = <HTMLCanvasElement>document.getElementById("canvas");

    const cw = document.body.clientWidth, ch = document.body.clientHeight;
    if (cw > ch) {
        canvas.width = ch;
        canvas.height = ch;
        canvas.style.paddingLeft = `${(cw - ch) / 2}px`;
    } else {
        canvas.width = cw;
        canvas.height = cw;
    }
    scheduleRedraw(initGl());
};
