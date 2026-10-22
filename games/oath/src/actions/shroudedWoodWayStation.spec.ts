import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedTravel, Travel } from './travel.js'
import { AnswerQuestion, HydratedAnswerQuestion } from './answerQuestion.js'
import { OathVisibility } from '../definition/runtime.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { payableWoodPicks } from '../util/shroudedWood.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

/**
 * Way Station (persistent): "Spend no Supply if you're traveling to this site and either rule Way
 * Station or choose to give [favor] to its ruler." A persistent power takes effect at the time it
 * describes (Law 7.1.4), so out of an enemy's Shrouded Wood the choice is the traveller's at the pick.
 */
const WAY_STATION = 'denizen.nomad.way-station'
const TOLL_ROADS = 'denizen.order.toll-roads'
const STORYTELLER = 'denizen.hearth.storyteller'

const DANA = 'dana'
const RHYS = 'rhys'
const ANN = 'ann'
const atRevision = OathRevision.EngineFixes11
const before = OathRevision.EngineFixes10

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
    /** Who rules p2, where Way Station stands. */
    p2Ruler?: 'dana' | 'ann' | 'bandits'
    tollRoads?: boolean
}

/** Dana (an Exile) stands at the Shrouded Wood p1, which Rhys (an Exile) rules; Way Station is at p2. */
function table({
    revision = atRevision,
    supply = 4,
    favor = 3,
    p2Ruler = 'ann',
    tollRoads = false
}: Scene = {}) {
    // R-10.3 — the bandits rule a faceup site no warband holds.
    const p2Warbands = p2Ruler === 'bandits' ? {} : { [p2Ruler]: 2 }
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Purple,
                status: PlayerStatus.Exile,
                siteId: 'p1',
                supply,
                favor,
                warbandsOnBoard: { [DANA]: 3 },
                advisers: [{ cardId: STORYTELLER, faceUp: false }]
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'h3',
                supply: 4,
                favor: 1,
                warbandsOnBoard: { [RHYS]: 3 }
            }),
            testPlayer({
                playerId: ANN,
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: 'h2',
                supply: 4,
                favor: 1,
                warbandsOnBoard: { [ANN]: 3 }
            })
        ]),
        {
            oathRevision: revision,
            siteCards: SITES,
            denizensBySite: {
                c1: [],
                c2: [],
                p1: [],
                p2: tollRoads ? [WAY_STATION, TOLL_ROADS] : [WAY_STATION],
                p3: [],
                h1: [],
                h2: [],
                h3: []
            },
            warbandsBySite: { p1: { [RHYS]: 1 }, p2: p2Warbands }
        }
    )
    openTurn(s, DANA)
    return s
}

const pickAnswer: QuestionAnswer = { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'p2' }
const answer = (a: QuestionAnswer, playerId: string) =>
    buildAction(AnswerQuestion, { playerId, answer: a })
const give = (yes: boolean): QuestionAnswer => ({
    kind: PowerQuestionKind.WayStationFavor,
    give: yes
})

function leaveAndPick(s: HydratedOathGameState) {
    new HydratedTravel(buildAction(Travel, { playerId: DANA })).apply(s)
    const picked = new HydratedAnswerQuestion(answer(pickAnswer, RHYS))
    picked.apply(s)
    return picked
}

const dana = (s: HydratedOathGameState) => s.getPlayerState(DANA)
const queue = (s: HydratedOathGameState) => s.pendingQuestions?.queue ?? []

