import SubductFunction from "../functions/SubductFunction";
import { graph } from "../gridconverter.js";
import GraphConnection from "../layers/connections.js";
import FunctionNode, { ArgumentOutputPort, FunctionOutputPort } from "../layers/functionnode.js";
import LayerGraph from "../layers/layergraph.js";
import GraphNode, { ArgumentNode, WaypointNode } from "../layers/node.js";

import * as geometry from "./geometry.js";

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

type RenderResult = {
    valueContainers: Map<FunctionOutputPort | ArgumentOutputPort, Array<Element>>,
    functionRenderGroups: Map<FunctionNode, SVGGElement>,
    outputRenderGroups: Map<FunctionOutputPort | ArgumentOutputPort, SVGGElement>
}

const baseNodeWidth = 150

type OutputPortInfo = {port: FunctionOutputPort | ArgumentOutputPort, container: SVGForeignObjectElement, x : number, y : number, width : number, group: SVGGElement }
type StackItemInfo = {port: FunctionOutputPort | ArgumentOutputPort, x : number, y : number, width : number}

export default class GridRenderer {
    graph: LayerGraph;
    svg: any;
    nodeData = new Map<GraphNode, NodeData>();
    connectionColours = new Map<GraphConnection, string>();
    connectionGroup: SVGGElement;
    colourIndex : number = 0;
    laidOut : boolean = false;
    _renderListeners : Array<(r : RenderResult, nf? : {node : FunctionNode}) => void> = [];
    
    constructor(graph : LayerGraph, svg : SVGElement) {
        this.graph = graph;
        this.svg = svg;
        let connectionGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        svg.appendChild(connectionGroup);
        this.connectionGroup = connectionGroup;
    }

    render(clear = true, newFunction? : {node : FunctionNode, originalFunction? : SubductFunction}) : RenderResult {
        if (clear)
            this.svg.textContent = "";
        this.svg.width.baseVal.convertToSpecifiedUnits(5); // pixels
        this.svg.width.baseVal.newValueSpecifiedUnits(5, this.svg.parentNode?.getBoundingClientRect().width ?? window.innerWidth);
        let availableSpace = this.svg.width.baseVal.valueInSpecifiedUnits - 30;
        let valueRendererMap = new Map<FunctionOutputPort | ArgumentOutputPort, Array<Element>>();
        let functionRenderGroups = new Map<FunctionNode, SVGGElement>();
        let outputRenderGroups = new Map<FunctionOutputPort | ArgumentOutputPort, SVGGElement>();
        let top = 1
        if (this.graph.layers.length == 0) {
            this.renderAddButton(availableSpace, 1);
            return { valueContainers: valueRendererMap, functionRenderGroups, outputRenderGroups }
        }
        let {stackItems : stackAbove, missingEnd : missingBefore } = this.renderSubLayer(this.graph.layers[0], 1, top, availableSpace - 2, valueRendererMap, 0, functionRenderGroups, outputRenderGroups);
        top += 100
        for (let layer of this.graph.layers.slice(1).slice(0, -1)) {
            missingBefore = 0;
            let stackBelow = stackAbove;
            stackBelow = [];
            let x = 1
            for (let node of layer) {
                console.log("handling", node.label, node.layer, stackAbove)
                if (node instanceof FunctionNode) {
                    let args = stackAbove.splice(0, node.inputPorts.length);
                    x = args[0].x;
                    let width = args.map(a => a.width).reduce((a, b) => a + b);
                    let {stackItems, missingEnd} = this.renderSubLayer([node], x, top, width, valueRendererMap, missingBefore, functionRenderGroups, outputRenderGroups);
                    stackBelow = stackBelow.concat(stackItems);
                    missingBefore = missingEnd;
                } else if (node instanceof WaypointNode) {
                    let above = stackAbove.shift()!
                    let {stackItems, missingEnd} = this.renderSubLayer([node], above.x, top, above.width, valueRendererMap, missingBefore, functionRenderGroups, outputRenderGroups);
                    above.width += missingBefore;
                    above.x -= missingBefore;
                    //stackBelow = stackBelow.concat(stackItems);
                    missingBefore = missingEnd;
                    stackBelow.push(above);
                }
            }
            top += 100
            stackAbove = stackBelow;
        }
        this.svg.height.baseVal.newValueSpecifiedUnits(5, Math.max(top + 100, window.innerHeight));
        this.svg.style.height = Math.max(top + 100, window.innerHeight) + "px";

        this.renderAddButton(availableSpace, 1);

        const ret = { valueContainers: valueRendererMap, functionRenderGroups, outputRenderGroups };
        for (let listener of this._renderListeners) {
            listener(ret, newFunction);
        }
        return ret;
    }

