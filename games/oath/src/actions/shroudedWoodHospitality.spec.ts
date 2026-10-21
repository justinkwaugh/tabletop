import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedTravel, Travel } from './travel.js'
import { AnswerQuestion, HydratedAnswerQuestion } from './answerQuestion.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { OathVisibility } from '../definition/runtime.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { bank, modifierUse } from '../testing/choices.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { banksOnArrival, woodPicksBeforeTravel } from '../util/shroudedWood.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

/**
 * Hospitality: "After traveling, gain [favor] from one favor bank that matches both a card at your
 * site and one of your advisers." Tents' Q&A: "You must choose whether to use Tents at the start of
 * the action. If the ruler makes you travel to another region, Tents does not work." Law 7.4: the
 * modifiers are used at the start of the action; 7.1.4: a power takes effect at the time it
 * describes. So on a Travel out of an enemy's Shrouded Wood it is declared with no bank, and the
 * bank is settled once the ruler's pick has landed the traveller.
 */
const HOSPITALITY = 'denizen.nomad.hospitality'
const COUNCIL_SEAT = 'denizen.order.council-seat'
const BEAR_TRAPS = 'denizen.order.bear-traps'
const ORACLE = 'denizen.nomad.oracle'
const WAY_STATION = 'denizen.nomad.way-station'
const TOLL_ROADS = 'denizen.order.toll-roads'
const PATHS = 'denizen.beast.forest-paths'
const TENTS = 'denizen.nomad.tents'
const ENVOY = 'denizen.nomad.special-envoy'
const KINSHIP = 'denizen.nomad.vow-of-kinship'
const DRUM = 'relic.dragonskin-drum'
const STORYTELLER = 'denizen.hearth.storyteller'

const DANA = 'dana'
const RHYS = 'rhys'
const ANN = 'ann'
const atRevision = OathRevision.EngineFixes11
const before = OathRevision.EngineFixes10

/**
 * Cradle c1, c2 (River: Bear Traps and Oracle, so the Order and Nomad banks match); Provinces p1
 * (the Wood), p2 (Great Slums: Way Station and Bear Traps, ruled by Ann), p3 (Marshes: Oracle, the
 * Nomad bank alone); Hinterland h1 (no card), h2 (Toll Roads and Oracle, ruled by Rhys), h3.
 */
const SITES = {
    c1: 'site.plains',
    c2: 'site.river',
    p1: 'site.shrouded-wood',
    p2: 'site.great-slums',
    p3: 'site.marshes',
    h1: 'site.mountain',
    h2: 'site.steppe',
    h3: 'site.wastes'
}

interface Scene {
    revision?: number
    supply?: number
    favor?: number
    advisers?: string[]
    relics?: string[]
    banks?: Partial<Record<Suit, number>>
}

/** Dana (an Exile) stands at the Shrouded Wood p1, which Rhys (an Exile, so an enemy) rules. */
function table({ revision = atRevision, supply = 4, favor = 3, advisers = [HOSPITALITY, COUNCIL_SEAT], relics = [], banks = {} }: Scene = {}) {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Purple,
                status: PlayerStatus.Exile,
                siteId: 'p1',
                supply,
                favor,
                relicIds: relics,
                warbandsOnBoard: { [DANA]: 3 },
                warbandsInPersonalBank: { [DANA]: 6 },
                // A facedown adviser, so Rhys's view does not hold everything.
                advisers: [...advisers.map((cardId) => ({ cardId, faceUp: true })), { cardId: STORYTELLER, faceUp: false }]
            }),
            testPlayer({ playerId: RHYS, color: Color.Red, status: PlayerStatus.Exile, siteId: 'h3', supply: 4, favor: 1, warbandsOnBoard: { [RHYS]: 3 } }),
            testPlayer({ playerId: ANN, color: Color.Yellow, status: PlayerStatus.Exile, siteId: 'c1', supply: 4, favor: 1, warbandsOnBoard: { [ANN]: 3 } })
        ]),
        {
            oathRevision: revision,
            siteCards: SITES,
            denizensBySite: { c1: [], c2: [BEAR_TRAPS, ORACLE], p1: [], p2: [WAY_STATION, BEAR_TRAPS], p3: [ORACLE], h1: [], h2: [TOLL_ROADS, ORACLE], h3: [] },
            warbandsBySite: { p1: { [RHYS]: 1 }, p2: { [ANN]: 2 }, h2: { [RHYS]: 1 } }
        }
    )
    for (const [suit, count] of Object.entries(banks)) s.favorBank[suit as Suit] = count
    openTurn(s, DANA)
    return s
}

