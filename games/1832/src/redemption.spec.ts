import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { cashOwnedBy, getCompany, placeStockMarker, type Owner } from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import {
    redemptionChoices,
    reissueChoices,
    reissueParPrice,
    spendableCash,
    type EighteenThirtyTwoState
} from './index.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

type Play = ExamplePlay<EighteenThirtyTwoState>
const player = (playerId: string) => ({ kind: 'player' as const, playerId })
const acl = { kind: 'company' as const, companyId: 'ACL' }

function moveShares(
    state: EighteenThirtyTwoState,
    from: (certificate: { owner: Owner; poolId?: string }) => boolean,
    to: Owner,
    count: number,
    companyId = 'ACL'
) {
    for (const certificate of state.certificates) {
        if (count === 0) return
        if (
            certificate.retired ||
            certificate.kind !== 'share' ||
            certificate.president ||
            certificate.companyId !== companyId ||
            !from(certificate)
        )
            continue
        certificate.owner = to
        delete certificate.poolId
        count--
    }
}

const heldBy = (playerId: string) => (certificate: { owner: Owner }) =>
    certificate.owner.kind === 'player' && certificate.owner.playerId === playerId
const inOffering = (certificate: { poolId?: string }) => certificate.poolId === 'initial-offering'
const inMarket = (certificate: { poolId?: string }) => certificate.poolId === 'open-market'

function choiceFrom(play: Play, holderId: string) {
    const choice = redemptionChoices(play.state, 'alex').find(
        (entry) => entry.holder.kind === 'player' && entry.holder.playerId === holderId
    )
    assertExists(choice, `Alex may redeem from ${holderId}`)
    return choice
}

function buyOffering(play: Play, playerId: string, companyId: string, price: number) {
    const certificate = play.state.certificates.find(
        (entry) =>
            !entry.retired && entry.companyId === companyId && entry.poolId === 'initial-offering'
    )
    assertExists(certificate, `${companyId} has an offering share`)
    play.act(
        'BuyShares',
        { buyer: player(playerId), certificateId: certificate.id, expectedPrice: price },
        playerId
    )
}

/** ACL's offering sold out: Alex presides with 3 shares, Blair and Casey hold 3, the market 1. */
function trading(prepare: (state: EighteenThirtyTwoState) => void = () => {}) {
    return playExample(EighteenThirtyTwoScenarios, 'trading', 3, (state) => {
        moveShares(state, inOffering, player('blair'), 2)
        moveShares(state, inOffering, player('casey'), 2)
        prepare(state)
    })
}

