import { describe, expect, it } from 'vitest'
import { playExample } from '@tabletop/18xx/scenarios'
import { cashOwnedBy, getCompany } from '@tabletop/18xx'
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
        delete state.trackStep
        state.shareStep = { companyId: 'CFOR', trades: [], completed: false }
        state.machineState = 'ManagingShares'
    }
}

describe('financial operations (§7.3.2)', () => {
    it('redeems two bank-pool shares at the share price in the set’s first round', () => {
        const play = playExample(
            EighteenNinetyFourScenarios,
            'construction',
            3,
            cforFinances({ 'CFOR:share:1': 'pool', 'CFOR:share:2': 'pool', 'CFOR:share:3': 'pool' })
        )
        play.act('TradeTreasuryShares', {
            companyId: 'CFOR',
            operation: 'redeem',
            certificateIds: ['CFOR:share:1'],
            amount: 80
        })
        expect(play.state.machineState).toBe('ManagingShares')
        play.act('TradeTreasuryShares', {
            companyId: 'CFOR',
            operation: 'redeem',
            certificateIds: ['CFOR:share:2'],
            amount: 80
        })
        expect(play.state.machineState).toBe('LayingTrack')
        expect(cashOwnedBy(play.state, cfor)).toBe(340)
        expect(
            play.state.certificates.filter(
                (certificate) =>
                    certificate.owner.kind === 'company' && certificate.owner.companyId === 'CFOR'
            )
        ).toHaveLength(2)
    })

    it('redeems one share in later rounds, and reissues all owned shares to the IPO at F100', () => {
        const later = playExample(
            EighteenNinetyFourScenarios,
            'construction',
            3,
            cforFinances({ 'CFOR:share:1': 'pool', 'CFOR:share:2': 'pool' }, 2)
        )
        later.act('TradeTreasuryShares', {
            companyId: 'CFOR',
            operation: 'redeem',
            certificateIds: ['CFOR:share:1'],
            amount: 80
        })
        expect(later.state.machineState).toBe('LayingTrack')

        const reissue = playExample(
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
        reissue.act('TradeTreasuryShares', {
            companyId: 'CFOR',
            operation: 'issue',
            certificateIds: ['CFOR:share:1', 'CFOR:share:2', 'CFOR:share:3'],
            amount: 300,
            poolId: 'initial-offering',
            parPrice: 100
        })
        expect(reissue.state.machineState).toBe('LayingTrack')
        expect(cashOwnedBy(reissue.state, cfor)).toBe(800)
        expect(getCompany(reissue.state, 'CFOR').parPrice).toBe(100)
    })

    it('passes the starting companies and a company with nothing to do straight to track', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, cforFinances({}))
        expect(play.valid(play.state.activePlayerIds[0])).toContain('FinishTreasuryShares')
        expect(play.valid(play.state.activePlayerIds[0])).not.toContain('TradeTreasuryShares')
        play.act('FinishTreasuryShares', { companyId: 'CFOR' })
        expect(play.state.machineState).toBe('LayingTrack')
    })
})
