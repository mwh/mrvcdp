import LayerGraph from "../layers/layergraph.js";
import * as functions from "../functions/function.js";
import GraphNode, { ArgumentNode, WaypointNode } from "../layers/node.js";
import FunctionNode, { ArgumentOutputPort, FunctionOutputPort } from "../layers/functionnode.js";
import GraphConnection from "../layers/connections.js";
import * as types from '../functions/types.js';

type Token =
    | { type: "int", value: number, start: number, end: number }
    | { type: "float", value: number, start: number, end: number }
    | { type: "identifier", value: string, start: number, end: number }
    | { type: "string", value: string, start: number, end: number }
    | { type: "modifier", value: string, start: number, end: number }
    | { type: "comment", value: string, arity: number, start: number, end: number }
    | { type: "left-brace", start: number, end: number }
    | { type: "right-brace", start: number, end: number }
    | { type: "double-colon", start: number, end: number }
    | { type: "arrow", start: number, end: number }

type ParseOperation =
    | { location: { start: number, end: number, token: Token }, type: "call", name: string, modifiers: Array<any> }
    | { location: { start: number, end: number, token: Token }, type: "int literal", value: number }
    | { location: { start: number, end: number, token: Token }, type: "float literal", value: number }
    | { location: { start: number, end: number, token: Token }, type: "string literal", value: string }
    | { location: { start: number, end: number, token: Token }, type: "comment", value: string, arity: number }
    | { location: { start: number, end: number, token: Token }, type: "quote", value: Array<ParseOperation> }
    | { location: { start: number, end: number, token: Token }, type: "argument-type-list", value: Array<ParseOperation> }

function isIdentifierStart(c : string) {
    return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c == '_' || c == '.'
}

function isIdentifierPart(c : string) {
    return isIdentifierStart(c) || c >= '0' && c <= '9' || c == '-'
}

function tokenise(code : string) : Token[] {
    let ret = new Array<Token>();
    let cps = Array.from(code)
    let i = 0
    let mode = ''
    while (i < cps.length) {
        let c = cps[i]
        if (mode == '' && isIdentifierStart(c)) {
            let start = i
            while (i < cps.length && isIdentifierPart(cps[i])) {
                i++
            }
            ret.push({ type: "identifier", value: cps.slice(start, i).join(''), start: start, end: i })
        } else if (mode == '' && c >= '0' && c <= '9') {
            let start = i
            while (i < cps.length && cps[i] >= '0' && cps[i] <= '9') {
                i++
            }
            if (cps[i] == '.') {
                i++
                while (i < cps.length && cps[i] >= '0' && cps[i] <= '9') {
                    i++
                }
                ret.push({ type: "float", value: parseFloat(cps.slice(start, i).join('')), start: start, end: i })
            } else {
                ret.push({ type: "int", value: parseInt(cps.slice(start, i).join('')), start: start, end: i })
            }
        } else if (mode == '' && c == '"') {
            //console.log("parsing string")
            let escaped = false
            let stringChars = new Array<string>()
            let start = i
            i++
            while (i < cps.length && (cps[i] != '"' || escaped)) {
                if (cps[i] == '\\' && !escaped) {
                    escaped = true
                } else {
                    escaped = false
                }
                if (!escaped)
                    stringChars.push(cps[i])
                i++
                //console.log(i, stringChars, cps[i], escaped)
            }
            ret.push({ type: "string", value: stringChars.join(''), start, end: i })
            i++
        } else if (mode == '' && c == ':') {
            let start = i++
            while (i < cps.length && cps[i] != ' ' && isIdentifierPart(cps[i])) {
                i++
            }
            if (cps[i] == ':') {
                ret.push({ type: "double-colon", start: start, end: ++i })
            } else {
                ret.push({ type: "modifier", value: cps.slice(start + 1, i).join(''), start: start, end: i })
            }
        } else if (mode == '' && c == '(') {
            let start = i++
            let arity = 1
            while (i < cps.length && cps[i] == '(') {
                i++
                arity++
            }
            while (i < cps.length && cps[i] != ')') {
                i++
            }
            let endArity = arity
            while (i < cps.length && cps[i] == ')' && endArity) {
                i++
                endArity--
            }
            if (endArity != 0) {
                throw new Error("Mismatched parentheses")
            }
            ret.push({ type: "comment", value: cps.slice(start + arity, i - arity).join(''), arity: arity,
                start, end: i })
        } else if (mode == '' && c == '{') {
            ret.push({ type: "left-brace", start: i, end: i + 1 })
            i++
        } else if (mode == '' && c == '}') {
            ret.push({ type: "right-brace", start: i, end: i + 1 })
            i++
        } else if (mode == '' && c == ' ') {
            i++
        } else {
            throw new Error("Unexpected character: " + c)
        }
    }
    return ret
}

