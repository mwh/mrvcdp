import * as number from './number.js';
import * as colours from './colour.js';
import * as boolean from './boolean.js';
import * as string from './string.js';
import * as image from './image.js';

import * as types from './types.js';

import SubductFunction from './SubductFunction.js';

export type FunctionInput = {
    label? : string
    type : types.Type
}

export type FunctionOutput = {
    label? : string
    type : types.Type
}

type Generic = { generic: string }

function projectFunctionOverStream(func : SubductFunction, stream: types.ParametricType) {
    console.log('projecting function', func.name, 'for', stream.parameters.map(x => x.toString()).join(', '))
    let f = new SubductFunction(func.name,
        [{type: stream}],
        [{type: types.Stream(...func.outputs.map(x => x.type)) }],
        async (a : AsyncIterable<Array<any>>) => {
            async function* tmp() {
                for await (let x of a) {
                    let ev = await func?.executor(...x);
                    yield* await ev
                }
            }
            return [[tmp()]]
        },
        func.label
    );
    f.baseFunction = func;
    return f;
}

export class FunctionSet {
    functions : Map<string, Array<SubductFunction>> = new Map<string, Array<SubductFunction>>();

    constructor() {
    }

    addFunction(func : SubductFunction) {
        if (!this.functions.has(func.name)) {
            this.functions.set(func.name, new Array<SubductFunction>());
        }
        this.functions.get(func.name)?.push(func);
    }

