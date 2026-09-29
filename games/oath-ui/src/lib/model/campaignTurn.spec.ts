import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { ActionType, MachineState } from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { campaignDraftOpens, heldTurnOf } from './campaignTurn.js'

const SNEAK_ATTACK = 'denizen.discord.sneak-attack'

function board(overrides: Parameters<typeof testState>[1] = {}, freeTravelAtAction?: number) {
    const state = testState(
        [
            testPlayer({ playerId: 'turn', color: Color.Red, siteId: 'c1', freeTravelAtAction }),
            testPlayer({ playerId: 'sneak', color: Color.Blue, siteId: 'c1' })
        ],
        overrides
    )
    state.turnManager.series = [{ type: 'turn', playerId: 'turn', start: 0 }]
    return state
}

describe('heldTurnOf', () => {
    it('names whose turn waits and who campaigns while a turn is held', () => {
        const state = board({
            machineState: MachineState.CampaignPlans,
            heldTurn: { queue: [], askingPlayerId: 'turn', resumeMachineState: MachineState.ActPhase }
        })
        state.activePlayerIds = ['sneak']
        expect(heldTurnOf(state)).toEqual({ turnPlayerId: 'turn', campaignerId: 'sneak' })
    })

    it('says nothing when no turn is held', () => {
        expect(heldTurnOf(board())).toBeUndefined()
    })
})

describe('campaignDraftOpens', () => {
    it('opens for a chosen Campaign the engine offers, in any phase', () => {
        expect(campaignDraftOpens(ActionType.Campaign, [ActionType.AnswerQuestion, ActionType.Campaign])).toBe(true)
    })

    it('stays shut for another action, or a Campaign no longer offered', () => {
        expect(campaignDraftOpens(ActionType.Travel, [ActionType.Campaign])).toBe(false)
        expect(campaignDraftOpens(ActionType.Campaign, [ActionType.AnswerQuestion])).toBe(false)
        expect(campaignDraftOpens(undefined, [ActionType.Campaign])).toBe(false)
    })
})
