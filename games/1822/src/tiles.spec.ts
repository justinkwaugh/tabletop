import { OverlayPieces1822 } from './overlays.js'
import { describe, expect, it } from 'vitest'
import {
    TileEdges,
    TileUpgrades,
    requiredLabels,
    rotateTileFace,
    sameLabels,
    sameStopCounts,
    tileExits,
    type TileFace
} from '@tabletop/18xx'
import { LondonLocationId } from './companies.js'
import { Map1822, SwanseaLocationId } from './map.js'
import { EnglishChannelLocationId } from './privates.js'
import {
    EnglishChannelTileIds1822,
    LondonTileIds1822,
    TileColorOrder1822,
    TileSet1822,
    Tiles1822
} from './tiles.js'

function face(definitionId: string): TileFace {
    const tile = Tiles1822.find(({ id }) => id === definitionId)
    if (!tile) throw new Error(`No tile ${definitionId}`)
    return tile.face
}

const pieces = (definitionId: string) =>
    TileSet1822.pieces.filter((piece) => piece.faceDefinitionIds[0] === definitionId).length

/** Some rotation of the replacement keeps every exit of the tile it replaces. */
function keepsExits(before: TileFace, after: TileFace): boolean {
    return TileEdges.some((rotation) => {
        const exits = tileExits(rotateTileFace(after, rotation))
        return [...tileExits(before)].every((edge) => exits.has(edge))
    })
}

function layableOn(locationId: string): string[] {
    const location = Map1822.location(locationId)
    const printed = location.preprintedTile
    return Tiles1822.filter(
        (tile) =>
            TileColorOrder1822.indexOf(tile.face.color) >
                TileColorOrder1822.indexOf(printed.color) &&
            sameLabels(
                requiredLabels(location, tile.face.color, TileColorOrder1822, printed.labels),
                tile.face.labels
            )
    ).map((tile) => tile.id)
}

const upgrades = new TileUpgrades({
    map: Map1822,
    tileSet: TileSet1822,
    colorOrder: TileColorOrder1822,
    preservesStops: sameStopCounts
})