    getFunction(name : string, argumentTypes : Array<any>, modifiers : Array<any> = []) : SubductFunction | undefined {
        if (argumentTypes.length == 1) {
            let rec = argumentTypes[0].getAlternative('record') as types.RecordType | undefined;
            if (rec) {
                if (name.startsWith('.')) {
                    // Record accessor
                    let label = name.substring(1);
                    let type = rec.fieldLookup[label];
                    let f = new SubductFunction(name, [{type: rec}], [{type, label}], async (a : any) => [[a[label]]]);
                    return f;
                }
            }
            // Project functions over a stream of their parameter types
            if (types.AnyStream.accepts(argumentTypes[0])) {
                let streamType = argumentTypes[0] as types.ParametricType;
                let func = this.getFunction(name, streamType.parameters);
                if (func) {
                    if (func.baseFunction && func.baseFunction.inputs.length == 1 && (
                            func.baseFunction.inputs[0].type.accepts(streamType)
                            || func.baseFunction.inputs[0].type instanceof types.GenericType
                            || types.AnyStream.accepts(func.baseFunction.inputs[0].type))) {
                        // ignore
                    } else {
                        //console.log('att', func.name, func.inputs[0], streamType, func.inputs[0].type.accepts(streamType))
                        //if (!func.inputs[0].type.accepts(streamType)) // For e.g. "drop", want to drop stream not project drop over it
                        return projectFunctionOverStream(func, streamType);
                    }
                }
            }
        }
        if (!this.functions.has(name)) {
            return undefined;
        }
        let functions = this.functions.get(name);
        if (!functions) {
            return undefined;
        }
        for (let func of functions) {
            if (func.generator) {
                func = func.generator(func, modifiers, argumentTypes)
            }
            if (!func || func.inputs.length != argumentTypes.length) {
                continue;
            }
            let f = this.genericMap(func, argumentTypes);
            if (f) {
                return f;
            } else {
                continue;
            }
            let match = true;
            let genericMap = new Map<string, any>();
            for (let i = 0; i < argumentTypes.length; i++) {
                if ((<any>func.inputs[i].type).generic) {
                    let g = (<any>func.inputs[i].type).generic;
                    if (!genericMap.has(g)) {
                        genericMap.set(g, argumentTypes[i]);
                    } else if (genericMap.get(g) != argumentTypes[i]) {
                        match = false;
                        break;
                    }
                } else if (func.inputs[i].type != argumentTypes[i]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                if (genericMap.size) {
                    return func.instantiateGenerics(genericMap);
                }
                return func;
            }
        }
        return undefined;
    }

    genericMap(func : SubductFunction, argTypes : Array<any>) : SubductFunction | null {
        let genericMap = new Map<string, any>();
        for (let i = 0; i < argTypes.length; i++) {
            let iType = func.inputs[i].type;
            let aType = argTypes[i];
            if ((<any>func.inputs[i].type).generic) {
                let g = (<any>func.inputs[i].type).generic;
                if (!genericMap.has(g)) {
                    genericMap.set(g, argTypes[i]);
                } else if (!genericMap.get(g).accepts(argTypes[i])) {
                    return null;
                }
            //} else if (typeof iType == 'string' && iType.startsWith('stream<')) {
            //    if (typeof aType != 'string' || !aType.startsWith('stream<')) {
            //        return null;
            //    }
            } else if (iType instanceof types.Type && !iType.accepts(argTypes[i])) {
                return null;
            } else if (!func.inputs[i].type.accepts(argTypes[i])) {
                return null;
            }
        }
        if (genericMap.size) {
            return func.instantiateGenerics(genericMap);
        }
        return func
    }

    getAcceptingFunctions(inputTypes : Array<any>) : Array<SubductFunction> {
        let ret : Array<SubductFunction> = new Array<SubductFunction>();
        for (let [name, functions] of this.functions) {
            for (let func of functions) {
                // Offer projections to stream
                if (inputTypes.length == 1 && types.AnyStream.accepts(inputTypes[0])) {
                    let streamType = inputTypes[0] as types.ParametricType;
                    let f;
                    f = func;
                    if (f.generator)
                        f = f.generator(func, [], streamType.parameters);
                    if (f && f.inputs.length == streamType.parameters.length) {
                        f = this.genericMap(f, streamType.parameters);
                        if (f) {
                            for (let i = 0; i < f.inputs.length; i++) {
                                if (!f.inputs[i].type.accepts(streamType.parameters[i])) {
                                    f = undefined;
                                    break;
                                }
                            }
                            if (f) {
                                let f2 = this.getFunction(func.name, [streamType]);
                                if (f2) {
                                    ret.push(f2);
                                }
                            }
                        }
                    }
                }
                
                // Handle ordinary functions
                if (func.generator)
                    func = func.generator(func, [], inputTypes);

                if (!func || func.inputs.length != inputTypes.length) {
                    continue;
                }
                let match = true;
                // for (let i = 0; i < inputTypes.length; i++) {
                //     if ((<any>func.inputs[i].type).generic) {
                //         continue;
                //     } else if (func.inputs[i].type != inputTypes[i]) {
                //         match = false;
                //         break;
                //     }
                // }
                if (match) {
                    let f = this.genericMap(func, inputTypes);
                    if (f)
                        ret.push(f);
                }
            }
        }
        if (inputTypes.length == 1) {
            let rec = inputTypes[0].getAlternative('record') as types.RecordType | undefined;
            if (rec) {
                for (let [name, type] of rec.fields) {
                    let f = new SubductFunction('.' + name, [{type: rec}], [{type, label: name}], async (a : any) => [[a[name]]]);
                    ret.push(f);
                }
            }
        }
        return ret;
    }

    getFittingFunctions(inputTypes : Array<any>, outputTypes : Array<any>, replacing? : SubductFunction) : Array<SubductFunction> {
        let ret : Array<SubductFunction> = new Array<SubductFunction>();
        for (let [name, functions] of this.functions) {
            for (let func of functions) {
                if (func.generator)
                    func = func.generator(func, [], inputTypes, replacing);
                if (!func || func.inputs.length != inputTypes.length || func.outputs.length != outputTypes.length) {
                    continue;
                }
                
                let f = this.genericMap(func, inputTypes);
                for (let i = 0; i < outputTypes.length; i++) {
                    if ((<any>func.outputs[i].type).generic) {
                        continue;
                    } else if (func.outputs[i].type != outputTypes[i]) {
                        f = null;
                        break;
                    }
                }
                if (f) {
                    ret.push(f);
                }
            }
        }
        return ret;
    }
}

export class StopEvaluation {
    constructor() {
    }
}

export function NumberLiteralFunction(n : number) : SubductFunction {
    return new SubductFunction(n.toString(), [], [{type: types.int}], async () => [[n]], n.toString(), undefined,
        {
            edit: {
                type: 'number',
                create: (value : number) => NumberLiteralFunction(value),
            }
        }
    );
}

export function FloatLiteralFunction(n : number) : SubductFunction {
    return new SubductFunction(n.toString(), [], [{type: types.float}], async () => [[n]], n.toString(), undefined,
        {
            edit: {
                type: 'number',
                create: (value : number) => FloatLiteralFunction(value),
            }
        }
    );
}

export function StringLiteralFunction(s : string) : SubductFunction {
    return new SubductFunction('"' + s + '"', [], [{type: types.string}], async () => [[s]], `"${s}"`, undefined,
        {
            edit: {
                type: types.string,
                create: (value : string) => StringLiteralFunction(value),
            }
        }
    );
}

export const Dup = new SubductFunction("dup", [{type: types.Generic.A}], [{type: types.Generic.A}, {type: types.Generic.A}], async (a : any) => [[a, a]], "Duplicate");
export const Swap = new SubductFunction("swap", [{type: types.Generic.A}, {type: types.Generic.B}], [{type: types.Generic.B}, {type: types.Generic.A}], async (a : any, b : any) => [[b, a]], "Swap");

export const Fork = new SubductFunction("fork", [{type: types.Generic.A}, {type: types.Generic.A}], [{type: types.Generic.A}], async (a : any, b : any) => [[a], [b]], "Fork");
export const HW = new SubductFunction("hw", [], [{type: types.string}], async () => [["hello"], ["world"]], "HW");
export const StopIfEqual = new SubductFunction("stop-if-equal", [{type: types.Generic.A}, {type: types.Generic.A}], [], async (a : any, b : any) => {
    console.log('a', a, 'b', b, a == b)
    if (a == b) {
        return []
    }
    return [[]];
}, "Stop If Equal");
export const StopIfZero = new SubductFunction("stop-if-zero", [{type: types.int}], [], async (a : any) => {
    if (a === 0) {
        return []
    }
    return [[]];
}, "Stop If Zero");
export const StopIfTrue = new SubductFunction("stop-if-true", [{type: types.boolean}], [], async (a : any) => {
    if (a) {
        return []
    }
    return [[]];
}, "Stop If True");

async function *iterableToAsyncIterable(it : Iterable<any>) {
    for (let i of it) {
        yield i;
    }
}

export const Sort = new SubductFunction("sort", [{type: types.Stream()}], [{type: types.Stream()}], async (a : AsyncIterable<Array<any>>) => {
        let ret = [];
        console.log(a)
        for await (let i of a) {
            ret.push(i);
        }
        ret.sort((a, b) => a[a.length - 1] < b[b.length - 1] ? -1 : a[a.length - 1] >  b[b.length - 1] ? 1 : 0);
        return [[iterableToAsyncIterable(ret)]];
    }, "Sort",
    function sortGenerator(func : SubductFunction, modifiers : Array<any> = [], inputTypes : Array<types.Type> = []) : SubductFunction | undefined {
        //if (inputTypes.length != 1 || typeof inputTypes[0] != 'string' || !inputTypes[0].startsWith('stream<')) {
        if (inputTypes.length != 1 || !types.AnyStream.accepts(inputTypes[0])) {
            return undefined;
        }
        let ret = new SubductFunction(func.name, [{type: inputTypes[0]}], [{type: inputTypes[0]}], func.executor, func.label);
        return ret;
    }
);


export const EmitAll = new SubductFunction("emit-all",
    [{type: types.Stream()}],
    [{type: types.Generic.A}],
    async (a : AsyncIterable<Array<any>>) => {
        let ret = [];
        for await (let i of a) {
            ret.push(i);
        }
        return ret;
    },
    "Emit All",
    function emitAllGenerator(func : SubductFunction, modifiers : Array<any> = [], inputTypes : Array<any> = []) : SubductFunction | undefined {
        //if (inputTypes.length != 1 || typeof inputTypes[0] != 'string' || !inputTypes[0].startsWith('stream<')) {//} || inputTypes[0].indexOf(',') != -1) {
        if (inputTypes.length != 1 || !(inputTypes[0] instanceof types.ParametricType) || !inputTypes[0].accepts(inputTypes[0])) {
            return undefined;
        }
        //let outTypes = inputTypes[0].substring(7, inputTypes[0].length - 1).split(',');
        let ret = new SubductFunction(func.name, [{type: inputTypes[0]}], inputTypes[0].parameters.map(x => ({type: x})), func.executor, func.label);
        return ret;
    }
);

export const Reverse = new SubductFunction("reverse", [{type: types.Stream()}], [{type: types.Stream()}], async (a : AsyncIterable<Array<any>>) => {
    let ret = [];
    for await (let i of a) {
        ret.push(i);
    }
    ret.reverse();
    return [[iterableToAsyncIterable(ret)]];
}, "Reverse",
function reverseGenerator(func : SubductFunction, modifiers : Array<any> = [], inputTypes : Array<any> = []) : SubductFunction | undefined {
    //if (inputTypes.length != 1 || typeof inputTypes[0] != 'string' || !inputTypes[0].startsWith('stream<')) {
    if (inputTypes.length != 1 || !types.AnyStream.accepts(inputTypes[0])) {
        return undefined;
    }
    let ret = new SubductFunction(func.name, [{type: inputTypes[0]}], [{type: inputTypes[0]}], func.executor, func.label);
    return ret;
}
);

async function *zipAsyncIterables(a : AsyncIterable<Array<any>>, b : AsyncIterable<Array<any>>) {
    let aIt = a[Symbol.asyncIterator]();
    let bIt = b[Symbol.asyncIterator]();
    let aRes = await aIt.next();
    let bRes = await bIt.next();
    while (!aRes.done && !bRes.done) {
        yield [...aRes.value, ...bRes.value];
        aRes = await aIt.next();
        bRes = await bIt.next();
    }
}

export const Zip = new SubductFunction("zip", [{type: types.AnyStream}, {type: types.AnyStream}], [{type: types.AnyStream}], async (a : AsyncIterable<Array<any>>, b : AsyncIterable<Array<any>>) => {
    return [[zipAsyncIterables(a, b)]];
}, "Zip",
function zipGenerator(func : SubductFunction, modifiers : Array<any> = [], inputTypes : Array<any> = []) : SubductFunction | undefined {
    if (inputTypes.length != 2 || !types.AnyStream.accepts(inputTypes[0]) || !types.AnyStream.accepts(inputTypes[1])) {
        return undefined;
    }
    //let firstComponent = inputTypes[0].substring(7, inputTypes[0].length - 1);
    //let secondComponent = inputTypes[1].substring(7, inputTypes[1].length - 1);
    let firstStream = inputTypes[0] as types.ParametricType;
    let secondStream = inputTypes[1] as types.ParametricType;
    let ret = new SubductFunction(func.name, [{type: inputTypes[0]}, {type: inputTypes[1]}], [{type: types.Stream(...firstStream.parameters, ...secondStream.parameters)}], func.executor, func.label);
    return ret;
}
);

export const CountTo = new SubductFunction("count-to", [{type: types.int}], [{type: types.Stream(types.int)}], async (a : number) => {
    let ret = [];
    for (let i = 1; i <= a; i++) {
        ret.push([i]);
    }
    return [[iterableToAsyncIterable(ret)]];
}, "Count To");

export const Wikipedia : SubductFunction = new SubductFunction("wikipedia", [{type: types.string}], [{type: new types.RecordType([['title', types.string], ['extract', types.string], ['thumbnail', types.image]])}], async (a : string) => {
    if (Wikipedia_cache[a])
        return [[Wikipedia_cache[a]]];
    let f = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + a);
    let j = await f.json();
    let imf = await fetch(j.thumbnail.source);
    let im = await imf.blob();
    let imURL = URL.createObjectURL(im);
    let ret = {title: j.title, extract: j.extract, thumbnail: imURL};
    Wikipedia_cache[a] = ret;
    return [[ret]];
}, 'Wikipedia')
const Wikipedia_cache : {[key: string]: any} = {}

