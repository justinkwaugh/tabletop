import type { TrainKind } from '@tabletop/1862'

// The train cards' marks: Express a red circle, Local a blue diamond, Freight a purple hexagon
// (§2.2), drawn as marks beside a company's name.
const Shapes: Record<TrainKind, string> = {
    express: '<circle r="9" fill="#c8312b"/>',
    local: '<polygon points="0,-9.5 9.5,0 0,9.5 -9.5,0" fill="#2f6db5"/>',
    freight: '<polygon points="-9,0 -4.5,-8 4.5,-8 9,0 4.5,8 -4.5,8" fill="#6d3f97"/>'
}

export const PermitNames: Record<TrainKind, string> = {
    express: 'Express',
    local: 'Local',
    freight: 'Freight'
}

export function permitImage(kind: TrainKind): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20">${Shapes[kind]}<text y="3.6" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="700" fill="#fff">${PermitNames[kind][0]}</text></svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
