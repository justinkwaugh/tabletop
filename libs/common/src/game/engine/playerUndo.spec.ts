import { describe, expect, it } from 'vitest'
import { ActionSource } from './gameAction.js'
import { CALL_GAME_ACTION_TYPE } from './callGame.js'
import {
    latestPlayerUndoTarget,
    playerUndoReach,
    playerUndoRestriction,
    PlayerUndoRestriction
} from './playerUndo.js'

type TestAction = {
    type?: string
    playerId?: string
    source?: ActionSource
    revealsInfo?: boolean
    simultaneousGroupId?: string
    outOfTurn?: true
}

function history(...actions: TestAction[]) {
    return actions.map((action, index) => ({
        index,
        type: action.type ?? 'move',
        source: action.source ?? ActionSource.User,
        ...action
    }))
}

const system = { source: ActionSource.System }
const call = { ...system, type: CALL_GAME_ACTION_TYPE }

describe('playerUndoReach', () => {
    it('reaches the earliest of the player’s own actions', () => {
        expect(playerUndoReach(history({ playerId: 'a' }, system, { playerId: 'a' }), 'a')).toBe(0)
    })

    it('stops at another player’s action', () => {
        const actions = history({ playerId: 'a' }, { playerId: 'b' }, { playerId: 'a' }, system)
        expect(playerUndoReach(actions, 'a')).toBe(2)
    })

    it('stops at an action that reveals information', () => {
        const actions = history(
            { playerId: 'a' },
            { playerId: 'a', revealsInfo: true },
            {
                playerId: 'a'
            }
        )
        expect(playerUndoReach(actions, 'a')).toBe(2)
    })

    it('has no reach when the latest action is another player’s', () => {
        expect(playerUndoReach(history({ playerId: 'a' }, { playerId: 'b' }), 'a')).toBeUndefined()
    })

    it('passes other players’ actions in the target’s simultaneous group', () => {
        const actions = history(
            { playerId: 'c' },
            { playerId: 'a', simultaneousGroupId: 'g' },
            { playerId: 'b', simultaneousGroupId: 'g' }
        )
        expect(playerUndoReach(actions, 'a')).toBe(1)
    })

    it('passes other players’ out-of-turn declarations', () => {
        const actions = history({ playerId: 'a' }, { playerId: 'b', outOfTurn: true })
        expect(playerUndoReach(actions, 'a')).toBe(0)
    })
})

describe('playerUndoRestriction', () => {
    it('allows a range of the player’s own actions', () => {
        const actions = history({ playerId: 'a' }, system, { playerId: 'a' })
        expect(playerUndoRestriction(actions, actions[0], 'a')).toBeUndefined()
    })

    it('names a reveal in the range', () => {
        const actions = history({ playerId: 'a' }, { ...system, revealsInfo: true })
        expect(playerUndoRestriction(actions, actions[0], 'a')).toBe(
            PlayerUndoRestriction.RevealsInformation
        )
    })

    it('names another player’s action in the range', () => {
        const actions = history({ playerId: 'a' }, { playerId: 'b' })
        expect(playerUndoRestriction(actions, actions[0], 'a')).toBe(
            PlayerUndoRestriction.OtherPlayersActions
        )
    })

    it('names a call that ended the game', () => {
        const actions = history({ playerId: 'a' }, call)
        expect(playerUndoRestriction(actions, actions[0], 'a')).toBe(
            PlayerUndoRestriction.CalledGame
        )
    })
})

describe('latestPlayerUndoTarget', () => {
    it('is the player’s latest action when nothing after it blocks Undo', () => {
        const actions = history({ playerId: 'a' }, { playerId: 'a' }, system)
        expect(latestPlayerUndoTarget(actions, 'a')?.index).toBe(1)
    })

    it('is nothing when another player acted after it', () => {
        expect(latestPlayerUndoTarget(history({ playerId: 'a' }, { playerId: 'b' }), 'a')).toBe(
            undefined
        )
    })
})
