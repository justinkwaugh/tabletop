import { describe, expect, it } from 'vitest'
import { ActionSource, GameStatus, GameStorage, Visibility, assert, getPrng, latestPlayerUndoTarget, type Game, type GameAction } from '@tabletop/common'
import { AnswerQuestion, HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import { SearchPlay } from '../actions/searchResolve.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { OathVisibility } from '../definition/runtime.js'
import { OathGameStateValidator, type OathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { createOathVault } from '../model/vault.js'
import { buildAction } from '../testing/actions.js'
import { FILLER, INN } from '../testing/cards.js'
import { actionPowerUse } from '../testing/choices.js'
import { engine } from '../testing/engine.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { playDrawnCard } from '../testing/steps.js'
import { rulerTable } from '../testing/tables.js'
import { OathRevision } from '../util/revision.js'
import './index.js'

/**
 * R-X.3(c) — Undo stops at an action that showed a player a card they had not seen. Family Heirloom
 * and Dowsing Sticks draw a relic only their player sees; keeping it puts it among that player's
 * relics, where the table sees it. From revision 17 the keep reveals, unless every other player
 * already knew the relic (it came off the known bottom of the relic deck). R-X.4: before, it did not.
 */
const NOW = OathRevision.EngineFixes13
const BEFORE = OathRevision.EngineFixes12

const FAMILY_HEIRLOOM = 'denizen.hearth.family-heirloom'
const DOWSING_STICKS = 'relic.dowsing-sticks'
const CUP = 'relic.cup-of-plenty'
const WOLVES = 'denizen.beast.wolves'

const keep = (playerId = 'ruler', kept = true) =>
    new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId, answer: { kind: PowerQuestionKind.KeepOrBottomRelic, keep: kept } }))

/** Who knew the relic before it was drawn: the whole table, or these players. */
type Knew = 'everyone' | string[]

function table(revision: number, knew: Knew = []) {
    const s = rulerTable([], [], {}, { denizensBySite: { c1: [], c2: [INN], p1: [WOLVES], h1: [] }, oathRevision: revision })
    s.requireVault().relicDeck = [CUP]
    if (knew === 'everyone') s.seenRelicDeckBottom = [CUP]
    else for (const playerId of knew) s.getPlayerState(playerId).knownRelicDeckBottom = [CUP]
    return s
}

/** The drawn relic waits on its player's answer: Family Heirloom played, or Dowsing Sticks used. */
function drawn(source: string, revision: number, knew: Knew = []) {
    const s = table(revision, knew)
    if (source === FAMILY_HEIRLOOM) playDrawnCard(s, FAMILY_HEIRLOOM, SearchPlay.Adviser)
    else {
        s.getPlayerState('ruler').relicIds = [DOWSING_STICKS]
        actionPowerUse('ruler', DOWSING_STICKS).apply(s)
    }
    expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.KeepOrBottomRelic, cardId: source, askedPlayerId: 'ruler', relicCardId: CUP })
    return s
}

describe('R-X.3(c) — keeping a drawn relic shows it to the table, so Undo stops there', () => {
    for (const source of [FAMILY_HEIRLOOM, DOWSING_STICKS]) {
        describe(source, () => {
            it('the keep reveals: the other players see the relic only once it is kept', () => {
                const s = drawn(source, NOW)
                for (const playerId of ['other', 'away']) expect(JSON.stringify(served(s, { kind: 'player', playerId }))).not.toContain(CUP)
                const kept = keep()
                kept.apply(s)
                expect(s.getPlayerState('ruler').relicIds).toContain(CUP)
                for (const playerId of ['other', 'away']) {
                    expect(JSON.stringify(served(s, { kind: 'player', playerId }))).toContain(CUP)
                    expect(JSON.stringify(OathVisibility.actions.project(kept.dehydrate(), { kind: 'player', playerId }))).toContain(CUP)
                }
                expect(kept.revealsInfo).toBe(true)
            })

            it('a relic the whole table knew from the bottom of the relic deck: the keep reveals nothing', () => {
                const s = drawn(source, NOW, 'everyone')
                expect(s.pendingQuestions?.queue[0]).toMatchObject({ seenBy: ['everyone'] })
                const kept = keep()
                kept.apply(s)
                expect(kept.revealsInfo).toBe(false)
            })

            it('a relic every other player knew: the keep reveals nothing; known to some of them, it reveals', () => {
                const all = drawn(source, NOW, ['other', 'away'])
                const keptByAll = keep()
                keptByAll.apply(all)
                expect(keptByAll.revealsInfo).toBe(false)

                const some = drawn(source, NOW, ['other'])
                expect(some.pendingQuestions?.queue[0]).toMatchObject({ seenBy: ['other'] })
                const keptBySome = keep()
                keptBySome.apply(some)
                expect(keptBySome.revealsInfo).toBe(true)
            })

            it('sending it to the bottom reveals, at either revision, as before', () => {
                for (const revision of [NOW, BEFORE]) {
                    const s = drawn(source, revision)
                    const bottom = keep('ruler', false)
                    bottom.apply(s)
                    expect(bottom.metadata?.relicToDeckBottom).toBe(CUP)
                    expect(bottom.revealsInfo, `revision ${revision}`).toBe(true)
                }
            })

            it('in a game created before revision 17 the keep does not reveal, as recorded', () => {
                const s = drawn(source, BEFORE)
                const kept = keep()
                kept.apply(s)
                expect(s.getPlayerState('ruler').relicIds).toContain(CUP)
                expect(kept.revealsInfo).toBe(false)
            })
        })
    }
})

