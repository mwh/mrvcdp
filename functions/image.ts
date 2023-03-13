import * as colourdata from './colourdata.js';
import SubductFunction from "./SubductFunction.js";
import * as types from './types.js';

export const Tint = new SubductFunction('tint',
    [{ type: types.image }, { type: types.colour }],
    [{ type: types.image }],
    async (img: string, c: {r: number, g: number, b: number}) => {
        let canvas = document.createElement('canvas')
        let img2 = new Image()
        return new Promise((resolve, reject) => {
            img2.addEventListener('load', () => {
                canvas.width = img2.width
                canvas.height = img2.height
                let ctx = canvas.getContext('2d')!
                ctx.drawImage(img2, 0, 0)
                try {
                    let imgData = ctx.getImageData(0, 0, img2.width, img2.height)
                    for (let i = 0; i < imgData.data.length; i += 4) {
                        imgData.data[i] = imgData.data[i] * c.r / 255
                        imgData.data[i + 1] = imgData.data[i + 1] * c.g / 255
                        imgData.data[i + 2] = imgData.data[i + 2] * c.b / 255
                    }
                    ctx.putImageData(imgData, 0, 0)
                    resolve([[canvas.toDataURL()]]);
                } catch (e) {
                    console.log('error', img, e)
                }
            })
            img2.src = img
        })
    });