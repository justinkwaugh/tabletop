import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, type CancelAlliance, type ExpandRegion } from '@tabletop/lowenherz'
import { expansionActionsFor, openExpansionActionIdFor } from './expansionRun.js'

const PLAYER = 'player-1'

function expand(
    id: string,
    space: { col: number; row: number },
    regionId = 'region-3',
    playerId = PLAYER
): ExpandRegion {
    return {
        id,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.ExpandRegion,
        playerId,
        regionId,
        space
    }
}

function cancelAlliance(id: string, playerId = PLAYER): CancelAlliance {
    return {
        id,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.CancelAlliance,
        playerId,
        allianceId: 'alliance-1'
    }
}

function knightAction(id: string): GameAction {
    return {
        id,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.PlaceKnight,
        playerId: PLAYER
    }
}

describe('expansionActionsFor', () => {
    it('collects the trailing run of the region expansion, in the order taken', () => {
        const actions = [
            knightAction('k1'),
            expand('e1', { col: 3, row: 0 }),
            expand('e2', { col: 3, row: 2 })
        ]

        expect(expansionActionsFor(actions, 'region-3', PLAYER).map((a) => a.id)).toEqual([
            'e1',
            'e2'
        ])
    })

    it('steps over a cancelled alliance taken to free the second space', () => {
        const actions = [expand('e1', { col: 3, row: 0 }), cancelAlliance('c1')]

        expect(expansionActionsFor(actions, 'region-3', PLAYER).map((a) => a.id)).toEqual(['e1'])
    })

    it('stops at an expansion of another region or by another player', () => {
        const actions = [
            expand('other-region', { col: 9, row: 3 }, 'region-4'),
            expand('other-player', { col: 1, row: 1 }, 'region-3', 'player-2'),
            expand('e1', { col: 3, row: 0 })
        ]

        expect(expansionActionsFor(actions, 'region-3', PLAYER).map((a) => a.id)).toEqual(['e1'])
    })

    it('reports no expansion when the log ends on something else', () => {
        const actions = [expand('e1', { col: 3, row: 0 }), knightAction('k1')]

        expect(expansionActionsFor(actions, 'region-3', PLAYER)).toEqual([])
    })
})

describe('openExpansionActionIdFor', () => {
    it('identifies the open expansion by the action that started it', () => {
        const actions = [expand('e1', { col: 3, row: 0 }), cancelAlliance('c1')]

        expect(openExpansionActionIdFor(actions, 'region-3', PLAYER)).toBe('e1')
    })

    it('reports nothing open when the engine holds no expansion', () => {
        const actions = [expand('e1', { col: 3, row: 0 })]

        expect(openExpansionActionIdFor(actions, undefined, PLAYER)).toBeUndefined()
    })

    // The reason the identity is the action rather than the knight action and region: a decline of
    // the optional second space must not survive an Undo of the space it was made against.
    it('changes when the declined space is undone and the same region expanded again', () => {
        const declined = openExpansionActionIdFor(
            [expand('e1', { col: 3, row: 0 })],
            'region-3',
            PLAYER
        )

        const afterUndoAndRetake = openExpansionActionIdFor(
            [expand('e2', { col: 3, row: 0 })],
            'region-3',
            PLAYER
        )

        expect(afterUndoAndRetake).not.toBe(declined)
    })
})
