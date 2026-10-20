import { describe, expect, it } from 'vitest'
import { ActionSource, Color, assert, assertExists, latestPlayerUndoTarget, type GameAction, type Visibility } from '@tabletop/common'
import { AnswerQuestion, HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import { UseActionPower } from '../actions/useActionPower.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { defenseShieldsFromFaces, rollDefenseDice } from '../data/dice.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import type { RolledDefenseFace } from '../model/campaign.js'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { PowerQuestionKind, RerolledRollKind, type QuestionAnswer } from '../model/question.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { actionPowerUse, bank } from '../testing/choices.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { OathVisibility } from '../definition/runtime.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

/**
 * Gambling Hall: "Action: Roll 4[defenseDie] and take X[favor] equal to the total [shield] result
 * from any one favor bank." Its Q&A: 2x faces multiply the total, as in a Campaign. Jinx's Q&A: it
 * may reroll these dice. Law 9.3: a bank that holds fewer gives what it holds. From revision 21 the
 * bank is chosen once the roll stands, after any Jinx reroll.
 */
const GAMBLING_HALL = 'denizen.discord.gambling-hall'
const JINX = 'denizen.arcane.jinx'
const KINSHIP = 'denizen.nomad.vow-of-kinship'
const POVERTY = 'denizen.beast.vow-of-poverty'
const STORYTELLER = 'denizen.hearth.storyteller'

const DANA = 'dana'
const RHYS = 'rhys'
const ANN = 'ann'
const atRevision = OathRevision.EngineFixes17
const before = OathRevision.EngineFixes16

/** Discord 3, Arcane 2, Order 4, Hearth 1, Beast 0, Nomad 3: every bank but the Beast's holds favor. */
const BANKS: Record<Suit, number> = {
    [Suit.Discord]: 3,
    [Suit.Arcane]: 2,
    [Suit.Order]: 4,
    [Suit.Hearth]: 1,
    [Suit.Beast]: 0,
    [Suit.Nomad]: 3
}
const LISTED = [Suit.Discord, Suit.Arcane, Suit.Order, Suit.Hearth, Suit.Nomad]

interface Scene {
    revision?: number
    seed?: number
    advisers?: string[]
    favor?: number
    banks?: Partial<Record<Suit, number>>
}

/** Dana rules Gambling Hall at c1 and is on turn; Ann (the Chancellor) holds a facedown adviser, so no view holds everything. */
function table({ revision = atRevision, seed = 1, advisers = [], favor = 4, banks = BANKS }: Scene = {}) {
    const s = testState(
        [
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'c1',
                favor,
                secrets: 3,
                supply: 4,
                warbandsOnBoard: { [DANA]: 3 },
                warbandsInPersonalBank: { [DANA]: 5 },
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({ playerId: RHYS, color: Color.Blue, siteId: 'c1', favor: 2, secrets: 2, warbandsOnBoard: { [RHYS]: 2 } }),
            testPlayer({
                playerId: ANN,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                favor: 1,
                secrets: 2,
                advisers: [{ cardId: STORYTELLER, faceUp: false }]
            })
        ],
        {
            oathRevision: revision,
            prng: { seed, invocations: 0 },
            denizensBySite: { c1: [GAMBLING_HALL], c2: [], h1: [] },
            warbandsBySite: { c1: { [DANA]: 1 } },
            siteCards: { c1: 'site.mine', c2: 'site.river', p1: 'site.plains', h1: 'site.wastes' }
        }
    )
    for (const suit of Object.values(Suit)) s.favorBank[suit] = banks[suit] ?? 0
    openTurn(s, DANA)
    return s
}

/** The four faces the next roll from `s` shows: the use rolls first and draws nothing else. */
function nextFaces(s: HydratedOathGameState): RolledDefenseFace[] {
    return rollDefenseDice(new HydratedOathGameState(s.dehydrate()).getProtectedPrng(), 4)
}

/** The first seed whose roll the test needs. */
function tableRolling(want: (faces: RolledDefenseFace[]) => boolean, scene: Scene = {}) {
    for (let seed = 1; seed < 5000; seed++) {
        const s = table({ ...scene, seed })
        const faces = nextFaces(s)
        if (want(faces)) return { s, faces, shields: defenseShieldsFromFaces(faces) }
    }
    throw Error('no seed rolls the faces this test needs')
}

const shieldsOf = (faces: RolledDefenseFace[]) => faces.reduce((sum, face) => sum + face.shields, 0)
const doubled = (faces: RolledDefenseFace[]) => faces.some((face) => face.doubling)
/** Shield, two shields, blank and a doubling, in any order: (1 + 2) × 2 = 6. */
const rollsSix = (faces: RolledDefenseFace[]) =>
    doubled(faces) && faces.filter((face) => face.doubling).length === 1 && shieldsOf(faces) === 3 && faces.some((face) => face.shields === 2)

const bankAnswer = (suit: Suit): QuestionAnswer => ({ kind: PowerQuestionKind.GamblingHallBank, suit })
const keep: QuestionAnswer = { kind: PowerQuestionKind.RerollDice, reroll: false }
const reroll: QuestionAnswer = { kind: PowerQuestionKind.RerollDice, reroll: true }

function use(s: HydratedOathGameState) {
    const action = actionPowerUse(DANA, GAMBLING_HALL)
    action.apply(s)
    return action
}

function answered(s: HydratedOathGameState, a: QuestionAnswer, playerId = DANA) {
    expect(HydratedAnswerQuestion.reasonCannotAnswer(s, playerId, a)).toBeUndefined()
    const action = new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId, answer: a }))
    action.apply(s)
    return action
}