export function parse(code : string) {
    let tokens = tokenise(code)
    console.log('tokens', Array.from(tokens))
    let parseResult : Array<ParseOperation> = []
    return parseUntil(tokens, "")
}

function parseUntil(tokens : Token[], end : string) : Array<ParseOperation> {
    let ret = new Array<ParseOperation>()
    while (tokens.length && tokens[0].type != end) {
        let token = tokens.shift()!
        if (token.type == "identifier") {
            let modifiers = new Array<any>()
            while (tokens.length && tokens[0].type == "modifier") {
                let modifier = tokens.shift()! as { type: "modifier", value: string }
                modifiers.push(modifier.value)
            }
            ret.push({ location: { start: token.start, end: token.end, token }, type: "call", name: token.value, modifiers: modifiers })
        } else if (token.type == "string") {
            ret.push({ location: { start: token.start, end: token.end, token }, type: "string literal", value: token.value })
        } else if (token.type == "int") {
            ret.push({ location: { start: token.start, end: token.end, token }, type: "int literal", value: token.value })
        } else if (token.type == "float") {
            ret.push({ location: { start: token.start, end: token.end, token }, type: "float literal", value: token.value })
        } else if (token.type == "comment") {
            ret.push({ location: { start: token.start, end: token.end, token }, type: "comment", value: token.value, arity: token.arity })
        } else if (token.type == "left-brace") {
            ret.push({ location: { start: token.start, end: token.end, token }, type: "quote", value: parseUntil(tokens, "right-brace") })
        } else if (token.type == "double-colon") {
            ret = [{ location: { start: token.start, end: token.end, token }, type: "argument-type-list", value: ret }];
        } else {
            throw new Error("Unexpected token: " + token.type)
        }
    }
    return ret
}

// function projectLayer(graph : LayerGraph, layerIdx : number) {
//     let layer = graph.getLayer(layerIdx)
//     if (layerIdx == 1)
//         return layer;
//     let prevLayer = graph.getLayer(layerIdx - 1)
//     if (layer.length == 0) {
//         //console.log("Projecting to layer", layerIdx, "using", prevLayer)
//         for (let node of prevLayer) {
//             let newWP = new WaypointNode(graph, node.connections[0])
//             node.connections[0].via.push(newWP)
//             newWP.layer = layerIdx
//             layer.push(newWP)
//         }
//     }
//     return layer
// }

