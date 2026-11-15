import { describe, expect, it } from 'vitest'
import {
    StandardTileCatalog,
    TileEdges,
    parseTileDefinition,
    requiredLabels,
    rotateTileEdge,
    rotateTileFace,
    sameLabels,
    tileExits,
    type MapLocation,
    type TileDefinition,
    type TileEdge,
    type TileFace
} from '@tabletop/18xx'
import { HarwichLocationId, IpswichLocationId, Map1862 } from './map.js'
import { TileColorOrder1862, TileSet1862, Tiles1862 } from './tiles.js'

const ofColor = (color: string) => Tiles1862.filter((tile) => tile.face.color === color)
const stopKinds = (face: TileFace) =>
    face.nodes
        .map((node) => node.kind)
        .filter((kind) => kind !== 'junction')
        .sort()
const isPlain = (tile: TileDefinition) => stopKinds(tile.face).length === 0
const hasTown = (tile: TileDefinition) => stopKinds(tile.face).includes('town')

/** Pairs of edges joined by track, through any stop, as sorted "a-b" keys. */
function connections(face: TileFace): Set<string> {
    const key = (a: TileEdge, b: TileEdge) => `${Math.min(a, b)}-${Math.max(a, b)}`
    const pairs = new Set<string>()
    for (const path of face.paths) {
        const [a, b] = path.endpoints
        if (a.kind === 'edge' && b.kind === 'edge') pairs.add(key(a.edge, b.edge))
    }
    for (const node of face.nodes) {
        const edges = face.paths.flatMap((path) =>
            path.endpoints.some((end) => end.kind === 'node' && end.nodeId === node.id)
                ? path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
                : []
        )
        for (const a of edges) for (const b of edges) if (a < b) pairs.add(key(a, b))
    }
    return pairs
}

function keepsTrack(before: TileFace, after: TileFace): boolean {
    return TileEdges.some((rotation) => {
        const rotated = connections(rotateTileFace(after, rotation))
        return [...connections(before)].every((pair) => rotated.has(pair))
    })
}

function keepsExitsRotated(before: TileFace, after: TileFace): boolean {
    return TileEdges.some((rotation) => {
        const exits = tileExits(rotateTileFace(after, rotation))
        return [...tileExits(before)].every((edge) => exits.has(edge))
    })
}

function exitOpen(location: MapLocation, edge: TileEdge): boolean {
    const across = Map1862.across(location.id, edge)
    if (!across) return false
    return (
        across.location.buildable ||
        across.location.preprintedTile.paths.some((path) =>
            path.endpoints.some((end) => end.kind === 'edge' && end.edge === across.edge)
        )
    )
}

function placeableOn(location: MapLocation, tile: TileDefinition): boolean {
    const printed = location.preprintedTile
    if (!location.buildable) return false
    if (stopKinds(printed).join() !== stopKinds(tile.face).join()) return false
    const labels = requiredLabels(location, tile.face.color, TileColorOrder1862, printed.labels)
    if (!sameLabels(labels, tile.face.labels)) return false
    return TileEdges.some((rotation) =>
        [...tileExits(tile.face)].every((edge) =>
            exitOpen(location, rotateTileEdge(edge, rotation))
        )
    )
}

