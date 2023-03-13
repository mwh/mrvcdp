import LayerGraph from "./layers/layergraph.js";
import * as functions from "./functions/function.js";
import FunctionNode from "./layers/functionnode.js";

//let gridData = {"functions":[{"name":"main","body":{"rows":[[{"name":"int literal","uses":[],"produces":[{"family":"primitive","name":"int"}],"value":5},{"name":"int literal","uses":[],"produces":[{"family":"primitive","name":"int"}],"value":3},{"name":"int literal","uses":[],"produces":[{"family":"primitive","name":"int"}],"value":2}],[{"uses":[{"family":"primitive","name":"int"}],"produces":[{"family":"primitive","name":"int"}]},{"uses":[{"family":"primitive","name":"int"}],"produces":[{"family":"primitive","name":"int"}]},{"name":"dup","uses":[{"family":"primitive","name":"int"}],"produces":[{"family":"primitive","name":"int"},{"family":"primitive","name":"int"}]}],[{"uses":[{"family":"primitive","name":"int"}],"produces":[{"family":"primitive","name":"int"}]},{"uses":[{"family":"primitive","name":"int"}],"produces":[{"family":"primitive","name":"int"}]},{"name":"mul","uses":[{"family":"primitive","sobriquet":"multiplicand","name":"int"},{"family":"primitive","sobriquet":"multiplier","name":"int"}],"produces":[{"family":"primitive","sobriquet":"product","name":"int"}]}],[{"uses":[{"family":"primitive","name":"int"}],"produces":[{"family":"primitive","name":"int"}]},{"name":"add","uses":[{"family":"primitive","sobriquet":"augend","name":"int"},{"family":"primitive","sobriquet":"addend","name":"int"}],"produces":[{"family":"primitive","sobriquet":"sum","name":"int"}]}],[{"name":"sub","uses":[{"family":"primitive","sobriquet":"minuend","name":"int"},{"family":"primitive","sobriquet":"subtrahend","name":"int"}],"produces":[{"family":"primitive","sobriquet":"difference","name":"int"}]}]],"inputTypes":[],"produces":[{"family":"primitive","sobriquet":"difference","name":"int"}]},"lifting":"none","uses":[],"produces":[{"family":"primitive","sobriquet":"difference","name":"int"}]}]}
let gridData = {"functions":[{"name":"main","body":{"rows":[[{"name":"int literal","uses":[],"produces":[{"family":"primitive","name":"int"}],"value":5},{"name":"int literal","uses":[],"produces":[{"family":"primitive","name":"int"}],"value":3},{"name":"int literal","uses":[],"produces":[{"family":"primitive","name":"int"}],"value":2}],[{"uses":[{"family":"primitive","name":"int"}],"produces":[{"family":"primitive","name":"int"}]},{"uses":[{"family":"primitive","name":"int"}],"produces":[{"family":"primitive","name":"int"}]},{"name":"dup","uses":[{"family":"primitive","name":"int"}],"produces":[{"family":"primitive","name":"int"},{"family":"primitive","name":"int"}]}],[{"uses":[{"family":"primitive","name":"int"}],"produces":[{"family":"primitive","name":"int"}]},{"uses":[{"family":"primitive","name":"int"}],"produces":[{"family":"primitive","name":"int"}]},{"name":"mul","uses":[{"family":"primitive","sobriquet":"multiplicand","name":"int"},{"family":"primitive","sobriquet":"multiplier","name":"int"}],"produces":[{"family":"primitive","sobriquet":"product","name":"int"}]}],[{"name":"dup","uses":[{"family":"primitive","name":"int"}],"produces":[{"family":"primitive","name":"int"},{"family":"primitive","name":"int"}]},{"name":"add","uses":[{"family":"primitive","sobriquet":"augend","name":"int"},{"family":"primitive","sobriquet":"addend","name":"int"}],"produces":[{"family":"primitive","sobriquet":"sum","name":"int"}]}],[{"name":"add","uses":[{"family":"primitive","sobriquet":"augend","name":"int"},{"family":"primitive","sobriquet":"addend","name":"int"}],"produces":[{"family":"primitive","sobriquet":"sum","name":"int"}]},{"uses":[{"family":"primitive","sobriquet":"sum","name":"int"}],"produces":[{"family":"primitive","sobriquet":"sum","name":"int"}]}],[{"name":"sub","uses":[{"family":"primitive","sobriquet":"minuend","name":"int"},{"family":"primitive","sobriquet":"subtrahend","name":"int"}],"produces":[{"family":"primitive","sobriquet":"difference","name":"int"}]}]],"inputTypes":[],"produces":[{"family":"primitive","sobriquet":"difference","name":"int"}]},"lifting":"none","uses":[],"produces":[{"family":"primitive","sobriquet":"difference","name":"int"}]}]}

export let graph = new LayerGraph(functions.BuiltinFunctions);

// function nodeForFunction(name : string) {
//     let func = (<any>functions.conversions)[name];
//     console.log(name, func)
//     return graph.nodeForFunction(func);
// }

// type FuncEntry = {name?: string, value? : any, uses: Array<any>, produces: Array<any>}
// let nodeMap = new Map<FuncEntry, FunctionNode>();
// let body : {rows: Array<Array<FuncEntry>>} = gridData.functions[0].body;
// let layer = 0
// for (let row of body.rows) {
//     for (let cell of row) {
//         if (cell.name == 'int literal') {
//             let node = graph.nodeForFunction(functions.NumberLiteralFunction(cell.value));
//             graph.addNode(node, layer);
//             nodeMap.set(cell, node);
//         } else if (cell.name) {
//             let node = nodeForFunction(cell.name);
//             graph.addNode(node, layer);
//             nodeMap.set(cell, node);
//         }
//     }
//     layer++;
// }

// let stack : Array<any> = [];
// for (let row of body.rows) {
//     for (let cell of row) {
//         if (!nodeMap.has(cell)) {
//             let item = stack.shift();
//             stack.push(item);
//             continue;
//         }
//         let node = nodeMap.get(cell);
//         for (let i = 0; i < cell.uses.length; i++) {
//             let item = stack.shift();
//             node?.inputPorts[i].connect(item);
//         }
//         for (let i = 0; i < cell.produces.length; i++) {
//             stack.push(node?.outputPorts[i]);
//         }
//     }
// }

// graph.describe()