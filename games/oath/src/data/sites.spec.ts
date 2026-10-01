import { describe, expect, it } from 'vitest'
import {
    ALL_SITE_IDS,
    HOMELAND_SITE_BY_SUIT,
    NAMED_SITE_IDS,
    NAME_ID_MISMATCHES,
    RELIC_BEARING_SITE_IDS,
    SITE_DEFINITIONS,
    SITE_RECORDS,
    TOTAL_SITE_CARDS,
    siteRecord
} from './sites.js'
import {
    ALL_RELIC_IDS,
    FULL_MAP_RELIC_DEMAND,
    GRAND_SCEPTER_ID,
    RELIC_DECK_IDS,
    RELIC_DEFINITIONS,
    RELIC_NAME_ID_MISMATCHES,
    RELIC_RECORDS,
    RELIQUARY_SIZE,
    TOTAL_RELIC_CARDS
} from './relics.js'
import {
    cardDefinition,
    cardIdsOfKind,
    relicDefenseDice,
    siteCapacity,
    siteRecoverCost,
    siteRevealPrompt
} from './cardRegistry.js'
import { CardKind, Suit } from '../model/oathEnums.js'
import { TOTAL_MAP_SLOTS } from './mapSlots.js'
import { required } from '../testing/required.js'

describe('site cards (R-1.1, R-2.8)', () => {
    it('R-2.8.4 — holds the 23 site cards', () => {
        expect(SITE_DEFINITIONS).toHaveLength(TOTAL_SITE_CARDS)
        expect(new Set(ALL_SITE_IDS).size).toBe(TOTAL_SITE_CARDS)
    })

    it('R-2.1.1 — the deck can fill all eight map slots', () => {
        expect(ALL_SITE_IDS.length).toBeGreaterThanOrEqual(TOTAL_MAP_SLOTS)
    })

    it('R-11 — the eleven sites the Law names carry their real ids', () => {
        expect(NAMED_SITE_IDS).toContain('site.the-tribunal')
        expect(NAMED_SITE_IDS).toContain('site.marshes')
        expect(NAMED_SITE_IDS).toContain('site.salt-flats')
        for (const id of NAMED_SITE_IDS) {
            expect(id.startsWith(`${CardKind.Site}.`)).toBe(true)
            expect(cardDefinition(id)?.kind).toBe(CardKind.Site)
        }
    })

    it('registers every site in the card registry', () => {
        expect(cardIdsOfKind(CardKind.Site)).toHaveLength(TOTAL_SITE_CARDS)
    })

    it('the eleven ids established before the cards arrived all survive', () => {
        for (const id of NAMED_SITE_IDS) {
            expect(ALL_SITE_IDS).toContain(id)
        }
    })

    it('records the one printed-name / established-id disagreement, and only one', () => {
        expect(NAME_ID_MISMATCHES).toEqual([
            { id: 'site.great-slums', printedName: 'Great Slum' }
        ])
        expect(siteRecord('site.great-slums')?.name).toBe('Great Slum')
    })

    describe('every site prints its data (R-2.8)', () => {
        it('R-2.8.1 — every site prints a capacity, and R-5.1.4.I can now fire', () => {
            expect(ALL_SITE_IDS.filter((id) => siteCapacity(id) === undefined)).toEqual([])
            expect(siteCapacity('site.drowned-city')).toBe(0)
            expect(siteCapacity('site.charming-valley')).toBe(3)
            for (const id of ALL_SITE_IDS) {
                expect(siteCapacity(id)).toBeLessThanOrEqual(3)
            }
        })

        it('R-2.8.2 — every site prints a reveal prompt', () => {
            expect(ALL_SITE_IDS.filter((id) => siteRevealPrompt(id) === undefined)).toEqual([])
            expect(siteRevealPrompt('site.salt-flats')).toEqual({
                favor: 2,
                secrets: 1,
                relics: 0
            })
            expect(siteRevealPrompt('site.drowned-city')).toEqual({
                favor: 0,
                secrets: 3,
                relics: 2
            })
        })

        it('R-2.8.4 — exactly the relic-bearing sites print a Recover cost', () => {
            const withCost = ALL_SITE_IDS.filter((id) => siteRecoverCost(id) !== undefined)
            expect([...withCost].sort()).toEqual([...RELIC_BEARING_SITE_IDS].sort())
            expect(RELIC_BEARING_SITE_IDS).toHaveLength(15)
        })

        it('R-5.4.2 — every Recover cost is one of the four shapes the Law names', () => {
            for (const id of RELIC_BEARING_SITE_IDS) {
                const cost = required(siteRecoverCost(id), id)
                switch (cost.kind) {
                    case 'placeFavorInBank':
                        expect(cost.amount).toBe(3)
                        expect(Object.values(Suit)).toContain(cost.suit)
                        break
                    case 'burnFavor':
                        expect(cost.amount).toBe(2)
                        break
                    case 'burnSecrets':
                        expect([1, 2]).toContain(cost.amount)
                        break
                }
            }
        })

        it('R-2.8.4 — an unknown or facedown site resolves to no cost, not a free one', () => {
            expect(siteRecoverCost(undefined)).toBeUndefined()
            expect(siteRecoverCost('slot.cradle.0')).toBeUndefined()
        })
    })

    it('R-2.8.3 — every site prints exactly one defense die and one bandit', () => {
        // The engine applies R-2.8.3's site shield flat and never reads these fields.
        for (const rec of SITE_RECORDS) {
            expect(rec.defenseDice).toBe(1)
            expect(rec.bandits).toBe(1)
        }
    })

    it('each of the six suits has exactly one Homeland site (R-11)', () => {
        for (const suit of Object.values(Suit)) {
            expect(HOMELAND_SITE_BY_SUIT[suit]).toBeDefined()
        }
        expect(Object.keys(HOMELAND_SITE_BY_SUIT)).toHaveLength(6)
        expect(HOMELAND_SITE_BY_SUIT[Suit.Beast]).toBe('site.deep-woods')
    })

    it('every site carries a power category, and all fourteen appear (R-11)', () => {
        const categories = new Set(SITE_RECORDS.map((r) => r.powerCategory))
        expect(categories).toEqual(
            new Set([
                // Plains and Mountain share one R-11 entry but print opposite signs.
                'opportunity',
                'homeland',
                'coast',
                'plains',
                'mountain',
                'river',
                'charmingValley',
                'shroudedWood',
                'narrowPass',
                'tribunal',
                'greatSlum',
                'marshes',
                'buriedGiant',
                'hiddenPlace'
            ])
        )
    })

})

