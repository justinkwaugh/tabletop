import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    placeStockMarker,
    cashOwnedBy,
    companyMarketSpace,
    getCompany,
    sharesOwned,
    stockMarkerStackIndex
} from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoEarningsRules,
    EighteenThirtyTwoStationRules,
    EighteenThirtyTwoTrackRules,
    EighteenThirtyTwoTrainRules,
    MiamiLocationId,
    certificateLimitColumn,
    discardSharedHome,
    formSystem,
    stopBonuses,
    systemMarketSpace,
    systemPresident
} from './index.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

const player = (playerId: string) => ({ kind: 'player' as const, playerId })

function trading() {
    return playExample(EighteenThirtyTwoScenarios, 'trading', 3)
}

describe('System formation', () => {
    it('averages the prices, rounding a tie up, and slides down the diagonal to a ledge', () => {
        const { state } = trading()
        // ACL $90 and CG $100 average $95, which rounds up to $100, placed from ACL's row.
        expect(systemMarketSpace(state.stockMarket, ['ACL', 'CG']).id).toBe('4:10')
    })

    it('makes the initiator, or the next player with four shares, its president', () => {
        const { state } = trading()
        expect(systemPresident(state, ['ACL', 'CG'], 'alex')).toBe('alex')
        expect(systemPresident(state, ['ACL', 'CG'], 'casey')).toBe('alex')
    })

    it('replaces the components with a twenty-share System holding their assets', () => {
        const play = trading()
        const state = structuredClone(play.state)
        const formation = formSystem(state, ['ACL', 'CG'], 'alex')
        play.replaceState(state)
        expect(formation).toMatchObject({
            systemId: 'AMTK',
            presidentPlayerId: 'alex',
            marketSpaceId: '4:10',
            parPrice: 100,
            exchangedCertificateIds: ['ACL:president', 'ACL:share:1', 'CG:share:2']
        })
        const amtk = getCompany(play.state, 'AMTK')
        expect(amtk).toMatchObject({ shareCount: 20, president: player('alex'), operated: true })
        expect(getCompany(play.state, 'ACL').closed).toBe(true)
        expect(getCompany(play.state, 'CG').closed).toBe(true)
        expect(sharesOwned(play.state, 'AMTK', player('alex'))).toBe(6)
        // Blair's CG president's certificate becomes a two-share vice-president's certificate.
        expect(sharesOwned(play.state, 'AMTK', player('blair'))).toBe(4)
        expect(
            play.state.certificates.filter(
                (certificate) =>
                    !certificate.retired &&
                    certificate.companyId === 'AMTK' &&
                    certificate.kind === 'share' &&
                    certificate.shares === 2
            )
        ).toHaveLength(1)
        const total = play.state.certificates.reduce(
            (sum, certificate) =>
                sum +
                (!certificate.retired &&
                certificate.kind === 'share' &&
                certificate.companyId === 'AMTK'
                    ? certificate.shares
                    : 0),
            0
        )
        expect(total).toBe(20)
        expect(cashOwnedBy(play.state, { kind: 'company', companyId: 'AMTK' })).toBe(1200)
        expect(companyMarketSpace(play.state.stockMarket, 'AMTK').id).toBe('4:10')
        expect(stockMarkerStackIndex(play.state.stockMarket, 'AMTK')).toBe(0)
        expect(play.state.systems).toEqual({ AMTK: ['ACL', 'CG'] })
        expect(
            play.state.stations.filter(
                (station) => station.companyId === 'AMTK' && station.status === 'placed'
            )
        ).toHaveLength(2)
    })
})

