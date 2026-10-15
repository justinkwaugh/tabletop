import { describe, expect, it } from 'vitest'
import { HydratedSearch, Search, SearchSource } from '../actions/search.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import {
    HydratedPlayFacedownAdviser,
    PlayFacedownAdviser
} from '../actions/playFacedownAdviser.js'
import '../powers/index.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { buildAction } from '../testing/actions.js'
import { actionPowerUse, modifierUse, player } from '../testing/choices.js'
import { served } from '../testing/projection.js'
import { playDrawnCard } from '../testing/steps.js'
import { adviser, rulerTable } from '../testing/tables.js'
import { FILLER, INN, TENTS } from '../testing/cards.js'
import { adviserDiscardsNeeded, reasonCannotPlayCard } from './cardPlay.js'
import { advisersTowardLimit } from './continuous.js'
import { reasonExchangeInvalid } from './exchange.js'
import { currentQuestion } from './questions.js'
import { OathRevision } from './revision.js'

const PIPER = 'denizen.beast.pied-piper'
const WAGON = 'denizen.nomad.family-wagon'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const SCOUTS = 'denizen.order.scouts'
const ELDERS = 'denizen.nomad.elders'

/** 'ruler' holds `advisers` faceup; 'other' holds Tents; the game keeps the rules of `revision`. */
function table(
    advisers: string[],
    revision: OathRevision = OathRevision.EngineFixes7,
    over: Record<string, Record<string, unknown>> = {}
) {
    return rulerTable([], advisers, over, { oathRevision: revision })
}

/** The ruler's own view, as the table builds it from what the server sends. */
function ownView(s: HydratedOathGameState, playerId = 'ruler'): HydratedOathGameState {
    return new HydratedOathGameState(served(s, { kind: 'player', playerId }))
}