type Fields = { type: ActionType; playerId: string } & Record<string, unknown>

const queue = (s: HydratedOathGameState) => s.pendingQuestions?.queue ?? []
const favorOf = (s: HydratedOathGameState) => s.getPlayerState(DANA).favor
/** Dana's favor before any gain: the use places 2 on the card. */
const AFTER_COST = 2

describe('R-7.1.3-H2 — Gambling Hall rolls first, then Dana chooses the bank', () => {
    it('the use names no bank: one naming a bank is refused, and the roll asks the question', () => {
        const { s, faces, shields } = tableRolling(rollsSix)
        expect(() => actionPowerUse(DANA, GAMBLING_HALL, [bank(Suit.Order)]).apply(table())).toThrow(/takes no choices/)
        const action = use(s)
        expect(action.revealsInfo).toBe(true)
        expect(action.metadata?.summary).toBe('rolled 6 shields')
        expect(shields).toBe(6)
        expect(queue(s)).toEqual([
            { kind: PowerQuestionKind.GamblingHallBank, cardId: GAMBLING_HALL, askedPlayerId: DANA, shields: 6, faces, banks: LISTED }
        ])
        expect(favorOf(s)).toBe(AFTER_COST)
        expect(s.favorBank).toMatchObject(BANKS)
    })

    it('a doubling face multiplies the total (the card’s Q&A), and the question carries the faces', () => {
        const { s, faces, shields } = tableRolling((f) => doubled(f) && shieldsOf(f) > 0)
        use(s)
        const doublings = faces.filter((face) => face.doubling).length
        expect(shields).toBe(shieldsOf(faces) * 2 ** doublings)
        expect(queue(s)[0]).toMatchObject({ kind: PowerQuestionKind.GamblingHallBank, shields, faces })
    })

    it('each listed bank gives min(6, what it holds): +3, +2, +4, +1, +3 (Law 9.3)', () => {
        for (const suit of LISTED) {
            const { s } = tableRolling(rollsSix)
            use(s)
            const gained = answered(s, bankAnswer(suit))
            const expected = Math.min(6, BANKS[suit])
            expect(favorOf(s), suit).toBe(AFTER_COST + expected)
            expect(s.favorBank[suit], suit).toBe(BANKS[suit] - expected)
            expect(gained.metadata, suit).toMatchObject({ kind: PowerQuestionKind.GamblingHallBank, cardId: GAMBLING_HALL, summary: `gained ${expected} favor from the ${suit} bank` })
            expect(gained.revealsInfo, suit).toBe(false)
            expect(queue(s), suit).toEqual([])
            expect(s.machineState, suit).toBe(MachineState.ActPhase)
        }
    })

    it('a bank not listed (the empty Beast bank) is refused, and only Dana answers', () => {
        const { s } = tableRolling(rollsSix)
        use(s)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, DANA, bankAnswer(Suit.Beast))).toMatch(/beast/)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, RHYS, bankAnswer(Suit.Order))).toMatch(/dana/)
    })

    it('no shields rolled: nothing gained and nothing asked', () => {
        const { s } = tableRolling((f) => defenseShieldsFromFaces(f) === 0)
        const action = use(s)
        expect(action.metadata?.summary).toBe('rolled 0 shields; gained nothing')
        expect(queue(s)).toEqual([])
        expect(favorOf(s)).toBe(AFTER_COST)
        expect(s.favorBank).toMatchObject(BANKS)
    })

    it('no bank holds favor: nothing gained and nothing asked', () => {
        const { s, shields } = tableRolling((f) => defenseShieldsFromFaces(f) > 0, { banks: {} })
        const action = use(s)
        expect(action.metadata?.summary).toBe(`rolled ${shields} shield${shields === 1 ? '' : 's'}; gained nothing`)
        expect(queue(s)).toEqual([])
        expect(favorOf(s)).toBe(AFTER_COST)
    })

    it('one bank holds favor: taken with no question, in the History’s words', () => {
        const { s } = tableRolling(rollsSix, { banks: { [Suit.Order]: 4 } })
        const action = use(s)
        expect(action.metadata?.summary).toBe('rolled 6 shields; gained 4 favor from the order bank')
        expect(queue(s)).toEqual([])
        expect(favorOf(s)).toBe(AFTER_COST + 4)
        expect(s.favorBank[Suit.Order]).toBe(0)
    })
})