const answer = (a: QuestionAnswer, playerId: string) => buildAction(AnswerQuestion, { playerId, answer: a })
const pickAnswer = (siteId: string): QuestionAnswer => ({ kind: PowerQuestionKind.ShroudedWoodDestination, siteId })
const bankAnswer = (suit: Suit): QuestionAnswer => ({ kind: PowerQuestionKind.HospitalityBank, suit })
const hospitality = modifierUse(HOSPITALITY)
const stored = (cardId: string) => ({ cardId, powerIndex: modifierUse(cardId).powerIndex })

function leaveWith(s: HydratedOathGameState, ...cards: string[]) {
    const travel = new HydratedTravel(buildAction(Travel, { playerId: DANA, modifiers: cards.map((cardId) => modifierUse(cardId)) }))
    travel.apply(s)
    return travel
}

function answered(s: HydratedOathGameState, a: QuestionAnswer, playerId: string) {
    expect(HydratedAnswerQuestion.reasonCannotAnswer(s, playerId, a)).toBeUndefined()
    const action = new HydratedAnswerQuestion(answer(a, playerId))
    action.apply(s)
    return action
}

const pick = (s: HydratedOathGameState, siteId: string) => answered(s, pickAnswer(siteId), RHYS)
const dana = (s: HydratedOathGameState) => s.getPlayerState(DANA)
const queue = (s: HydratedOathGameState) => (s.pendingQuestions?.queue ?? []).map((q) => [q.kind, q.askedPlayerId])
const GAINED_ORDER = 'Hospitality: gained 1 favor from the order bank'
const GAINED_NOMAD = 'Hospitality: gained 1 favor from the nomad bank'

describe('R-11.7-H2 — Hospitality is declared with no bank on a Travel out of an enemy’s Shrouded Wood', () => {
    it('accepted with no bank, nothing paid; the ruler’s question carries it', () => {
        const s = table()
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, { modifiers: [hospitality] })).toBeUndefined()
        expect(HydratedTravel.canDoTravel(s, DANA)).toBe(true)
        const travel = leaveWith(s, HOSPITALITY)
        expect(dana(s)).toMatchObject({ siteId: 'p1', supply: 4, favor: 3 })
        expect(travel.metadata).toMatchObject({ destinationChooser: RHYS, modifiers: [HOSPITALITY] })
        expect(s.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.ShroudedWoodDestination,
            askedPlayerId: RHYS,
            travel: { free: false, modifiers: [stored(HOSPITALITY)] }
        })
    })

    it('a bank named at the start is refused: the site, and so the bank, is not known yet', () => {
        const s = table()
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, { modifiers: [modifierUse(HOSPITALITY, [bank(Suit.Nomad)])] })).toMatch(/no bank/)
        expect(() => new HydratedTravel(buildAction(Travel, { playerId: DANA, modifiers: [modifierUse(HOSPITALITY, [bank(Suit.Nomad)])] })).apply(s)).toThrow(/no bank/)
    })

    it('changes no price: the panel’s picks are those of a Travel with no card, Hospitality counted at none', () => {
        const s = table()
        const withIt = woodPicksBeforeTravel(s, DANA, [hospitality])
        const without = woodPicksBeforeTravel(s, DANA, [])
        expect(withIt.map(({ pick }) => pick)).toEqual(without.map(({ pick }) => pick))
        expect(withIt.length).toBeGreaterThan(0)
        expect(withIt.every(({ counted }) => counted.length === 0)).toBe(true)
    })
})

