import SubductFunction from "../functions/SubductFunction.js";
import GraphConnection from "./connections.js";
import LayerGraph, { EvaluationContext } from "./layergraph.js";
import GraphNode, { ArgumentNode, WaypointNode } from "./node.js";
import * as types from '../functions/types.js';

export default class FunctionNode extends GraphNode {
    func : SubductFunction
    inputPorts : Array<FunctionInputPort> = new Array<FunctionInputPort>();
    outputPorts : Array<FunctionOutputPort | ArgumentOutputPort> = new Array<FunctionOutputPort>();
    constructor(graph : LayerGraph, func : SubductFunction) {
        super(graph);
        this.func = func
        this.label = func.label;
    }

    async evaluate(context : EvaluationContext) {
        let args : Array<any> = []
        for (let port of this.inputPorts) {
            if (port.connections.length > 0) {
                if (port.connections[0].source)
                    args.push(context.getOutput(port.connections[0].source));
                else {
                    console.log("no source in " + this.func.label, port.connections[0])
                    return undefined
                }
            } else {
                console.log("no connection")
                return undefined
            }
        }
        let rv = await this.func.executor(...args);
        return rv;
    }

    removeExtend() {
        let inputConnections = [];
        for (let ip of this.inputPorts) {
            inputConnections.push(ip.connections[0])
        }
        let outputConnections = [];
        for (let op of this.outputPorts) {
            if (op.connections[0])
                outputConnections.push(op.connections[0])
            else {
                for (let rp of this.graph.resultPorts) {
                    if (rp.port?.parentNode === this) {
                        outputConnections.push(rp.connection);
                        break;
                    }
                }
            }
        }
        let splices = new Array<{start: number, length: number}>();
        splices.push({start: this.graph.layers[this.layer].indexOf(this), length: 1});
        if (outputConnections[0]) {
            for (let wp of outputConnections[0].via) {
                splices.push({start: this.graph.layers[wp.layer].indexOf(wp), length: outputConnections.length});
            }
        }

        // Now, splice out all of those and replace with new waypoints
        // (one for each input connection) in each layer
        //console.log("Disconnecting all input connections")
        for (let ic of inputConnections) {
            ic.destination = undefined;
        }
        //this.graph.describe();
        //console.log("Before splicing at all")
        //this.graph.describe();
        for (let i = 0; i < splices.length; i++) {
            let splice = splices[i];
            let newWaypoints = new Array<WaypointNode>();
            //console.log("splicing layer", this.layer + i, "(+", i, ") at", splice.start, "length", splice.length)
            for (let j = 0; j < inputConnections.length; j++) {
                let wp = new WaypointNode(this.graph, inputConnections[j]);
                wp.layer = this.layer + i;
                inputConnections[j].via.push(wp);
                newWaypoints.push(wp);
            }
            this.graph.layers[this.layer + i].splice(splice.start, splice.length, ...newWaypoints);
            //this.graph.describe();
        }
        for (let i = 0; i < this.graph.resultPorts.length; i++) {
            let rp = this.graph.resultPorts[i];
            if (rp.port?.parentNode === this) {
                this.graph.resultPorts.splice(i, this.outputPorts.length, ...inputConnections.map(c => { return { port: c.source!, connection: c } }));
                break;
            }
        }
    }

    remove(extend=false) {
        let waypointIndices = new Array<number>();
        if (extend) {
            for (let o of this.outputPorts) {
                for (let i = 0; i < this.layer; i++) {
                    waypointIndices.push(-1);
                }
                waypointIndices.push(this.graph.layers[this.layer].indexOf(this))
                if (o.connections.length > 0) {
                    for (let wp of o.connections[0].via) {
                        waypointIndices.push(this.graph.layers[wp.layer].indexOf(wp));
                    }
                    break;
                }
            }
            for (let rp of this.graph.resultPorts) {
                if (rp.port?.parentNode === this) {
                    waypointIndices.push(this.graph.resultPorts.indexOf(rp));
                    break;
                }
            }
        }
        for (let port of this.inputPorts.reverse()) {
            for (let connection of port.connections) {
                if (extend) {
                    connection.destination = undefined;
                    for (let i = this.layer; i < this.graph.layers.length; i++) {
                        let wp = new WaypointNode(this.graph, connection);
                        wp.layer = i;
                        connection.via.push(wp);
                        this.graph.layers[i].splice(waypointIndices[i], 0, wp);
                    }
                    this.graph.resultPorts.splice(waypointIndices[waypointIndices.length - 1], 0, { port : connection.source!, connection : connection })
                } else {
                    connection.disconnect();
                    for (let wp of connection.via) {
                        let layer = this.graph.layers[wp.layer];
                        let io = layer.indexOf(wp);
                        if (io == -1) debugger
                        layer.splice(io, 1);
                    }
                }
            }
        }
        for (let port of this.outputPorts) {
            for (let connection of port.connections) {
                connection.disconnect();
            }
        }
        for (let rp of this.graph.resultPorts) {
            if (rp.port?.parentNode === this) {
                for (let wp of rp.connection.via) {
                    let layer = this.graph.layers[wp.layer];
                    let io = layer.indexOf(wp)
                    if (io == -1) debugger
                    layer.splice(io, 1);
                }
            }
        }
        this.graph.resultPorts = this.graph.resultPorts.filter(rp => rp.port?.parentNode !== this);
        let myIdx = this.graph.layers[this.layer].indexOf(this);
        if (myIdx == -1) debugger
        this.graph.layers[this.layer].splice(myIdx, 1);
    }

