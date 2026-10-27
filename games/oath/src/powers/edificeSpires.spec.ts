import { describe, expect, it } from 'vitest'
import { HydratedSearch, Search, SearchSource } from '../actions/search.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedSearchSwap, SearchSwap } from '../actions/searchSwap.js'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { PowerTiming } from '../data/cardPowers.js'
import { kindOf } from '../data/cardRegistry.js'
import { ActionType } from '../definition/actions.js'
import { OathVisibility } from '../definition/runtime.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { Region } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { buildAction } from '../testing/actions.js'
import {
    DANA,
    GREAT_SPIRE,
    PLAINS_SLOT,
    RHYS,
    edificeTable,
    fillDispossessed
} from '../testing/edifices.js'
import { served, spectator } from '../testing/projection.js'
import { usableModifiers, type ModifierUse } from '../util/modifiers.js'
import { PowerChoiceKind } from '../util/powerChoice.js'
import { legalPowers, reasonCannotUsePower } from '../util/powerDoorway.js'
import './index.js'

const INTACT = 0
const RUINED = 1
const SPIRE_USE: ModifierUse = { cardId: GREAT_SPIRE, powerIndex: INTACT }
const HARP = 'relic.truthful-harp'
const HARP_USE: ModifierUse = { cardId: HARP, powerIndex: 0 }

const TENTS = 'denizen.nomad.tents'
const RANGERS = 'denizen.beast.rangers'
const ELDERS = 'denizen.nomad.elders'
const NAYSAYERS = 'denizen.discord.naysayers'
const BALLOT = 'denizen.hearth.ballot-box'
const WRESTLERS = 'denizen.order.wrestlers'
const AUGURY = 'denizen.arcane.augury'
const BRACKEN = 'denizen.beast.bracken'
const CONQUEST = 'vision.conquest'
const FAITH = 'vision.faith'

/** R-9.4 — a pile's fronts in the vault; its count and top back public. */
function setPile(s: HydratedOathGameState, region: Region, cardIds: string[]): void {
    s.requireVault().discardPiles[region] = [...cardIds]
    s.discardPileCounts[region] = cardIds.length
    const top = cardIds[0]
    const kind = top === undefined ? undefined : kindOf(top)
    s.discardTopBackType = kind ? { ...s.discardTopBackType, [region]: kind } : {}
}

/**
 * Dana, the Chancellor, at the Plains (the Cradle) with Great Spire, or Fallen Spire when `ruined`;
 * the Dispossessed holds `dispossessed`, and the world deck `deck`, top first.
 */
function spireTable({
    ruined = false,
    deck = [TENTS, RANGERS, ELDERS],
    dispossessed = [NAYSAYERS],
    over = {}
}: {
    ruined?: boolean
    deck?: string[]
    dispossessed?: string[]
    over?: Record<string, Record<string, unknown>>
} = {}): HydratedOathGameState {
    const s = edificeTable(over, {}, { plains: GREAT_SPIRE, ruined })
    s.requireVault().worldDeck = [...deck]
    s.worldDeckExhausted = deck.length === 0
    fillDispossessed(s, dispossessed)
    return s
}

function search(
    s: HydratedOathGameState,
    modifiers: ModifierUse[] = [SPIRE_USE],
    drawFrom = SearchSource.WorldDeck,
    playerId = DANA
): HydratedSearch {
    const action = new HydratedSearch(
        buildAction(Search, { playerId, drawFrom, revealsInfo: true, modifiers })
    )
    action.apply(s)
    return action
}

function swap(s: HydratedOathGameState, swappedCardIds: string[], playerId = DANA) {
    const action = new HydratedSearchSwap(
        buildAction(SearchSwap, { playerId, revealsInfo: true, swappedCardIds })
    )
    action.apply(s)
    return action
}

function hand(s: HydratedOathGameState, playerId = DANA): string[] {
    return s.getPlayerState(playerId).knownHand()
}

