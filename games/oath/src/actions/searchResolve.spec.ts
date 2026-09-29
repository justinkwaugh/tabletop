import { servedJson } from '../testing/projection.js'
import { describe, expect, it } from 'vitest'
import { buildAction } from '../testing/actions.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from './searchResolve.js'
import { Banner, CardKind, PlayerStatus, Region, Suit } from '../model/oathEnums.js'
import { FIXTURE_SITE_CAPACITY, testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import { siteHasRoom } from '../powers/vocabulary.js'
import { registerCards } from '../data/cardRegistry.js'
import type { OathVault } from '../model/vault.js'
import type { HydratedOathGameState } from '../model/gameState.js'

const ORDER = 'denizen.order.wrestlers' // no placement restriction
const BEAST = 'denizen.beast.rangers'
const HEARTH = 'denizen.hearth.ballot-box'
const SITE_ONLY = 'denizen.hearth.a-round-of-ale' // locked
const ADVISER_ONLY = 'denizen.order.council-seat' // locked
const VISION = 'vision.conquest'
const CONSPIRACY = 'vision.conspiracy'
const HEARTH_AT_C2 = 'denizen.hearth.wayside-inn'

function resolve(playerId: string, fields: Partial<SearchResolve>) {
    return new HydratedSearchResolve(
        buildAction(SearchResolve, {
            playerId,
            discardOrder: [],
            ...fields
        })
    )
}

/** R-9.4 — discard piles live in the vault. */
function applyOnServer(
    action: HydratedSearchResolve,
    state: HydratedOathGameState,
    vault: OathVault = testVaultWithRelics({})
) {
    state.vault = vault
    action.apply(state)
    return vault
}

/** R-10.5 — c1 is in the Cradle, so discards go to the Provinces. */
function midSearch(playerOverrides = {}, stateOverrides = {}) {
    return testState(
        [
            testPlayer({
                siteId: 'c1',
                handIds: [ORDER, BEAST, HEARTH],
                ...playerOverrides
            })
        ],
        { denizensBySite: { c1: [] }, ...stateOverrides }
    )
}

describe('Step 3 — discard all but one (R-5.1.3, R-10.5)', () => {
    it('discards the other two to the NEXT region pile, not its own', () => {
        const state = midSearch()
        const vault = applyOnServer(
            resolve('p1', {
                keptCardId: ORDER,
                discardOrder: [BEAST, HEARTH],
                play: SearchPlay.Discard
            }),
            state
        )

        expect(state.discardPileCounts[Region.Cradle]).toBe(0)
        expect(state.discardPileCounts[Region.Provinces]).toBe(3)
        expect(vault.discardPiles[Region.Provinces]).toEqual([ORDER, HEARTH, BEAST])
    })

    it('publishes the count but never the contents (R-9.4)', () => {
        const state = midSearch()
        applyOnServer(
            resolve('p1', {
                keptCardId: ORDER,
                discardOrder: [BEAST, HEARTH],
                play: SearchPlay.Discard
            }),
            state
        )

        // A discarded card is secret again, even to the player who discarded it.
        const served = servedJson(state)
        for (const cardId of [ORDER, BEAST, HEARTH]) {
            expect(served).not.toContain(cardId)
        }
        expect(state.discardPileCounts[Region.Provinces]).toBe(3)
    })

    it('honours the chosen discard order, last card on top', () => {
        const state = midSearch()
        const vault = applyOnServer(
            resolve('p1', {
                keptCardId: ORDER,
                discardOrder: [HEARTH, BEAST],
                play: SearchPlay.Adviser
            }),
            state
        )

        expect(vault.discardPiles[Region.Provinces]).toEqual([BEAST, HEARTH])
    })

    it('wraps a Hinterland pawn discard round to the Cradle', () => {
        const state = midSearch({ siteId: 'h2' })
        resolve('p1', {
            keptCardId: ORDER,
            discardOrder: [BEAST, HEARTH],
            play: SearchPlay.Adviser
        }).apply(state)

        expect(state.discardPileCounts[Region.Cradle]).toBe(2)
        expect(state.discardPileCounts[Region.Hinterland]).toBe(0)
    })

    it('empties the hand', () => {
        const state = midSearch()
        resolve('p1', {
            keptCardId: ORDER,
            discardOrder: [BEAST, HEARTH],
            play: SearchPlay.Adviser
        }).apply(state)

        expect(state.getPlayerState('p1').handIds).toEqual([])
    })

    it('refuses to keep a card that was not drawn', () => {
        const state = midSearch()
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: VISION,
                discardOrder: [ORDER, BEAST, HEARTH],
                play: SearchPlay.Discard
            })
        ).toBe(`${VISION} was not drawn`)
    })

    it('refuses to keep more than one card', () => {
        const state = midSearch()
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: ORDER,
                discardOrder: [BEAST],
                play: SearchPlay.Discard
            })
        ).toContain('must discard exactly the cards not kept')
    })

    it('handles a truncated draw — a Vision interrupt leaves fewer cards', () => {
        const state = midSearch({ handIds: [ORDER, VISION] })
        const vault = applyOnServer(
            resolve('p1', {
                keptCardId: VISION,
                discardOrder: [ORDER],
                play: SearchPlay.Discard
            }),
            state
        )

        expect(vault.discardPiles[Region.Provinces]).toEqual([VISION, ORDER])
    })

    it('handles a single-card draw with nothing to discard', () => {
        const state = midSearch({ handIds: [ORDER] })
        resolve('p1', {
            keptCardId: ORDER,
            discardOrder: [],
            play: SearchPlay.Adviser
        }).apply(state)

        expect(state.getPlayerState('p1').knownAdvisers()).toEqual([{ cardId: ORDER, faceUp: false }])
        expect(state.discardPileCounts[Region.Provinces]).toBe(0)
    })
})