    recheckInputPorts() {
        while (this.func.inputs.length > this.inputPorts.length) {
            let input = this.func.inputs[this.inputPorts.length];
            this.inputPorts.push(new FunctionInputPort(this, input.label ?? "", input.type));
        }
        while (this.func.inputs.length < this.inputPorts.length) {
            this.inputPorts.pop();
        }
        for (let i = 0; i < this.inputPorts.length; i++) {
            this.inputPorts[i].label = this.func.inputs[i].label ?? "";
            this.inputPorts[i].type = this.func.inputs[i].type;
        }
    }

    recheckOutputPorts() {
        while (this.func.outputs.length > this.outputPorts.length) {
            let output = this.func.outputs[this.outputPorts.length];
            this.outputPorts.push(new FunctionOutputPort(this, output.label ?? "", output.type));
        }
        while (this.func.outputs.length < this.outputPorts.length) {
            this.outputPorts.pop();
        }
        let genericInputLabels = new Map<string, string>();
        if (this.func.baseFunction) {
            let iSet = new Set<string>();
            for (let [idx, ip] of this.func.baseFunction.inputs.entries()) {
                if (ip.type && typeof ip.type === "object" && ip.type instanceof types.GenericType) {
                    if (!iSet.has(ip.type.generic) && this.inputPorts[idx].connections[0]?.source?.label)
                        genericInputLabels.set(ip.type.generic, this.inputPorts[idx].connections[0]?.source?.label ?? '');
                    else
                        genericInputLabels.delete(ip.type.generic);
                    iSet.add(ip.type.generic);
                }
            }
            for (let op of this.func.baseFunction.outputs) {
                if (op.type && typeof op.type === "object" && op.type instanceof types.GenericType) {
                    
                }
            }
        }
        for (let i = 0; i < this.outputPorts.length; i++) {
            if (this.func.outputs[i].label) {
                this.outputPorts[i].label = this.func.outputs[i].label!;
            } else if (this.func.baseFunction) {
                let opi = this.func.baseFunction.outputs[i];
                if (opi.type && typeof opi.type === "object" && opi.type instanceof types.GenericType) {
                    this.outputPorts[i].label = genericInputLabels.get(opi.type.generic) ?? "";
                } else {
                    this.outputPorts[i].label = "";
                }
            } else {
                this.outputPorts[i].label = this.func.outputs[i].label ?? "";
            }
            this.outputPorts[i].type = this.func.outputs[i].type;
        }
    }

    become(func : SubductFunction) {
        console.log("becoming", func.label, func)
        this.func = func;
        this.label = func.label;
        this.recheckInputPorts();
        this.recheckOutputPorts();
    }
}

export class FunctionInputPort {
    functionNode : FunctionNode
    label : string
    type : types.Type
    connections : Array<GraphConnection> = new Array<GraphConnection>();
    constructor(funcNode : FunctionNode, label : string, type : types.Type) {
        this.functionNode = funcNode;
        this.label = label;
        this.type = type;
    }

    connect(port : FunctionOutputPort, via? : Array<WaypointNode>) {
        let connection = new GraphConnection();
        connection.source = port;
        connection.destination = this;
        if (this.connections.length > 0) {
            this.connections[0].disconnect()
        }
        let prev : GraphNode = port.parentNode;
        if (via !== undefined) {
            for (let waypoint of via) {
                connection.via.push(waypoint);
                prev = waypoint;
                waypoint.connections[0] = connection;
            }
        } else {
            for (let waypointLayer = port.parentNode.layer + 1; waypointLayer < this.functionNode.layer; waypointLayer++) {
                let waypoint = new WaypointNode(this.functionNode.graph);
                this.functionNode.graph.addNode(waypoint, waypointLayer, prev);
                connection.via.push(waypoint);
                prev = waypoint;
            }
        }
        this.connections.push(connection);
        port.connections.push(connection);
    }
}

export class FunctionOutputPort {
    parentNode : FunctionNode
    label : string
    type : types.Type
    connections : Array<GraphConnection> = new Array<GraphConnection>();
    constructor(funcNode : FunctionNode, label : string, type : types.Type) {
        this.parentNode = funcNode;
        this.label = label;
        this.type = type;
    }

}

export class ArgumentOutputPort  {
    parentNode : ArgumentNode
    label : string
    type : types.Type
    connections : Array<GraphConnection> = new Array<GraphConnection>();
    constructor(label : string, type : types.Type, parentNode : ArgumentNode) {
        this.label = label
        this.type = type
        this.parentNode = parentNode
    }
}

export function nodeForFunction(graph : LayerGraph, func : SubductFunction) : FunctionNode {
    let node = new FunctionNode(graph, func);
    for (let input of func.inputs) {
        node.inputPorts.push(new FunctionInputPort(node, input.label ?? "", input.type));
    }
    for (let output of func.outputs) {
        node.outputPorts.push(new FunctionOutputPort(node, output.label ?? "", output.type));
    }
    return node;
}