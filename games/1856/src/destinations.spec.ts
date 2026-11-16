import { describe, expect, it } from 'vitest'
import { TrackConstruction, finiteCashOwnedBy, rotateTileFace, type TileEdge } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { buy, edit, finishStockRound, opened, start } from '../test/kit.js'
import { companyFunding } from './capitalization.js'
import { reachesDestination } from './destinations.js'
import { Map1856 } from './map.js'
import type { State1856 } from './state.js'
import { TileSet1856 } from './tiles.js'
import { TrackRules1856 } from './track.js'

const Edges: readonly TileEdge[] = [0, 1, 2, 3, 4, 5]

/** The side of a hex facing its neighbour. */
function facing(locationId: string, neighborId: string): TileEdge {
    const edge = Edges.find(
        (candidate) => Map1856.neighbor(locationId, candidate)?.id === neighborId
    )
    assertExists(edge, `${locationId} and ${neighborId} are not neighbours`)
    return edge
}

/** Lays a yellow tile with track between the two sides, a city on it where the hex has one. */
function layJoining(
    state: State1856,
    locationId: string,
    sides: readonly TileEdge[],
    city: boolean
) {
    for (const definition of TileSet1856.definitions) {
        if (definition.face.color !== 'yellow') continue
        const stops = definition.face.nodes.filter((node) => node.kind !== 'junction')
        if (city ? stops.length !== 1 || stops[0].kind !== 'city' : stops.length) continue
        for (const rotation of Edges) {
            const face = rotateTileFace(definition.face, rotation)
            const exits = face.paths.flatMap((path) =>
                path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
            )
            if (!sides.every((side) => exits.includes(side))) continue
            const piece = TileSet1856.availablePieces(state.tileInventory, definition.id)[0]
            if (!piece) continue
            state.tileInventory.placements[locationId] = {
                pieceId: piece.id,
                definitionId: definition.id,
                rotation
            }
            return
        }
    }
    throw new Error(`No yellow tile joins ${sides.join()} in ${locationId}`)
}

/** Track from Orangeville through J7 and I6 to Lake Huron, the TGB's destination. */
function trackToLakeHuron(state: State1856) {
    layJoining(state, 'K8', [facing('K8', 'J7')], true)
    layJoining(state, 'J7', [facing('J7', 'K8'), facing('J7', 'I6')], false)
    layJoining(state, 'I6', [facing('I6', 'J7'), facing('I6', 'H5')], false)
}

describe('1856 destinations (Public Company Starting Treasury)', () => {
    it('traces a legal route from home to destination through laid tiles', () => {
        const game = opened(4)
        const state = structuredClone(game.state)
        expect(reachesDestination(game.hydrated, 'TGB')).toBe(false)
        trackToLakeHuron(state)
        game.state = state
        expect(reachesDestination(game.hydrated, 'TGB')).toBe(true)
    })

    it('releases an escrow company’s held payments as a tile completes its route', () => {
        const game = opened(4)
        edit(game, (state) => {
            for (const entry of state.cash) if (entry.owner.kind === 'player') entry.amount = 1000
        })
        start(game, 'TGB', 100)
        buy(game, 'TGB', 100, 5)
        expect(companyFunding(game.state, 'TGB')?.escrow).toBe(200)
        finishStockRound(game)
        expect(game.state.trackStep?.companyId).toBe('TGB')
        const before = finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'TGB' })
        edit(game, (state) => {
            layJoining(state, 'J7', [facing('J7', 'K8'), facing('J7', 'I6')], false)
            layJoining(state, 'I6', [facing('I6', 'J7'), facing('I6', 'H5')], false)
        })
        // TGB's own lay of Orangeville's city completes the route.
        const towardJ7 = facing('K8', 'J7')
        const choice = new TrackConstruction(game.hydrated, TrackRules1856)
            .choices('K8')
            .find((entry) =>
                rotateTileFace(
                    TileSet1856.definitions.find(
                        (definition) => definition.id === entry.definitionId
                    )?.face ?? { color: '', nodes: [], paths: [], labels: [] },
                    entry.rotation
                ).paths.some((path) =>
                    path.endpoints.some((end) => end.kind === 'edge' && end.edge === towardJ7)
                )
            )
        assertExists(choice, 'TGB can lay a city toward J7')
        game.act('LayTile', {
            companyId: 'TGB',
            locationId: 'K8',
            definitionId: choice.definitionId,
            rotation: choice.rotation,
            nodeMapping: choice.nodeMapping,
            expectedCost: choice.cost
        })
        expect(game.state.destinationsReached).toContain('TGB')
        expect(companyFunding(game.state, 'TGB')?.escrow).toBeUndefined()
        expect(finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'TGB' })).toBe(
            before + 200
        )
    })
})
