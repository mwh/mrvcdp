import SubductFunction from "../functions/SubductFunction.js";
import GraphConnection from "../layers/connections.js";
import FunctionNode, { ArgumentOutputPort, FunctionOutputPort } from "../layers/functionnode.js";
import LayerGraph from "../layers/layergraph.js";
import GraphNode, { ArgumentNode, WaypointNode } from "../layers/node.js";
import * as parser from "../linear/parser.js"

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

export default class TextRenderer {
    graph: LayerGraph;
    svg: any;
    nodeData = new Map<GraphNode, NodeData>();
    connectionColours = new Map<GraphConnection, string>();
    connectionGroup: SVGGElement;
    colourIndex : number = 0;
    laidOut : boolean = false;
    _renderListeners : Array<(r : RenderResult) => void> = [];
    wordObjects = new Map<GraphNode, SVGForeignObjectElement>();
    
    constructor(graph : LayerGraph, svg : SVGElement) {
        this.graph = graph;
        this.svg = svg;
        let connectionGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        svg.appendChild(connectionGroup);
        this.connectionGroup = connectionGroup;
    }

    render(clear=true) : RenderResult {
        this.svg.width.baseVal.convertToSpecifiedUnits(5); // pixels
        let availableSpace = this.svg.width.baseVal.valueInSpecifiedUnits;
        let valueRendererMap = new Map<FunctionOutputPort | ArgumentOutputPort, Array<Element>>();
        let functionRenderGroups = new Map<FunctionNode, SVGGElement>();
        let outputRenderGroups = new Map<FunctionOutputPort | ArgumentOutputPort, SVGGElement>();
        let top = 1
        if (this.graph.layers.length == 0) {
            return { valueContainers: valueRendererMap, functionRenderGroups, outputRenderGroups }
        }

        let nodes = this.lineariseNodes();
        console.log("--------------");
        console.log(nodes);
        console.log(nodes.map(n => n.label).join(" "));
        console.log("--------------");
        let x = 1;
        top = 3;
        let textSoFar = "";
        let words : Array<[string, SVGForeignObjectElement | null]> = [];
        for (let r of this.graph.layers[0]) {
            if (r instanceof ArgumentNode)
                words.push([r.port.type.toString() +
                    (r.port.label != '' ? ':' + r.port.label : ''), null]);
        }
        if (words.length) {
            words.push(["::", null]);
        }
        console.log(words);
        for (let n of nodes) {
            let fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
            words.push([(n as FunctionNode).func.name, fo]);
            this.wordObjects.set(n, fo);
        }
        let idx = 0;
        // Test for offset of spaces in one text vs multiple
        let spaceOffset = testSpaceOffset(this.svg);
        // Render the words for real
        for (let [w, fo] of words) {
            let txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
            txt.textContent = w;
            txt.setAttribute("x", x.toString());
            txt.setAttribute("y", top.toString());
            txt.setAttribute("text-anchor", "start");
            txt.setAttribute("dominant-baseline", "hanging");
            txt.setAttribute("font-size", "18");
            txt.setAttribute("font-family", "monospace");
            txt.setAttribute("fill", "black");
            this.svg.appendChild(txt);
            let bcr = txt.getBoundingClientRect()
            x += txt.getBoundingClientRect().width;
            if (!fo)
                fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
            console.log('bcr', bcr)
            fo.setAttribute("x", txt.getAttribute("x")!);
            fo.setAttribute("y", txt.getAttribute("y")!);
            fo.setAttribute("width", bcr.width.toString());
            fo.setAttribute("height", bcr.height.toString());
            let sp = document.createElement("div");
            sp.style.font = '18px monospace';
            sp.style.color = 'black';
            sp.style.lineHeight = '1';
            sp.style.marginTop = '-2px';
            sp.textContent = w;
            fo.appendChild(sp);
            this.svg.appendChild(fo);
            this.svg.removeChild(txt);
            x = bcr.left + bcr.width;
            let spcTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
            spcTxt.textContent = " ";
            spcTxt.setAttribute("x", x.toString());
            spcTxt.setAttribute("y", top.toString());
            spcTxt.setAttribute("text-anchor", "start");
            spcTxt.setAttribute("dominant-baseline", "hanging");
            spcTxt.setAttribute("font-size", "18");
            spcTxt.setAttribute("font-family", "monospace");
            spcTxt.setAttribute("fill", "black");
            spcTxt.style.whiteSpace = "pre";
            this.svg.appendChild(spcTxt);
            bcr = spcTxt.getBoundingClientRect()
            x = bcr.left + bcr.width - spaceOffset;
            textSoFar += w + " ";
            txt.setAttribute("index", (idx).toString());
            idx++;
        }
        this.svg.addEventListener("click", (ev : MouseEvent) => {
            let fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
            fo.setAttribute("x", "1");
            fo.setAttribute("y", "0");
            fo.setAttribute("width", "100%");
            fo.setAttribute("height", "100%");
            let textArea = document.createElement("textarea");
            textArea.value = textSoFar;
            fo.appendChild(textArea);
            textArea.style.background = 'white'
            textArea.style.border = "0";
            textArea.style.padding = "0";
            textArea.style.margin = "0";
            textArea.style.font = '18px monospace';
            textArea.style.width = "100%";
            textArea.style.height = "100%";
            this.svg.appendChild(fo);
            textArea.focus();
            let idx = Number((ev.target as SVGTextElement).getAttribute("index"));
            console.log('idx', idx);
            console.log(ev);
            let pos = 0;
            for (let i = 0; i < idx; i++) {
                pos += words[i].length + 1;
            }
            let bcr = (ev.target as SVGTextElement).getBoundingClientRect();
            pos += Math.floor((ev.offsetX - bcr.left) / bcr.width * words[idx].length);
            if (ev.target === this.svg)
                pos = textArea.value.length;
            console.log('pos', pos)
            textArea.setSelectionRange(pos, pos);
            textArea.addEventListener('input', () => {
                try {
                    let g = parser.toGraph(parser.parse(textArea.value));
                    parser.toGraph(parser.parse(textArea.value), this.graph);
                    textArea.style.background = 'white'
                } catch (e) {
                    textArea.style.background = '#fee'
                }
            })
        }, { once: true })
        const ret = { valueContainers: valueRendererMap, functionRenderGroups, outputRenderGroups };
        for (let listener of this._renderListeners) {
            listener(ret);
        }
        return ret;
    }