export const Now = new SubductFunction("now", [], [{type: types.timestamp}], async () => [[Date.now()]], "Now");


export const Drop = new SubductFunction("drop", [{type: types.Generic.A}], [], async (...a : any) => [[]], "Drop",
    function dropGenerator(func : SubductFunction, modifiers : Array<any> = []) : SubductFunction {
        let numItems = Number.parseInt(modifiers[0])
        if (Number.isNaN(numItems))
            numItems = 1;
        let gens = new Array<{ type : types.Type }>();
        for (let i = 1; i < numItems; i++) {
            gens.push({ type: types.Generic('P' + i) });
        }
        let ret = new SubductFunction(func.name + (numItems == 1 ? '' : ':' + numItems), [{type: types.Generic.A}, ...gens], [], func.executor, func.label);
        return ret;
    }
);
export const Delve = new SubductFunction("delve", [{type: types.Generic.A}], [], async (a : any, ...r : any[]) => [[...r, a]], "Delve",
    function delveGenerator(func : SubductFunction, modifiers : Array<any> = [], inputTypes : Array<any> = []) : SubductFunction | undefined {
        let numItems = Number.parseInt(modifiers[0])
        if (Number.isNaN(numItems) && inputTypes.length)
            numItems = inputTypes.length;
        if (Number.isNaN(numItems))
            numItems = 3;
        if (numItems < 3)
            return undefined;
        let gens = new Array<{ type : types.Type }>();
        for (let i = 1; i < numItems; i++) {
            gens.push({ type: types.Generic('P' + i) });
        }
        let ret = new SubductFunction(func.name + (numItems == 1 ? '' : ':' + numItems), [{type: types.Generic.A}, ...gens], [...gens, {type: types.Generic.A}], func.executor, func.label);
        return ret;
    });
