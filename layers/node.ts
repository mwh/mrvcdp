import GraphConnection from "./connections.js";
import { ArgumentOutputPort, FunctionOutputPort } from "./functionnode.js";
import LayerGraph from "./layergraph.js";
import * as types from '../functions/types.js';

export default class GraphNode {
    connections : Array<GraphConnection> = new Array<GraphConnection>();
    graph : LayerGraph
    layer : number = 0;
    constructor(graph : LayerGraph) {
        this.graph = graph;
    }

    accessor label : string = "";
}

export class WaypointNode extends GraphNode {
    constructor(graph : LayerGraph, gc? : GraphConnection) {
        super(graph);
        if (gc) {
            this.connections.push(gc);
        }
    }
}

export class ArgumentNode extends GraphNode {
    type: types.Type | { generic: string; };
    index : number
    port : ArgumentOutputPort

    constructor(graph : LayerGraph, label : string, type : types.Type, index : number, gc? : GraphConnection) {
        super(graph);
        let port = new ArgumentOutputPort(label, type, this);
        this.type = port.type;
        this.index = index;
        this.label = port.label;
        this.port = port;
        if (gc) {
            this.connections.push(gc);
        }
    }

    get outputPorts() : Array<FunctionOutputPort | ArgumentOutputPort> {
        return [this.port];
    }
}