describe('R-11.7-H3 — Way Station at the Shrouded Wood’s pick', () => {
    it('ruled by Dana: free, nothing asked, and payable with no Supply at all', () => {
        const s = table({ p2Ruler: 'dana' })
        leaveAndPick(s)
        expect(dana(s)).toMatchObject({ siteId: 'p2', supply: 4, favor: 3 })
        expect(queue(s)).toEqual([])

        const broke = table({ p2Ruler: 'dana', supply: 0 })
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(broke, DANA, {})).toBeUndefined()
        expect(
            payableWoodPicks(broke, DANA, { free: false }).map((p) => [
                p.siteId,
                p.cost,
                p.foldedBy
            ])
        ).toEqual([['p2', 0, [WAY_STATION]]])
        leaveAndPick(broke)
        expect(dana(broke)).toMatchObject({ siteId: 'p2', supply: 0 })
    })

    it('ruled by Ann, with 4 Supply and 3 favor: Dana is asked; Give sends Ann the favor and spends no Supply', () => {
        const s = table()
        const picked = leaveAndPick(s)
        expect(dana(s).siteId).toBe('p1')
        expect(queue(s)).toEqual([
            expect.objectContaining({
                kind: PowerQuestionKind.WayStationFavor,
                askedPlayerId: DANA,
                cardId: WAY_STATION,
                payeeId: ANN,
                siteId: 'p2',
                supplyCost: 2,
                chooserPlayerId: RHYS
            })
        ])
        expect(picked.metadata?.woodPick).toBeUndefined()
        const gave = new HydratedAnswerQuestion(answer(give(true), DANA))
        gave.apply(s)
        expect(dana(s)).toMatchObject({ siteId: 'p2', supply: 4, favor: 2 })
        expect(s.getPlayerState(ANN).favor).toBe(2)
        expect(gave.metadata?.woodPick).toMatchObject({
            siteId: 'p2',
            supplySpent: 0,
            chooserPlayerId: RHYS,
            notes: ['Way Station: paid ann 1 favor']
        })
    })

    it('Pay spends the Wood’s 2 Supply and gives nothing', () => {
        const s = table()
        leaveAndPick(s)
        new HydratedAnswerQuestion(answer(give(false), DANA)).apply(s)
        expect(dana(s)).toMatchObject({ siteId: 'p2', supply: 2, favor: 3 })
        expect(s.getPlayerState(ANN).favor).toBe(1)
    })

    it('with 1 Supply and 1 favor the site is payable, nothing is asked, and the favor is given', () => {
        const s = table({ supply: 1, favor: 1 })
        expect(payableWoodPicks(s, DANA, { free: false }).map((p) => p.siteId)).toEqual(['p2'])
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, {})).toBeUndefined()
        leaveAndPick(s)
        expect(queue(s)).toEqual([])
        expect(dana(s)).toMatchObject({ siteId: 'p2', supply: 1, favor: 0 })
        expect(s.getPlayerState(ANN).favor).toBe(2)
    })

    it('with no favor, nothing is asked and the Supply is paid', () => {
        const s = table({ favor: 0 })
        leaveAndPick(s)
        expect(queue(s)).toEqual([])
        expect(dana(s)).toMatchObject({ siteId: 'p2', supply: 2, favor: 0 })
    })

    it('ruled by the bandits: the favor is burned', () => {
        const s = table({ p2Ruler: 'bandits', supply: 1, favor: 1 })
        leaveAndPick(s)
        expect(dana(s)).toMatchObject({ siteId: 'p2', supply: 1, favor: 0 })
        expect(s.getPlayerState(ANN).favor).toBe(1)
    })

    it('with Toll Roads there too: the toll first, then Way Station, each a favor', () => {
        const s = table({ tollRoads: true })
        leaveAndPick(s)
        expect(queue(s)).toEqual([
            expect.objectContaining({ kind: PowerQuestionKind.PayTravelToll, askedPlayerId: DANA })
        ])
        new HydratedAnswerQuestion(
            answer({ kind: PowerQuestionKind.PayTravelToll, pay: true }, DANA)
        ).apply(s)
        expect(queue(s)).toEqual([
            expect.objectContaining({
                kind: PowerQuestionKind.WayStationFavor,
                askedPlayerId: DANA,
                payeeId: ANN,
                chooserPlayerId: RHYS
            })
        ])
        new HydratedAnswerQuestion(answer(give(true), DANA)).apply(s)
        expect(dana(s)).toMatchObject({ siteId: 'p2', supply: 4, favor: 1 })
        expect(s.getPlayerState(ANN).favor).toBe(3)
    })

    it('with Toll Roads there and 1 favor: the toll takes it, so the Supply is paid; with 1 Supply too, the site is not payable', () => {
        const s = table({ tollRoads: true, favor: 1 })
        leaveAndPick(s)
        new HydratedAnswerQuestion(
            answer({ kind: PowerQuestionKind.PayTravelToll, pay: true }, DANA)
        ).apply(s)
        expect(queue(s)).toEqual([])
        expect(dana(s)).toMatchObject({ siteId: 'p2', supply: 2, favor: 0 })

        const poor = table({ tollRoads: true, favor: 1, supply: 1 })
        expect(payableWoodPicks(poor, DANA, { free: false }).map((p) => p.siteId)).not.toContain(
            'p2'
        )
    })

    it('the answer must be one Dana can make', () => {
        const s = table()
        leaveAndPick(s)
        dana(s).favor = 0
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, DANA, give(true))).toBe(
            'giving takes 1 favor and you have 0'
        )
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, RHYS, give(true))).toBe(
            "the question is dana's to answer"
        )
    })
})