describe('Step 4 — play to your site (R-5.1.4.I, R-10.19)', () => {
    it('places the card faceup at the site and gains a matching favor', () => {
        const state = midSearch()
        const action = resolve('p1', {
            keptCardId: ORDER,
            discardOrder: [BEAST, HEARTH],
            play: SearchPlay.Site
        })
        action.apply(state)

        expect(state.denizensBySite['c1']).toEqual([ORDER])
        expect(state.getPlayerState('p1').favor).toBe(1)
        expect(state.favorBank[Suit.Order]).toBe(2)
        expect(action.metadata?.favorGained).toBe(1)
    })

    it('gains nothing when the matching bank is empty (R-9.3)', () => {
        const state = midSearch(
            {},
            { favorBank: { ...testState([testPlayer()]).favorBank, [Suit.Order]: 0 } }
        )
        resolve('p1', {
            keptCardId: ORDER,
            discardOrder: [BEAST, HEARTH],
            play: SearchPlay.Site
        }).apply(state)

        expect(state.getPlayerState('p1').favor).toBe(0)
        expect(state.favorBank[Suit.Order]).toBe(0)
        expect(state.denizensBySite['c1']).toEqual([ORDER])
    })

    it('refuses a Vision — Visions are never played to a site (R-5.1.4.III)', () => {
        const state = midSearch({ handIds: [VISION, ORDER, BEAST] })
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: VISION,
                discardOrder: [ORDER, BEAST],
                play: SearchPlay.Site
            })
        ).toBe('Visions cannot be played to a site')
    })

    it('refuses a person-restricted card (R-7.2.1)', () => {
        const state = midSearch({ handIds: [ADVISER_ONLY, ORDER, BEAST] })
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: ADVISER_ONLY,
                discardOrder: [ORDER, BEAST],
                play: SearchPlay.Site
            })
        ).toBe(`${ADVISER_ONLY} can only be played to your advisers`)
    })

    it('refuses once the site is at capacity (R-2.8.1)', () => {
        registerCards([
            { id: 'site.test-capacity-2', name: 'Test Site', kind: CardKind.Site, capacity: 2 }
        ])
        const state = midSearch(
            { siteId: 'site.test-capacity-2' },
            {
                map: {
                    [Region.Cradle]: ['site.test-capacity-2', 'c2'],
                    [Region.Provinces]: ['p1', 'p2', 'p3'],
                    [Region.Hinterland]: ['h1', 'h2', 'h3']
                },
                denizensBySite: { 'site.test-capacity-2': [BEAST, HEARTH] }
            }
        )
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: ORDER,
                discardOrder: [BEAST, HEARTH],
                play: SearchPlay.Site
            })
        ).toBe('site site.test-capacity-2 is at its capacity of 2')
    })

    it('reads a full site as full, as a power placing a denizen does (R-2.8.1)', () => {
        const state = midSearch({}, { denizensBySite: { c1: [BEAST, HEARTH, VISION] } })
        expect(siteHasRoom(state, 'c1')).toBe(false)
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: ORDER,
                discardOrder: [BEAST, HEARTH],
                play: SearchPlay.Site
            })
        ).toBe(`site c1 is at its capacity of ${FIXTURE_SITE_CAPACITY}`)
    })

    it('treats a faceup site without a printed capacity as a broken invariant', () => {
        const state = midSearch({}, { siteCards: { c1: 'site.unprinted' } })
        expect(() =>
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: ORDER,
                discardOrder: [BEAST, HEARTH],
                play: SearchPlay.Site
            })
        ).toThrow('site.unprinted has no printed capacity')
    })
})

