import { servedJson } from '../testing/projection.js'
import { buildSetupVault } from '../model/setup.js'
import { getPrng } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { buildAction } from '../testing/actions.js'
import { HydratedSearch, Search, SEARCH_DRAW_COUNT, SearchSource } from './search.js'
import { CardKind, Region } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { createOathVault, type OathVault } from '../model/vault.js'
import type { HydratedOathGameState } from '../model/gameState.js'

const D1 = 'denizen.order.wrestlers'
const D2 = 'denizen.beast.rangers'
const D3 = 'denizen.hearth.ballot-box'
const D4 = 'denizen.nomad.horse-archers'
const VISION = 'vision.conquest'

function searchAction(playerId: string, drawFrom: SearchSource) {
    return buildAction(Search, {
        playerId,
        drawFrom,
        revealsInfo: true
    })
}

function serverSearch(
    state: HydratedOathGameState,
    vault: OathVault,
    playerId: string,
    drawFrom: SearchSource
) {
    const action = searchAction(playerId, drawFrom)
    state.vault = vault
    const hydrated = new HydratedSearch(action)
    hydrated.apply(state)
    return hydrated
}

function vaultWith(worldDeck: string[], discardPiles: Partial<Record<Region, string[]>> = {}) {
    const vault = createOathVault({ discardPiles }, getPrng(1))
    vault.worldDeck = [...worldDeck]
    return vault
}

/** c1 is in the Cradle. */
function ready(playerOverrides = {}, stateOverrides = {}) {
    return testState([testPlayer({ siteId: 'c1', supply: 7, ...playerOverrides })], stateOverrides)
}

describe('Search cost (R-5.1.1, R-2.1.6)', () => {
    it('charges the Visions Drawn track for a world deck search', () => {
        const state = ready({}, { visionsDrawn: 0 })
        expect(HydratedSearch.supplyCost(state, SearchSource.WorldDeck)).toBe(2)

        const later = ready({}, { visionsDrawn: 3 })
        expect(HydratedSearch.supplyCost(later, SearchSource.WorldDeck)).toBe(4)
    })

    it('charges a flat 2 for a discard pile whatever the track shows', () => {
        const state = ready({}, { visionsDrawn: 5 })
        expect(HydratedSearch.supplyCost(state, SearchSource.Discard)).toBe(2)
    })

    it('spends the Supply and records it for the Rest refund (R-4.3.4)', () => {
        const state = ready({}, { visionsDrawn: 1 })
        const vault = vaultWith([D1, D2, D3])
        serverSearch(state, vault, 'p1', SearchSource.WorldDeck)

        const p = state.getPlayerState('p1')
        expect(p.supply).toBe(4)
        expect(p.supplySpentThisTurn).toBe(3)
    })
})

describe('Search draw count (R-5.1.2, R-11.11)', () => {
    it('R-5.1.2 — draws three from an ordinary site', () => {
        expect(HydratedSearch.drawCount(ready(), 'p1')).toBe(SEARCH_DRAW_COUNT)
    })

    it('R-11.11 — draws one fewer while the pawn is in the Marshes', () => {
        const state = ready({ siteId: 'c1' }, { siteCards: { c1: 'site.marshes' } })
        expect(HydratedSearch.drawCount(state, 'p1')).toBe(SEARCH_DRAW_COUNT - 1)
    })

    it('R-11.11 — applies to the pawn’s site, not to a Marshes elsewhere', () => {
        const state = ready(
            { siteId: 'c1' },
            { siteCards: { c1: 'site.plains', c2: 'site.marshes' } }
        )
        expect(HydratedSearch.drawCount(state, 'p1')).toBe(SEARCH_DRAW_COUNT)
    })
})

