import { describe, expect, it } from 'vitest'
import { assertExists, Color, type GameAction, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from './searchResolve.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { FILLER, INN } from '../testing/cards.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Law 5.1.4.II: "If you are playing an adviser that would exceed your adviser limit, you must first discard an
// adviser." Land Warden: "You may play two cards you draw (instead of one) if you play at least one card to a site";
// its Q&A lets the second card be played as a facedown adviser. So the second card played as an adviser at the
// limit discards an adviser first, as the kept card does. The kept card plays first, so the second card's limit is
// counted after it. Law 7.4.3: "A modifier cannot be discarded during the major action it is modifying", so Land
// Warden itself is never the adviser discarded.

const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const LONGBOWS = 'denizen.order.longbows'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.EngineFixes25

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
const rhys: Visibility.Perspective = { kind: 'player', playerId: 'rhys' }

/**
 * Dana at the Plains (c1, capacity 3, empty) holds `advisers` faceup (limit 3) and has searched the world deck with
 * Land Warden declared, drawing the Wayside Inn, Longbows and Wrestlers.
 */
function table(revision: OathRevision, advisers: string[]): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2', favor: 2, secrets: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = [INN, LONGBOWS, FILLER]
    return s
}

const SEARCH = buildAction(Search, {
    playerId: 'dana',
    drawFrom: SearchSource.WorldDeck,
    revealsInfo: true,
    modifiers: [modifierUse(LAND_WARDEN)]
})

const AT_LIMIT = [LAND_WARDEN, WOLVES, RANGERS]

function searched(revision: OathRevision, advisers = AT_LIMIT): HydratedOathGameState {
    const s = table(revision, advisers)
    new HydratedSearch(SEARCH).apply(s)
    return s
}

/** The Inn kept to Dana's site; Longbows second as an adviser, discarding `discarded` first. */
function innThenLongbows({
    faceUp = true,
    discarded
}: { faceUp?: boolean; discarded?: string[] } = {}): SearchResolveChoice {
    return {
        keptCardId: INN,
        discardOrder: [FILLER],
        play: SearchPlay.Site,
        secondPlay: {
            cardId: LONGBOWS,
            play: SearchPlay.Adviser,
            faceUp,
            ...(discarded ? { discardedAdviserCardIds: discarded } : {})
        }
    }
}

const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    HydratedSearchResolve.reasonCannotResolve(s, 'dana', choice)

