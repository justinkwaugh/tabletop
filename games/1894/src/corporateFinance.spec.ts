import { describe, expect, it } from 'vitest'
import { playExample } from '@tabletop/18xx/scenarios'
import { cashOwnedBy, corporateFinanceChoices, getCompany } from '@tabletop/18xx'
import { EighteenNinetyFourCorporateFinanceRules } from './corporateFinance.js'
import { EighteenNinetyFourScenarios } from './scenarios/index.js'
import { EighteenNinetyFourMarket } from './stockMarket.js'
import type { EighteenNinetyFourState } from './state.js'

const cfor = { kind: 'company', companyId: 'CFOR' } as const

/** CFOR, floated at F80, begins its turn's financial step with shares in the given places. */
function cforFinances(
    places: Readonly<Record<string, 'pool' | 'ipo' | 'treasury' | 'player'>>,
    roundNumber = 1
) {
    return (state: EighteenNinetyFourState) => {
        const company = state.companies.find((entry) => entry.id === 'CFOR')!
        Object.assign(company, {
            started: true,
            floated: true,
            funded: true,
            operated: true,
            parPrice: 67,
            president: { kind: 'player', playerId: state.players[0].playerId }
        })
        EighteenNinetyFourMarket.placeMarker(state.stockMarket, 'CFOR', '4:3')
        for (const certificate of state.certificates) {
            if (certificate.companyId !== 'CFOR' || certificate.kind !== 'share') continue
            if (certificate.president) {
                certificate.owner = { kind: 'player', playerId: state.players[0].playerId }
                delete certificate.poolId
                continue
            }
            const place = places[certificate.id] ?? 'player'
            if (place === 'pool' || place === 'ipo') {
                certificate.owner = { kind: 'bank' }
                certificate.poolId = place === 'pool' ? 'open-market' : 'initial-offering'
            } else {
                certificate.owner =
                    place === 'treasury'
                        ? cfor
                        : { kind: 'player', playerId: state.players[1].playerId }
                delete certificate.poolId
            }
        }
        const treasury = state.cash.find(
            (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'CFOR'
        )!
        treasury.amount = 500
        state.operatingSet = {
            ...state.operatingSet!,
            companyOrder: ['CFOR', 'Belge', 'PLM'],
            roundNumber
        }
        state.trackStep = { companyId: 'CFOR', lays: [], completed: false }
        state.machineState = 'LayingTrack'
    }
}

describe('financial operations (§7.3.2)', () => {
    const redeem = (shares: number, amount: number) => ({
        companyId: 'CFOR',
        operation: 'redeem',
        shares,
        amount
    })
    const offered = (play: { state: EighteenNinetyFourState }) =>
        corporateFinanceChoices(play.state, EighteenNinetyFourCorporateFinanceRules)
    const pool = { 'CFOR:share:1': 'pool', 'CFOR:share:2': 'pool', 'CFOR:share:3': 'pool' } as const

    it('redeems up to two bank-pool shares at the share price in the set’s first round', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, cforFinances(pool))
        expect(offered(play).map((choice) => choice.shares)).toEqual([1, 2])
        play.act('CorporateFinance', redeem(2, 160))
        expect(play.state.machineState).toBe('LayingTrack')
        expect(cashOwnedBy(play.state, cfor)).toBe(340)
        const held = play.state.certificates.filter(
            (certificate) =>
                certificate.owner.kind === 'company' && certificate.owner.companyId === 'CFOR'
        )
        expect(held).toHaveLength(2)
        expect(held.every((certificate) => certificate.poolId === undefined)).toBe(true)
    })

    it('makes one operation a round, so nothing follows a redemption', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, cforFinances(pool))
        play.act('CorporateFinance', redeem(1, 80))
        expect(offered(play)).toEqual([])
        expect(() => play.act('CorporateFinance', redeem(1, 80))).toThrow()
    })

    it('redeems one share in later rounds', () => {
        const play = playExample(
            EighteenNinetyFourScenarios,
            'construction',
            3,
            cforFinances(pool, 2)
        )
        expect(offered(play).map((choice) => choice.shares)).toEqual([1])
    })

    it('reissues all owned shares to the IPO at F100 and sets par to F100', () => {
        const play = playExample(
            EighteenNinetyFourScenarios,
            'construction',
            3,
            cforFinances({
                'CFOR:share:1': 'treasury',
                'CFOR:share:2': 'treasury',
                'CFOR:share:3': 'treasury',
                'CFOR:share:4': 'ipo',
                'CFOR:share:5': 'ipo'
            })
        )
        expect(offered(play)).toEqual([
            { companyId: 'CFOR', operation: 'issue', shares: 3, amount: 300 }
        ])
        play.act('CorporateFinance', {
            companyId: 'CFOR',
            operation: 'issue',
            shares: 3,
            amount: 300
        })
        expect(play.state.machineState).toBe('LayingTrack')
        expect(cashOwnedBy(play.state, cfor)).toBe(800)
        expect(getCompany(play.state, 'CFOR').parPrice).toBe(100)
        expect(
            play.state.certificates.filter(
                (certificate) =>
                    certificate.companyId === 'CFOR' && certificate.poolId === 'initial-offering'
            )
        ).toHaveLength(5)
        expect(offered(play)).toEqual([])
    })

    it('stays open until routes are run, then closes', () => {
        const during = (machineState: string) =>
            playExample(EighteenNinetyFourScenarios, 'construction', 3, (state) => {
                cforFinances(pool)(state)
                state.machineState = machineState
            })
        for (const open of ['LayingTrack', 'RunningTrains']) {
            expect(offered(during(open))).not.toEqual([])
        }
        for (const closed of ['DistributingEarnings', 'BuyingTrains']) {
            expect(offered(during(closed))).toEqual([])
        }
        const stations = playExample(EighteenNinetyFourScenarios, 'construction', 3, (state) => {
            cforFinances(pool)(state)
            state.trackStep = { companyId: 'CFOR', lays: [], completed: true }
            state.stationStep = { companyId: 'CFOR', placedStationIds: [], completed: false }
            state.machineState = 'PlacingStation'
        })
        expect(stations.valid(stations.state.activePlayerIds[0])).toContain('CorporateFinance')
        stations.act('CorporateFinance', redeem(1, 80))
        expect(cashOwnedBy(stations.state, cfor)).toBe(420)
    })

    it('offers the starting companies nothing', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, cforFinances(pool))
        const state = play.state
        state.operatingSet = { ...state.operatingSet!, companyOrder: ['Belge', 'CFOR', 'PLM'] }
        expect(offered(play)).toEqual([])
    })
})
