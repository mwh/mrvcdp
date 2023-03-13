import { FunctionSet, StopEvaluation } from "../functions/function.js";
import SubductFunction from "../functions/SubductFunction.js";
import GraphConnection from "./connections.js";
import FunctionNode, { ArgumentOutputPort, FunctionInputPort, FunctionOutputPort, nodeForFunction } from "./functionnode.js";
import GraphNode, { ArgumentNode, WaypointNode } from "./node.js";

export default class LayerGraph {
    layers : Array<Array<GraphNode>> = new Array<Array<GraphNode>>();
    arguments = new Array<ArgumentOutputPort>();
    functions : FunctionSet = new FunctionSet();
    resultPorts = new Array<{port: FunctionOutputPort | ArgumentOutputPort, connection: GraphConnection}>();

    constructor(functions? : FunctionSet) {
        if (functions) {
            this.functions = functions;
        }
    }

    setArguments(args : Array<ArgumentOutputPort>) {
        this.arguments = Array.from(args);
        for (let [i, arg] of args.entries()) {
            let argNode = arg.parentNode;
            if (this.getLayer(0).indexOf(argNode) == -1)
                this.getLayer(0).push(argNode);
        }
    }

    replaceNode(node : GraphNode, replacement : GraphNode) {
        let layer = this.getLayer(node.layer);
        let idx = layer.indexOf(node);
        layer[idx] = replacement;
    }

    getLayer(index : number) : Array<GraphNode> {
        while (index >= this.layers.length) {
            this.layers.push(new Array<GraphNode>());
        }
        return this.layers[index];
    }

    propagateWaypoints() {
        let prevLayer = this.getLayer(this.layers.length - 1);
        let newLayer = this.getLayer(this.layers.length);
        for (let node of prevLayer) {
            if (node instanceof FunctionNode) {
                for (let op of node.outputPorts) {
                    for (let conn of op.connections) {
                        let waypoint = new WaypointNode(this);
                        waypoint.layer = this.layers.length - 1;
                        waypoint.connections.push(conn);
                        newLayer.push(waypoint);
                        conn.via.push(waypoint);
                    }
                }
            } else if (node instanceof WaypointNode) {
                let conn = node.connections[0];
                let waypoint = new WaypointNode(this);
                waypoint.layer = this.layers.length - 1;
                waypoint.connections.push(conn);
                newLayer.push(waypoint);
                conn.via.push(waypoint);
            } else if (node instanceof ArgumentNode) {
                let conn = new GraphConnection(node.port);
                let waypoint = new WaypointNode(this);
                waypoint.layer = this.layers.length - 1;
                waypoint.connections.push(conn);
                newLayer.push(waypoint);
                conn.via.push(waypoint);
                node.port.connections.push(conn);
            }
        }
    }

    addNode(node : GraphNode, layer : number, position : number | GraphNode = -1) {
        let layerArray = this.getLayer(layer);
        if (position == -1) {
            layerArray.push(node);
        } else if (position instanceof GraphNode) {
            let relLayer = this.getLayer(position.layer)
            let idx = relLayer.indexOf(position);
            let upperBound = layerArray.length;
            let lowerBound = 0
            outer: for (let i = idx + 1; i < relLayer.length; i++) {
                let otherNode = relLayer[i];
                if (otherNode instanceof FunctionNode) {
                    for (let op of otherNode.outputPorts) {
                        for (let conn of op.connections) {
                            if (conn.via.length > 0) {
                                upperBound = Math.min(upperBound, layerArray.indexOf(conn.via[0]));
                                break outer;
                            } else {
                                upperBound = Math.min(upperBound, layerArray.indexOf(conn.destination!.functionNode));
                                break outer;
                            }
                        }
                    }
                } else {
                    let conn = otherNode.connections[0];
                    if (!conn)
                        continue
                    let widx = conn.via.indexOf(otherNode)
                    if (widx < conn.via.length - 1) {
                        upperBound = Math.min(upperBound, layerArray.indexOf(conn.via[widx + 1]));
                    } else {
                        upperBound = Math.min(upperBound, layerArray.indexOf(conn.destination!.functionNode));
                    }
                    break outer;
                }
            }
            outer: for (let i = idx - 1; i >= 0; i--) {
                let otherNode = relLayer[i];
                if (otherNode instanceof FunctionNode) {
                    for (let ip of otherNode.inputPorts) {
                        for (let conn of ip.connections) {
                            if (conn.via.length > 0) {
                                lowerBound = Math.max(lowerBound, layerArray.indexOf(conn.via[conn.via.length - 1]) + 1);
                                break outer;
                            } else {
                                lowerBound = Math.max(lowerBound, layerArray.indexOf(conn.source!.parentNode) + 1);
                                break outer;
                            }
                        }
                    }
                } else {
                    let conn = otherNode.connections[0];
                    if (!conn)
                        continue
                    let widx = conn.via.indexOf(otherNode)
                    if (widx > 0) {
                        lowerBound = Math.max(lowerBound, layerArray.indexOf(conn.via[widx - 1]) + 1);
                    } else {
                        lowerBound = Math.max(lowerBound, layerArray.indexOf(conn.source!.parentNode) + 1);
                    }
                    break outer;
                }
            }
            let pos = Math.floor((upperBound + lowerBound + 1) / 2);
            layerArray.splice(pos, 0, node);
        } else {
            layerArray.splice(position, 0, node);
        }
        node.layer = layer;
        return node
    }