export const Bury = new SubductFunction("bury", [{type: types.Generic.A}], [], async (...r : any[]) => [[r[r.length - 1], ...r.slice(0, -1)]], "Bury",
    function delveGenerator(func : SubductFunction, modifiers : Array<any> = [], inputTypes : Array<any> = []) : SubductFunction | undefined {
        let numItems = Number.parseInt(modifiers[0])
        if (Number.isNaN(numItems) && inputTypes.length)
            numItems = inputTypes.length;
        if (Number.isNaN(numItems))
            numItems = 3;
        if (numItems < 3)
            return undefined;
        let gens = new Array<{ type : types.Type }>();
        for (let i = 1; i < numItems; i++) {
            gens.push({ type: types.Generic('P' + i) });
        }
        let ret = new SubductFunction(func.name + (numItems == 1 ? '' : ':' + numItems), [...gens, {type: types.Generic.A}], [{type: types.Generic.A}, ...gens], func.executor, func.label);
        return ret;
    }
);

export const Exchange = new SubductFunction("exchange",
    [{type: types.Generic.A}],
    [],
    async (...r : any[]) => [[r[r.length - 1], ...r.slice(1, -1), r[0]]], "Exchange",
    function exchangeGenerator(func : SubductFunction, modifiers : Array<any> = [], inputTypes : Array<any> = []) : SubductFunction | undefined {
        let numItems = Number.parseInt(modifiers[0])
        if (Number.isNaN(numItems) && inputTypes.length)
            numItems = inputTypes.length;
        if (Number.isNaN(numItems))
            numItems = 3;
        if (numItems < 3)
            return undefined;
        let gens = new Array<{ type : types.Type }>();
        for (let i = 1; i < numItems - 1; i++) {
            gens.push({ type: types.Generic('P' + i) });
        }
        let ret = new SubductFunction(func.name + (numItems == 1 ? '' : ':' + numItems), [{ type: types.Generic.A }, ...gens, {type: types.Generic.B}], [{type: types.Generic.B}, ...gens, { type: types.Generic.A }], func.executor, func.label);
        return ret;
    }
);

