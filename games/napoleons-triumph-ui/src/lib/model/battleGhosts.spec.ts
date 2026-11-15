import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { AUSTERLITZ } from '@tabletop/napoleons-triumph'
import {
    BATTLE_FROM,
    BATTLE_INTO,
    retreatToTheRefuge,
    wonBeforeTheRetreat
} from '@tabletop/napoleons-triumph/testing'
import { layoutGroups, pieceGroups, type LayoutOptions } from '$lib/utils/pieceLayout.js'
import {
    ghostLinks,
    ghostedLosses,
    lossesSingledOut,
    partGhosts,
    withGhosts
} from './battleGhosts.js'
import { battleLossesOf } from './battleLosses.js'

function retreated() {
    const game = retreatToTheRefuge(wonBeforeTheRetreat())
    const losses = battleLossesOf({ state: game.state, actions: game.played })
    assertExists(losses, 'Expected the losses of an attack')
    return { game, taken: losses.taken }
}

function laidOut() {
    const { game, taken } = retreated()
    const ghosted = ghostedLosses(taken, (unitId) => game.hydrated.findUnit(unitId))
    const options: LayoutOptions = {
        rotation: 0,
        singledOut: lossesSingledOut(taken, AUSTERLITZ.approachBetween(BATTLE_FROM, BATTLE_INTO).id)
    }
    return {
        game,
        ...partGhosts(
            layoutGroups(pieceGroups(withGhosts(game.hydrated, ghosted), options), options),
            ghosted
        )
    }
}

describe('the ghosts of an attack', () => {
    it('stand for the units it destroyed and those gone on from where they lost steps', () => {
        const { game, taken } = retreated()
        const ghosted = ghostedLosses(taken, (unitId) => game.hydrated.findUnit(unitId))
        expect(ghosted.map(({ unit }) => unit.id)).toEqual(['F01', 'A01', 'A02', 'A03', 'A04'])
    })

    it('leave out a unit still standing where it lost its steps', () => {
        const { game, taken } = retreated()
        const stayed = (unitId: string) =>
            unitId === 'A04'
                ? { ...game.hydrated.unit('A04'), position: { locale: BATTLE_INTO } }
                : game.hydrated.findUnit(unitId)
        expect(ghostedLosses(taken, stayed).map(({ unit }) => unit.id)).not.toContain('A04')
    })

    it('are laid out where the units stood, apart from the pieces that stand', () => {
        const { game, sprites, ghosts } = laidOut()
        expect(
            ghosts.map((ghost) => [ghost.block.unit.id, ghost.block.unit.position?.locale])
        ).toEqual(
            expect.arrayContaining([
                ['F01', BATTLE_FROM],
                ['A01', BATTLE_INTO],
                ['A04', BATTLE_INTO]
            ])
        )
        expect(ghosts.find((ghost) => ghost.block.unit.id === 'A01')?.loss).toMatchObject({
            steps: 2,
            eliminated: true
        })
        const standing = sprites.flatMap((sprite) => sprite.group.units.map((unit) => unit.id))
        expect(standing.toSorted()).toEqual(game.state.units.map((unit) => unit.id).toSorted())
    })

    it('are linked to the units still on the map, where they stand now', () => {
        const { sprites, ghosts } = laidOut()
        const links = ghostLinks(ghosts, sprites)
        expect(links).toHaveLength(2)
        const a04 = sprites.flatMap((sprite) => sprite.blocks).find((b) => b.unit.id === 'A04')
        const ghost = ghosts.find((g) => g.block.unit.id === 'A04')
        expect(links).toContainEqual({
            unitId: 'A04',
            line: [ghost?.block.centre, a04?.centre]
        })
    })
})