    nodeForFunction(func : SubductFunction) : FunctionNode {
        return nodeForFunction(this, func)
    }

    nodeMap = new Map<GraphNode, number>();
    _nodeNum = 1;
    describe() {
        let nodeNum = 1
        let nodeMap = this.nodeMap;//new Map<GraphNode, number>();
        let output = "";
        for (let i = 0; i < this.layers.length; i++) {
            for (let node of this.layers[i]) {
                if (!nodeMap.has(node))
                    nodeMap.set(node, this._nodeNum++);
            }
        }
        for (let i = 0; i < this.layers.length; i++) {
            output += "Layer " + i + ":\n";
            for (let node of this.layers[i]) {
                output += "    "
                if (node instanceof FunctionNode) {
                    output += node.func.label + " #" + nodeMap.get(node) + " in layer " + node.layer + "\n";
                    for (let input of node.inputPorts) {
                        if (input.connections.length > 0) {
                            let source = input.connections[0].source!
                            output += "        " + input.label + " <- "
                            if (source.label) {
                                output += source.label + " of "
                            } else if (source.parentNode.outputPorts.length == 1) {
                                output += ""
                            } else {
                                let pos = source.parentNode.outputPorts.indexOf(source as any)
                                output += "output " + pos + " of "
                            }
                            if (source.parentNode instanceof FunctionNode)
                                output += source.parentNode.func.label;
                            output += " #" + nodeMap.get(source.parentNode);
                            if (input.connections[0].via.length > 0) {
                                output += " via "
                                output += input.connections[0].via.map((waypoint) => "waypoint #" + nodeMap.get(waypoint)).join(", ")
                            }
                            output += "\n";
                        } else {
                            output += "        " + input.label + " <- (nothing)\n"
                        }
                    }
                    for (let outPort of node.outputPorts) {
                        if (outPort.connections.length > 0) {
                            output += "        " + outPort.label + " -> "
                            for (let connection of outPort.connections) {
                                let dest = connection.destination
                                if (dest === undefined) {
                                    output += "(nowhere)"
                                } else {
                                    if (dest.label) {
                                        output += dest.label + " of "
                                    } else if (dest.functionNode.inputPorts.length == 1) {
                                        output += ""
                                    } else {
                                        let pos = dest.functionNode.inputPorts.indexOf(dest)
                                        output += "input " + pos + " of "
                                    }
                                    output += dest.functionNode.func.label + " #" + nodeMap.get(dest.functionNode);
                                }
                                if (connection.via.length > 0) {
                                    output += " via "
                                    output += connection.via.map((waypoint) => "waypoint #" + nodeMap.get(waypoint)).join(", ")
                                }
                                output += "\n";
                            }
                        }
                    }
                } else {
                    output += node.constructor.name + " #" + nodeMap.get(node) + " in layer " + node.layer + ' ('  + ('from ' + node.connections[0]?.source?.parentNode.label + ' via ' + node.connections[0]?.via.map(x => '#' + nodeMap.get(x)).join(', ')) + ')' + "\n";
                }
            }
            output += "\n";
        }
        output += "Returning:\n";
        for (let rp of this.resultPorts) {
            let source = rp.port!;
            output += "    ";
            if (source.label) {
                output += source.label + " of "
            } else if (source.parentNode.outputPorts.length == 1) {
                output += ""
            } else {
                let pos = source.parentNode.outputPorts.indexOf(source as any)
                output += "output " + pos + " of "
            }
            if (source.parentNode instanceof FunctionNode)
                output += source.parentNode.func.label;
            output += " #" + nodeMap.get(source.parentNode);
            if (rp.connection.via.length > 0) {
                output += " via "
                output += rp.connection.via.map((waypoint) => "waypoint #" + nodeMap.get(waypoint)).join(", ")
            }
            output += "\n";
        }
        console.log(output)
    }