    addRenderListener(listener : (r : RenderResult) => void) {
        this._renderListeners.push(listener);
    }

    renderAddButton(x : number, y : number) {
        let group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform", `translate(${x}, ${y})`);
        this.svg.appendChild(group);
        let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("width", "20");
        if (this.graph.layers.length == 0) {
            let w = this.svg.width.baseVal.valueInSpecifiedUnits / 2;
            rect.setAttribute("width", w.toString());
            group.setAttribute("transform", `translate(${x / 2 - w / 2}, ${y})`);
        }
        rect.setAttribute("height", "20");
        rect.setAttribute("fill", "#ccc");
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
                this.graph.getLayer(1);
                for (let o of nf.outputPorts) {
                    let conn = new GraphConnection(o);
                    o.connections.push(conn);
                    for (let i = 1; i < this.graph.layers.length; i++) {
                        let wp = new WaypointNode(this.graph, conn);
                        wp.layer = i;
                        this.graph.layers[i].push(wp);
                        conn.via.push(wp);
                    }
                    this.graph.resultPorts.push({ port: new FunctionOutputPort(nf, o.label, o.type), connection: conn })
                }
                this.render(true, {node: nf})
            } else {
                this.render()
            }
        })
    }

    async _showFunctionMenu(functions : Array<SubductFunction>, x : number, y : number, extras? : { [key : string] : () => void }) : Promise<SubductFunction | null> {
        let height = Math.min(500, functions.length * 40 + 20);
        let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        if (x + 200 > this.svg.width.baseVal.valueInSpecifiedUnits) {
            x = this.svg.width.baseVal.valueInSpecifiedUnits - 200;
        }
        if (x < 1) {
            x = 1;
        }
        if (y + height > this.svg.height.baseVal.valueInSpecifiedUnits) {
            y = this.svg.height.baseVal.valueInSpecifiedUnits - height;
        }
        if (y < 1) {
            y = 1;
        }
        //0.688 0.390
        //g.setAttribute("transform", `translate(${x}, ${y})`);
        this.svg.appendChild(g);
        let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x.toString());
        rect.setAttribute("y", y.toString());
        rect.setAttribute("width", "200");
        rect.setAttribute("height", height.toString());
        rect.setAttribute("fill", "white");
        rect.setAttribute("stroke", "black");
        g.appendChild(rect);
        let fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        fo.setAttribute("width", "200");
        fo.setAttribute("height", height.toString());
        fo.setAttribute("x", x.toString());
        fo.setAttribute("y", y.toString());
        g.appendChild(fo);
        let div = document.createElement("div");
        div.style.width = "200px";
        div.style.height = height + "px";
        div.style.overflow = "auto";
        fo.appendChild(div);
        let ul = document.createElement("ul");
        ul.classList.add('menu');
        div.appendChild(ul);
        div.style.cursor = 'pointer';
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
                //li.innerText = f.label;
                li.style.display = 'grid';
                let label = document.createElement('span');
                label.innerText = f.label;
                label.style.textAlign = 'center';
                label.style.fontWeight = 'bold';
                li.style.border = '1px solid black';
                li.appendChild(label);
                label.style.gridColumnStart = '1';
                label.style.gridColumnEnd = (f.outputs.length + 1).toString();
                for (let op of f.outputs) {
                    let sp = document.createElement('span');
                    sp.innerText = op.type.toString();
                    sp.style.gridRow = '2';
                    sp.style.textAlign = 'center';
                    let lsp = document.createElement('span');
                    lsp.innerText = op.label ?? '';
                    lsp.style.gridRow = '3';
                    lsp.style.textAlign = 'center';
                    lsp.style.fontSize = '80%';
                    sp.style.borderRight = '1px solid black';
                    lsp.style.borderRight = '1px solid black';
                    li.append(sp, lsp);
                }
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

    renderArgumentNode(node : ArgumentNode, top : number, left : number, width : number, outputRenderGroups : Map<FunctionOutputPort | ArgumentOutputPort, SVGGElement> ) : OutputPortInfo{
        let group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svg.appendChild(group);
        let rect = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let borderParts = [`M ${left} ${top}`];
        borderParts.push(`h ${width / 4}`);
        borderParts.push(`l ${width / 4 - 2} 0`);
        //borderParts.push(`a 7 7 0 1 0 10 0`)
        borderParts.push(`v 10`);
        borderParts.push(`l -5 -5`);
        borderParts.push(`l -4 0`);
        borderParts.push(`l 10 9`);
        borderParts.push(`h 2`);
        borderParts.push(`l 10 -9`);
        borderParts.push(`l -4 0`);
        borderParts.push(`l -5 5`);
        borderParts.push(`v -10`);
        borderParts.push(`l ${width / 4 - 2} -0`);
        borderParts.push(`h ${width / 4}`);
        borderParts.push(`v 50`);
        borderParts.push(`h -${width}`);
        borderParts.push(`z`);
        rect.setAttribute("d", borderParts.join(" "));
        rect.setAttribute("fill", "#444");
        rect.setAttribute("stroke", "black");
        group.appendChild(rect);
        let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", (left + width / 2).toString());
        text.setAttribute("y", (top + 25).toString());
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("fill", "white");
        text.textContent = node.label ?? node.type;
        group.appendChild(text);
        let tmp = this.renderArgumentOutputPort(node.port, left, top + 50, width, group);
        //let port = new FunctionOutputPort(arg.type);
        //let { container, group: portGroup } = this.renderPort(port, x + width / 2, top + 100, width, 0, 0);
        //group.appendChild(portGroup);
        
        outputRenderGroups.set(node.port, group);
        return tmp;
    }

    renderArgumentOutputPort(port : ArgumentOutputPort, left : number, top : number, width : number, portGroup : SVGGElement) : OutputPortInfo {
        const outputHeight = 50
        let border = document.createElementNS("http://www.w3.org/2000/svg", "path");
        // M 61 161 h 139 v 15 a 10 11 0 0 1 0 20 v 15 h -139

        // M1,51   h 852 v 50 a 0 0 0 0 1 0 0    v 0  h -852 h 0  c 0 0 0 0 0 0 z
        // M61,157 h 139 v 15 a 10 11 0 0 1 0 20 v 15 h -139 h 0  c 0 0 0 0 0 0 z
        let pathSteps = [`M${left},${top}`];
        pathSteps.push(`h ${width}`);
        pathSteps.push(`v ${outputHeight}`);
        pathSteps.push(`a 0 0 0 0 1 0 0`);
        pathSteps.push(`v 0`)
        pathSteps.push(`h ${-width}`);
        // To make a consistent shape for animations
        pathSteps.push(`h 0`)
        pathSteps.push(`c 0 0 0 0 0 0`);
        //pathSteps.push(`q ${0} ${-outputHeight} ${missingBefore} ${-outputHeight}`)
        /*;
        pathSteps.push(`v ${-outputHeight / 2}`)
        pathSteps.push(`l ${missingBefore} ${-outputHeight / 2}`);*/
        pathSteps.push(`z`);
        border.setAttribute("d", pathSteps.join(" "));
        border.setAttribute("fill", "#eee");
        border.setAttribute("stroke", "black");
        border.setAttribute("stroke-width", "1");
        border.style.transition = '0.5s';
        portGroup.appendChild(border);
        let labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        labelText.setAttribute("x", `${left + width / 2}`);
        labelText.setAttribute("y", `${top + outputHeight / 2}`);
        labelText.setAttribute("text-anchor", "middle");
        labelText.setAttribute("dominant-baseline", "middle");
        labelText.textContent = port.label;
        portGroup.appendChild(labelText);
        let foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObject.setAttribute("x", `${left}`);
        foreignObject.setAttribute("y", `${top}`);
        foreignObject.setAttribute("width", `${width}`);
        foreignObject.setAttribute("height", `${outputHeight}`);
        foreignObject.style.transition = 'x 0.5s, y 0.5s, width 0.5s, height 0.5s'
        portGroup.appendChild(foreignObject);
        if (port.connections.length > 0 && port.connections[0].destination) {// || this.graph.resultPorts.find(x => x.port === port)) {
            portGroup.classList.add('connected');
        } else {
            setUpOutputForDrag(this, port, port.parentNode, portGroup)
        }
        return {
            container: foreignObject,
            group: portGroup,
            port: port,
            width : width,
            x : left,
            y : top,
        }
    }


    renderSubLayer(items : Array<GraphNode>, left : number, top : number, width : number, valueRendererMap : Map<FunctionOutputPort | ArgumentOutputPort, Array<Element>>, missingBefore : number = 0, functionRenderGroups : Map<FunctionNode, SVGGElement>, outputRenderGroups : Map<FunctionOutputPort | ArgumentOutputPort, SVGGElement> ) : { stackItems : Array<StackItemInfo>, missingEnd : number } {
        let nodeWidth = width / items.length;
        let nodeIndex = 0;
        let x = left;
        let stackItems : Array<StackItemInfo> = [];
        for (let node of items) {
            if (node instanceof FunctionNode) {
                let r = this.renderFunctionNode(node, top, x, nodeWidth, missingBefore);
                functionRenderGroups.set(node, r.group);
                for (let output of r.outputPorts) {
                    valueRendererMap.set(output.port as FunctionOutputPort, [output.container]);
                    outputRenderGroups.set(output.port as FunctionOutputPort, output.group);
                    stackItems.push(output)
                }
                x += nodeWidth;
                if (node.outputPorts.length == 0) {
                    missingBefore += nodeWidth;
                } else {
                    missingBefore = 0;
                }
            } else if (node instanceof WaypointNode) {
                let { container, port } = this.renderWaypointNode(node, top, x, nodeWidth, missingBefore);
                if (port) {
                    let containers = valueRendererMap.get(port);
                    containers?.push(container);
                }
                missingBefore = 0
                x += nodeWidth;
            } else if (node instanceof ArgumentNode) {
                let r = this.renderArgumentNode(node, top, x, nodeWidth, outputRenderGroups);
                stackItems.push(r);
                valueRendererMap.set(r.port, [r.container]);
                x += nodeWidth;
            }
        }
        return { stackItems, missingEnd: missingBefore };
    }

    renderFunctionNode(node : FunctionNode, top : number, left : number, width : number, missingBefore : number) {
        const nodeHeight = 50;
        let border = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let pathSteps = [`M ${left} ${top}`];
        pathSteps.push(`h ${width}`);
        pathSteps.push(`v ${nodeHeight}`);
        if (node.outputPorts.length == 0) {
            //pathSteps.push(`l ${-width / 2} ${nodeHeight / 2}`);
            //pathSteps.push(`l ${-width / 2} ${-nodeHeight / 2}`);
            //pathSteps.push(`a ${width} ${nodeHeight} 0 0 1 ${-width} ${nodeHeight}`);
            //pathSteps.push(`q ${-width} ${0} ${-width} ${nodeHeight}`);
            pathSteps.push(`c ${-width / 4} ${nodeHeight} ${-width} ${0} ${-width} ${nodeHeight}`);
        } else {
            pathSteps.push(`h ${-width}`);
        }
        pathSteps.push(`z`);
        pathSteps = [];
        pathSteps.push(`M${left},${top}`);
        pathSteps.push(`h ${width / 2}`);
        pathSteps.push(`a 0 0 0 0 1 0 0`);
        pathSteps.push(`h ${width / 2}`);
        pathSteps.push(`v ${nodeHeight}`);
        if (node.outputPorts.length == 0) {
            pathSteps.push(`c ${-width / 4} ${nodeHeight} ${-width} ${0} ${-width} ${nodeHeight}`);
            pathSteps.push(`h 0`);
            pathSteps.push(`v 0`);
            pathSteps.push(`h 0`);
        } else {
            pathSteps.push(`c 0 0 0 0 0 0`);
            pathSteps.push(`h ${-width + 11}`);
            pathSteps.push(`v 0`);
            pathSteps.push(`h -11`);
        }
        // M 1 1    h 255.8 a 0 0 0 0 1 0 0      h 255.8 v 50 h -500.6 v 0  h -11 z
        // M 50 141 h 0     a 150 50 0 0 1 150 0 h 0    v 20  h -139   v 50 h -11 z
        // M 50 141         a 150 50 0 0 1 150 0         v 20 h -139   v 50 h -11 z
        for (let input of node.inputPorts) {
            pathSteps.push(`v 0`);
            pathSteps.push(`a 0 0 0 0 0 0 0`)
            pathSteps.push(`v 0`);
        }
        pathSteps.push(`z`);
        border.style.transition = '0.5s';
        border.setAttribute("d", pathSteps.join(" "));
        border.setAttribute("fill", "#bbb");
        border.setAttribute("stroke", "black");
        border.setAttribute("stroke-width", "1");
        let functionGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        functionGroup.appendChild(border);
        let labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        labelText.classList.add('function-label')
        labelText.setAttribute("x", `${left + width / 2}`);
        labelText.setAttribute("y", `${top + nodeHeight / 2}`);
        labelText.setAttribute("text-anchor", "middle");
        labelText.setAttribute("dominant-baseline", "middle");
        labelText.textContent = node.label;
        functionGroup.appendChild(labelText);
        this.svg.appendChild(functionGroup);

        functionGroup.addEventListener('click', () => {
                let funcs = node.graph.functions.getFittingFunctions(
                    node.inputPorts.filter(ip => ip.connections.length).map((ip) => ip.connections[0].source?.type),
                    node.outputPorts.map((op) => op.type), node.func)
                if (funcs.length == 0)
                    return;
                const extra : {[key : string]: () => void}= {
                    'Delete': () => {
                        node.removeExtend();
                    }
                }
                if (node.outputPorts.find(op => op.connections.length > 0)?.connections[0].destination) {
                    delete extra['Delete'];
                }
                this._showFunctionMenu(funcs, left + width / 2 - 100, top + 50,
                    extra).then(f => {
                    let originalFunction = node.func;
                    if (f) {
                        node.become(f);
                        this.render(true, {node, originalFunction});
                    } else {
                        this.render();
                    }
                })
            }
        );


        let outputPorts = new Array<OutputPortInfo>();
        let outputWidth = width / node.outputPorts.length;
        let x = left;
        let y = top + nodeHeight;
        for (let output of node.outputPorts) {
            outputPorts.push(this.renderOutputPort(output, x, y, outputWidth, missingBefore));
            x += outputWidth;
            missingBefore = 0
        }
        return {outputPorts: outputPorts, group: functionGroup};
    }

    renderOutputPort(port : FunctionOutputPort | ArgumentOutputPort, left : number, top : number, width : number, missingBefore : number) : OutputPortInfo {
        const outputHeight = 50
        let portGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        let border = document.createElementNS("http://www.w3.org/2000/svg", "path");
        // M 61 161 h 139 v 15 a 10 11 0 0 1 0 20 v 15 h -139

        // M1,51   h 852 v 50 a 0 0 0 0 1 0 0    v 0  h -852 h 0  c 0 0 0 0 0 0 z
        // M61,157 h 139 v 15 a 10 11 0 0 1 0 20 v 15 h -139 h 0  c 0 0 0 0 0 0 z
        let pathSteps = [`M${left},${top}`];
        pathSteps.push(`h ${width}`);
        pathSteps.push(`v ${outputHeight}`);
        pathSteps.push(`a 0 0 0 0 1 0 0`);
        pathSteps.push(`v 0`)
        pathSteps.push(`h ${-width}`);
        if (missingBefore) {
            pathSteps.push(`h ${-missingBefore}`)
            pathSteps.push(`c ${0} ${-outputHeight} ${width / 4} ${0} ${missingBefore} ${-outputHeight}`);
        } else {
            // To make a consistent shape for animations
            pathSteps.push(`h 0`)
            pathSteps.push(`c 0 0 0 0 0 0`);
            //pathSteps.push(`q ${0} ${-outputHeight} ${missingBefore} ${-outputHeight}`)
            /*;
            pathSteps.push(`v ${-outputHeight / 2}`)
            pathSteps.push(`l ${missingBefore} ${-outputHeight / 2}`);*/
        }
        pathSteps.push(`z`);
        border.setAttribute("d", pathSteps.join(" "));
        border.setAttribute("fill", "#eee");
        border.setAttribute("stroke", "black");
        border.setAttribute("stroke-width", "1");
        border.style.transition = '0.5s';
        portGroup.classList.add('grid-output-port');
        if (port.connections.length > 0 && port.connections[0].destination) {// || this.graph.resultPorts.find(x => x.port === port)) {
            portGroup.classList.add('connected');
        } else {
            setUpOutputForDrag(this, port, port.parentNode, portGroup)
        }
        portGroup.appendChild(border);
        let labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        labelText.setAttribute("x", `${left + width}`);
        labelText.setAttribute("y", `${top}`);
        labelText.setAttribute("text-anchor", "end");
        labelText.setAttribute("dominant-baseline", "hanging");
        labelText.textContent = port.label;
        portGroup.appendChild(labelText);
        let foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObject.setAttribute("x", `${left}`);
        foreignObject.setAttribute("y", `${top}`);
        foreignObject.setAttribute("width", `${width - 1}`);
        foreignObject.setAttribute("height", `${outputHeight}`);
        foreignObject.style.transition = 'x 0.5s, y 0.5s, width 0.5s, height 0.5s'
        portGroup.appendChild(foreignObject);
        this.svg.append(portGroup)
        return {
            container: foreignObject,
            group: portGroup,
            port: port,
            width : width + missingBefore,
            x : left - missingBefore,
            y : top,
        }
    }

    renderWaypointNode(node : WaypointNode, top : number, left : number, width: number, missingBefore : number = 0) {
        const nodeHeight = 50;
        let group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        let border = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let pathSteps = [`M ${left} ${top}`];
        pathSteps.push(`h ${width}`);
        pathSteps.push(`v ${nodeHeight * 2}`);
        pathSteps.push(`h ${-width}`);
        if (missingBefore) {
            pathSteps.push(`h ${-missingBefore}`)
            pathSteps.push(`c ${0} ${-nodeHeight} ${width / 4} ${0} ${missingBefore} ${-nodeHeight}`);
        }
        pathSteps.push(`z`);
        border.setAttribute("d", pathSteps.join(" "));
        border.setAttribute("fill", "#eee");
        border.setAttribute("stroke", "black");
        border.setAttribute("stroke-width", "1");
        group.appendChild(border);
        // Dashed vertical line down the middle
        let midVertLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let midVertLineSteps = [`M ${left + width / 2} ${top}`];
        midVertLineSteps.push(`v ${nodeHeight }`);
        midVertLine.setAttribute("d", midVertLineSteps.join(" "));
        midVertLine.setAttribute("stroke", "black");
        midVertLine.setAttribute("stroke-width", "1");
        midVertLine.setAttribute("stroke-dasharray", "5,5");
        group.appendChild(midVertLine);
        let fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        fo.setAttribute("x", `${left}`);
        fo.setAttribute("y", `${top + nodeHeight}`);
        fo.setAttribute("width", `${width}`);
        fo.setAttribute("height", `${nodeHeight}`);
        group.appendChild(fo);
        group.classList.add('grid-waypoint')
        this.svg.appendChild(group);
        //portGroup.classList.add('grid-output-port');
        if (node.connections.length > 0 && node.connections[0].destination) {// || this.graph.resultPorts.find(x => x.port === port)) {
            group.classList.add('connected');
        } else {
            setUpOutputForDrag(this, node.connections[0].source!, node, group)
        }
        return { container: fo, port: node.connections[0]?.source }
    }

}

