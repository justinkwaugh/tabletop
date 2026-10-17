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
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { bank, modifierUse } from '../testing/choices.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { DECADENT } from '../util/reliquaryTraits.js'
import { reliquarySlotId } from '../util/setup.js'
import { askWoodPickForPower, payableWoodPicks } from '../util/shroudedWood.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

/**
 * Law 7.4, 7.4.1 — optional modifiers are declared at the start of the action; 7.1.2 — a card's
 * cost is paid when it is used. Tents' Q&A: "You must choose whether to use Tents at the start of the
 * action. If the ruler makes you travel to another region, Tents does not work." Forest Paths' Q&A:
 * "If the enemy ruler chooses that you travel to a Beast site, you pay no Supply ... If you have less
 * than 2 Supply, the enemy could either force your Travel action to fail, or could let you travel to
 * a Beast site for free."
 */
const TENTS = 'denizen.nomad.tents'
const PATHS = 'denizen.beast.forest-paths'
const STEED = 'denizen.nomad.a-fast-steed'
const ENVOY = 'denizen.nomad.special-envoy'
const HOSPITALITY = 'denizen.nomad.hospitality'
const DRUM = 'relic.dragonskin-drum'
const TOLL_ROADS = 'denizen.order.toll-roads'
const WOLVES = 'denizen.beast.wolves'
const STORYTELLER = 'denizen.hearth.storyteller'
const WHISTLE = 'relic.whistle'
const TYRANT = 'denizen.order.tyrant'

const DANA = 'dana'
const RHYS = 'rhys'
const atRevision = OathRevision.EngineFixes11
const before = OathRevision.EngineFixes10

/** Cradle c1 (Wolves: a Beast site), c2; Provinces p1 (the Wood), p2, p3; Hinterland h1 to h3. */
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
    warbands?: number
    advisers?: string[]
    relics?: string[]
    /** Toll Roads at p2, and Rhys's warbands at these sites besides the Wood. */
    tollRoads?: boolean
    rhysAlsoRules?: string[]
}

/** Dana (an Exile) stands at the Shrouded Wood p1, which Rhys (an Exile, so an enemy) rules. */
function table({ revision = atRevision, supply = 4, favor = 3, warbands = 3, advisers = [], relics = [], tollRoads = false, rhysAlsoRules = [] }: Scene = {}) {
    const ruled = Object.fromEntries(rhysAlsoRules.map((siteId) => [siteId, { [RHYS]: 1 }]))
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Purple,
                status: PlayerStatus.Exile,
                siteId: 'p1',
                supply,
                favor,
                secrets: 1,
                relicIds: relics,
                warbandsOnBoard: { [DANA]: warbands },
                warbandsInPersonalBank: { [DANA]: 6 },
                advisers: [...advisers.map((cardId) => ({ cardId, faceUp: true })), { cardId: STORYTELLER, faceUp: false }]
            }),
            testPlayer({ playerId: RHYS, color: Color.Red, status: PlayerStatus.Exile, siteId: 'h3', supply: 4, favor: 1, warbandsOnBoard: { [RHYS]: 3 } })
        ]),
        {
            oathRevision: revision,
            siteCards: SITES,
            denizensBySite: { c1: [WOLVES], c2: [], p1: [], p2: tollRoads ? [TOLL_ROADS] : [], p3: [], h1: [], h2: [], h3: [] },
            warbandsBySite: { p1: { [RHYS]: 1 }, ...ruled }
        }
    )
    openTurn(s, DANA)
    return s
}

const leave = (...cards: string[]) =>
    buildAction(Travel, { playerId: DANA, modifiers: cards.map((cardId) => modifierUse(cardId)) })
const pickAnswer = (siteId: string): QuestionAnswer => ({ kind: PowerQuestionKind.ShroudedWoodDestination, siteId })
const stayAnswer: QuestionAnswer = { kind: PowerQuestionKind.ShroudedWoodDestination, stay: true }
const answer = (a: QuestionAnswer, playerId = RHYS) => buildAction(AnswerQuestion, { playerId, answer: a })
/** A declared card as the ruler's question stores it. */
const stored = (cardId: string) => ({ cardId, powerIndex: modifierUse(cardId).powerIndex })

