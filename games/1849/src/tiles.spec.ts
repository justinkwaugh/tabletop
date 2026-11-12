import { describe, expect, it } from 'vitest'
import {
    TileUpgrades,
    TileEdges,
    requiredLabels,
    rotateTileFace,
    sameLabels,
    sameStopCounts,
    type TileFace,
    type TrackGauge
} from '@tabletop/18xx'
import { LabelledCities1849, Map1849 } from './map.js'
import { TileColorOrder1849, TileSet1849, Tiles1849 } from './tiles.js'

const colorOf = (definitionId: string) =>
    Tiles1849.find((tile) => tile.id === definitionId)?.face.color

function exitGauges(face: TileFace): Map<number, TrackGauge | 'standard'> {
    return new Map(
        face.paths.flatMap((path) =>
            path.endpoints.flatMap((end) =>
                end.kind === 'edge' ? [[end.edge, path.gauge ?? 'standard'] as const] : []
            )
        )
    )
}

/** Some rotation keeps every exit, each on its gauge or on dual track that carries it. */
function keepsGaugedExits(before: TileFace, after: TileFace): boolean {
    const kept = exitGauges(before)
    return TileEdges.some((rotation) => {
        const exits = exitGauges(rotateTileFace(after, rotation))
        return [...kept].every(([edge, gauge]) => {
            const replaced = exits.get(edge)
            return replaced === gauge || replaced === 'dual'
        })
    })
}

function layableOn(locationId: string): string[] {
    const location = Map1849.location(locationId)
    const printed = location.preprintedTile
    return Tiles1849.filter(
        (tile) =>
            TileColorOrder1849.indexOf(tile.face.color) >
                TileColorOrder1849.indexOf(printed.color) &&
            sameLabels(
                requiredLabels(location, tile.face.color, TileColorOrder1849, printed.labels),
                tile.face.labels
            )
    ).map((tile) => tile.id)
}

describe('the tiles', () => {
    it('match the manifest: 72 yellow, 72 green and 24 brown (p. 19)', () => {
        const count = (color: string) =>
            TileSet1849.pieces.filter((piece) => colorOf(piece.faceDefinitionIds[0]) === color)
                .length
        expect(['yellow', 'green', 'brown'].map(count)).toEqual([72, 72, 24])
        expect(TileSet1849.pieces).toHaveLength(168)
    })

    it('print one Messina tile of each colour, as the manifest does', () => {
        const count = (id: string) =>
            TileSet1849.pieces.filter((piece) => piece.faceDefinitionIds[0] === id).length
        expect(['1849:655', '1849:656', '18xx:8', '1849:78'].map(count)).toEqual([1, 1, 10, 10])
    })

    it('carry gauges only on title tiles', () => {
        for (const tile of Tiles1849)
            if (tile.face.paths.some((path) => path.gauge)) expect(tile.scope).toBe('1849')
        expect(
            Tiles1849.find((tile) => tile.id === '1849:710')?.face.paths.map((path) => path.gauge)
        ).toEqual(['narrow', undefined])
    })

    it('lay each large city’s own tiles there and nowhere else (§10.3)', () => {
        for (const [locationId, label] of Object.entries(LabelledCities1849)) {
            const own = Tiles1849.filter((tile) => tile.face.labels.includes(label))
            expect(own.map((tile) => tile.face.color)).toEqual(['green', 'brown'])
            expect(layableOn(locationId)).toEqual(own.map((tile) => tile.id))
        }
        const labelled = Tiles1849.filter((tile) => tile.face.labels.length).map(({ id }) => id)
        for (const location of Map1849.definition.locations)
            if (location.buildable && !LabelledCities1849[location.id])
                expect(layableOn(location.id).filter((id) => labelled.includes(id))).toEqual([])
    })

    it('keep each large city’s track and gauges as it upgrades', () => {
        for (const [locationId, label] of Object.entries(LabelledCities1849)) {
            const [green, brown] = Tiles1849.filter((tile) => tile.face.labels.includes(label))
            const printed = Map1849.location(locationId).preprintedTile
            expect(keepsGaugedExits(printed, green.face), locationId).toBe(true)
            expect(keepsGaugedExits(green.face, brown.face), locationId).toBe(true)
        }
    })

    it('upgrade by track and stops alone, the labelled tiles only into their own', () => {
        const upgrades = new TileUpgrades({
            map: Map1849,
            tileSet: TileSet1849,
            colorOrder: TileColorOrder1849,
            preservesStops: sameStopCounts
        })
        expect(upgrades.upgradesTo('1849:651')).toEqual(['1849:652'])
        expect(upgrades.upgradesTo('1849:653')).toEqual(['1849:654'])
        expect(upgrades.upgradesTo('1849:655')).toEqual(['1849:656'])
        expect(upgrades.upgradesTo('1849:675')).toEqual(['1849:676'])
        expect(upgrades.upgradesTo('1849:644')).toContain('1849:660')
        expect(upgrades.upgradesTo('18xx:3')).toContain('1849:680')
    })

    it('give every yellow city tile a green city tile, and every green one a brown', () => {
        for (const tile of Tiles1849) {
            if (tile.face.color === 'brown' || !tile.face.nodes.length) continue
            const next = TileColorOrder1849[TileColorOrder1849.indexOf(tile.face.color) + 1]
            expect(
                Tiles1849.some(
                    (other) =>
                        other.face.color === next &&
                        sameLabels(other.face.labels, tile.face.labels) &&
                        sameStopCounts(tile.face, other.face) &&
                        keepsGaugedExits(tile.face, other.face)
                ),
                tile.id
            ).toBe(true)
        }
    })
})