describe('share redemption', () => {
    it('redeems an open-market share first, as the president’s only action', () => {
        const play = trading()
        const choices = redemptionChoices(play.state, 'alex')
        expect(choices).toEqual([
            expect.objectContaining({ companyId: 'ACL', holder: { kind: 'bank' }, price: 90 })
        ])
        play.act('RedeemShare', { companyId: 'ACL', certificateId: choices[0].certificateId })
        const share = play.state.certificates.find((item) => item.id === choices[0].certificateId)
        expect(share).toMatchObject({ owner: acl })
        expect(cashOwnedBy(play.state, acl)).toBe(510)
        // Acting for the company ends the president's turn.
        expect(play.state.activePlayerIds).toEqual(['blair'])
        expect(redemptionChoices(play.state, 'alex')).toEqual([])
    })

    it('asks another holder, who may agree', () => {
        const play = trading((state) => moveShares(state, inMarket, player('casey'), 1))
        const fromBlair = choiceFrom(play, 'blair')
        play.act('RedeemShare', { companyId: 'ACL', certificateId: fromBlair.certificateId })
        expect(play.state.machineState).toBe('ConsentingRedemption')
        expect(play.state.activePlayerIds).toEqual(['blair'])
        expect(play.valid('blair')).toEqual(['AnswerRedemption'])
        play.act('AnswerRedemption', { accept: true }, 'blair')
        expect(play.state.machineState).toBe('StockRound')
        expect(cashOwnedBy(play.state, player('blair'))).toBe(450 + 90)
        expect(
            play.state.certificates.find((item) => item.id === fromBlair.certificateId)
        ).toMatchObject({
            owner: acl
        })
        expect(play.state.activePlayerIds).toEqual(['blair'])
    })

    it('lets a holder refuse, leaving the president their turn', () => {
        const play = trading((state) => moveShares(state, inMarket, player('casey'), 1))
        const fromBlair = choiceFrom(play, 'blair')
        play.act('RedeemShare', { companyId: 'ACL', certificateId: fromBlair.certificateId })
        play.act('AnswerRedemption', { accept: false }, 'blair')
        expect(play.state.machineState).toBe('StockRound')
        expect(play.state.activePlayerIds).toEqual(['alex'])
        expect(play.valid('alex')).toContain('BuyShares')
        const holders = redemptionChoices(play.state, 'alex').map((choice) => choice.holder)
        expect(holders).not.toContainEqual(player('blair'))
        expect(holders).toContainEqual(player('casey'))
    })

    it('redeems the president’s own share only if they stay president', () => {
        const play = trading((state) => moveShares(state, inMarket, player('casey'), 1))
        expect(
            redemptionChoices(play.state, 'alex').map((choice) => choice.holder)
        ).not.toContainEqual(player('alex'))
        // With Blair and Casey down to two shares each, Alex keeps the presidency on two.
        const kept = trading((state) => {
            moveShares(state, inMarket, acl, 1)
            moveShares(state, heldBy('blair'), acl, 1)
            moveShares(state, heldBy('casey'), acl, 1)
        })
        const own = choiceFrom(kept, 'alex')
        kept.act('RedeemShare', { companyId: 'ACL', certificateId: own.certificateId })
        expect(kept.state.machineState).toBe('StockRound')
        expect(cashOwnedBy(kept.state, player('alex'))).toBe(600 + 90)
        expect(getCompany(kept.state, 'ACL').president).toEqual(player('alex'))
    })

    it('keeps the company at most 40% and others at least 60%', () => {
        const atLimit = trading((state) => moveShares(state, inMarket, acl, 1))
        expect(redemptionChoices(atLimit.state, 'alex')).not.toEqual([])
        const capped = trading((state) => {
            moveShares(state, inMarket, acl, 1)
            moveShares(state, (certificate) => certificate.owner.kind === 'player', acl, 3)
        })
        expect(redemptionChoices(capped.state, 'alex')).toEqual([])
        const withOffering = playExample(EighteenThirtyTwoScenarios, 'trading', 3)
        expect(redemptionChoices(withOffering.state, 'alex')).toEqual([])
    })

    it('redeems once per stock round', () => {
        const play = trading()
        play.state.redemptions = { ACL: { stockRound: play.state.stockRound.number, count: 1 } }
        expect(redemptionChoices(play.state, 'alex')).toEqual([])
        play.state.redemptions = { ACL: { stockRound: play.state.stockRound.number - 1, count: 1 } }
        expect(redemptionChoices(play.state, 'alex')).not.toEqual([])
    })
})

describe('share redemption limits', () => {
    it('waits for the company’s capital and for a turn without the president’s own action', () => {
        const unfunded = trading((state) => {
            const company = state.companies.find((entry) => entry.id === 'ACL')
            assertExists(company, 'ACL is in play')
            company.funded = false
        })
        expect(redemptionChoices(unfunded.state, 'alex')).toEqual([])
        const play = trading()
        buyOffering(play, 'alex', 'CG', 100)
        expect(redemptionChoices(play.state, 'alex')).toEqual([])
        expect(play.valid('alex')).not.toContain('RedeemShare')
    })

    it('is not offered to a president who must first sell down', () => {
        const play = trading((state) => moveShares(state, inOffering, player('alex'), 4, 'CG'))
        expect(redemptionChoices(play.state, 'alex')).toEqual([])
        expect(play.valid('alex')).not.toContain('RedeemShare')
    })

    it('accepts an answer only from the holder asked', () => {
        const play = trading((state) => moveShares(state, inMarket, player('casey'), 1))
        play.act('RedeemShare', {
            companyId: 'ACL',
            certificateId: choiceFrom(play, 'blair').certificateId
        })
        expect(() => play.act('AnswerRedemption', { accept: true }, 'casey')).toThrow()
    })

    it('may ask a refusing holder again on a later turn', () => {
        const play = trading((state) => moveShares(state, inMarket, player('casey'), 1))
        play.act('RedeemShare', {
            companyId: 'ACL',
            certificateId: choiceFrom(play, 'blair').certificateId
        })
        play.act('AnswerRedemption', { accept: false }, 'blair')
        buyOffering(play, 'alex', 'CG', 100)
        play.act('FinishStockTurn', {}, 'alex')
        play.act('FinishStockTurn', {}, 'blair')
        play.act('FinishStockTurn', {}, 'casey')
        expect(play.state.activePlayerIds).toEqual(['alex'])
        expect(choiceFrom(play, 'blair').companyId).toBe('ACL')
    })
})