describe("R-5.1.4.I — the People's Favor's holder plays to any site in their region", () => {
    const full = Array.from({ length: FIXTURE_SITE_CAPACITY }, (_, i) => `denizen.order.filler-${i}`)
    const holding = (holder: string) => ({
        denizensBySite: { c1: [], c2: [HEARTH_AT_C2, ...full.slice(1)], p1: [] },
        banners: {
            [Banner.PeoplesFavor]: { value: 1, mobSide: false, holderPlayerId: holder },
            [Banner.DarkestSecret]: { value: 1 }
        }
    })
    const play = (fields: Partial<SearchResolve>) =>
        ({ keptCardId: ORDER, discardOrder: [BEAST, HEARTH], play: SearchPlay.Site, ...fields })

    it('to a full site in the region after first discarding a card there; nowhere else, and not without the banner', () => {
        const state = midSearch({}, holding('p1'))
        expect(HydratedSearchResolve.reasonCannotResolve(state, 'p1', play({ toSiteId: 'c2' }))).toMatch(/at its capacity/)
        expect(HydratedSearchResolve.reasonCannotResolve(state, 'p1', play({ toSiteId: 'p1' }))).toMatch(/only be played to your own site/)
        expect(HydratedSearchResolve.reasonCannotResolve(midSearch({}, holding('p2')), 'p1', play({ toSiteId: 'c2', discardFirstCardId: HEARTH_AT_C2 }))).toMatch(/only be played to your own site/)

        applyOnServer(resolve('p1', play({ toSiteId: 'c2', discardFirstCardId: HEARTH_AT_C2 })), state)
        expect(state.denizensBySite['c2']).toContain(ORDER)
        expect(state.denizensBySite['c2']).not.toContain(HEARTH_AT_C2)
    })
})