describe('R-11.7-H2 — Hospitality’s bank once Rhys’s pick has landed Dana', () => {
    it('no bank matches (the Mountain holds no card): nothing gained, nothing asked', () => {
        const s = table()
        leaveWith(s, HOSPITALITY)
        const picked = pick(s, 'h1')
        expect(dana(s)).toMatchObject({ siteId: 'h1', supply: 2, favor: 3 })
        expect(picked.metadata?.woodPick).toMatchObject({ siteId: 'h1', supplySpent: 2 })
        expect(picked.metadata?.woodPick?.notes).toBeUndefined()
        expect(queue(s)).toEqual([])
    })

    it('one bank matches (the Marshes’ Oracle and Hospitality itself, Nomad): gained with no question', () => {
        const s = table()
        leaveWith(s, HOSPITALITY)
        const picked = pick(s, 'p3')
        expect(dana(s)).toMatchObject({ siteId: 'p3', supply: 2, favor: 4 })
        expect(s.favorBank[Suit.Nomad]).toBe(2)
        expect(picked.metadata?.woodPick).toMatchObject({ siteId: 'p3', supplySpent: 2, notes: [GAINED_NOMAD] })
        expect(queue(s)).toEqual([])
    })

    it('two banks match (the River’s Bear Traps and Oracle): Dana is asked which, after the pick has landed and paid', () => {
        const s = table()
        leaveWith(s, HOSPITALITY)
        const picked = pick(s, 'c2')
        expect(dana(s)).toMatchObject({ siteId: 'c2', supply: 2, favor: 3 })
        // The pick's own row records the travel; the bank is the traveller's answer.
        expect(picked.metadata?.woodPick).toEqual({ travelerPlayerId: DANA, siteId: 'c2', supplySpent: 2, supplyRemaining: 2 })
        expect(s.pendingQuestions?.queue).toEqual([
            {
                kind: PowerQuestionKind.HospitalityBank,
                cardId: HOSPITALITY,
                powerIndex: hospitality.powerIndex,
                askedPlayerId: DANA,
                siteId: 'c2',
                banks: [Suit.Order, Suit.Nomad]
            }
        ])
    })

    it('each answer gains from that bank, in the card’s own words', () => {
        for (const [suit, note] of [[Suit.Order, GAINED_ORDER], [Suit.Nomad, GAINED_NOMAD]] as const) {
            const s = table()
            leaveWith(s, HOSPITALITY)
            pick(s, 'c2')
            const gained = answered(s, bankAnswer(suit), DANA)
            expect(dana(s).favor, suit).toBe(4)
            expect(s.favorBank[suit], suit).toBe(2)
            expect(gained.metadata, suit).toMatchObject({ kind: PowerQuestionKind.HospitalityBank, cardId: HOSPITALITY, summary: note })
            expect(gained.metadata?.woodPick, suit).toBeUndefined()
            expect(s.pendingQuestions?.queue ?? []).toEqual([])
        }
    })

    it('a bank that does not match is refused, and only Dana answers', () => {
        const s = table()
        leaveWith(s, HOSPITALITY)
        pick(s, 'c2')
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, DANA, bankAnswer(Suit.Hearth))).toMatch(/hearth/)
        expect(() => new HydratedAnswerQuestion(answer(bankAnswer(Suit.Order), RHYS)).apply(s)).toThrow()
    })

    it('an empty matching bank gives nothing (R-9.3): with the Order bank empty, the Nomad favor is gained unasked; with both empty, nothing', () => {
        const one = table({ banks: { [Suit.Order]: 0 } })
        leaveWith(one, HOSPITALITY)
        expect(pick(one, 'c2').metadata?.woodPick?.notes).toEqual([GAINED_NOMAD])
        expect(dana(one).favor).toBe(4)
        expect(queue(one)).toEqual([])

        const none = table({ banks: { [Suit.Order]: 0, [Suit.Nomad]: 0 } })
        leaveWith(none, HOSPITALITY)
        expect(pick(none, 'c2').metadata?.woodPick?.notes).toBeUndefined()
        expect(dana(none).favor).toBe(3)
        expect(queue(none)).toEqual([])
    })

    it('Vow of Kinship: the favor gained goes to the Nomad bank, out of the bank Dana names', () => {
        const s = table({ advisers: [HOSPITALITY, COUNCIL_SEAT, KINSHIP], favor: 0 })
        leaveWith(s, HOSPITALITY)
        pick(s, 'c2')
        const nomad = s.favorBank[Suit.Nomad]
        answered(s, bankAnswer(Suit.Order), DANA)
        expect(s.favorBank[Suit.Order]).toBe(2)
        expect(s.favorBank[Suit.Nomad]).toBe(nomad + 1)
        expect(dana(s).favor).toBe(0)
    })
})

