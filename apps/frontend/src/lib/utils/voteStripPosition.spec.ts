import { describe, expect, it } from 'vitest'
import { offersUndoRequest, shownProposal, voteStripPosition } from './voteStripPosition'

const viewed = {
    actionIndex: 3,
    liveActionCount: 7,
    beyondUndoReach: true,
    startsWithUserAction: true
}

describe('voteStripPosition', () => {
    it('takes the position a UI Artifact reports', () => {
        expect(
            voteStripPosition({
                reportsPosition: true,
                seated: true,
                viewedPosition: viewed,
                isViewingHistory: true,
                actionCount: 5
            })
        ).toEqual(viewed)
    })

    it('keeps no position when the UI Artifact reports none, though History View shows', () => {
        // A replay plays in History View while the player stays where they were.
        expect(
            voteStripPosition({
                reportsPosition: true,
                seated: true,
                viewedPosition: undefined,
                isViewingHistory: true,
                actionCount: 5
            })
        ).toBeUndefined()
    })

    it('offers every History View position for a UI Artifact that reports none', () => {
        expect(
            voteStripPosition({
                reportsPosition: false,
                seated: true,
                viewedPosition: undefined,
                isViewingHistory: true,
                actionCount: 5
            })
        ).toEqual({
            actionIndex: 5,
            liveActionCount: 5,
            beyondUndoReach: true,
            startsWithUserAction: true
        })
        expect(
            voteStripPosition({
                reportsPosition: false,
                seated: true,
                viewedPosition: undefined,
                isViewingHistory: false,
                actionCount: 5
            })
        ).toBeUndefined()
    })

    it('shows History View to someone without a seat, for whom no position is reported', () => {
        expect(
            voteStripPosition({
                reportsPosition: true,
                seated: false,
                viewedPosition: undefined,
                isViewingHistory: true,
                actionCount: 5
            })
        ).toEqual({
            actionIndex: 5,
            liveActionCount: 5,
            beyondUndoReach: true,
            startsWithUserAction: true
        })
    })
})

describe('offersUndoRequest', () => {
    it('offers a request beyond the player’s Undo where a user action starts', () => {
        expect(offersUndoRequest(viewed)).toBe(true)
        expect(offersUndoRequest({ ...viewed, beyondUndoReach: false })).toBe(false)
        expect(offersUndoRequest({ ...viewed, startsWithUserAction: false })).toBe(false)
    })

    it('offers none while a replay plays', () => {
        expect(offersUndoRequest({ ...viewed, replaying: true })).toBe(false)
        expect(offersUndoRequest({ ...viewed, replaying: false })).toBe(true)
    })
})

describe('shownProposal', () => {
    const proposal = { actionIndex: 3, kind: 'ownUndo' as const }

    it('shows a proposal at the position it was made for', () => {
        expect(shownProposal(proposal, viewed)).toBe(proposal)
        expect(shownProposal(proposal, { ...viewed, actionIndex: 4 })).toBeUndefined()
        expect(shownProposal(proposal, undefined)).toBeUndefined()
    })

    it('holds a proposal back while a replay plays', () => {
        expect(shownProposal(proposal, { ...viewed, replaying: true })).toBeUndefined()
    })
})