describe('Great Spire — "You may swap any number of denizens you draw with random cards from the Dispossessed"', () => {
    it('is declared on a Search with its cost, one secret placed on it, and opens the swap step', () => {
        const s = spireTable()
        expect(usableModifiers(s, DANA, ActionType.Search).map((p) => p.cardId)).toContain(
            GREAT_SPIRE
        )
        search(s)
        expect(s.getPlayerState(DANA).secrets).toBe(1)
        expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(1)
        expect(HydratedSearchSwap.canDoSearchSwap(s, DANA)).toBe(true)
        expect(HydratedSearchSwap.canDoSearchSwap(s, RHYS)).toBe(false)
    })

    it('no swap step without the declaration', () => {
        const s = spireTable()
        search(s, [])
        expect(HydratedSearchSwap.reasonSwapUnavailable(s, DANA)).toBe(
            'no Great Spire swap waits on this Search'
        )
        expect(() => swap(s, [RANGERS])).toThrow(/no Great Spire swap/)
    })

    it('swaps a drawn denizen with the one card of the Dispossessed, never the same card back (R-10.25)', () => {
        const s = spireTable()
        search(s)
        const action = swap(s, [RANGERS])
        expect(hand(s)).toEqual([TENTS, NAYSAYERS, ELDERS])
        expect(s.requireVault().dispossessed).toEqual([RANGERS])
        expect(s.dispossessedCount).toBe(1)
        expect(action.metadata).toEqual({
            count: 1,
            incomingCardIds: [NAYSAYERS],
            revealedSwappedCardIds: undefined
        })
        expect(action.revealsInfo).toBe(true)
    })

    it('takes the random cards before the swapped ones go in, for every card named', () => {
        const s = spireTable({ dispossessed: [NAYSAYERS, BALLOT] })
        search(s)
        swap(s, [TENTS, ELDERS])
        expect(hand(s).toSorted()).toEqual([BALLOT, NAYSAYERS, RANGERS].toSorted())
        expect(s.requireVault().dispossessed.toSorted()).toEqual([ELDERS, TENTS].toSorted())
    })

    it('is used once (R-7.4.2)', () => {
        const s = spireTable({ dispossessed: [NAYSAYERS, BALLOT] })
        search(s)
        swap(s, [TENTS])
        expect(s.pendingSearchModifiers).toBeUndefined()
        expect(HydratedSearchSwap.canDoSearchSwap(s, DANA)).toBe(false)
        expect(() => swap(s, [ELDERS])).toThrow(/no Great Spire swap/)
    })

    it('never swaps a Vision, and the draw still stops on it (R-5.1.2)', () => {
        const s = spireTable({ deck: [TENTS, CONQUEST, ELDERS] })
        search(s)
        expect(hand(s)).toEqual([TENTS, CONQUEST])
        expect(HydratedSearchSwap.reasonCannotSwap(s, DANA, [CONQUEST])).toBe(
            `${CONQUEST} is not a denizen, and only drawn denizens swap`
        )
    })

    it('is not offered when only a Vision was drawn', () => {
        const s = spireTable({ deck: [CONQUEST, TENTS] })
        search(s)
        expect(HydratedSearchSwap.reasonSwapUnavailable(s, DANA)).toBe('no drawn denizen to swap')
    })

    it('refuses more cards than the Dispossessed holds, a card not drawn, and a card named twice', () => {
        const s = spireTable()
        search(s)
        expect(HydratedSearchSwap.reasonCannotSwap(s, DANA, [TENTS, ELDERS])).toBe(
            'the Dispossessed holds only 1 cards to swap with'
        )
        expect(HydratedSearchSwap.reasonCannotSwap(s, DANA, [BALLOT])).toBe(
            `${BALLOT} was not drawn`
        )
        expect(HydratedSearchSwap.reasonCannotSwap(s, DANA, [TENTS, TENTS])).toBe(
            'a card is named twice'
        )
    })

    it('swaps from a discard pile Search too (its Q&A names both)', () => {
        const s = spireTable()
        setPile(s, Region.Cradle, [AUGURY, WRESTLERS, BRACKEN, BALLOT])
        search(s, [SPIRE_USE], SearchSource.Discard)
        expect(hand(s)).toEqual([AUGURY, WRESTLERS, BRACKEN])
        swap(s, [WRESTLERS])
        expect(hand(s)).toEqual([AUGURY, NAYSAYERS, BRACKEN])
        expect(s.discardPileCounts[Region.Cradle]).toBe(1)
    })

    it('the card that came in may be kept, and those not kept are discarded with the rest (R-5.1.3)', () => {
        const s = spireTable()
        search(s)
        swap(s, [RANGERS])
        const keep = new HydratedSearchResolve(
            buildAction(SearchResolve, {
                playerId: DANA,
                keptCardId: NAYSAYERS,
                discardOrder: [TENTS, ELDERS],
                play: SearchPlay.Adviser,
                faceUp: false
            })
        )
        keep.apply(s)
        expect(s.getPlayerState(DANA).knownAdviserIds()).toContain(NAYSAYERS)
        expect(s.requireVault().discardPiles[Region.Provinces].slice(0, 2).toSorted()).toEqual(
            [ELDERS, TENTS].toSorted()
        )
    })

    it('an incoming card not kept goes down with the discards', () => {
        const s = spireTable()
        search(s)
        swap(s, [RANGERS])
        new HydratedSearchResolve(
            buildAction(SearchResolve, {
                playerId: DANA,
                keptCardId: TENTS,
                discardOrder: [NAYSAYERS, ELDERS],
                play: SearchPlay.Adviser,
                faceUp: false
            })
        ).apply(s)
        expect(s.requireVault().discardPiles[Region.Provinces].slice(0, 2).toSorted()).toEqual(
            [ELDERS, NAYSAYERS].toSorted()
        )
    })

    it('shows the incoming cards to the searcher alone: every other seat sees only how many swapped', () => {
        const s = spireTable()
        search(s)
        const action = swap(s, [RANGERS])
        const rhys = served(s, { kind: 'player', playerId: RHYS })
        const seen = rhys.players.find((p) => p.playerId === DANA)
        expect(seen?.handIds).toBeUndefined()
        expect(seen?.handCount).toBe(3)
        expect(seen?.handSeen).toEqual([])
        const record = OathVisibility.actions.project(action.dehydrate(), spectator)
        expect(record).toHaveProperty('metadata.count', 1)
        expect(record).not.toHaveProperty('metadata.incomingCardIds')
        expect(record).not.toHaveProperty('swappedCardIds')
        const own = OathVisibility.actions.project(action.dehydrate(), {
            kind: 'player',
            playerId: DANA
        })
        expect(own).toHaveProperty('metadata.incomingCardIds', [NAYSAYERS])
        const danaView = served(s, { kind: 'player', playerId: DANA })
        expect(danaView.players.find((p) => p.playerId === DANA)?.handIds).toEqual([
            TENTS,
            NAYSAYERS,
            ELDERS
        ])
    })

    it('with Truthful Harp, the table still sees the drawn cards and the kept card, never an incoming card not kept (its Q&A)', () => {
        const s = spireTable({
            deck: [TENTS, RANGERS, ELDERS, WRESTLERS, AUGURY],
            dispossessed: [NAYSAYERS, BALLOT],
            over: { [DANA]: { relicIds: [HARP] } }
        })
        search(s, [SPIRE_USE, HARP_USE])
        expect(s.getPlayerState(DANA).handShown).toBe(true)
        const action = swap(s, [RANGERS, ELDERS])
        const dana = s.getPlayerState(DANA)
        expect(dana.handShown).toBeUndefined()
        expect(dana.handSeen).toEqual([TENTS, WRESTLERS, AUGURY])
        const incoming = action.metadata?.incomingCardIds ?? []
        expect(incoming.toSorted()).toEqual([BALLOT, NAYSAYERS].toSorted())
        const record = OathVisibility.actions.project(action.dehydrate(), spectator)
        expect(record).toHaveProperty('metadata.revealedSwappedCardIds', [RANGERS, ELDERS])
        expect(record).not.toHaveProperty('metadata.incomingCardIds')
        const table = served(s, spectator).players.find((p) => p.playerId === DANA)
        expect(table?.handIds).toBeUndefined()
        expect(table?.handSeen).toEqual([TENTS, WRESTLERS, AUGURY])

        // Keep one incoming card faceup: the kept card is shown, the other incoming card is not.
        const [kept, unkept] = incoming
        const keep = new HydratedSearchResolve(
            buildAction(SearchResolve, {
                playerId: DANA,
                keptCardId: kept,
                discardOrder: [TENTS, unkept, WRESTLERS, AUGURY],
                play: SearchPlay.Adviser,
                faceUp: false
            })
        )
        keep.apply(s)
        expect(keep.metadata?.revealedKeptCardId).toBe(kept)
        const seenPile = JSON.stringify(s.seenDiscardPiles[Region.Provinces])
        for (const drawn of [TENTS, WRESTLERS, AUGURY]) expect(seenPile).toContain(drawn)
        expect(seenPile).not.toContain(unkept)
    })

    it('with Truthful Harp and no swap, the table knows the discards as the cards it saw drawn', () => {
        const s = spireTable({
            deck: [TENTS, RANGERS, ELDERS, WRESTLERS, AUGURY],
            over: { [DANA]: { relicIds: [HARP] } }
        })
        search(s, [HARP_USE])
        new HydratedSearchResolve(
            buildAction(SearchResolve, {
                playerId: DANA,
                keptCardId: TENTS,
                discardOrder: [RANGERS, ELDERS, WRESTLERS, AUGURY],
                play: SearchPlay.Adviser,
                faceUp: false
            })
        ).apply(s)
        const seenPile = JSON.stringify(s.seenDiscardPiles[Region.Provinces])
        for (const drawn of [RANGERS, ELDERS, WRESTLERS, AUGURY]) expect(seenPile).toContain(drawn)
    })

    it('without Truthful Harp, no one else keeps what they knew of the hand once cards went unseen', () => {
        const s = spireTable()
        setPile(s, Region.Cradle, [AUGURY, WRESTLERS, BRACKEN])
        // The table saw these three go down, in this order (R-9.4).
        s.seenDiscardPiles[Region.Cradle] = [BRACKEN, WRESTLERS, AUGURY]
        search(s, [SPIRE_USE], SearchSource.Discard)
        expect(s.getPlayerState(DANA).handSeen).toEqual([BRACKEN, WRESTLERS, AUGURY])
        swap(s, [WRESTLERS])
        expect(s.getPlayerState(DANA).handSeen).toEqual([])
    })

    it('Fallen Spire is not a modifier: with the card ruined, Great Spire is not offered', () => {
        const s = spireTable({ ruined: true })
        expect(usableModifiers(s, DANA, ActionType.Search).map((p) => p.cardId)).not.toContain(
            GREAT_SPIRE
        )
        expect(() => search(s)).toThrow(/face down/)
    })

    it('at a site the bandits rule, a searcher whose pawn is there may use it (R-7.1.1)', () => {
        const s = spireTable()
        s.warbandsBySite = {}
        expect(usableModifiers(s, DANA, ActionType.Search).map((p) => p.cardId)).toContain(
            GREAT_SPIRE
        )
        search(s)
        swap(s, [RANGERS])
        expect(hand(s)).toEqual([TENTS, NAYSAYERS, ELDERS])
    })
})