export const Sobriquet = new SubductFunction("sobriquet", [{type: types.Generic.A}], [{type: types.Generic.A}], async (a : any) => [[a]], "Sobriquet",
    function sobriquetGenerator(func : SubductFunction, modifiers : Array<any> = [], inputTypes : Array<any> = []) : SubductFunction {
        let sobriquet = modifiers[0] ?? "label";
        let ret = new SubductFunction(func.name + ':' + sobriquet, [inputTypes[0] ? {type: inputTypes[0]} : {type: {generic: 'X'}}], [inputTypes[0] ? {type: inputTypes[0], label: sobriquet} : {type: {generic: 'X'}, label: sobriquet}], func.executor, '@' + sobriquet, func.generator,
            func.otherConfig);
        return ret;
    },
    {
        edit: {
            type: 'text',
            create: (s : string, inputTypes : Array<any>) => Sobriquet.generator!(Sobriquet, [s], inputTypes),
            pre: '@',
        }
    }
);

export const Splay = new SubductFunction("splay", [{type: new types.RecordType([])}], [{type: types.Generic.A}], async (a : any) => [[a]], "Splay",
    function splayGenerator(func : SubductFunction, modifiers : Array<any> = [], inputTypes : Array<any> = []) : SubductFunction | undefined {
        if (inputTypes.length != 1)
            return undefined;
        let rec = inputTypes[0].getAlternative('record') as types.RecordType | undefined;
        if (!rec)
            return undefined;
        let f = new SubductFunction(func.name,
            [{type: rec}],
            rec.fields.map(([label, type]) => ({label, type})),
            async (a : any) => [rec!.fields.map(([label, type]) => a[label])]);
        return f;
    }
);

