import { afterEach, describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    ActionType,
    MachineState,
    OathRevision,
    PlayerStatus,
    PowerChoiceKind,
    type HydratedOathGameState
} from '@tabletop/oath'
import { openTurn, required, testPlayer, testState } from '@tabletop/oath/testing'
import { emptyPicks } from './powerChoices.js'
import {
    bargainStepLine,
    bargainStepPlayers,
    bargainStepRows,
    bargainThenPlayers,
    shownBargainSteps,
    withBargainStep,
    withBargainStepCount,
    type BargainPick
} from './bargainPicks.js'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(() => disposeSessions())

const WITCHS_BARGAIN = 'denizen.arcane.witchs-bargain'
const SILENCE = 'denizen.arcane.vow-of-silence'
const DANA = 'dana'
const RHYS = 'rhys'
const ANN = 'ann'
const BARGAIN = { cardId: WITCHS_BARGAIN, powerIndex: 0 }

type Seat = { favor?: number; secrets?: number; siteId?: string; advisers?: string[] }

/**
 * Dana holds Witch's Bargain and 2 secrets (1 to give after the cost) and no favor; Rhys has 2 favor
 * and 1 secret; Ann, the Chancellor, 1 favor and 1 secret. All three pawns are at c1.
 */
function scene(
    v: { dana?: Seat; rhys?: Seat; ann?: Seat; revision?: OathRevision } = {}
): HydratedOathGameState {
    const seat = (id: string, color: Color, status: PlayerStatus, base: Seat, over: Seat = {}) =>
        testPlayer({
            playerId: id,
            color,
            status,
            siteId: over.siteId ?? 'c1',
            favor: over.favor ?? base.favor,
            secrets: over.secrets ?? base.secrets,
            supply: 6,
            advisers: (over.advisers ?? base.advisers ?? []).map((cardId) => ({
                cardId,
                faceUp: true
            }))
        })
    const state = testState(
        [
            seat(
                DANA,
                Color.Red,
                PlayerStatus.Exile,
                { favor: 0, secrets: 2 },
                {
                    ...v.dana,
                    advisers: [WITCHS_BARGAIN, ...(v.dana?.advisers ?? [])]
                }
            ),
            seat(RHYS, Color.Blue, PlayerStatus.Exile, { favor: 2, secrets: 1 }, v.rhys),
            seat(ANN, Color.Purple, PlayerStatus.Chancellor, { favor: 1, secrets: 1 }, v.ann)
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: ANN,
            denizensBySite: { c1: [], c2: [], h1: [] },
            siteCards: { c1: 'site.plains', c2: 'site.river', h1: 'site.wastes' },
            oathRevision: v.revision ?? OathRevision.EngineFixes27
        }
    )
    openTurn(state, DANA)
    state.activePlayerIds = [DANA]
    return state
}

async function bargaining(v: Parameters<typeof scene>[0] = {}) {
    const session = await openSessionOn(tableOf(scene(v)))
    session.chooseAction(ActionType.UseActionPower)
    const draft = session.actionPowers
    const power = required(
        draft.powers.find((p) => p.cardId === WITCHS_BARGAIN),
        "Witch's Bargain is offered"
    )
    const legal = power.choices[0]
    const picked = () => draft.picksOf(BARGAIN).bargain[0] ?? []
    const pick = (bargain: BargainPick[]) =>
        draft.setPicks(BARGAIN, { ...emptyPicks(), bargain: { 0: bargain } })
    const state = () => session.gameState
    const tapPlayer = (k: number, id: string) => pick(withBargainStep(legal, picked(), k, id))
    const tapCount = (term: 'secretsGiven' | 'pairsGiven', n: number) =>
        pick(withBargainStepCount(state(), DANA, legal, picked(), term, n))
    return { session, draft, power, legal, picked, pick, state, tapPlayer, tapCount }
}

const step = (playerId: string, secretsGiven: number, pairsGiven: number): BargainPick => ({
    playerId,
    secretsGiven,
    pairsGiven
})

