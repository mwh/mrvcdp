import * as colourdata from './colourdata.js';
import SubductFunction from "./SubductFunction.js";
import * as types from './types.js';

// 360 countTo emitAll dup 10 countTo emitAll 10 mul toFloat 100.0 div 0.390 hsl dup namedist

type ColourValue = { r: number, g: number, b: number };

export function ColourLiteralFunction(s?: string): SubductFunction {
    let name = colourdata.nameColour(s ?? '#0000ff');
    return new SubductFunction('colour' + (s ? ':' + s.substring(1) : ''), [], [{ type: types.colour }], async () => [[s ? hexToRGB(s) : {r:0, g:0, b:255}]], `Colour${s ? ': ' + name.replace(/-/g, ' ') : ''}`,
        function colourGenerator(func: SubductFunction, modifiers: Array<any> = [], inputTypes: Array<any> = [], replacing? : SubductFunction): SubductFunction | undefined {
            if (inputTypes.length != 0) {
                return undefined;
            }
            let col = modifiers[0] ? '#' + (modifiers[0]) : undefined;
            if (replacing && replacing.otherConfig.colourValue)
                col = replacing.otherConfig.colourValue;
            let ret = ColourLiteralFunction(col);
            return ret;
        },
        {
            edit: {
                type: 'color',
                create: (value: string) => ColourLiteralFunction(value),
            },
            colourValue: s
        }
    );
}

function hexToRGB(hex: string): { r: number, g: number, b: number } {
    let bigint = parseInt(hex.substring(1), 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    return { r, g, b };
}

function rgbToHsl(r : number, g : number, b : number) {
    r /= 255, g /= 255, b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h * 360, s, l];
}

function hslToRgb(h : number, s : number, l : number) {
    let c = (1 - Math.abs(2 * l - 1)) * s
    let x = c * (1 - Math.abs((h / 60) % 2 - 1))
    let m = l - c / 2
    let r, g, b;
    if (h < 60) {
        r = c
        g = x
        b = 0
    } else if (h < 120) {
        r = x
        g = c
        b = 0
    } else if (h < 180) {
        r = 0
        g = c
        b = x
    } else if (h < 240) {
        r = 0 
        g = x
        b = c
    } else if (h < 300) {
        r = x
        g = 0
        b = c
    } else {
        r = c
        g = 0
        b = x
    }
    r = (r + m) * 255
    g = (g + m) * 255
    b = (b + m) * 255
    return [r, g, b]
}

export const ToRGB = new SubductFunction('to-rgb',
    [{ type: types.colour }],
    [{ type: types.int, label: "r" }, { type: types.int, label: "g" }, { type: types.int, label: "b" }],
    async (col: ColourValue) => {
        //let rgb = hexToRGB(col);
        return [[col.r, col.g, col.b]];
    },
    "To RGB"
);

export const ToHSL = new SubductFunction('to-hsl',
    [{ type: types.colour }],
    [{ type: types.int, label: "h" }, { type: types.float, label: "s" }, { type: types.float, label: "l" }],
    async (rgb : ColourValue) => {
        //let rgb = hexToRGB(col);
        let hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        return [[hsl[0]|0, hsl[1], hsl[2]]];
    },
    "To HSL"
);

export const Complement = new SubductFunction('complement',
    [{ type: types.colour }],
    [{ type: types.colour }],
    async (rgb: ColourValue) => {
        //let rgb = hexToRGB(col);
        let hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        hsl[0] = (hsl[0] + 180) % 360;
        let rgb2 = hslToRgb(hsl[0], hsl[1], hsl[2]);
        let ret = { r: rgb2[0], g: rgb2[1], b: rgb2[2]}
        return [[ret]];
    },
    "Complement"
);

