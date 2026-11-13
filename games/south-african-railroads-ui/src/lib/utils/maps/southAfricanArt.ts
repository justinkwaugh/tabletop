import type { InkDrawing, MapArtwork } from '../boardLayout.js'

// The geography South African Railroads and Veld Railroads share: the veld's tints and the Vaal and
// Orange rivers, given beside the settlements on their banks so each map's spread keeps them there.
const SOUTH_AFRICAN_GEOGRAPHY: Omit<MapArtwork, 'drawings'> = {
    tints: [
        { x: 430, y: 720, rx: 380, ry: 280, color: '#e6d6a0' },
        { x: 1250, y: 380, rx: 330, ry: 250, color: '#c9d2a8' },
        { x: 1330, y: 880, rx: 240, ry: 280, color: '#bfcca3' },
        { x: 110, y: 860, rx: 220, ry: 260, color: '#ead9a8' }
    ],
    waters: [],
    rivers: [
        {
            // The Vaal, west from Standerton past Vereeniging and Warrenton to the Orange
            width: 3,
            points: [
                { near: 'sanderton', dx: 70, dy: 40 },
                { near: 'sanderton', dx: 0, dy: 26 },
                { near: 'vereeniging', dx: 8, dy: 26 },
                { near: 'vredefort', dx: 0, dy: 24 },
                { near: 'vierfontein', dx: 0, dy: 26 },
                { near: 'maquassi', dx: 0, dy: 52 },
                { near: 'warrenton', dx: 12, dy: 26 },
                { near: 'kimberley', dx: -46, dy: -30 },
                { x: 70, y: 548 },
                { x: 22, y: 566 }
            ]
        },
        {
            // The Orange, from Basutoland's border past Aliwal North and Norval's Pont
            width: 3.6,
            points: [
                { near: 'aliwal-north', dx: 190, dy: -36 },
                { near: 'aliwal-north', dx: 90, dy: -40 },
                { near: 'aliwal-north', dx: 10, dy: -28 },
                { near: 'springfontein', dx: -10, dy: 56 },
                { near: 'norvals-point', dx: 30, dy: -32 },
                { near: 'norvals-point', dx: 18, dy: -150 },
                { x: 46, y: 640 },
                { x: 22, y: 566 }
            ]
        }
    ],
    waterNames: []
}

export function southAfricanArtwork(drawings: readonly InkDrawing[]): MapArtwork {
    return { ...SOUTH_AFRICAN_GEOGRAPHY, drawings }
}