describe('R-7.1.3-H2 — Jinx comes first, then the bank', () => {
    it('kept: the Jinx question alone, then the bank question with the same roll', () => {
        const { s, faces } = tableRolling(rollsSix, { advisers: [JINX] })
        const action = use(s)
        expect(action.metadata?.summary).toBe('rolled 6 shields; Jinx may reroll them')
        expect(queue(s)).toEqual([
            {
                kind: PowerQuestionKind.RerollDice,
                cardId: JINX,
                askedPlayerId: DANA,
                powerIndex: powerIndexOf(JINX, PowerTiming.Persistent),
                roll: { kind: RerolledRollKind.GamblingHallDice, shields: 6, faces }
            }
        ])
        const kept = answered(s, keep)
        expect(kept.metadata?.summary).toBe('kept the roll; rolled 6 shields')
        expect(kept.revealsInfo).toBe(false)
        expect(queue(s)).toEqual([
            { kind: PowerQuestionKind.GamblingHallBank, cardId: GAMBLING_HALL, askedPlayerId: DANA, shields: 6, faces, banks: LISTED }
        ])
        answered(s, bankAnswer(Suit.Order))
        expect(favorOf(s)).toBe(AFTER_COST + 4)
    })

    it('rerolled: Jinx paid, then the bank question carries the new faces and total', () => {
        const { s } = tableRolling(rollsSix, { advisers: [JINX] })
        use(s)
        const rerolledFaces = nextFaces(s)
        const total = defenseShieldsFromFaces(rerolledFaces)
        const rerolled = answered(s, reroll)
        expect(rerolled.revealsInfo).toBe(true)
        expect(s.tokensOn(JINX).secrets).toBe(1)
        if (total === 0) {
            expect(rerolled.metadata?.summary).toBe('Jinx: rerolled — rolled 0 shields; gained nothing')
            expect(queue(s)).toEqual([])
            return
        }
        expect(queue(s)).toEqual([
            { kind: PowerQuestionKind.GamblingHallBank, cardId: GAMBLING_HALL, askedPlayerId: DANA, shields: total, faces: rerolledFaces, banks: LISTED }
        ])
    })

    it('rerolled into a different total: the bank question follows the reroll, not the first roll', () => {
        for (let seed = 1; seed < 5000; seed++) {
            const s = table({ seed, advisers: [JINX] })
            const first = defenseShieldsFromFaces(nextFaces(s))
            use(s)
            const second = nextFaces(s)
            const total = defenseShieldsFromFaces(second)
            if (first === total || total === 0) continue
            answered(s, reroll)
            expect(queue(s)[0]).toMatchObject({ kind: PowerQuestionKind.GamblingHallBank, shields: total, faces: second })
            answered(s, bankAnswer(Suit.Order))
            expect(favorOf(s)).toBe(AFTER_COST + Math.min(total, 4))
            return
        }
        throw Error('no seed rerolls into a different total')
    })

    it('Jinx cannot be paid: the roll stands and the bank question comes at once', () => {
        const { s, faces } = tableRolling(rollsSix, { advisers: [JINX] })
        s.getPlayerState(DANA).secrets = 0
        const action = use(s)
        expect(action.metadata?.summary).toBe('rolled 6 shields')
        expect(queue(s)).toEqual([
            { kind: PowerQuestionKind.GamblingHallBank, cardId: GAMBLING_HALL, askedPlayerId: DANA, shields: 6, faces, banks: LISTED }
        ])
    })
})