export const StopIfOdd = new SubductFunction("stop-if-odd", [{type: types.int}], [], async (a : any) => {
    if (a % 2 == 1)
        return [];
    return [[]];
}, "Stop If Odd");

export const Identity = new SubductFunction(
    "id",
    [{type: types.Generic.A}],
    [{type: types.Generic.A}],
    async (a : any) => {
        return [[a]];
    },
    "Identity"
);


export const BuiltinFunctions = new FunctionSet();
BuiltinFunctions.addFunction(NumberLiteralFunction(123));
BuiltinFunctions.addFunction(StringLiteralFunction("string"));
BuiltinFunctions.addFunction(colours.ColourLiteralFunction());

function addFromObject(obj : any) {
    for (let func of Object.values(obj)) {
        if (func instanceof SubductFunction)
            BuiltinFunctions.addFunction(func);
    }
}
addFromObject(colours);
addFromObject(number);
addFromObject(boolean);
addFromObject(string);
addFromObject(image);

BuiltinFunctions.addFunction(Dup);
BuiltinFunctions.addFunction(Swap);
BuiltinFunctions.addFunction(Drop);
BuiltinFunctions.addFunction(Delve);
BuiltinFunctions.addFunction(Bury);
BuiltinFunctions.addFunction(Exchange);
BuiltinFunctions.addFunction(Sobriquet);
BuiltinFunctions.addFunction(StopIfOdd);
BuiltinFunctions.addFunction(Wikipedia);
//BuiltinFunctions.addFunction(Fork);
//BuiltinFunctions.addFunction(HW);
BuiltinFunctions.addFunction(StopIfEqual);
BuiltinFunctions.addFunction(StopIfZero);
BuiltinFunctions.addFunction(StopIfTrue);
BuiltinFunctions.addFunction(Now);
BuiltinFunctions.addFunction(Sort);
BuiltinFunctions.addFunction(CountTo);
BuiltinFunctions.addFunction(Reverse);
BuiltinFunctions.addFunction(Zip);
BuiltinFunctions.addFunction(EmitAll);
BuiltinFunctions.addFunction(Splay);
BuiltinFunctions.addFunction(Identity);

//BuiltinFunctions.addFunction(new SubductFunction('rrr', [{type: new types.RecordType([['r', types.int]])}], [{type: types.int}], async (a : any) => {
//    return [[a.r]];
//}))