import { defineConfig } from "../../node_modules/rollup/dist/rollup";

export function findIntersectionOfLines(line1: { x1: any; y1: any; x2: any; y2: any }, line2: { x1: any; y1: any; x2: any; y2: any }) {
    let x1 = line1.x1
    let y1 = line1.y1
    let x2 = line1.x2
    let y2 = line1.y2
    let x3 = line2.x1
    let y3 = line2.y1
    let x4 = line2.x2
    let y4 = line2.y2
    let x = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4))
    let y = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4))
    return { x: x, y: y }
}

function distance(x1: number, y1: number, x2: number, y2: number) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2))
}

type Rect = { left: any; width: any; top: any; height: any; x: number; y: number; }

export function findIntersectionOfLineWithRectangle(otherEnd: { x: any; y: any; }, rect: Rect) {
    let topEdge = { x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y }
    let bottomEdge = { x1: rect.x, y1: rect.y + rect.height, x2: rect.x + rect.width, y2: rect.y + rect.height }
    let leftEdge = { x1: rect.x, y1: rect.y, x2: rect.x, y2: rect.y + rect.height }
    let rightEdge = { x1: rect.x + rect.width, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height }
    let centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    let line = { x1: otherEnd.x, y1: otherEnd.y, x2: centre.x, y2: centre.y }

    let yIntersection = findIntersectionOfLines(line, otherEnd.y <= centre.y ? topEdge : bottomEdge)
    let xIntersection = findIntersectionOfLines(line, otherEnd.x <= centre.x ? leftEdge : rightEdge)
    if (yIntersection.x >= rect.x && yIntersection.x <= rect.x + rect.width) return yIntersection
    return xIntersection
}

function edgeMidpoints(rect: Rect) {
    let top = { x: rect.x + rect.width / 2, y: rect.y }
    let bottom = { x: rect.x + rect.width / 2, y: rect.y + rect.height }
    let left = { x: rect.x, y: rect.y + rect.height / 2 }
    let right = { x: rect.x + rect.width, y: rect.y + rect.height / 2 }
    return { top, bottom, left, right }
}

export function lineBetweenRects(rect1: Rect, rect2: Rect, useMidpoint: any) {
    let c1 = { x: rect1.left + rect1.width / 2, y: rect1.top + rect1.height / 2 }
    let c2 = { x: rect2.left + rect2.width / 2, y: rect2.top + rect2.height / 2 }
    let line1 = { x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y }
    let line2 = { x1: c2.x, y1: c2.y, x2: c1.x, y2: c1.y }
    let int1 = findIntersectionOfLineWithRectangle(c1, rect2)
    let int2 = findIntersectionOfLineWithRectangle(c2, rect1)
    if (useMidpoint) {
        let midpoints1 = edgeMidpoints(rect1)
        let midpoints2 = edgeMidpoints(rect2)
        let mids1 = [midpoints1.top, midpoints1.bottom, midpoints1.left, midpoints1.right]
        let mids2 = [midpoints2.top, midpoints2.bottom, midpoints2.left, midpoints2.right]
        let bestDist = Infinity
        let bestPair = [mids1[0], mids2[0]]
        for (let m1 of mids1) {
            for (let m2 of mids2) {
                let dist = distance(m1.x, m1.y, m2.x, m2.y)
                if (dist < bestDist) {
                    bestDist = dist
                    bestPair = [m1, m2]
                }
            }
        }
        int1 = bestPair[1]
        int2 = bestPair[0]
    }
    return {
        x1: int1.x, y1: int1.y, x2: int2.x, y2: int2.y,
        m: (int1.y - int2.y) / (int1.x - int2.x),
        dx: int1.x - int2.x,
        dy: int1.y - int2.y,
        length: distance(int1.x, int1.y, int2.x, int2.y)
    }
}

export function svgCurveBetweenRects(rect1: Rect, rect2: Rect, useMidPoint: any) {
    let line = lineBetweenRects(rect1, rect2, useMidPoint)
    let scaleX = line.dx / 8
    let scaleY = line.dy / 8
    let scale = Math.abs(scaleX) > Math.abs(scaleY) ? scaleX : scaleY
    scale = line.length / 2
    let tangent = -1 / line.m
    let angle = Math.atan(tangent)
    let midPoint = { x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 }
    let dir = 1
    if (midPoint.x > rect2.left + rect2.width) dir = -1
    let controlPoint = { x: (midPoint.x - dir * Math.cos(angle) * scale), y: (midPoint.y - dir * Math.sin(angle) * scale) }
    let path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', ''
        // + ' M ' + midPoint.x + ',' + midPoint.y + ' L ' + (midPoint.x + Math.cos(angle) * 100) + ',' + (midPoint.y + Math.sin(angle) * 100)
        + 'M ' + line.x1 + ',' + line.y1 + ' S ' + controlPoint.x + ',' + controlPoint.y + ' ' + line.x2 + ',' + line.y2
    )
    return path
}