    async evaluate(args? : Array<any>) : Promise<EvaluationContext> {
        let outputMap = new Map<FunctionOutputPort | ArgumentOutputPort, any>();
        let evaluationContext = {
            getOutput: (port : FunctionOutputPort | ArgumentOutputPort) => {
                if (outputMap.has(port)) {
                    return outputMap.get(port);
                } else {
                    return null;
                }
            },
            returnValues: undefined as Array<any> | undefined,
            stopped : false
        }
        if (args) {
            console.log("evaluating with args", ...args)
            for (let i = 0; i < this.arguments.length; i++) {
                outputMap.set(this.arguments[i], args[i]);
            }
        } else if (this.arguments.length > 0) {
            return evaluationContext;
        }
        console.log("Evaluating - param length" + this.arguments.length + " - args provided", args)
        for (let layer of this.layers) {
            let funcs = layer.filter((node) => node instanceof FunctionNode).map((node) => node as FunctionNode);
            let promises = funcs.map((node) => node.evaluate(evaluationContext));
            try {
                let results = await Promise.all(promises)
                for (let i = 0; i < funcs.length; i++) {
                    for (let j = 0; j < funcs[i].outputPorts.length; j++) {
                        outputMap.set(funcs[i].outputPorts[j], results[i][j]);
                    }
                }
            } catch (e) {
                if (e instanceof StopEvaluation) {
                    evaluationContext.stopped = true;
                    return evaluationContext;
                } else {
                    throw e;
                }
            }
        }
        let returnValues = new Array<any>();
        for (let r of this.resultPorts) {
            if (!r.connection)
                return evaluationContext;
            if (!r.connection.source)
                return evaluationContext;
            let rv = outputMap.get(r.connection.source);
            if (rv === undefined)
                return evaluationContext;
            returnValues.push(rv);
        }
        evaluationContext.returnValues = returnValues;
        return evaluationContext;
    }

    async evaluateLayer(layerIdx : number, ctx : EvaluationContext, outputMap : Map<FunctionOutputPort | ArgumentOutputPort, any>) {
        if (layerIdx >= this.layers.length) {
            //console.log("reached return point at", layerIdx)
            let rvs = [];
            for (let r of this.resultPorts) {
                if (!r.connection)
                    return;
                if (!r.connection.source)
                    return;
                let rv = outputMap.get(r.connection.source);
                if (rv === undefined)
                    return;
                rvs.push(rv);
            }
            //console.log('returning', rvs)
            ctx.returnValues?.push(rvs);
            return;
        }
        let layer = this.getLayer(layerIdx);
        let funcs = layer.filter((node) => node instanceof FunctionNode && node.func.label !== '???').map((node) => node as FunctionNode);
        let promises = funcs.map((node) => node.evaluate(ctx));
        let results = await Promise.all(promises);
        //console.log('results', results)
        let hmm = everyCombination(results);
        //console.log('layer', layerIdx, Array.from(hmm));
        for (let res of hmm) {
            //console.log('res', res, 'fl', funcs.length)
            for (let i = 0; i < funcs.length; i++) {
                //console.log(funcs[i].label, res[i])
                for (let j = 0; j < funcs[i].outputPorts.length; j++) {
                    outputMap.set(funcs[i].outputPorts[j], res[i][j]);
                }
            }
            await this.evaluateLayer(layerIdx + 1, ctx, outputMap);
        }
        //console.log("end layer", layerIdx, ctx.returnValues)
    }

