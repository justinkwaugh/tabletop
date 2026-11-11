import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedTravel, Travel } from './travel.js'
import { AnswerQuestion, HydratedAnswerQuestion } from './answerQuestion.js'
import { OathVisibility } from '../definition/runtime.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

/**
 * Portal: "Spend no Supply and ignore the powers of sites if you're traveling to or from this site."
 * R-9.2-H1 (amended to Forest Paths' Q&A, "It lets you get around things like the Narrow Pass"): the
 * ignore reaches every site power bearing on that travel, the origin's included, but not the powers
 * of cards, so Toll Roads still charges. Used from its own site, an enemy's Shrouded Wood, there is no
 * ruler's pick. Forest Paths keeps the pick by its own Q&A, which speaks of the enemy ruler choosing.
 */
const PORTAL = 'denizen.arcane.portal'
const PATHS = 'denizen.beast.forest-paths'
const TOLL_ROADS = 'denizen.order.toll-roads'
const STORYTELLER = 'denizen.hearth.storyteller'

const DANA = 'dana'
const ANN = 'ann'
const BEA = 'bea'
const atRevision = OathRevision.EngineFixes11
const before = OathRevision.EngineFixes10

interface Scene {
    revision?: number
    supply?: number
    favor?: number
    secrets?: number
    /** Where Portal stands: the Wood Dana is leaving (h1), or p2, a site Dana rules. */
    portalAt?: 'h1' | 'p2'
    advisers?: string[]
    /** Toll Roads at c1, which Ann rules. */
    tollRoads?: boolean
}

/** Dana stands at h1, a Shrouded Wood Ann (an Exile, so an enemy) rules; c2 is The Hidden Place. */
function table({
    revision = atRevision,
    supply = 1,
    favor = 4,
    secrets = 3,
    portalAt = 'h1',
    advisers = [],
    tollRoads = false
}: Scene = {}) {
    const s = testState(
        [
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'h1',
                favor,
                secrets,
                supply,
                warbandsOnBoard: { [DANA]: 3 },
                warbandsInPersonalBank: { [DANA]: 6 },
                advisers: [
                    ...advisers.map((cardId) => ({ cardId, faceUp: true })),
                    { cardId: STORYTELLER, faceUp: false }
                ]
            }),
            testPlayer({
                playerId: ANN,
                color: Color.Yellow,
                siteId: 'p1',
                favor: 2,
                secrets: 2,
                warbandsOnBoard: { [ANN]: 2 },
                warbandsInPersonalBank: { [ANN]: 6 }
            }),
            testPlayer({
                playerId: BEA,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'p1',
                favor: 2,
                secrets: 2,
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 }
            })
        ],
        {
            oathRevision: revision,
            chancellorPlayerId: BEA,
            denizensBySite: {
                c1: tollRoads ? [TOLL_ROADS] : [],
                c2: [],
                p1: [],
                p2: portalAt === 'p2' ? [PORTAL] : [],
                h1: portalAt === 'h1' ? [PORTAL] : []
            },
            warbandsBySite: {
                h1: { [ANN]: 2 },
                p1: { [IMPERIAL_WARBANDS]: 2 },
                p2: { [DANA]: 1 },
                ...(tollRoads ? { c1: { [ANN]: 1 } } : {})
            },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.the-hidden-place',
                p1: 'site.marshes',
                p2: 'site.great-slums',
                h1: 'site.shrouded-wood'
            }
        }
    )
    openTurn(s, DANA)
    return s
}

const travel = (fields: { siteId?: string; cards?: string[]; tolls?: string[] }) =>
    buildAction(Travel, {
        playerId: DANA,
        siteId: fields.siteId,
        modifiers: (fields.cards ?? []).map((cardId) => modifierUse(cardId)),
        tolls: fields.tolls
    })
const go = (
    s: HydratedOathGameState,
    fields: { siteId?: string; cards?: string[]; tolls?: string[] }
) => new HydratedTravel(travel(fields)).apply(s)
const dana = (s: HydratedOathGameState) => s.getPlayerState(DANA)