    // linHelper(r, dests) {
    //     if (r < 0) return true
    //     let row = this.getRow(r)
    //     let tmpStack = []
    //     let thisRow = []
    //     for (let w of row.items) {
    //         let produces = dests.splice(0, w.type.produces.length)
    //         let pre = []
    //         thisRow.push({pre, word: w, prod: produces[0]})
    //         for (let u of w.type.uses) {
    //             tmpStack.push(pre)
    //         }
    //     }
    //     if (!this.linHelper(r - 1, tmpStack))
    //         return false
    //     for (let x of thisRow) {
    //         x.prod.push(...x.pre)
    //         x.prod.push(x.word)
    //     }
    //     return true
    // }

    

    _linHelper(r : number, dests : GraphNode[][]) {
        if (r < 0)
            return true;
        let layer = this.graph.layers[r];
        let tmpStack = [];
        let thisLayer = [];
        for (let w of layer) {
            let produces;
            let pre = new Array<GraphNode>();
            if (w instanceof WaypointNode) {
                produces = dests.splice(0, 1);
                tmpStack.push(pre);
            } else if (w instanceof FunctionNode) {
                produces = dests.splice(0, w.outputPorts.length);
                if (w.outputPorts.length == 0)
                    console.log('no outputs, prod', Array.from(produces));
                for (let u of w.inputPorts) {
                    tmpStack.push(pre);
                }

            } else {
                produces = dests.splice(0, 1);
            }
            thisLayer.push({pre, node: w, prod: produces[0] ?? null});
        }
        for (let i = 0; i < thisLayer.length; i++) {
            let x = thisLayer[i];
            if (x.prod == null) {
                x.prod = thisLayer[i - 1].prod;
            }
        }
        console.log("pre-recurse", r, tmpStack, thisLayer);
        this._linHelper(r - 1, tmpStack);
        for (let x of thisLayer) {
            x.prod.push(...x.pre);
            x.prod.push(x.node);
            console.log("adding in", x, "prod now", Array.from(x.prod))
        }
        console.log("pre-return", r, tmpStack, thisLayer);
        return true;
    }

    // linearise() {
    //     if (!this.isLinear())
    //         return null
    //     let prog = []
    //     for (let w of this.rows[this.rows.length - 1].items) {
    //         for (let u of w.type.produces) {
    //             prog.push([])
    //         }
    //     }
    //     if (this.linHelper(this.rows.length - 1, prog.map(x=>x))) {
    //         return prog.flatMap(x=>x).filter(x => !(x instanceof PassThrough))
    //     }
    //     return null
    // }

