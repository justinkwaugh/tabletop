import { describe, expect, it } from 'vitest'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from './searchResolve.js'
import { Banner, PlayerStatus } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { CONSPIRACY_ID } from '../data/cardRegistry.js'
import { seizeBanner } from '../util/seize.js'
import { expectFavorConserved } from '../testing/census.js'
import { Color } from '@tabletop/common'
import { buildAction } from '../testing/actions.js'

const ORDER_A = 'denizen.order.wrestlers'
const ORDER_B = 'denizen.order.longbows'
const ORDER_C = 'denizen.order.captains'
const BEAST = 'denizen.beast.rangers'
const RELIC = 'relic.grand-scepter'

function resolve(playerId: string, fields: Partial<SearchResolve>) {
    return new HydratedSearchResolve(
        buildAction(SearchResolve, {
            playerId,
            keptCardId: CONSPIRACY_ID,
            discardOrder: [],
            play: SearchPlay.Conspiracy,
            ...fields
        })
    )
}

/** R-5.1.4.IV — the base fixture makes a take legal. */
function shared(p1Overrides = {}, p2Overrides = {}, stateOverrides = {}) {
    return testState(
        [
            testPlayer({
                playerId: 'p1',
                siteId: 'c1',
                secrets: 2,
                handIds: [CONSPIRACY_ID],
                advisers: [
                    { cardId: ORDER_A, faceUp: true },
                    { cardId: ORDER_B, faceUp: true }
                ],
                ...p1Overrides
            }),
            testPlayer({
                playerId: 'p2',
                siteId: 'c1',
                relicIds: [RELIC],
                advisers: [{ cardId: ORDER_C, faceUp: true }],
                ...p2Overrides
            })
        ],
        stateOverrides
    )
}

const takeRelic = {
    targetPlayerId: 'p2',
    take: { kind: 'relic' as const, cardId: RELIC }
}

const takeFavor = {
    targetPlayerId: 'p2',
    take: { kind: 'banner' as const, banner: Banner.PeoplesFavor }
}

describe('playing the Conspiracy (R-5.1.4.IV)', () => {
    it('returns the card to the box, and records that it left the game', () => {
        const state = shared()
        resolve('p1', {}).apply(state)

        // R-8.5, R-8.8 — Visions return each chronicle, so a boxed Conspiracy must be recorded.
        expect(state.boxIds).toEqual([CONSPIRACY_ID])
        expect(state.getPlayerState('p1').revealedVisionId).toBeUndefined()
        expect(state.getPlayerState('p1').advisers).toHaveLength(2)
    })

    it('may be played by anyone, Chancellor and Citizens included', () => {
        // The stated exception to R-5.1.4.III, which bars them from playing a Vision faceup.
        for (const status of [PlayerStatus.Chancellor, PlayerStatus.Citizen]) {
            const state = shared({ status })
            expect(
                HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                    keptCardId: CONSPIRACY_ID,
                    discardOrder: [],
                    play: SearchPlay.Conspiracy
                })
            ).toBeUndefined()
        }
    })

    it('is legal with no take at all — the power is optional', () => {
        const state = shared({ secrets: 0 })
        resolve('p1', {}).apply(state)

        expect(state.boxIds).toEqual([CONSPIRACY_ID])
        expect(state.getPlayerState('p2').relicIds).toEqual([RELIC])
    })

    it('refuses to play any card but the Conspiracy this way', () => {
        const state = shared({ handIds: [ORDER_A] })
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: ORDER_A,
                discardOrder: [],
                play: SearchPlay.Conspiracy
            })
        ).toBe(`${ORDER_A} is not the Conspiracy`)
    })

    it('is still not a Revealed Vision play (R-5.1.4.III)', () => {
        const state = shared()
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: CONSPIRACY_ID,
                discardOrder: [],
                play: SearchPlay.RevealedVision
            })
        ).toContain('R-5.1.4.IV')
    })
})