describe('R-7.1.3-H2 — the bank with other cards', () => {
    it('Vow of Kinship: the Nomad bank is listed while it holds favor, and the gain goes into it', () => {
        const { s } = tableRolling(rollsSix, { advisers: [KINSHIP], favor: 0 })
        // The cost is placed from the Nomad bank, Dana's board being empty.
        s.favorBank[Suit.Nomad] = 5
        use(s)
        expect(queue(s)[0]).toMatchObject({ banks: LISTED })
        const nomad = s.favorBank[Suit.Nomad]
        answered(s, bankAnswer(Suit.Order))
        expect(s.favorBank[Suit.Order]).toBe(0)
        expect(s.favorBank[Suit.Nomad]).toBe(nomad + 4)
        expect(favorOf(s)).toBe(0)
    })

    it('Vow of Poverty bars favor from Trade alone: Gambling Hall still gains', () => {
        const { s } = tableRolling(rollsSix, { advisers: [POVERTY] })
        use(s)
        answered(s, bankAnswer(Suit.Discord))
        expect(favorOf(s)).toBe(AFTER_COST + 3)
    })
})

describe('R-7.1.3-H2 — views, Undo and replay', () => {
    const view = (playerId: string): Visibility.Perspective => ({ kind: 'player', playerId })
    const ownView = (s: HydratedOathGameState, playerId: string) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view(playerId))), view(playerId))

    it('Dana answers on their own projected view, as the host does; Rhys sees the same question and cannot answer it', () => {
        const { s } = tableRolling(rollsSix)
        use(s)
        const server = JSON.stringify(s.dehydrate())
        const own = ownView(s, DANA)
        expect(queue(own)).toEqual(queue(s))
        expect(HydratedAnswerQuestion.canAnswer(own, DANA)).toBe(true)
        for (const suit of LISTED) expect(HydratedAnswerQuestion.reasonCannotAnswer(own, DANA, bankAnswer(suit)), suit).toBeUndefined()
        expect(HydratedAnswerQuestion.reasonCannotAnswer(own, DANA, bankAnswer(Suit.Beast))).toMatch(/beast/)
        const rhys = ownView(s, RHYS)
        expect(queue(rhys)).toEqual(queue(s))
        expect(HydratedAnswerQuestion.canAnswer(rhys, RHYS)).toBe(false)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })

    const game = testGame([DANA, RHYS, ANN])
    let seq = 0
    function run(state: OathProjectedState, fields: Fields) {
        const action: GameAction = { id: `g-${(seq += 1)}`, gameId: 'game-1', source: ActionSource.User, index: state.actionCount, ...fields }
        return engine.run(action, state, game)
    }
    const useBody = { playerId: DANA, cardId: GAMBLING_HALL, powerIndex: powerIndexOf(GAMBLING_HALL, PowerTiming.Action) }
    const answerBody = (answer: QuestionAnswer) => ({ playerId: DANA, answer })
    const useFields: Fields = { type: ActionType.UseActionPower, ...useBody }
    const answerFields = (answer: QuestionAnswer): Fields => ({ type: ActionType.AnswerQuestion, ...answerBody(answer) })

    function undone(state: OathProjectedState, history: GameAction[]) {
        const target = latestPlayerUndoTarget(history, DANA)
        assertExists(target, 'Undo is offered to Dana')
        let back = state
        for (const action of history.slice(history.indexOf(target)).toReversed()) back = engine.undoProcessedAction({ state: back, action })
        return { target, back }
    }

    it('Undo: the use rolled and stays; the bank answer goes back to the question; a kept Jinx goes back to the Jinx question', () => {
        const { s } = tableRolling(rollsSix, { advisers: [JINX] })
        const history: GameAction[] = []
        const used = run(s.dehydrate(), useFields)
        history.push(...used.processedActions)
        expect(latestPlayerUndoTarget(history, DANA)).toBeUndefined()
        const atJinx = used.updatedState

        const kept = run(atJinx, answerFields(keep))
        history.push(...kept.processedActions)
        const atBank = kept.updatedState
        expect(atBank.pendingQuestions?.queue[0]?.kind).toBe(PowerQuestionKind.GamblingHallBank)

        const gained = run(atBank, answerFields(bankAnswer(Suit.Order)))
        history.push(...gained.processedActions)
        const toBank = undone(gained.updatedState, history)
        expect(toBank.target.type).toBe(ActionType.AnswerQuestion)
        expect(toBank.back).toEqual(atBank)

        const toJinx = undone(atBank, history.slice(0, -gained.processedActions.length))
        expect(toJinx.back).toEqual(atJinx)
    })

    it('Undo: a Jinx reroll rolled, so it stays', () => {
        const { s } = tableRolling(rollsSix, { advisers: [JINX] })
        const used = run(s.dehydrate(), useFields)
        const rerolled = run(used.updatedState, answerFields(reroll))
        expect(latestPlayerUndoTarget([...used.processedActions, ...rerolled.processedActions], DANA)).toBeUndefined()
    })

    it('the use, the Jinx answer and the bank answer replay exactly', () => {
        const { s } = tableRolling(rollsSix, { advisers: [JINX] })
        const start = s.dehydrate()
        const used = engine.runNext(buildAction(UseActionPower, useBody), structuredClone(start), game)
        const kept = engine.runNext(buildAction(AnswerQuestion, answerBody(keep)), used.updatedState, game)
        const gained = engine.runNext(buildAction(AnswerQuestion, answerBody(bankAnswer(Suit.Arcane))), kept.updatedState, game)
        expect(gained.updatedState.machineState).toBe(MachineState.ActPhase)
        let replayed = structuredClone(start)
        for (const action of [...used.processedActions, ...kept.processedActions, ...gained.processedActions]) {
            replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
        }
        expect(replayed).toEqual(gained.updatedState)
    })
})