describe('the 1862 tiles', () => {
    it('counts the printed manifest', () => {
        const counts = Object.fromEntries(
            TileSet1862.manifest.entries.map((entry) => [entry.id, entry.count])
        )
        expect(counts).toEqual({
            '5': 10,
            '6': 10,
            '57': 12,
            '14': 11,
            '15': 10,
            '619': 10,
            '16': 2,
            '17': 5,
            '18': 5,
            '19': 4,
            '20': 6,
            '21': 2,
            '22': 2,
            '611': 8,
            '8850': 6,
            '8851': 8,
            '8852': 12,
            '201': 2,
            '202': 4,
            '621': 2,
            '790': 4,
            '791': 4,
            '792': 2,
            '793': 3,
            '53Y': 6,
            '794': 3,
            '795': 1,
            '796': 3,
            '797': 1,
            '61Y': 3,
            '891Y': 3,
            '778': 4,
            '779': 3,
            '780': 3,
            '798': 3
        })
        expect(TileSet1862.pieces).toHaveLength(177)
        for (const tile of Tiles1862)
            expect(parseTileDefinition(JSON.parse(JSON.stringify(tile)))).toEqual(tile)
    })

    it('draws the unlettered station tiles and green crossings from the shared catalog', () => {
        for (const number of ['5', '6', '57', '14', '15', '619', '611', '16', '22'])
            expect(Tiles1862).toContain(StandardTileCatalog.get(`18xx:${number}`))
    })

    it('uses only yellow, green and russet', () => {
        expect(new Set(Tiles1862.map((tile) => tile.face.color))).toEqual(
            new Set(['yellow', 'green', 'brown'])
        )
        expect(TileColorOrder1862).toEqual(['white', 'yellow', 'green', 'brown'])
    })

    it('carries a small station on every yellow plain-track tile', () => {
        const yellowTowns = ofColor('yellow').filter(hasTown)
        expect(yellowTowns.map((tile) => tile.printedNumber).sort()).toEqual([
            '8850',
            '8851',
            '8852'
        ])
        expect(ofColor('yellow').filter(isPlain)).toEqual([])
        for (const tile of yellowTowns)
            expect(tile.face.nodes).toEqual([
                { id: 'town', kind: 'town', revenue: { kind: 'fixed', amount: 20 } }
            ])
    })

    it('lets every yellow tile be placed somewhere on the map', () => {
        for (const tile of ofColor('yellow'))
            expect(
                Map1862.definition.locations.some((location) => placeableOn(location, tile)),
                tile.id
            ).toBe(true)
    })

    it('lets each small-station yellow tile become a green crossing, and each crossing a russet one', () => {
        const greenPlain = ofColor('green').filter(isPlain)
        const brownPlain = ofColor('brown').filter(isPlain)
        expect(greenPlain).toHaveLength(7)
        expect(brownPlain.map((tile) => tile.printedNumber).sort()).toEqual([
            '778',
            '779',
            '780',
            '798'
        ])
        for (const tile of ofColor('yellow').filter(hasTown))
            expect(
                greenPlain.some((green) => keepsTrack(tile.face, green.face)),
                tile.id
            ).toBe(true)
        for (const tile of greenPlain)
            expect(
                brownPlain.some((brown) => keepsTrack(tile.face, brown.face)),
                tile.id
            ).toBe(true)
    })

    it('gives each lettered large station a green and russet upgrade of the same letter', () => {
        for (const label of ['N', 'Y']) {
            const [yellow, green, brown] = ['yellow', 'green', 'brown'].map((color) =>
                ofColor(color).filter((tile) => tile.face.labels.includes(label))
            )
            for (const tile of yellow)
                expect(green.some((next) => keepsExitsRotated(tile.face, next.face))).toBe(true)
            for (const tile of green)
                expect(brown.some((next) => keepsExitsRotated(tile.face, next.face))).toBe(true)
        }
    })

    it('reserves the russet I and H tiles for Ipswich and Harwich', () => {
        const russet = (label: string) =>
            ofColor('brown').filter((tile) => tile.face.labels.includes(label))
        const placeable = (tile: TileDefinition) =>
            Map1862.definition.locations
                .filter((location) => placeableOn(location, tile))
                .map((location) => location.id)
        expect(russet('I').map(placeable)).toEqual([[IpswichLocationId]])
        expect(russet('H').map(placeable)).toEqual([[HarwichLocationId]])
        for (const tile of [...russet('N'), ...russet('Y')]) {
            expect(placeable(tile)).not.toContain(IpswichLocationId)
            expect(placeable(tile)).not.toContain(HarwichLocationId)
        }
    })
})
