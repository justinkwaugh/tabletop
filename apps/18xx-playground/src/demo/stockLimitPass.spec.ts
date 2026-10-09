import { EighteenThirtyStockRules, Definition as Thirty } from '@tabletop/1830'
import {
    exceedsStockLimits,
    mustSellShares,
    placeStockMarker,
    evaluateSharePurchase,
    stockCertificateCount
} from '@tabletop/18xx'
import { ActionSource, assertExists } from '@tabletop/common'
import { Definition as Shikoku, Shikoku1889StockRules } from '@tabletop/shikoku-1889'
import { expect, it } from 'vitest'
import { example } from './stockTestUtils.js'

it.each([
    { definition: Thirty, rules: EighteenThirtyStockRules },
    { definition: Shikoku, rules: Shikoku1889StockRules }
])(
    'lets an over-limit player pass only when no legal sale exists: $definition.info.id',
    ({ definition, rules }) => {
        const { state, game, engine } = example(definition, 'trading', 4)
        const { state: opening } = example(definition, 'opening', 4)
        state.companies = opening.companies
        state.certificates = opening.certificates
        state.certificatePools = opening.certificatePools
        state.cash = opening.cash
        state.stockMarket = opening.stockMarket
        const playerId = state.activePlayerIds[0]
        const owner = { kind: 'player' as const, playerId }
        // Five president + three ordinary holdings exceed both four-player limits.
        const companies = state.companies
            .filter((company) => company.kind !== 'private')
            .slice(0, 5)
        const space = rules.market.spaces.find((space) => space.color === 'pink')
        assertExists(space, 'The market has an ordinary space')
        for (const certificate of state.certificates) {
            certificate.owner = { kind: 'bank' }
            certificate.poolId = 'initial-offering'
        }
        for (const company of companies) {
            Object.assign(company, {
                started: true,
                floated: true,
                funded: true,
                operated: true,
                president: owner,
                parPrice: space.price
            })
            placeStockMarker(state.stockMarket, company.id, space.id)
            const certificates = state.certificates.filter(
                (certificate) => certificate.companyId === company.id
            )
            certificates.forEach((certificate, index) => {
                certificate.owner = index < 4 ? owner : { kind: 'bank' }
                if (index < 4) delete certificate.poolId
                else certificate.poolId = 'open-market'
            })
        }
        expect(exceedsStockLimits(state, owner, rules)).toBe(true)
        expect(mustSellShares(state, playerId, rules)).toBe(false)
        expect(engine.getValidActionTypesForPlayer(game, state, playerId)).toContain(
            'FinishStockTurn'
        )
        expect(engine.getValidActionTypesForPlayer(game, state, playerId)).not.toContain(
            'BuyShares'
        )
        const action = {
            id: 'pass-over-limit',
            gameId: game.id,
            playerId,
            source: ActionSource.User,
            type: 'FinishStockTurn'
        }
        const result = engine.executeCanonicalAction({ game, state, action })
        expect(result.updatedState.activePlayerIds).not.toContain(playerId)
        const otherOwner = {
            kind: 'player' as const,
            playerId: state.players.find((player) => player.playerId !== playerId)!.playerId
        }
        const exemptCompany = state.companies.filter((company) => company.kind !== 'private')[5]
        const yellow = rules.market.spaces.find((space) => space.color === 'yellow')
        assertExists(yellow, 'The market has an exempt space')
        Object.assign(exemptCompany, {
            started: true,
            floated: true,
            funded: true,
            operated: true,
            president: otherOwner,
            parPrice: space.price
        })
        placeStockMarker(state.stockMarket, exemptCompany.id, yellow.id)
        const exemptShares = state.certificates.filter(
            (certificate) => certificate.companyId === exemptCompany.id
        )
        exemptShares.forEach((certificate, index) => {
            certificate.owner = index < 4 ? otherOwner : { kind: 'bank' }
            if (index < 4) delete certificate.poolId
            else certificate.poolId = 'open-market'
        })
        const exempt = exemptShares[4]
        expect(rules.certificateWeight(state, exempt)).toBe(0)
        expect(mustSellShares(state, playerId, rules)).toBe(false)
        expect(engine.getValidActionTypesForPlayer(game, state, playerId)).toContain('BuyShares')
        const purchase = {
            ...action,
            id: 'buy-exempt',
            type: 'BuyShares',
            buyer: owner,
            certificateId: exempt.id,
            expectedPrice: yellow.price
        }
        const bought = engine.executeCanonicalAction({ game, state, action: purchase })
        expect(
            bought.updatedState.certificates.find((certificate) => certificate.id === exempt.id)
                ?.owner
        ).toEqual(owner)
        expect(stockCertificateCount(bought.updatedState, owner, rules)).toBe(20)
        let replay = state
        for (const processed of bought.processedActions)
            replay = engine.applyProcessedAction({ game, state: replay, action: processed })
        expect(replay).toEqual(bought.updatedState)
        for (const processed of [...bought.processedActions].reverse())
            replay = engine.undoProcessedAction({ state: replay, action: processed })
        expect(replay).toEqual(state)
        // Free one market slot while retaining enough holdings to stay over the limit.
        const available = state.certificates.find(
            (certificate) =>
                certificate.companyId === companies[0].id && certificate.poolId === 'open-market'
        )
        assertExists(available, 'The first market pool is full')
        expect(
            evaluateSharePurchase(
                state,
                { playerId, buyer: owner, certificateId: available.id },
                rules
            ).reason
        ).toBe('The purchase exceeds the certificate limit.')
        available.owner = {
            kind: 'player',
            playerId: state.players.find((player) => player.playerId !== playerId)!.playerId
        }
        delete available.poolId
        expect(mustSellShares(state, playerId, rules)).toBe(true)
        expect(() => engine.executeCanonicalAction({ game, state, action: purchase })).toThrow()
        expect(engine.getValidActionTypesForPlayer(game, state, playerId)).not.toContain(
            'FinishStockTurn'
        )
        expect(() => engine.executeCanonicalAction({ game, state, action })).toThrow()
    }
)