export const Darken = new SubductFunction('darken',
    [{ type: types.colour }],
    [{ type: types.colour }],
    async (rgb: ColourValue) => {
        //let rgb = hexToRGB(col);
        let hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        hsl[2] = Math.max(0, hsl[2] - 0.1);
        let rgb2 = hslToRgb(hsl[0], hsl[1], hsl[2]);
        let col2 = '#' + rgb2.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
        return [[col2]];
    },
    "Darken"
);

export const Lighten = new SubductFunction('lighten',
    [{ type: types.colour }],
    [{ type: types.colour }],
    async (rgb: ColourValue) => {
        //let rgb = hexToRGB(col);
        let hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        hsl[2] = Math.min(1, hsl[2] + 0.1);
        let rgb2 = hslToRgb(hsl[0], hsl[1], hsl[2]);
        let col2 = '#' + rgb2.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
        return [[col2]];
    },
    "Lighten"
);

const NameDist = new SubductFunction('namedist',
    [{ type: types.colour }],
    [{type: types.colour}, { type: types.string }, { type: types.float }],
    async (col: ColourValue) => {
        let info = colourdata.nameDist(col);
        return [[info.specimen, info.name, info.distance]];
    },
    "Name Distance"
);

export const Mix = new SubductFunction('mix',
    [{ type: types.colour }, { type: types.colour }],
    [{ type: types.colour }],
    async (rgb1: ColourValue, rgb2: ColourValue) => {
        //let rgb1 = hexToRGB(col1);
        //let rgb2 = hexToRGB(col2);
        let white1 = Math.min(rgb1.r, rgb1.g, rgb1.b);
        let white2 = Math.min(rgb2.r, rgb2.g, rgb2.b);
        let rest1 = {r: rgb1.r - white1, g: rgb1.g - white1, b: rgb1.b - white1};
        let rest2 = {r: rgb2.r - white2, g: rgb2.g - white2, b: rgb2.b - white2};
        let midWhite = (white1 + white2) / 2;
        let avgRest = {r: (rest1.r + rest2.r) / 2, g: (rest1.g + rest2.g) / 2, b: (rest1.b + rest2.b) / 2};
        let whiteX = Math.min(avgRest.r, avgRest.g, avgRest.b);
        avgRest = {r: avgRest.r - whiteX, g: avgRest.g - whiteX, b: avgRest.b - whiteX};
        //avgRest.g += whiteX * 0.75;
        avgRest.r += midWhite;
        avgRest.g += midWhite;
        avgRest.b += midWhite;
        //let col = '#' + [avgRest.r, avgRest.g, avgRest.b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
        let ret = {r: avgRest.r, g: avgRest.g, b: avgRest.b};
        return [[ret]];
    },
    "Mix"
);

export const HSL = new SubductFunction('hsl',
    [{ type: types.int, label: 'h' }, {type: types.float, label: 's'}, {type: types.float, label: "l"}],
    [{ type: types.colour }],
    async (h : number, s: number, l: number) => {
        let rgb = hslToRgb(h, s, l);
        //let col = '#' + rgb.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
        return [[{r: rgb[0], g: rgb[1], b: rgb[2]}]];
    },
    "HSL"
);

export const RGB = new SubductFunction('rgb',
    [{ type: types.int, label: 'r' }, {type: types.int, label: 'g'}, {type: types.int, label: "b"}],
    [{ type: types.colour }],
    async (r : number, g: number, b: number) => {
        return [[{r, g, b}]];
    },
    "RGB"
);

export const Nearest = new SubductFunction('nearest',
    [{ type: types.colour }],
    [{ type: types.colour }],
    async (c : { r: number, g: number, b: number }) => {
        let c2 = colourdata.nameDist(c);
        return [[c2.specimenRGB!]];
    },
    "Nearest"
);

export const NextFrom = new SubductFunction('next-from',
    [{ type: types.colour }, { type: types.colour }],
    [{ type: types.colour }],
    async (c1 : { r: number, g: number, b: number }, c2 : { r: number, g: number, b: number }) => {
        let n = colourdata.nextFrom(c1, c2);
        return [[n]];
    },
    "Next From"
);