function leaveWith(s: HydratedOathGameState, ...cards: string[]) {
    const travel = new HydratedTravel(leave(...cards))
    travel.apply(s)
    return travel
}

function pick(s: HydratedOathGameState, siteId: string) {
    const picked = new HydratedAnswerQuestion(answer(pickAnswer(siteId)))
    picked.apply(s)
    return picked
}

const dana = (s: HydratedOathGameState) => s.getPlayerState(DANA)
const danaWarbands = (s: HydratedOathGameState) => dana(s).warbandsOnBoard[DANA] ?? 0
const priced = (s: HydratedOathGameState, ...cards: string[]) =>
    payableWoodPicks(s, DANA, { free: false, modifiers: cards.map((cardId) => modifierUse(cardId)) }).map((p) => [p.siteId, p.cost, p.foldedBy])

describe('R-11.7-H2 — Tents on a Travel out of an enemy’s Shrouded Wood', () => {
    it('is declared at the start and its favor placed then, before Rhys picks; the question carries it', () => {
        const s = table({ advisers: [TENTS] })
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, { modifiers: [modifierUse(TENTS)] })).toBeUndefined()
        const travel = leaveWith(s, TENTS)
        expect(dana(s)).toMatchObject({ siteId: 'p1', supply: 4, favor: 2 })
        expect(s.tokensOn(TENTS).favor).toBe(1)
        expect(travel.metadata).toMatchObject({ destinationChooser: RHYS, supplySpent: 0, modifiers: [TENTS] })
        expect(s.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.ShroudedWoodDestination,
            askedPlayerId: RHYS,
            travel: { free: false, modifiers: [stored(TENTS)] }
        })
        // The Travel reveals nothing, so it can be undone before Rhys answers, its card's favor with it.
        expect(travel.revealsInfo).toBe(false)
    })

    it('Tyrant still fires at the pick: Tents makes Rhys’s p2 free, and a warband there dies', () => {
        const s = table({ advisers: [TENTS, TYRANT], rhysAlsoRules: ['p2'] })
        leaveWith(s, TENTS)
        pick(s, 'p2')
        expect(dana(s)).toMatchObject({ siteId: 'p2', supply: 4 })
        expect(s.warbandsBySite.p2?.[RHYS] ?? 0).toBe(0)
    })

    it('Rhys picks a site in Dana’s region: no Supply; another region: the Wood’s 2, and Tents’ favor stays paid', () => {
        for (const [siteId, paid] of [['p2', 0], ['p3', 0], ['h1', 2], ['c2', 2]] as const) {
            const s = table({ advisers: [TENTS] })
            leaveWith(s, TENTS)
            pick(s, siteId)
            expect(dana(s), siteId).toMatchObject({ siteId, supply: 4 - paid, favor: 2 })
            expect(s.pendingQuestions?.queue ?? []).toEqual([])
        }
    })

    it('each pick is priced with the card that changed it named', () => {
        const s = table({ advisers: [TENTS] })
        leaveWith(s, TENTS)
        const prices = priced(s, TENTS)
        expect(prices).toContainEqual(['p2', 0, [TENTS]])
        expect(prices).toContainEqual(['h1', 2, []])
    })
})