describe('the tiles (tile manifest, p. 36)', () => {
    it('count 44 yellow besides the plain track, 75 green, 58 brown and 22 grey', () => {
        // The scenarios' overlays are grey tiles of their own, apart from the manifest's.
        const overlayIds = OverlayPieces1822.map((piece) => piece.tile.id)
        const count = (color: string) =>
            TileSet1822.pieces.filter(
                (piece) =>
                    !overlayIds.includes(piece.faceDefinitionIds[0]) &&
                    face(piece.faceDefinitionIds[0]).color === color
            ).length
        expect(['yellow', 'green', 'brown', 'gray'].map(count)).toEqual([44, 75, 58, 22])
    })

    it('never run out of plain yellow track (§5.8.15)', () => {
        expect(
            TileSet1822.manifest.entries
                .filter((entry) => entry.count === 'unlimited')
                .map((entry) => entry.id)
        ).toEqual(['7', '8', '9'])
    })

    it('keep the scenarios’ overlays out of the supply, printed by each scenario’s variant (§6.2.1)', () => {
        const overlayIds = OverlayPieces1822.map((piece) => piece.tile.id)
        expect(
            TileSet1822.pieces.filter((piece) =>
                piece.faceDefinitionIds.some((id) => overlayIds.includes(id))
            )
        ).toEqual([])
        expect(overlayIds.every((id) => Tiles1822.some((tile) => tile.id === id))).toBe(true)
    })

    it('print the manifest’s numbers of the scarce tiles', () => {
        expect(
            ['18xx:1', '18xx:2', '18xx:55', '18xx:56', '18xx:69', '18xx:57', '18xx:6'].map(pieces)
        ).toEqual([1, 1, 1, 1, 1, 6, 8])
        expect(['1822:207', '1822:208', '1822:622', '1822:405'].map(pieces)).toEqual([2, 1, 1, 3])
        expect(['18xx:63', '18xx:611', '1822:X18', '1822:X19'].map(pieces)).toEqual([8, 4, 2, 4])
        expect(['1822:60', '1822:169', '1822:X17'].map(pieces)).toEqual([2, 2, 2])
    })

    it('give each labelled city its own tiles in every later colour (§5.8.2)', () => {
        const own = (label: string, color: string) =>
            Tiles1822.filter(
                (tile) => tile.face.color === color && tile.face.labels.includes(label)
            ).map(({ id }) => id)
        const colours = ['green', 'brown', 'gray']
        expect(colours.map((color) => own('BM', color))).toEqual([
            ['1822:X2'],
            ['1822:X7'],
            ['1822:X13']
        ])
        expect(colours.map((color) => own('Y', color))).toEqual([
            ['1822:207', '1822:208', '1822:622'],
            ['1822:X5'],
            ['1822:X11']
        ])
        expect(colours.map((color) => own('C', color))).toEqual([
            ['1822:X1'],
            ['1822:X6'],
            ['1822:X12']
        ])
        expect(colours.map((color) => own('S', color))).toEqual([
            ['1822:X3'],
            ['1822:X8'],
            ['1822:X14']
        ])
        expect(colours.map((color) => own('T', color))).toEqual([
            ['1822:405'],
            ['1822:X10'],
            ['1822:X16']
        ])
        expect(colours.map((color) => own('EC', color))).toEqual(
            EnglishChannelTileIds1822.map((id) => [id])
        )
        expect(['yellow', ...colours].map((color) => own('L', color))).toEqual(
            LondonTileIds1822.map((id) => [id])
        )
    })

    it('lay labelled tiles only on their own hexes, and unlabelled yellow on S and T hexes (§5.8.2, §5.8.3)', () => {
        const labelled = Tiles1822.filter((tile) => tile.face.labels.length).map(({ id }) => id)
        for (const location of Map1822.definition.locations) {
            if (!location.buildable) continue
            const own = [
                ...location.preprintedTile.labels,
                ...(location.upgradeLabels ?? []).map((entry) => entry.label)
            ]
            expect(
                layableOn(location.id)
                    .filter((id) => labelled.includes(id))
                    .every((id) => own.some((label) => face(id).labels.includes(label))),
                location.id
            ).toBe(true)
        }
        expect(layableOn('K42').filter((id) => face(id).color === 'yellow')).toContain('18xx:57')
        expect(layableOn('K42').filter((id) => face(id).color === 'green')).toEqual(['1822:405'])
        expect(layableOn(SwanseaLocationId).filter((id) => face(id).color === 'green')).toEqual([
            '1822:X3'
        ])
        expect(layableOn('G22').filter((id) => face(id).color === 'green')).toEqual([
            '1822:207',
            '1822:208',
            '1822:622'
        ])
        expect(layableOn(LondonLocationId)).toEqual(LondonTileIds1822)
        expect(layableOn(EnglishChannelLocationId)).toEqual(EnglishChannelTileIds1822)
    })

    it('keep the pre-printed cities’ track as they upgrade (§5.8.1)', () => {
        for (const location of Map1822.definition.locations) {
            if (
                location.preprintedTile.color !== 'yellow' ||
                location.id === EnglishChannelLocationId
            )
                continue
            const next = layableOn(location.id).filter((id) => face(id).color === 'green')
            expect(next.length, location.id).toBeGreaterThan(0)
            expect(
                next.some((id) => keepsExits(location.preprintedTile, face(id))),
                location.id
            ).toBe(true)
        }
    })

    it('upgrade by colour, stops and track, the labelled tiles only into their own', () => {
        expect(upgrades.upgradesTo('1822:X1')).toEqual(['1822:X6'])
        expect(upgrades.upgradesTo('1822:X6')).toEqual(['1822:X12'])
        expect(upgrades.upgradesTo('1822:X2')).toEqual(['1822:X7'])
        expect(upgrades.upgradesTo('1822:X7')).toEqual(['1822:X13'])
        for (const id of ['1822:207', '1822:208', '1822:622'])
            expect(upgrades.upgradesTo(id)).toEqual(['1822:X5'])
        expect(upgrades.upgradesTo('1822:X5')).toEqual(['1822:X11'])
        expect(upgrades.upgradesTo('1822:405')).toEqual(['1822:X10'])
        expect(upgrades.upgradesTo('1822:X10')).toEqual(['1822:X16'])
        expect(upgrades.upgradesTo('1822:X3')).toEqual(['1822:X8'])
        expect(upgrades.upgradesTo('1822:X8')).toEqual(['1822:X14'])
        expect(upgrades.upgradesTo('18xx:14')).toEqual(['18xx:63', '18xx:611'])
        expect(upgrades.upgradesTo('18xx:611')).toEqual(['1822:X18', '1822:X19'])
        expect(upgrades.upgradesTo('18xx:63')).toEqual(['1822:X19'])
        expect(upgrades.upgradesTo('18xx:544')).toEqual(['1822:60', '1822:169'])
        expect(upgrades.upgradesTo('18xx:767')).toEqual(['1822:X17'])
    })

    it('give every tile with a stop but the double small stations a tile of the next colour', () => {
        const doubleSmallStations = ['18xx:1', '18xx:2', '18xx:55', '18xx:56', '18xx:69']
        for (const tile of Tiles1822) {
            if (
                tile.face.color === 'gray' ||
                !tile.face.nodes.some((node) => node.kind !== 'junction')
            )
                continue
            expect(upgrades.upgradesTo(tile.id).length > 0, tile.id).toBe(
                !doubleSmallStations.includes(tile.id)
            )
        }
    })
})