    lineariseNodes() : Array<GraphNode> {
        let prog : Array<Array<GraphNode>> = this.graph.resultPorts.flatMap(_ => [[],[],[]]);
        this._linHelper(this.graph.layers.length - 1, Array.from(prog));
        console.log("prog", prog)
        return prog.flatMap(x => x).filter(x => !(x instanceof WaypointNode || x instanceof ArgumentNode));
    }

    addRenderListener(listener : (r : RenderResult) => void) {
        this._renderListeners.push(listener);
    }

    renderAddButton(x : number, y : number) {

    }

    async _showFunctionMenu(functions : Array<SubductFunction>, x : number, y : number) : Promise<SubductFunction | null> {
        return null;
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
        midVertLineSteps.push(`v ${nodeHeight * 2}`);
        midVertLine.setAttribute("d", midVertLineSteps.join(" "));
        midVertLine.setAttribute("stroke", "black");
        midVertLine.setAttribute("stroke-width", "1");
        midVertLine.setAttribute("stroke-dasharray", "5,5");
        group.appendChild(midVertLine);
        let fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        fo.setAttribute("x", `${left}`);
        fo.setAttribute("y", `${top + nodeHeight * 0.5}`);
        fo.setAttribute("width", `${width}`);
        fo.setAttribute("height", `${nodeHeight}`);
        group.appendChild(fo);
        group.classList.add('grid-waypoint')
        this.svg.appendChild(group);
        return { container: fo, port: node.connections[0]?.source }
    }

}

// Some browsers render a standalone space differently to a space
// in a string. This is a test to see if we need to offset the
// layout of words by a pixel to compensate and make the text
// area line up correctly.
function testSpaceOffset(svg : SVGSVGElement) {
    let wa = document.createElementNS("http://www.w3.org/2000/svg", "text");
    wa.textContent = "a";
    wa.setAttribute("x", "0");
    wa.setAttribute("y", "30");
    wa.setAttribute("text-anchor", "start");
    wa.setAttribute("dominant-baseline", "hanging");
    wa.setAttribute("font-size", "18");
    wa.setAttribute("font-family", "monospace");
    wa.setAttribute("fill", "blue");
    svg.appendChild(wa);
    let bcr = wa.getBoundingClientRect();
    //console.log("OFFSET A", bcr.left + bcr.width, bcr.left, bcr.width)
    let ws = document.createElementNS("http://www.w3.org/2000/svg", "text");
    ws.textContent = " ";
    ws.setAttribute("x", (bcr.left + bcr.width).toString());
    ws.setAttribute("y", "30");
    ws.setAttribute("text-anchor", "start");
    ws.setAttribute("dominant-baseline", "hanging");
    ws.setAttribute("font-size", "18");
    ws.setAttribute("font-family", "monospace");
    ws.setAttribute("fill", "blue");
    ws.style.whiteSpace = "pre";
    svg.appendChild(ws);
    bcr = ws.getBoundingClientRect();
    //console.log("OFFSET S", bcr.left + bcr.width, bcr.left, bcr.width)
    let wb = document.createElementNS("http://www.w3.org/2000/svg", "text");
    wb.textContent = "b";
    wb.setAttribute("x", (bcr.left + bcr.width - 0).toString());
    wb.setAttribute("y", "30");
    wb.setAttribute("text-anchor", "start");
    wb.setAttribute("dominant-baseline", "hanging");
    wb.setAttribute("font-size", "18");
    wb.setAttribute("font-family", "monospace");
    wb.setAttribute("fill", "blue");
    svg.appendChild(wb);
    bcr = wb.getBoundingClientRect();
    //console.log("OFFSET B", bcr.left + bcr.width, bcr.left, bcr.width)
    let wasb = document.createElementNS("http://www.w3.org/2000/svg", "text");
    wasb.textContent = "a b";
    wasb.setAttribute("x", "0");
    wasb.setAttribute("y", "30");
    wasb.setAttribute("text-anchor", "start");
    wasb.setAttribute("dominant-baseline", "hanging");
    wasb.setAttribute("font-size", "18");
    wasb.setAttribute("font-family", "monospace");
    wasb.setAttribute("fill", "red");
    svg.appendChild(wasb);
    let bcr2 = wasb.getBoundingClientRect();
    //console.log("OFFSET *", bcr2.left + bcr2.width, bcr2.left, bcr2.width)
    let w1 = bcr.left + bcr.width;
    let w2 = bcr2.left + bcr2.width;
    wa.remove();
    wb.remove();
    ws.remove();
    wasb.remove();
    //console.log('OFFSET DIFF', w1, w2, w2 - w1)
    if (Math.abs(w2 - w1) < 0.5) {
        return 0;
    } else {
        return 1;
    }
}