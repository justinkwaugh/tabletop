import { describe, expect, it } from 'vitest'
import { CardKind, SetupVariant } from '../model/oathEnums.js'
import { cardIdsOfKind } from '../data/cardRegistry.js'
import { ALL_SITE_IDS } from '../data/sites.js'
import { LEGACY_CURATED_DENIZENS, LEGACY_CURATED_SITES } from '../data/legacyCuratedDeck.js'
import { explorationPools } from './exploration.js'

describe('the pools a projected exploration deals unknown cards from', () => {
    it('a game started with the retired fixed deck deals only that deck and its eight sites', () => {
        const pools = explorationPools({ setupVariant: SetupVariant.Curated })
        expect(pools.denizens).toEqual(LEGACY_CURATED_DENIZENS)
        expect(pools.sites).toEqual(LEGACY_CURATED_SITES)
        expect(LEGACY_CURATED_DENIZENS).toHaveLength(54)
        expect(LEGACY_CURATED_SITES).toHaveLength(8)
    })

    it('a random game deals from every denizen and every site', () => {
        const pools = explorationPools({ setupVariant: SetupVariant.Randomized })
        expect(pools.denizens).toEqual(cardIdsOfKind(CardKind.Denizen))
        expect(pools.sites).toEqual(ALL_SITE_IDS)
        expect(explorationPools({})).toEqual(pools)
    })
})
