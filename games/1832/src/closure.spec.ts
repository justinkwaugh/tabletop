import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { isStartOperatingRound, placeStockMarker, recordedRoundEnd } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenThirtyTwoMarket, isCloseCompany } from './index.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

function closingOnItsTurn(last: boolean) {
    return playExample(EighteenThirtyTwoScenarios, 'construction', 3, (state) => {
        const black = EighteenThirtyTwoMarket.spaces.find((space) => space.color === 'black')
        assertExists(black, 'The market has a black area')
        placeStockMarker(state.stockMarket, 'CG', black.id)
        const set = state.operatingSet
        assertExists(set, 'The construction position is an operating round')
        if (last)
            set.completedCompanyIds = set.companyOrder.filter((companyId) => companyId !== 'CG')
    })
}

describe('closure on a company’s own turn', () => {
    it('ends the operating round when the company was its last', () => {
        const play = closingOnItsTurn(true)
        play.act('FinishTrack', { companyId: 'CG' })
        const closure = play.processed.find(isCloseCompany)
        assertExists(closure, 'CG closes')
        expect(closure.metadata?.endedTurn).toBe(true)
        // The round's end is the next round's start before that round's private income.
        const end = recordedRoundEnd(closure)
        const next = play.processed.find(isStartOperatingRound)?.metadata
        assertExists(end, 'The closure records the round’s end')
        assertExists(next, 'The next operating round starts')
        expect(end.round).toBe('operating')
        expect(
            Object.fromEntries(
                Object.entries(end.playerNetWorth).map(([playerId, wealth]) => [
                    playerId,
                    wealth +
                        next.payments
                            .filter(({ to }) => to.kind === 'player' && to.playerId === playerId)
                            .reduce((sum, payment) => sum + payment.amount, 0)
                ])
            )
        ).toEqual(next.snapshot.playerNetWorth)
    })
    it('records no round end while companies are still to operate', () => {
        const play = closingOnItsTurn(false)
        play.act('FinishTrack', { companyId: 'CG' })
        const closure = play.processed.find(isCloseCompany)
        assertExists(closure, 'CG closes')
        expect(closure.metadata?.endedTurn).toBe(true)
        expect(recordedRoundEnd(closure)).toBeUndefined()
    })
})
