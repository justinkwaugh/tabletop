import { evaluatePurchaseOffer, getCompany, sharesOwned, trainsOwnedBy } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { buyTrain, type Table } from '../test/kit.js'
import { cashOf, hold, player, treasury, twoCompanies, type Holding } from '../test/positions.js'
import { TrainRules1862, TransferRules1862 } from './operating.js'
import { IpoPoolId, MarketPoolId } from './pools.js'
import type { State1862 } from './state.js'
import {
    dueBankruptcy,
    isBankruptCompany,
    isGoBankrupt,
    nextBankTrainPrice,
    treasurySale
} from './trainFunding.js'
import { trainFace } from './trains.js'

/** Leaves the bank's depot starting at the F trains, at £600. */
function depotFromF(state: State1862) {
    state.trainInventory.trains = state.trainInventory.trains.filter(
        (train) => train.status !== 'depot' || trainFace(train.definitionId).band >= 'F'
    )
    state.phaseId = 'F'
}

function inIpo(game: Table, companyId: string) {
    return game.state.certificates.filter(
        (certificate) => certificate.companyId === companyId && certificate.poolId === IpoPoolId
    ).length
}

describe('1862 company bankruptcy (§7.11, §7.12)', () => {
    it('lets a train-less company that can raise nothing go bankrupt, paying holders half price', () => {
        const { game, state, a, b } = twoCompanies(
            { price: 50, train: false, cash: 0 },
            { price: 90, train: true },
            'BuyingTrains'
        )
        hold(state, a, [
            { owner: player('p1'), shares: 4 },
            { owner: player('p2'), shares: 2 },
            { owner: 'pool', shares: 4 }
        ])
        hold(state, b, [{ owner: player('p3'), shares: 6 }])
        state.activePlayerIds = ['p1']
        game.state = structuredClone(state)
        // Refinancing at £100 par raises £1,000, enough for any train.
        expect(game.valid('p1')).toContain('Refinance')
        expect(game.valid('p1')).not.toContain('GoBankrupt')

        // At £54 par refinancing raises £540, short of the £600 F train.
        getCompany(state, a).parPrice = 54
        depotFromF(state)
        game.state = state
        expect(nextBankTrainPrice(game.state)).toBe(600)
        expect(treasurySale(game.state, a)).toBeUndefined()
        expect(game.valid('p1')).toEqual(expect.arrayContaining(['GoBankrupt']))
        expect(game.valid('p1')).not.toContain('Refinance')
        const before = ['p1', 'p2'].map((id) => cashOf(game, player(id)))

        game.act('GoBankrupt', { companyId: a }, 'p1')

        const [bankruptcy] = game.actions.filter(isGoBankrupt)
        // Shares of a train-less company sell for half the £50 price; the Bank Pool gets nothing.
        expect(bankruptcy.metadata?.payments).toEqual([
            { from: { kind: 'bank' }, to: player('p1'), amount: 4 * 25 },
            { from: { kind: 'bank' }, to: player('p2'), amount: 2 * 25 }
        ])
        expect(['p1', 'p2'].map((id) => cashOf(game, player(id)))).toEqual([
            before[0] + 100,
            before[1] + 50
        ])
        expect(getCompany(game.state, a).started).toBeFalsy()
        expect(inIpo(game, a)).toBe(8)
        expect(game.state.trackStep?.companyId).toBe(b)
    })

    it('bankrupts a director-less company only once its own turn ends without a train', () => {
        const { game, state, a, b } = twoCompanies(
            { price: 100, train: true },
            { price: 60, train: false, cash: 0 },
            'BuyingTrains'
        )
        hold(state, a, [{ owner: player('p1'), shares: 6 }])
        hold(state, b, [
            { owner: player('p2'), shares: 2 },
            { owner: player('p3'), shares: 1 },
            { owner: 'pool', shares: 4 }
        ])
        const director = state.certificates.find(
            (certificate) =>
                certificate.companyId === b && certificate.kind === 'share' && certificate.president
        )
        assertExists(director, 'The company has a director’s certificate')
        director.poolId = MarketPoolId
        state.activePlayerIds = ['p1']
        game.state = state
        expect(dueBankruptcy(game.state)).toBeUndefined()
        const before = ['p2', 'p3'].map((id) => cashOf(game, player(id)))

        game.act('FinishOperatingTurn', { companyId: a }, 'p1')

        const bankruptcies = game.actions.filter(isBankruptCompany)
        expect(bankruptcies.map((action) => action.companyId)).toEqual([b])
        expect(game.state.operatingSet?.completedCompanyIds).toContain(b)
        // Withholding nothing moved £60 to £58; train-less shares are paid at half of it.
        expect(bankruptcies[0].metadata?.payments).toEqual([
            { from: { kind: 'bank' }, to: player('p2'), amount: 2 * 29 },
            { from: { kind: 'bank' }, to: player('p3'), amount: 29 }
        ])
        expect(['p2', 'p3'].map((id) => cashOf(game, player(id)))).toEqual([
            before[0] + 58,
            before[1] + 29
        ])
        expect(getCompany(game.state, b).started).toBeFalsy()
        expect(inIpo(game, b)).toBe(8)
    })
})

