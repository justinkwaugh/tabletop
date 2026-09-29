import { describe, expect, it } from 'vitest'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from './playFacedownAdviser.js'
import { SearchPlay } from './searchResolve.js'
import { Banner, PlayerStatus, Region, Suit } from '../model/oathEnums.js'
import { registerCards } from '../data/cardRegistry.js'
import { CardKind } from '../model/oathEnums.js'
import { FIXTURE_SITE_CAPACITY, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'

const HEARTH = 'denizen.hearth.spec-hearth'
const SITE_ONLY = 'denizen.order.spec-site-only'
const VISION = 'vision.conquest'

registerCards([
    { id: HEARTH, name: 'Spec Hearth', kind: CardKind.Denizen, suit: Suit.Hearth, placement: null },
    {
        id: SITE_ONLY,
        name: 'Spec Site Only',
        kind: CardKind.Denizen,
        suit: Suit.Order,
        // R-7.2.1 — a restricted card, only ever playable to a site.
        placement: 'site'
    }
])

function play(
    playerId: string,
    cardId: string,
    playTo: SearchPlay,
    extra: Record<string, unknown> = {}
) {
    return new HydratedPlayFacedownAdviser(
        buildAction(PlayFacedownAdviser, {
            playerId,
            cardId,
            play: playTo,
            ...extra
        })
    )
}

function ready(advisers: { cardId: string; faceUp: boolean }[], overrides = {}, stateOverrides = {}) {
    return testState([testPlayer({ siteId: 'c1', advisers, ...overrides })], stateOverrides)
}

describe('Play or Discard a Facedown Adviser (R-6.1)', () => {
    it('R-10.1 — turns a facedown adviser faceup in place, leaving the adviser count alone', () => {
        const state = ready([{ cardId: HEARTH, faceUp: false }])
        play('p1', HEARTH, SearchPlay.Adviser).apply(state)

        expect(state.getPlayerState('p1').advisers).toEqual([{ cardId: HEARTH, faceUp: true }])
    })

    it('costs no Supply (R-6)', () => {
        const state = ready([{ cardId: HEARTH, faceUp: false }], { supply: 4 })
        play('p1', HEARTH, SearchPlay.Adviser).apply(state)

        const p = state.getPlayerState('p1')
        expect(p.supply).toBe(4)
        expect(p.supplySpentThisTurn).toBe(0)
    })

    it('plays to your site as if you searched, gaining the matching favor (R-5.1.4.I)', () => {
        const state = ready([{ cardId: HEARTH, faceUp: false }])
        const hearthBank = state.favorBank[Suit.Hearth]

        play('p1', HEARTH, SearchPlay.Site).apply(state)

        const p = state.getPlayerState('p1')
        expect(p.advisers).toEqual([])
        expect(state.denizensBySite['c1']).toEqual([HEARTH])
        expect(p.favor).toBe(1)
        expect(state.favorBank[Suit.Hearth]).toBe(hearthBank - 1)
    })

    it('discards it to the NEXT region’s pile (R-10.5)', () => {
        const state = ready([{ cardId: HEARTH, faceUp: false }])
        const action = play('p1', HEARTH, SearchPlay.Discard)
        action.apply(state)

        expect(state.getPlayerState('p1').advisers).toEqual([])
        // The pawn is in the Cradle.
        expect(action.metadata?.discardPileRegion).toBe(Region.Provinces)
        expect(action.metadata?.discardedCardIds).toEqual([HEARTH])
        expect(state.discardPileCounts[Region.Provinces]).toBe(1)
    })

    it('R-X.3 — a discard writes the vault and a faceup flip shows the card: neither can be undone', () => {
        // A discard writes into the vault's secret pile, which undo never rolls back.
        const discarded = ready([{ cardId: HEARTH, faceUp: false }])
        const discard = play('p1', HEARTH, SearchPlay.Discard)
        discard.apply(discarded)
        expect(discard.revealsInfo).toBe(true)

        const kept = ready([{ cardId: HEARTH, faceUp: false }])
        const flip = play('p1', HEARTH, SearchPlay.Adviser)
        flip.apply(kept)
        expect(flip.revealsInfo).toBe(true)
    })

    it('plays a facedown Vision to the Revealed Vision space (R-5.1.4.III)', () => {
        const state = ready([{ cardId: VISION, faceUp: false }])
        play('p1', VISION, SearchPlay.RevealedVision).apply(state)

        const p = state.getPlayerState('p1')
        expect(p.revealedVisionId).toBe(VISION)
        expect(p.advisers).toEqual([])
    })

    it('refuses an adviser that is already faceup (R-5.1.4.II)', () => {
        const state = ready([{ cardId: HEARTH, faceUp: true }])
        expect(() => play('p1', HEARTH, SearchPlay.Discard).apply(state)).toThrow(/already faceup/)
    })

    it('refuses a card that is not one of your advisers', () => {
        const state = ready([{ cardId: HEARTH, faceUp: false }])
        expect(() =>
            play('p1', 'denizen.hearth.elsewhere', SearchPlay.Discard).apply(state)
        ).toThrow(/not one of your advisers/)
    })

    it('applies restrictions that a facedown adviser did not have (R-7.2, R-7.2.1)', () => {
        const state = ready([{ cardId: SITE_ONLY, faceUp: false }])

        expect(() => play('p1', SITE_ONLY, SearchPlay.Adviser).apply(state)).toThrow(
            /can only be played to a site/
        )
        play('p1', SITE_ONLY, SearchPlay.Site).apply(state)
        expect(state.denizensBySite['c1']).toEqual([SITE_ONLY])
    })

    it('does not make a full-handed player discard to replay a card already in a slot', () => {
        const state = ready([
            { cardId: HEARTH, faceUp: false },
            { cardId: 'denizen.hearth.two', faceUp: true },
            { cardId: 'denizen.hearth.three', faceUp: true }
        ])
        expect(state.getPlayerState('p1').adviserLimit).toBe(3)

        play('p1', HEARTH, SearchPlay.Adviser).apply(state)
        expect(state.getPlayerState('p1').advisers).toHaveLength(3)
    })

    it('refuses a faceup Vision from the Chancellor or a Citizen (R-5.1.4.III)', () => {
        const state = ready([{ cardId: VISION, faceUp: false }], {
            status: PlayerStatus.Chancellor
        })
        expect(() => play('p1', VISION, SearchPlay.RevealedVision).apply(state)).toThrow(
            /cannot play a Vision faceup/
        )
    })

    it('offers every facedown adviser and no faceup one', () => {
        const state = ready([
            { cardId: HEARTH, faceUp: false },
            { cardId: 'denizen.hearth.two', faceUp: true },
            { cardId: VISION, faceUp: false }
        ])
        expect(HydratedPlayFacedownAdviser.legalCards(state, 'p1').sort()).toEqual(
            [HEARTH, VISION].sort()
        )
        expect(HydratedPlayFacedownAdviser.canDoPlayFacedownAdviser(state, 'p1')).toBe(true)
    })

    it("R-5.1.4.I — the People's Favor's holder plays to a full site in their region after first discarding a card there", () => {
        const HEARTH_AT_C2 = 'denizen.hearth.wayside-inn'
        const full = Array.from({ length: FIXTURE_SITE_CAPACITY - 1 }, (_, i) => `denizen.order.filler-${i}`)
        const holding = (holder: string) =>
            ready([{ cardId: HEARTH, faceUp: false }], {}, {
                denizensBySite: { c1: [], c2: [HEARTH_AT_C2, ...full], p1: [] },
                banners: {
                    [Banner.PeoplesFavor]: { value: 1, mobSide: false, holderPlayerId: holder },
                    [Banner.DarkestSecret]: { value: 1 }
                }
            })
        const toC2 = { toSiteId: 'c2', discardFirstCardId: HEARTH_AT_C2 }

        const state = holding('p1')
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(state, 'p1', { cardId: HEARTH, play: SearchPlay.Site, toSiteId: 'c2' })).toMatch(/at its capacity/)
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(state, 'p1', { cardId: HEARTH, play: SearchPlay.Site, toSiteId: 'p1' })).toMatch(/only be played to your own site/)
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(holding('p2'), 'p1', { cardId: HEARTH, play: SearchPlay.Site, ...toC2 })).toMatch(/only be played to your own site/)

        play('p1', HEARTH, SearchPlay.Site, toC2).apply(state)
        expect(state.denizensBySite['c2']).toContain(HEARTH)
        expect(state.denizensBySite['c2']).not.toContain(HEARTH_AT_C2)
        expect(state.denizensBySite['c1']).toEqual([])
    })

    it('is not offered to a player with only faceup advisers', () => {
        const state = ready([{ cardId: HEARTH, faceUp: true }])
        expect(HydratedPlayFacedownAdviser.canDoPlayFacedownAdviser(state, 'p1')).toBe(false)
    })
})