describe('share reissue', () => {
    function holding(prepare: (state: EighteenThirtyTwoState) => void = () => {}) {
        return trading((state) => {
            moveShares(state, (certificate) => certificate.owner.kind === 'player', acl, 2)
            placeStockMarker(state.stockMarket, 'ACL', '0:12')
            prepare(state)
        })
    }

    it('rounds 75% of the price to the nearest reissue par, a tie upward, never below par', () => {
        const play = holding()
        expect(reissueParPrice(play.state, 'ACL')).toBe(160)
        placeStockMarker(play.state.stockMarket, 'ACL', '1:6')
        expect(reissueParPrice(play.state, 'ACL')).toBe(90)
    })

    it('returns every redeemed share to the offering, whose sales pay the company later', () => {
        const play = holding()
        expect(reissueChoices(play.state, 'alex')).toEqual([
            expect.objectContaining({ companyId: 'ACL', parPrice: 160 })
        ])
        play.act('ReissueShares', { companyId: 'ACL' })
        expect(getCompany(play.state, 'ACL').parPrice).toBe(160)
        const offered = play.state.certificates.filter(
            (certificate) =>
                !certificate.retired &&
                certificate.companyId === 'ACL' &&
                certificate.poolId === 'initial-offering'
        )
        expect(offered).toHaveLength(2)
        expect(play.state.activePlayerIds).toEqual(['blair'])
        const certificateId = offered[0].id
        play.act(
            'BuyShares',
            { buyer: player('blair'), certificateId, expectedPrice: 160 },
            'blair'
        )
        expect(cashOwnedBy(play.state, acl)).toBe(760)
        expect(spendableCash(play.state, 'ACL')).toBe(600)
    })

    it('reissues once a stock round', () => {
        const play = holding()
        play.act('ReissueShares', { companyId: 'ACL' })
        expect(play.state.reissues).toEqual({ ACL: play.state.stockRound.number })
        const again = structuredClone(play.state)
        moveShares(again, heldBy('casey'), acl, 1)
        expect(reissueChoices({ ...again, activePlayerIds: ['alex'] }, 'alex')).toEqual([])
    })

    it('keeps reissue proceeds from paying for a redemption that stock round', () => {
        const play = holding((state) => {
            const treasury = state.cash.find(
                (entry) => entry.owner.kind === 'company' && entry.owner.companyId === 'ACL'
            )
            assertExists(treasury, 'ACL has a treasury')
            treasury.amount = 100
        })
        play.act('ReissueShares', { companyId: 'ACL' })
        buyOffering(play, 'blair', 'ACL', 160)
        play.act('FinishStockTurn', {}, 'blair')
        play.act('FinishStockTurn', {}, 'casey')
        expect(cashOwnedBy(play.state, acl)).toBe(260)
        expect(spendableCash(play.state, 'ACL')).toBe(100)
        expect(redemptionChoices(play.state, 'alex')).toEqual([])
    })

    it('may reissue in the stock round it redeemed', () => {
        const play = trading()
        play.act('RedeemShare', {
            companyId: 'ACL',
            certificateId: redemptionChoices(play.state, 'alex')[0].certificateId
        })
        buyOffering(play, 'blair', 'CG', 100)
        play.act('FinishStockTurn', {}, 'blair')
        play.act('FinishStockTurn', {}, 'casey')
        expect(reissueChoices(play.state, 'alex')).toEqual([
            expect.objectContaining({ companyId: 'ACL' })
        ])
    })

    it('waits for the original offering to sell out', () => {
        const unsold = playExample(EighteenThirtyTwoScenarios, 'trading', 3, (state) =>
            moveShares(state, inMarket, acl, 1)
        )
        expect(reissueChoices(unsold.state, 'alex')).toEqual([])
    })
})
