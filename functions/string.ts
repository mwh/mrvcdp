import SubductFunction from './SubductFunction.js';
import * as types from './types.js';


export const Length = new SubductFunction("length", [{ type: types.string }], [{ type: types.int }], async (a: string) => [[a.length]], "Length");
export const Concat = new SubductFunction("concat", [{ type: types.string }, { type: types.string }], [{ type: types.string }], async (a: string, b: string) => [[a + b]], "Concat");
export const RemovePrefix = new SubductFunction("remove-prefix", [{ type: types.string, label: 'original' }, { type: types.string, label: 'prefix' }], [{ type: types.string }], async (a: string, b: string) => [[a.startsWith(b) ? a.substring(b.length) : a]], "Remove Prefix");
export const Split = new SubductFunction("split", [{ type: types.string, label: 'original' }, { type: types.string, label: 'delimiter' }], [{ type: types.string, label: "before" }, { type: types.string, label: "after" }], async (a: string, b: string) => [a.split(b, 2)], "Split String");
export const CharAt = new SubductFunction("character-at", [{ type: types.string }, { type: types.int }], [{ type: types.string }], async (a: string, b: number) => [String.fromCodePoint(a.codePointAt(b)!)], "Character At");

export const ToString = new SubductFunction("to-string", [{ type: types.Generic.A }], [{ type: types.string }], async (a: any) => [['' + a]], "To String");