export function svgBottomPointPath(rect1: Rect, endPoint: { x: number; y: number; }, gap1 = 30) {
    let startPoint = { x: rect1.left + rect1.width / 2, y: rect1.top + rect1.height }
    let dist = distance(startPoint.x, startPoint.y, endPoint.x, endPoint.y)
    let tooClose = dist < gap1 + 20
    let endWithinX = (endPoint.x >= rect1.left && endPoint.x <= rect1.left + rect1.width)
    let endRight = endPoint.x > startPoint.x
    let startWidth = rect1.width / 2
    // Radius of turns
    const rx = 10
    const ry = 10
    // Turns: the first direction is the current direction, the second
    // is the direction turned towards.
    const downRight = `a ${rx} ${ry} 0 0 0 10 10`
    const downLeft = `a ${rx} ${ry} 0 0 1 -10 10`
    const upRight = `a ${rx} ${ry} 0 0 0 10 -10`
    const upLeft = `a ${rx} ${ry} 0 0 1 -10 -10`
    const rightUp = `a ${rx} ${ry} 0 0 1 10 -10`
    const leftUp = `a ${rx} ${ry} 0 0 0 -10 -10`
    const rightDown = `a ${rx} ${ry} 0 0 1 10 10`
    const leftDown = `a ${rx} ${ry} 0 0 0 -10 10`
    let pathSteps = [
        `M ${startPoint.x} ${startPoint.y}`,
        `v ${gap1}`,
    ]
    // rx ry angle large-arc-flag sweep-flag [cw=1 acw=0] dx dy
    let x = startPoint.x
    let y = startPoint.y + gap1
    if (tooClose) {
        pathSteps.pop()
        //pathSteps.push(`L ${endPoint.x} ${endPoint.y}`)
    } else if (endWithinX) { // end is directly below start
    } else {
        // Move half-way down to end rect
        let midY = (startPoint.y + endPoint.y) / 2
        // If we are above the midpoint, go down to it
        if (y < midY - ry)
            pathSteps.push(`V ${midY - ry}`)
        if (endRight) {
            // Turn right
            pathSteps.push(downRight)
            // Move sideways to above/below end point
            pathSteps.push(`H ${endPoint.x - rx}`)
        } else {
            // Turn left
            pathSteps.push(downLeft)
            // Move sideways to above/below end point
            pathSteps.push(`H ${endPoint.x + rx}`)
        }
        if (Math.abs(y - endPoint.y) > 20) {
            // Turn downwards
            if (endPoint.y > y && endRight) {
                pathSteps.push(rightDown)
            } else if (endPoint.y > y && !endRight) {
                pathSteps.push(leftDown)
            } else if (endRight) {
                pathSteps.push(upRight)
            } else {
                pathSteps.push(upLeft)
            }
        }
    }
    pathSteps.push(`L ${endPoint.x} ${endPoint.y}`)
    return pathSteps.join(' ')
}