describe('R-11.7-H4 — Portal used from its own site, an enemy’s Shrouded Wood', () => {
    it('Dana travels where they choose, spending no Supply; Portal’s secret is placed and nobody picks', () => {
        const s = table()
        expect(HydratedTravel.reasonCannotTravel(s, DANA, 'c1')).toBe(
            "the Shrouded Wood's ruler chooses where you go"
        )
        expect(
            HydratedTravel.reasonCannotTravel(s, DANA, 'c1', [modifierUse(PORTAL)])
        ).toBeUndefined()
        go(s, { siteId: 'c1', cards: [PORTAL] })
        expect(dana(s)).toMatchObject({ siteId: 'c1', supply: 1, secrets: 2 })
        expect(s.tokensOn(PORTAL).secrets).toBe(1)
        expect(s.pendingQuestions?.queue ?? []).toEqual([])
    })

    it('The Hidden Place is ignored too: no flip', () => {
        const s = table()
        go(s, { siteId: 'c2', cards: [PORTAL] })
        expect(dana(s)).toMatchObject({ siteId: 'c2', secrets: 2, secretsFacedown: 0 })
    })

    it('Toll Roads still charges: a card’s power, not a site’s', () => {
        const s = table({ tollRoads: true })
        expect(HydratedTravel.reasonCannotTravel(s, DANA, 'c1', [modifierUse(PORTAL)])).toMatch(
            /denizen.order.toll-roads: you cannot travel to c1 unless you give a favor/
        )
        go(s, { siteId: 'c1', cards: [PORTAL], tolls: [TOLL_ROADS] })
        expect(dana(s)).toMatchObject({ siteId: 'c1', supply: 1, favor: 3 })
        expect(s.getPlayerState(ANN).favor).toBe(3)
    })

    it('the site must be named: with Portal there is no ruler to name it', () => {
        const s = table()
        expect(
            HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, {
                modifiers: [modifierUse(PORTAL)]
            })
        ).toBe('Portal ignores the Shrouded Wood: name the site you travel to')
        expect(() => go(s, { cards: [PORTAL] })).toThrow(/no destination is named/)
    })

    it('opens the Travel with no Supply at all, where the Wood’s 2 would shut it', () => {
        const s = table({ supply: 0, favor: 0 })
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, DANA, {})).toMatch(
            /you can pay for no site/
        )
        expect(HydratedTravel.canDoTravel(s, DANA)).toBe(true)
        expect(HydratedTravel.legalDestinations(s, DANA, [modifierUse(PORTAL)])).toEqual(
            expect.arrayContaining(['c1', 'c2', 'p1', 'p2'])
        )
        // Control: with no faceup secret for Portal's cost, nothing opens it.
        expect(HydratedTravel.canDoTravel(table({ supply: 0, favor: 0, secrets: 0 }), DANA)).toBe(
            false
        )
    })

    it('the Travel and its tolls replay unchanged', () => {
        const start = table({ tollRoads: true }).dehydrate()
        const game = testGame([DANA, ANN, BEA])
        const went = engine.runNext(
            travel({ siteId: 'c1', cards: [PORTAL], tolls: [TOLL_ROADS] }),
            structuredClone(start),
            game
        )
        expect(went.updatedState.players.find((p) => p.playerId === DANA)?.siteId).toBe('c1')
        let replayed = structuredClone(start)
        for (const action of went.processedActions)
            replayed = engine.run(
                structuredClone(action),
                replayed,
                game,
                RunMode.Single
            ).updatedState
        expect(replayed).toEqual(went.updatedState)
    })
})

describe('R-11.7-H4 — the ruler’s pick stays', () => {
    it('Portal at another site: the ruler picks, and Portal makes only its own site free', () => {
        for (const [siteId, paid] of [
            ['p2', 0],
            ['c1', 2]
        ] as const) {
            const s = table({ portalAt: 'p2', supply: 4 })
            expect(HydratedTravel.reasonCannotTravel(s, DANA, 'p2', [modifierUse(PORTAL)])).toBe(
                "the Shrouded Wood's ruler chooses where you go"
            )
            go(s, { cards: [PORTAL] })
            expect(s.pendingQuestions?.queue[0]).toMatchObject({
                kind: PowerQuestionKind.ShroudedWoodDestination,
                askedPlayerId: ANN
            })
            new HydratedAnswerQuestion(
                buildAction(AnswerQuestion, {
                    playerId: ANN,
                    answer: { kind: PowerQuestionKind.ShroudedWoodDestination, siteId }
                })
            ).apply(s)
            expect(dana(s), siteId).toMatchObject({ siteId, supply: 4 - paid, secrets: 2 })
        }
    })

    it('Forest Paths ignores the powers of sites too, but its Q&A keeps the enemy ruler’s choice', () => {
        const s = table({ portalAt: 'p2', advisers: [PATHS], supply: 4 })
        expect(HydratedTravel.reasonCannotTravel(s, DANA, 'c1', [modifierUse(PATHS)])).toBe(
            "the Shrouded Wood's ruler chooses where you go"
        )
        go(s, { cards: [PATHS] })
        expect(s.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.ShroudedWoodDestination,
            askedPlayerId: ANN
        })
    })
})

describe('R-X.4 — before revision 15 Portal does not lift the Wood’s pick', () => {
    it('Portal at the origin is refused, named site or not', () => {
        const s = table({ revision: before })
        expect(HydratedTravel.reasonCannotTravel(s, DANA, 'c1', [modifierUse(PORTAL)])).toBe(
            "the Shrouded Wood's ruler chooses where you go"
        )
        expect(() => go(s, { siteId: 'c1', cards: [PORTAL] })).toThrow(
            /the Shrouded Wood's ruler chooses where you go/
        )
        expect(() => go(s, { cards: [PORTAL] })).toThrow(/nothing is declared/)
        expect(
            HydratedTravel.canDoTravel(table({ revision: before, supply: 0, favor: 0 }), DANA)
        ).toBe(false)
    })
})

describe('R-11.7-H4 on Dana’s own view', () => {
    const view: Visibility.Perspective = { kind: 'player', playerId: DANA }
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view)), view)

    function sameOnOwnView<T>(
        s: HydratedOathGameState,
        check: (state: HydratedOathGameState) => T,
        expected: T
    ) {
        const server = JSON.stringify(s.dehydrate())
        const seen = JSON.stringify(served(s, view))
        expect(check(s)).toEqual(expected)
        expect(check(ownView(s))).toEqual(expected)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
        expect(JSON.stringify(served(s, view))).toBe(seen)
    }

    it('the Travel tile and the Portal Travel are judged alike', () => {
        // Ann holds a facedown adviser, so Dana's view does not hold everything.
        const s = table({ supply: 0, favor: 0 })
        s.getPlayerState(ANN).advisers.push({ cardId: 'denizen.hearth.herald', faceUp: false })
        sameOnOwnView(s, (state) => HydratedTravel.canDoTravel(state, DANA), true)
        sameOnOwnView(
            s,
            (state) => HydratedTravel.reasonCannotTravel(state, DANA, 'c1', [modifierUse(PORTAL)]),
            undefined
        )
    })
})