describe('relic cards (R-1.8, R-1.17, R-1.18, R-2.4)', () => {
    it('holds the 21 physical relic cards, counted from the owner’s photographs', () => {
        expect(RELIC_DEFINITIONS).toHaveLength(TOTAL_RELIC_CARDS)
        expect(new Set(ALL_RELIC_IDS).size).toBe(TOTAL_RELIC_CARDS)
    })

    it('R-1.8 — the Grand Scepter exists and is a relic', () => {
        expect(cardDefinition(GRAND_SCEPTER_ID)?.kind).toBe(CardKind.Relic)
    })

    it('R-1.18 — the relic deck excludes the Grand Scepter, which R-1.8 hands out', () => {
        expect(RELIC_DECK_IDS).not.toContain(GRAND_SCEPTER_ID)
        expect(RELIC_DECK_IDS).toHaveLength(RELIC_DEFINITIONS.length - 1)
    })

    it('R-1.17 — the deck can supply the Imperial Reliquary’s four', () => {
        expect(RELIC_DECK_IDS.length).toBeGreaterThanOrEqual(RELIQUARY_SIZE)
    })

    it('R-1.17 / R-2.8.2 — the deck exactly covers a full map plus the Reliquary', () => {
        expect(RELIC_DECK_IDS).toHaveLength(FULL_MAP_RELIC_DEMAND)
    })

    it('R-2.4.2 — every relic prints a shield, so a Campaign can target one', () => {
        for (const id of ALL_RELIC_IDS) {
            const dice = relicDefenseDice(id)
            expect(dice, `${id} has no printed shield`).toBeTypeOf('number')
            expect(dice).toBeGreaterThanOrEqual(1)
        }
    })

    it('R-2.4.2 — the Grand Scepter prints five', () => {
        expect(relicDefenseDice(GRAND_SCEPTER_ID)).toBe(5)
    })

    it('the Ivory Eye’s printed shield is 2', () => {
        expect(relicDefenseDice('relic.ivory-eye')).toBe(2)
    })

    it('R-2.4.2 — an unknown relic still blocks the target rather than counting zero', () => {
        expect(relicDefenseDice('relic.not-a-real-card')).toBeUndefined()
    })

    it('R-2.4.1 / R-2.8.4 — no relic carries a Recover cost; the site prints it', () => {
        for (const rec of RELIC_RECORDS) {
            expect(rec, `${rec.id} must not carry a recoverCost`).not.toHaveProperty(
                'recoverCost'
            )
        }
        for (const id of ALL_RELIC_IDS) {
            expect(cardDefinition(id)?.recoverCost).toBeUndefined()
        }
    })

    it('the Grand Scepter is the only name/id mismatch', () => {
        expect(RELIC_NAME_ID_MISMATCHES).toEqual([
            { id: GRAND_SCEPTER_ID, printedName: 'The Grand Scepter' }
        ])
        const slug = (s: string) =>
            s
                .toLowerCase()
                .replace(/['’]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
        const pinned = new Set(RELIC_NAME_ID_MISMATCHES.map((m) => m.id))
        for (const rec of RELIC_RECORDS) {
            if (pinned.has(rec.id)) continue
            expect(rec.id, `${rec.name} does not slug to its id`).toBe(
                `${CardKind.Relic}.${slug(rec.name)}`
            )
        }
    })

})