/** Fallen Spire's use, with the count chosen. */
function fallenSpire(s: HydratedOathGameState, n: number, playerId = DANA) {
    return new HydratedUseActionPower(
        buildAction(UseActionPower, {
            playerId,
            cardId: GREAT_SPIRE,
            powerIndex: RUINED,
            choices: [{ kind: PowerChoiceKind.Count, n }]
        })
    )
}

describe('Fallen Spire — "Action: Swap up to five denizens from the top of your region\'s discard pile (skipping Visions) with random cards from the Dispossessed"', () => {
    function fallenTable(pile: string[], dispossessed: string[]) {
        const s = spireTable({ ruined: true, dispossessed })
        setPile(s, Region.Cradle, pile)
        return s
    }

    it('is offered with a count of 1 to 5, read from the public counts alone', () => {
        const s = fallenTable(
            [FAITH, AUGURY, WRESTLERS, BRACKEN, BALLOT, TENTS, ELDERS],
            [
                NAYSAYERS,
                RANGERS,
                'denizen.beast.wolves',
                'denizen.order.captains',
                'denizen.discord.gossip',
                'denizen.arcane.alchemist'
            ]
        )
        const use = legalPowers(s, DANA, PowerTiming.Action).find(
            (p) => p.cardId === GREAT_SPIRE && p.powerIndex === RUINED
        )
        expect(use?.choices[0].options).toEqual(
            [1, 2, 3, 4, 5].map((n) => ({ kind: PowerChoiceKind.Count, n }))
        )
        expect(
            reasonCannotUsePower(s, DANA, GREAT_SPIRE, RUINED, PowerTiming.Action, [
                { kind: PowerChoiceKind.Count, n: 6 }
            ])
        ).toBe('Fallen Spire: choose 1 to 5 denizens to swap')
        expect(
            reasonCannotUsePower(s, DANA, GREAT_SPIRE, RUINED, PowerTiming.Action, [
                { kind: PowerChoiceKind.Count, n: 0 }
            ])
        ).toBe('Fallen Spire: choose 1 to 5 denizens to swap')
    })

    it('caps the count at the pile and the Dispossessed, and offers none with either empty', () => {
        const short = fallenTable([AUGURY, WRESTLERS], [NAYSAYERS, RANGERS, BALLOT])
        const power = legalPowers(short, DANA, PowerTiming.Action).find(
            (p) => p.cardId === GREAT_SPIRE && p.powerIndex === RUINED
        )
        expect(power?.choices[0].options).toHaveLength(2)

        const noneOut = fallenTable([AUGURY], [])
        expect(
            reasonCannotUsePower(noneOut, DANA, GREAT_SPIRE, RUINED, PowerTiming.Action, [
                { kind: PowerChoiceKind.Count, n: 1 }
            ])
        ).toBe('1 is not among the options for denizens to swap')
        const noPile = fallenTable([], [NAYSAYERS])
        expect(
            reasonCannotUsePower(noPile, DANA, GREAT_SPIRE, RUINED, PowerTiming.Action, [
                { kind: PowerChoiceKind.Count, n: 1 }
            ])
        ).toBe('1 is not among the options for denizens to swap')
    })

    it('swaps each denizen in place, skipping Visions, which keep their places; costs a secret placed and one burned', () => {
        const s = fallenTable([FAITH, AUGURY, CONQUEST, WRESTLERS, BRACKEN], [NAYSAYERS, BALLOT])
        const action = fallenSpire(s, 2)
        action.apply(s)
        const pile = s.requireVault().discardPiles[Region.Cradle]
        expect(pile[0]).toBe(FAITH)
        expect(pile[2]).toBe(CONQUEST)
        expect([pile[1], pile[3]].toSorted()).toEqual([BALLOT, NAYSAYERS].toSorted())
        expect(pile[4]).toBe(BRACKEN)
        expect(s.requireVault().dispossessed.toSorted()).toEqual([AUGURY, WRESTLERS].toSorted())
        expect(s.discardPileCounts[Region.Cradle]).toBe(5)
        expect(s.dispossessedCount).toBe(2)
        expect(s.getPlayerState(DANA).secrets).toBe(0)
        expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(1)
        expect(action.metadata?.summary).toBe(
            'Fallen Spire: swapped 2 denizens on the cradle discard pile with cards from the Dispossessed'
        )
        expect(action.revealsInfo).toBe(true)
    })

    it('a one-card Dispossessed swaps, and the card never comes straight back', () => {
        const s = fallenTable([AUGURY], [NAYSAYERS])
        fallenSpire(s, 1).apply(s)
        expect(s.requireVault().discardPiles[Region.Cradle]).toEqual([NAYSAYERS])
        expect(s.requireVault().dispossessed).toEqual([AUGURY])
    })

    it('with fewer denizens in the pile, swaps as many as it can (R-7.1.3)', () => {
        const s = fallenTable([CONQUEST, AUGURY], [NAYSAYERS, BALLOT])
        const action = fallenSpire(s, 2)
        action.apply(s)
        expect(s.requireVault().discardPiles[Region.Cradle][0]).toBe(CONQUEST)
        expect(s.requireVault().dispossessed).toHaveLength(2)
        expect(action.metadata?.summary).toMatch(/^Fallen Spire: swapped 1 denizen on/)
    })

    it('nobody sees a card: each seat knows only how many swapped, and forgets what lay there', () => {
        const s = fallenTable([AUGURY, WRESTLERS, BRACKEN], [NAYSAYERS, BALLOT])
        // Positions from the bottom: everyone saw BRACKEN; Rhys alone knows WRESTLERS.
        s.seenDiscardPiles[Region.Cradle] = [
            BRACKEN,
            { back: kindOfDenizen() },
            { back: kindOfDenizen() }
        ]
        const rhys = s.getPlayerState(RHYS)
        rhys.knownDiscardPiles = {
            ...(rhys.knownDiscardPiles ?? { cradle: [], provinces: [], hinterland: [] }),
            [Region.Cradle]: [null, WRESTLERS]
        }
        const action = fallenSpire(s, 2)
        action.apply(s)
        // AUGURY and WRESTLERS swapped; BRACKEN, at the bottom, kept its place and what the table knew.
        expect(s.seenDiscardPiles[Region.Cradle]).toEqual([
            BRACKEN,
            { back: kindOfDenizen() },
            { back: kindOfDenizen() }
        ])
        expect(s.getPlayerState(RHYS).knownDiscardPiles?.[Region.Cradle]).toEqual([])
        for (const perspective of [
            spectator,
            { kind: 'player' as const, playerId: RHYS },
            { kind: 'player' as const, playerId: DANA }
        ]) {
            const record = JSON.stringify(
                OathVisibility.actions.project(action.dehydrate(), perspective)
            )
            for (const cardId of [NAYSAYERS, BALLOT, AUGURY, WRESTLERS])
                expect(record).not.toContain(cardId)
        }
    })

    it('the intact side has no Action: Fallen Spire is face down', () => {
        const s = spireTable({ dispossessed: [NAYSAYERS] })
        setPile(s, Region.Cradle, [AUGURY])
        expect(
            reasonCannotUsePower(s, DANA, GREAT_SPIRE, RUINED, PowerTiming.Action, [
                { kind: PowerChoiceKind.Count, n: 1 }
            ])
        ).toBe('Fallen Spire: that side of the card is face down')
    })

    it('at a site the bandits rule, a player whose pawn is there may use it (R-7.1.1)', () => {
        const s = fallenTable([AUGURY], [NAYSAYERS])
        s.warbandsBySite = {}
        s.getPlayerState(DANA).warbandsInPersonalBank = { [IMPERIAL_WARBANDS]: 10 }
        fallenSpire(s, 1).apply(s)
        expect(s.requireVault().discardPiles[Region.Cradle]).toEqual([NAYSAYERS])
    })

    it('the Plains is in the Cradle: the pawn names the pile (R-10.30)', () => {
        const s = fallenTable([AUGURY], [NAYSAYERS])
        setPile(s, Region.Provinces, [WRESTLERS])
        fallenSpire(s, 1).apply(s)
        expect(s.requireVault().discardPiles[Region.Provinces]).toEqual([WRESTLERS])
        expect(s.siteCardAt(PLAINS_SLOT)).toBe('site.plains')
    })
})

function kindOfDenizen() {
    const kind = kindOf(AUGURY)
    if (kind === undefined) throw Error('Augury is a registered card')
    return kind
}