// function setUpOutputs(graph : LayerGraph, destLayer : number, funcNode : FunctionNode, stack : Array<{type: types.Type | { generic: string }, layer: number, node: GraphNode, port: FunctionOutputPort | ArgumentOutputPort, waypoints: Array<WaypointNode>}>) {
//     let func = funcNode.func
//     let nextLayer = graph.getLayer(destLayer + 1);
//     let outs : Array<GraphNode | FunctionOutputPort> = nextLayer.flatMap(x => x instanceof FunctionNode ? x.outputPorts : <any> [x]);
//     // why is the stack the comparison here? it has nothing to do with the next layer
//     // e.g. when adding a layer-0 function the stack can have many items, but
//     // layer 1 may have only a single item producing them all
//     // 1 dup dup colour:c020a0 tests
//     if (outs.length < stack.length) {
//         console.log("Casting forward to layer", destLayer + 1, "for", funcNode.func.label, "using stack", Array.from(stack), "nextLayer", Array.from(nextLayer))
//         for (let st of stack.slice(nextLayer.length)) {
//             let wp = st.waypoints[st.waypoints.length - 1]
//             let newWP = new WaypointNode(graph, wp.connections[0])
//             newWP.layer = destLayer + 1
//             wp.connections[0].via.push(newWP)
//             st.waypoints.push(newWP)
//             nextLayer.push(newWP)
//             console.log("Added a waypoint for", wp.connections[0].source?.parentNode.label, "via", Array.from(wp.connections[0].via))
//         }
//     }
//     for (let i = 0; i < func.outputs.length; i++) {
//         let output = func.outputs[i]
//         let outputPort = funcNode.outputPorts[i]
//         let conn = new GraphConnection(outputPort);
//         let wp = new WaypointNode(graph, conn);
//         wp.layer = destLayer + 1;
//         conn.via.push(wp);
//         nextLayer.push(wp);
//         outputPort.connections.push(conn)
//         stack.push({ type: output.type, layer: funcNode.layer, node: funcNode, port: outputPort, waypoints: [wp] })
//     }
// }

export function toGraph(parseResult : Array<ParseOperation>, destGraph? : LayerGraph) : LayerGraph {
    let graph = destGraph ?? new LayerGraph(functions.BuiltinFunctions);
    // If updating existing graph, clear it
    graph.layers = [];
    graph.resultPorts = [];
    let stack = new Array<GraphConnection>();
    let nodes = [];
    if (parseResult.length && parseResult[0].type == "argument-type-list") {
        let atl = parseResult.shift() as { type: "argument-type-list", value: Array<ParseOperation> };
        let argIdx = 0;
        let argPorts = new Array<ArgumentOutputPort>();
        for (let arg of atl.value) {
            let type = types.int;
            if (arg.type == 'call') {
                switch (arg.name) {
                    case "int": type = types.int; break;
                    case "float": type = types.float; break;
                    case "boolean": type = types.boolean; break;
                    case "colour": type = types.colour; break;
                    case "string": type = types.string; break;
                    case "timestamp": type = types.timestamp; break;
                }
                let label = '';
                if (arg.modifiers.length) {
                    label = arg.modifiers[0].value;
                }
                let argNode = new ArgumentNode(graph, label, type, argIdx);
                argNode.layer = 0;
                nodes.push(argNode);
                let conn = new GraphConnection(argNode.port);
                argNode.port.connections.push(conn);
                stack.push(conn);
                argPorts.push(argNode.port);
            } else {
                throw new Error('Invalid type element ' + JSON.stringify(arg));
            }
        }
        graph.setArguments(argPorts);
    }
    for (let op of parseResult) {
        if (op.type == 'call') {
            let args = stack.map(x => x.source?.type);
            let func;
            func = graph.functions.getFunction(op.name, args, op.modifiers);
            while (!func && args.length) {
                args.shift();
                func = graph.functions.getFunction(op.name, args, op.modifiers);
            }
            if (!func) {
                throw new Error("No function found for " + op.name + " at " + op.location.start + " with " + stack.map(x => x.source?.type.toString()).join(',') )// + " with args " + args);
            }
            let funcNode = graph.nodeForFunction(func);
            for (let input of Array.from(funcNode.inputPorts).reverse()) {
                let conn = stack.pop()!;
                input.connections.push(conn);
                conn.destination = input;
            }
            for (let output of funcNode.outputPorts) {
                let conn = new GraphConnection(output);
                funcNode.connections.push(conn);
                output.connections.push(conn);
                stack.push(conn);
            }
            if (funcNode.outputPorts.length == 0) {
                for (let conn of stack) {
                    conn.pushLater++;
                }
            }
            if (funcNode.inputPorts.length == 0) {
                funcNode.layer = 0;
            } else {
                funcNode.layer = Math.max(...funcNode.inputPorts.map(x => x.connections[0].source!.parentNode.layer + x.connections[0].pushLater)) + 1;
            }
            nodes.push(funcNode);
            // Create waypoints within connection
            for (let input of funcNode.inputPorts) {
                let conn = input.connections[0];
                for (let i = conn.source!.parentNode.layer + 1; i < funcNode.layer; i++) {
                    let wp = new WaypointNode(graph, conn);
                    wp.layer = i;
                    conn.via.push(wp);
                }
            }
        } else if (op.type == 'int literal' || op.type == 'string literal' || op.type == 'float literal') {
            let f;
            if (op.type == 'int literal')
                f = graph.nodeForFunction(functions.NumberLiteralFunction(op.value));
            else if (op.type == 'string literal')
                f = graph.nodeForFunction(functions.StringLiteralFunction(op.value));
            else if (op.type == 'float literal')
                f = graph.nodeForFunction(functions.FloatLiteralFunction(op.value));
            else
                throw "this can't happen but typescript doesn't know that";
            let conn = new GraphConnection(f.outputPorts[0]);
            f.connections.push(conn);
            f.outputPorts[0].connections.push(conn);
            stack.push(conn);
            nodes.push(f);
        }
    }

    // Simple broken layer setup
    let layers = new Array<Array<GraphNode>>();
    for (let i = 0; i <= Math.max(...nodes.map(x => x.layer)) + 1; i++)
        layers.push([]);
    // Add result ports, and waypoints to them
    for (let conn of stack) {
        for (let i = conn.source!.parentNode.layer + 1; i < layers.length; i++) {
            let wp = new WaypointNode(graph, conn);
            wp.layer = i;
            conn.via.push(wp);
        }
        graph.resultPorts.push({ port: conn.source!, connection: conn })
    }
    // Add nodes to layers
    for (let node of nodes) {
        layers[node.layer].push(node);
        // Add any waypoints to later layers
        for (let output of node.outputPorts) {
            for (let conn of output.connections) {
                if (conn.via.length) {
                    for (let wp of conn.via) {
                        layers[wp.layer].push(wp);
                    }
                }
            }
        }
    }
    graph.layers = layers;
    graph.describe();
    return graph;
}