describe('Step 4 — play to your advisers (R-5.1.4.II, R-2.2.2)', () => {
    it('plays faceup', () => {
        const state = midSearch()
        resolve('p1', {
            keptCardId: ORDER,
            discardOrder: [BEAST, HEARTH],
            play: SearchPlay.Adviser,
            faceUp: true
        }).apply(state)

        expect(state.getPlayerState('p1').advisers).toEqual([{ cardId: ORDER, faceUp: true }])
    })

    it('plays facedown, gaining no favor', () => {
        const state = midSearch()
        resolve('p1', {
            keptCardId: ORDER,
            discardOrder: [BEAST, HEARTH],
            play: SearchPlay.Adviser,
            faceUp: false
        }).apply(state)

        expect(state.getPlayerState('p1').knownAdvisers()).toEqual([{ cardId: ORDER, faceUp: false }])
        expect(state.getPlayerState('p1').advisers).toEqual([{ faceUp: false }])
        expect(state.getPlayerState('p1').favor).toBe(0)
    })

    it('lets a Vision be a facedown adviser but not a faceup one (R-2.2.2)', () => {
        const state = midSearch({ handIds: [VISION, ORDER, BEAST] })
        const facedown = {
            keptCardId: VISION,
            discardOrder: [ORDER, BEAST],
            play: SearchPlay.Adviser
        }
        expect(HydratedSearchResolve.reasonCannotResolve(state, 'p1', facedown)).toBeUndefined()
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                ...facedown,
                faceUp: true
            })
        ).toBe('only denizens can be faceup advisers')
    })

    it('refuses a tree-restricted card faceup, but allows it facedown (R-7.2, R-7.2.1)', () => {
        // R-7.2 — restriction banners apply only to faceup cards.
        const state = midSearch({ handIds: [SITE_ONLY, ORDER, BEAST] })
        const choice = {
            keptCardId: SITE_ONLY,
            discardOrder: [ORDER, BEAST],
            play: SearchPlay.Adviser
        }
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', { ...choice, faceUp: true })
        ).toBe(`${SITE_ONLY} can only be played to a site`)
        expect(HydratedSearchResolve.reasonCannotResolve(state, 'p1', choice)).toBeUndefined()
    })

    it('refuses at the adviser limit without discarding one first', () => {
        const state = midSearch({
            advisers: [
                { cardId: BEAST, faceUp: true },
                { cardId: HEARTH, faceUp: true },
                { cardId: VISION, faceUp: false }
            ]
        })
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: ORDER,
                discardOrder: [BEAST, HEARTH],
                play: SearchPlay.Adviser
            })
        ).toBe('already at the adviser limit of 3; one must be discarded first')
    })

    it('discards an adviser first to make room, and it goes to the pile', () => {
        const state = midSearch({
            handIds: [ORDER],
            advisers: [
                { cardId: BEAST, faceUp: true },
                { cardId: HEARTH, faceUp: true },
                { cardId: VISION, faceUp: false }
            ]
        })
        const action = resolve('p1', {
            keptCardId: ORDER,
            discardOrder: [],
            play: SearchPlay.Adviser,
            faceUp: true,
            discardedAdviserCardIds: [HEARTH]
        })
        const vault = applyOnServer(action, state)

        const p = state.getPlayerState('p1')
        expect(p.knownAdviserIds()).toEqual([BEAST, VISION, ORDER])
        expect(vault.discardPiles[Region.Provinces]).toEqual([HEARTH])
        expect(action.metadata?.discardedCardIds).toEqual([HEARTH])
    })

    it('returns favor and secrets off a discarded adviser (R-10.5)', () => {
        const state = midSearch(
            {
                handIds: [ORDER],
                advisers: [
                    { cardId: BEAST, faceUp: true },
                    { cardId: HEARTH, faceUp: true },
                    { cardId: VISION, faceUp: false }
                ]
            },
            { cardTokens: { [HEARTH]: { favor: 2, secrets: 1 } } }
        )
        resolve('p1', {
            keptCardId: ORDER,
            discardOrder: [],
            play: SearchPlay.Adviser,
            discardedAdviserCardIds: [HEARTH]
        }).apply(state)

        const p = state.getPlayerState('p1')
        // R-7.1.2.a — the secret returns facedown.
        expect(state.favorBank[Suit.Hearth]).toBe(5)
        expect(p.secretsFacedown).toBe(1)
        expect(state.tokensOn(HEARTH)).toEqual({ favor: 0, secrets: 0 })
    })

    it('refuses to discard a locked adviser (R-7.2.2, R-10.16)', () => {
        const state = midSearch({
            handIds: [ORDER],
            advisers: [
                { cardId: ADVISER_ONLY, faceUp: true },
                { cardId: HEARTH, faceUp: true },
                { cardId: VISION, faceUp: false }
            ]
        })
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: ORDER,
                discardOrder: [],
                play: SearchPlay.Adviser,
                discardedAdviserCardIds: [ADVISER_ONLY]
            })
        ).toBe(`${ADVISER_ONLY} is locked and cannot be discarded`)
    })

    it('refuses to discard an adviser when not at the limit', () => {
        // R-5.1.4.II — an adviser is discarded here only to make room, never freely.
        const state = midSearch({ handIds: [ORDER], advisers: [{ cardId: BEAST, faceUp: true }] })
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: ORDER,
                discardOrder: [],
                play: SearchPlay.Adviser,
                discardedAdviserCardIds: [BEAST]
            })
        ).toBe('cannot discard an adviser without being at the limit')
    })
})