let selectedPorts = new Array<{ port: FunctionOutputPort | ArgumentOutputPort, group: SVGGElement, node: GraphNode }>();

function clearSelection() {
    selectedPorts.forEach(x => x.group.classList.remove('selected'))
    selectedPorts = [];
}

function setUpOutputForDrag(renderer: GridRenderer, port: FunctionOutputPort | ArgumentOutputPort, node: GraphNode, portGroup: SVGGElement) {
    portGroup.addEventListener('mousedown', function(ev) {
        portGroup.classList.add('selected');
        selectedPorts = [{ port: port, group: portGroup, node }]
        ev.preventDefault();
    })
    portGroup.addEventListener('mouseenter', async function(ev) {
        if (selectedPorts.length) {
            let first = selectedPorts[0];
            if (first.node.layer != node.layer) {
                clearSelection();
                return;
            }
            portGroup.classList.add('selected');
            selectedPorts.push({ port: port, group: portGroup, node })
            selectedPorts.sort((a, b) => a.group.getBBox().x - b.group.getBBox().x)
        }
    })
    portGroup.addEventListener('mouseup', async function(ev) {
        let funcs = renderer.graph.functions.getAcceptingFunctions(selectedPorts.map(x => x.port.type))
        let svgBCR = renderer.svg.getBoundingClientRect();
        let bb = portGroup.getBoundingClientRect();
        let sel = selectedPorts;
        if (!sel.length)
            return;
        selectedPorts = [];
        let f = await renderer._showFunctionMenu(funcs, bb.x - svgBCR.x + bb.width / 2 - 100, bb.y - svgBCR.y + bb.height)
        if (f) {
            let first = sel[0];
            let layerIdx = first.node.layer;

            let node = renderer.graph.nodeForFunction(f);
            node.layer = layerIdx + 1;

            // Ensure there is a full layer of waypoints after the layer
            // we are inserting into. 
            if (node.layer + 1 >= renderer.graph.layers.length) {
                let lastLayer = renderer.graph.getLayer(renderer.graph.layers.length - 1);
                let nextLayer = renderer.graph.getLayer(renderer.graph.layers.length);
                for (let node of lastLayer) {
                    if (node instanceof FunctionNode) {
                        for (let op of node.outputPorts) {
                            let conn = new GraphConnection(op);
                            let newWP = new WaypointNode(renderer.graph, conn);
                            newWP.layer = node.layer + 1;
                            nextLayer.push(newWP);
                            conn.via.push(newWP);
                            op.connections.push(conn);
                        }
                    } else if (node instanceof WaypointNode) {
                        let conn = node.connections[0];
                        let newWP = new WaypointNode(renderer.graph, conn);
                        newWP.layer = node.layer + 1;
                        nextLayer.push(newWP);
                        conn.via.push(newWP);
                    } else if (node instanceof ArgumentNode) {
                        let conn = node.connections[0];
                        let newWP = new WaypointNode(renderer.graph, conn);
                        newWP.layer = node.layer + 1;
                        nextLayer.push(newWP);
                        conn.via.push(newWP);
                    }
                }
            }

            let laterLayers = new Array<Array<WaypointNode>>();
            for (let i = 0; i < sel.length; i++) {
                let port = sel[i].port;
                if (port.connections.length) {
                    for (let wp of port.connections[0].via) {
                        if (wp.layer > layerIdx) {
                            if (!laterLayers[wp.layer]) {
                                laterLayers[wp.layer] = [];
                            }
                            laterLayers[wp.layer].push(wp);
                        }
                    }
                }
                let newPort = node.inputPorts[i];
                let conn = port.connections.length ? port.connections[0] : new GraphConnection(port, newPort);
                conn.via = conn.via.filter(x => x.layer <= layerIdx);
                newPort.connections.push(conn);
                conn.destination = newPort;
                port.connections = [conn];
                renderer.graph.resultPorts = renderer.graph.resultPorts.filter(x => x.connection.source !== port);
            }
            
            let nodeLayer = renderer.graph.getLayer(node.layer);
            console.log(node.layer, laterLayers)
            let nodeLayerWPs = laterLayers[node.layer];
            let firstWPIndex = nodeLayerWPs ? nodeLayer.indexOf(nodeLayerWPs[0]) : nodeLayer.length;
            nodeLayer.splice(firstWPIndex, nodeLayerWPs.length, node);

            for (let i = node.layer + 1; i < renderer.graph.layers.length; i++) {
                let lay = renderer.graph.getLayer(i);
                let wps = laterLayers[i];
                let st = lay.indexOf(wps[0]);
                let newWPs = new Array<WaypointNode>();
                for (let op of node.outputPorts) {
                    let conn = op.connections[0] ?? new GraphConnection(op);
                    let newWP = new WaypointNode(renderer.graph, conn);
                    newWP.layer = i;
                    newWPs.push(newWP);
                    conn.via.push(newWP);
                    op.connections[0] = conn;
                }
                if (st >= 0) {
                    lay.splice(st, wps.length, ...newWPs);
                }
            }

            let nextLayer = renderer.graph.getLayer(renderer.graph.layers.length - 1);
            renderer.graph.resultPorts = [];
            for (let l of nextLayer) {
                if (l instanceof WaypointNode) {
                    renderer.graph.resultPorts.push({ port: l.connections[0].source!, connection: l.connections[0] })
                } else if (l instanceof FunctionNode) {
                    for (let op of l.outputPorts) {
                        renderer.graph.resultPorts.push({ port: op, connection: op.connections[0] })
                    }
                } else if (l instanceof ArgumentNode) {
                    renderer.graph.resultPorts.push({ port: l.connections[0].source!, connection: l.connections[0] })
                }
            }

            // if (nextLayer.length == 0) {
            //     for (let l of nodeLayer) {
            //         if (l instanceof WaypointNode) {
            //             let newWP = new WaypointNode(l.graph, l.connections[0]);
            //             newWP.layer = l.layer + 1;
            //             nextLayer.push(newWP);
            //             newWP.connections[0].via.push(newWP);
            //             renderer.graph.resultPorts.push({ port: newWP.connections[0].source!, connection: newWP.connections[0] })
            //         } else if (l instanceof FunctionNode) {
            //             for (let op of l.outputPorts) {
            //                 let conn = new GraphConnection(op);
            //                 let newWP = new WaypointNode(l.graph, conn);
            //                 newWP.layer = l.layer + 1;
            //                 nextLayer.push(newWP);
            //                 newWP.connections[0].via.push(newWP);
            //                 op.connections.push(conn);
            //                 renderer.graph.resultPorts.push({ port: op, connection: conn });
            //             }
            //         }
            //     }
            // }                    
            renderer.graph.describe();
        }
        renderer.render()
    })
}