describe('R-11.7-H2 — Forest Paths, A Fast Steed and Special Envoy at Rhys’s pick', () => {
    it('Forest Paths: the Beast site Rhys picks is free; any other costs 2', () => {
        for (const [siteId, paid] of [['c1', 0], ['c2', 2]] as const) {
            const s = table({ advisers: [PATHS] })
            leaveWith(s, PATHS)
            expect(priced(s, PATHS)).toContainEqual(['c1', 0, [PATHS]])
            pick(s, siteId)
            expect(dana(s), siteId).toMatchObject({ siteId, supply: 4 - paid, favor: 2 })
        }
    })

    it('A Fast Steed: free with three warbands on Dana’s board, the Wood’s 2 with four', () => {
        for (const [warbands, paid] of [[3, 0], [4, 2]] as const) {
            const s = table({ advisers: [STEED], warbands })
            leaveWith(s, STEED)
            pick(s, 'h1')
            expect(dana(s), `${warbands} warbands`).toMatchObject({ siteId: 'h1', supply: 4 - paid, favor: 2 })
        }
    })

    it('Special Envoy: no Supply, and the Act Phase ends once Rhys’s pick has landed the pawn', () => {
        const game = testGame([DANA, RHYS])
        const start = table({ advisers: [ENVOY] }).dehydrate()
        const left = engine.runNext(leave(ENVOY), structuredClone(start), game)
        expect(left.updatedState.machineState).toBe(MachineState.PowerQuestion)
        const picked = engine.runNext(answer(pickAnswer('h1')), left.updatedState, game)
        // The pick spends nothing and ends the Act Phase: the Rest follows at once (nothing to choose there).
        expect(picked.processedActions[0]).toMatchObject({
            type: ActionType.AnswerQuestion,
            metadata: { woodPick: { siteId: 'h1', supplySpent: 0 }, resumeMachineState: MachineState.RestPhase }
        })
        expect(picked.processedActions.map((a) => a.type)).toContain(ActionType.CompleteRest)
        expect(picked.updatedState.players.find((p) => p.playerId === DANA)?.siteId).toBe('h1')

        // Control: the same Travel without Special Envoy pays 2 and leaves the Act Phase open.
        const plain = engine.runNext(leave(), structuredClone(table({ advisers: [ENVOY] }).dehydrate()), game)
        const plainPick = engine.runNext(answer(pickAnswer('h1')), plain.updatedState, game)
        expect(plainPick.updatedState.players.find((p) => p.playerId === DANA)).toMatchObject({ siteId: 'h1', supply: 2 })
        expect(plainPick.processedActions.map((a) => a.type)).not.toContain(ActionType.CompleteRest)
        expect(plainPick.updatedState.machineState).toBe(MachineState.ActPhase)
    })

    it('on a free Travel (the Brass Horse’s "travel as normal") Tents is still legal and paid; every pick is free', () => {
        const s = table({ advisers: [TENTS] })
        dana(s).freeTravelAtAction = s.actionCount
        leaveWith(s, TENTS)
        expect(dana(s).favor).toBe(2)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ travel: { free: true, modifiers: [stored(TENTS)] } })
        pick(s, 'h1')
        expect(dana(s)).toMatchObject({ siteId: 'h1', supply: 4 })
    })

    it('Toll Roads at the pick is still asked first, though Tents spends no Supply there (a card’s power, not a site’s)', () => {
        const s = table({ advisers: [TENTS], tollRoads: true, rhysAlsoRules: ['p2'] })
        leaveWith(s, TENTS)
        pick(s, 'p2')
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.PayTravelToll, askedPlayerId: DANA, travel: { free: false, modifiers: [stored(TENTS)] } })
        new HydratedAnswerQuestion(answer({ kind: PowerQuestionKind.PayTravelToll, pay: true }, DANA)).apply(s)
        expect(dana(s)).toMatchObject({ siteId: 'p2', supply: 4, favor: 1 })
        expect(s.getPlayerState(RHYS).favor).toBe(2)
    })

    it('Decadent still folds: a Decadent Chancellor with Tents pays nothing into the Provinces and 3 into the Hinterland', () => {
        const s = testState(
            [
                testPlayer({ playerId: DANA, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1', supply: 5, favor: 2, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 }, advisers: [{ cardId: TENTS, faceUp: true }] }),
                testPlayer({ playerId: RHYS, color: Color.Red, siteId: 'h3', supply: 4, warbandsOnBoard: { [RHYS]: 3 } })
            ],
            {
                oathRevision: atRevision,
                chancellorPlayerId: DANA,
                reliquary: [0, 2, 3].map((i) => ({ slotId: reliquarySlotId(i) })),
                siteCards: SITES,
                denizensBySite: { c1: [], c2: [], p1: [], p2: [], p3: [], h1: [], h2: [], h3: [] },
                warbandsBySite: { p1: { [RHYS]: 1 } }
            }
        )
        openTurn(s, DANA)
        leaveWith(s, TENTS)
        const prices = priced(s, TENTS)
        expect(prices).toContainEqual(['p2', 0, [TENTS]])
        expect(prices).toContainEqual(['h1', 3, [DECADENT]])
        pick(s, 'h1')
        expect(dana(s)).toMatchObject({ siteId: 'h1', supply: 2 })
    })
})

