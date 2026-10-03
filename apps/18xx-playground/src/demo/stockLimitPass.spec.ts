import { EighteenThirtyStockRules, Definition as Thirty } from '@tabletop/1830'
import { exceedsStockLimits, mustSellShares, placeStockMarker } from '@tabletop/18xx'
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
        const space = state.stockMarket.spaces.find((space) => space.color === 'pink')
        assertExists(space, 'The market has an ordinary space')
        for (const certificate of state.certificates.filter(
            (certificate) => !certificate.retired
        )) {
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
            const certificates = state.certificates
                .filter((certificate) => !certificate.retired)
                .filter((certificate) => certificate.companyId === company.id)
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
        expect(engine.getValidActionTypesForPlayer(game, state, playerId)).not.toContain('BuyShares')
        const action = {
            id: 'pass-over-limit',
            gameId: game.id,
            playerId,
            source: ActionSource.User,
            type: 'FinishStockTurn'
        }
        const result = engine.executeCanonicalAction({ game, state, action })
        expect(result.updatedState.activePlayerIds).not.toContain(playerId)
        // Free one market slot while retaining enough holdings to stay over the limit.
        const available = state.certificates
            .filter((certificate) => !certificate.retired)
            .find(
                (certificate) =>
                    certificate.companyId === companies[0].id &&
                    certificate.poolId === 'open-market'
            )
        assertExists(available, 'The first market pool is full')
        available.owner = {
            kind: 'player',
            playerId: state.players.find((player) => player.playerId !== playerId)!.playerId
        }
        delete available.poolId
        expect(mustSellShares(state, playerId, rules)).toBe(true)
        expect(engine.getValidActionTypesForPlayer(game, state, playerId)).not.toContain(
            'FinishStockTurn'
        )
        expect(() => engine.executeCanonicalAction({ game, state, action })).toThrow()
    }
)