describe('the Conspiracy take (R-5.1.4.IV)', () => {
    it('burns one secret and takes the relic', () => {
        const state = shared()
        resolve('p1', { conspiracy: takeRelic }).apply(state)

        expect(state.getPlayerState('p1').secrets).toBe(1)
        expect(state.getPlayerState('p1').relicIds).toEqual([RELIC])
        expect(state.getPlayerState('p2').relicIds).toEqual([])
    })

    it('refuses when the target pawn is elsewhere', () => {
        const state = shared({}, { siteId: 'c2' })
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: CONSPIRACY_ID,
                discardOrder: [],
                play: SearchPlay.Conspiracy,
                conspiracy: takeRelic
            })
        ).toBe('the target pawn is not at your site')
    })

    it('refuses without a secret to burn', () => {
        const state = shared({ secrets: 0 })
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: CONSPIRACY_ID,
                discardOrder: [],
                play: SearchPlay.Conspiracy,
                conspiracy: takeRelic
            })
        ).toBe('taking requires one secret to burn')
    })

    it('refuses with only one matching adviser — it takes two', () => {
        const state = shared({
            advisers: [
                { cardId: ORDER_A, faceUp: true },
                { cardId: BEAST, faceUp: true }
            ]
        })
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: CONSPIRACY_ID,
                discardOrder: [],
                play: SearchPlay.Conspiracy,
                conspiracy: takeRelic
            })
        ).toBe('needs two faceup advisers whose suits each match one of theirs')
    })

    it('refuses two advisers of a suit the target does not have', () => {
        const state = shared({
            advisers: [
                { cardId: BEAST, faceUp: true },
                { cardId: 'denizen.beast.forest-council', faceUp: true }
            ]
        })
        expect(HydratedSearchResolve.conspiracyMatchIsValid(state, 'p1', 'p2')).toBe(false)
    })

    /** The card's plural wording governs: no single shared suit is required. */
    it('accepts two advisers matching DIFFERENT suits of theirs (distributive)', () => {
        const state = shared(
            {
                advisers: [
                    { cardId: 'denizen.hearth.storyteller', faceUp: true },
                    { cardId: ORDER_A, faceUp: true }
                ]
            },
            {
                advisers: [
                    { cardId: 'denizen.hearth.marriage', faceUp: true },
                    { cardId: ORDER_C, faceUp: true }
                ]
            }
        )
        expect(HydratedSearchResolve.conspiracyMatchIsValid(state, 'p1', 'p2')).toBe(true)
    })

    it('still refuses when only one of yours matches anything of theirs', () => {
        const state = shared({
            advisers: [
                { cardId: ORDER_A, faceUp: true },
                { cardId: BEAST, faceUp: true }
            ]
        })
        expect(HydratedSearchResolve.conspiracyMatchIsValid(state, 'p1', 'p2')).toBe(false)
    })

    it('ignores facedown advisers on both sides (R-5.1.4.II, R-10.14)', () => {
        const yours = shared({
            advisers: [
                { cardId: ORDER_A, faceUp: true },
                { cardId: ORDER_B, faceUp: false }
            ]
        })
        expect(HydratedSearchResolve.conspiracyMatchIsValid(yours, 'p1', 'p2')).toBe(false)

        const theirs = shared({}, { advisers: [{ cardId: ORDER_C, faceUp: false }] })
        expect(HydratedSearchResolve.conspiracyMatchIsValid(theirs, 'p1', 'p2')).toBe(false)
    })

    it('refuses a relic the target does not hold', () => {
        const state = shared({}, { relicIds: [] })
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: CONSPIRACY_ID,
                discardOrder: [],
                play: SearchPlay.Conspiracy,
                conspiracy: takeRelic
            })
        ).toBe(`${RELIC} is not held by that player`)
    })

    it('refuses a banner the target does not hold', () => {
        const state = shared()
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: CONSPIRACY_ID,
                discardOrder: [],
                play: SearchPlay.Conspiracy,
                conspiracy: takeFavor
            })
        ).toBe(`that player does not hold the ${Banner.PeoplesFavor}`)
    })
})