describe('R-11.7-H2 — the Dragonskin Drum is declared like any other Travel card', () => {
    it('declared: a warband after Rhys’s pick', () => {
        const s = table({ relics: [DRUM] })
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, { modifiers: [modifierUse(DRUM)] })).toBeUndefined()
        leaveWith(s, DRUM)
        expect(danaWarbands(s)).toBe(3)
        pick(s, 'p2')
        expect(dana(s).siteId).toBe('p2')
        expect(danaWarbands(s)).toBe(4)
        expect(s.pendingQuestions?.queue ?? []).toEqual([])
    })

    it('not declared: nothing, as on a normal Travel', () => {
        const s = table({ relics: [DRUM] })
        leaveWith(s)
        pick(s, 'p2')
        expect(danaWarbands(s)).toBe(3)
        expect(s.pendingQuestions?.queue ?? []).toEqual([])
    })

    it('declared, and Rhys keeps Dana in place: no warband', () => {
        const s = table({ relics: [DRUM], advisers: [PATHS], supply: 1, favor: 1 })
        leaveWith(s, PATHS, DRUM)
        new HydratedAnswerQuestion(answer(stayAnswer)).apply(s)
        expect(dana(s)).toMatchObject({ siteId: 'p1', supply: 1, favor: 0 })
        expect(danaWarbands(s)).toBe(3)
    })
})

describe('R-11.7-H2 — opening the Travel, and what a declaration must afford', () => {
    it('with 1 Supply and 1 favor, Forest Paths opens the tile: only the Beast site is payable once its favor is placed', () => {
        const s = table({ advisers: [PATHS], supply: 1, favor: 1 })
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, {})).toMatch(/you can pay for no site/)
        expect(HydratedTravel.canDoTravel(s, DANA)).toBe(true)
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, { modifiers: [modifierUse(PATHS)] })).toBeUndefined()
        leaveWith(s, PATHS)
        expect(dana(s).favor).toBe(0)
        expect(priced(s, PATHS)).toEqual([['c1', 0, [PATHS]]])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, RHYS, pickAnswer('c2'))).toBe('dana cannot pay the 2 Supply to travel to c2: they have 1')
        // Control: with no card that helps, the tile stays shut.
        expect(HydratedTravel.canDoTravel(table({ supply: 1, favor: 1 }), DANA)).toBe(false)
    })

    it('a card whose cost Dana cannot pay is refused', () => {
        const s = table({ advisers: [TENTS], favor: 0 })
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, { modifiers: [modifierUse(TENTS)] })).toBe('costs 1 favor, player has 0')
        expect(() => leaveWith(s, TENTS)).toThrow(/costs 1 favor/)
    })

    it('the favor a card places is not there for a toll: Tents’ free sites all take Toll Roads’ favor, so the declaration is refused with 1 favor and accepted with 2', () => {
        const scene = { advisers: [TENTS], supply: 0, tollRoads: true, rhysAlsoRules: ['p2', 'p3'] }
        const s = table({ ...scene, favor: 1 })
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, { modifiers: [modifierUse(TENTS)] })).toMatch(/you can pay for no site/)
        expect(HydratedTravel.canDoTravel(s, DANA)).toBe(false)
        const two = table({ ...scene, favor: 2 })
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(two, DANA, { modifiers: [modifierUse(TENTS)] })).toBeUndefined()
        expect(HydratedTravel.canDoTravel(two, DANA)).toBe(true)
    })

    it('Hospitality is refused: its bank depends on the site, which is not picked yet; tolls and a flip stay refused', () => {
        const s = table({ advisers: [HOSPITALITY] })
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, { modifiers: [modifierUse(HOSPITALITY, [bank(Suit.Nomad)])] })).toMatch(/depends on the site/)
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, { tolls: [TOLL_ROADS] })).toMatch(/no toll or flip is declared/)
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, { flipSecret: true })).toMatch(/no toll or flip is declared/)
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, { siteId: 'p2' })).toBe("the Shrouded Wood's ruler chooses where you go")
    })
})

