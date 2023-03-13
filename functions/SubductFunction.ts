import { FunctionInput, FunctionOutput } from './function';


export default class SubductFunction {
    name: string;
    label: string;
    inputs: Array<FunctionInput>;
    outputs: Array<FunctionOutput>;
    executor: Function;
    baseFunction?: SubductFunction;
    generator?: Function;
    otherConfig: { [key: string]: any; } = {};

    constructor(name: string, inputs: Array<FunctionInput> = [], outputs: Array<FunctionOutput> = [], executor: Function, label?: string, generator?: Function, otherConfig?: { [key: string]: any; }) {
        this.name = name;
        this.label = label ?? name;
        this.inputs = Array.from(inputs);
        this.outputs = Array.from(outputs);
        this.executor = executor;
        this.generator = generator;
        if (otherConfig) {
            Object.assign(this.otherConfig, otherConfig);
        }
    }

    instantiateGenerics(genericMap: Map<string, any>) {
        let inputs = this.inputs.map((input) => {
            if ((<any>input.type).generic) {
                let g = (<any>input.type).generic;
                if (genericMap.has(g)) {
                    return { label: input.label, type: genericMap.get(g) };
                }
            }
            return input;
        });
        let outputs = this.outputs.map((output) => {
            if ((<any>output.type).generic) {
                let g = (<any>output.type).generic;
                if (genericMap.has(g)) {
                    return { label: output.label, type: genericMap.get(g) };
                }
            }
            return output;
        });
        let ret = new SubductFunction(this.name, inputs, outputs, this.executor, this.label, this.generator, this.otherConfig);
        ret.baseFunction = this;
        return ret;
    }
}