// export function toGraph2(parseResult : Array<ParseOperation>, destGraph? : LayerGraph) {
//     //console.log("==== START OF TOGRAPH")
//     if (destGraph) {
//         destGraph.layers = [];
//         destGraph.resultPorts = [];
//     }
//     let graph = destGraph ?? new LayerGraph(functions.BuiltinFunctions)
//     let stack = new Array<{type: types.Type | { generic: string }, layer: number, node: GraphNode, port: FunctionOutputPort | ArgumentOutputPort, waypoints: Array<WaypointNode>}>()
//     console.log(parseResult[0])
//     if (parseResult.length && parseResult[0].type == "argument-type-list") {
//         let atl = parseResult.shift() as { type: "argument-type-list", value: Array<ParseOperation> };
//         let argIdx = 0;
//         let argPorts = new Array<ArgumentOutputPort>();
//         for (let arg of atl.value) {
//             if (arg.type == "call") {
//                 let type = types.int;
//                 switch (arg.name) {
//                     case "int": type = types.int; break;
//                     case "float": type = types.float; break;
//                     case "boolean": type = types.boolean; break;
//                     case "colour": type = types.colour; break;
//                     case "string": type = types.string; break;
//                     case "timestamp": type = types.timestamp; break;
//                 }
//                 let argNode = new ArgumentNode(graph, arg.modifiers.length ? arg.modifiers[0] : '', type, argIdx);
//                 let argPort = argNode.port;
//                 graph.getLayer(0).push(argNode);
//                 let conn = new GraphConnection(argPort);
//                 let wp = new WaypointNode(graph, conn);
//                 wp.layer = 1;
//                 graph.getLayer(1).push(wp);
//                 argPort.connections.push(conn);
//                 conn.via.push(wp);
//                 stack.push({ type: type, layer: 0, node: argNode, port: argPort, waypoints: [wp] })
//                 argPorts.push(argPort);
//             } else {
//                 throw "Invalid argument type list";
//             }
//             argIdx++;
//         }
//         graph.setArguments(argPorts);
//     }
//     for (let i = 0; i < parseResult.length; i++) {
//         let op = parseResult[i]
//         if (op.type == "call") {
//             let bestLayer = 0;
//             let func;
//             let args = stack;
//             for (let argCount = 0; argCount <= stack.length; argCount++) {
//                 args = stack.slice(stack.length - argCount);
//                 func = graph.functions.getFunction(op.name, args.map(x => x.type), op.modifiers);
//                 console.log('flll', op.name, func, args.map(x => x.type))
//                 if (func) {
//                     stack.splice(stack.length - argCount);
//                     break
//                 }
//             }
//             if (!func) {
//                 throw new Error("No function found for " + op.name + " with arguments " + stack.map(x => x.type));
//             }
//             let funcNode = graph.nodeForFunction(func) as FunctionNode;