describe('taking a banner with the Conspiracy is a Seize (R-2.5.3, R-10.23)', () => {
    function withBanner(banner: Banner, value: number, mobSide = false) {
        return shared(
            {},
            {},
            {
                banners: {
                    [Banner.PeoplesFavor]: {
                        value: banner === Banner.PeoplesFavor ? value : 1,
                        mobSide,
                        holderPlayerId: banner === Banner.PeoplesFavor ? 'p2' : undefined
                    },
                    [Banner.DarkestSecret]: {
                        value: banner === Banner.DarkestSecret ? value : 1,
                        holderPlayerId: banner === Banner.DarkestSecret ? 'p2' : undefined
                    }
                }
            }
        )
    }

    it("burns two favor off the People's Favor and flips it to Mob", () => {
        const state = withBanner(Banner.PeoplesFavor, 5)
        const banksBefore = { ...state.favorBank }
        const sharedBefore = state.favorSupply

        resolve('p1', { conspiracy: takeFavor }).apply(state)

        const peoples = state.banners[Banner.PeoplesFavor]
        expect(peoples.holderPlayerId).toBe('p1')
        expect(peoples.value).toBe(3)
        expect(state.isOnMobSide(Banner.PeoplesFavor)).toBe(true)
        // R-10.4 — burned favor goes to the shared bank, not a suit bank.
        expect(state.favorSupply).toBe(sharedBefore + 2)
        expect(state.favorBank).toEqual(banksBefore)
    })

    it('never burns a banner below one (R-2.5.3)', () => {
        const state = withBanner(Banner.PeoplesFavor, 2)
        resolve('p1', { conspiracy: takeFavor }).apply(state)

        expect(state.banners[Banner.PeoplesFavor].value).toBe(1)
    })

    it('burns nothing when the banner is already at one', () => {
        const state = withBanner(Banner.PeoplesFavor, 1)
        const sharedBefore = state.favorSupply
        resolve('p1', { conspiracy: takeFavor }).apply(state)

        expect(state.banners[Banner.PeoplesFavor].value).toBe(1)
        expect(state.banners[Banner.PeoplesFavor].holderPlayerId).toBe('p1')
        expect(state.favorSupply).toBe(sharedBefore)
    })

    it('conserves favor across the Seize (R-1.4, R-9.3)', () => {
        const state = withBanner(Banner.PeoplesFavor, 5)
        expect(() =>
            expectFavorConserved(state, () => {
                resolve('p1', { conspiracy: takeFavor }).apply(state)
            })
        ).not.toThrow()
    })

    it('leaves a banner already on its Mob side on it', () => {
        const state = withBanner(Banner.PeoplesFavor, 5, true)
        resolve('p1', { conspiracy: takeFavor }).apply(state)

        expect(state.isOnMobSide(Banner.PeoplesFavor)).toBe(true)
    })

    it('burns two secrets off the Darkest Secret, with no side to flip', () => {
        const state = withBanner(Banner.DarkestSecret, 4)

        resolve('p1', {
            conspiracy: {
                targetPlayerId: 'p2',
                take: { kind: 'banner', banner: Banner.DarkestSecret }
            }
        }).apply(state)

        expect(state.banners[Banner.DarkestSecret].value).toBe(2)
        expect(state.banners[Banner.DarkestSecret].holderPlayerId).toBe('p1')
        expect(state.isOnMobSide(Banner.DarkestSecret)).toBe(false)
    })
})

describe('the Seize helper in isolation (R-2.5.3)', () => {
    it('reports how much it actually burned', () => {
        const state = testState([testPlayer()], {
            banners: {
                [Banner.PeoplesFavor]: { value: 2, mobSide: false },
                [Banner.DarkestSecret]: { value: 1 }
            }
        })
        expect(seizeBanner(state, Banner.PeoplesFavor, 'p1')).toBe(1)
        expect(seizeBanner(state, Banner.DarkestSecret, 'p1')).toBe(0)
    })

    it('moves the holder as well as burning', () => {
        const state = testState([testPlayer()], {
            banners: {
                [Banner.PeoplesFavor]: { value: 5, mobSide: false, holderPlayerId: 'p2' },
                [Banner.DarkestSecret]: { value: 1 }
            }
        })
        seizeBanner(state, Banner.PeoplesFavor, 'p1')
        expect(state.banners[Banner.PeoplesFavor].holderPlayerId).toBe('p1')
    })
})

describe('R-5.1.4.IV — the Conspiracy match ignores the target\'s facedown advisers', () => {
    const HEARTH = 'denizen.hearth.ballot-box'
    const ORDER = 'denizen.order.wrestlers'

    it('two faceup advisers matching only facedown advisers of the target do not qualify', () => {
        // R-10.14 — a card showing no suit is ignored, so only faceup advisers count.
        const state = testState([
            testPlayer({
                playerId: 'p1',
                siteId: 'c1',
                advisers: [
                    { cardId: HEARTH, faceUp: true },
                    { cardId: ORDER, faceUp: true }
                ]
            }),
            testPlayer({
                playerId: 't1',
                color: Color.Blue,
                siteId: 'c1',
                advisers: [
                    { cardId: HEARTH, faceUp: false },
                    { cardId: ORDER, faceUp: false }
                ]
            })
        ])
        expect(HydratedSearchResolve.conspiracyMatchIsValid(state, 'p1', 't1')).toBe(false)
    })
})