export function svgBottomTopPath(rect1: Rect, rect2: Rect, offsetPos=0, gap1 = 30, gap2 = 30) {
    let startPoint = { x: rect1.left + rect1.width / 2 + offsetPos * 5, y: rect1.top + rect1.height }
    let endPoint = { x: rect2.left + rect2.width / 2, y: rect2.top }
    let dist = distance(startPoint.x, startPoint.y, endPoint.x, endPoint.y)
    let tooClose = dist < gap1 + gap2 + 20
    let endWithinX = (endPoint.x >= rect1.left && endPoint.x <= rect1.left + rect1.width)
    let endAbove = endPoint.y < rect1.top || (endPoint.y < rect1.top + rect1.height + gap1 + gap2 && !tooClose)
    let endRight = endPoint.x > startPoint.x
    let startWidth = rect1.width / 2
    // Radius of turns
    const rx = 10
    const ry = 10
    // Turns: the first direction is the current direction, the second
    // is the direction turned towards.
    const downRight = `a ${rx} ${ry} 0 0 0 10 10`
    const downLeft = `a ${rx} ${ry} 0 0 1 -10 10`
    const upRight = `a ${rx} ${ry} 0 0 0 10 -10`
    const upLeft = `a ${rx} ${ry} 0 0 1 -10 -10`
    const rightUp = `a ${rx} ${ry} 0 0 1 10 -10`
    const leftUp = `a ${rx} ${ry} 0 0 0 -10 -10`
    const rightDown = `a ${rx} ${ry} 0 0 1 10 10`
    const leftDown = `a ${rx} ${ry} 0 0 0 -10 10`
    let pathSteps = [
        `M ${startPoint.x} ${startPoint.y}`,
        `v ${gap1 - (endRight ? 1 : -1 ) * (offsetPos * 5)}`,
    ]
    const dx = Math.abs(startPoint.x - endPoint.x)
    // rx ry angle large-arc-flag sweep-flag [cw=1 acw=0] dx dy
    let x = startPoint.x
    let y = startPoint.y + gap1
    if (endAbove) {
        // If we have to loop around the destination, go down to below it
        if (endPoint.y > startPoint.y &&
            endPoint.x > startPoint.x - startWidth - gap1 - rect2.width / 2 - gap2 + rx &&
            endPoint.x < startPoint.x + startWidth + gap1 + rect2.width / 2 + gap2 - rx) {
            pathSteps.push(`V ${rect2.top + rect2.height + gap2 - ry}`)
            y = rect2.top + rect2.height + gap2
        }
        if (endRight) {
            // Move to right of start rect
            pathSteps.push(downRight)
            pathSteps.push(`h ${startWidth + gap1}`)
            x += startWidth + gap1
            if (x < rect2.left - rx * 2) { // clear space to go straight up
            } else if (x >= rect2.left + rect2.width + gap2 - rx) { // also clear
            } else { // go to right of both rects
                pathSteps.push(`H ${rect2.left + rect2.width + gap2 - rx}`)
                x = rect2.left + rect2.width + gap2 - rx
            }
            // Turn up
            pathSteps.push(upRight)
        } else {
            // Move to left of start rect
            pathSteps.push(downLeft)
            pathSteps.push(`h -${startWidth + gap1}`)
            x -= startWidth + gap1
            if (x > rect2.left + rect2.width + rx * 2) { // clear space to go straight up
            } else if (x > rect2.left + rect2.width + gap2 - rx) {
            } else { // go to left of both rects
                pathSteps.push(`H ${rect2.left - gap2 - 10}`)
                x = rect2.left - gap2 - 10
            }
            // Turn up
            pathSteps.push(upLeft)
        }
        // Move to above end rect
        pathSteps.push(`V ${endPoint.y - gap2 + 10}`)
        y = endPoint.y - gap2 + 10
        // Turn towards end point, move towards it, and turn downwards
        if (x < endPoint.x) {
            pathSteps.push(rightUp)
            pathSteps.push(`H ${endPoint.x - rx}`)
            pathSteps.push(rightDown)
        } else {
            pathSteps.push(leftUp)
            pathSteps.push(`H ${endPoint.x + rx}`)
            pathSteps.push(leftDown)
        }
    } else if (tooClose) {
        pathSteps.pop()
        //pathSteps.push(`L ${endPoint.x} ${endPoint.y}`)
    } else if (endWithinX && dx < rx * 2) { // end is directly below start
        pathSteps.push(`V ${(endPoint.y + startPoint.y) / 2}`)
        pathSteps.push(`L ${endPoint.x},${endPoint.y - gap2}`)
    } else {
        // Move half-way down to end rect
        let midY = (startPoint.y + endPoint.y) / 2
        // If we are above the midpoint, go down to it
        if (y < midY - ry)
            pathSteps.push(`V ${midY - ry}`)
        if (endRight) {
            // Turn right
            pathSteps.push(downRight)
            // Move sideways to above end point
            pathSteps.push(`H ${endPoint.x - rx}`)
        } else {
            // Turn left
            pathSteps.push(downLeft)
            // Move sideways to above end point
            pathSteps.push(`H ${endPoint.x + rx}`)
        }
        // Turn downwards
        if (endRight) {
            pathSteps.push(rightDown)
        } else {
            pathSteps.push(leftDown)
        }
    }
    pathSteps.push(`L ${endPoint.x} ${endPoint.y}`)
    return pathSteps.join(' ')
}

