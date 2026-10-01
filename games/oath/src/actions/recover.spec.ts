import { describe, expect, it } from 'vitest'
import { buildAction } from '../testing/actions.js'
import { HydratedRecover, Recover, RECOVER_SUPPLY_COST, RecoverTargetKind } from './recover.js'
import { Banner, CardKind, Suit } from '../model/oathEnums.js'
import { openTurn, testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import { registerCards } from '../data/cardRegistry.js'
import type { OathVault } from '../model/vault.js'
import { FAVOR_BANK_ORDER, redistributeFavor } from '../data/favorBanks.js'
import type { HydratedOathGameState } from '../model/gameState.js'

const ORDER = 'denizen.order.wrestlers'
const BEAST = 'denizen.beast.rangers'
const HEARTH = 'denizen.hearth.ballot-box'
const SCEPTER = 'relic.grand-scepter'

registerCards([
    {
        id: 'site.burn-two-favor',
        name: 'Burn Two Favor',
        kind: CardKind.Site,
        recoverCost: { kind: 'burnFavor', amount: 2 }
    },
    {
        id: 'site.place-three-order',
        name: 'Place Three Order',
        kind: CardKind.Site,
        recoverCost: { kind: 'placeFavorInBank', amount: 3, suit: Suit.Order }
    },
    {
        id: 'site.burn-one-secret',
        name: 'Burn One Secret',
        kind: CardKind.Site,
        recoverCost: { kind: 'burnSecrets', amount: 1 }
    }
])

function recover(playerId: string, fields: Partial<Recover>) {
    return new HydratedRecover(
        buildAction(Recover, { playerId, ...fields })
    )
}

function relicTarget(slotId: string) {
    return { kind: RecoverTargetKind.Relic as const, slotId }
}

function bannerTarget(banner: Banner) {
    return { kind: RecoverTargetKind.Banner as const, banner }
}

function serverRecover(
    state: HydratedOathGameState,
    vault: OathVault,
    playerId: string,
    fields: Partial<Recover>
) {
    const action = buildAction(Recover, {
        playerId,
        ...fields
    })
    state.vault = vault
    const hydrated = new HydratedRecover(action)
    hydrated.apply(state)
    return hydrated
}

describe('Recover a relic (R-5.4.1, R-5.4.2, R-5.4.3)', () => {
    function atSite(siteId: string, playerOverrides = {}) {
        const state = testState(
            [testPlayer({ siteId, supply: 7, favor: 5, secrets: 3, ...playerOverrides })],
            {
                map: {
                    cradle: [siteId, 'c2'],
                    provinces: ['p1', 'p2', 'p3'],
                    hinterland: ['h1', 'h2', 'h3']
                },
                relicsBySite: { [siteId]: [{ slotId: 'slot-1' }] }
            }
        )
        const vault = testVaultWithRelics({})
        vault.relicFacedown['slot-1'] = SCEPTER
        return { state, vault }
    }

    it('spends Supply, pays the site cost, and takes the relic faceup', () => {
        const { state, vault } = atSite('site.burn-two-favor')
        const action = serverRecover(state, vault, 'p1', { target: relicTarget('slot-1') })

        const p = state.getPlayerState('p1')
        expect(p.supply).toBe(7 - RECOVER_SUPPLY_COST)
        // R-4.3.4 — the saving at Rest reads the spent ledger, not the Supply marker.
        expect(p.supplySpentThisTurn).toBe(RECOVER_SUPPLY_COST)
        expect(p.favor).toBe(3)
        expect(p.relicIds).toEqual([SCEPTER])
        expect(state.relicSlotsAt('site.burn-two-favor')).toEqual([])
        expect(action.metadata?.relicCardId).toBe(SCEPTER)
    })

    it('R-6.4 — a Grand Scepter recovered is recorded as taken this turn', () => {
        const { state, vault } = atSite('site.burn-two-favor')
        openTurn(state, 'p1')
        serverRecover(state, vault, 'p1', { target: relicTarget('slot-1') })
        expect(state.grandScepterTakenOnTurnStart).toBe(state.turnManager.currentTurn()?.start)
    })

    it('burns favor to the shared bank, not to a suit bank (R-10.4)', () => {
        const { state, vault } = atSite('site.burn-two-favor')
        const banksBefore = { ...state.favorBank }
        const sharedBefore = state.favorSupply

        serverRecover(state, vault, 'p1', { target: relicTarget('slot-1') })

        expect(state.getPlayerState('p1').favor).toBe(3)
        expect(state.favorSupply).toBe(sharedBefore + 2)
        expect(state.favorBank).toEqual(banksBefore)
    })

    it('sends *placed* favor to the named suit bank, not the shared one', () => {
        const { state, vault } = atSite('site.place-three-order')
        const orderBefore = state.favorBank[Suit.Order]
        const sharedBefore = state.favorSupply

        serverRecover(state, vault, 'p1', { target: relicTarget('slot-1') })

        expect(state.favorBank[Suit.Order]).toBe(orderBefore + 3)
        expect(state.favorSupply).toBe(sharedBefore)
        expect(state.getPlayerState('p1').favor).toBe(2)
    })

    it('burns secrets out of play — they have no pool (R-9.3)', () => {
        const { state, vault } = atSite('site.burn-one-secret')

        serverRecover(state, vault, 'p1', { target: relicTarget('slot-1') })

        expect(state.getPlayerState('p1').secrets).toBe(2)
    })

    it('empties the slot from the vault — the relic is public now', () => {
        const { state, vault } = atSite('site.burn-two-favor')
        serverRecover(state, vault, 'p1', { target: relicTarget('slot-1') })

        expect(vault.relicFacedown['slot-1']).toBeUndefined()
    })

    it('is not undoable, because it emptied the vault (R-X.3)', () => {
        const { state, vault } = atSite('site.burn-two-favor')
        const action = serverRecover(state, vault, 'p1', { target: relicTarget('slot-1') })

        expect(action.revealsInfo).toBe(true)
    })

    it('refuses a relic that is not at your site', () => {
        const { state } = atSite('site.burn-two-favor')
        expect(
            HydratedRecover.reasonCannotRecover(state, 'p1', { target: relicTarget('slot-9') })
        ).toBe('slot-9 is not a relic at your site')
    })

    it('refuses when the site has no recorded Recover cost', () => {
        // Every relic-holding site prints a cost, so a missing one is missing data.
        const { state } = atSite('c1')
        expect(
            HydratedRecover.reasonCannotRecover(state, 'p1', { target: relicTarget('slot-1') })
        ).toBe('site c1 has no recorded Recover cost')
    })

    it('refuses when the player cannot pay', () => {
        const { state } = atSite('site.burn-two-favor', { favor: 1 })
        expect(
            HydratedRecover.reasonCannotRecover(state, 'p1', { target: relicTarget('slot-1') })
        ).toBe('costs 2 favor, player has 1')
    })

    it('treats a pawn off the map as a broken invariant, not a refusal (R-1.23.1)', () => {
        const state = testState([testPlayer({ siteId: undefined, supply: 7 })])
        expect(() =>
            HydratedRecover.reasonCannotRecover(state, 'p1', { target: relicTarget('slot-1') })
        ).toThrow("p1's pawn must be at a site")
    })
})

describe("Recover the People's Favor (R-5.4.2, R-5.4.4)", () => {
    function withBanner(value: number, playerOverrides = {}, bannerOverrides = {}) {
        return testState([testPlayer({ siteId: 'c1', supply: 7, favor: 8, ...playerOverrides })], {
            banners: {
                [Banner.PeoplesFavor]: { value, mobSide: false, ...bannerOverrides },
                [Banner.DarkestSecret]: { value: 1 }
            }
        })
    }

    it('takes the banner, stacking the favor paid on it', () => {
        const state = withBanner(2)
        recover('p1', {
            target: bannerTarget(Banner.PeoplesFavor),
            amountPaid: 3,
            redistributeFrom: Suit.Order
        }).apply(state)

        expect(state.banners[Banner.PeoplesFavor].holderPlayerId).toBe('p1')
        expect(state.banners[Banner.PeoplesFavor].value).toBe(3)
        expect(state.getPlayerState('p1').favor).toBe(5)
    })

    it('flips it off its Mob side', () => {
        const state = withBanner(2, {}, { mobSide: true })
        recover('p1', {
            target: bannerTarget(Banner.PeoplesFavor),
            amountPaid: 3,
            redistributeFrom: Suit.Order
        }).apply(state)

        expect(state.isOnMobSide(Banner.PeoplesFavor)).toBe(false)
    })

    it('scatters the old favor one per bank from the chosen suit', () => {
        const state = withBanner(3)
        const before = { ...state.favorBank }
        const action = recover('p1', {
            target: bannerTarget(Banner.PeoplesFavor),
            amountPaid: 4,
            redistributeFrom: Suit.Order
        })
        action.apply(state)

        const banks = redistributeFavor(Suit.Order, 3)
        expect(action.metadata?.favorRedistributedTo).toEqual(banks)
        for (const suit of new Set(banks)) {
            const landed = banks.filter((s) => s === suit).length
            expect(state.favorBank[suit]).toBe(before[suit] + landed)
        }
    })

    it('wraps past the end of the bank order when there is a lot of favor', () => {
        // R-5.4.4 — eight favor over six banks gives two banks a second one.
        const state = withBanner(8, { favor: 12 })
        const before = { ...state.favorBank }
        recover('p1', {
            target: bannerTarget(Banner.PeoplesFavor),
            amountPaid: 9,
            redistributeFrom: FAVOR_BANK_ORDER[4]
        }).apply(state)

        const total = Object.values(Suit).reduce(
            (sum, suit) => sum + (state.favorBank[suit] - before[suit]),
            0
        )
        expect(total).toBe(8)
        expect(state.favorBank[FAVOR_BANK_ORDER[4]]).toBe(before[FAVOR_BANK_ORDER[4]] + 2)
        expect(state.favorBank[FAVOR_BANK_ORDER[5]]).toBe(before[FAVOR_BANK_ORDER[5]] + 2)
        expect(state.favorBank[FAVOR_BANK_ORDER[2]]).toBe(before[FAVOR_BANK_ORDER[2]] + 1)
    })

    it('does NOT apply the Seize penalty — Recover is the exception (R-10.23)', () => {
        const state = withBanner(5)
        recover('p1', {
            target: bannerTarget(Banner.PeoplesFavor),
            amountPaid: 6,
            redistributeFrom: Suit.Order
        }).apply(state)

        expect(state.banners[Banner.PeoplesFavor].value).toBe(6)
        expect(state.isOnMobSide(Banner.PeoplesFavor)).toBe(false)
    })

    it('refuses a payment that does not exceed what is on it (R-5.4.2)', () => {
        const state = withBanner(3)
        for (const amountPaid of [2, 3]) {
            expect(
                HydratedRecover.reasonCannotRecover(state, 'p1', {
                    target: bannerTarget(Banner.PeoplesFavor),
                    amountPaid,
                    redistributeFrom: Suit.Order
                })
            ).toBe('must pay more than the 3 already on the banner')
        }
        expect(
            HydratedRecover.reasonCannotRecover(state, 'p1', {
                target: bannerTarget(Banner.PeoplesFavor),
                amountPaid: 4,
                redistributeFrom: Suit.Order
            })
        ).toBeUndefined()
    })

    it('refuses when the player does not hold that much favor', () => {
        const state = withBanner(3, { favor: 3 })
        expect(
            HydratedRecover.reasonCannotRecover(state, 'p1', {
                target: bannerTarget(Banner.PeoplesFavor),
                amountPaid: 4,
                redistributeFrom: Suit.Order
            })
        ).toBe('paying 4 favor needs 4, player has 3')
    })

    it('requires the starting bank as explicit input (R-X.1)', () => {
        const state = withBanner(3)
        expect(
            HydratedRecover.reasonCannotRecover(state, 'p1', {
                target: bannerTarget(Banner.PeoplesFavor),
                amountPaid: 4
            })
        ).toBe('must choose which favor bank the old favor starts flowing into')
    })

    it('can be recovered from yourself (R-5.4.1)', () => {
        const state = withBanner(2, {}, { holderPlayerId: 'p1' })
        expect(
            HydratedRecover.reasonCannotRecover(state, 'p1', {
                target: bannerTarget(Banner.PeoplesFavor),
                amountPaid: 3,
                redistributeFrom: Suit.Order
            })
        ).toBeUndefined()
    })
})

describe('Recover the Darkest Secret (R-5.4.1, R-5.4.4)', () => {
    function heldByP2(
        value: number,
        siteCards: string[],
        advisers: { cardId: string; faceUp: boolean }[] = []
    ) {
        return testState(
            [
                testPlayer({ playerId: 'p1', siteId: 'c1', supply: 7, secrets: 6 }),
                testPlayer({ playerId: 'p2', siteId: 'c2', secrets: 0, advisers })
            ],
            {
                denizensBySite: { c1: [], c2: siteCards },
                banners: {
                    [Banner.PeoplesFavor]: { value: 1, mobSide: false },
                    [Banner.DarkestSecret]: { value, holderPlayerId: 'p2' }
                }
            }
        )
    }

    it('stacks the secrets paid, takes one old secret, returns the rest', () => {
        const state = heldByP2(4, [ORDER])
        const action = recover('p1', {
            target: bannerTarget(Banner.DarkestSecret),
            amountPaid: 5
        })
        action.apply(state)

        expect(state.banners[Banner.DarkestSecret].holderPlayerId).toBe('p1')
        expect(state.banners[Banner.DarkestSecret].value).toBe(5)
        expect(state.getPlayerState('p1').secrets).toBe(2)
        expect(state.getPlayerState('p2').secrets).toBe(3)
        expect(action.metadata?.secretsToPreviousHolder).toBe(3)
    })

    it('keeps every old secret when recovering from yourself', () => {
        const state = heldByP2(4, [ORDER])
        state.banners[Banner.DarkestSecret].holderPlayerId = 'p1'

        const action = recover('p1', {
            target: bannerTarget(Banner.DarkestSecret),
            amountPaid: 5
        })
        action.apply(state)

        expect(state.getPlayerState('p1').secrets).toBe(5)
        expect(action.metadata?.secretsToPreviousHolder).toBe(0)
    })

    it('allows it when a card at the holder site matches none of their advisers', () => {
        const state = heldByP2(2, [ORDER], [{ cardId: BEAST, faceUp: true }])
        expect(
            HydratedRecover.reasonCannotRecover(state, 'p1', {
                target: bannerTarget(Banner.DarkestSecret),
                amountPaid: 3
            })
        ).toBeUndefined()
    })

    it('refuses when every card at the holder site is matched', () => {
        const state = heldByP2(
            2,
            [ORDER, BEAST],
            [
                { cardId: ORDER, faceUp: true },
                { cardId: BEAST, faceUp: true }
            ]
        )
        expect(
            HydratedRecover.reasonCannotRecover(state, 'p1', {
                target: bannerTarget(Banner.DarkestSecret),
                amountPaid: 3
            })
        ).toBe('every card at the holder site matches one of their advisers')
    })

    it('refuses when the holder site has no cards at all', () => {
        // The rule's clarification: an empty site is safe.
        const state = heldByP2(2, [])
        expect(
            HydratedRecover.reasonCannotRecover(state, 'p1', {
                target: bannerTarget(Banner.DarkestSecret),
                amountPaid: 3
            })
        ).toBe('every card at the holder site matches one of their advisers')
    })

    it('allows it when the holder has no faceup advisers', () => {
        // The rule's clarification: with no advisers nothing is matched, so it is open.
        const state = heldByP2(2, [ORDER])
        expect(
            HydratedRecover.reasonCannotRecover(state, 'p1', {
                target: bannerTarget(Banner.DarkestSecret),
                amountPaid: 3
            })
        ).toBeUndefined()
    })

    it('ignores facedown advisers, which have no suit (R-5.1.4.II)', () => {
        const state = heldByP2(2, [ORDER], [{ cardId: ORDER, faceUp: false }])
        expect(HydratedRecover.darkestSecretIsExposed(state, 'p2')).toBe(true)
    })

    it('ignores suitless cards at the site (R-10.14)', () => {
        const state = heldByP2(
            2,
            [HEARTH, 'not-a-registered-card'],
            [{ cardId: HEARTH, faceUp: true }]
        )
        expect(HydratedRecover.darkestSecretIsExposed(state, 'p2')).toBe(false)
    })

    it('applies no condition when nobody holds it', () => {
        const state = heldByP2(2, [])
        state.banners[Banner.DarkestSecret].holderPlayerId = undefined
        expect(
            HydratedRecover.reasonCannotRecover(state, 'p1', {
                target: bannerTarget(Banner.DarkestSecret),
                amountPaid: 3
            })
        ).toBeUndefined()
    })

    it('can always be recovered from yourself, whatever your site looks like', () => {
        const state = heldByP2(2, [])
        state.banners[Banner.DarkestSecret].holderPlayerId = 'p1'
        expect(
            HydratedRecover.reasonCannotRecover(state, 'p1', {
                target: bannerTarget(Banner.DarkestSecret),
                amountPaid: 3
            })
        ).toBeUndefined()
    })
})

describe('Recover availability', () => {
    it('is offered when a banner is affordable', () => {
        const state = testState([testPlayer({ siteId: 'c1', supply: 7, favor: 5, secrets: 5 })])
        expect(HydratedRecover.canDoRecover(state, 'p1')).toBe(true)
    })

    it('is not offered with no Supply', () => {
        const state = testState([testPlayer({ siteId: 'c1', supply: 0, favor: 9, secrets: 9 })])
        expect(HydratedRecover.canDoRecover(state, 'p1')).toBe(false)
    })

    it('is not offered when nothing can be afforded', () => {
        const state = testState([testPlayer({ siteId: 'c1', supply: 7, favor: 0, secrets: 0 })])
        expect(HydratedRecover.canDoRecover(state, 'p1')).toBe(false)
    })
})

describe('favor bank redistribution (R-5.4.4)', () => {
    it('walks the bank order from the chosen start', () => {
        const banks = redistributeFavor(FAVOR_BANK_ORDER[0], 3)
        expect(banks).toEqual([FAVOR_BANK_ORDER[0], FAVOR_BANK_ORDER[1], FAVOR_BANK_ORDER[2]])
    })

    it('wraps round the end', () => {
        const banks = redistributeFavor(FAVOR_BANK_ORDER[4], 3)
        expect(banks).toEqual([FAVOR_BANK_ORDER[4], FAVOR_BANK_ORDER[5], FAVOR_BANK_ORDER[0]])
    })

    it('gives out exactly the amount asked for, however large', () => {
        expect(redistributeFavor(FAVOR_BANK_ORDER[0], 14)).toHaveLength(14)
    })

    it('gives out nothing for a banner that had nothing on it', () => {
        expect(redistributeFavor(FAVOR_BANK_ORDER[0], 0)).toEqual([])
    })

    it('covers all six banks exactly once per full lap', () => {
        expect(new Set(redistributeFavor(FAVOR_BANK_ORDER[3], 6)).size).toBe(6)
    })
})