describe('R-11.7-H2 — Hospitality with the pick’s other answers and cards', () => {
    it('Toll Roads at the pick: the toll first, then the bank', () => {
        const s = table()
        leaveWith(s, HOSPITALITY)
        pick(s, 'h2')
        expect(queue(s)).toEqual([[PowerQuestionKind.PayTravelToll, DANA]])
        const paid = answered(s, { kind: PowerQuestionKind.PayTravelToll, pay: true }, DANA)
        expect(paid.metadata?.woodPick).toMatchObject({ siteId: 'h2', supplySpent: 2 })
        expect(paid.metadata?.tollMove).toBeDefined()
        expect(dana(s)).toMatchObject({ siteId: 'h2', supply: 2, favor: 2 })
        expect(s.pendingQuestions?.queue).toMatchObject([{ kind: PowerQuestionKind.HospitalityBank, askedPlayerId: DANA, siteId: 'h2', banks: [Suit.Order, Suit.Nomad] }])
        const gained = answered(s, bankAnswer(Suit.Order), DANA)
        expect(dana(s).favor).toBe(3)
        expect(gained.metadata?.summary).toBe(GAINED_ORDER)
    })

    it('Way Station at the pick: its question first, then the bank', () => {
        const s = table()
        leaveWith(s, HOSPITALITY)
        pick(s, 'p2')
        expect(queue(s)).toEqual([[PowerQuestionKind.WayStationFavor, DANA]])
        const given = answered(s, { kind: PowerQuestionKind.WayStationFavor, give: true }, DANA)
        expect(given.metadata?.woodPick).toMatchObject({ siteId: 'p2', supplySpent: 0, chooserPlayerId: RHYS, notes: ['Way Station: paid ann 1 favor'] })
        expect(dana(s)).toMatchObject({ siteId: 'p2', supply: 4, favor: 2 })
        expect(s.pendingQuestions?.queue).toMatchObject([{ kind: PowerQuestionKind.HospitalityBank, siteId: 'p2', banks: [Suit.Order, Suit.Nomad] }])
        const gained = answered(s, bankAnswer(Suit.Nomad), DANA)
        expect(dana(s).favor).toBe(3)
        expect(gained.metadata?.summary).toBe(GAINED_NOMAD)
    })

    it('a stay: Dana did not travel, so nothing is gained or asked', () => {
        // Only the Plains are payable with Forest Paths' favor placed; nothing without it.
        const s = table({ advisers: [HOSPITALITY, COUNCIL_SEAT, PATHS], supply: 1, favor: 1 })
        // The Plains hold Wolves (a Beast site); no Way Station, whose favor would open the Great Slums.
        s.denizensBySite = { ...s.denizensBySite, c1: ['denizen.beast.wolves'], p2: [] }
        leaveWith(s, PATHS, HOSPITALITY)
        const stayed = answered(s, { kind: PowerQuestionKind.ShroudedWoodDestination, stay: true }, RHYS)
        expect(stayed.metadata?.woodStay).toEqual({ travelerPlayerId: DANA, siteId: 'p1' })
        expect(dana(s)).toMatchObject({ siteId: 'p1', supply: 1, favor: 0 })
        expect(queue(s)).toEqual([])
    })

    it('the Dragonskin Drum also declared: its warband at the arrival, then the bank', () => {
        const s = table({ relics: [DRUM] })
        leaveWith(s, DRUM, HOSPITALITY)
        const picked = pick(s, 'c2')
        expect(dana(s).warbandsOnBoard[DANA]).toBe(4)
        expect(picked.metadata?.woodPick?.notes).toEqual([expect.stringMatching(/^Dragonskin Drum: /)])
        expect(queue(s)).toEqual([[PowerQuestionKind.HospitalityBank, DANA]])
        expect(answered(s, bankAnswer(Suit.Order), DANA).metadata?.summary).toBe(GAINED_ORDER)
    })

    it('Tents also declared: it sets the price in Dana’s region, and the bank follows', () => {
        const s = table({ advisers: [HOSPITALITY, COUNCIL_SEAT, TENTS] })
        s.denizensBySite = { ...s.denizensBySite, p3: [ORACLE, BEAR_TRAPS] }
        leaveWith(s, TENTS, HOSPITALITY)
        const picked = pick(s, 'p3')
        expect(dana(s)).toMatchObject({ siteId: 'p3', supply: 4 })
        expect(picked.metadata?.woodPick).toMatchObject({ siteId: 'p3', supplySpent: 0, pricedBy: [TENTS] })
        expect(queue(s)).toEqual([[PowerQuestionKind.HospitalityBank, DANA]])
        expect(answered(s, bankAnswer(Suit.Order), DANA).metadata?.summary).toBe(GAINED_ORDER)
    })

    it('Special Envoy also declared: the Act Phase ends after the bank is answered, not before', () => {
        const game = testGame([DANA, RHYS, ANN])
        const start = table({ advisers: [HOSPITALITY, COUNCIL_SEAT, ENVOY] }).dehydrate()
        const left = engine.runNext(buildAction(Travel, { playerId: DANA, modifiers: [modifierUse(ENVOY), hospitality] }), structuredClone(start), game)
        const picked = engine.runNext(answer(pickAnswer('c2'), RHYS), left.updatedState, game)
        expect(picked.updatedState.machineState).toBe(MachineState.PowerQuestion)
        expect(picked.processedActions.map((a) => a.type)).not.toContain(ActionType.CompleteRest)
        expect(picked.updatedState.pendingQuestions?.queue.map((q) => q.kind)).toEqual([PowerQuestionKind.HospitalityBank])
        expect(picked.processedActions[0]).toMatchObject({ metadata: { woodPick: { siteId: 'c2', supplySpent: 0, notes: ["Special Envoy ends dana's Act Phase"] } } })
        const gained = engine.runNext(answer(bankAnswer(Suit.Order), DANA), picked.updatedState, game)
        expect(gained.processedActions[0]).toMatchObject({ metadata: { summary: GAINED_ORDER, resumeMachineState: MachineState.RestPhase } })
        expect(gained.processedActions.map((a) => a.type)).toContain(ActionType.CompleteRest)
    })

    it('the Travel, the pick and the bank replay exactly', () => {
        const game = testGame([DANA, RHYS, ANN])
        const start = table().dehydrate()
        const left = engine.runNext(buildAction(Travel, { playerId: DANA, modifiers: [hospitality] }), structuredClone(start), game)
        const picked = engine.runNext(answer(pickAnswer('c2'), RHYS), left.updatedState, game)
        const gained = engine.runNext(answer(bankAnswer(Suit.Nomad), DANA), picked.updatedState, game)
        expect(gained.updatedState.machineState).toBe(MachineState.ActPhase)
        let replayed = structuredClone(start)
        for (const action of [...left.processedActions, ...picked.processedActions, ...gained.processedActions]) {
            replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
        }
        expect(replayed).toEqual(gained.updatedState)
    })
})