describe('Search legality (R-5.1.1, R-5.1.2)', () => {
    it('refuses when the player cannot afford the cost', () => {
        const state = ready({ supply: 1 }, { visionsDrawn: 0 })
        expect(
            HydratedSearch.reasonCannotSearch(state, 'p1', SearchSource.WorldDeck)
        ).toBe('costs 2 Supply, player has 1')
    })

    it('treats a pawn off the map as a broken invariant, not a refusal (R-1.23.1)', () => {
        const state = ready({ siteId: undefined })
        expect(() => HydratedSearch.reasonCannotSearch(state, 'p1', SearchSource.WorldDeck)).toThrow(
            "p1's pawn must be at a site"
        )
    })

    it('refuses a world deck search once the deck is empty', () => {
        const state = ready({}, { worldDeckExhausted: true })
        expect(HydratedSearch.reasonCannotSearch(state, 'p1', SearchSource.WorldDeck)).toBe(
            'the world deck is empty'
        )
    })

    it('refuses a discard search when the pawn own region pile is empty', () => {
        const state = ready(
            {},
            {
                discardPileCounts: {
                    [Region.Cradle]: 0,
                    [Region.Provinces]: 5,
                    [Region.Hinterland]: 5
                }
            }
        )
        expect(HydratedSearch.reasonCannotSearch(state, 'p1', SearchSource.Discard)).toBe(
            'the cradle discard pile is empty'
        )
    })

    it('offers only the sources that are actually legal', () => {
        const state = ready(
            {},
            {
                worldDeckExhausted: true,
                discardPileCounts: {
                    [Region.Cradle]: 2,
                    [Region.Provinces]: 0,
                    [Region.Hinterland]: 0
                }
            }
        )
        expect(HydratedSearch.legalSources(state, 'p1')).toEqual([SearchSource.Discard])
        expect(HydratedSearch.canDoSearch(state, 'p1')).toBe(true)
    })

    it('cannot Search at all with an empty deck and an empty pile', () => {
        const state = ready({}, { worldDeckExhausted: true })
        expect(HydratedSearch.canDoSearch(state, 'p1')).toBe(false)
    })
})

describe('Search draws from the world deck (R-5.1.2)', () => {
    it('draws three cards into hand and empties them from the vault', () => {
        const state = ready()
        const vault = vaultWith([D1, D2, D3, D4])
        const action = serverSearch(state, vault, 'p1', SearchSource.WorldDeck)

        expect(state.getPlayerState('p1').handIds).toEqual([D1, D2, D3])
        expect(vault.worldDeck).toEqual([D4])
        expect(action.metadata?.cardsDrawn).toBe(3)
    })

    it('stops on a Vision, keeps it, and advances the track (R-2.7.1)', () => {
        const state = ready()
        const vault = vaultWith([D1, VISION, D2, D3])
        const action = serverSearch(state, vault, 'p1', SearchSource.WorldDeck)

        expect(state.getPlayerState('p1').handIds).toEqual([D1, VISION])
        expect(state.visionsDrawn).toBe(1)
        expect(action.metadata?.cardsDrawn).toBe(2)
        expect(vault.worldDeck).toEqual([D2, D3])
    })

    it('advances the track one space only, however the draw ended', () => {
        const state = ready({}, { visionsDrawn: 2 })
        const vault = vaultWith([VISION, D1, D2])
        serverSearch(state, vault, 'p1', SearchSource.WorldDeck)

        expect(state.visionsDrawn).toBe(3)
    })

    it('makes the next Search cost more, via the track (R-2.1.6)', () => {
        const state = ready({}, { visionsDrawn: 0 })
        expect(HydratedSearch.supplyCost(state, SearchSource.WorldDeck)).toBe(2)

        serverSearch(state, vaultWith([VISION, D1]), 'p1', SearchSource.WorldDeck)

        expect(state.visionsDrawn).toBe(1)
        expect(HydratedSearch.supplyCost(state, SearchSource.WorldDeck)).toBe(3)
    })

    it('leaves the track alone when no Vision is drawn', () => {
        const state = ready({}, { visionsDrawn: 1 })
        serverSearch(state, vaultWith([D1, D2, D3]), 'p1', SearchSource.WorldDeck)

        expect(state.visionsDrawn).toBe(1)
    })

    it('publishes the new top card back type and nothing more (R-9.4)', () => {
        const state = ready()
        const vault = vaultWith([D1, D2, D3, VISION])
        serverSearch(state, vault, 'p1', SearchSource.WorldDeck)

        expect(state.topCardBackType).toBe(CardKind.Vision)
        expect(state.worldDeckExhausted).toBe(false)
        expect(Object.keys(state.dehydrate())).not.toContain('worldDeckIds')
    })

    it('marks the deck exhausted and drops the back type when it runs out', () => {
        const state = ready()
        const vault = vaultWith([D1, D2])
        serverSearch(state, vault, 'p1', SearchSource.WorldDeck)

        expect(state.getPlayerState('p1').handIds).toEqual([D1, D2])
        expect(state.worldDeckExhausted).toBe(true)
        expect(state.topCardBackType).toBeUndefined()
        expect(HydratedSearch.reasonCannotSearch(state, 'p1', SearchSource.WorldDeck)).toBe(
            'the world deck is empty'
        )
    })
})