describe('R-X.4 — before revision 21 the bank is named at the use, as recorded', () => {
    it('the named bank pays at once; a use naming none is refused', () => {
        const { s, shields } = tableRolling(rollsSix, { revision: before })
        expect(() => actionPowerUse(DANA, GAMBLING_HALL).apply(table({ revision: before }))).toThrow(/no choice was made for a favor bank/)
        const action = actionPowerUse(DANA, GAMBLING_HALL, [bank(Suit.Order)])
        action.apply(s)
        expect(action.metadata?.summary).toBe(`rolled ${shields} shields and took 4 favor from the order bank`)
        expect(queue(s)).toEqual([])
        expect(favorOf(s)).toBe(AFTER_COST + 4)
    })

    it('Jinx carries the named bank, and its answer pays from it', () => {
        const { s } = tableRolling(rollsSix, { revision: before, advisers: [JINX] })
        actionPowerUse(DANA, GAMBLING_HALL, [bank(Suit.Order)]).apply(s)
        const question = queue(s)[0]
        assert(question?.kind === PowerQuestionKind.RerollDice, 'Jinx is asked')
        expect(question.roll).toEqual({ kind: RerolledRollKind.GamblingHall, bank: Suit.Order, shields: 6 })
        const kept = answered(s, keep)
        expect(kept.metadata?.summary).toBe('kept the roll; rolled 6 shields and took 4 favor from the order bank')
        expect(queue(s)).toEqual([])
    })
})