describe('R-X.4 — before revision 15 Way Station is ignored at the Wood’s pick', () => {
    it('a ruled Way Station costs the Wood’s 2, and with no Supply the Travel is refused', () => {
        const s = table({ revision: before, p2Ruler: 'dana' })
        leaveAndPick(s)
        expect(dana(s)).toMatchObject({ siteId: 'p2', supply: 2 })
        expect(
            HydratedTravel.reasonCannotLeaveShroudedWood(
                table({ revision: before, p2Ruler: 'dana', supply: 0 }),
                DANA,
                {}
            )
        ).toMatch(/you can pay for no site/)
    })

    it('an enemy’s Way Station asks nothing and takes the Supply', () => {
        const s = table({ revision: before })
        leaveAndPick(s)
        expect(queue(s)).toEqual([])
        expect(dana(s)).toMatchObject({ siteId: 'p2', supply: 2, favor: 3 })
    })

    it('the Travel, the pick and the favor replay unchanged at revision 15, and at 14', () => {
        for (const revision of [before, atRevision]) {
            const start = table({ revision }).dehydrate()
            const game = testGame([DANA, RHYS, ANN])
            const left = engine.runNext(
                buildAction(Travel, { playerId: DANA }),
                structuredClone(start),
                game
            )
            const picked = engine.runNext(answer(pickAnswer, RHYS), left.updatedState, game)
            const steps = [...left.processedActions, ...picked.processedActions]
            let end = picked.updatedState
            if (revision === atRevision) {
                const gave = engine.runNext(answer(give(true), DANA), picked.updatedState, game)
                steps.push(...gave.processedActions)
                end = gave.updatedState
            }
            expect(end.players.find((p) => p.playerId === DANA)).toMatchObject({
                siteId: 'p2',
                supply: revision === atRevision ? 4 : 2
            })
            let replayed = structuredClone(start)
            for (const action of steps)
                replayed = engine.run(
                    structuredClone(action),
                    replayed,
                    game,
                    RunMode.Single
                ).updatedState
            expect(replayed).toEqual(end)
        }
    })
})

describe('R-11.7-H3 on the seats’ own views', () => {
    const view = (playerId: string): Visibility.Perspective => ({ kind: 'player', playerId })
    const ownView = (s: HydratedOathGameState, playerId: string) =>
        OathVisibility.state.guardForExecution(
            new HydratedOathGameState(served(s, view(playerId))),
            view(playerId)
        )

    function sameOnOwnView<T>(
        s: HydratedOathGameState,
        playerId: string,
        check: (state: HydratedOathGameState) => T,
        expected: T
    ) {
        const server = JSON.stringify(s.dehydrate())
        const seen = JSON.stringify(served(s, view(playerId)))
        expect(check(s)).toEqual(expected)
        expect(check(ownView(s, playerId))).toEqual(expected)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
        expect(JSON.stringify(served(s, view(playerId)))).toBe(seen)
    }

    it('Rhys’s offered sites count Way Station’s favor; Dana’s answers are judged alike on their view', () => {
        // Dana holds a facedown adviser, so Rhys's view does not hold everything.
        const s = table({ supply: 1, favor: 1 })
        sameOnOwnView(
            s,
            RHYS,
            (state) => payableWoodPicks(state, DANA, { free: false }).map((p) => p.siteId),
            ['p2']
        )
        sameOnOwnView(s, DANA, (state) => HydratedTravel.canDoTravel(state, DANA), true)
        const asked = table()
        leaveAndPick(asked)
        sameOnOwnView(
            asked,
            DANA,
            (state) => HydratedAnswerQuestion.reasonCannotAnswer(state, DANA, give(true)),
            undefined
        )
        sameOnOwnView(
            asked,
            DANA,
            (state) => HydratedAnswerQuestion.reasonCannotAnswer(state, DANA, give(false)),
            undefined
        )
    })
})