export function svgCurvedPathThroughPoints(points: { x: number; y: number; }[], offsetPos=0) {
    const gap1 = 30
    const gap2 = 30
    // Radius of turns
    const rx = 10
    const ry = 10
    // Turns: the first direction is the current direction, the second
    // is the direction turned towards.
    const downRight = `a ${rx} ${ry} 0 0 0 10 10`
    const downLeft = `a ${rx} ${ry} 0 0 1 -10 10`
    const upRight = `a ${rx} ${ry} 0 0 1 10 -10`
    const upLeft = `a ${rx} ${ry} 0 0 1 -10 -10`
    const rightUp = `a ${rx} ${ry} 0 0 0 10 -10`
    const leftUp = `a ${rx} ${ry} 0 0 0 -10 -10`
    const rightDown = `a ${rx} ${ry} 0 0 1 10 10`
    const leftDown = `a ${rx} ${ry} 0 0 0 -10 10`
    const rightUp45 = `a ${rx} ${ry} 0 0 0 7.071 -3.5035`
    const rightUp45Right = `a ${rx} ${ry} 0 0 1 7.071 -3.5035`
    const rightDown45 = `a ${rx} ${ry} 0 0 1 7.071 3.5035`
    const rightDown45Right = `a ${rx} ${ry} 0 0 0 7.071 3.5035`
    let startPoint = points.shift()!
    let endPoint = points.pop()!
    let pathSteps = [
        `M${startPoint.x},${startPoint.y}`,
        `h ${gap1 + (offsetPos * 5)}`,
        'a0 0 0 0 1 0 0',
        'v 0',
        'a0 0 0 0 1 0 0',
        'h 0',
        'a0 0 0 0 1 0 0',
        'v 0',
        `l 0 0`,
    ]
    let x = startPoint.x + gap1 + (offsetPos * 5)
    let y = startPoint.y
    points.push({ x: endPoint.x - gap2, y: endPoint.y })
    for (let i = 0; i < points.length; i++) {
        let next = points[i]
        let dx = Math.abs(next.x - x)
        let dy = Math.abs(next.y - y)
        if (dy < 10 && i < points.length - 1) {
            next.y = y
        }
        let tooClose = dx < rx * 2 && dy < ry * 2
        if (tooClose) {
            pathSteps.pop()
            pathSteps.push(`L${next.x},${next.y}`)
        //} else if (dy < 20 && dx != 0) {
        //    pathSteps.push(`Q ${x + 1 * (next.x - x) / 2} ${y + 0*(next.y - y) / 2} ${next.x} ${next.y}`)
        } else if (dy > dx) {
            if (next.y < y) {
                pathSteps.push(rightUp)
                pathSteps.push(`V${next.y + ry}`)
                pathSteps.push(upRight)
            } else {
                pathSteps.push(rightDown)
                pathSteps.push(`V${next.y - ry}`)
                pathSteps.push(downRight)
            }
        } else if (next.y < y) {
            pathSteps.push(rightUp45)
            x += 7.071
            y -= 3.5035
            let diffY = y - next.y - 3.035
            //let diff = Math.max(next.x - x, y - next.y)
            //let intersect = findIntersectionOfLines({x1: x, y1: y, x2: x + diff, y2: y - diff}, {x1: next.x, y1: next.y, x2: x, y2: next.y})
            //pathSteps.push('h -50')
            pathSteps.push(`l${diffY},${-diffY}`)
            //pathSteps.push(`V ${next.y + ry}`)
            pathSteps.push(rightUp45Right)
        } else if (next.y > y) {
            pathSteps.push(rightDown45)
            x += 7.071
            y += 3.5035
            let diffY = next.y - y - 3.035
            pathSteps.push(`l${diffY},${diffY}`)
            pathSteps.push(rightDown45Right)
        } else {
            
        }
        pathSteps.push(`L${next.x},${next.y}`)
        x = next.x
        y = next.y
    }
    pathSteps.push(`L ${endPoint.x} ${endPoint.y}`)
    pathSteps.push(`h 2.0`)
    pathSteps.push(`v -7`)
    pathSteps.push(`a${7} ${7} 0 0 1 0 14`)
    pathSteps.push(`v -15`)
    pathSteps.push(`a${5} ${5} 0 0 1 0 10`)
    return pathSteps.join(' ')
}

export function isPointInRect(point: { x: number; y: number; }, rect : Rect) {
    return point.x >= rect.left && point.x <= rect.left + rect.width &&
        point.y >= rect.top && point.y <= rect.top + rect.height
}

export function doRectsIntersect(rect1 : Rect, rect2 : Rect) {
    let rect1Corners = [
        {x: rect1.left, y: rect1.top},
        {x: rect1.left + rect1.width, y: rect1.top},
        {x: rect1.left + rect1.width, y: rect1.top + rect1.height},
        {x: rect1.left, y: rect1.top + rect1.height},
    ]
    for (let corner of rect1Corners) {
        if (isPointInRect(corner, rect2))
            return true
    }
    let rect2Corners = [
        {x: rect2.left, y: rect2.top},
        {x: rect2.left + rect2.width, y: rect2.top},
        {x: rect2.left + rect2.width, y: rect2.top + rect2.height},
        {x: rect2.left, y: rect2.top + rect2.height},
    ]
    for (let corner of rect2Corners) {
        if (isPointInRect(corner, rect1))
            return true
    }
    return false
}