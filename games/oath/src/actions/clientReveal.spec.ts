import { describe, expect, it } from 'vitest'
import { PeekTargetKind, HydratedPeek } from '../actions/peek.js'
import { HydratedSearchResolve, SearchPlay } from '../actions/searchResolve.js'
import { HydratedPlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { HydratedTravel } from '../actions/travel.js'
import { testPlayer, testState, openTurn, testVaultWithRelics } from '../testing/fixture.js'
import { Peek } from './peek.js'
import { buildAction } from '../testing/actions.js'
import { PlayFacedownAdviser } from './playFacedownAdviser.js'
import { SearchResolve } from './searchResolve.js'
import { Travel } from './travel.js'
import { HydratedSearch, Search, SearchSource } from './search.js'

describe('a client-forged reveal on a re-peek', () => {
    const REAL = 'relic.cup'
    const FORGED = 'relic.grand-scepter'

    function board() {
        return testState(
            [
                testPlayer({
                    playerId: 'p1',
                    siteId: 'c1',
                    peekedRelicSlotIds: ['c1-relic-0'],
                    peekedRelics: { 'c1-relic-0': REAL }
                })
            ],
            {
                relicsBySite: { c1: [{ slotId: 'c1-relic-0' }] }
            }
        )
    }

    function forgedPeek() {
        const peek = buildAction(Peek, {
            playerId: 'p1',
            target: { kind: PeekTargetKind.SiteRelic, slotId: 'c1-relic-0' }
        })
        const forged = { ...peek, reveal: { relicCardId: FORGED } }
        return new HydratedPeek(forged)
    }

    it('a re-peek reads the player’s own record and ignores the client reveal', () => {
        const state = board()
        const action = forgedPeek()
        action.apply(state)

        expect(state.getPlayerState('p1').peekedRelics).toEqual({ 'c1-relic-0': REAL })
        expect(action.metadata?.relicCardId).toBe(REAL)
        // R-X.3 — a re-peek reads nothing from the vault, so it stays undoable.
        expect(action.revealsInfo).toBe(false)
    })

    it('a first peek records what the vault holds, whatever the client sent', () => {
        const state = testState([testPlayer({ playerId: 'p1', siteId: 'c1' })], {
            relicsBySite: { c1: [{ slotId: 'c1-relic-0' }] }
        })
        state.requireVault().relicFacedown['c1-relic-0'] = REAL
        const action = forgedPeek()
        action.apply(state)

        expect(action.metadata?.relicCardId).toBe(REAL)
        expect(state.getPlayerState('p1').peekedRelics).toEqual({ 'c1-relic-0': REAL })
        expect(action.revealsInfo).toBe(true)
    })
})

describe('a client-forged draw on a Search', () => {
    it('the hand and the record take the vault’s cards, never the submitted ones', () => {
        const REAL = ['denizen.beast.wolves', 'denizen.hearth.wayside-inn', 'denizen.nomad.tents']
        const state = testState([testPlayer({ playerId: 'p1', siteId: 'c1', supply: 7 })], {})
        openTurn(state, 'p1')
        state.requireVault().worldDeck = [...REAL, 'denizen.order.wrestlers']
        const search = buildAction(Search, {
            playerId: 'p1',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true
        })
        const forged = {
            ...search,
            draw: {
                drawnCardIds: ['relic.grand-scepter'],
                stoppedOnVision: false,
                worldDeckExhausted: true
            }
        }
        const action = new HydratedSearch(forged)
        action.apply(state)

        expect(state.getPlayerState('p1').handIds).toEqual(REAL)
        expect(action.metadata?.draw.drawnCardIds).toEqual(REAL)
        expect(state.worldDeckExhausted).toBe(false)
    })
})

describe('vault-writing actions set revealsInfo', () => {
    const ORDER = 'denizen.order.wrestlers'
    const BEAST = 'denizen.beast.rangers'
    const HEARTH = 'denizen.hearth.ballot-box'

    function appliedSearchResolve() {
        const state = testState(
            [testPlayer({ siteId: 'c1', handIds: [ORDER, BEAST, HEARTH] })],
            { denizensBySite: { c1: [] } }
        )
        const action = new HydratedSearchResolve(
            buildAction(SearchResolve, {
                playerId: 'p1',
                keptCardId: ORDER,
                discardOrder: [BEAST, HEARTH],
                play: SearchPlay.Discard
            })
        )
        const vault = testVaultWithRelics({})
        state.vault = vault
        action.apply(state)
        return { action, vault }
    }

    function appliedFacedownAdviserDiscard() {
        const state = testState(
            [
                testPlayer({
                    siteId: 'c1',
                    advisers: [{ cardId: BEAST, faceUp: false }]
                })
            ],
            { denizensBySite: { c1: [] } }
        )
        const action = new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, {
                playerId: 'p1',
                cardId: BEAST,
                play: SearchPlay.Discard
            })
        )
        const vault = testVaultWithRelics({})
        state.vault = vault
        action.apply(state)
        return { action, vault }
    }

    it('both actions apply cleanly and write the vault', () => {
        for (const { vault } of [appliedSearchResolve(), appliedFacedownAdviserDiscard()]) {
            expect(Object.values(vault.discardPiles).flat().length).toBeGreaterThan(0)
        }
    })

    it('SearchResolve sets revealsInfo — its discard is replayed INTO the vault', () => {
        // R-X.3(b) — undo never restores the vault, so an action that writes it is not undoable.
        const { action } = appliedSearchResolve()
        expect(action.revealsInfo).toBe(true)
    })

    it('PlayFacedownAdviser (discard branch) sets revealsInfo for the same reason', () => {
        const { action } = appliedFacedownAdviserDiscard()
        expect(action.revealsInfo).toBe(true)
    })
})

describe('R-X.3(c) — a card shown to everyone cannot be unseen', () => {
    it('a Search keeping its only card faceup, with nothing to discard, is an Undo barrier', () => {
        const ORDER = 'denizen.order.wrestlers'
        const state = testState([testPlayer({ siteId: 'c1', handIds: [ORDER] })], {
            denizensBySite: { c1: [] }
        })
        const action = new HydratedSearchResolve(
            buildAction(SearchResolve, {
                playerId: 'p1',
                keptCardId: ORDER,
                discardOrder: [],
                play: SearchPlay.Adviser,
                faceUp: true
            })
        )
        action.apply(state)
        expect(action.metadata?.discardedCardIds).toEqual([])
        expect(action.metadata?.playedCardId).toBe(ORDER)
        expect(action.revealsInfo).toBe(true)
    })
})

describe('a reveal of a card already public trusts no client input', () => {
    it('Travel drops a forged reveal on an already-faceup destination', () => {
        const state = testState(
            [testPlayer({ playerId: 'p1', siteId: 'c1', supply: 7 })],
            {}
        )
        openTurn(state, 'p1')
        const before = JSON.stringify(state.dehydrate().siteCards)

        // The fixture's c2 is faceup.
        const travel = buildAction(Travel, { playerId: 'p1', siteId: 'c2' })
        const forged = { ...travel, reveal: { siteCardId: 'h3', relicSlotIds: [] } }
        const action = new HydratedTravel(forged)
        action.apply(state)

        expect(JSON.stringify(state.dehydrate().siteCards)).toBe(before)
        expect(action.revealsInfo).toBe(false)
        expect(action.metadata?.revealedSiteCardId).toBeUndefined()
    })
})
