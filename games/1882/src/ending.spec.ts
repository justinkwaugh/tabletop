import { describe, expect, it } from 'vitest'
import { placeStockMarker } from '@tabletop/18xx'
import { edit, floatCompany, kit, opened } from '../test/kit.js'
import { PrivateCatalog1882 } from './companies.js'
import { EndingRules1882, MarketTopReason, TransferRules1882 } from './operating.js'
import { EndSpaceId } from './stockMarket.js'

describe('1882 game end', () => {
    it('ends at once when a stock round leaves a price on the top-right space (§12)', () => {
        const game = opened(4)
        edit(game, (state) => placeStockMarker(state.stockMarket, 'CPR', EndSpaceId))
        expect(EndingRules1882.trigger(game.hydrated)).toEqual({ reason: MarketTopReason })
    })

    it('ends after the operating round in which a dividend reached it (§12)', () => {
        const game = opened(4)
        floatCompany(game, 'CNoR')
        kit.passStockRound(game)
        edit(game, (state) => placeStockMarker(state.stockMarket, 'CNoR', EndSpaceId))
        expect(EndingRules1882.trigger(game.hydrated)).toEqual({
            reason: MarketTopReason,
            finalOperatingSet: 1,
            finalOperatingRound: 1
        })
    })
})

describe('1882 private closure', () => {
    it('closes every private at phase 5 but the Saskatchewan Central, which closes at phase 6 (§8)', () => {
        const game = opened(4)
        const closing = (phaseId: string) =>
            PrivateCatalog1882.closureEffects({ ...game.state, phaseId }).map(
                (effect) => effect.privateCompanyId
            )
        expect(closing('4')).toEqual([])
        expect(closing('5')).toEqual(['HB', 'NWR', 'TB', 'CP'])
        expect(closing('6')).toEqual(['HB', 'SC', 'NWR', 'TB', 'CP'])
    })

    it('sells player-owned privates to companies from phase 3 until they close, the SC in phase 5 too (ruling 5)', () => {
        const game = opened(4)
        const price = (phaseId: string, privateCompanyId: string) =>
            TransferRules1882.priceRange({ ...game.hydrated, phaseId }, 'CNoR', {
                kind: 'private',
                privateCompanyId
            })
        expect(price('2', 'SC')).toBeUndefined()
        expect(price('3', 'SC')).toEqual({ minimum: 25, maximum: 100 })
        expect(price('5', 'SC')).toEqual({ minimum: 25, maximum: 100 })
        expect(price('3', 'NWR')).toEqual({ minimum: 40, maximum: 160 })
    })
})