describe("Witch's Bargain's steps, in order (revision 32)", () => {
    it('the example: Rhys’s step, then “Then:” offers Ann alone, whose pair Dana holds then; Use sends both in order', async () => {
        const { draft, power, legal, picked, state, tapPlayer, tapCount } = await bargaining()
        expect(legal.spec.inOrder).toBe(true)
        expect(bargainStepPlayers(state(), DANA, legal, picked(), 0)).toEqual([RHYS, ANN])
        tapPlayer(0, RHYS)
        // The 2nd secret is the cost's; no favor yet, so no pair until a secret is picked.
        expect(bargainStepRows(state(), DANA, picked())).toEqual({
            secrets: { held: 2, addable: 1, picked: 0 },
            pairs: { held: 0, addable: 0, picked: 0 }
        })
        // "Then:" waits for a count.
        expect(bargainThenPlayers(state(), DANA, legal, picked())).toEqual([])
        tapCount('secretsGiven', 1)
        // In the step, the pairs count the favor its own secrets take.
        expect(bargainStepRows(state(), DANA, picked())).toEqual({
            secrets: { held: 2, addable: 1, picked: 1 },
            pairs: { held: 2, addable: 1, picked: 0 }
        })
        // Never Rhys again at once.
        expect(bargainThenPlayers(state(), DANA, legal, picked())).toEqual([ANN])
        tapPlayer(1, ANN)
        expect(picked()).toEqual([step(RHYS, 1, 0), step(ANN, 0, 0)])
        expect(bargainStepPlayers(state(), DANA, legal, picked(), 1)).toEqual([ANN])
        // Ann's step: Dana holds no secret then (that row has no pieces), and the 2 favor Rhys gave.
        expect(bargainStepRows(state(), DANA, picked())).toEqual({
            secrets: { held: 0, addable: 0, picked: 0 },
            pairs: { held: 2, addable: 1, picked: 0 }
        })
        tapCount('pairsGiven', 1)
        // Nothing can be exchanged with Rhys now: no "Then:".
        expect(bargainThenPlayers(state(), DANA, legal, picked())).toEqual([])
        expect(draft.picksComplete(power)).toBe(true)
        expect(draft.choicesFor(power)).toEqual([
            { kind: PowerChoiceKind.Bargain, playerId: RHYS, secretsGiven: 1, pairsGiven: 0 },
            { kind: PowerChoiceKind.Bargain, playerId: ANN, secretsGiven: 0, pairsGiven: 1 }
        ])
        expect(draft.reasonCannotUse(power)).toBeUndefined()
    })

    it('the done line names the step’s exchanges with their tokens, in order', () => {
        expect(bargainStepLine(step(RHYS, 1, 0))).toBe('give 1 secret for 2 favor')
        expect(bargainStepLine(step(ANN, 0, 2))).toBe('give 4 favor for 2 secret')
        expect(bargainStepLine(step(RHYS, 1, 1))).toBe(
            'give 1 secret for 2 favor, then give 2 favor for 1 secret'
        )
    })

    it('a player comes again after another, read on what the steps above leave', async () => {
        const { legal, picked, state, tapPlayer, tapCount } = await bargaining({
            rhys: { favor: 4 }
        })
        tapPlayer(0, RHYS)
        tapCount('secretsGiven', 1)
        tapPlayer(1, ANN)
        tapCount('pairsGiven', 1)
        expect(bargainThenPlayers(state(), DANA, legal, picked())).toEqual([RHYS])
        tapPlayer(2, RHYS)
        expect(bargainStepRows(state(), DANA, picked())).toEqual({
            secrets: { held: 1, addable: 1, picked: 0 },
            pairs: { held: 0, addable: 0, picked: 0 }
        })
        tapCount('secretsGiven', 1)
        expect(picked()).toEqual([step(RHYS, 1, 0), step(ANN, 0, 1), step(RHYS, 1, 0)])
    })

    it('“Then:” leaves out anyone with nothing to exchange then, and is hidden with one player there', async () => {
        // Ann holds no secret and 1 favor: once Rhys is dealt with, Dana holds no secret to give them.
        const a = await bargaining({ ann: { secrets: 0 } })
        a.tapPlayer(0, RHYS)
        a.tapCount('secretsGiven', 1)
        expect(bargainThenPlayers(a.state(), DANA, a.legal, a.picked())).toEqual([])
        disposeSessions()
        const b = await bargaining({ ann: { siteId: 'c2' } })
        expect(shownBargainSteps(b.legal, b.picked())).toEqual([step(RHYS, 0, 0)])
        b.tapCount('secretsGiven', 1)
        expect(b.picked()).toEqual([step(RHYS, 1, 0)])
        expect(bargainThenPlayers(b.state(), DANA, b.legal, b.picked())).toEqual([])
        // The one player there is never dropped.
        b.tapPlayer(0, RHYS)
        expect(b.picked()).toEqual([step(RHYS, 1, 0)])
    })

    it('a tap on the open step’s chip drops it; another chip switches it, the steps after dropped; lowering the secrets lowers the pairs', async () => {
        const { picked, tapPlayer, tapCount } = await bargaining({ dana: { favor: 0, secrets: 3 } })
        tapPlayer(0, RHYS)
        tapCount('secretsGiven', 1)
        tapCount('pairsGiven', 1)
        expect(picked()).toEqual([step(RHYS, 1, 1)])
        // Without the secret Dana holds no favor for the pair.
        tapCount('secretsGiven', 1)
        expect(picked()).toEqual([step(RHYS, 0, 0)])
        tapCount('secretsGiven', 1)
        tapPlayer(1, ANN)
        tapPlayer(1, ANN)
        expect(picked()).toEqual([step(RHYS, 1, 0)])
        tapPlayer(0, ANN)
        expect(picked()).toEqual([step(ANN, 0, 0)])
        tapPlayer(0, ANN)
        expect(picked()).toEqual([])
    })

    it('Undo takes back one tap at a time', async () => {
        const { draft, picked, tapPlayer, tapCount } = await bargaining()
        tapPlayer(0, RHYS)
        tapCount('secretsGiven', 1)
        tapPlayer(1, ANN)
        tapCount('pairsGiven', 1)
        expect(draft.back()).toBe(true)
        expect(picked()).toEqual([step(RHYS, 1, 0), step(ANN, 0, 0)])
        expect(draft.back()).toBe(true)
        expect(picked()).toEqual([step(RHYS, 1, 0)])
        expect(draft.back()).toBe(true)
        expect(picked()).toEqual([step(RHYS, 0, 0)])
        expect(draft.back()).toBe(true)
        expect(picked()).toEqual([])
    })

    it('Vow of Silence draws no secrets row; the pairs are held to the favor held', async () => {
        const { legal, picked, state, tapPlayer, tapCount } = await bargaining({
            dana: { favor: 2, advisers: [SILENCE] }
        })
        tapPlayer(0, ANN)
        expect(bargainStepRows(state(), DANA, picked())).toEqual({
            pairs: { held: 2, addable: 1, picked: 0 }
        })
        tapCount('pairsGiven', 1)
        // Rhys holds a secret, but Dana's favor is spent and no secret may be given.
        expect(bargainThenPlayers(state(), DANA, legal, picked())).toEqual([])
    })

    it('below revision 32 the picks are per player, as before', async () => {
        const { legal } = await bargaining({ revision: OathRevision.EngineFixes26 })
        expect(legal.spec.inOrder).toBeUndefined()
        expect(legal.spec.max).toBe(5)
    })
})
