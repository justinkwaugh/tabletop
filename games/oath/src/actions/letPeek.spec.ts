import { describe, expect, it } from 'vitest'
import { buildAction } from '../testing/actions.js'
import { HydratedLetPeek, LetPeek, LetPeekSubjectKind } from './letPeek.js'
import { testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { Color, isOutOfTurnDeclaration, proveCommutation, type GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { openTurn } from '../testing/fixture.js'
import type { OathProjectedState } from '../model/gameState.js'
import { ForgoFreeAction } from './forgoFreeAction.js'
import { OathRuntime } from '../definition/runtime.js'
import { Campaign } from './campaign.js'
import { CampaignSacrifice } from './campaignSacrifice.js'
import { CampaignResolveVictory } from './campaignResolveVictory.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { withChancellor } from '../testing/fixture.js'

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

/** ADR 0009 — a peek has an immediate consequence later actions can depend on, so it is sequenced. */
describe('A let-peek is ordered and undone like any other player action', () => {
    const game = testGame(['p1', 'p2', 'p3'])

    function table(): OathProjectedState {
        const state = testState(
            [
                testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1', status: PlayerStatus.Chancellor, freeTravelAtAction: 0 }),
                testPlayer({ playerId: 'p2', color: Color.Blue, siteId: 'c2', advisers: [{ cardId: TUTOR, faceUp: false }] }),
                testPlayer({ playerId: 'p3', color: Color.Yellow, siteId: 'c2' })
            ],
            { chancellorPlayerId: 'p1', machineState: MachineState.ActPhase }
        )
        openTurn(state, 'p1')
        state.activePlayerIds = ['p1']
        state.vault = testVaultWithRelics({})
        return state.dehydrate()
    }

    function peekAt(index: number): LetPeek {
        return buildAction(LetPeek, { id: 'peek', playerId: 'p2', toPlayerId: 'p3', subject: adviser(TUTOR), index })
    }

    function afterForgo() {
        return engine.executeCanonicalAction({
            action: buildAction(ForgoFreeAction, { id: 'forgo', playerId: 'p1', index: 0 }),
            state: table(),
            game
        })
    }

    it('declares itself sequenced, so it is never an out-of-turn declaration', () => {
        const peek = peekAt(0)
        expect(peek.sequenced).toBe(true)
        expect(isOutOfTurnDeclaration(peek)).toBe(false)
    })

    it('is refused from a stale index, and no commutation proof admits it, because it reveals a card', () => {
        const raced = afterForgo()
        expect(() =>
            engine.executeCanonicalAction({ action: peekAt(0), state: raced.updatedState, game })
        ).toThrow('Action index is not valid, expected 1, got 0')
        expect(
            proveCommutation({
                engine,
                apiActions: OathRuntime.apiActions,
                game,
                state: raced.updatedState,
                raced: raced.processedActions,
                late: peekAt(0)
            })
        ).toEqual({ kind: 'invalid', reason: 'an involved Action reveals information' })
    })

    it('is accepted when resubmitted at the current index', () => {
        const raced = afterForgo()
        const after = engine.executeCanonicalAction({ action: peekAt(1), state: raced.updatedState, game })
        expect(after.processedActions.map((action) => action.type)).toEqual([ActionType.LetPeek])
        expect(after.updatedState.players[1].advisers[0]).toEqual({ faceUp: false, shownCardId: TUTOR, shownTo: ['p3'] })
    })
})

/** R-6.6.1, R-6.4 — the Scepter's holder shows the Reliquary, then loses the Scepter in a Campaign. */
describe('An undo across a let-peek rewinds it, the Grand Scepter changing hands included', () => {
    const ATTACKER = 'p1'
    const HOLDER = 'p2'
    const EXILE = 'p3'
    const game = testGame([ATTACKER, HOLDER, EXILE])

    function table(seed: number): OathProjectedState {
        const state = testState(
            withChancellor([
                testPlayer({ playerId: ATTACKER, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 7, warbandsOnBoard: { [Color.Red]: 8 }, warbandsInPersonalBank: { [Color.Red]: 4 } }),
                testPlayer({ playerId: HOLDER, color: Color.Yellow, status: PlayerStatus.Exile, siteId: 'c1', warbandsInPersonalBank: { [Color.Yellow]: 13 }, relicIds: [GRAND_SCEPTER_ID] }),
                testPlayer({ playerId: EXILE, color: Color.Blue, status: PlayerStatus.Exile, siteId: 'c2' })
            ]),
            {
                machineState: MachineState.ActPhase,
                reliquary: [{ slotId: 'rel-1' }],
                prng: { seed, invocations: 0 }
            }
        )
        openTurn(state, ATTACKER)
        state.activePlayerIds = [ATTACKER]
        state.vault = testVaultWithRelics({})
        state.vault.relicFacedown['rel-1'] = RELIC
        return state.dehydrate()
    }

    const campaign = buildAction(Campaign, {
        playerId: ATTACKER,
        defender: { kind: 'player', playerId: HOLDER },
        targets: [{ kind: CampaignTargetKind.Relic, cardId: GRAND_SCEPTER_ID }],
        attackDice: 8
    })

    function play(seed: number) {
        const start = table(seed)
        const processed: GameAction[] = []
        let state = start
        for (const action of [
            buildAction(LetPeek, { playerId: HOLDER, toPlayerId: EXILE, subject: reliquary('rel-1') }),
            campaign,
            buildAction(CampaignSacrifice, { playerId: ATTACKER, sacrifice: 0, defeatKills: [] }),
            buildAction(CampaignResolveVictory, { playerId: ATTACKER, placements: [], burnFavor: false })
        ]) {
            const result = engine.runNext(action, state, game)
            processed.push(...result.processedActions)
            state = result.updatedState
        }
        return { start, processed, end: state }
    }

    function seedWhereSwordsAlreadyWin(): number {
        for (let seed = 1; seed < 5000; seed++) {
            const peeked = engine.runNext(buildAction(LetPeek, { playerId: HOLDER, toPlayerId: EXILE, subject: reliquary('rel-1') }), table(seed), game)
            const rolled = engine.runNext(campaign, peeked.updatedState, game).updatedState.campaign
            if (rolled && rolled.swords > rolled.defense) return seed
        }
        throw Error('no seed found where the attack wins outright')
    }

    it('restores the peek, the Scepter and every other field exactly', () => {
        const { start, processed, end } = play(seedWhereSwordsAlreadyWin())
        expect(end.players[0].relicIds).toEqual([GRAND_SCEPTER_ID])
        expect(end.players[1].relicIds).toEqual([])
        expect(end.players[2].peekedRelicSlotIds).toEqual(['rel-1'])
        const peek = processed.find((action) => action.type === ActionType.LetPeek)
        expect(peek?.revealsInfo).toBe(true)
        expect(peek?.sequenced).toBe(true)

        let rewound = end
        for (const action of processed.toReversed()) {
            rewound = engine.undoProcessedAction({ action, state: rewound })
        }
        expect(rewound).toEqual(start)
    })
})