describe('System formation edge cases', () => {
    it('takes the nearest price its leftmost component’s row has', () => {
        const { state } = trading()
        placeStockMarker(state.stockMarket, 'ACL', '5:9')
        placeStockMarker(state.stockMarket, 'CG', '0:12')
        // $82 and $200 average $141; row 5 tops out at $110.
        expect(systemMarketSpace(state.stockMarket, ['ACL', 'CG'])).toMatchObject({
            id: '5:12',
            price: 110
        })
    })

    it('passes the presidency on with the vice-president’s certificate in the exchange', () => {
        const play = trading()
        const state = structuredClone(play.state)
        for (const certificate of state.certificates)
            if (
                !certificate.retired &&
                certificate.companyId === 'ACL' &&
                certificate.poolId === 'initial-offering'
            ) {
                certificate.owner = player('blair')
                delete certificate.poolId
            }
        const formation = formSystem(state, ['ACL', 'CG'], 'alex')
        play.replaceState(state)
        expect(formation.presidency?.next).toEqual(player('blair'))
        const vicePresident = play.state.certificates.find(
            (certificate) =>
                !certificate.retired &&
                certificate.companyId === 'AMTK' &&
                certificate.kind === 'share' &&
                !certificate.president &&
                certificate.shares === 2
        )
        assertExists(vicePresident, 'The vice-president’s certificate is in play')
        expect(formation.presidency?.exchangedCertificateIds).toContain(vicePresident.id)
    })

    it('carries a component’s reissue over, so unsold shares still pay the System', () => {
        const play = trading()
        const state = structuredClone(play.state)
        state.reissues = { ACL: state.stockRound.number }
        formSystem(state, ['ACL', 'CG'], 'alex')
        expect(state.reissues).toMatchObject({ AMTK: state.stockRound.number })
    })

    it('discards one of two homes that share a city', () => {
        const { state } = trading()
        const draft = structuredClone(state)
        draft.stations = draft.stations.map((station) =>
            station.id === 'CG:home' && station.status === 'placed'
                ? { ...station, position: { locationId: 'T29', nodeId: 'city', slot: 1 } }
                : station
        )
        expect(discardSharedHome(draft, 'ACL', 'CG')).toBe('CG:home')
        expect(draft.stations.find((station) => station.id === 'CG:home')?.status).toBe('removed')
        expect(discardSharedHome(structuredClone(state), 'ACL', 'CG')).toBeUndefined()
    })

    it('gives the FEC’s Key West bonus to the company it merged into', () => {
        const { state } = trading()
        const merged = {
            ...state,
            mergers: [{ kind: 'system' as const, companyIds: ['FEC', 'SAL'], survivorId: 'AMTK' }],
            revenueTokens: [
                {
                    kind: 'key-west' as const,
                    companyId: 'AMTK',
                    locationId: MiamiLocationId,
                    nodeId: 'offboard',
                    placed: { set: 1, round: 1 }
                }
            ]
        }
        const miami = { locationId: MiamiLocationId, nodeId: 'offboard' }
        expect(stopBonuses(merged, 'AMTK', miami)).toEqual([{ amount: 50, label: 'Key West' }])
        expect(stopBonuses(merged, 'CG', miami)).toEqual([])
    })
})

describe('System operations', () => {
    function amtk() {
        const play = trading()
        const state = structuredClone(play.state)
        state.phaseId = '4'
        formSystem(state, ['ACL', 'CG'], 'alex')
        play.replaceState(state)
        return play.state
    }

    it('pays each holding its twentieths of the dividend, rounding an odd share up', () => {
        const state = amtk()
        const pay = (shares: number, choice: 'pay' | 'half-pay') =>
            EighteenThirtyTwoEarningsRules.holderDividend?.(state, 'AMTK', {
                shares,
                choice,
                revenue: 130
            })
        expect([pay(1, 'pay'), pay(2, 'pay'), pay(3, 'pay')]).toEqual([7, 13, 20])
        expect([pay(1, 'half-pay'), pay(3, 'half-pay')]).toEqual([4, 10])
        // The company keeps the revenue less twenty halves of $6.50, each rounded up to $4.
        expect(EighteenThirtyTwoEarningsRules.retainedRevenue(state, 'AMTK', 'half-pay', 130)).toBe(
            50
        )
    })

    it('has both shells’ train spaces and counts as two companies for certificate limits', () => {
        const before = trading().state
        const state = amtk()
        expect(EighteenThirtyTwoTrainRules.trainLimit(state, 'AMTK')).toBe(6)
        expect(certificateLimitColumn(state)).toBe(certificateLimitColumn(before))
    })

    it('prices every station at $100', () => {
        const state = amtk()
        const station = state.stations.find(
            (entry) => entry.companyId === 'AMTK' && entry.status === 'available'
        )
        assertExists(station, 'AMTK has stations to place')
        expect(EighteenThirtyTwoStationRules.placementCost(state, station.id)).toBe(100)
    })

    it('lays three yellow tiles, or one yellow tile and one upgrade', () => {
        const state = amtk()
        const lay = (locationId: string, color: string) => ({ locationId, color, cost: 0 })
        const allowance = (
            lays: { locationId: string; color: string }[],
            color: string,
            upgrade: boolean
        ) =>
            EighteenThirtyTwoTrackRules.allowance(
                {
                    ...state,
                    trackStep: {
                        companyId: 'AMTK',
                        completed: false,
                        lays: lays.map((entry) => lay(entry.locationId, entry.color))
                    }
                },
                color,
                upgrade
            )
        const yellow = { locationId: 'S24', color: 'yellow' }
        expect(allowance([yellow, yellow], 'yellow', false)).toEqual({ cost: 0 })
        expect(allowance([yellow], 'green', true)).toEqual({ cost: 0 })
        expect(allowance([yellow, yellow], 'green', true)).toHaveProperty('reason')
    })

    it('counts a System’s shells and not a bought company for certificate limits', () => {
        const { state } = playExample(EighteenThirtyTwoScenarios, 'starting', 3)
        expect(certificateLimitColumn(state)).toBe(0)
        const close = (companyId: string) =>
            state.companies.map((company) =>
                company.id === companyId ? { ...company, closed: true } : company
            )
        expect(certificateLimitColumn({ ...state, companies: close('CG') })).toBe(1)
        expect(
            certificateLimitColumn({
                ...state,
                companies: [
                    ...close('CG').map((company) =>
                        company.id === 'ACL' ? { ...company, closed: true } : company
                    ),
                    { id: 'AMTK', name: 'Amtrak', kind: 'major' }
                ],
                systems: { AMTK: ['ACL', 'CG'] }
            })
        ).toBe(0)
    })
})
