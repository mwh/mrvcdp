import SubductFunction from "../functions/SubductFunction.js";
import { graph } from "../gridconverter.js";
import GraphConnection from "../layers/connections.js";
import FunctionNode, { ArgumentOutputPort, FunctionOutputPort } from "../layers/functionnode.js";
import LayerGraph from "../layers/layergraph.js";
import GraphNode, { ArgumentNode, WaypointNode } from "../layers/node.js";

import * as geometry from "./geometry.js";
import * as types from '../functions/types.js';

type NodeData = {
    x : number,
    y : number,
    width : number,
    height : number,
    outputs : Array<PortData>,
    inputs: Array<PortData>,
    earlierOutputs : number,
}

type PortData = {
    height : number,
    y : number
}


export type RenderResult = {
    valueContainers: Map<FunctionOutputPort | ArgumentOutputPort, Array<Element>>,
    functionRenderGroups: Map<FunctionNode, SVGGElement>,
    outputRenderGroups: Map<FunctionOutputPort | ArgumentOutputPort, SVGGElement>
}

const colours = {
    baseSaturation: 71,
    baseLightness: 72,
    baseHue: 197,
    hues: [] as Array<number>,
    colours: ['hsl(26, 79%, 41%)', 'hsl(8, 100%, 55%)', 'hsl(45, 100%, 61%)', 'hsl(144, 87%, 28%)', 'hsl(343, 98%, 76%)', 'hsl(208, 7%, 64%)', 'hsl(326, 74%, 35%)', 'hsl(227, 9%, 19%)', 'hsl(221, 88%, 32%)', 'hsl(197, 86%, 47%)', 'hsl(164, 50%, 67%)', /*liz too close to pic 'hsl(240, 39%, 47%)',*/ 'hsl(23, 100%, 58%)', 'hsl(98, 51%, 52%)'] as Array<string>,
    next: 0,
}

const baseNodeWidth = 150

export default class GraphRenderer {
    graph: LayerGraph;
    svg: any;
    nodeData = new Map<GraphNode, NodeData>();
    connectionColours = new Map<GraphConnection, string>();
    connectionLookup = new Map<GraphConnection, SVGPathElement>();
    connectionGroup: SVGGElement;
    resultLookup = new Map<GraphConnection, { path?: SVGPathElement, group : SVGGElement, x : number, y : number }>();
    colourIndex : number = 0;
    laidOut : boolean = false;
    width : number = 0;
    layerX : Array<number> = [];
    _renderListeners : Array<(r : RenderResult, nf? : {node: FunctionNode}) => void> = [];
    _resultPortX : number = 0;
    
    constructor(graph : LayerGraph, svg : SVGElement) {
        this.graph = graph;
        this.svg = svg;
        let connectionGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        svg.appendChild(connectionGroup);
        this.connectionGroup = connectionGroup;
    }

    addRenderListener(listener : (r : RenderResult) => void) {
        this._renderListeners.push(listener);
    }

    clear() {
        this.svg.innerHTML = "";
        this.connectionGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svg.appendChild(this.connectionGroup);
    }

    layOut() {
        const functionWeight = 1
        const waypointWeight = 1
        const argumentWeight = 1
        let numLayers = this.graph.layers.length;
        let nodeWidthTotal = baseNodeWidth * numLayers;
        const vertSpace = Math.min(window.innerHeight, this.svg.height.baseVal.value)
        const spacing = 100
        let minWidth = (nodeWidthTotal + spacing * (numLayers + 1)) // window.innerWidth * 3000;
        if (minWidth > this.svg.parentNode.getBoundingClientRect().width) {
            this.svg.style.width = (minWidth * 1) + 'px'
            this.width = minWidth;
        } else {
            this.svg.style.width = this.svg.parentNode.getBoundingClientRect().width + 'px';
            if (minWidth > this.svg.parentNode.getBoundingClientRect().width * 0.8)
                this.width = this.svg.parentNode.getBoundingClientRect().width;
            else
                this.width = this.svg.parentNode.getBoundingClientRect().width * 0.8;
        }
         //minWidth / numLayers //(this.svg.width.baseVal.value - nodeWidthTotal) / numLayers;
        let layerSpacing = baseNodeWidth + spacing //this.svg.width.baseVal.value / (numLayers + 0);
        let leftEdge = spacing / 2
        for (let layer = 0; layer < numLayers; layer++) {
            let nodes = this.graph.layers[layer];
            let shares = 0
            for (let note of nodes) {
                if (note instanceof FunctionNode) {
                    shares += functionWeight
                } else if (note instanceof WaypointNode) {
                    shares += waypointWeight
                } else if (note instanceof ArgumentNode) {
                    shares += argumentWeight;
                }
            }
            let verticalSize = vertSpace / shares
            let areaCounter = 0
            let earlierOutputs = 0
            for (let node of nodes) {
                let nd : NodeData = {x: leftEdge, y: 0, width: baseNodeWidth, height: 0, outputs: [], inputs: [], earlierOutputs}
                nd.height = this.calculateNodeHeight(node, nd);
                this.nodeData.set(node, nd);
                if (node instanceof FunctionNode) {
                    nd.y = areaCounter * verticalSize + (functionWeight * verticalSize - nd.height) / 2
                    // Try to avoid very tiny wiggles when source/dest are close
                    // Adjusts the y position of the node slightly for the first input port
                    // whose source Y coordinate is within the input port's Y coordinate range,
                    // shifting the node up or down slightly. No further inputs are examined.
                    for (let ind of node.inputPorts) {
                        if (ind.connections.length) {
                            let conn = ind.connections[0]
                            let prevY
                            if (!conn.via.length) {
                                let startPort = conn.source!
                                let startNodeData = this.nodeData.get(startPort.parentNode)!;
                                let startPortData = startNodeData.outputs[startPort.parentNode.outputPorts.indexOf(startPort)];
                                //console.log(startNodeData);
                                prevY = startNodeData.y + startPortData.y + startPortData.height / 2
                            } else {
                                let prev = conn.via[conn.via.length - 1]
                                let prevNodeData = this.nodeData.get(prev)!
                                prevY = prevNodeData.y + prevNodeData.height / 2
                            }
                            let inputPortData = nd.inputs[node.inputPorts.indexOf(ind)]
                            let inputY = nd.y + inputPortData.y// + inputPortData.height / 2
                            if (prevY >= inputY && prevY <= inputY + inputPortData.height) {
                                nd.y -= prevY - inputY
                                break
                            }
                        }
                    }
                    for (let opd of node.outputPorts) {
                        earlierOutputs++
                    }
                    areaCounter += functionWeight
                } else if (node instanceof WaypointNode) {
                    nd.y = areaCounter * verticalSize + (waypointWeight * verticalSize - nd.height) / 2
                    nd.y = nd.y + 45
                    nd.x = leftEdge + baseNodeWidth / 2
                    if (node.connections && node.connections[0]) {
                        let idx = node.connections[0].via.indexOf(node);
                        if (idx == 0) {
                            let source = node.connections[0].source!;
                            let sourceFuncData = this.nodeData.get(source.parentNode!)!
                            let idx = source.parentNode.outputPorts.indexOf(source)
                            let sourcePort = sourceFuncData.outputs[idx]
                            let sourceY = sourceFuncData.y + sourcePort.y + sourcePort.height / 2
                            if (sourceY > areaCounter * verticalSize && sourceY < (areaCounter + waypointWeight) * verticalSize) {
                                nd.y = sourceY
                            }
                        } else {
                            let prevWP = node.connections[0].via[idx - 1];
                            let prevY = this.nodeData.get(prevWP)!.y
                            if (prevY > areaCounter * verticalSize && prevY < (areaCounter + waypointWeight) * verticalSize) {
                                nd.y = prevY
                            }
                        }
                    }
                    areaCounter += waypointWeight
                } else if (node instanceof ArgumentNode) {
                    nd.y = areaCounter * verticalSize + (argumentWeight * verticalSize - nd.height) / 2
                    //console.log(nd.y, areaCounter, verticalSize, argumentWeight, nd.height)
                    areaCounter += argumentWeight
                    //console.log("for argumentnode", nd);
                }
            }
            this.layerX[layer] = leftEdge + baseNodeWidth / 2;
            leftEdge += layerSpacing;
        }
        this._resultPortX = this.width - 145;
        this.laidOut = true;
    }