describe('R-X.4 — before revision 15 Hospitality is refused at the Wood, as every card is', () => {
    it('refused with no bank and with one', () => {
        const s = table({ revision: before })
        for (const use of [hospitality, modifierUse(HOSPITALITY, [bank(Suit.Nomad)])]) {
            expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, { modifiers: [use] })).toBe(
                "nothing is declared on a Travel whose destination the Shrouded Wood's ruler chooses"
            )
        }
        expect(woodPicksBeforeTravel(s, DANA, [hospitality])).toEqual([])
    })
})

describe('R-11.7-H2 — Hospitality at the Wood on the seats’ own views', () => {
    const view = (playerId: string): Visibility.Perspective => ({ kind: 'player', playerId })
    const ownView = (s: HydratedOathGameState, playerId: string) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view(playerId))), view(playerId))

    function sameOnOwnView<T>(s: HydratedOathGameState, playerId: string, check: (state: HydratedOathGameState) => T, expected: T) {
        const server = JSON.stringify(s.dehydrate())
        const seen = JSON.stringify(served(s, view(playerId)))
        expect(check(s)).toEqual(expected)
        expect(check(ownView(s, playerId))).toEqual(expected)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
        expect(JSON.stringify(served(s, view(playerId)))).toBe(seen)
    }

    it('Dana’s declaration check, the Travel tile and the panel’s picks', () => {
        const s = table()
        sameOnOwnView(s, DANA, (state) => HydratedTravel.reasonCannotLeaveShroudedWood(state, DANA, { modifiers: [hospitality] }), undefined)
        sameOnOwnView(s, DANA, (state) => HydratedTravel.canDoTravel(state, DANA), true)
        sameOnOwnView(s, DANA, (state) => woodPicksBeforeTravel(state, DANA, [hospitality]).length, 7)
        // The panel lists Hospitality where a pick's banks would give its favor.
        sameOnOwnView(s, DANA, (state) => banksOnArrival(state, DANA, stored(HOSPITALITY), 'c2'), [Suit.Order, Suit.Nomad])
        sameOnOwnView(s, DANA, (state) => banksOnArrival(state, DANA, stored(HOSPITALITY), 'h1'), [])
    })

    it('the bank question as Dana is served it, and the answers checked there; Rhys sees the same banks', () => {
        const s = table()
        leaveWith(s, HOSPITALITY)
        pick(s, 'c2')
        sameOnOwnView(s, DANA, (state) => state.pendingQuestions?.queue[0], s.pendingQuestions?.queue[0])
        sameOnOwnView(s, RHYS, (state) => state.pendingQuestions?.queue[0], s.pendingQuestions?.queue[0])
        sameOnOwnView(s, DANA, (state) => HydratedAnswerQuestion.reasonCannotAnswer(state, DANA, bankAnswer(Suit.Order)), undefined)
        sameOnOwnView(s, DANA, (state) => HydratedAnswerQuestion.reasonCannotAnswer(state, DANA, bankAnswer(Suit.Beast)), 'beast is not a bank Hospitality matches at c2: choose order or nomad')
    })
})