describe('R-11.7-H2 — "Dana stays"', () => {
    it('Rhys may keep Dana in place when nothing is payable without Forest Paths: the Travel is spent, the favor stays placed, no Supply', () => {
        const s = table({ advisers: [PATHS], supply: 1, favor: 1 })
        leaveWith(s, PATHS)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, RHYS, stayAnswer)).toBeUndefined()
        const stayed = new HydratedAnswerQuestion(answer(stayAnswer))
        stayed.apply(s)
        expect(dana(s)).toMatchObject({ siteId: 'p1', supply: 1, favor: 0 })
        expect(stayed.metadata?.woodPick).toBeUndefined()
        expect(stayed.metadata?.summary).toBe('kept dana at p1')
        expect(s.pendingQuestions?.queue ?? []).toEqual([])
    })

    it('refused while Dana could pay for a site without the card, on a Travel with no card, and with a site named as well', () => {
        const s = table({ advisers: [TENTS] })
        leaveWith(s, TENTS)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, RHYS, stayAnswer)).toBe('dana can pay for a site without the cards they declared, so the ruler names one')
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, RHYS, { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'p2', stay: true })).toBe('name a site or keep dana in place, not both')
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, RHYS, { kind: PowerQuestionKind.ShroudedWoodDestination })).toBe('name the site dana travels to')
        const plain = table()
        leaveWith(plain)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(plain, RHYS, stayAnswer)).toBe('the ruler names where dana goes')
    })

    it('a power-made pick (R-11.7-H1) has no Travel behind it: no prices, no stay', () => {
        const s = table({ supply: 0, favor: 0 })
        askWoodPickForPower(s, 'chancellor', RHYS, DANA, { powerCardId: WHISTLE, userPlayerId: 'chancellor' })
        expect(s.pendingQuestions?.queue[0]).not.toHaveProperty('travel')
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, RHYS, stayAnswer)).toBe('the ruler names where dana goes')
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, RHYS, pickAnswer('h1'))).toBeUndefined()
    })

    it('Special Envoy declared and Dana kept in place: they did not travel, so the Act Phase goes on', () => {
        const game = testGame([DANA, RHYS])
        const left = engine.runNext(leave(ENVOY), structuredClone(table({ advisers: [ENVOY], supply: 1, favor: 0 }).dehydrate()), game)
        const stayed = engine.runNext(answer(stayAnswer), left.updatedState, game)
        expect(stayed.updatedState.players.find((p) => p.playerId === DANA)).toMatchObject({ siteId: 'p1', supply: 1 })
        expect(stayed.updatedState.machineState).toBe(MachineState.ActPhase)
    })
})