    render(clear = true, newFunction? : {node : FunctionNode}): RenderResult {
        if (!this.laidOut) {
            this.layOut();
        }
        if (clear)
            this.clear();
        let valueRendererMap = new Map<FunctionOutputPort | ArgumentOutputPort, Array<Element>>();
        let numLayers = this.graph.layers.length;
        let functionRenderGroups = new Map<FunctionNode, SVGGElement>();
        let outputRenderGroups = new Map<FunctionOutputPort | ArgumentOutputPort, SVGGElement>();
        for (let layer = 0; layer < numLayers; layer++) {
            let nodes = this.graph.layers[layer];
            for (let node of nodes) {
                if (node instanceof FunctionNode) {
                    let r = this.renderFunctionNode(node);
                    functionRenderGroups.set(node, r.group);
                    for (let opd of r.outputPorts) {
                        valueRendererMap.set(opd.port, [opd.container]);
                        outputRenderGroups.set(opd.port, opd.group);
                    }
                } else if (node instanceof WaypointNode) {
                    this.renderWaypointNode(node);
                } else if (node instanceof ArgumentNode) {
                    let r = this.renderArgumentNode(node);
                    valueRendererMap.set(node.port, [r.container]);
                    outputRenderGroups.set(node.port, r.group);
                }
            }
        }

        this.renderResultPorts();
        this.renderAddButton(1, 1);
        const ret = { valueContainers: valueRendererMap, functionRenderGroups, outputRenderGroups };
        for (let listener of this._renderListeners) {
            listener(ret, newFunction);
        }
        return ret;
    }

    calculateNodeHeight(node : GraphNode, nodeData : NodeData) : number {
        if (node instanceof FunctionNode) {
            let outputHeight = 0
            for (let i = 0; i < node.outputPorts.length; i++) {
                nodeData.outputs.push({
                    height: 50,
                    y: 20 + 50 * i
                });
                outputHeight += nodeData.outputs[i].height;
            }
            let inputHeight = 0
            for (let i = 0; i < node.inputPorts.length; i++) {
                nodeData.inputs.push({
                    height: 30,
                    y: 20 + 30 * i
                });
                inputHeight += nodeData.inputs[i].height;
            }
            let height = Math.max(outputHeight, inputHeight);
            if (inputHeight > outputHeight) {
                let diff = (inputHeight - outputHeight) / node.outputPorts.length;
                for (let i = 0; i < node.outputPorts.length; i++) {
                    nodeData.outputs[i].height += diff;
                    nodeData.outputs[i].y += diff * i;
                }
            } else if (outputHeight > inputHeight) {
                let diff = (outputHeight - inputHeight) / node.inputPorts.length;
                for (let i = 0; i < node.inputPorts.length; i++) {
                    nodeData.inputs[i].height += diff;
                    nodeData.inputs[i].y += diff * i;
                }
            }
            return height + 20;
        } else if (node instanceof WaypointNode) {
            return 10;
        } else if (node instanceof ArgumentNode) {
            nodeData.outputs.push({
                height: 50,
                y : 20,
            })
            return 70;
        }
        return 0;
    }

    renderAddButton(x : number, y : number) {
        let group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform", `translate(${x}, ${y})`);
        this.svg.appendChild(group);
        let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("width", "20");
        rect.setAttribute("height", "20");
        rect.setAttribute("fill", "white");
        rect.setAttribute("stroke", "black");
        group.appendChild(rect);
        let plus = document.createElementNS("http://www.w3.org/2000/svg", "path");
        plus.setAttribute("d", "M 5 10 h 10 M 10 5 v 10");
        plus.setAttribute("stroke", "black");
        group.appendChild(plus);
        group.addEventListener("click", async () => {
            let funcs = this.graph.functions.getAcceptingFunctions([])
            let f = await this._showFunctionMenu(funcs, x, y);
            if (f) {
                let nf = this.graph.nodeForFunction(f);
                this.graph.getLayer(0).push(nf);
                this.layOut();
                this.render(true, {node: nf});
                // for (let o of nf.outputPorts) {
                //     let conn = new GraphConnection(o);
                //     o.connections.push(conn);
                //     for (let i = 1; i < this.graph.layers.length; i++) {
                //         let wp = new WaypointNode(this.graph, conn);
                //         wp.layer = i;
                //         this.graph.layers[i].push(wp);
                //         conn.via.push(wp);
                //     }
                //     this.graph.resultPorts.push({ port: new FunctionOutputPort(nf, o.label, o.type), connection: conn })
                // }
            } else {
                this.layOut();
                this.render();
            }
        })
    }

