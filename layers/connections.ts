import { FunctionOutputPort, FunctionInputPort, ArgumentOutputPort } from "./functionnode.js";
import GraphNode, { WaypointNode } from "./node.js";

export default class GraphConnection {
    source? : FunctionOutputPort | ArgumentOutputPort
    destination? : FunctionInputPort
    via : Array<WaypointNode> = new Array<WaypointNode>();
    pushLater = 0;
    
    constructor(source? : FunctionOutputPort | ArgumentOutputPort, destination? : FunctionInputPort) {
        this.source = source;
        this.destination = destination;
    }

    disconnect() {
        if (this.source) {
            let index = this.source.connections.indexOf(this);
            if (index > -1) {
                this.source.connections.splice(index, 1);
            }
        }
        if (this.destination) {
            let index = this.destination.connections.indexOf(this);
            if (index > -1) {
                this.destination.connections.splice(index, 1);
            }
        }
        this.source = undefined;
        this.destination = undefined;
        for (let node of this.via) {
            let index = node.connections.indexOf(this);
            if (index > -1) {
                node.connections.splice(index, 1);
            }
        }
    }
}