describe('R-X.4 — before revision 15 the Wood’s Travel declares nothing', () => {
    it('Tents, Forest Paths, the Drum and Special Envoy are refused; the tile opens only as it did', () => {
        for (const card of [TENTS, PATHS, ENVOY]) {
            const s = table({ revision: before, advisers: [card] })
            expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, { modifiers: [modifierUse(card)] }), card).toBe(
                "nothing is declared on a Travel whose destination the Shrouded Wood's ruler chooses"
            )
        }
        const drum = table({ revision: before, relics: [DRUM] })
        expect(() => leaveWith(drum, DRUM)).toThrow(/nothing is declared/)
        expect(HydratedTravel.canDoTravel(table({ revision: before, advisers: [PATHS], supply: 1, favor: 1 }), DANA)).toBe(false)
    })

    it('a Travel and pick replay unchanged at revision 14 and at 15', () => {
        for (const [revision, cards, supply] of [[before, [], 2], [atRevision, [TENTS], 4]] as const) {
            const start = table({ revision, advisers: [TENTS] }).dehydrate()
            const game = testGame([DANA, RHYS])
            const left = engine.runNext(leave(...cards), structuredClone(start), game)
            const picked = engine.runNext(answer(pickAnswer('p2')), left.updatedState, game)
            expect(picked.updatedState.players.find((p) => p.playerId === DANA)).toMatchObject({ siteId: 'p2', supply })
            let replayed = structuredClone(start)
            for (const action of [...left.processedActions, ...picked.processedActions]) {
                replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            }
            expect(replayed).toEqual(picked.updatedState)
        }
    })
})

describe('R-11.7-H2 on the seats’ own views', () => {
    const view = (playerId: string): Visibility.Perspective => ({ kind: 'player', playerId })
    const ownView = (s: HydratedOathGameState, playerId: string) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view(playerId))), view(playerId))

    /** The same answer on the server and on the seat's view; neither changes the state or what the seat is served. */
    function sameOnOwnView<T>(s: HydratedOathGameState, playerId: string, check: (state: HydratedOathGameState) => T, expected: T) {
        const server = JSON.stringify(s.dehydrate())
        const seen = JSON.stringify(served(s, view(playerId)))
        expect(check(s)).toEqual(expected)
        expect(check(ownView(s, playerId))).toEqual(expected)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
        expect(JSON.stringify(served(s, view(playerId)))).toBe(seen)
    }

    it('Rhys’s offered sites and the stay check, with Dana’s Forest Paths counted', () => {
        // Dana holds a facedown adviser, so Rhys's view does not hold everything.
        const s = table({ advisers: [PATHS], supply: 1, favor: 1 })
        leaveWith(s, PATHS)
        sameOnOwnView(s, RHYS, (state) => priced(state, PATHS), [['c1', 0, [PATHS]]])
        sameOnOwnView(s, RHYS, (state) => HydratedAnswerQuestion.reasonCannotAnswer(state, RHYS, stayAnswer), undefined)
        sameOnOwnView(s, RHYS, (state) => HydratedAnswerQuestion.reasonCannotAnswer(state, RHYS, pickAnswer('c2')), 'dana cannot pay the 2 Supply to travel to c2: they have 1')
    })

    it('Dana’s declaration check and the Travel tile', () => {
        const s = table({ advisers: [PATHS], supply: 1, favor: 1 })
        sameOnOwnView(s, DANA, (state) => HydratedTravel.reasonCannotLeaveShroudedWood(state, DANA, { modifiers: [modifierUse(PATHS)] }), undefined)
        sameOnOwnView(s, DANA, (state) => HydratedTravel.canDoTravel(state, DANA), true)
        const d = s.dehydrate()
        d.turnManager = { series: [{ type: 'turn', playerId: DANA, start: 0 }], turnOrder: [DANA, RHYS, 'chancellor'], turnCounts: { [DANA]: 1, [RHYS]: 0, chancellor: 0 } }
        d.activePlayerIds = [DANA]
        const game = { ...testGame([DANA, RHYS, 'chancellor']), hotseat: false, protectedInformation: true as const }
        const server = engine.getValidActionTypesForPlayer(game, d, DANA)
        expect(server).toContain(ActionType.Travel)
        expect(engine.getValidActionTypesForPlayer(game, served(d, view(DANA)), DANA, { perspective: view(DANA) })).toEqual(server)
    })
})
