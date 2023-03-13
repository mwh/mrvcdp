import * as parser from "./linear/parser.js"
import LayerGraph, { EvaluationContext } from "./layers/layergraph.js"
import * as functions from "./functions/function.js"
import SubductFunction from "./functions/SubductFunction.js";
import FunctionNode, * as functionnodes from "./layers/functionnode.js"
import GraphRenderer, { RenderResult } from "./renderers/graphrenderer.js";

import * as gridconverter from "./gridconverter.js"
import GridRenderer from "./renderers/gridrenderer.js";
import { FunctionOutputPort } from "./layers/functionnode.js";
import * as csvloader from './csvloader.js';
import { ArgumentNode, WaypointNode } from "./layers/node.js";
import TextRenderer from "./renderers/textrenderer.js";

import * as colourdata from './functions/colourdata.js';
import * as types from './functions/types.js';
import GraphConnection from "./layers/connections.js";


let tabFunctions = [] as Array<{graph : LayerGraph, name : string, viewMode : string, data : Array<Array<any>>, userFunc: SubductFunction | undefined}>;

let currentTabFunction : {graph : LayerGraph, name : string, viewMode : string, data : Array<Array<any>>, userFunc : SubductFunction | undefined } | undefined;

let graph = new LayerGraph();


let progSVG = document.getElementById("progSVG") as unknown as SVGSVGElement;
let origProgSVG = progSVG.cloneNode(true) as unknown as SVGElement;

//let renderer = new GraphRenderer(graph, progSVG);

let opm //= renderer.render()


//gridconverter.graph.describe()"

let pr = parser.parse(" 5 3 ((some numbers)) 2 dup div")
pr = parser.parse("1 2 add 3 4 5 mul sub add")
pr = parser.parse("\"test\" 1 2 add 3 mul 4 sub swap length add dup dup dup dup add mul sub add")
pr = parser.parse('"test" dup concat 1 2 add 3 mul 4 double sub swap length add dup dup dup dup add mul sub add')
pr = parser.parse("1 drop 2 dup 3 add double mul")
pr = parser.parse("1 2 3 bury:3")
pr = parser.parse("colour:c69801 to-rgb drop swap double colour:008678 complement dup to-hsl drop:2 swap bury mul");

graph = parser.toGraph(pr)
let renderer : GridRenderer | GraphRenderer | TextRenderer = new GraphRenderer(graph, progSVG);
let renderInfo = renderer.render()
opm = renderInfo.valueContainers

