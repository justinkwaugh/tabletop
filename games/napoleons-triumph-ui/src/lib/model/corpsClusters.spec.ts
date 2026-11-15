import { describe, expect, it } from 'vitest'
import { Side, type ProjectedUnit } from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import { corpsClusters } from './corpsClusters.js'

const asGiven = (units: readonly ProjectedUnit[]) => [...units]

function alliedUnits() {
    const game = new TestGame()
    game.deployBoth()
    const state = game.hydrated
    const [first, second] = state
        .commandersOf(game.playerOf(Side.Allied))
        .map((commander) => commander.id)
        .filter((id) => state.corpsUnits(id).length >= 2)
        .toSorted()
    const [a1, a2] = state.corpsUnits(first)
    const [b1, b2] = state.corpsUnits(second)
    return { first, second, a1, a2, b1, detached: { ...b2, commanderId: undefined } }
}

describe('the units of a battle panel by corps', () => {
    it('puts each corps together in the order the map stacks them, the detached units last', () => {
        const { first, second, a1, a2, b1, detached } = alliedUnits()
        const clusters = corpsClusters([detached, b1, a1, a2], asGiven)
        expect(
            clusters.map((cluster) => [cluster.commanderId, cluster.units.map((unit) => unit.id)])
        ).toEqual([
            [first, [a1.id, a2.id]],
            [second, [b1.id]],
            [undefined, [detached.id]]
        ])
    })

    it('orders the units of each corps as the viewer reads them', () => {
        const { a1, a2 } = alliedUnits()
        const clusters = corpsClusters([a1, a2], (units) => units.toReversed())
        expect(clusters[0].units.map((unit) => unit.id)).toEqual([a2.id, a1.id])
    })
})
