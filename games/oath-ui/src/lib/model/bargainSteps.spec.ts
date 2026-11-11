import { afterEach, describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    ActionType,
    HydratedOathGameState,
    HydratedUseActionPower,
    MachineState,
    OathRevision,
    PlayerStatus,
    PowerChoiceKind,
    Suit
} from '@tabletop/oath'
import { openTurn, required, served, testPlayer, testState } from '@tabletop/oath/testing'
import { emptyPicks } from './powerChoices.js'
import { cardsWithListedPower, listedActionPowers } from './phaseDrafts.js'
import {
    bargainCountLabel,
    bargainRows,
    bargainStepLine,
    bargainStepPlayers,
    bargainStepRows,
    bargainThenPlayers,
    bargainWithPlayers,
    shownBargainPicks,
    shownBargainSteps,
    withBargainStep,
    withBargainStepCount,
    type BargainPick
} from './bargainPicks.js'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(() => disposeSessions())

const WITCHS_BARGAIN = 'denizen.arcane.witchs-bargain'
const SILENCE = 'denizen.arcane.vow-of-silence'
const KINSHIP = 'denizen.nomad.vow-of-kinship'
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
    v: { dana?: Seat; rhys?: Seat; ann?: Seat; revision?: OathRevision; nomadBank?: number } = {}
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
    if (v.nomadBank !== undefined) state.favorBank[Suit.Nomad] = v.nomadBank
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
    const tapPlayer = (k: number, id: string) =>
        pick(withBargainStep(state(), DANA, legal, picked(), k, id))
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
        // Ann's 1 favor buys no secret, and Dana holds no favor for a pair: Rhys alone, shown picked.
        expect(bargainStepPlayers(state(), DANA, legal, picked(), 0)).toEqual([RHYS])
        expect(shownBargainSteps(state(), DANA, legal, picked())).toEqual([step(RHYS, 0, 0)])
        // The 2nd secret is the cost's; no favor yet, so no pair until a secret is picked.
        expect(bargainStepRows(state(), DANA, [step(RHYS, 0, 0)])).toEqual({
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

    it('the done line names the step’s exchanges with their tokens, in order', async () => {
        const { state } = await bargaining({ dana: { secrets: 3 }, rhys: { favor: 4, secrets: 2 } })
        expect(bargainStepLine(state(), DANA, [step(RHYS, 1, 0)], 0)).toBe(
            'give 1 secret for 2 favor'
        )
        expect(bargainStepLine(state(), DANA, [step(RHYS, 2, 2)], 0)).toBe(
            'give 2 secret for 4 favor, then give 4 favor for 2 secret'
        )
        expect(bargainStepLine(state(), DANA, [step(RHYS, 1, 0), step(ANN, 0, 1)], 1)).toBe(
            'give 2 favor for 1 secret'
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
        expect(shownBargainSteps(b.state(), DANA, b.legal, b.picked())).toEqual([step(RHYS, 0, 0)])
        b.tapCount('secretsGiven', 1)
        expect(b.picked()).toEqual([step(RHYS, 1, 0)])
        expect(bargainThenPlayers(b.state(), DANA, b.legal, b.picked())).toEqual([])
        // The one player there is never dropped.
        b.tapPlayer(0, RHYS)
        expect(b.picked()).toEqual([step(RHYS, 1, 0)])
    })

    it('a tap on the open step’s chip drops it; another chip switches it, the steps after dropped; lowering the secrets lowers the pairs', async () => {
        // Ann's 2 favor buy a secret, so "With:" offers both.
        const { picked, tapPlayer, tapCount } = await bargaining({
            dana: { favor: 0, secrets: 3 },
            ann: { favor: 2 }
        })
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
        const { draft, picked, tapPlayer, tapCount } = await bargaining({ ann: { favor: 2 } })
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

describe("Witch's Bargain's steps from revision 33 — each takes as many as the other player holds", () => {
    const at33 = { revision: OathRevision.EngineFixes28 }

    it('a secret is offered to a player with 1 favor, and a pair to one with no secret; Use sends both', async () => {
        const { draft, power, legal, picked, state, tapPlayer, tapCount } = await bargaining({
            ...at33,
            dana: { favor: 2 },
            rhys: { favor: 1, secrets: 0 },
            ann: { favor: 0, secrets: 0 }
        })
        tapPlayer(0, RHYS)
        expect(bargainStepRows(state(), DANA, picked())).toEqual({
            secrets: { held: 2, addable: 1, picked: 0 },
            pairs: { held: 2, addable: 1, picked: 0 }
        })
        tapCount('secretsGiven', 1)
        // Rhys's 1 favor taken: 3 held, still 1 pair.
        expect(bargainStepRows(state(), DANA, picked())).toEqual({
            secrets: { held: 2, addable: 1, picked: 1 },
            pairs: { held: 3, addable: 1, picked: 0 }
        })
        // Ann, with nothing, can still be given a pair.
        expect(bargainThenPlayers(state(), DANA, legal, picked())).toEqual([ANN])
        tapPlayer(1, ANN)
        expect(bargainStepRows(state(), DANA, picked())).toEqual({
            secrets: { held: 0, addable: 0, picked: 0 },
            pairs: { held: 3, addable: 1, picked: 0 }
        })
        tapCount('pairsGiven', 1)
        expect(draft.choicesFor(power)).toEqual([
            { kind: PowerChoiceKind.Bargain, playerId: RHYS, secretsGiven: 1, pairsGiven: 0 },
            { kind: PowerChoiceKind.Bargain, playerId: ANN, secretsGiven: 0, pairsGiven: 1 }
        ])
        expect(draft.reasonCannotUse(power)).toBeUndefined()
    })

    it('at revision 32 the engine refuses both with the same seats, so Witch’s Bargain is not listed', () => {
        const state = scene({
            dana: { favor: 2 },
            rhys: { favor: 1, secrets: 0 },
            ann: { favor: 0, secrets: 0 }
        })
        const refused = (entry: BargainPick) =>
            HydratedUseActionPower.reasonCannotUse(state, DANA, WITCHS_BARGAIN, 0, [
                { kind: PowerChoiceKind.Bargain, ...entry }
            ])
        expect(refused(step(RHYS, 1, 0))).toMatch(/rhys has 1 favor, not the 2 you would take/)
        expect(refused(step(ANN, 0, 1))).toMatch(/ann has 0 secrets, not the 1 you would take/)
        expect(listedActionPowers(state, DANA).map((use) => use.cardId)).not.toContain(
            WITCHS_BARGAIN
        )
    })
})

/**
 * Dana holds 2 favor and 2 secrets (1 to give after the cost), Rhys 1 favor and no secret, Ann
 * nothing. The tap labels and the done line name what each step takes, as the engine counts it
 * after the steps above it, as History does.
 */
describe("Witch's Bargain's words from revision 33 — each names what its step takes", () => {
    const short = {
        revision: OathRevision.EngineFixes28,
        dana: { favor: 2 },
        rhys: { favor: 1, secrets: 0 },
        ann: { favor: 0, secrets: 0 }
    }
    const label = (
        s: HydratedOathGameState,
        steps: readonly BargainPick[],
        name: string,
        term: 'secretsGiven' | 'pairsGiven',
        n: number
    ) => bargainCountLabel(s, DANA, steps, name, term, n)

    it('Rhys first: 1 secret takes Rhys’s 1 favor, then 2 favor take none of Ann’s secrets; the done lines say so', async () => {
        const { draft, picked, state, tapPlayer, tapCount } = await bargaining(short)
        tapPlayer(0, RHYS)
        expect(label(state(), picked(), 'Rhys', 'secretsGiven', 1)).toBe(
            'give Rhys 1 secret for 1 favor'
        )
        // Before the secret, Rhys holds none for Dana's pair.
        expect(label(state(), picked(), 'Rhys', 'pairsGiven', 1)).toBe(
            'give Rhys 2 favor for 0 secrets'
        )
        tapCount('secretsGiven', 1)
        // The secret just given in this step is the one a pair takes back.
        expect(label(state(), picked(), 'Rhys', 'pairsGiven', 1)).toBe(
            'give Rhys 2 favor for 1 secret'
        )
        tapPlayer(1, ANN)
        expect(bargainStepLine(state(), DANA, picked(), 0)).toBe('give 1 secret for 1 favor')
        expect(label(state(), picked(), 'Ann', 'pairsGiven', 1)).toBe(
            'give Ann 2 favor for 0 secrets'
        )
        tapCount('pairsGiven', 1)
        expect(bargainStepLine(state(), DANA, picked(), 1)).toBe('give 2 favor for 0 secret')
        // Undo back to Rhys's open step: the words read on the steps then.
        expect(draft.back()).toBe(true)
        expect(draft.back()).toBe(true)
        expect(picked()).toEqual([step(RHYS, 1, 0)])
        expect(label(state(), picked(), 'Rhys', 'secretsGiven', 1)).toBe(
            'give Rhys 1 secret for 1 favor'
        )
    })

    it('Ann first: 2 favor take 0 secrets, then 1 secret takes Rhys’s 1 favor', async () => {
        const { picked, state, tapPlayer, tapCount } = await bargaining(short)
        tapPlayer(0, ANN)
        expect(label(state(), picked(), 'Ann', 'pairsGiven', 1)).toBe(
            'give Ann 2 favor for 0 secrets'
        )
        tapCount('pairsGiven', 1)
        tapPlayer(1, RHYS)
        expect(bargainStepLine(state(), DANA, picked(), 0)).toBe('give 2 favor for 0 secret')
        expect(label(state(), picked(), 'Rhys', 'secretsGiven', 1)).toBe(
            'give Rhys 1 secret for 1 favor'
        )
        tapCount('secretsGiven', 1)
        expect(bargainStepLine(state(), DANA, picked(), 1)).toBe('give 1 secret for 1 favor')
    })

    it('a later step with the same player reads what the earlier one left them', async () => {
        const { picked, state, tapPlayer, tapCount } = await bargaining({
            ...short,
            dana: { favor: 4, secrets: 3 }
        })
        tapPlayer(0, RHYS)
        tapCount('secretsGiven', 1)
        tapPlayer(1, ANN)
        tapCount('pairsGiven', 1)
        tapPlayer(2, RHYS)
        // Rhys's favor went in the first step; the secret given them then is there to take.
        expect(label(state(), picked(), 'Rhys', 'secretsGiven', 1)).toBe(
            'give Rhys 1 secret for 0 favor'
        )
        expect(label(state(), picked(), 'Rhys', 'pairsGiven', 1)).toBe(
            'give Rhys 2 favor for 1 secret'
        )
    })

    it('Vow of Kinship on Rhys: only the favor on their board is taken, none of the Nomad bank', async () => {
        const { picked, state, tapPlayer } = await bargaining({
            ...short,
            rhys: { favor: 1, secrets: 0, advisers: [KINSHIP] },
            nomadBank: 3
        })
        tapPlayer(0, RHYS)
        expect(label(state(), picked(), 'Rhys', 'secretsGiven', 1)).toBe(
            'give Rhys 1 secret for 1 favor'
        )
    })

    it('Vow of Kinship on Dana: the favor taken goes to the Nomad bank and pays the next step, which takes Ann’s none', async () => {
        const { picked, state, tapPlayer, tapCount } = await bargaining({
            ...short,
            dana: { favor: 0, advisers: [KINSHIP] },
            nomadBank: 1
        })
        tapPlayer(0, RHYS)
        expect(label(state(), picked(), 'Rhys', 'secretsGiven', 1)).toBe(
            'give Rhys 1 secret for 1 favor'
        )
        tapCount('secretsGiven', 1)
        tapPlayer(1, ANN)
        expect(bargainStepLine(state(), DANA, picked(), 0)).toBe('give 1 secret for 1 favor')
        expect(label(state(), picked(), 'Ann', 'pairsGiven', 1)).toBe(
            'give Ann 2 favor for 0 secrets'
        )
    })

    it('Vow of Silence: no secrets row, and the pair names the 0 it takes', async () => {
        const { picked, state, tapPlayer } = await bargaining({
            ...short,
            dana: { favor: 2, advisers: [SILENCE] }
        })
        tapPlayer(0, ANN)
        expect(bargainStepRows(state(), DANA, picked()).secrets).toBeUndefined()
        expect(label(state(), picked(), 'Ann', 'pairsGiven', 1)).toBe(
            'give Ann 2 favor for 0 secrets'
        )
    })

    it('the secret the cost places cannot be tapped, and its piece names the exchange asked, as before', async () => {
        const { picked, state, tapPlayer } = await bargaining(short)
        tapPlayer(0, RHYS)
        expect(bargainStepRows(state(), DANA, picked()).secrets?.addable).toBe(1)
        expect(label(state(), picked(), 'Rhys', 'secretsGiven', 2)).toBe(
            'give Rhys 2 secrets for 4 favor'
        )
    })

    it('on Dana’s own view the words are the same', async () => {
        const { picked, state, tapPlayer, tapCount } = await bargaining(short)
        const own = () =>
            new HydratedOathGameState(served(state(), { kind: 'player', playerId: DANA }))
        tapPlayer(0, RHYS)
        expect(label(own(), picked(), 'Rhys', 'secretsGiven', 1)).toBe(
            'give Rhys 1 secret for 1 favor'
        )
        tapCount('secretsGiven', 1)
        tapPlayer(1, ANN)
        expect(bargainStepLine(own(), DANA, picked(), 0)).toBe('give 1 secret for 1 favor')
        expect(label(own(), picked(), 'Ann', 'pairsGiven', 1)).toBe(
            'give Ann 2 favor for 0 secrets'
        )
    })

    it('when the other player holds enough the words read as before, at revision 33 and at 32', async () => {
        for (const revision of [OathRevision.EngineFixes28, OathRevision.EngineFixes27]) {
            // Ann's 2 favor buy a secret, so "With:" offers both at 32 too.
            const { picked, state, tapPlayer, tapCount } = await bargaining({
                revision,
                ann: { favor: 2 }
            })
            tapPlayer(0, RHYS)
            expect(label(state(), picked(), 'Rhys', 'secretsGiven', 1)).toBe(
                'give Rhys 1 secret for 2 favor'
            )
            tapCount('secretsGiven', 1)
            expect(label(state(), picked(), 'Rhys', 'pairsGiven', 1)).toBe(
                'give Rhys 2 favor for 1 secret'
            )
            tapPlayer(1, ANN)
            expect(bargainStepLine(state(), DANA, picked(), 0)).toBe('give 1 secret for 2 favor')
            expect(label(state(), picked(), 'Ann', 'pairsGiven', 1)).toBe(
                'give Ann 2 favor for 1 secret'
            )
            disposeSessions()
        }
    })

    it('at revision 32 the short seats’ pieces cannot be tapped, and name the exchange asked', async () => {
        // Rhys and Ann each hold a secret for Dana's pair, so "With:" offers both.
        const { picked, state, tapPlayer } = await bargaining({
            ...short,
            rhys: { favor: 1, secrets: 1 },
            ann: { favor: 0, secrets: 1 },
            revision: OathRevision.EngineFixes27
        })
        tapPlayer(0, RHYS)
        expect(bargainStepRows(state(), DANA, picked()).secrets?.addable).toBe(0)
        expect(label(state(), picked(), 'Rhys', 'secretsGiven', 1)).toBe(
            'give Rhys 1 secret for 2 favor'
        )
        expect(label(state(), picked(), 'Rhys', 'pairsGiven', 1)).toBe(
            'give Rhys 2 favor for 1 secret'
        )
    })
})

const listedCards = (state: HydratedOathGameState) =>
    listedActionPowers(state, DANA).map((use) => use.cardId)
const ownView = (state: HydratedOathGameState) =>
    new HydratedOathGameState(served(state, { kind: 'player', playerId: DANA }))

/**
 * What can be picked is shown, and nothing else: "With:" offers only the players the engine lets
 * Dana make an exchange with, and with no one, Witch's Bargain is not listed, on the table and on
 * Dana's own view alike.
 */
describe("Witch's Bargain offers only the exchanges that can be made (revisions 31, 32 and 33)", () => {
    const revisions = [
        OathRevision.EngineFixes26,
        OathRevision.EngineFixes27,
        OathRevision.EngineFixes28
    ]

    it('Vow of Silence and 1 favor: not listed and no Use on the card, at every revision', () => {
        for (const revision of revisions) {
            const state = scene({ revision, dana: { favor: 1, secrets: 3, advisers: [SILENCE] } })
            for (const view of [state, ownView(state)]) {
                expect(listedCards(view), `revision ${revision}`).not.toContain(WITCHS_BARGAIN)
                expect(cardsWithListedPower(view, DANA)).not.toContain(WITCHS_BARGAIN)
            }
            // With 2 favor a pair can be given to either player, who each hold a secret.
            const paired = scene({ revision, dana: { favor: 2, secrets: 3, advisers: [SILENCE] } })
            expect(listedCards(paired), `revision ${revision}`).toContain(WITCHS_BARGAIN)
            expect(listedCards(ownView(paired))).toContain(WITCHS_BARGAIN)
        }
    })

    it('only the cost secret and 1 favor: not listed, at every revision', () => {
        for (const revision of revisions) {
            const state = scene({ revision, dana: { favor: 1, secrets: 1 } })
            expect(listedCards(state), `revision ${revision}`).not.toContain(WITCHS_BARGAIN)
            expect(listedCards(ownView(state))).not.toContain(WITCHS_BARGAIN)
        }
    })

    it('“With:” offers Rhys alone at 31 and 32, who starts picked, as Ann’s 1 favor buys no secret and Dana holds no pair; at 33 Ann too', async () => {
        for (const revision of [OathRevision.EngineFixes26, OathRevision.EngineFixes27]) {
            const { legal, picked, state } = await bargaining({ revision })
            expect(bargainWithPlayers(state(), DANA, legal), `revision ${revision}`).toEqual([RHYS])
            expect(bargainWithPlayers(ownView(state()), DANA, legal)).toEqual([RHYS])
            const shown =
                revision === OathRevision.EngineFixes26
                    ? shownBargainPicks(state(), DANA, legal, picked())
                    : shownBargainSteps(state(), DANA, legal, picked())
            expect(shown).toEqual([step(RHYS, 0, 0)])
            disposeSessions()
        }
        // From revision 33 a secret given to Ann takes their 1 favor: still an exchange.
        const { legal, picked, state } = await bargaining({ revision: OathRevision.EngineFixes28 })
        expect(bargainWithPlayers(state(), DANA, legal)).toEqual([RHYS, ANN])
        expect(bargainWithPlayers(ownView(state()), DANA, legal)).toEqual([RHYS, ANN])
        expect(shownBargainSteps(state(), DANA, legal, picked())).toEqual([])
    })

    it('at 32 “Then:” still offers a player no first step could deal with, once a step gives Dana what it takes', async () => {
        // Dana holds only the cost secret and 2 favor; Rhys holds no secret, Ann 1 and no favor.
        const seats = {
            dana: { favor: 2, secrets: 1 },
            rhys: { favor: 2, secrets: 0 },
            ann: { favor: 0, secrets: 1 }
        }
        const { legal, picked, state, tapPlayer, tapCount } = await bargaining(seats)
        expect(bargainStepPlayers(state(), DANA, legal, picked(), 0)).toEqual([ANN])
        expect(shownBargainSteps(state(), DANA, legal, picked())).toEqual([step(ANN, 0, 0)])
        tapCount('pairsGiven', 1)
        // Ann's secret is Dana's to give Rhys now.
        expect(bargainThenPlayers(state(), DANA, legal, picked())).toEqual([RHYS])
        tapPlayer(1, RHYS)
        tapCount('secretsGiven', 1)
        expect(picked()).toEqual([step(ANN, 0, 1), step(RHYS, 1, 0)])
        expect(shownBargainSteps(state(), DANA, legal, picked())).toEqual(picked())
        disposeSessions()
        // From revision 33 Rhys takes 2 favor for the 0 secrets they hold: offered first too.
        const at33 = await bargaining({ ...seats, revision: OathRevision.EngineFixes28 })
        expect(bargainWithPlayers(at33.state(), DANA, at33.legal)).toEqual([RHYS, ANN])
    })

    it('Vow of Kinship: 2 favor in the Nomad bank make a pair, so both players are offered and the pairs row holds 2', async () => {
        for (const revision of revisions) {
            const { legal, state } = await bargaining({
                revision,
                dana: { favor: 0, secrets: 1, advisers: [KINSHIP] },
                nomadBank: 2
            })
            expect(bargainWithPlayers(state(), DANA, legal), `revision ${revision}`).toEqual([
                RHYS,
                ANN
            ])
            const pairs =
                revision === OathRevision.EngineFixes26
                    ? bargainRows(state(), DANA, [step(RHYS, 0, 0)], RHYS).pairs
                    : bargainStepRows(state(), DANA, [step(RHYS, 0, 0)]).pairs
            expect(pairs.held).toBe(2)
            expect(pairs.addable).toBe(1)
            disposeSessions()
        }
    })
})
