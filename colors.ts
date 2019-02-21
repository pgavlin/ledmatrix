export interface RGB {
    r: number;
    g: number;
    b: number;
}

export interface HSV {
    h: number;
    s: number;
    v: number;
}

export function clampRGB(c: RGB): RGB {
    return {
        r: c.r > 255 ? 255 : c.r < 0 ? 0 : c.r,
        g: c.g > 255 ? 255 : c.g < 0 ? 0 : c.g,
        b: c.b > 255 ? 255 : c.b < 0 ? 0 : c.b,
    };
}

export function clampHSV(c: HSV): HSV {
    return {
        h: c.h < 0 ? 360 - (-c.h % 360) : c.h % 360,
        s: c.s > 1.0 ? 1.0 : c.s < 0 ? 0 : c.s,
        v: c.v > 1.0 ? 1.0 : c.v < 0 ? 0 : c.v,
    };
}

export function rgbToHsv(c: RGB): HSV {
    if (isNaN(c.r) || isNaN(c.g) || isNaN(c.b)) {
        return {h: NaN, s: NaN, v: NaN};
    }

    // Clamp the input color and map it into the [0, 1] range.
    c = clampRGB(c);
    c = { r: c.r / 255, g: c.g / 255, b: c.b / 255 };

    // Find the minimum and maximum components of the input.
    const min = Math.min(c.r, c.g, c.b);
    const max = Math.max(c.r, c.g, c.b);

    // V is always the max of the  components.
    const v = max;

    // Degenerate case: R == G == B (black <-> white)
    if (min === max) {
        return {h: 0, s: 0, v: v};
    }

    // S is always (max - min) / max.
    const s = (max - min) / max;

    // H depends on which component has the maximum value among the inputs.
    switch (max) {
    case c.r:
        return {h: 60 * (c.g - c.b) / (max - min), s: s, v: v};
    case c.g:
        return {h: 60 * (2 + (c.b - c.r) / (max - min)), s: s, v: v};
    case c.b:
        return {h: 60 * (4 + (c.r - c.g) / (max - min)), s: s, v: v};
    }
    throw new Error("max should have been r, g, or b");
}

export function hsvToRgb(c: HSV): RGB {
    if (isNaN(c.h) || isNaN(c.s) || isNaN(c.v)) {
        return {r: NaN, g: NaN, b: NaN};
    }

    // Clamp the input color.
    c = clampHSV(c);

    function f(n: number) {
        const k = (n + c.h / 60) % 6;
        return c.v - c.v * c.s * Math.max(Math.min(k, 4 - k, 1), 0);
    }

    return {r: f(5) * 255, g: f(3) * 255, b: f(1) * 255};
}

export function interpolateHSV(f: HSV, t: HSV, s: number): HSV {
    if (isNaN(f.h) || isNaN(f.s) || isNaN(f.v) || isNaN(t.h) || isNaN(t.s) || isNaN(t.v)) {
        return {h: NaN, s: NaN, v: NaN};
    }

    // compute the delta between the two colors and do linear interpolation between each component
    const d = {h: t.h - f.h, s: t.s - f.s, v: t.v - f.v};
    return {h: f.h + d.h * s, s: f.s + d.s * s, v: f.v + d.v * s};
}