//             console.log("Handling", funcNode.label, "with args", args);
//             graph.describe();
//             console.log("Still handling", funcNode.label, "with args", args);
//             if (args.length) {
//                 let waypoints = args.map(x => x.waypoints[x.waypoints.length - 1]);
//                 let destLayer = Math.max(...waypoints.map(x => x.layer));
//                 let destLayerNodes = graph.getLayer(destLayer);
//                 for (let i = 0; i < waypoints.length; i++) {
//                     let wp = waypoints[i]
//                     let arg = args[i]
//                     let conn = wp.connections[0]
//                     while (wp.layer != destLayer) {
//                         let nextLayer = wp.layer + 1
//                         wp = new WaypointNode(graph, conn)
//                         wp.layer = nextLayer
//                         conn.via.push(wp)
//                         arg.waypoints.push(wp)
//                         graph.getLayer(nextLayer).push(wp)
//                         console.log("Added a waypoint for", wp.connections[0].source?.parentNode.label, "via", Array.from(wp.connections[0].via))
//                     }
//                 }
//                 waypoints = args.map(x => x.waypoints[x.waypoints.length - 1]);
//                 let startIndex = destLayerNodes.indexOf(waypoints[0]);
//                 let endIndex = destLayerNodes.indexOf(waypoints[waypoints.length - 1]);
//                 //if (startIndex == -1) debugger
//                 //console.log("Splicing out for", funcNode.label, "waypoints", waypoints, "from", startIndex, "to", endIndex, "of", Array.from(destLayerNodes));
//                 destLayerNodes.splice(startIndex, endIndex - startIndex + 1, funcNode);
//                 funcNode.layer = destLayer;
//                 // Remove replaced waypoints
//                 for (let wp of waypoints) {
//                     wp.connections[0].via.splice(wp.connections[0].via.length - 1)
//                 }
//                 // Connect all inputs to their connections
//                 for (let i = 0; i < args.length; i++) {
//                     let arg = args[i]
//                     let input = funcNode.inputPorts[i]
//                     let conn = arg.port.connections[0]
//                     conn.destination = input
//                     input.connections.push(conn)
//                 }
//                 setUpOutputs(graph, destLayer, funcNode, stack)
//                 console.log("done handling", funcNode.label, "with args", args)
//             } else {
//                 graph.getLayer(0).push(funcNode);
//                 /*for (let op of funcNode.outputPorts) {
//                     let conn = new GraphConnection(op);
//                     for (let i = 1; i < graph.layers.length; i++) {
//                         let wp = new WaypointNode(graph, conn)
//                         wp.layer = i;
//                         op.connections.push(conn);
//                         conn.via.push(wp);
//                         graph.layers[i].push(wp);
//                     }
//                 }*/
//                 setUpOutputs(graph, 0, funcNode, stack)
//             }

            
//             //graph.addNode(funcNode, destLayer)
//             //setUpOutputs(graph, destLayer, funcNode, stack)
//         } else if (op.type == "int literal") {
//             console.log("handling int literal", op.value)
//             let node = graph.addNode(graph.nodeForFunction(functions.NumberLiteralFunction(op.value)), 0) as FunctionNode
//             //setUpOutputs(graph, 0, node, stack)
//             if (graph.layers.length == 1)
//                 graph.layers.push([]);
//             let conn = new GraphConnection(node.outputPorts[0]);
//             for (let i = 1; i < graph.layers.length; i++) {
//                 let wp = new WaypointNode(graph, conn)
//                 wp.layer = i;
//                 conn.via.push(wp);
//                 graph.getLayer(i).push(wp);
//             }
//             node.outputPorts[0].connections.push(conn);
//             stack.push({ type: types.int, layer: node.layer, node, port: node.outputPorts[0], waypoints: Array.from(conn.via) })
//         } else if (op.type == "float literal") {
//             console.log("handling float literal", op.value)
//             let node = graph.addNode(graph.nodeForFunction(functions.FloatLiteralFunction(op.value)), 0) as FunctionNode
//             //setUpOutputs(graph, 0, node, stack)
//             if (graph.layers.length == 1)
//                 graph.layers.push([]);
//             let conn = new GraphConnection(node.outputPorts[0]);
//             for (let i = 1; i < graph.layers.length; i++) {
//                 let wp = new WaypointNode(graph, conn)
//                 wp.layer = i;
//                 conn.via.push(wp);
//                 graph.getLayer(i).push(wp);
//             }
//             node.outputPorts[0].connections.push(conn);
//             stack.push({ type: types.float, layer: node.layer, node, port: node.outputPorts[0], waypoints: Array.from(conn.via) })
//         } else if (op.type == "string literal") {
//             let node = graph.addNode(graph.nodeForFunction(functions.StringLiteralFunction(op.value)), 0) as FunctionNode
//             //setUpOutputs(graph, 0, node, stack)
//             if (graph.layers.length == 1)
//             graph.layers.push([]);
//             let conn = new GraphConnection(node.outputPorts[0]);
//             for (let i = 1; i < graph.layers.length; i++) {
//                 let wp = new WaypointNode(graph, conn)
//                 wp.layer = i;
//                 conn.via.push(wp);
//                 graph.getLayer(i).push(wp);
//             }
//             node.outputPorts[0].connections.push(conn);
//             stack.push({ type: types.string, layer: node.layer, node, port: node.outputPorts[0], waypoints: Array.from(conn.via) })
//         }
//         graph.describe();
//     }
//     for (let layer of graph.layers) {
//         for (let node of layer) {
//             if (node instanceof FunctionNode) {
//                 node.recheckInputPorts();
//                 node.recheckOutputPorts();
//             }
//         }
//     }
//     let lastLayer = graph.layers.length - 1
//     for (let st of stack) {
//         let lastWP = st.waypoints[st.waypoints.length - 1]
//         //console.log("Cleanup: item from " + st.port.functionNode.label, "last waypoint layer", lastWP.layer);
//         while (lastWP.layer < lastLayer) {
//             let nextLayer = lastWP.layer + 1
//             let wp = new WaypointNode(graph, lastWP.connections[0])
//             wp.layer = nextLayer;
//             lastWP.connections[0].via.push(wp);
//             st.waypoints.push(wp);
//             graph.getLayer(nextLayer).push(wp);
//             //console.log("Added a waypoint for", wp.connections[0].source?.functionNode.label, "via", Array.from(wp.connections[0].via))
//             lastWP = wp
//         }
//     }
//     for (let st of stack) {
//         graph.resultPorts.push({ port: st.port, connection: st.waypoints[st.waypoints.length - 1].connections[0] });
//     }
//     //console.log("==== END OF TOGRAPH")
//     return graph
// }

