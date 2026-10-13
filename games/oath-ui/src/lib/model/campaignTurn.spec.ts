import { describe, expect, it } from 'vitest'
import { ActionType } from '@tabletop/oath'
import { campaignDraftOpens } from './campaignTurn.js'

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
