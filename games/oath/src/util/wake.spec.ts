import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, Suit } from '../model/oathEnums.js'
import { bySuit } from '../data/typedData.js'
import { testBanners, testPlayer, testState } from '../testing/fixture.js'
import { expectFavorConserved } from '../testing/census.js'
import {
    MOB_THRESHOLD,
    OPPORTUNITY_SITE_IDS,
    applyPeoplesFavorStep,
    availablePeoplesFavorOptions,
    banksWithLeastFavor,
    flipToMobIfAtThreshold,
    isOpportunitySite,
    peoplesFavorStepCount,
    reasonCannotTakePeoplesFavorStep,
    opportunityTakesOffered,
    reasonCannotUseOpportunitySite,
    useOpportunitySite
} from './wake.js'
import type { OathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { siteRevealPrompt } from '../data/cardRegistry.js'
import { availableSitePowerTakes, canUseSitePower } from '../actions/resolveWake.js'

/** R-2.1.3 — each suit bank starts at 3. */
function banks(overrides: Partial<Record<Suit, number>> = {}): Record<Suit, number> {
    return bySuit((suit) => overrides[suit] ?? 3)
}

const HOLDER = 'holder'

function table(overrides: Partial<OathGameState> = {}, player: Partial<OathPlayerState> = {}) {
    return testState([testPlayer({ playerId: HOLDER, color: Color.Red, favor: 3, ...player })], {
        banners: testBanners({ [Banner.PeoplesFavor]: HOLDER }),
        ...overrides
    })
}

describe('R-4.1.1.I — place or return one favor', () => {
    it('places one favor from your board onto the banner', () => {
        const state = table()
        const before = state.banners[Banner.PeoplesFavor].value

        expectFavorConserved(state, () => applyPeoplesFavorStep(state, HOLDER, { kind: 'place' }))

        expect(state.banners[Banner.PeoplesFavor].value).toBe(before + 1)
        expect(state.players[0].favor).toBe(2)
    })

    it('returns one favor to a bank with the least favor (R-4.1.1.I)', () => {
        const state = table({
            favorBank: banks({ [Suit.Nomad]: 1 }),
            banners: testBanners({ [Banner.PeoplesFavor]: HOLDER }, 4)
        })
        expect(banksWithLeastFavor(state)).toEqual([Suit.Nomad])

        expectFavorConserved(state, () =>
            applyPeoplesFavorStep(state, HOLDER, { kind: 'return', toSuit: Suit.Nomad })
        )

        expect(state.banners[Banner.PeoplesFavor].value).toBe(3)
        expect(state.favorBank[Suit.Nomad]).toBe(2)
        // R-10.4 — a return goes to a suit bank, not the shared bank.
        expect(state.favorSupply).toBe(18)
    })

    it('rejects a bank that is not among the tied-least (R-X.1)', () => {
        const state = table({
            favorBank: banks({ [Suit.Nomad]: 1 }),
            banners: testBanners({ [Banner.PeoplesFavor]: HOLDER }, 4)
        })
        expect(
            reasonCannotTakePeoplesFavorStep(state, HOLDER, { kind: 'return', toSuit: Suit.Hearth })
        ).toMatch(/not a bank with the least favor/)
    })

    it('lets the player break a tie for least, and accepts any tied bank (R-4.1.1.I)', () => {
        const state = table({
            favorBank: banks({ [Suit.Nomad]: 1, [Suit.Beast]: 1 }),
            banners: testBanners({ [Banner.PeoplesFavor]: HOLDER }, 4)
        })
        expect(banksWithLeastFavor(state).sort()).toEqual([Suit.Beast, Suit.Nomad].sort())

        for (const suit of [Suit.Beast, Suit.Nomad]) {
            expect(
                reasonCannotTakePeoplesFavorStep(state, HOLDER, { kind: 'return', toSuit: suit })
            ).toBeUndefined()
        }
    })

    it('cannot place with no favor, nor return past the floor (R-9.2.a, R-4.1.1-H1)', () => {
        const broke = table({}, { favor: 0 })
        expect(availablePeoplesFavorOptions(broke, HOLDER)).toEqual([])
        expect(reasonCannotTakePeoplesFavorStep(broke, HOLDER, { kind: 'place' })).toMatch(
            /no favor to place/
        )
        expect(
            reasonCannotTakePeoplesFavorStep(broke, HOLDER, { kind: 'return', toSuit: Suit.Nomad })
        ).toMatch(/never drops below/)

        const twoUp = table({ banners: testBanners({ [Banner.PeoplesFavor]: HOLDER }, 2) }, {
            favor: 0
        })
        expect(availablePeoplesFavorOptions(twoUp, HOLDER)).toEqual(['return'])
    })

    it('leaves nothing available when neither option is (R-9.2.a — not penalised)', () => {
        const state = table(
            { banners: testBanners({ [Banner.PeoplesFavor]: HOLDER }, 0) },
            { favor: 0 }
        )
        expect(availablePeoplesFavorOptions(state, HOLDER)).toEqual([])
    })
})

describe('R-4.1.1.II — repeat once on the Mob side', () => {
    it('resolves R-4.1.1.I twice on Mob and once otherwise', () => {
        const calm = table()
        expect(peoplesFavorStepCount(calm)).toBe(1)

        const mob = table()
        mob.banners[Banner.PeoplesFavor].mobSide = true
        expect(peoplesFavorStepCount(mob)).toBe(2)
    })
})

describe('R-4.1.1.III — flip to Mob at six or more', () => {
    it('flips at exactly the threshold, not before', () => {
        const below = table({
            banners: testBanners({ [Banner.PeoplesFavor]: HOLDER }, MOB_THRESHOLD - 1)
        })
        expect(flipToMobIfAtThreshold(below)).toBe(false)
        expect(below.isOnMobSide(Banner.PeoplesFavor)).toBe(false)

        const at = table({ banners: testBanners({ [Banner.PeoplesFavor]: HOLDER }, MOB_THRESHOLD) })
        expect(flipToMobIfAtThreshold(at)).toBe(true)
        expect(at.isOnMobSide(Banner.PeoplesFavor)).toBe(true)
    })

    it('flips above the threshold too', () => {
        const state = table({
            banners: testBanners({ [Banner.PeoplesFavor]: HOLDER }, MOB_THRESHOLD + 3)
        })
        expect(flipToMobIfAtThreshold(state)).toBe(true)
    })

    it('is one-way — nothing in R-4.1.1 flips it back off Mob', () => {
        const state = table({ banners: testBanners({ [Banner.PeoplesFavor]: HOLDER }, 1) })
        state.banners[Banner.PeoplesFavor].mobSide = true
        expect(flipToMobIfAtThreshold(state)).toBe(false)
        expect(state.isOnMobSide(Banner.PeoplesFavor)).toBe(true)
    })

    it('is idempotent once flipped', () => {
        const state = table({
            banners: testBanners({ [Banner.PeoplesFavor]: HOLDER }, MOB_THRESHOLD)
        })
        expect(flipToMobIfAtThreshold(state)).toBe(true)
        expect(flipToMobIfAtThreshold(state)).toBe(false)
    })
})

describe('R-4.1.4 / R-11.1 — the Opportunity sites', () => {
    it('names the three sites R-4.1.4 names, and nothing else', () => {
        expect([...OPPORTUNITY_SITE_IDS].sort()).toEqual([
            'site.drowned-city',
            'site.mine',
            'site.salt-flats'
        ])
        const state = table({ siteCards: { c1: 'site.mine', c2: 'site.plains' } })
        expect(isOpportunitySite(state, 'c1')).toBe(true)
        expect(isOpportunitySite(state, 'c2')).toBe(false)
        expect(isOpportunitySite(state, undefined)).toBe(false)
    })

    it('takes one favor from the site to your board (R-10.26)', () => {
        const state = table(
            {
                siteCards: { c1: 'site.mine' },
                cardTokens: { 'site.mine': { favor: 2, secrets: 0 } }
            },
            { siteId: 'c1', favor: 1 }
        )
        expectFavorConserved(state, () => useOpportunitySite(state, HOLDER, 'favor'))

        expect(state.cardTokens['site.mine'].favor).toBe(1)
        expect(state.players[0].favor).toBe(2)
    })

    it('R-4.1.4-H1 — the card’s icon governs what may be taken', () => {
        const state = table(
            {
                siteCards: { c1: 'site.mine' },
                cardTokens: { 'site.mine': { favor: 1, secrets: 1 } }
            },
            { siteId: 'c1', secrets: 0 }
        )
        expect(reasonCannotUseOpportunitySite(state, HOLDER, 'secret')).toMatch(/does not offer/)
        expect(reasonCannotUseOpportunitySite(state, HOLDER, 'favor')).toBeUndefined()
    })

    it('R-4.1.4-H1 — availableSitePowerTakes offers only what is takeable', () => {
        const state = table(
            {
                siteCards: { c1: 'site.mine' },
                cardTokens: { 'site.mine': { favor: 2, secrets: 1 } }
            },
            { siteId: 'c1' }
        )
        expect(availableSitePowerTakes(state, HOLDER)).toEqual(['favor'])
        expect(canUseSitePower(state, HOLDER)).toBe(true)

        const empty = table(
            {
                siteCards: { c1: 'site.mine' },
                cardTokens: { 'site.mine': { favor: 0, secrets: 1 } }
            },
            { siteId: 'c1' }
        )
        expect(availableSitePowerTakes(empty, HOLDER)).toEqual([])
        expect(canUseSitePower(empty, HOLDER)).toBe(false)
    })

    it('R-4.1.4-H1 — the offers are read off the three cards', () => {
        expect(opportunityTakesOffered('site.mine')).toEqual(['favor'])
        expect(opportunityTakesOffered('site.drowned-city')).toEqual(['secret'])
        expect(opportunityTakesOffered('site.salt-flats')).toEqual(['favor', 'secret'])
        expect(siteRevealPrompt('site.mine')).toEqual({ favor: 3, secrets: 0, relics: 1 })
        expect(siteRevealPrompt('site.drowned-city')).toEqual({
            favor: 0,
            secrets: 3,
            relics: 2
        })
    })

    it('takes one secret from the site to your board', () => {
        const state = table(
            {
                siteCards: { c1: 'site.salt-flats' },
                cardTokens: { 'site.salt-flats': { favor: 0, secrets: 1 } }
            },
            { siteId: 'c1', secrets: 0 }
        )
        useOpportunitySite(state, HOLDER, 'secret')

        expect(state.cardTokens['site.salt-flats'].secrets).toBe(0)
        expect(state.players[0].secrets).toBe(1)
    })

    it('resolves the site CARD at the pawn’s map SLOT (R-1.1, R-5.6.2)', () => {
        const state = table(
            {
                siteCards: { c1: 'site.mine' },
                cardTokens: { 'site.mine': { favor: 1, secrets: 0 } }
            },
            { siteId: 'c1', favor: 0 }
        )
        expect(isOpportunitySite(state, 'c1')).toBe(true)

        useOpportunitySite(state, HOLDER, 'favor')
        expect(state.players[0].favor).toBe(1)
        expect(state.cardTokens['site.mine'].favor).toBe(0)
    })

    it('is never an Opportunity site while the slot is facedown (R-9.4, R-10.21)', () => {
        const state = table({ siteCards: { c2: 'site.mine' } }, { siteId: 'c1' })
        expect(isOpportunitySite(state, 'c1')).toBe(false)
        expect(reasonCannotUseOpportunitySite(state, HOLDER, 'favor')).toMatch(
            /not at an Opportunity site/
        )
    })

    it('refuses at a site that is not an Opportunity site', () => {
        const state = table({ cardTokens: { c1: { favor: 2, secrets: 0 } } }, { siteId: 'c1' })
        expect(reasonCannotUseOpportunitySite(state, HOLDER, 'favor')).toMatch(
            /not at an Opportunity site/
        )
    })

    it('refuses when the site holds nothing to take (R-11.1)', () => {
        const state = table(
            {
                siteCards: { c1: 'site.salt-flats' },
                cardTokens: { 'site.salt-flats': { favor: 0, secrets: 0 } }
            },
            { siteId: 'c1' }
        )
        expect(reasonCannotUseOpportunitySite(state, HOLDER, 'favor')).toMatch(/no favor/)
        expect(reasonCannotUseOpportunitySite(state, HOLDER, 'secret')).toMatch(/no secrets/)
    })
})