describe('1862 forced train purchases (§7.11)', () => {
    function trainless(cash: number) {
        const { game, state, a, b } = twoCompanies(
            { price: 60, train: false, cash },
            { price: 90, train: true },
            'BuyingTrains'
        )
        hold(state, a, [
            { owner: player('p1'), shares: 6 },
            { owner: treasury(a), shares: 2 },
            { owner: 'pool', shares: 2 }
        ])
        hold(state, b, [{ owner: player('p2'), shares: 6 }])
        state.activePlayerIds = ['p1']
        game.state = state
        const [trainId] = trainsOwnedBy(game.state, treasury(b)).map((train) => train.id)
        const offer = (from: State1862) =>
            evaluatePurchaseOffer(
                from,
                {
                    companyId: a,
                    asset: { kind: 'train', trainId },
                    seller: treasury(b),
                    price: 100
                },
                TransferRules1862,
                TrainRules1862
            )
        return { game, a, offer }
    }

    const fromAnotherCompany = 'This asset cannot be purchased at this point in the turn.'

    it('is from the bank only once the company has sold its own shares', () => {
        const { game, a, offer } = trainless(50)
        expect(treasurySale(game.state, a)).toBe(1)
        game.act('SellTreasuryShares', { companyId: a, shares: 1 }, 'p1')
        expect(cashOf(game, treasury(a))).toBe(110)
        expect(game.state.raisedForTrain).toBe(a)
        expect(offer(game.state).reason).toBe(fromAnotherCompany)
        const { raisedForTrain: _raised, ...unraised } = game.state
        expect(offer(unraised)).toEqual({ buyerPlayerId: 'p1', sellerPlayerId: 'p2' })
        buyTrain(game, 'AE')
        expect(trainsOwnedBy(game.state, treasury(a))).toHaveLength(1)
    })

    it('is from the bank only once the company has refinanced', () => {
        const { game, a, offer } = trainless(0)
        game.act('Refinance', { companyId: a }, 'p1')
        while (game.state.machineState === 'MergingShares')
            game.act('DecideOption', { redeem: false }, game.player)
        expect(game.state.machineState).toBe('BuyingTrains')
        expect(game.state.raisedForTrain).toBe(a)
        expect(cashOf(game, treasury(a))).toBe(1000)
        expect(offer(game.state).reason).toBe(fromAnotherCompany)
        buyTrain(game, 'AE')
        game.act('FinishOperatingTurn', { companyId: a }, 'p1')
        expect(game.state.raisedForTrain).toBeUndefined()
    })
})

describe('1862 refinancing with a 50% director (§5.1.3, §5.2.4, §5.2.5)', () => {
    function refinancing(holdings: readonly Holding[]) {
        const { game, state, a } = twoCompanies(
            { price: 60, train: false, cash: 0 },
            { price: 90, train: true },
            'BuyingTrains'
        )
        hold(state, a, holdings)
        state.activePlayerIds = ['p1']
        game.state = state
        game.act('Refinance', { companyId: a }, 'p1')
        return { game, a }
    }

    function decide(game: Table, playerId: string, redeem: boolean) {
        const option = game.state.shareMerge?.option
        assertExists(option, 'A holder has an option to decide')
        expect(option.holder).toEqual(player(playerId))
        const price = game.state.shareMerge?.price
        assertExists(price, 'A share merge has its price')
        const before = cashOf(game, player(playerId))
        game.act('DecideOption', { redeem }, playerId)
        return { option, price, paid: before - cashOf(game, player(playerId)) }
    }

    it('lets the director swap for three pool shares, then keep the option and stay director', () => {
        const { game, a } = refinancing([
            { owner: player('p1'), shares: 5 },
            { owner: player('p2'), shares: 2 },
            { owner: 'pool', shares: 3 }
        ])
        const { option, price, paid } = decide(game, 'p1', true)
        expect(option.redeemCost).toBe(Math.floor(price / 2))
        expect(option.sellValue).toBe(option.redeemCost)
        expect(paid).toBe(option.redeemCost)
        while (game.state.machineState === 'MergingShares')
            game.act('DecideOption', { redeem: false }, game.player)
        expect(getCompany(game.state, a).president).toEqual(player('p1'))
        expect(sharesOwned(game.state, a, player('p1'))).toBe(3)
    })

    it('makes the director’s certificate the option when the pool lacks three shares', () => {
        const { game, a } = refinancing([
            { owner: player('p1'), shares: 5 },
            { owner: player('p2'), shares: 3 },
            { owner: 'pool', shares: 2 }
        ])
        const { option, price, paid } = decide(game, 'p1', true)
        expect(option.redeemCost).toBe(Math.floor(price / 2))
        expect(option.sellValue).toBe(Math.floor(price * 2.5))
        expect(paid).toBe(option.redeemCost)
        while (game.state.machineState === 'MergingShares')
            game.act('DecideOption', { redeem: false }, game.player)
        expect(getCompany(game.state, a).president).toEqual(player('p1'))
        expect(sharesOwned(game.state, a, player('p1'))).toBe(3)
    })

    it('leaves the company in receivership once the director gives the option up', () => {
        const { game, a } = refinancing([
            { owner: player('p1'), shares: 5 },
            { owner: player('p2'), shares: 2 },
            { owner: 'pool', shares: 3 }
        ])
        decide(game, 'p1', false)
        while (game.state.machineState === 'MergingShares')
            game.act('DecideOption', { redeem: false }, game.player)
        expect(getCompany(game.state, a).president).toBeUndefined()
        expect(sharesOwned(game.state, a, player('p1'))).toBe(2)
    })
})