function renderValue(parent : Element, value : any, type : types.Type) {
    if (type._name == "stream") {
        parent.textContent = type.toString();
    } else if (type === types.colour) {
        let rgb = value as {r: number, g: number, b: number};
        let colSp = document.createElement("span");
        colSp.style.display = 'inline-block';
        //colSp.style.width = '20px';
        //colSp.style.height = '20px';
        colSp.style.borderTop = 'solid 10px ' + `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        parent.append(colSp);
        colSp.textContent = (colourdata.nameColour(rgb).replace(/-/g, ' '));
    } else if (type === types.float) {
        parent.textContent = value.toFixed(3).replace(/00+$/, '0');
    } else if (type instanceof types.RecordType) {
        parent.textContent = type.toString();
    } else if (type === types.image) {
        let img = document.createElement("img");
        img.src = value;
        img.style.maxHeight = '100%';
        parent.append(img);
        img.addEventListener('mousedown', (ev) => {
            ev.stopPropagation();
            let img = document.createElement("img");
            img.src = value;
            img.style.maxHeight = '100%';
            let div = document.createElement("div");
            div.style.overflowY = 'auto';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.flexDirection = 'column';
            div.append(img);
            let modal = document.createElement("div");
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            modal.style.zIndex = '100';
            modal.append(div);
            document.body.append(modal);
            modal.addEventListener('click', () => {
                modal.remove();
            })
        })
    } else if (value !== undefined && value !== null) {
        parent.textContent = value.toString()
    } else
        parent.textContent = type.toString();
}

function renderValues(ctx : { getOutput(port : FunctionOutputPort | functionnodes.ArgumentOutputPort) : any},
    opm : Map<FunctionOutputPort | functionnodes.ArgumentOutputPort, Array<Element>>) {
    for (let port of opm.keys()) {
        for (let el of opm.get(port)!) {
            while (el.firstChild)
                el.removeChild(el.firstChild);
            let div = document.createElement("div")
            let op = ctx.getOutput(port)
            let type = ''
            div.style.overflowY = 'auto';
            renderValue(div, op, port.type);
            // if (typeof port.type == 'string')
            //     type = port.type;
            // if (type.startsWith("stream")) {
            //     div.textContent = port.type.toString();
            // } else if (type == 'colour') {
            //     let colSp = document.createElement("span");
            //     colSp.style.display = 'inline-block';
            //     //colSp.style.width = '20px';
            //     //colSp.style.height = '20px';
            //     colSp.style.borderTop = 'solid 10px ' + op.toString();
            //     div.append(colSp);
            //     colSp.textContent = (colourdata.nameColour(op.toString()).replace(/-/g, ' '));
            // } else if (type == 'float') {
            //     div.textContent = op.toFixed(3).replace(/00+$/, '0');
            // } else if (op !== undefined && op !== null)
            //     div.textContent = op.toString()
            // else
            //     div.textContent = port.type.toString();
            div.style.textAlign = 'center'
            //div.style.background = '#eee'
            div.style.margin = '2px'
            //div.style.width = '100%';
            div.style.height = '100%';
            el.appendChild(div)
        }
    }
}
let ctx = await graph.evaluate2()
renderValues(ctx, opm);

currentTabFunction = {graph, name: "Main", viewMode: "grid", data : [], userFunc: undefined };
tabFunctions.push(currentTabFunction);
if (true) {
    let graph = parser.toGraph(parser.parse("1 2 add"));
    let sdf = new SubductFunction("Other", [], graph.resultPorts.map(x => x.port), async () => {
        let ev = await otherTF.graph.evaluate2()
        return ev.returnValues
    })
    let otherTF = { graph, name: "Other", viewMode: "graph", data : [], userFunc: sdf }
    tabFunctions.push(otherTF)
    functions.BuiltinFunctions.addFunction(sdf);
}

function updateTabBar(activeTab? : {graph : LayerGraph, name : string, viewMode : string}) {
    if (currentTabFunction) {
        if (currentTabFunction.userFunc) {
            let sdf = currentTabFunction.userFunc;
            sdf.outputs = currentTabFunction.graph.resultPorts.map(x => x.port);
        }
    }
    let tabBar = document.getElementById("tab-bar")!;
    tabBar.innerHTML = '';
    for (let tab of tabFunctions) {
        let tabButton = document.createElement("li");
        tabButton.textContent = tab.name;
        tabButton.addEventListener("click", () => {
            (document.getElementById('render_mode_text') as HTMLInputElement).checked = false;
            (document.getElementById('render_mode_grid') as HTMLInputElement).checked = false;
            (document.getElementById('render_mode_graph') as HTMLInputElement).checked = false;
            (document.getElementById('render_mode_' + tab.viewMode) as HTMLInputElement).checked = true;
            updateTabContent(tab);
            updateTabBar(tab);
            currentTabFunction = tab;
            //currentTabFunction.graph.describe();
        })
        if (activeTab === tab)
            tabButton.style.background = '#ddd';
        tabBar.appendChild(tabButton);
    }
    let newTabButton = document.createElement('li');
    newTabButton.style.paddingTop = '0';
    newTabButton.textContent = '+'
    tabBar.append(newTabButton);
    newTabButton.addEventListener('click', function() {
        let name = prompt("Function name") ?? "newfunction"
        let argTypeStr = prompt("Parameter types (space-separated, empty for none)")
        let graph = new LayerGraph(functions.BuiltinFunctions)
        let argPorts = [];
        if (argTypeStr) {
            let params = argTypeStr.split(' ');
            for (let i = 0; i < params.length; i++) {
                let param = params[i];
                let type = types.fromString(param)!
                let arg = new ArgumentNode(graph, '', type, i)
                graph.getLayer(0).push(arg);
                let conn = new GraphConnection(arg.port);
                let wp = new WaypointNode(graph, conn);
                wp.layer = 1;
                graph.getLayer(1).push(wp);
                conn.via.push(wp);
                arg.port.connections.push(conn);
                graph.resultPorts.push({port: arg.port, connection: conn})
                argPorts.push(arg.port)
            }
            graph.setArguments(argPorts);
        }
        let sdf = new SubductFunction(name, argPorts, graph.resultPorts.map(x => x.port), async (...args : any[]) => {
            let ev = await newTab.graph.evaluate2(args.length ? args : undefined)
            return ev.returnValues
        })
        let newTab = {graph, name, viewMode: "grid", data : [], userFunc: sdf};
        tabFunctions.push(newTab);
        functions.BuiltinFunctions.addFunction(sdf)
        updateTabContent(newTab);
        updateTabBar(newTab);
        currentTabFunction = newTab;
    })
}

let currentOutputValueMap = new Map<FunctionOutputPort | functionnodes.ArgumentOutputPort, Array<Element>>();

function createRenderListener(tab : {graph : LayerGraph, name : string, viewMode : string, data : Array<Array<any>>}, renderer : GridRenderer | GraphRenderer) {
    return async (opm : RenderResult, newFunc? : {node: FunctionNode, originalFunction? : SubductFunction}) => {
        graph.describe();
        renderInfo = opm;
        if (!graph.can2D()) {
            (document.getElementById('render_mode_grid') as HTMLInputElement).disabled = true;
            (document.getElementById('render_mode_text') as HTMLInputElement).disabled = true;
        } else {
            (document.getElementById('render_mode_grid') as HTMLInputElement).disabled = false;
            (document.getElementById('render_mode_text') as HTMLInputElement).disabled = !graph.isLinear(true);
        }
        let args = undefined
        let rowSelect = document.getElementById("row-select") as HTMLSelectElement;
        rowSelect.textContent = '';
        if (tab.data && tab.data.length && tab.data[0].length) {
            args = tab.data[0]
            for (let i = 0; i < Math.min(25, tab.data.length); i++) {
                let opt = document.createElement("option");
                opt.value = i.toString();
                opt.textContent = tab.data[i].join(", ");
                rowSelect.appendChild(opt);
            }
            renderResults();
        } else {
            document.getElementById("output")!.textContent = '';
        }
        let ctx : EvaluationContext = {
            getOutput(x:any) { return undefined; },
            returnValues : [[]],
            stopped : false,
        };
        if (graph.arguments.length == 0 || args)
            ctx = await graph.evaluate2(args);
        currentOutputValueMap = opm.valueContainers;
        if (tab.graph.resultPorts.length == 1 && types.AnyStream.accepts(tab.graph.resultPorts[0].port.type)) {
            let stream = ctx.returnValues![0][0] as AsyncIterable<Array<any>>;
            let results = [];
            for await (let result of stream) {
                results.push(result);
            }
            renderResults(results);
        }
        renderValues(ctx, opm.valueContainers);
        if (newFunc) {
            if (newFunc.node.func.otherConfig.edit) {
                let ed = newFunc.node.func.otherConfig.edit;
                if (ed.type == 'number') {
                    let n = prompt("Value for number");
                    if (n) {
                        let nn = Number(n);
                        newFunc.node.become(ed.create(nn));
                        renderer.render();
                    }
                } else if (ed.type == 'string') {
                    let n = prompt("Value for string");
                    if (n) {
                        newFunc.node.become(ed.create(n));
                        renderer.render();
                    }
                } else if (ed.type == 'text') {
                    let n = prompt("Text");
                    if (n) {
                        newFunc.node.become(ed.create(n, newFunc.node.inputPorts.map(x => x.type)));
                        renderer.render();
                    }
                } else if (ed.type == 'color') {
                    let input = document.createElement("input");
                    input.type = "color";
                    if (newFunc.originalFunction && newFunc.originalFunction.otherConfig.colourValue)
                        input.value = newFunc.originalFunction.otherConfig.colourValue;
                    input.addEventListener("change", () => {
                        newFunc.node.become(ed.create(input.value));
                        renderer.render();
                    })
                    input.click();
                }
            }
        }
    }
}

async function updateTabContent(tab : {graph : LayerGraph, name : string, viewMode : string, data : Array<Array<any>>}) {
    graph = tab.graph;
    let np = origProgSVG.cloneNode(true) as unknown as SVGSVGElement;
    progSVG.height.baseVal.convertToSpecifiedUnits(5);
    let pxHeight = progSVG.height.baseVal.valueInSpecifiedUnits;
    np.height.baseVal.newValueSpecifiedUnits(5, window.innerHeight - 0);
    np.width.baseVal.newValueSpecifiedUnits(5, window.innerWidth);
    progSVG.replaceWith(np)
    progSVG = np
    if (tab.viewMode == 'graph') {
        renderer = new GraphRenderer(graph, progSVG);
    } else if (tab.viewMode == 'grid') {
        renderer = new GridRenderer(graph, progSVG);
    } else {
        renderer = new TextRenderer(graph, progSVG);
    }
    renderer.addRenderListener(createRenderListener(tab, renderer));
    (document.getElementById('render_mode_text') as HTMLInputElement).checked = false;
    (document.getElementById('render_mode_grid') as HTMLInputElement).checked = false;
    (document.getElementById('render_mode_graph') as HTMLInputElement).checked = false;
    (document.getElementById('render_mode_' + tab.viewMode) as HTMLInputElement).checked = true;
    renderer.render();
}

let rowSelect = document.getElementById('row-select') as HTMLSelectElement;
rowSelect.addEventListener('change', async function() {
    let ctx = await graph.evaluate2(currentTabFunction!.data[parseInt(rowSelect.value)]);
    //console.log('ctx', ctx, 'row', parseInt(rowSelect.value), 'args', currentTabFunction!.data[parseInt(rowSelect.value)]);
    //console.log('data', currentTabFunction!.data)
    //console.log('opm', currentOutputValueMap)
    renderValues(ctx, currentOutputValueMap);
})

updateTabBar(currentTabFunction);
updateTabContent(currentTabFunction);

let hbvv = (<any>progSVG).height.baseVal.value
document.getElementById('concat-entry')?.addEventListener('keydown', async function (e) {
    if (e.key == 'Enter') {
        let renderType = {'text': TextRenderer, 'grid': GridRenderer, 'graph': GraphRenderer}[currentTabFunction!.viewMode]!;
        //progSVG.setAttribute("width", "100%")
        //(<any>progSVG).width.baseVal.value = window.innerWidth
        let np = origProgSVG.cloneNode(true) as unknown as SVGSVGElement;
        progSVG.height.baseVal.convertToSpecifiedUnits(5);
        let pxHeight = progSVG.height.baseVal.valueInSpecifiedUnits;
        np.height.baseVal.newValueSpecifiedUnits(5, window.innerHeight - this.offsetHeight);
        np.width.baseVal.newValueSpecifiedUnits(5, window.innerWidth);
        progSVG.replaceWith(np)
        progSVG = np
        let pr = parser.parse((e.target as HTMLInputElement).value)
        graph = parser.toGraph(pr)
        //await graph.evaluate2();
        currentTabFunction!.graph = graph;
        let renderer = new renderType(graph, progSVG);
        renderInfo = renderer.render()
        opm = renderInfo.valueContainers
        currentOutputValueMap = opm;
        if (currentTabFunction && currentTabFunction.data && currentTabFunction.data.length && currentTabFunction.data[0].length) {
            let rowSelect = document.getElementById("row-select") as HTMLSelectElement;
            ctx = await graph.evaluate2(currentTabFunction.data[Number(rowSelect.value) ?? 0]);
        } else if (graph.arguments.length == 0) {
            ctx = await graph.evaluate2()
        } else {
            ctx = {
                getOutput(x:any) { return undefined; },
                returnValues : [[]],
                stopped : false,
            };
        }
        renderValues(ctx, opm);
        updateTabContent(currentTabFunction!);
    }
})

document.getElementById('render_mode_graph')?.addEventListener('change', async (e) => {
    if (currentTabFunction!.viewMode == 'grid')
        await animateGridToGraph();
    if (currentTabFunction!.viewMode == 'text') {
        await animateTextToGrid();
        await animateGridToGraph();
    }
    currentTabFunction!.viewMode = 'graph';
    updateTabContent(currentTabFunction!);
    //document.getElementById('concat-entry')?.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}))
})
document.getElementById('render_mode_grid')?.addEventListener('change', async (e) => {
    if (currentTabFunction!.viewMode == 'graph')
        await animateGraphToGrid();
    if (currentTabFunction!.viewMode == 'text')
        await animateTextToGrid();
    currentTabFunction!.viewMode = 'grid';
    updateTabContent(currentTabFunction!);
    //document.getElementById('concat-entry')?.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}))
})
document.getElementById('render_mode_text')?.addEventListener('change', async (e) => {
    if (currentTabFunction!.viewMode == 'grid')
        await animateGridToText();
    if (currentTabFunction!.viewMode == 'graph') {
        await animateGraphToGrid();
        await animateGridToText();
    }
    currentTabFunction!.viewMode = 'text';
    updateTabContent(currentTabFunction!);
    //updateTabContent(currentTabFunction!);
    //document.getElementById('concat-entry')?.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}))
})

function makePathDirect(path: SVGPathElement, x1: number, y1: number, x2: number, y2: number) {
    let newPath = path.getAttribute("d")!.replace(/M[^ ]+ /, `M${x1} ${y1} `);
    newPath = newPath.replace(/L [^ ]+ [^ ]+ /, `L ${x2} ${y2} `);
    newPath = newPath.replace(/[Ll][^ ]+ /g, "l0,0 ");
    newPath = newPath.replace(/[Vv][^ ]+ /g, "v0 ");
    newPath = newPath.replace(/[Hh][^ ]+ /g, "h0 ");
    newPath = newPath.replace(/a( [^ ]+){7}/g, "a 0 0 0 0 0 0 0");
    path.style.setProperty("d", `path("${newPath}")`);
}

function makePathSlightlyIndirect(path: SVGPathElement, x1: number, y1: number, x2: number, y2: number) {
    const rx = 10
    const ry = 10
    const dy = y2 - y1;
    const rightDown = `a${rx} ${ry} 0 0 1 10 10`
    const downRight = `a${rx} ${ry} 0 0 0 10 10`
    const downLeft = `a${rx} ${ry} 0 0 1 -10 10`
    const leftDown = `a${rx} ${ry} 0 0 0 -10 10`
    const rightUp = `a${rx} ${ry} 0 0 1 10 -10`
    const leftUp = `a${rx} ${ry} 0 0 0 -10 -10`
    let newPath = path.getAttribute("d")!.replace(/M[^ ]+ /, `M${x1} ${y1} `);
    newPath = newPath.replace('a0 0 0 0 1 0 0', rightDown)
    if (x2 > x1 && dy < 50) {
        newPath = newPath.replace('v 0', `v ${dy - 20}`)
        newPath = newPath.replace('h 0', `h0`)
        newPath = newPath.replace('a0 0 0 0 1 0 0', downRight)
    } else if (x2 < x1 && dy < 60) {
        newPath = newPath.replace('v 0', `v ${dy + 30}`)
        newPath = newPath.replace('h 0', `h ${(x2 - x1) - 60}`)
        newPath = newPath.replace('a0 0 0 0 1 0 0', downLeft)
    } else {
        newPath = newPath.replace('v 0', `v ${(y2 - y1) / 2}`)
    
        if (x2 < x1 + 70) {
            newPath = newPath.replace('a0 0 0 0 1 0 0', downLeft)
            newPath = newPath.replace('h 0', `h ${(x2 - x1) - 50}`)
            newPath = newPath.replace('a0 0 0 0 1 0 0', leftDown)
        } else {
            newPath = newPath.replace('a0 0 0 0 1 0 0', downRight)
            newPath = newPath.replace('h 0', `h ${(x2 - x1) - 100}`)
            newPath = newPath.replace('a0 0 0 0 1 0 0', rightDown)
        }
    }
    if (x2 < x1 + 70) {
    } else {
    }
    newPath = newPath.replace('v 0', `V ${(y2)}`)
    newPath = newPath.replace(/L [^ ]+ [^ ]+ /, `L ${x2} ${y2} `);
    newPath = newPath.replace(/[Ll][^ ]+ /g, "l0,0 ");
    newPath = newPath.replace(/[Vv][^ ]+ /g, "v0 ");
    newPath = newPath.replace(/[Hh][^ ]+ /g, "h0 ");
    newPath = newPath.replace(/a( [^ ]+){7}/g, "a 0 0 0 0 0 0 0");
    path.style.setProperty("d", `path("${newPath}")`);
}

function wait(n : number) {
    return new Promise((resolve) => {
        setTimeout(resolve, n)
    })
}

async function animateGridToGraph () {
    // Render grid specifically
    let concatEntry = document.getElementById('concat-entry') as HTMLInputElement
    let np = origProgSVG.cloneNode(true) as unknown as SVGSVGElement;
    progSVG.height.baseVal.convertToSpecifiedUnits(5);
    let pxHeight = progSVG.height.baseVal.valueInSpecifiedUnits;
    np.height.baseVal.newValueSpecifiedUnits(5, window.innerHeight - concatEntry.offsetHeight);
    np.width.baseVal.newValueSpecifiedUnits(5, window.innerWidth);
    progSVG.replaceWith(np)
    progSVG = np
    //let pr = parser.parse(concatEntry.value)
    //graph = parser.toGraph(pr)
    const tab = currentTabFunction!;
    let args = undefined
    if (tab.data && tab.data.length && tab.data[0].length) {
        let rowSelect = document.getElementById("row-select") as HTMLSelectElement;
        args = tab.data[Number(rowSelect.value) ?? 0];
    }

    let renderer = new GridRenderer(graph, progSVG);
    renderInfo = renderer.render()
    opm = renderInfo.valueContainers
    ctx = await graph.evaluate2(args)
    renderValues(ctx, opm);
    for (let argPort of graph.arguments) {
        let g = renderInfo.outputRenderGroups.get(argPort);
        //console.log('removing argument group', g)
        g?.remove();
    }
    
    // Now start animating
    progSVG.width.baseVal.convertToSpecifiedUnits(5);
    if (progSVG.width.baseVal.valueInSpecifiedUnits < window.innerWidth) {
        progSVG.width.baseVal.newValueSpecifiedUnits(5, window.innerWidth);
        progSVG.style.width = '100%'
    }
    progSVG.height.baseVal.convertToSpecifiedUnits(5);
    if (progSVG.height.baseVal.valueInSpecifiedUnits < window.innerHeight - concatEntry.offsetHeight) {
        progSVG.height.baseVal.newValueSpecifiedUnits(5, window.innerHeight - concatEntry.offsetHeight);
        progSVG.style.height = '100%'
    }
    let graphRenderer = new GraphRenderer(graph, progSVG);
    let newRenderInfo = graphRenderer.render(false);
    for (let path of graphRenderer.connectionLookup.values()) {
        /*let newPath = path.getAttribute("d")!.replace(/M[^ ]+ /, "M0 0 ");
        newPath = newPath.replace(/[Ll][^ ]+ /g, "l0,0 ");
        newPath = newPath.replace(/[Vv][^ ]+ /g, "v0 ");
        newPath = newPath.replace(/[Hh][^ ]+ /g, "h0 ");
        newPath = newPath.replace(/a( [^ ]+){7}/g, "a 0 0 0 0 0 0 0");
        path.style.setProperty("d", `path("${newPath}")`);*/
    }
    setTimeout(() => {
        for (let path of graphRenderer.connectionLookup.values()) {
            path.style.transition = 'd 0.5s';
            path.style.setProperty("d", "")//`path("${path.getAttribute("d")}")`);
        }
    }, 500)
    // Hide all the waypoints in the grid
    progSVG.querySelectorAll('.grid-waypoint').forEach((e: any) => {
        e.style.opacity = '0';
    })
    let inputLocationsMap = new Map<functionnodes.FunctionInputPort, [number, number]>()
    let functionMidLocationsMap = new Map<any, [number, number, number]>()
    let funcIndex = 0
    for (let fn of newRenderInfo.functionRenderGroups.keys()) {
        let g = newRenderInfo.functionRenderGroups.get(fn)
        let oldG = renderInfo.functionRenderGroups.get(fn)
        if (!g || !oldG) continue
        g.style.display = 'none';
        let bcr = oldG.getBoundingClientRect();
        let oldD = oldG.querySelector("path")?.getAttribute("d")!;
        let destD = g.querySelector("path")?.getAttribute("d")!;
        let [x, y] = oldD.split(" ")[0].substring(1).split(",").map((e) => Number.parseFloat(e));
        x += bcr.width / 2 - 75;
        y += 10
        functionMidLocationsMap.set(fn, [x, y, bcr.width / 2 - 75]);
        let midD = destD.replace(/M[^ ]+ /, `M${x},${y} `);
        let portCount = 0;
        let graphFuncNodeData = graphRenderer.nodeData.get(fn)!;
        for (let input of fn.inputPorts) {
            inputLocationsMap.set(input, [x, y + graphFuncNodeData.inputs[portCount].y + graphFuncNodeData.inputs[portCount].height / 2]);
            portCount++;
        }
        oldG.querySelector("path")?.style.setProperty("d", `path("${midD}")`);
        setTimeout(() => {
            oldG!.querySelector("path")?.style.setProperty("d", `path("${destD}")`);
            setTimeout(() => {
                g!.style.display = 'block';
                oldG!.style.display = 'none';
            }, 550)
        }, 500);
        oldG.querySelectorAll('text').forEach((e: any) => {
            e.style.opacity = '0';
        })
    }
    renderValues(ctx, newRenderInfo.valueContainers);

    for (let port of newRenderInfo.outputRenderGroups.keys()) {
        let g = newRenderInfo.outputRenderGroups.get(port) as SVGGElement
        let oldG = renderInfo.outputRenderGroups.get(port) as SVGGElement
        if (!g || !oldG) continue
        g.style.display = 'none';
        if (!functionMidLocationsMap.has(port.parentNode))
            continue;
        let [x, y, fXOff] = functionMidLocationsMap.get(port.parentNode)!;
        //let functionGroup = renderInfo.functionRenderGroups.get(port.functionNode);
        //let functionPath = functionGroup?.querySelector("path");
        //let functionD = functionPath?.getAttribute("d")!;
        //let functionM = functionD.split(" ")[0];
        //let [x, y] = functionM.substring(1).split(",").map((s) => Number.parseFloat(s));
        let bcr = oldG.getBoundingClientRect();
        let oldD = oldG.querySelector("path")?.getAttribute("d")!;
        let destD = g.querySelector("path")?.getAttribute("d")!;
        let portIdx = port.parentNode.outputPorts.indexOf(port);
        let midD = destD.replace(/M[^ ]+ /, "M" + (x + 11) + "," + (y + 20 + portIdx * 50) + " ");
        oldG.querySelector("path")?.style.setProperty("d", `path("${midD}")`);

        let conn = port.connections[0];
        let edge = graphRenderer.connectionLookup.get(conn)
        if (edge && conn.destination) {
            let destND = graphRenderer.nodeData.get(conn.destination?.functionNode!)
            let destIdx = conn.destination?.functionNode!.inputPorts.indexOf(conn.destination!)!
            let destPortInfo = destND?.inputs[destIdx!]!
            let [destX, destY] = inputLocationsMap.get(conn.destination?.functionNode!.inputPorts[destIdx]!)!
            edge.style.transition = '';
            makePathSlightlyIndirect(edge!,
                bcr.x + bcr.width, (y + 20 + portIdx * 50 + 25),
                destX - fXOff, destY)
            requestAnimationFrame(() => {
                edge!.style.transition = 'd 0.5s';
                makePathSlightlyIndirect(edge!,
                    x + 150, (y + 20 + portIdx * 50 + 25),
                    destX, destY)    
            })
            //edge.style.transition = 'd 0.5s';
        } else if (edge && graphRenderer.resultLookup.get(conn)) {
            let { path, group } = graphRenderer.resultLookup.get(conn)!;
            if (path)
                path.style.display = 'none';
            group.style.display = 'none';
        }


        let fo = oldG.querySelector("foreignObject") as SVGForeignObjectElement
        fo.style.setProperty("x", (x + 11) + "px");
        fo.style.setProperty("y", (y + 20 + portIdx * 50 + 17) + "px");
        fo.style.setProperty("width", "140px");
        fo.style.setProperty("height", "30px");
        setTimeout(() => {
            oldG!.querySelector("path")?.style.setProperty("d", `path("${destD}")`);
            let newFO = g.querySelector("foreignObject") as SVGForeignObjectElement
            fo.style.setProperty("x", newFO.x.baseVal.value + "px");
            fo.style.setProperty("y", newFO.y.baseVal.value + "px");
            fo.style.setProperty("width", newFO.width.baseVal.value + "px");
            fo.style.setProperty("height", newFO.height.baseVal.value + "px");
            setTimeout(() => {
                g.style.display = 'block';
                oldG.style.display = 'none';
            }, 550)
        }, 500);

        oldG.querySelectorAll("text").forEach((t) => {
            t.style.opacity = '0'
        })
    }
    for (let argPort of graph.arguments) {
        let g = newRenderInfo.outputRenderGroups.get(argPort)!;
        g.style.display = '';
    }
    await wait(1000);
    for (let [conn, {path, group}] of graphRenderer.resultLookup.entries()) {
        if (path)
            path.style.display = '';
        group.style.display = '';
    }
    graphRenderer.addRenderListener(createRenderListener(currentTabFunction!, graphRenderer));
}

async function animateGraphToGrid () {
    // Render graph specifically
    let concatEntry = document.getElementById('concat-entry') as HTMLInputElement
    let np = origProgSVG.cloneNode(true) as unknown as SVGSVGElement;
    progSVG.height.baseVal.convertToSpecifiedUnits(5);
    let pxHeight = progSVG.height.baseVal.valueInSpecifiedUnits;
    np.height.baseVal.newValueSpecifiedUnits(5, window.innerHeight - concatEntry.offsetHeight);
    np.width.baseVal.newValueSpecifiedUnits(5, window.innerWidth);
    //progSVG.replaceWith(np)
    //progSVG = np
    //let pr = parser.parse(concatEntry.value)
    //graph = parser.toGraph(pr)
    const tab = currentTabFunction!;
    let args = undefined
    if (tab.data && tab.data.length && tab.data[0].length) {
        let rowSelect = document.getElementById("row-select") as HTMLSelectElement;
        args = tab.data[Number(rowSelect.value) ?? 0];
    }

    let gridRenderer = new GridRenderer(graph, np);
    let newRenderInfo = gridRenderer.render();

    for (let fn of newRenderInfo.functionRenderGroups.keys()) {
        let oldGrp = renderInfo.functionRenderGroups.get(fn)!;
        let newGrp = newRenderInfo.functionRenderGroups.get(fn)!;
        let oldBorder = oldGrp.querySelector('path');
        oldBorder!.style.transition = 'd 0.5s';
        let newBorder = newGrp.querySelector('path');
        oldBorder?.setAttribute("d", newBorder?.getAttribute("d")!);
        oldGrp.querySelectorAll("text").forEach((t) => {
            t.remove();
        })
    }

    for (let op of newRenderInfo.outputRenderGroups.keys()) {
        let oldGrp = renderInfo.outputRenderGroups.get(op)!;
        let newGrp = newRenderInfo.outputRenderGroups.get(op)!;
        let oldBorder = oldGrp.querySelector('path');
        oldBorder!.style.transition = 'd 0.5s';
        let newBorder = newGrp.querySelector('path');
        oldBorder?.setAttribute("d", newBorder?.getAttribute("d")!);
        oldGrp.querySelectorAll("text").forEach((t) => {
            t.remove();
        })
    }
    
    for (let op of newRenderInfo.valueContainers.keys()) {
        let oldFO = renderInfo.valueContainers.get(op)![0] as SVGForeignObjectElement;
        let newFO = newRenderInfo.valueContainers.get(op)![0] as SVGForeignObjectElement;
        oldFO.style.transition = 'x 0.5s, y 0.5s, width 0.5s, height 0.5s';
        oldFO.style.setProperty("x", newFO.x.baseVal.value + "px");
        oldFO.style.setProperty("y", newFO.y.baseVal.value + "px");
        oldFO.style.setProperty("width", newFO.width.baseVal.value + "px");
        oldFO.style.setProperty("height", newFO.height.baseVal.value + "px");
    }

    let gr = renderer as GraphRenderer;
    gr.connectionGroup.remove();
    
    await wait(500);
    progSVG.replaceWith(np)
    progSVG = np

    renderInfo = newRenderInfo
    gridRenderer.addRenderListener(createRenderListener(currentTabFunction!, gridRenderer));
    gridRenderer.render();
}

async function animateGridToText() {
    let svgBCR = progSVG.getBoundingClientRect();
    for (let [port, group] of renderInfo.outputRenderGroups.entries()) {
        group.style.transition = 'opacity 0.25s';
        group.style.opacity = '0';
    }
    for (let wpg of progSVG.getElementsByClassName('grid-waypoint') as HTMLCollectionOf<SVGGElement>) {
        wpg.style.transition = 'opacity 0.25s';
        wpg.style.opacity = '0';
    }
    await wait(250);
    let tr = new TextRenderer(graph, progSVG);
    let nri = tr.render();
    for (let [n, fo] of tr.wordObjects) {
        fo.style.opacity = '0';
        fo.style.transition = 'opacity 0.5s';
    }
    for (let [n, fo] of tr.wordObjects) {
        if (n instanceof FunctionNode) {
            let origGroup = renderInfo.functionRenderGroups.get(n)!;
            let origBCR = origGroup.getBoundingClientRect();
            let foBCR = fo.getBoundingClientRect();
            fo.style.setProperty("x", (origBCR.x + origBCR.width / 2 - foBCR.width / 2 - svgBCR.left) + "px");
            fo.style.setProperty("y", (origBCR.y - svgBCR.top + 15) + "px");
            fo.style.opacity = '1';
            origGroup.style.transition = 'opacity 0.5s';
            origGroup.style.opacity = '0';
        }
    }
    await wait(250);
    for (let [n, fo] of tr.wordObjects) {
        fo.style.opacity = '1';
    }
    await wait(500);
    for (let [n, fo] of tr.wordObjects) {
        fo.style.transition = 'x 0.5s, y 0.5s';
        fo.style.setProperty("x", "");
        fo.style.setProperty("y", "");
        await wait(50);
    }
    await wait(500)
}

async function animateTextToGrid() {
    let svgBCR = progSVG.getBoundingClientRect();
    // for (let [port, group] of renderInfo.outputRenderGroups.entries()) {
    //     group.style.transition = 'opacity 0.25s';
    //     group.style.opacity = '0';
    // }
    // for (let wpg of progSVG.getElementsByClassName('grid-waypoint') as HTMLCollectionOf<SVGGElement>) {
    //     wpg.style.transition = 'opacity 0.25s';
    //     wpg.style.opacity = '0';
    // }
    // await wait(250);
    progSVG.textContent = "";
    let tr = new TextRenderer(graph, progSVG);
    tr.render();
    let gr = new GridRenderer(graph, progSVG);
    let nri = gr.render(false);
    nri.functionRenderGroups.forEach((g) => {
        g.style.opacity = '0';
    })
    nri.outputRenderGroups.forEach((g) => {
        g.style.opacity = '0';
    })
    for (let wpg of progSVG.getElementsByClassName('grid-waypoint') as HTMLCollectionOf<SVGGElement>) {
        wpg.style.opacity = '0';
    }

    if (!(renderer instanceof TextRenderer)) // skip to the chase
        return;
    for (let [n, fo] of tr.wordObjects) {
        fo.style.transition = 'opacity 0.5s, x 0.5s, y 0.5s';
    }
    for (let [n, fo] of tr.wordObjects) {
        if (n instanceof FunctionNode) {
            let newGroup = nri.functionRenderGroups.get(n)!;
            let newBCR = newGroup.getBoundingClientRect();
            let foBCR = fo.getBoundingClientRect();
            fo.style.setProperty("x", (newBCR.x + newBCR.width / 2 - foBCR.width / 2 - svgBCR.left) + "px");
            fo.style.setProperty("y", (newBCR.y - svgBCR.top + 15) + "px");
            //newGroup.style.transition = 'opacity 0.5s';
            //newGroup.style.opacity = '0';
        }
    }
    await wait(500);
    nri.functionRenderGroups.forEach((g) => {
        g.style.transition = 'opacity 0.5s';
        g.style.opacity = '1';
    })
    nri.outputRenderGroups.forEach((g) => {
        g.style.transition = 'opacity 0.5s';
        g.style.opacity = '1';
    })
    for (let wpg of progSVG.getElementsByClassName('grid-waypoint') as HTMLCollectionOf<SVGGElement>) {
        wpg.style.transition = 'opacity 0.5s';
        wpg.style.opacity = '1';
    }
    await wait(500);
}


//document.getElementById('animate-switch')?.addEventListener('click', animateGridToGraph)

document.getElementById('file-input')?.addEventListener('change', async function(this : HTMLInputElement, e) {
    if (!this === null)
        return;
    let t : HTMLInputElement = this!;
    let text = await t.files![0].text();
    if (t.files![0].name.endsWith(".csv") || t.files![0].name.endsWith(".tsv")) {
        let csvData = t.files![0].name.endsWith(".csv") ? csvloader.csvToObjectOfArrays(text) : csvloader.tsvToObjectOfArrays(text);
        let args = [];
        for (let i = 0; i < csvData.columns.length; i++) {
        }
        let graph = new LayerGraph(functions.BuiltinFunctions);
        for (let [i, col] of csvData.columns.entries()) {
            let argNode = new ArgumentNode(graph, col.name, col.type, i);
            let argPort = argNode.port;
            args.push(argPort);
        }
        graph.setArguments(args);
        graph.propagateWaypoints();
        for (let arg of args) {
            graph.resultPorts.push({port: arg, connection: arg.connections[0]})
        }
        let data = new Array<Array<any>>();
        for (let col of csvData.columns) {
            for (let i = 0; i < csvData.data[col.name].length; i++) {
                if (i >= data.length) data.push([]);
                data[i].push(csvData.data[col.name][i]);
            }
        }
        let name = t.files![0].name.replace('.csv', '').replaceAll(/[^a-zA-Z0-9]/g, '');
        let sdf = new SubductFunction(name, args, graph.resultPorts.map(x => x.port), async (...a : Array<any>) => {
            let ev = await newTabFunction.graph.evaluate2(a)
            return ev.returnValues
        })
        let sdf2 = new SubductFunction(name, [], [{ type: types.Stream(...graph.resultPorts.map(x => x.port.type))}], async (...a : Array<any>) => {
            let ev = await newTabFunction.graph.evaluateStream(iterableToAsyncIterable(data));
            return [[ev]]
        })
        // TODO: nullary version returning a stream
        let newTabFunction = {
            graph,
            name,
            viewMode: "graph",
            data,
            userFunc: sdf
        }
        graph.functions.addFunction(sdf);
        graph.functions.addFunction(sdf2);
        //console.log('sdf', sdf)
        tabFunctions.push(newTabFunction);
        currentTabFunction = newTabFunction;
        updateTabBar();
        updateTabContent(newTabFunction);
    }
})

async function *iterableToAsyncIterable(it : Iterable<any>) {
    for (let i of it) {
        yield i;
    }
}

async function renderResults(results? : Array<Array<any>>) {
    const inputData = currentTabFunction!.data;
    const graph = currentTabFunction!.graph;
    let allResults = [];
    if (results) {
        allResults = results;
    } else if (graph.arguments.length) {
        for await (let result of graph.evaluateStream(iterableToAsyncIterable(inputData))) {
            allResults.push(result);
        }
    } else {
        if (false) {
            let ec = await graph.evaluate();
            if (ec.returnValues)
                allResults.push(ec.returnValues);
        } else {
            let rr = await graph.evaluate2();
            allResults = rr.returnValues!;
            //console.log('returnValues', rr.returnValues)
        }
    }
    //console.log('allResults', allResults);
    let tbl = document.createElement('table');
    let header = document.createElement('tr');
    let colTypes = new Array<types.Type>();
    for (let res of graph.resultPorts) {
        let th = document.createElement('th');
        th.innerText = res.port.label ? res.port.label : res.port.type.toString();
        header.appendChild(th);
        colTypes.push(res.port.type);
    }
    if (graph.resultPorts.length == 1 && types.AnyStream.accepts(graph.resultPorts[0].port.type)) {
        header.innerHTML = '';
        colTypes = [];
        let streamType = graph.resultPorts[0].port.type as types.ParametricType;
        for (let t of streamType.parameters) {
            let th = document.createElement('th');
            th.innerText = t.toString();
            header.appendChild(th);
            colTypes.push(t);
        }
    }
    tbl.appendChild(header);
    for (let row of allResults) {
        let tr = document.createElement('tr');
        for (let [cell, type] of zip(row, colTypes)) {
            let td = document.createElement('td');
            renderValue(td, cell, type);
            //td.innerText = cell.toString();
            tr.appendChild(td);
        }
        tbl.appendChild(tr);
    }
    document.getElementById('output')!.innerHTML = '';
    document.getElementById('output')!.appendChild(tbl);
}

function *zip(a : Array<any>, b : Array<any>) {
    let len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        yield [a[i], b[i]];
    }
}

document.getElementById('run-all')?.addEventListener('click', async () => {
    renderResults();
})