describe('the London upgrades (§5.10.1)', () => {
    it('raise the six stations to £40, £60, £80 and £100, each for £20', () => {
        expect(
            LondonTileIds1822.map((id) => {
                const { color, nodes, upgradeCost } = face(id)
                const values = new Set(
                    nodes.map((node) =>
                        node.kind !== 'junction' && node.revenue.kind === 'fixed'
                            ? node.revenue.amount
                            : undefined
                    )
                )
                return [color, nodes.length, [...values], upgradeCost]
            })
        ).toEqual([
            ['yellow', 6, [40], 20],
            ['green', 6, [60], 20],
            ['brown', 6, [80], 20],
            ['gray', 6, [100], undefined]
        ])
        expect(LondonTileIds1822.map(pieces)).toEqual([1, 1, 1, 1])
    })

    it('keep each station on its own side', () => {
        const printed = Map1822.location(LondonLocationId).preprintedTile
        for (const id of LondonTileIds1822) {
            expect(face(id).paths).toEqual(printed.paths)
            expect(face(id).nodes.map((node) => node.id)).toEqual(
                printed.nodes.map((node) => node.id)
            )
        }
    })
})

describe('the English Channel tiles (§5.4.6, §5.9)', () => {
    it('hold one, two and three stations, and cost £100 to upgrade', () => {
        expect(
            EnglishChannelTileIds1822.map((id) => {
                const [node] = face(id).nodes
                return [
                    face(id).color,
                    node.kind === 'city' && node.stationSlots,
                    node.kind === 'city' && node.uncounted,
                    face(id).upgradeCost
                ]
            })
        ).toEqual([
            ['green', 1, true, 100],
            ['brown', 2, true, 100],
            ['gray', 3, true, undefined]
        ])
    })

    it('run one track to France in green and two in brown and grey (§5.9.2)', () => {
        const toFrance = (id: string) =>
            face(id).paths.flatMap((path) =>
                path.endpoints.flatMap((end) =>
                    end.kind === 'edge' && end.edge === 5 ? [end.lane ?? 0] : []
                )
            )
        expect(EnglishChannelTileIds1822.map(toFrance)).toEqual([[0], [0, 1], [0, 1]])
        for (const id of EnglishChannelTileIds1822)
            expect([...tileExits(face(id))].sort()).toEqual([2, 3, 5])
    })
})