    async evaluate2(args? : Array<any>) : Promise<EvaluationContext> {
        console.log("-------- evaluate2 ---------")
        let outputMap = new Map<FunctionOutputPort | ArgumentOutputPort, any>();
        let evaluationContext = {
            getOutput: (port : FunctionOutputPort | ArgumentOutputPort) => {
                if (outputMap.has(port)) {
                    return outputMap.get(port);
                } else {
                    return null;
                }
            },
            returnValues: [],
            stopped : false
        }
        if (args) {
            for (let i = 0; i < this.arguments.length; i++) {
                outputMap.set(this.arguments[i], args[i]);
            }
        }
        await this.evaluateLayer(0, evaluationContext, outputMap);
        console.log('return values', evaluationContext.returnValues)
        return evaluationContext;
    }

    async *evaluateStream(stream : AsyncIterable<Array<any>>) : AsyncGenerator<Array<any>> {
        for await (let args of stream) {
            let r = await this.evaluate2(args);
            let a = r.returnValues!;
            if (r.returnValues !== undefined)
                // this cast is for TypeScript to accept using
                // an iterable here as the generator protocol is
                // slightly different.
                yield *<any>a;
        }
    }

    can2D() : boolean {
        let stack = new Array<FunctionOutputPort | ArgumentOutputPort>();
        for (let layer of this.layers) {
            for (let node of layer) {
                if (node instanceof FunctionNode) {
                    for (let port of node.inputPorts) {
                        if (port.connections.length != 1)
                            return false;
                        let origin = stack.shift();
                        if (origin !== port.connections[0].source)
                            return false;
                    }
                    for (let port of node.outputPorts) {
                        if (port.connections.length > 1)
                            return false;
                        let rp = this.resultPorts.find((p) => p.connection?.source == port);
                        let dest = port.connections[0]?.destination;
                        if (!rp && !dest)
                            return false;
                        stack.push(port);
                    }
                } else if (node instanceof ArgumentNode) {
                    stack.push(node.port);
                } else if (node instanceof WaypointNode) {
                    let origin = stack.shift()!;
                    if (origin !== node.connections[0].source)
                        return false;
                    stack.push(origin);
                }
            }
        }
        
        return true;
    }

    isLinear(skip2d=false) : boolean {
        if (!skip2d && !this.can2D())
            return false;
        let stack = new Array<Boolean>();
        for (let i = 0; i < this.layers[0].length; i++) {
            if (this.layers[0][i] instanceof ArgumentNode) {
                if (this.layers[0][i + 1] instanceof ArgumentNode)
                    stack.push(false);
                else
                    stack.push(true);
            } else if (this.layers[0][i] instanceof FunctionNode) {
                let fn = this.layers[0][i] as FunctionNode;
                for (let i = 0; i < fn.inputPorts.length - 1; i++)
                    stack.push(false);
                stack.push(true);
            }
        }
        for (let layer of this.layers.slice(1)) {
            console.log('checking next layer', layer)
            for (let node of layer) {
                console.log('checking node', node.label, Array.from(stack))
                if (node instanceof FunctionNode) {
                    let args = stack.splice(0, node.inputPorts.length)
                    let last = args.pop();
                    if (!last)
                        return false;
                    if (node.outputPorts.length) {
                        for (let i = 0; i < node.outputPorts.length - 1; i++)
                            stack.push(false);
                        stack.push(true);
                    } else {
                        // After a drop, turn the last output OK
                        stack.pop();
                        stack.push(true);
                    }
                    console.log("stack now", Array.from(stack))
                } else if (node instanceof WaypointNode) {
                    stack.push(stack.shift()!);
                }
            }
        }
        return true;
    }
}

function* everyCombination(arr : Array<Array<any>>, acc : Array<Array<any>>=[]) : Generator<Array<Array<any>>> {
    let first = arr[0];
    if (first) {
        for (let i = 0; i < first.length; i++) {
            yield* everyCombination(arr.slice(1), acc.concat([first[i]]));
        }
    } else {
	    yield acc;
    }
}

export type EvaluationContext = {
    getOutput: (port : FunctionOutputPort | ArgumentOutputPort) => any,
    returnValues : Array<any> | undefined
    get stopped() : boolean,
}