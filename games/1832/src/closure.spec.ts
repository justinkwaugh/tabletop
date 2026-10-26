import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { isStartOperatingRound, placeStockMarker, recordedRoundEnd } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenThirtyTwoMarket, isCloseCompany } from './index.js'
import { addUnstartedRailroads, EighteenThirtyTwoScenarios } from './scenarios/index.js'

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

describe('closure lowering the certificate limit', () => {
    it('records each company’s own step when two prices reach the black area together', () => {
        const play = playExample(EighteenThirtyTwoScenarios, 'trading', 3, (state) => {
            addUnstartedRailroads(state)
            const black = EighteenThirtyTwoMarket.spaces.filter((space) => space.color === 'black')
            placeStockMarker(state.stockMarket, 'ACL', black[0].id)
            placeStockMarker(state.stockMarket, 'CG', black[1].id)
        })
        play.act('FinishStockTurn')
        // Three players: ten railroads allow 20 certificates, nine 17, eight 15 (Table 2).
        expect(
            play.processed
                .filter(isCloseCompany)
                .map((closure) => closure.metadata?.certificateLimit)
        ).toEqual([
            { from: 20, to: 17 },
            { from: 17, to: 15 }
        ])
    })
})