describe('Search draws from a discard pile (R-5.1.2, R-10.6)', () => {
    // R-9.4 — a pile's cards live in the vault and public state holds only its count.
    function withCradlePile(cards: string[]) {
        const state = ready(
            {},
            {
                discardPileCounts: {
                    [Region.Cradle]: cards.length,
                    [Region.Provinces]: 0,
                    [Region.Hinterland]: 0
                }
            }
        )
        return { state, vault: vaultWith([], { [Region.Cradle]: cards }) }
    }

    it('draws from the pile of the pawn own region', () => {
        const { state, vault } = withCradlePile([D1, D2, D3, D4])
        serverSearch(state, vault, 'p1', SearchSource.Discard)

        expect(state.getPlayerState('p1').handIds).toEqual([D1, D2, D3])
        expect(vault.discardPiles[Region.Cradle]).toEqual([D4])
        expect(state.discardPileCounts[Region.Cradle]).toBe(1)
    })

    it('publishes the count and nothing else about the pile (R-9.4)', () => {
        const { state, vault } = withCradlePile([D1, D2, D3, D4])
        serverSearch(state, vault, 'p1', SearchSource.Discard)

        const served = servedJson(state)
        expect(served).not.toContain(D4)
    })

    it('never interrupts on a Vision — that is world deck only (R-5.1.2)', () => {
        const { state, vault } = withCradlePile([D1, VISION, D2])
        serverSearch(state, vault, 'p1', SearchSource.Discard)

        expect(state.getPlayerState('p1').handIds).toEqual([D1, VISION, D2])
        // R-2.7.1 — only a world deck draw advances the track.
        expect(state.visionsDrawn).toBe(0)
    })

    it('takes as many as possible from a short pile (R-9.3)', () => {
        const { state, vault } = withCradlePile([D1])
        serverSearch(state, vault, 'p1', SearchSource.Discard)

        expect(state.getPlayerState('p1').handIds).toEqual([D1])
        expect(state.discardPileCounts[Region.Cradle]).toBe(0)
    })

    it('leaves the world deck untouched', () => {
        const { state } = withCradlePile([D1])
        const vault = vaultWith([D2, D3], { [Region.Cradle]: [D1] })
        serverSearch(state, vault, 'p1', SearchSource.Discard)

        expect(vault.worldDeck).toEqual([D2, D3])
        expect(state.worldDeckExhausted).toBe(false)
    })
})

describe('the resolver and the engine boundary', () => {
    it('never advances the state PRNG — the vault has its own seed', () => {
        const state = ready()
        const vault = vaultWith([D1, D2, D3])
        const invocationsBefore = state.prng.invocations

        serverSearch(state, vault, 'p1', SearchSource.WorldDeck)

        expect(state.prng.invocations).toBe(invocationsBefore)
    })

    it('starts a new game with a vault dealt by setup (R-1.1, R-1.17, R-1.21)', () => {
        const vault = buildSetupVault(ready(), getPrng(1))
        expect(vault.worldDeck.length).toBeGreaterThan(0)
        // R-1.17 — four facedown relics on the Imperial Reliquary's spaces.
        expect(Object.keys(vault.relicFacedown)).toHaveLength(4)
        // R-1.1, R-1.18 — the site and relic decks hold what was not dealt.
        expect(vault.siteDeck.length).toBeGreaterThan(0)
        expect(vault.relicDeck.length).toBeGreaterThan(0)
    })

    it('applies safely with no resolved draw — the client optimistic run', () => {
        // The client applies this before the server resolves the draw; a throw blocks the send.
        const state = ready()
        const action = new HydratedSearch(searchAction('p1', SearchSource.WorldDeck))

        expect(() => action.apply(state)).not.toThrow()
        expect(state.getPlayerState('p1').handIds).toEqual([])
        expect(state.getPlayerState('p1').supply).toBe(5)
    })

    it('flags itself as revealing, which blocks undo (R-X.3)', () => {
        const action = new HydratedSearch(searchAction('p1', SearchSource.WorldDeck))
        expect(action.revealsInfo).toBe(true)
    })
})