describe('Step 4 — play a Vision faceup (R-5.1.4.III)', () => {
    it('places it on the Revealed Vision space, which is not an adviser', () => {
        const state = midSearch({ handIds: [VISION, ORDER] })
        resolve('p1', {
            keptCardId: VISION,
            discardOrder: [ORDER],
            play: SearchPlay.RevealedVision
        }).apply(state)

        const p = state.getPlayerState('p1')
        expect(p.revealedVisionId).toBe(VISION)
        expect(p.advisers).toEqual([])
    })

    it('discards the Vision already there', () => {
        const state = midSearch({
            handIds: [VISION, ORDER],
            revealedVisionId: 'vision.faith'
        })
        const action = resolve('p1', {
            keptCardId: VISION,
            discardOrder: [ORDER],
            play: SearchPlay.RevealedVision
        })
        const vault = applyOnServer(action, state)

        expect(state.getPlayerState('p1').revealedVisionId).toBe(VISION)
        expect(vault.discardPiles[Region.Provinces]).toEqual(['vision.faith', ORDER])
        expect(action.metadata?.discardedCardIds).toEqual([ORDER, 'vision.faith'])
    })

    it('refuses a non-Vision', () => {
        const state = midSearch()
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: ORDER,
                discardOrder: [BEAST, HEARTH],
                play: SearchPlay.RevealedVision
            })
        ).toBe(`${ORDER} is not a Vision`)
    })

    it('refuses the Chancellor and Citizens (R-5.1.4.III)', () => {
        for (const status of [PlayerStatus.Chancellor, PlayerStatus.Citizen]) {
            const state = midSearch({ status, handIds: [VISION, ORDER] })
            expect(
                HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                    keptCardId: VISION,
                    discardOrder: [ORDER],
                    play: SearchPlay.RevealedVision
                })
            ).toBe(`a ${status} cannot play a Vision faceup`)
        }
    })

    it('refuses the Conspiracy as a revealed Vision (R-5.1.4.IV)', () => {
        const state = midSearch({ handIds: [CONSPIRACY, ORDER] })
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: CONSPIRACY,
                discardOrder: [ORDER],
                play: SearchPlay.RevealedVision
            })
        ).toContain('R-5.1.4.IV')
    })
})

describe('Step 4 — discard the keeper too (R-5.1.4)', () => {
    it('is always available, so a searcher is never stuck', () => {
        const state = midSearch({ handIds: [SITE_ONLY] })
        expect(
            HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
                keptCardId: SITE_ONLY,
                discardOrder: [],
                play: SearchPlay.Discard
            })
        ).toBeUndefined()
        expect(HydratedSearchResolve.canDoSearchResolve(state, 'p1')).toBe(true)
    })

    it('puts the keeper on top of the cards discarded before it', () => {
        const state = midSearch()
        const vault = applyOnServer(
            resolve('p1', {
                keptCardId: ORDER,
                discardOrder: [BEAST, HEARTH],
                play: SearchPlay.Discard
            }),
            state
        )

        expect(vault.discardPiles[Region.Provinces][0]).toBe(ORDER)
        expect(state.discardPileCounts[Region.Provinces]).toBe(3)
    })
})

describe('R-7.2, R-7.2.2 — the lock is enforced against facedown advisers', () => {
    const ORDER = 'denizen.order.wrestlers'
    const BEAST = 'denizen.beast.rangers'
    const HEARTH = 'denizen.hearth.ballot-box'
    const LOCKED = 'denizen.order.council-seat'

    /** p1 is at the adviser limit. */
    function board() {
        return testState(
            [
                testPlayer({
                    siteId: 'c1',
                    handIds: [ORDER],
                    advisers: [
                        { cardId: LOCKED, faceUp: false },
                        { cardId: BEAST, faceUp: true },
                        { cardId: HEARTH, faceUp: true }
                    ]
                })
            ],
            { denizensBySite: { c1: [] } }
        )
    }

    it('R-7.2 — a facedown locked adviser may be discarded to make room', () => {
        const reason = HydratedSearchResolve.reasonCannotResolve(board(), 'p1', {
            keptCardId: ORDER,
            discardOrder: [],
            play: SearchPlay.Adviser,
            discardedAdviserCardIds: [LOCKED]
        })
        expect(reason).toBeUndefined()
    })

    it('R-7.2.2 — the same adviser faceup is still locked in place', () => {
        const state = board()
        const seat = state.getPlayerState('p1')
        seat.replaceAdviser(LOCKED, { cardId: LOCKED, faceUp: true })
        const reason = HydratedSearchResolve.reasonCannotResolve(state, 'p1', {
            keptCardId: ORDER,
            discardOrder: [],
            play: SearchPlay.Adviser,
            discardedAdviserCardIds: [LOCKED]
        })
        expect(reason).toBe(`${LOCKED} is locked and cannot be discarded`)
    })
})
