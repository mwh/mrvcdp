import SubductFunction from './SubductFunction.js';
import * as types from './types.js';


export const And = new SubductFunction("and", [{ type: types.boolean }, { type: types.boolean }], [{ type: types.boolean }], async (a: boolean, b: boolean) => [[a && b]], "And");
export const Or = new SubductFunction("or", [{ type: types.boolean }, { type: types.boolean }], [{ type: types.boolean }], async (a: boolean, b: boolean) => [[a || b]], "Or");
export const Not = new SubductFunction("not", [{ type: types.boolean }], [{ type: types.boolean }], async (a: boolean, b: boolean) => [[!a]], "Not");

export const Equal = new SubductFunction("equal", [{ type: types.Generic.A }, { type: types.Generic.A }], [{ type: types.boolean }], async (a: any, b: any) => [[a == b]], "Equal");
