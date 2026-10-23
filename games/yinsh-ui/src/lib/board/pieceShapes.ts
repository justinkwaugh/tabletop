// Outlines for pieces seen from slightly in front: the top face at y = 0 and the side showing
// below it, `side` deep.

function circle(r: number, cy: number): string {
    return `M ${-r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`
}

// The top face and the side below it, as one solid.
export function capsule(r: number, side: number): string {
    return `M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0 L ${r} ${side} A ${r} ${r} 0 0 1 ${-r} ${side} Z`
}

// What shows through a ring's hole: the overlap of its top and bottom openings.
function throughHole(r: number, side: number): string {
    const x = Math.sqrt(r * r - (side / 2) ** 2)
    const y = side / 2
    return `M ${-x} ${y} A ${r} ${r} 0 0 0 ${x} ${y} A ${r} ${r} 0 0 0 ${-x} ${y} Z`
}

// Use with fill-rule evenodd.
export function ringBody(outer: number, inner: number, side: number): string {
    return `${capsule(outer, side)} ${throughHole(inner, side)}`
}

export function ringFace(outer: number, inner: number): string {
    return `${circle(outer, 0)} ${circle(inner, 0)}`
}