// export function toGraph2(parseResult : Array<ParseOperation>) {
//     let graph = new LayerGraph(functions.BuiltinFunctions)
//     let stack = new Array<{type: string | { generic: string }, layer: number, node: GraphNode, port: FunctionOutputPort, waypoints: Array<WaypointNode>}>()
//     for (let i = 0; i < parseResult.length; i++) {
//         let op = parseResult[i]
//         if (op.type == "call") {
//             let bestLayer = 0
//             let func
//             let args = stack
//             for (let argCount = 0; argCount <= stack.length; argCount++) {
//                 args = stack.slice(stack.length - argCount)
//                 //console.log('checking with args', args)
//                 func = graph.functions.getFunction(op.name, args.map(x => x.type), op.modifiers)
//                 if (func) {
//                     stack.splice(stack.length - argCount)
//                     bestLayer = Math.max(...args.map(x => x.layer)) + 1
//                     break
//                 }
//             }
//             if (!func) {
//                 throw new Error("No function found for " + op.name + " with arguments " + stack.map(x => x.type))
//             }
//             // start trying to fix
//             //console.log('found function', op.name, 'stack below', stack, 'best layer', bestLayer, 'args', args)
//             for (let sti of stack) {
//                 //console.log('below item layer', sti.layer, 'best layer', bestLayer)
//                 if (sti.layer < bestLayer) {
//                     let found = false
//                     for (let waypoint of sti.waypoints) {
//                         if (waypoint.layer == bestLayer) {
//                             found = true
//                             break
//                         }
//                     }
//                     if (!found) {
//                         //console.log('adding waypoint for ', sti, 'on layer', bestLayer)
//                         let waypoint = graph.addNode(new WaypointNode(graph), bestLayer) as WaypointNode
//                         sti.waypoints.push(waypoint)
//                     }
//                 }
//             }
//             for (let arg of args) {
//                 let coveredLayer = Math.max(arg.layer, ...arg.waypoints.map(x => x.layer))
//                 for (let a = coveredLayer + 1; a <= bestLayer - 1; a++) {
//                     if (arg.waypoints.length && arg.waypoints[arg.waypoints.length - 1].layer >= a)
//                         continue
//                     let waypoint = graph.addNode(new WaypointNode(graph), a) as WaypointNode
//                     arg.waypoints.push(waypoint)
//                     //console.log('just added waypoint', waypoint, 'to', arg, 'on layer', a, 'in range', coveredLayer, bestLayer)
//                 }
//                 for (let waypoint of arg.waypoints) {
//                     if (waypoint.layer >= bestLayer) {
//                         bestLayer = waypoint.layer + 1
//                     }
//                 }
//             }
//             let node = graph.addNode(graph.nodeForFunction(func), bestLayer) as FunctionNode
//             for (let i = 0; i < func.outputs.length; i++) {
//                 let output = func.outputs[i]
//                 let outputPort = node.outputPorts[i]
//                 stack.push({ type: output.type, layer: node.layer, node, port: outputPort, waypoints: [] })
//             }
//             for (let i = 0; i < args.length; i++) {
//                 let arg = args[i]
//                 let inputPort = node.inputPorts[i]
//                 inputPort.connect(arg.port, arg.waypoints)
//             }
//         } else if (op.type == "int literal") {
//             let node = graph.addNode(graph.nodeForFunction(functions.NumberLiteralFunction(op.value)), 0) as FunctionNode
//             stack.push({ type: "int", layer: node.layer, node, port: node.outputPorts[0], waypoints: [] })
//         } else if (op.type == "string literal") {
//             let node = graph.addNode(graph.nodeForFunction(functions.StringLiteralFunction(op.value)), 0) as FunctionNode
//             stack.push({ type: "string", layer: node.layer, node, port: node.outputPorts[0], waypoints: [] })
//         }
//     }
//     return graph
// }