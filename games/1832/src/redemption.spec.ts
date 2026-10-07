import { describe, expect, it } from 'vitest'
import { cashOwnedBy, getCompany, placeStockMarker, type Owner } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import {
    redemptionChoices,
    reissueChoices,
    reissueParPrice,
    spendableCash,
    type EighteenThirtyTwoState
} from './index.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

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
        const fromBlair = redemptionChoices(play.state, 'alex').find(
            (choice) => choice.holder.kind === 'player' && choice.holder.playerId === 'blair'
        )!
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
        const fromBlair = redemptionChoices(play.state, 'alex').find(
            (choice) => choice.holder.kind === 'player' && choice.holder.playerId === 'blair'
        )!
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
        const own = redemptionChoices(kept.state, 'alex').find(
            (choice) => choice.holder.kind === 'player' && choice.holder.playerId === 'alex'
        )!
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

    it('waits for the original offering to sell out', () => {
        const unsold = playExample(EighteenThirtyTwoScenarios, 'trading', 3, (state) =>
            moveShares(state, inMarket, acl, 1)
        )
        expect(reissueChoices(unsold.state, 'alex')).toEqual([])
    })
})
