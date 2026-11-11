import { certificatesOwnedBy, stockCertificateCount } from '@tabletop/18xx'
import { describe, expect, it } from 'vitest'
import { hold, operatingTurn, player, treasury, twoCompanies } from '../test/positions.js'
import { canStart } from './companyRules.js'
import { isFormLner } from './lner.js'
import { IpoPoolId, MarketPoolId, charterPoolId } from './pools.js'
import { StockRules1862, certificateLimit1862 } from './stockRules.js'

describe('1862 LNER formation (§10.3)', () => {
    function lastTurnOfTheSet() {
        const { game, state, a, b } = twoCompanies(
            { price: 100, train: true },
            { price: 90, train: true },
            'BuyingTrains'
        )
        state.chartered = [a]
        hold(state, a, [
            { owner: player('p1'), shares: 7 },
            { owner: 'ipo', shares: 3 }
        ])
        hold(state, b, [
            { owner: player('p2'), shares: 3 },
            { owner: player('p3'), shares: 2 },
            { owner: treasury(b), shares: 2 },
            { owner: 'pool', shares: 3 }
        ])
        operatingTurn(state, [b, a], a, 'BuyingTrains')
        const unstarted = state.companies
            .filter((company) => !company.started)
            .map((company) => company.id)
        state.resetCompanyIds = [unstarted[0]]
        state.lnerDue = true
        game.state = state
        return { game, a, b, unstarted }
    }

    it('holds a Parliament Round after the set until the first H train is bought', () => {
        const { game, a } = lastTurnOfTheSet()
        delete game.state.lnerDue
        game.act('FinishOperatingTurn', { companyId: a }, 'p1')
        expect(game.state.lner).toBeUndefined()
        expect(game.state.machineState).toBe('ParliamentRound')
    })

    it('forms at the end of the set, with the most shares any player holds as the limit', () => {
        const { game, a } = lastTurnOfTheSet()
        // Seven shares on five certificates, the director's counting as one.
        expect(stockCertificateCount(game.state, player('p1'), StockRules1862)).toBe(5)

        game.act('FinishOperatingTurn', { companyId: a }, 'p1')

        expect(game.state.lner).toEqual({ certificateLimit: 7 })
        expect(certificateLimit1862(game.state)).toBe(7)
        expect(game.state.lnerDue).toBeUndefined()
        expect(game.state.machineState).toBe('StockRound')
        expect(game.state.parliament).toBeUndefined()
    })

    it('moves IPO shares to the Bank Pool and leaves company treasuries’ shares', () => {
        const { game, a, b } = lastTurnOfTheSet()
        const ipoShares = game.state.certificates
            .filter(
                (certificate) => certificate.companyId === a && certificate.poolId === IpoPoolId
            )
            .map((certificate) => certificate.id)
        const charterShares = certificatesOwnedBy(game.state, treasury(b)).map(
            (certificate) => certificate.id
        )

        game.act('FinishOperatingTurn', { companyId: a }, 'p1')

        const [formation] = game.actions.filter(isFormLner)
        expect(formation.metadata?.movedCertificateIds).toEqual(ipoShares)
        const poolOf = (id: string) =>
            game.state.certificates.find((certificate) => certificate.id === id)?.poolId
        expect(ipoShares.map(poolOf)).toEqual(ipoShares.map(() => MarketPoolId))
        expect(charterShares.map(poolOf)).toEqual(charterShares.map(() => charterPoolId(b)))
    })

    it('closes every unstarted company, so none may start again', () => {
        const { game, a, unstarted } = lastTurnOfTheSet()

        game.act('FinishOperatingTurn', { companyId: a }, 'p1')

        const [formation] = game.actions.filter(isFormLner)
        expect(formation.metadata?.removedCompanyIds).toEqual(unstarted)
        expect(
            game.state.companies
                .filter((company) => unstarted.includes(company.id))
                .every((company) => company.closed)
        ).toBe(true)
        expect(unstarted.some((companyId) => canStart(game.hydrated, companyId))).toBe(false)
        expect(game.state.resetCompanyIds).toBeUndefined()
        expect(
            game.state.certificates
                .filter((certificate) => unstarted.includes(certificate.companyId))
                .every((certificate) => certificate.poolId === IpoPoolId)
        ).toBe(true)
    })
})
