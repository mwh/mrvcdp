import SubductFunction from './SubductFunction.js';
import * as types from './types.js';


export const Add = new SubductFunction("add", [{ type: types.int, label: "augend" }, { type: types.int, label: "addend" }], [{ type: types.int, label: "sum" }], async (a: number, b: number) => [[a + b]], "Add");
export const Mul = new SubductFunction("mul", [{ type: types.int, label: "multiplicand" }, { type: types.int, label: "multiplier" }], [{ type: types.int, label: "product" }], async (a: number, b: number) => [[a * b]], "Multiply");
export const Sub = new SubductFunction("sub", [{ type: types.int, label: "minuend" }, { type: types.int, label: "subtrahend" }], [{ type: types.int, label: "difference" }], async (a: number, b: number) => [[a - b]], "Subtract");
export const Div = new SubductFunction("div", [{ type: types.int, label: "dividend" }, { type: types.int, label: "divisor" }], [{ type: types.int, label: "quotient" }], async (a: number, b: number) => [[Math.trunc(a / b)]], "Divide");
export const Double = new SubductFunction("double", [{type: types.int}], [{type: types.int}], async (a : number) => [[a * 2]], "Double");
export const Negate = new SubductFunction("neg", [{type: types.int}], [{type: types.int}], async (a : number) => [[-a]], "Negate");

export const ToFloat = new SubductFunction("to-float", [{ type: types.int }], [{ type: types.float }], async (a: number) => [[a]], "To Float");
export const ToInt = new SubductFunction("to-int", [{ type: types.float }], [{ type: types.int }], async (a: number) => [[Math.trunc(a)]], "To Integer");

export const AddFloat = new SubductFunction("add", [{ type: types.float, label: "augend" }, { type: types.float, label: "addend" }], [{ type: types.float, label: "sum" }], async (a: number, b: number) => [[a + b]], "Add");
export const MulFloat = new SubductFunction("mul", [{ type: types.float, label: "multiplicand" }, { type: types.float, label: "multiplier" }], [{ type: types.float, label: "product" }], async (a: number, b: number) => [[a * b]], "Multiply");
export const SubFloat = new SubductFunction("sub", [{ type: types.float, label: "minuend" }, { type: types.float, label: "subtrahend" }], [{ type: types.float, label: "difference" }], async (a: number, b: number) => [[a - b]], "Subtract");
export const DivFloat = new SubductFunction("div", [{ type: types.float, label: "dividend" }, { type: types.float, label: "divisor" }], [{ type: types.float, label: "quotient" }], async (a: number, b: number) => [[a / b]], "Divide");
export const DoubleFloat = new SubductFunction("double", [{type: types.float}], [{type: types.float}], async (a : number) => [[a * 2]], "Double");
export const NegateFloat = new SubductFunction("neg", [{type: types.float}], [{type: types.float}], async (a : number) => [[-a]], "Negate");

export const RandomTo = new SubductFunction("random-to", [{type: types.int}], [{type: types.int}], async (a : number) => [[Math.floor(Math.random() * (a + 1))]], "Random To");