    async _showFunctionMenu(functions : Array<SubductFunction>, x : number, y : number, extras? : { [key : string] : () => void }) : Promise<SubductFunction | null> {
        let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        if (x + 200 > this.svg.width.baseVal.valueInSpecifiedUnits) {
            x = this.svg.width.baseVal.valueInSpecifiedUnits - 200;
        }
        g.setAttribute("transform", `translate(${x}, ${y})`);
        this.svg.appendChild(g);
        let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("width", "200");
        rect.setAttribute("height", "200");
        rect.setAttribute("fill", "white");
        rect.setAttribute("stroke", "black");
        g.appendChild(rect);
        let fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        fo.setAttribute("width", "200");
        fo.setAttribute("height", "200");
        g.appendChild(fo);
        let div = document.createElement("div");
        div.style.width = "200px";
        div.style.height = "200px";
        div.style.overflow = "auto";
        fo.appendChild(div);
        let ul = document.createElement("ul");
        ul.classList.add('menu')
        div.appendChild(ul);
        return new Promise((resolve, reject) => {
            for (let lab of Object.keys(extras || {})) {
                let li = document.createElement("li");
                li.innerText = lab;
                li.classList.add('extra');
                li.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    this.svg.removeChild(g);
                    extras![lab]();
                    resolve(null);
                })
                ul.appendChild(li);
            }
            for (let f of functions) {
                let li = document.createElement("li");
                li.innerText = f.label;
                li.classList.add('function');
                li.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    this.svg.removeChild(g);
                    resolve(f);
                })
                ul.appendChild(li);
            }
            setTimeout(() => {
                this.svg.addEventListener("click", () => {
                    if (!g.parentNode)
                        return;
                    this.svg.removeChild(g);
                    resolve(null);
                }, {once: true})
            }, 100)
        });
    }

    renderFunctionNode(node : FunctionNode) {
        let isPending = node.func.label == '???';
        let nodeData = this.nodeData.get(node)!;
        let height = nodeData!.height;
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        circle.setAttribute("x", nodeData.x.toString());
        circle.setAttribute("y", nodeData.y.toString());
        circle.setAttribute("width", nodeData!.width.toString());
        circle.setAttribute("height", height.toString());
        circle.setAttribute("fill", "white");
        circle.setAttribute("stroke", "black");
        //this.svg.appendChild(circle);
        let funcGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const leftBumpUp = `a ${20} ${20} 0 0 1 0 -20`
        const rightBumpDown = `a ${10} ${11} 0 0 1 0 20`
        const rightBumpUp = `a ${10} ${10} 0 0 0 0 -20`
        let border = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let borderParts = [`M${nodeData.x},${nodeData.y}`];
        borderParts.push(`h 0`);
        if (!isPending)
            borderParts.push(`a ${nodeData.width} 50 0 0 1 ${nodeData.width} 0`);
        else 
            borderParts.push(`a ${nodeData.width} 50 0 0 0 ${nodeData.width} 0`);
        borderParts.push(`h 0`);
        //borderParts.push(`h ${nodeData.width}`);
        //borderParts.push(`v ${height}`);
        let movedDown = 20
        borderParts.push(`v 20`)
        borderParts.push('c 0 0 0 0 0 0');
        if (!isPending) {
            borderParts.push(`h ${-(nodeData.width - 11)}`);
        //borderParts.push(`h ${nodeData.width}`);
            borderParts.push(`v ${nodeData.height - movedDown}`)
        } else {
            borderParts.push(`h 0`);
            borderParts.push(`l ${-(nodeData.width - 11)} ${nodeData.height - movedDown}`)
        }
        borderParts.push(`h ${-11}`)
        //borderParts.push(`h -${nodeData.width}`);
        for (let i = 0; i < node.inputPorts.length; i++) {
            let ip = node.inputPorts[i];
            let ipd = nodeData.inputs[i];
            borderParts.push(`v -${ipd.height / 2 - 10}`);
            borderParts.push(rightBumpUp);
            borderParts.push(`v -${ipd.height / 2 - 10}`);
        }
        //borderParts.push(`h 10`)
        //borderParts.push(`m -10 0`)
        //borderParts.push(`v -50`)
        //borderParts.push(`h ${nodeData.width}`);
        //borderParts.push(`h -${nodeData.width}`);
        borderParts.push(`z`);
        border.setAttribute("d", borderParts.join(" "));
        //border.setAttribute("d", `M ${nodeData.x} ${nodeData.y} h ${nodeData.width} v ${height} h -${nodeData.width} z`);
        if (!isPending)
            border.setAttribute("fill", "#bbb");
        else
            border.setAttribute("fill", "#bee");
        border.setAttribute("stroke", "#888");
        funcGroup.appendChild(border);
        let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", (nodeData.x + nodeData.width / 2).toString());
        if (!isPending)
            text.setAttribute("y", nodeData.y.toString());
        else
            text.setAttribute("y", (nodeData.y + 20).toString());
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "hanging");
        text.setAttribute("font-size", "20");
        text.setAttribute("width", nodeData.width.toString());
        text.textContent = node.label;
        if (node.label.length > 17) {
            text.textContent = node.label.substr(0, 14) + '...';
        }
        text.classList.add('function-label')
        if (!isPending)
            funcGroup.appendChild(text);
        this.svg.appendChild(funcGroup);
        let ret : { outputPorts: Array<any>, group: SVGGElement } = {outputPorts: [], group: funcGroup}
        for (let i = 0; i < node.inputPorts.length; i++) {
            this.renderInputPort(node, i, funcGroup);
            if (node.inputPorts[i].connections.length) {
                let connection = node.inputPorts[i].connections[0];
                this.renderConnection(connection);
            }
        }

        for (let i = 0; i < node.outputPorts.length; i++) {
            ret.outputPorts.push(this.renderOutputPort(node, i));
        }

        funcGroup.addEventListener('click', () => {
            if (node.func.label == '???') {
                let funcs = node.graph.functions.getAcceptingFunctions(node.inputPorts.filter(ip => ip.connections.length).map((ip) => ip.connections[0].source?.type))
                this._showFunctionMenu(funcs, (nodeData.x + 10), (nodeData.y + 20)
                ).then(f => {
                    if (f) {
                        node.become(f);
                        this.layOut();
                        this.render(true, {node});
                    } else {
                        this.layOut();
                        this.render();
                    }
                })
                // console.log(funcs)
                // let fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
                // fo.setAttribute("x", (nodeData.x + 10).toString());
                // fo.setAttribute("y", (nodeData.y + 20).toString());
                // fo.setAttribute("width", (nodeData.width - 20).toString());
                // fo.setAttribute("height", (funcs.length * 20).toString());
                // fo.setAttribute("class", "function-chooser");
                // let div = document.createElement("div");
                // div.setAttribute("class", "function-chooser");
                // fo.appendChild(div);
                // for (let func of funcs) {
                //     let button = document.createElement("button");
                //     button.textContent = func.label;
                //     button.addEventListener('mousedown', () => {
                //         node.become(node.graph.functions.getFunction(func.name, node.inputPorts.filter(ip => ip.connections.length).map((ip) => ip.connections[0].source?.type))!);
                //         this.layOut();
                //         this.render();
                //         this.graph.describe();
                //     })
                //     div.appendChild(button);
                // }
                // this.svg.appendChild(fo);
            } else {
                let funcs = node.graph.functions.getFittingFunctions(
                    node.inputPorts.filter(ip => ip.connections.length).map((ip) => ip.connections[0].source?.type),
                    node.outputPorts.map((op) => op.type))
                if (funcs.length == 0)
                    return;
                this._showFunctionMenu(funcs, (nodeData.x + 10), (nodeData.y + 20),
                        {
                            'Delete': () => {
                                node.remove();
                            }
                        }
                    ).then(f => {
                        if (f) {
                            node.become(f);
                            this.layOut();
                            this.render(true, {node});
                        } else {
                            this.layOut();
                            this.render();
                        }
                    }
                )
                // let fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
                // fo.setAttribute("x", (nodeData.x + 10).toString());
                // fo.setAttribute("y", (nodeData.y + 20).toString());
                // fo.setAttribute("width", (nodeData.width - 20).toString());
                // fo.setAttribute("height", (funcs.length * 20).toString());
                // fo.setAttribute("class", "function-chooser");
                // let div = document.createElement("div");
                // div.setAttribute("class", "function-chooser");
                // fo.appendChild(div);
                // for (let func of funcs) {
                //     let button = document.createElement("button");
                //     button.textContent = func.label;
                //     button.addEventListener('mousedown', () => {
                //         node.become(func);
                //         this.layOut();
                //         this.render();
                //         this.graph.describe();
                //     })
                //     div.appendChild(button);
                // }
                // this.svg.appendChild(fo);
            }
        })

        return ret
    }

    renderInputPort(node : FunctionNode, port : number, parent? : SVGGElement) {
        if (parent === undefined)
            parent = this.svg as SVGGElement;
        let nodeData = this.nodeData.get(node)!;
        let portInfo = node.inputPorts[port];
        let portData = nodeData.inputs[port];
        let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.classList.add('input-sobriquet')
        text.setAttribute("x", (nodeData.x - 5).toString());
        text.setAttribute("y", (nodeData.y + portData.y + portData.height / 2 - 5).toString());
        text.setAttribute("text-anchor", "end");
        text.setAttribute("dominant-baseline", "auto");
        text.setAttribute("font-size", "14");
        text.style.strokeWidth = "1px"
        text.textContent = portInfo.label;
        parent.appendChild(text);
        // When we can make function nodes without their inputs filled,
        // we will want to switch the type to display only when not connected,
        // in the spot where the connection edge would be.
        let typeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        typeText.classList.add('input-type-label')
        typeText.setAttribute("x", (nodeData.x - 5).toString());
        typeText.setAttribute("y", (nodeData.y + portData.y + portData.height / 2 + 5).toString() );
        typeText.setAttribute("text-anchor", "end");
        typeText.setAttribute("dominant-baseline", "hanging");
        typeText.setAttribute("font-size", "12");
        typeText.style.strokeWidth = "1px"
        typeText.textContent = portInfo.type.toString();
        parent.appendChild(typeText);
    }

    renderResultPorts() {
        const numPorts = this.graph.resultPorts.length;
        const vertSpace = Math.min(window.innerHeight, this.svg.height.baseVal.value);
        const horzSpace = this.width;
        const spacing = vertSpace / (numPorts);
        const top = spacing / 2;
        let y = top;
        for (let result of this.graph.resultPorts) {
            let data = this.renderResultPort(result.port, result.connection, this._resultPortX, y);
            this.resultLookup.set(result.connection, data);
            y += spacing;
        }
    }

    renderResultPort(port : FunctionOutputPort | ArgumentOutputPort, connection : GraphConnection, x : number, y : number) {
        const height = 50;
        const width = 100;
        let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        let border = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let pathSteps = [`M ${x} ${y}`];
        pathSteps.push(`h ${width}`);
        pathSteps.push(`l 25 ${height / 2} l -25 ${height / 2}`);
        pathSteps.push(`h ${-width}`);
        pathSteps.push('z')
        border.setAttribute("d", pathSteps.join(' '));
        border.setAttribute("fill", "#444");
        border.setAttribute("stroke", "#444");
        g.appendChild(border);
        let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", (x + 2).toString());
        text.setAttribute("y", (y + height / 2).toString());
        text.setAttribute("text-anchor", "start");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-size", "20");
        text.setAttribute("width", "100");
        text.setAttribute("fill", "white")
        text.textContent = port.label;
        g.appendChild(text);
        let outputTypeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        outputTypeText.setAttribute("x", (x + width + 10).toString());
        outputTypeText.setAttribute("y", (y + height / 2).toString());
        outputTypeText.setAttribute("text-anchor", "end");
        outputTypeText.setAttribute("dominant-baseline", "middle");
        outputTypeText.setAttribute("font-size", "14");
        outputTypeText.setAttribute('fill', 'white');
        outputTypeText.textContent = port.type.toString();
        g.appendChild(outputTypeText);
        this.svg.appendChild(g);
        let path
        if (connection) {
            path = this.renderConnection(connection, {x: x, y: y + 25});
        }
        g.addEventListener('dblclick', (e) => {
            for (let [i, pi] of this.graph.resultPorts.entries()) {
                if (pi.connection === connection) {
                    this.graph.resultPorts.splice(i, 1);
                    break;
                }
            }
            this.resultLookup.delete(connection);
            let idx = connection.source?.connections.indexOf(connection);
            if (idx !== undefined && idx !== -1) {
                connection.source?.connections.splice(idx, 1);
            }
            for (let wp of connection.via) {
                let layer = this.graph.getLayer(wp.layer);
                let idx = layer.indexOf(wp);
                if (idx !== -1) {
                    layer.splice(idx, 1);
                }
            }
            this.render();
        })
        return { path, group : g, x, y };
    }

    renderOutputPort(node : FunctionNode, port : number) {
        let nodeData = this.nodeData.get(node)!;
        let portData = nodeData.outputs[port];
        let portInfo = node.outputPorts[port];
        let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", (nodeData.x).toString());
        rect.setAttribute("y", (nodeData.y + portData.y).toString());
        rect.setAttribute("width", nodeData.width.toString());
        rect.setAttribute("height", portData.height.toString());
        rect.setAttribute("fill", "white");
        rect.setAttribute("stroke", "black");
        //g.appendChild(rect);
        const rightBumpDown = `a ${10} ${11} 0 0 1 0 20`
        const rightBumpUp = `a ${10} ${10} 0 0 0 0 -20`
        const portTop = nodeData.y + portData.y;
        const portLeft = nodeData.x + 11;
        const outputWidth = nodeData.width - 11
        let border = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let borderParts = [`M${portLeft},${portTop}`];
        borderParts.push(`h ${outputWidth}`);
        let ipd = nodeData.outputs[port];
        borderParts.push(`v ${ipd.height / 2 - 10}`);
        borderParts.push(rightBumpDown);
        borderParts.push(`v ${ipd.height / 2 - 10}`);
        borderParts.push(`h -${outputWidth}`)
        borderParts.push(`h 0`);
        borderParts.push(`c 0 0 0 0 0 0`);
        borderParts.push(`z`);
        border.setAttribute("d", borderParts.join(" "));
        border.setAttribute("fill", "#eee");
        border.setAttribute("stroke", "#888");
        g.appendChild(border);
        if (portInfo.label) {
            let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.classList.add("output-sobriquet");
            text.setAttribute("x", (nodeData.x + nodeData.width - 2).toString());
            text.setAttribute("y", (nodeData.y + portData.y).toString());
            text.setAttribute("text-anchor", "end");
            text.setAttribute("dominant-baseline", "hanging");
            text.setAttribute("font-size", "17");
            text.textContent = portInfo.label;
            g.appendChild(text);
        }
        let typeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        typeText.classList.add("type-label");
        typeText.setAttribute("x", (nodeData.x + nodeData.width - 2).toString());
        typeText.setAttribute("y", (nodeData.y + portData.y + 20).toString());
        typeText.setAttribute("x", (nodeData.x + nodeData.width + 5).toString());
        typeText.setAttribute("y", (nodeData.y + portData.y + portData.height / 2 - 5).toString());
        typeText.setAttribute("text-anchor", "start");
        typeText.setAttribute("dominant-baseline", "auto");
        typeText.setAttribute("font-size", "14");
        typeText.textContent = portInfo.type.toString();
        g.appendChild(typeText);
        let foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObject.setAttribute("x", (nodeData.x + 16).toString());
        foreignObject.setAttribute("y", (nodeData.y + portData.y + 17).toString());
        foreignObject.setAttribute("width", (nodeData.width - 21).toString());
        foreignObject.setAttribute("height", (portData.height - 22).toString());
        
        g.appendChild(foreignObject);
        this.svg.appendChild(g);
        g.addEventListener('click', (ev) => {
            this.startActivePathFrom(node, portInfo, {x: nodeData.x + nodeData.width, y: nodeData.y + portData.y + portData.height / 2})
        })
        return {
            group: g,
            container: foreignObject,
            port: node.outputPorts[port]
        }
    }

    startActivePathFrom(node : FunctionNode | ArgumentNode, port : FunctionOutputPort | ArgumentOutputPort, start : {x : number, y : number}) {
        let conn = new GraphConnection(port);
        if (false && port.connections.length)
            this.connectionColours.set(conn, this.nextColour());
        let gr = this;
        let path : SVGPathElement | undefined = undefined;
        let prevX = start.x;
        let prevY = start.y;
        let resultPortTmp : {
            path: SVGPathElement | undefined;
            group: SVGGElement;
            x: number;
            y: number;
        } | undefined;
        function moveHandler(ev : MouseEvent) {
            if (path)
                path.remove();
            let svg = gr.svg as SVGSVGElement;
            let box = svg.getBoundingClientRect();
            let scopeX = ev.x - box.left;
            let scopeY = ev.y - box.top;
            if (scopeX > start.x)
                path = gr.renderConnection(conn, {x: scopeX, y: scopeY});
            for (let [layer, layerX] of gr.layerX.entries()) {
                if (scopeX < start.x) {
                    gr.svg.addEventListener('click', function(ev : MouseEvent) {
                        if (ev.x - box.left < start.x) {
                            gr.svg.removeEventListener('mousemove', moveHandler);
                            gr.render();
                        }
                    }, { once: true });
                } else if (prevX < layerX && scopeX >= layerX) {
                    let wp = new WaypointNode(gr.graph, conn);
                    wp.layer = layer;
                    gr.nodeData.set(wp, {x: layerX, y: scopeY, width: 0, height: 0, inputs: [], outputs: [], earlierOutputs: 0});
                    conn.via.push(wp);
                    for (let [i, node] of gr.graph.layers[layer].entries()) {
                        let nodeData = gr.nodeData.get(node)!;
                        if (nodeData.y > scopeY) {
                            gr.graph.layers[layer].splice(i, 0, wp);
                            break;
                        }
                    }
                    if (gr.graph.layers[layer].indexOf(wp) == -1)
                        gr.graph.layers[layer].push(wp);
                } else if (prevX > layerX && scopeX <= layerX) {
                    let lastWP = conn.via.pop();
                    if (lastWP) {
                        gr.nodeData.delete(lastWP);
                        gr.graph.layers[layer].splice(gr.graph.layers[layer].indexOf(lastWP), 1);
                    }
                }
                if (scopeX > layerX - baseNodeWidth / 2 - 20 && scopeX < layerX) {
                    for (let [i, node] of gr.graph.layers[layer].entries()) {
                        let nodeData = gr.nodeData.get(node)!;
                        if (nodeData.y < scopeY && nodeData.y + nodeData.height > scopeY) {
                            for (let [portIdx, input] of nodeData.inputs.entries()) {
                                if (scopeY >= nodeData.y + input.y && scopeY <= nodeData.y + input.y + input.height) {
                                    path?.remove();
                                    path = gr.renderConnection(conn, {x: nodeData.x, y: nodeData.y + input.y + input.height / 2});
                                    path?.addEventListener('click', (ev) => {
                                        ev.stopPropagation();
                                        let fn = node as FunctionNode;
                                        gr.svg.removeEventListener('mousemove', moveHandler);
                                        gr.svg.removeEventListener('click', clickHandler);
                                        if (path)
                                            path.remove();
                                        conn.destination = fn.inputPorts[portIdx];
                                        if (fn.inputPorts[portIdx].connections[0])
                                            fn.inputPorts[portIdx].connections[0].disconnect();
                                        fn.inputPorts[portIdx].connections[0] = conn;
                                        conn.source?.connections.push(conn);
                                        gr.sortConnections(conn.source!);
                                        if (fn.func.label == '???') {
                                            fn.func.inputs.push({type: types.Generic('X' + fn.func.inputs.length )})
                                            fn.recheckInputPorts();
                                            let fnd = gr.nodeData.get(fn)!;
                                            fnd.inputs = [];
                                            fnd.height = gr.calculateNodeHeight(fn, fnd);
                                        }
                                        gr.render();
                                    })
                                }
                            }
                            break;
                        }
                    }
                }
                if (resultPortTmp) {
                    resultPortTmp.path?.remove();
                    resultPortTmp.group.remove();
                }
                if (scopeX > gr._resultPortX) {
                    resultPortTmp = gr.renderResultPort(conn.source!, conn, gr._resultPortX, scopeY - 25)
                    resultPortTmp.group.addEventListener('click', (ev) => {
                        gr.svg.removeEventListener('mousemove', moveHandler);
                        gr.svg.removeEventListener('click', clickHandler);
                        if (path)
                            path.remove();
                        if (resultPortTmp?.path)
                            resultPortTmp.path.remove();
                        conn.destination = undefined;
                        const rpi = {port: conn.source!, connection: conn};
                        for (let rp of gr.graph.resultPorts) {
                            let rpd = gr.resultLookup.get(rp.connection)!;
                            if (rpd.y > scopeY) {
                                gr.graph.resultPorts.splice(gr.graph.resultPorts.indexOf(rp), 0, rpi);
                                break;
                            }
                        }
                        if (gr.graph.resultPorts.indexOf(rpi) == -1)
                            gr.graph.resultPorts.push(rpi);
                        conn.source?.connections.push(conn);
                        gr.sortConnections(conn.source!);
                        gr.render();
                    })
                }
            }
            prevX = scopeX;
            prevY = scopeY;
        }

        function clickHandler(ev : MouseEvent) {
            if (conn.via.length && !conn.destination) {
                let lastWP = conn.via.pop()!;
                let placeholderFunction = gr.graph.nodeForFunction(new SubductFunction('???', [{ type: types.Generic('X0') }, { type: types.Generic('X1') }], [], (...a : any) => []));
                placeholderFunction.layer = lastWP.layer;
                gr.graph.layers[lastWP.layer].splice(gr.graph.layers[lastWP.layer].indexOf(lastWP), 1, placeholderFunction);
                gr.nodeData.set(placeholderFunction, {x: gr.nodeData.get(lastWP)!.x - baseNodeWidth / 2, y: gr.nodeData.get(lastWP)!.y, width: 150, height: 50, inputs: [], outputs: [], earlierOutputs: 0});
                let nd = gr.nodeData.get(placeholderFunction)!;
                nd.height = gr.calculateNodeHeight(placeholderFunction, nd);
                //gr.nodeData.delete(lastWP);
                conn.destination = placeholderFunction.inputPorts[0];
                placeholderFunction.inputPorts[0].connections[0] = conn;
                conn.source?.connections.push(conn);
                //gr.sortConnections(conn.source!);
                if (lastWP.layer = gr.graph.layers.length - 1) {
                    gr.graph.propagateWaypoints();
                    gr.layOut();
                }
                gr.render();
                gr.svg.removeEventListener('mousemove', moveHandler);
                gr.svg.removeEventListener('click', clickHandler);
            }
        }

        for (let resultPort of this.graph.resultPorts) {
            let rConn = resultPort.connection;
            let resultData = this.resultLookup.get(rConn);
            if (!resultData) // can this happen?
                continue;
            resultData.group.addEventListener('mousedown', (ev) => {
                this.svg.removeEventListener('mousemove', moveHandler);
                this.svg.removeEventListener('click', clickHandler);
                if (path)
                    path.remove();
                if (resultData?.path)
                    resultData.path.remove();
                conn.destination = undefined;
                if (resultPort.connection) {
                    for (let wp of resultPort.connection.via) {
                        let wpLayer = this.graph.getLayer(wp.layer);
                        wpLayer.splice(wpLayer.indexOf(wp), 1);
                    }
                    if (resultPort.connection.source)
                        resultPort.connection.source.connections.splice(resultPort.connection.source.connections.indexOf(resultPort.connection), 1);
                }
                resultPort.connection = conn;
                //this.renderConnection(conn);
                let rd = this.renderResultPort(resultPort.port, conn, resultData!.x, resultData!.y);
                this.resultLookup.set(conn, rd);
                this.resultLookup.delete(rConn);
                if (conn.source?.connections.indexOf(rConn) == -1)
                    conn.source?.connections.push(conn);
                gr.sortConnections(conn.source!);
                this.render(); // erases all elements - no need for cleanup
            })
            resultData.group.addEventListener('mousemove', (ev) => {
                ev.stopPropagation();
                if (path)
                    path.remove();
                path = gr.renderConnection(conn, {x: resultData!.x, y: resultData!.y + 25});
            })
        }
        this.svg.addEventListener('mousemove', moveHandler);
        this.svg.addEventListener('click', clickHandler);
    }

    renderWaypointNode(node : WaypointNode) {
        let nodeData = this.nodeData.get(node)!;
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.classList.add('waypoint')
        circle.setAttribute("cx", this.nodeData.get(node)!.x.toString());
        circle.setAttribute("cy", this.nodeData.get(node)!.y.toString());
        circle.setAttribute("r", "10");
        circle.setAttribute("fill", "#0000");
        circle.setAttribute("stroke", "none");
        this.svg.appendChild(circle);
        circle.addEventListener('click', () => {
            // let conn = node.connections[0];
            // let myIndex = conn.via.indexOf(node);
            // let waypointsAfter = conn.via.slice(myIndex + 1);
            // let newFunctionNode = node.graph.nodeForFunction(node.graph.functions.getFunction("double", ["int"])!);
            // let outConn = new GraphConnection(newFunctionNode.outputPorts[0], conn.destination);
            // // Put existing trailing waypoints within new connection
            // outConn.via = waypointsAfter;
            // // Update existing waypoints to use new connection
            // for (let wp of waypointsAfter) {
            //     wp.connections[0] = outConn;
            // }
            // // Update existing destination to use new connection
            // let dest = conn.destination;
            // if (dest) {
            //     dest.connections[0] = outConn;
            // }
            // // Connect existing connection to new function node
            // conn.destination = newFunctionNode.inputPorts[0];
            // newFunctionNode.inputPorts[0].connections[0] = conn!;
            // newFunctionNode.outputPorts[0].connections[0] = outConn;
            // // Remove trailing waypoints from existing connection
            // conn.via.splice(myIndex);
            // for (let result of this.graph.resultPorts) {
            //     if (result.connection === conn) {
            //         result.connection = outConn;
            //         result.port.type = outConn.source!.type;
            //     }
            // }
            // this.graph.replaceNode(node, newFunctionNode);
            // this.layOut();
            // this.clear();
            // this.render();
            // this.graph.describe();
            // // this.svg.addEventListener("mousedown", (ev: { offsetY: any; }) => {
            // //     nodeData.y = ev.offsetY
            // //     this.render()
            // // }, {once: true})
        })
    }

    renderArgumentNode(node : ArgumentNode) {

        let nodeData = this.nodeData.get(node)!;
        let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", this.nodeData.get(node)!.x.toString());
        circle.setAttribute("cy", this.nodeData.get(node)!.y.toString());
        circle.setAttribute("r", "10");
        circle.setAttribute("fill", "#000");
        circle.setAttribute("stroke", "none");
        //g.append(circle);
        let border = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let borderParts = [];
        borderParts.push(`M ${nodeData.x} ${nodeData.y}`);
        borderParts.push(`h ${nodeData.width}`);
        borderParts.push(`v ${nodeData.height}`);
        borderParts.push(`h -${nodeData.width}`);
        borderParts.push(`l 15 ${-nodeData.height / 2 + 5}`)
        borderParts.push(`a 7 7 0 1 0 0 -10`)
        //borderParts.push(`v -10`)
        borderParts.push(`l -15 ${-nodeData.height / 2 + 5}`)
        borderParts.push(`z`);
        border.setAttribute("fill", "#444");
        border.setAttribute("stroke", "#888");
        border.setAttribute("stroke-width", "1");
        border.setAttribute("d", borderParts.join(" "));
        g.appendChild(border);

        let labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        labelText.classList.add("argument-label");
        labelText.setAttribute("x", (nodeData.x + 30).toString());
        labelText.setAttribute("y", (nodeData.y + 3).toString());
        labelText.setAttribute("text-anchor", "start");
        labelText.setAttribute("dominant-baseline", "hanging");
        labelText.setAttribute("font-size", "17");
        labelText.setAttribute("fill", "white");
        labelText.textContent = node.label;
        g.appendChild(labelText);

        const rightBumpDown = `a ${10} ${11} 0 0 1 0 20`

        let outputBorder = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let ipd = nodeData.outputs[0];
        let portLeft = nodeData.x + 30;
        let portTop = nodeData.y + ipd.y;
        let outputWidth = nodeData.width - 30;
        borderParts = [`M${portLeft},${portTop}`];
        borderParts.push(`h ${outputWidth}`);
        borderParts.push(`v ${ipd.height / 2 - 10}`);
        borderParts.push(rightBumpDown);
        borderParts.push(`v ${ipd.height / 2 - 10}`);
        borderParts.push(`h -${outputWidth}`)
        borderParts.push(`h 0`);
        borderParts.push(`c 0 0 0 0 0 0`);
        borderParts.push(`z`);
        outputBorder.setAttribute("fill", "#eee");
        outputBorder.setAttribute("stroke", "#888");
        outputBorder.setAttribute("stroke-width", "1");
        outputBorder.setAttribute("d", borderParts.join(" "));
        g.appendChild(outputBorder);


        let foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObject.setAttribute("x", (nodeData.x + 30).toString());
        foreignObject.setAttribute("y", (nodeData.y + ipd.y ).toString());
        foreignObject.setAttribute("width", (nodeData.width - 30).toString());
        foreignObject.setAttribute("height", (ipd.height).toString());
        
        g.appendChild(foreignObject);
        this.svg.appendChild(g);

        g.addEventListener('click', (ev) => {
            let portData = nodeData.outputs[0]
            this.startActivePathFrom(node, node.outputPorts[0], {x: nodeData.x + nodeData.width, y: nodeData.y + portData.y + portData.height / 2})
        })

        return {
            group: g,
            container: foreignObject,
            port: node.port
        }
    }

    sortConnections(outputPort : FunctionOutputPort | ArgumentOutputPort) {
        let connections = outputPort.connections;
        let decArr = connections.map((conn, index) => {
            if (!conn.destination) {
                let firstWP = conn.via[0];
                let wpND = this.nodeData.get(firstWP)!;
                let firstWPY = wpND.y;
                return {y : firstWPY, conn };
            } else {
                let dest = conn.destination.functionNode;
                let destData = this.nodeData.get(dest)!;
                let destY = destData.y;
                let inputY = destY + destData.inputs[dest.inputPorts.indexOf(conn.destination)].y;
                return { y : inputY, conn };
            }
        })
        decArr.sort((a, b) => { return a.y - b.y; });
        outputPort.connections = decArr.map((arr) => arr.conn);
    }

    renderConnection(connection : GraphConnection, end?: {x: number, y: number}) {
        if (connection.source == null)
            return;
        if (connection.destination == null && !end)
            return;
        let startPort = connection.source
        let startNodeData = this.nodeData.get(startPort.parentNode)!;
        let startPortData = startNodeData.outputs[startPort.parentNode.outputPorts.indexOf(startPort)];
        let startX = startNodeData.x + startNodeData.width;
        let startY = startNodeData.y + startPortData.y + startPortData.height / 2;
        let startIndex = startPort.connections.indexOf(connection);

        let endX, endY
        if (!end) {
            let endPort = connection.destination!
            let endNodeData = this.nodeData.get(endPort.functionNode)!;
            let endPortData = endNodeData.inputs[endPort.functionNode.inputPorts.indexOf(endPort)];
            
            endX = endNodeData.x;
            endY = endNodeData.y + endPortData.y + endPortData.height / 2;
        } else {
            endX = end.x;
            endY = end.y;
        }
        let offset = 0;
        let sourceNodeData = this.nodeData.get(connection.source.parentNode)
        offset = sourceNodeData?.earlierOutputs ?? 0

        if (true || startIndex > 0) {
            //startY += Math.pow(-1, startIndex) * 5 * Math.floor((startIndex + 1) / 2) * -1;
            //offset += Math.pow(-1, startIndex) * Math.floor((startIndex + 1) / 2) * -1;
            let up = startY - Math.floor((0 + startPort.connections.length) / 2) * 5;
            startY = up + 5 * startIndex;
            offset += startIndex;
        }
            
        // Produce path string going via all waypoints
        let pathString = "M " + startX + " " + startY;
        for (let i = 0; i < connection.via.length; i++) {
            let waypoint = connection.via[i];
            let waypointData = this.nodeData.get(waypoint)!;
            pathString += " L " + waypointData.x + " " + waypointData.y;
        }
        pathString += " L " + endX + " " + endY;
        let points = [{x : startX, y : startY}]
        for (let i = 0; i < connection.via.length; i++) {
            let waypoint = connection.via[i];
            let waypointData = this.nodeData.get(waypoint)!;
            //points.push({... waypointData, x : waypointData.x - baseNodeWidth / 2})
            points.push(waypointData)
            //points.push({... waypointData, x : waypointData.x + baseNodeWidth / 2})
        }
        points.push({x : endX, y : endY})

        let idx = connection.source.parentNode.outputPorts.indexOf(connection.source)
        if (idx > 0)
            offset += idx
        if (points[points.length-1].y > points[0].y) {
            offset = -offset
        }
        pathString = geometry.svgCurvedPathThroughPoints(points, offset)

        // All of this is to match colours for "pass-through" generic
        // connections, where there is only one use of the parameter.
        // For example, the "swap" function should use the input colours
        // for each output connection.
        if (!this.connectionColours.has(connection) && connection.source.parentNode instanceof FunctionNode) {
            if (connection.source.parentNode.func.baseFunction) {
                let bf = connection.source.parentNode.func.baseFunction
                let originalOutput = bf.outputs[idx]
                if ((<any>originalOutput.type).generic) {
                    let gen = (<any>originalOutput.type).generic
                    let count = 0
                    for (let o of bf.outputs) {
                        if ((<any>o.type).generic == gen)
                            count++
                    }
                    let correspondingInput = null
                    if (count == 1) {
                        for (let o of bf.inputs) {
                            if ((<any>o.type).generic == gen) {
                                correspondingInput = o
                                count--
                                break
                            }
                        }
                    }
                    if (count == 0 && correspondingInput != null) {
                        let inputIndex = bf.inputs.indexOf(correspondingInput)
                        let inputPort = connection.source.parentNode.inputPorts[inputIndex]
                        if (inputPort.connections[0] && this.connectionColours.has(inputPort.connections[0])) {
                            this.connectionColours.set(connection, this.connectionColours.get(inputPort.connections[0])!)
                        }
                    }
                }
            } else if (connection.source.parentNode.inputPorts.length == 1 && connection.source.parentNode.outputPorts.length == 1) {
                let inputPort = connection.source.parentNode.inputPorts[0]
                let outputPort = connection.source
                let already = false;
                for (let conn of outputPort.connections) {
                    if (this.connectionColours.has(conn)) {
                        already = true;
                    }
                }
                if (!already && inputPort.connections[0] && this.connectionColours.has(inputPort.connections[0])) {
                    this.connectionColours.set(connection, this.connectionColours.get(inputPort.connections[0])!)
                }
            }
        }
        
        // If we don't already have a colour (from before, or from the generic matching),
        // pick the next one out of the list.
        if (!this.connectionColours.has(connection)) {
            this.connectionColours.set(connection, this.nextColour());
        }
        let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathString);
        path.setAttribute("stroke", this.connectionColours.get(connection) ?? "black");
        path.setAttribute("fill", "none");
        path.style.strokeWidth = '5px'
        path.style.transition = 'd 0.5s';
        this.connectionGroup.appendChild(path);
        this.connectionLookup.set(connection, path);
        return path;
    }

    randomColour() {
        return "#" + Math.floor(Math.random() * 0x80 + 0x80).toString(16) +
            Math.floor(Math.random() * 0x80 + 0x80).toString(16) +
            Math.floor(Math.random() * 0x80 + 0x80).toString(16);
    }

    nextColour() {
        return colours.colours[this.colourIndex++ % colours.colours.length]
    }
}

function createHues() {
    let offsets = [0, 120, 240,
        60, 180, 300,
        //30, 90, 150, 210, 270, 330,
        30, 270, 90, 210, 330, 150,
        //15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345,
        15, 195, 345, 45, 255, 75, 165, 285, 105, 315, 135, 225,
        //7.5, 22.5, 37.5, 52.5, 67.5, 82.5, 97.5, 112.5, 127.5, 142.5, 157.5, 172.5, 187.5, 202.5, 217.5, 232.5, 247.5, 262.5, 277.5, 292.5, 307.5, 322.5, 337.5, 352.5,
        7.5, 22.5, 37.5, 52.5, 67.5, 82.5, 97.5, 112.5, 127.5, 142.5, 157.5, 172.5, 187.5, 202.5, 217.5, 232.5, 247.5, 262.5, 277.5, 292.5, 307.5, 322.5, 337.5, 352.5,
    ]
    for (let offset of offsets) {
        let cur = (colours.baseHue + offset) % 360
        colours.hues.push(cur)
        let c = 'hsl(' + cur + ',' + colours.baseSaturation + '%,' + colours.baseLightness + '%)'
        colours.colours.push(c)
    }
}
createHues()
