import { describe, expect, it } from 'vitest'
import { buildAction } from '../testing/actions.js'
import { HydratedLetPeek, LetPeek, LetPeekSubjectKind } from './letPeek.js'
import { testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { Color } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { openTurn } from '../testing/fixture.js'
import type { OathProjectedState } from '../model/gameState.js'

const RELIC = 'relic.unnamed-1'
const TUTOR = 'denizen.arcane.tutor'
const WOLVES = 'denizen.beast.wolves'
const STORYTELLER = 'denizen.hearth.storyteller'

function board(options: { scepter?: boolean; p2Status?: PlayerStatus } = {}) {
    const state = testState(
        [
            testPlayer({
                playerId: 'p1',
                siteId: 'c1',
                status: PlayerStatus.Chancellor,
                relicIds: options.scepter === false ? [] : [GRAND_SCEPTER_ID],
                advisers: [
                    { cardId: TUTOR, faceUp: false },
                    { cardId: WOLVES, faceUp: true }
                ]
            }),
            testPlayer({ playerId: 'p2', siteId: 'c2', status: options.p2Status ?? PlayerStatus.Exile })
        ],
        { reliquary: [{ slotId: 'rel-1' }] }
    )
    state.vault = testVaultWithRelics({})
    state.vault.relicFacedown['rel-1'] = RELIC
    return state
}

function letPeek(subject: LetPeek['subject'], toPlayerId = 'p2') {
    return new HydratedLetPeek(buildAction(LetPeek, { playerId: 'p1', toPlayerId, subject }))
}

const adviser = (cardId: string) => ({ kind: LetPeekSubjectKind.Adviser as const, cardId })
const reliquary = (slotId: string) => ({ kind: LetPeekSubjectKind.Reliquary as const, slotId })

describe('Letting another player peek (R-6.1, R-9.4, R-6.6.1)', () => {
    it('lets any other player peek at your facedown adviser, and marks the action a barrier', () => {
        const state = board()
        const action = letPeek(adviser(TUTOR))
        action.apply(state)
        expect(action.revealsInfo).toBe(true)
        expect(action.metadata).toBeUndefined()
    })

    it('refuses a faceup adviser, a card that is not yours, and showing yourself', () => {
        const state = board()
        expect(() => letPeek(adviser(WOLVES)).apply(state)).toThrow('not your facedown adviser')
        expect(() => letPeek(adviser('denizen.hearth.storyteller')).apply(state)).toThrow(
            'not your facedown adviser'
        )
        expect(() => letPeek(adviser(TUTOR), 'p1').apply(state)).toThrow('without showing them')
    })

    it("records the Reliquary relic in the Exile's peeks, as their own look would", () => {
        const state = board()
        const action = letPeek(reliquary('rel-1'))
        action.apply(state)
        expect(action.metadata).toEqual({ relicCardId: RELIC })
        expect(state.getPlayerState('p2').peekedRelics).toEqual({ 'rel-1': RELIC })
        expect(state.getPlayerState('p2').peekedRelicSlotIds).toEqual(['rel-1'])
        expect(state.getPlayerState('p1').peekedRelics).toEqual({})
    })

    it('lets only the Scepter holder show the Reliquary, and only to an Exile', () => {
        expect(() => letPeek(reliquary('rel-1')).apply(board({ scepter: false }))).toThrow(
            'requires the Grand Scepter'
        )
        expect(() =>
            letPeek(reliquary('rel-1')).apply(board({ p2Status: PlayerStatus.Citizen }))
        ).toThrow('not an Exile')
        expect(() => letPeek(reliquary('rel-9')).apply(board())).toThrow('not an occupied space')
    })

    it('offers each facedown adviser to every other player and the Reliquary to Exiles', () => {
        expect(HydratedLetPeek.legalShows(board(), 'p1')).toEqual([
            { subject: adviser(TUTOR), toPlayerIds: ['p2'] },
            { subject: reliquary('rel-1'), toPlayerIds: ['p2'] }
        ])
        expect(HydratedLetPeek.legalShows(board({ p2Status: PlayerStatus.Citizen }), 'p1')).toEqual(
            [{ subject: adviser(TUTOR), toPlayerIds: ['p2'] }]
        )
    })
})

/** R-9.4 — "at any time": on another player's turn and mid-decision, never by the one being waited on. */
describe('Let another peek at any time', () => {
    const game = testGame(['p1', 'p2', 'p3'])

    function table(machine: Record<string, unknown> = {}, freeTravelAtAction?: number): OathProjectedState {
        const state = testState(
            [
                testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1', status: PlayerStatus.Chancellor, freeTravelAtAction, advisers: [{ cardId: STORYTELLER, faceUp: false }] }),
                testPlayer({ playerId: 'p2', color: Color.Blue, siteId: 'c2', advisers: [{ cardId: TUTOR, faceUp: false }] }),
                testPlayer({ playerId: 'p3', color: Color.Yellow, siteId: 'c2', advisers: [{ cardId: WOLVES, faceUp: false }] })
            ],
            { chancellorPlayerId: 'p1', machineState: MachineState.ActPhase, ...machine }
        )
        openTurn(state, 'p1')
        state.activePlayerIds = ['p1']
        return state.dehydrate()
    }

    function show(state: OathProjectedState, playerId: string, cardId: string, toPlayerId: string) {
        const action = buildAction(LetPeek, { playerId, toPlayerId, subject: adviser(cardId) })
        expect(action.outOfTurn).toBe(true)
        return engine.run(action, state, game).updatedState
    }

    it("is offered to a player off the clock and taken on another player's turn, moving no state and no clock", () => {
        const state = table()
        expect(engine.getValidActionTypesForPlayer(game, state, 'p2')).toEqual([ActionType.LetPeek])
        const after = show(state, 'p2', TUTOR, 'p3')
        expect(after.machineState).toBe(MachineState.ActPhase)
        expect(after.activePlayerIds).toEqual(['p1'])
        expect(after.turnManager.series).toEqual(state.turnManager.series)
    })

    it('is refused to the player the game is waiting on, and allowed to the others mid-decision', () => {
        const waiting = table({ machineState: MachineState.OathkeeperChoice, oathkeeperPlayerId: 'p2', pendingOathkeeperChoice: { holderPlayerId: 'p2', candidates: ['p1', 'p3'], resumeMachineState: MachineState.ActPhase } })
        waiting.activePlayerIds = ['p2']
        expect(engine.getValidActionTypesForPlayer(game, waiting, 'p2')).not.toContain(ActionType.LetPeek)
        expect(() => show(waiting, 'p2', TUTOR, 'p3')).toThrow()
        const after = show(waiting, 'p3', WOLVES, 'p1')
        expect(after.machineState).toBe(MachineState.OathkeeperChoice)
        expect(after.activePlayerIds).toEqual(['p2'])
    })

    it("spends no free action that is due, the turn player's own peek included", () => {
        const state = table({}, 0)
        const after = show(state, 'p1', STORYTELLER, 'p2')
        const turnPlayer = after.players.find((player) => player.playerId === 'p1')
        expect(turnPlayer?.freeTravelAtAction).toBe(after.actionCount)
    })

    it('what was shown is the card in that place: a flip, a discard, or a re-draw ends it', () => {
        const state = board()
        new HydratedLetPeek(letPeek(adviser(TUTOR))).apply(state)
        const p1 = state.getPlayerState('p1')
        expect(p1.knownAdviser(TUTOR)?.shownTo).toEqual(['p2'])
        p1.replaceAdviser(TUTOR, { cardId: TUTOR, faceUp: true })
        expect(p1.advisers[0]).toEqual({ cardId: TUTOR, faceUp: true })
        p1.replaceAdviser(TUTOR, { cardId: TUTOR, faceUp: false })
        expect(p1.advisers[0]).toEqual({ faceUp: false })
        new HydratedLetPeek(letPeek(adviser(TUTOR))).apply(state)
        p1.removeAdviser(TUTOR)
        p1.addAdviser(TUTOR, false)
        expect(p1.advisers.at(-1)).toEqual({ faceUp: false })
    })
})