/** Dana's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

function resolve(s: HydratedOathGameState, choice: SearchResolveChoice): HydratedSearchResolve {
    const action = new HydratedSearchResolve(
        buildAction(SearchResolve, { playerId: 'dana', ...choice })
    )
    action.apply(s)
    return action
}

const IN_USE = `second card: ${LAND_WARDEN} is a modifier in use and cannot be discarded during the action it modifies`
const AT_THE_LIMIT = 'second card: already at the adviser limit of 3; one must be discarded first'

describe("Land Warden's second card played as an adviser at the adviser limit (from revision 31)", () => {
    for (const faceUp of [true, false]) {
        const way = faceUp ? 'faceup' : 'facedown'

        it(`Longbows second as a ${way} adviser over a discarded Wolves is accepted, on Dana's own view too`, () => {
            const s = searched(FIXED)
            const choice = innThenLongbows({ faceUp, discarded: [WOLVES] })
            expect(checkOf(s, choice)).toBeUndefined()
            expect(checkOf(ownView(s), choice)).toBeUndefined()
        })

        it(`${way}: the Inn goes to the Plains, then the Wolves are discarded and Longbows joins Dana's advisers`, () => {
            const s = searched(FIXED)
            const player = s.getPlayerState('dana')
            const favor = player.favor
            const action = resolve(s, innThenLongbows({ faceUp, discarded: [WOLVES] }))
            expect(s.denizensAt('c1')).toEqual([INN])
            expect(player.knownAdviserIds()).toEqual([LAND_WARDEN, RANGERS, LONGBOWS])
            expect(player.knownAdviser(LONGBOWS)?.faceUp).toBe(faceUp)
            // R-5.1.4.I — the Inn's favor; R-10.5 — the Wolves join the cards not kept in the pile.
            expect(player.favor).toBe(favor + 1)
            const meta = action.metadata
            assertExists(meta, 'The resolve records what it did')
            expect(meta.discardedCardIds).toEqual([FILLER, WOLVES])
            expect(meta.discardedCount).toBe(2)
            // The pile's top first: the Wolves go with the second card's play, after the cards not kept.
            expect(s.requireVault().discardPiles[meta.discardPileRegion]).toEqual([WOLVES, FILLER])
            expect(meta.playedCardId).toBe(INN)
            // R-9.4 — a facedown adviser is not shown.
            expect(meta.secondPlayedCardId).toBe(faceUp ? LONGBOWS : undefined)
            expect(s.searchModifiersInUse).toBeUndefined()
        })

        it(`${way}: Land Warden, the modifier in use, is refused as the adviser discarded (R-7.4.3)`, () => {
            const s = searched(FIXED)
            const choice = innThenLongbows({ faceUp, discarded: [LAND_WARDEN] })
            expect(checkOf(s, choice)).toBe(IN_USE)
            expect(checkOf(ownView(s), choice)).toBe(IN_USE)
        })

        it(`${way}: with no adviser discarded it is refused`, () => {
            const s = searched(FIXED)
            expect(checkOf(s, innThenLongbows({ faceUp }))).toBe(AT_THE_LIMIT)
        })
    }

    it('two advisers discarded for one over the limit are refused', () => {
        const s = searched(FIXED)
        expect(checkOf(s, innThenLongbows({ discarded: [WOLVES, RANGERS] }))).toBe(
            'second card: only 1 advisers are discarded to meet the limit'
        )
    })

    it('an adviser discarded below the limit is refused, and with none the play is accepted', () => {
        const s = searched(FIXED, [LAND_WARDEN, WOLVES])
        expect(checkOf(s, innThenLongbows({ discarded: [WOLVES] }))).toBe(
            'second card: cannot discard an adviser without being at the limit'
        )
        expect(checkOf(s, innThenLongbows())).toBeUndefined()
    })

    it('a card that is not one of your advisers is refused as the discard', () => {
        const s = searched(FIXED)
        expect(checkOf(s, innThenLongbows({ discarded: [INN] }))).toBe(
            `second card: ${INN} is not one of your other advisers`
        )
    })

    it('control: the kept card as an adviser at the limit discards one, with the Inn second to your site', () => {
        const s = searched(FIXED)
        expect(
            checkOf(s, {
                keptCardId: LONGBOWS,
                discardOrder: [FILLER],
                play: SearchPlay.Adviser,
                faceUp: true,
                discardedAdviserCardIds: [WOLVES],
                secondPlay: { cardId: INN, play: SearchPlay.Site }
            })
        ).toBeUndefined()
    })

    it('control: both cards as advisers stays refused, whatever is discarded', () => {
        const s = searched(FIXED)
        expect(
            checkOf(s, {
                keptCardId: INN,
                discardOrder: [FILLER],
                play: SearchPlay.Adviser,
                faceUp: false,
                discardedAdviserCardIds: [WOLVES],
                secondPlay: {
                    cardId: LONGBOWS,
                    play: SearchPlay.Adviser,
                    faceUp: false,
                    discardedAdviserCardIds: [RANGERS]
                }
            })
        ).toBe('Land Warden: at least one of the two cards must be played to a site')
    })
})

describe('through the engine, and what the other seats are told', () => {
    function run(faceUp: boolean) {
        const game = testGame(['dana', 'rhys', 'chancellor'])
        let state: OathProjectedState = table(FIXED, AT_LIMIT).dehydrate()
        state = engine.runNext(SEARCH, state, game).updatedState
        const resolveAction: GameAction = buildAction(SearchResolve, {
            playerId: 'dana',
            ...innThenLongbows({ faceUp, discarded: [WOLVES] })
        })
        const result = engine.runNext(resolveAction, state, game)
        const recorded = result.processedActions.find(
            (a) => a.type === resolveAction.type && a.playerId === 'dana'
        )
        assertExists(recorded, 'The engine records the resolve')
        return { after: new HydratedOathGameState(result.updatedState), recorded }
    }

    it('Land Warden as the discard is refused by the engine', () => {
        const game = testGame(['dana', 'rhys', 'chancellor'])
        let state: OathProjectedState = table(FIXED, AT_LIMIT).dehydrate()
        state = engine.runNext(SEARCH, state, game).updatedState
        const action = buildAction(SearchResolve, {
            playerId: 'dana',
            ...innThenLongbows({ discarded: [LAND_WARDEN] })
        })
        expect(() => engine.runNext(action, state, game)).toThrow(IN_USE)
    })

    it('faceup: the record shows both plays; the cards that went to the pile are Dana’s alone', () => {
        const { after, recorded } = run(true)
        expect(after.getPlayerState('dana').knownAdviserIds()).toEqual([
            LAND_WARDEN,
            RANGERS,
            LONGBOWS
        ])
        expect(recorded).toHaveProperty('metadata.playedCardId', INN)
        expect(recorded).toHaveProperty('metadata.secondPlayedCardId', LONGBOWS)
        expect(recorded).toHaveProperty('metadata.discardedCardIds', [FILLER, WOLVES])
        const theirs = OathVisibility.actions.project(recorded, rhys)
        expect(theirs).toHaveProperty('metadata.playedCardId', INN)
        expect(theirs).toHaveProperty('metadata.secondPlayedCardId', LONGBOWS)
        expect(theirs).toHaveProperty('metadata.discardedCount', 2)
        expect(theirs).not.toHaveProperty('metadata.discardedCardIds')
        expect(theirs).not.toHaveProperty('secondPlay.discardedAdviserCardIds')
    })

    it('facedown: the other seats are never told which card Longbows is', () => {
        const { after, recorded } = run(false)
        expect(after.getPlayerState('dana').knownAdviser(LONGBOWS)?.faceUp).toBe(false)
        expect(recorded).toHaveProperty('secondPlay.cardId', LONGBOWS)
        expect(recorded).toHaveProperty('secondPlay.discardedAdviserCardIds', [WOLVES])
        expect(JSON.stringify(recorded)).not.toContain('secondPlayedCardId')
        const theirs = OathVisibility.actions.project(recorded, rhys)
        expect(theirs).toHaveProperty('metadata.discardedCount', 2)
        expect(JSON.stringify(theirs)).not.toContain(LONGBOWS)
        expect(JSON.stringify(served(after, rhys))).not.toContain(LONGBOWS)
    })
})

describe('before revision 31 a game keeps the check it was recorded with', () => {
    for (const faceUp of [true, false]) {
        const way = faceUp ? 'faceup' : 'facedown'

        it(`${way}: the second card at the limit is refused, with a discard or without`, () => {
            const s = searched(BEFORE)
            expect(checkOf(s, innThenLongbows({ faceUp }))).toBe(AT_THE_LIMIT)
            expect(checkOf(s, innThenLongbows({ faceUp, discarded: [WOLVES] }))).toBe(
                'second card: an adviser is discarded for it only in a game created from revision 31'
            )
        })
    }

    it('below the limit the second card is played as an adviser, as it was', () => {
        const s = searched(BEFORE, [LAND_WARDEN, WOLVES])
        expect(checkOf(s, innThenLongbows())).toBeUndefined()
        resolve(s, innThenLongbows())
        expect(s.getPlayerState('dana').knownAdviserIds()).toEqual([LAND_WARDEN, WOLVES, LONGBOWS])
    })
})
