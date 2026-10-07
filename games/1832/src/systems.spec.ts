import { describe, expect, it } from 'vitest'
import {
    cashOwnedBy,
    companyMarketSpace,
    getCompany,
    sharesOwned,
    stockMarkerStackIndex
} from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { formSystem, systemMarketSpace, systemPresident } from './index.js'
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