// ---- Through the engine: p1 plays Family Heirloom from a Search, then answers ----

const p1 = 'p1'

function buildGame(): Game {
    return { ...testGame([p1, 'p2', 'p3'], { status: GameStatus.WaitingToStart, hotseat: false, createdAt: new Date(0), storage: GameStorage.Remote }), status: GameStatus.Started, protectedInformation: true }
}

function canonical(state: unknown): OathGameState {
    assert(OathGameStateValidator.Check(state), 'Expected complete canonical state')
    return state
}

function searching(revision: number): OathGameState {
    const state = testState(
        [
            testPlayer({ playerId: p1, status: PlayerStatus.Chancellor, siteId: 'c1', favor: 3, handIds: [FAMILY_HEIRLOOM, FILLER] }),
            testPlayer({ playerId: 'p2', siteId: 'c1' }),
            testPlayer({ playerId: 'p3', siteId: 'h1' })
        ],
        {
            oathRevision: revision,
            machineState: MachineState.Searching,
            chancellorPlayerId: p1,
            vault: createOathVault({ relicDeck: [CUP] }, getPrng(1))
        }
    )
    openTurn(state, p1)
    return canonical(state.dehydrate())
}

function userAction(state: OathGameState, fields: { type: ActionType; playerId: string } & Record<string, unknown>): GameAction {
    return { id: `${fields.type}-${state.actionCount}`, gameId: 'game-1', source: ActionSource.User, index: state.actionCount, ...fields }
}

describe('R-X.3(c) — through the engine, Undo is not offered after the keep', () => {
    it('kept: the History names the relic and Undo stops; before revision 17 it was offered', () => {
        for (const [revision, offered] of [[NOW, false], [BEFORE, true]] as const) {
            const game = buildGame()
            const before = searching(revision)
            const played = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.SearchResolve, playerId: p1, keptCardId: FAMILY_HEIRLOOM, discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp: true }), state: before, game })
            const asked = canonical(played.updatedState)
            const answered = engine.executeCanonicalAction({ action: userAction(asked, { type: ActionType.AnswerQuestion, playerId: p1, answer: { kind: PowerQuestionKind.KeepOrBottomRelic, keep: true } }), state: asked, game })
            const answer = answered.processedActions[0]
            expect(JSON.stringify(OathVisibility.actions.project(answer, { kind: 'player', playerId: 'p2' }))).toContain(CUP)
            expect(answer.revealsInfo === true, `revision ${revision}`).toBe(!offered)
            const target = latestPlayerUndoTarget([...played.processedActions, ...answered.processedActions], p1)
            expect(target?.type, `revision ${revision}`).toBe(offered ? ActionType.AnswerQuestion : undefined)
        }
    })

    it("run on p1's own view, as the client runs it first, the answer reads other seats' hands and waits for the server, at either revision", () => {
        for (const revision of [NOW, BEFORE]) {
            const game = buildGame()
            const before = searching(revision)
            const played = engine.executeCanonicalAction({ action: userAction(before, { type: ActionType.SearchResolve, playerId: p1, keptCardId: FAMILY_HEIRLOOM, discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp: true }), state: before, game })
            const asked = canonical(played.updatedState)
            const action = userAction(asked, { type: ActionType.AnswerQuestion, playerId: p1, answer: { kind: PowerQuestionKind.KeepOrBottomRelic, keep: true } })
            const perspective = { kind: 'player', playerId: p1 } as const
            const view = OathVisibility.state.project(asked, perspective)
            expect(() => engine.executeAction({ action, state: view, game, perspective }), `revision ${revision}`).toThrow(Visibility.UnavailableProjectedValueError)
        }
    })
})
