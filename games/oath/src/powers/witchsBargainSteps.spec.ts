import { describe, expect, it } from 'vitest'
import { assertExists, Color, type Visibility } from '@tabletop/common'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { cardPower, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { actionPowerUse, bargain } from '../testing/choices.js'
import { served } from '../testing/projection.js'
import { legalChoices, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { OathRevision } from '../util/revision.js'
import {
    BARGAIN_MAX_STEPS,
    witchsBargainStepBounds,
    WITCHS_BARGAIN,
    type BargainStep
} from '../util/witchsBargain.js'
import '../powers/index.js'

// "Give [secret] to a player whose pawn is at your site to take [favor][favor] from them, or give
//  [favor][favor] for [secret], any number of times." From revision 32 each exchange uses what the
// user holds at that moment: the entries are steps in order, each its secrets, then its pairs.

const DANA = 'dana'
const RHYS = 'rhys'
const ANN = 'ann'
const SILENCE = 'denizen.arcane.vow-of-silence'
const KINSHIP = 'denizen.nomad.vow-of-kinship'
const FORCED_LABOR = 'denizen.order.forced-labor'
const POWER = powerIndexOf(WITCHS_BARGAIN, PowerTiming.Action)
const bargainSpec = (s: HydratedOathGameState) => {
    const power = cardPower(WITCHS_BARGAIN, POWER)
    assertExists(power, 'Witch’s Bargain prints an Action power')
    return legalChoices(s, DANA, power)
}

type Seat = { favor?: number; secrets?: number; advisers?: string[]; status?: PlayerStatus }
type Scene = { dana?: Seat; rhys?: Seat; ann?: Seat; revision?: OathRevision; nomadBank?: number }

/**
 * Dana holds Witch's Bargain and 2 secrets (1 to give after the cost) and no favor; Rhys has 2 favor
 * and 1 secret; Ann, the Chancellor, 1 favor and 1 secret. All three pawns are at c1.
 */
function scene(v: Scene = {}): HydratedOathGameState {
    const seat = (
        playerId: string,
        color: Color,
        base: Required<Pick<Seat, 'favor' | 'secrets'>>,
        over: Seat = {}
    ) =>
        testPlayer({
            playerId,
            color,
            status: over.status ?? PlayerStatus.Exile,
            siteId: 'c1',
            favor: over.favor ?? base.favor,
            secrets: over.secrets ?? base.secrets,
            advisers: (over.advisers ?? []).map((cardId) => ({ cardId, faceUp: true }))
        })
    const s = testState(
        [
            seat(
                DANA,
                Color.Red,
                { favor: 0, secrets: 2 },
                {
                    ...v.dana,
                    advisers: [WITCHS_BARGAIN, ...(v.dana?.advisers ?? [])]
                }
            ),
            seat(RHYS, Color.Blue, { favor: 2, secrets: 1 }, v.rhys),
            seat(
                ANN,
                Color.Purple,
                { favor: 1, secrets: 1 },
                {
                    status: PlayerStatus.Chancellor,
                    ...v.ann
                }
            )
        ],
        {
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            },
            oathRevision: v.revision ?? OathRevision.EngineFixes27
        }
    )
    if (v.nomadBank !== undefined) s.favorBank[Suit.Nomad] = v.nomadBank
    openTurn(s, DANA)
    return s
}

type Step = [string, number, number]
const steps = (...list: Step[]): PowerChoice[] => list.map(([id, s, p]) => bargain(id, s, p))
const refusal = (s: HydratedOathGameState, choices: PowerChoice[]) =>
    HydratedUseActionPower.reasonCannotUse(s, DANA, WITCHS_BARGAIN, POWER, choices)
const holdings = (s: HydratedOathGameState) =>
    Object.fromEntries(
        [DANA, RHYS, ANN].map((id) => {
            const p = s.getPlayerState(id)
            return [id, { favor: p.favor, secrets: p.secrets }]
        })
    )
function use(s: HydratedOathGameState, choices: PowerChoice[]) {
    expect(refusal(s, choices)).toBeUndefined()
    const action = actionPowerUse(DANA, WITCHS_BARGAIN, choices)
    action.apply(s)
    return action
}
const stepOf = (playerId: string, secretsGiven: number, pairsGiven: number): BargainStep => ({
    playerId,
    secretsGiven,
    pairsGiven
})

describe("Witch's Bargain from revision 32 — the exchanges are steps, in order", () => {
    it('the example: Rhys’s 2 favor for Dana’s spare secret, then those 2 favor for Ann’s secret', () => {
        const s = scene()
        const action = use(s, steps([RHYS, 1, 0], [ANN, 0, 1]))
        expect(holdings(s)).toEqual({
            [DANA]: { favor: 0, secrets: 1 },
            [RHYS]: { favor: 0, secrets: 2 },
            // "Can I take someone's last secret? … Yup!"
            [ANN]: { favor: 3, secrets: 0 }
        })
        expect(s.tokensOn(WITCHS_BARGAIN).secrets).toBe(1)
        expect(action.metadata?.summary).toBe(
            "Witch's Bargain: gave rhys 1 secrets for 2 favor, then gave ann 2 favor for 1 secrets"
        )
        expect(action.metadata?.targetPlayerId).toBe(RHYS)
    })

    it('reversed, Ann’s pair comes before Dana holds any favor: refused', () => {
        expect(refusal(scene(), steps([ANN, 0, 1], [RHYS, 1, 0]))).toBe(
            'you have 0 favor to give, not 2'
        )
    })

    it('a player may come again after another, held to what they hold then', () => {
        // Rhys's 2 favor are gone after the first step: none left for a second secret.
        expect(refusal(scene(), steps([RHYS, 1, 0], [ANN, 0, 1], [RHYS, 1, 0]))).toBe(
            'at step 3, rhys has 0 favor, not the 2 you would take'
        )
        const s = scene({ rhys: { favor: 4 } })
        use(s, steps([RHYS, 1, 0], [ANN, 0, 1], [RHYS, 1, 0]))
        expect(holdings(s)).toEqual({
            [DANA]: { favor: 2, secrets: 0 },
            [RHYS]: { favor: 0, secrets: 3 },
            [ANN]: { favor: 3, secrets: 0 }
        })
    })

    it('the same player twice in a row is refused: both go in one step', () => {
        expect(refusal(scene({ rhys: { favor: 4 } }), steps([RHYS, 1, 0], [RHYS, 0, 1]))).toBe(
            'the exchanges with rhys was chosen twice in a row for a player at your site'
        )
        // In one step the secrets go first, then the pairs.
        expect(refusal(scene({ rhys: { favor: 4 } }), steps([RHYS, 1, 1]))).toBeUndefined()
    })

    it('each step names an exchange, in whole numbers', () => {
        expect(refusal(scene(), steps([RHYS, 1, 0], [ANN, 0, 0]))).toBe(
            'name at least one exchange with ann'
        )
        expect(refusal(scene(), steps([RHYS, 0, 0]))).toBe('name at least one exchange')
    })

    it('Vow of Silence: no secret is given, and the pairs are held to the favor held', () => {
        const silenced = { dana: { favor: 2, advisers: [SILENCE] } }
        expect(refusal(scene(silenced), steps([RHYS, 1, 0]))).toMatch(/Vow of Silence/)
        expect(refusal(scene(silenced), steps([ANN, 0, 1], [RHYS, 1, 0]))).toMatch(/Vow of Silence/)
        expect(refusal(scene(silenced), steps([ANN, 0, 1], [RHYS, 0, 1]))).toBe(
            'at step 2, you have 0 favor to give, not 2'
        )
        const s = scene(silenced)
        use(s, steps([ANN, 0, 1]))
        expect(holdings(s)[DANA]).toEqual({ favor: 0, secrets: 2 })
        expect(witchsBargainStepBounds(s, DANA, [], RHYS).silenced).toBe(true)
    })

    it('Vow of Kinship on the other player: the favor given them goes to the Nomad bank, where no later step takes it back', () => {
        const kin = {
            dana: { favor: 2 },
            rhys: { favor: 0, secrets: 2, advisers: [KINSHIP] },
            ann: { favor: 2 },
            nomadBank: 3
        }
        const chain = [
            [RHYS, 0, 1],
            [ANN, 1, 0]
        ] satisfies Step[]
        expect(refusal(scene(kin), steps(...chain, [RHYS, 1, 0]))).toBe(
            'at step 3, rhys has 0 favor, not the 2 you would take'
        )
        const s = scene(kin)
        use(s, steps(...chain))
        expect(s.favorBank[Suit.Nomad]).toBe(5)
        expect(holdings(s)).toEqual({
            [DANA]: { favor: 2, secrets: 1 },
            [RHYS]: { favor: 0, secrets: 1 },
            [ANN]: { favor: 0, secrets: 2 }
        })
    })

    it('Vow of Kinship on the user: the favor they take goes to the Nomad bank, and a later step gives it from there', () => {
        const s = scene({ dana: { advisers: [KINSHIP] }, nomadBank: 0 })
        use(s, steps([RHYS, 1, 0], [ANN, 0, 1]))
        expect(s.favorBank[Suit.Nomad]).toBe(0)
        expect(holdings(s)).toEqual({
            [DANA]: { favor: 0, secrets: 1 },
            [RHYS]: { favor: 0, secrets: 2 },
            [ANN]: { favor: 3, secrets: 0 }
        })
    })

    it('a Citizen at the site trades as anyone does, and Forced Labor takes no toll: this is no Search', () => {
        const s = scene({
            rhys: { status: PlayerStatus.Citizen },
            ann: { advisers: [FORCED_LABOR] }
        })
        use(s, steps([RHYS, 1, 0], [ANN, 0, 1]))
        expect(holdings(s)).toEqual({
            [DANA]: { favor: 0, secrets: 1 },
            [RHYS]: { favor: 0, secrets: 2 },
            [ANN]: { favor: 3, secrets: 0 }
        })
    })

    it('a long chain by turns: the cap’s 72 steps are taken, and one more is refused', () => {
        const long = (n: number) =>
            steps(
                ...Array.from({ length: n }, (_, i): Step =>
                    i % 2 === 0 ? [RHYS, 1, 0] : [ANN, 0, 1]
                )
            )
        const big = { rhys: { favor: BARGAIN_MAX_STEPS }, ann: { secrets: BARGAIN_MAX_STEPS / 2 } }
        expect(BARGAIN_MAX_STEPS).toBe(72)
        expect(refusal(scene(big), long(BARGAIN_MAX_STEPS + 1))).toBe(
            `${BARGAIN_MAX_STEPS + 1} given where at most ${BARGAIN_MAX_STEPS} of a player at your site were wanted`
        )
        const s = scene(big)
        use(s, long(BARGAIN_MAX_STEPS))
        expect(holdings(s)).toEqual({
            [DANA]: { favor: 0, secrets: 1 },
            [RHYS]: { favor: 0, secrets: 1 + BARGAIN_MAX_STEPS / 2 },
            [ANN]: { favor: 1 + BARGAIN_MAX_STEPS, secrets: 0 }
        })
    })

    it('the domain offers each player at the site once, and a player away is no option', () => {
        const s = scene({ ann: { favor: 1 } })
        s.getPlayerState(ANN).siteId = 'c2'
        const [legal] = bargainSpec(s)
        expect(
            legal.options.map((o) => (o.kind === PowerChoiceKind.Bargain ? o.playerId : ''))
        ).toEqual([RHYS])
        expect(legal.spec.max).toBe(BARGAIN_MAX_STEPS)
        expect(refusal(s, steps([RHYS, 1, 0], [ANN, 0, 1]))).toMatch(/not among the options/)
    })
})

describe("Witch's Bargain below revision 32 — today's totals, unchanged", () => {
    const at31 = { revision: OathRevision.EngineFixes26 }
    it('the totals are held against what Dana holds after the cost: the chain is refused', () => {
        expect(refusal(scene(at31), steps([RHYS, 1, 0]))).toBeUndefined()
        expect(refusal(scene(at31), steps([RHYS, 1, 0], [ANN, 0, 1]))).toBe(
            'you have 0 favor to give, not 2'
        )
        expect(
            refusal(
                scene({ ...at31, rhys: { favor: 4 } }),
                steps([RHYS, 1, 0], [ANN, 0, 1], [RHYS, 1, 0])
            )
        ).toMatch(/chosen twice/)
        const [legal] = bargainSpec(scene(at31))
        expect(legal.spec.max).toBe(5)
    })

    it('the summary names each player once, as before', () => {
        const s = scene({ ...at31, dana: { favor: 2 } })
        const action = use(s, steps([RHYS, 1, 0], [ANN, 0, 1]))
        expect(action.metadata?.summary).toBe(
            "Witch's Bargain: with rhys, gave 1 secrets for 2 favor and 0 favor for 0 secrets; with ann, gave 0 secrets for 0 favor and 2 favor for 1 secrets"
        )
    })
})

describe('witchsBargainStepBounds — the open step’s rows, read after the steps above it', () => {
    it('before the first step: the cost’s secret is drawn but never given; after Rhys’s step, Ann’s pair', () => {
        const s = scene()
        expect(witchsBargainStepBounds(s, DANA, [], RHYS)).toEqual({
            secretsHeld: 2,
            secrets: 1,
            favorHeld: 0,
            pairs: 0,
            silenced: false
        })
        // In the step, the pairs count the favor its own secrets take.
        expect(witchsBargainStepBounds(s, DANA, [], RHYS, 1)).toMatchObject({
            favorHeld: 2,
            pairs: 1
        })
        expect(witchsBargainStepBounds(s, DANA, [stepOf(RHYS, 1, 0)], ANN)).toEqual({
            secretsHeld: 0,
            secrets: 0,
            favorHeld: 2,
            pairs: 1,
            silenced: false
        })
        // Nothing is left to exchange with Rhys then.
        expect(
            witchsBargainStepBounds(s, DANA, [stepOf(RHYS, 1, 0), stepOf(ANN, 0, 1)], RHYS)
        ).toMatchObject({ secrets: 0, pairs: 0 })
    })

    it('agrees with the engine for every count of the open step', () => {
        const s = scene({
            dana: { favor: 3, secrets: 3 },
            rhys: { favor: 5, secrets: 1 },
            ann: { favor: 4, secrets: 2 }
        })
        const before = [stepOf(RHYS, 1, 0)]
        for (let give = 0; give <= 4; give++) {
            const bounds = witchsBargainStepBounds(s, DANA, before, ANN, give)
            for (let pairs = 0; pairs <= 4; pairs++) {
                if (give + pairs === 0) continue
                const refused = refusal(s, steps([RHYS, 1, 0], [ANN, give, pairs]))
                expect(refused === undefined, `give ${give}, pairs ${pairs}: ${refused}`).toBe(
                    give <= bounds.secrets && pairs <= bounds.pairs
                )
            }
        }
    })
})

describe('on a player’s own view (safe on a player’s view)', () => {
    const view = (id: string): Visibility.Perspective => ({ kind: 'player', playerId: id })
    const own = (s: HydratedOathGameState, id: string) =>
        OathVisibility.state.guardForExecution(
            new HydratedOathGameState(served(s, view(id))),
            view(id)
        )

    it('Dana’s view judges and bounds the steps as the server does, with the state neither copied nor changed', () => {
        const s = scene()
        const server = JSON.stringify(s.dehydrate())
        const mine = own(s, DANA)
        expect(refusal(mine, steps([RHYS, 1, 0], [ANN, 0, 1]))).toBeUndefined()
        expect(refusal(mine, steps([ANN, 0, 1], [RHYS, 1, 0]))).toBe(
            'you have 0 favor to give, not 2'
        )
        expect(witchsBargainStepBounds(mine, DANA, [stepOf(RHYS, 1, 0)], ANN)).toEqual(
            witchsBargainStepBounds(s, DANA, [stepOf(RHYS, 1, 0)], ANN)
        )
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })

    it('each other player’s view reads the same holdings', () => {
        const s = scene()
        for (const id of [RHYS, ANN])
            expect(witchsBargainStepBounds(own(s, id), DANA, [stepOf(RHYS, 1, 0)], ANN)).toEqual(
                witchsBargainStepBounds(s, DANA, [stepOf(RHYS, 1, 0)], ANN)
            )
    })
})