// Pied Piper: "This card ignores the adviser limit." Its Q&A: "it does not prompt a discard when you
// play it, but it still counts toward your total number of advisers."
describe('Pied Piper counts toward the adviser limit once held (revision 11)', () => {
    it('a holder of Pied Piper and two advisers counts three', () => {
        expect(advisersTowardLimit(table([PIPER, WOLVES, INN]), 'ruler')).toBe(3)
    })

    it('a Search play to the advisers must discard to keep a fourth (its Q&A)', () => {
        expect(() => playDrawnCard(table([PIPER, WOLVES, INN]), SCOUTS, SearchPlay.Adviser)).toThrow(
            /already at the adviser limit of 3/
        )
        const s = table([PIPER, WOLVES, INN])
        s.getPlayerState('ruler').handIds = [SCOUTS, FILLER]
        new HydratedSearchResolve(
            buildAction(SearchResolve, {
                playerId: 'ruler',
                keptCardId: SCOUTS,
                discardOrder: [FILLER],
                play: SearchPlay.Adviser,
                faceUp: true,
                discardedAdviserCardIds: [PIPER]
            })
        ).apply(s)
        expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([WOLVES, INN, SCOUTS])
    })

    it('a facedown play counts the same', () => {
        const s = table([PIPER, WOLVES, INN])
        expect(adviserDiscardsNeeded(s, 'ruler', SCOUTS, { faceUp: false })).toBe(1)
    })

    it('Pied Piper played over three advisers is kept with no discard (its own arrival)', () => {
        const s = table([WOLVES, INN, SCOUTS])
        expect(adviserDiscardsNeeded(s, 'ruler', PIPER, { faceUp: true })).toBe(0)
        playDrawnCard(s, PIPER, SearchPlay.Adviser)
        expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([WOLVES, INN, SCOUTS, PIPER])
        expect(advisersTowardLimit(s, 'ruler')).toBe(4)
    })

    it('Pied Piper played facedown has no power, so it counts and prompts the discard', () => {
        const s = table([WOLVES, INN, SCOUTS])
        expect(adviserDiscardsNeeded(s, 'ruler', PIPER, { faceUp: false })).toBe(1)
    })

    it('a facedown Pied Piper turned faceup is played, so it prompts no discard', () => {
        const s = table([], OathRevision.EngineFixes7, {
            ruler: { advisers: [adviser(WOLVES), adviser(INN), adviser(SCOUTS), adviser(PIPER, false)] }
        })
        expect(adviserDiscardsNeeded(s, 'ruler', PIPER, { faceUp: true, fromAdvisers: true })).toBe(0)
    })

    it('a facedown adviser turned faceup beside Pied Piper keeps the count it had', () => {
        const s = table([], OathRevision.EngineFixes7, {
            ruler: { advisers: [adviser(PIPER), adviser(WOLVES, false), adviser(INN)] }
        })
        expect(adviserDiscardsNeeded(s, 'ruler', WOLVES, { faceUp: true, fromAdvisers: true })).toBe(0)
        new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, { playerId: 'ruler', cardId: WOLVES, play: SearchPlay.Adviser })
        ).apply(s)
        expect([...s.getPlayerState('ruler').faceupAdviserIds()].sort()).toEqual([INN, PIPER, WOLVES].sort())
    })

    it("Pied Piper's Action moves it to a player with three advisers: no discard there, and their next adviser play discards down to the limit", () => {
        const s = table([PIPER], OathRevision.EngineFixes7, {
            other: { advisers: [adviser(TENTS), adviser(WOLVES), adviser(INN)] }
        })
        actionPowerUse('ruler', PIPER, [player('other')]).apply(s)
        expect(currentQuestion(s)).toBeUndefined()
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([TENTS, WOLVES, INN, PIPER])
        expect(advisersTowardLimit(s, 'other')).toBe(4)
        // Four held and one more played: two go to meet the limit of three (R-7.6.4).
        expect(adviserDiscardsNeeded(s, 'other', SCOUTS, { faceUp: true })).toBe(2)
        expect(() => playDrawnCard(s, SCOUTS, SearchPlay.Adviser, undefined, 'other')).toThrow(
            /2 advisers must be discarded first/
        )
    })

    it('Family Wagon played after Pied Piper keeps Pied Piper or one other non-Nomad (Family Wagon Q&A)', () => {
        const s = table([PIPER, WOLVES])
        expect(adviserDiscardsNeeded(s, 'ruler', WAGON, { faceUp: true })).toBe(1)
        for (const kept of [PIPER, WOLVES]) {
            const t = table([PIPER, WOLVES])
            const gone = kept === PIPER ? WOLVES : PIPER
            expect(
                reasonCannotPlayCard(t, 'ruler', WAGON, SearchPlay.Adviser, {
                    faceUp: true,
                    discardedAdviserCardIds: [gone]
                })
            ).toBeUndefined()
        }
    })

    it('Pied Piper may always be played after Family Wagon (Family Wagon Q&A)', () => {
        const s = table([WAGON, WOLVES, ELDERS])
        expect(adviserDiscardsNeeded(s, 'ruler', PIPER, { faceUp: true })).toBe(0)
        playDrawnCard(s, PIPER, SearchPlay.Adviser)
        // Held, it is a second non-Nomad: the next non-Nomad play discards down to one.
        expect(adviserDiscardsNeeded(s, 'ruler', SCOUTS, { faceUp: true })).toBe(2)
        // A Nomad still ignores the limit.
        expect(adviserDiscardsNeeded(s, 'ruler', 'denizen.nomad.a-fast-steed', { faceUp: true })).toBe(1)
    })

    it("Land Warden's second card to the advisers is refused over Pied Piper and two others, as over any three", () => {
        const s = table([LAND_WARDEN, PIPER, WOLVES])
        s.denizensBySite = { c1: [], c2: [], p1: [], h1: [] }
        s.requireVault().worldDeck = [INN, SCOUTS, FILLER]
        new HydratedSearch(
            buildAction(Search, {
                playerId: 'ruler',
                drawFrom: SearchSource.WorldDeck,
                revealsInfo: true,
                modifiers: [modifierUse(LAND_WARDEN)]
            })
        ).apply(s)
        const choice = {
            keptCardId: INN,
            discardOrder: [FILLER],
            play: SearchPlay.Site,
            secondPlay: { cardId: SCOUTS, play: SearchPlay.Adviser, faceUp: true }
        }
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'ruler', choice)).toMatch(/adviser limit/)
    })

    it('The Gathering: a holder of Pied Piper and two advisers cannot take a fourth (its Q&A)', () => {
        const s = table([SCOUTS], OathRevision.EngineFixes7, {
            other: { advisers: [adviser(PIPER), adviser(WOLVES), adviser(INN)] }
        })
        expect(reasonExchangeInvalid(s, 'ruler', 'other', { fromProposer: { adviserRows: [0] } })).toMatch(
            /cannot hold 1 more advisers/
        )
    })

    it('Pied Piper given in an exchange to a player with three advisers is not counted on its arrival', () => {
        const s = table([PIPER], OathRevision.EngineFixes7, {
            other: { advisers: [adviser(TENTS), adviser(WOLVES), adviser(INN)] }
        })
        expect(reasonExchangeInvalid(s, 'ruler', 'other', { fromProposer: { adviserRows: [0] } })).toBeUndefined()
    })

    it("the count and the discards needed read the same on the player's own view as on the server", () => {
        const scenes = [
            table([PIPER, WOLVES, INN]),
            table([WOLVES, INN, SCOUTS]),
            table([PIPER, WOLVES]),
            table([], OathRevision.EngineFixes7, {
                ruler: { advisers: [adviser(PIPER), adviser(WOLVES, false), adviser(INN)] }
            })
        ]
        for (const s of scenes) {
            const own = ownView(s)
            expect(advisersTowardLimit(own, 'ruler')).toBe(advisersTowardLimit(s, 'ruler'))
            for (const cardId of [SCOUTS, PIPER, WAGON]) {
                for (const faceUp of [true, false]) {
                    expect(adviserDiscardsNeeded(own, 'ruler', cardId, { faceUp })).toBe(
                        adviserDiscardsNeeded(s, 'ruler', cardId, { faceUp })
                    )
                }
            }
            // Another player's count reads only what is public.
            const theirs = ownView(s, 'other')
            expect(advisersTowardLimit(theirs, 'ruler')).toBe(advisersTowardLimit(s, 'ruler'))
        }
    })
})

// A fourth adviser kept over Pied Piper and two others before revision 11: `powers/cardAndPawnMoves.spec.ts`.
describe('before revision 11 a game keeps the count it was recorded with', () => {
    it('Family Wagon played after Pied Piper kept both', () => {
        expect(adviserDiscardsNeeded(table([PIPER, WOLVES], OathRevision.EngineFixes6), 'ruler', WAGON, { faceUp: true })).toBe(0)
    })

    it('The Gathering gave a holder of Pied Piper and two advisers a fourth', () => {
        const s = table([SCOUTS], OathRevision.EngineFixes6, {
            other: { advisers: [adviser(PIPER), adviser(WOLVES), adviser(INN)] }
        })
        expect(reasonExchangeInvalid(s, 'ruler', 'other', { fromProposer: { adviserRows: [0] } })).toBeUndefined()
    })
})
