import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { actionPowerUse, player } from '../testing/choices.js'
import { answerQuestion } from '../testing/steps.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { PowerMoveKind, PowerMoveTollOutcome } from '../model/powerMoveToll.js'
import { PlayerStatus, Region } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathRevision } from '../util/revision.js'
import { OathVisibility } from '../definition/runtime.js'
import { UseActionPower } from '../actions/useActionPower.js'
import { AnswerQuestion, HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import '../powers/index.js'

const WHISTLE = 'relic.whistle'
const HORSE = 'relic.brass-horse'
const DRUM = 'relic.dragonskin-drum'
const TOLL_ROADS = 'denizen.order.toll-roads'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const MUSHROOMS = 'denizen.beast.mushrooms'
const STORYTELLER = 'denizen.hearth.storyteller'
const WOOD_CARD = 'site.shrouded-wood'

const atRevision = OathRevision.EngineFixes11
const before = OathRevision.EngineFixes10

type Over = Record<string, Record<string, unknown>>

/**
 * Dana stands at c1 with the Whistle; Rhys and Ann are exiles, so enemies, and Ann rules the
 * Shrouded Wood at h1, where Rhys stands. Bea is the Chancellor at p1.
 */
function table(
    over: Over = {},
    state: Record<string, unknown> = {},
    oathRevision: number = atRevision
) {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 4,
                secrets: 3,
                supply: 6,
                relicIds: [WHISTLE],
                warbandsOnBoard: { dana: 3 },
                warbandsInPersonalBank: { dana: 6 },
                ...over['dana']
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'h1',
                favor: 3,
                secrets: 2,
                supply: 4,
                warbandsOnBoard: { rhys: 2 },
                warbandsInPersonalBank: { rhys: 6 },
                ...over['rhys']
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Yellow,
                siteId: 'p1',
                favor: 2,
                secrets: 2,
                warbandsOnBoard: { ann: 2 },
                warbandsInPersonalBank: { ann: 6 },
                ...over['ann']
            }),
            testPlayer({
                playerId: 'bea',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'p1',
                favor: 2,
                secrets: 2,
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 },
                ...over['bea']
            })
        ],
        {
            oathRevision,
            chancellorPlayerId: 'bea',
            denizensBySite: { c1: [WOLVES], c2: [MUSHROOMS], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 2 }, h1: { ann: 2 }, p1: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: WOOD_CARD },
            ...state
        }
    )
    openTurn(s, 'dana')
    return s
}

/** Dana rules c1, which now holds Toll Roads as well as the Wolves. */
const TOLL = { denizensBySite: { c1: [WOLVES, TOLL_ROADS], c2: [MUSHROOMS], p1: [], h1: [] } }

const whistle = (s: HydratedOathGameState) => {
    const used = actionPowerUse('dana', WHISTLE, [player('rhys')])
    used.apply(s)
    return used
}

const pick = (s: HydratedOathGameState, siteId: string, playerId = 'ann') =>
    answerQuestion(s, playerId, { kind: PowerQuestionKind.ShroudedWoodDestination, siteId })

const asked = (s: HydratedOathGameState) => s.pendingQuestions?.queue[0]

describe("R-11.7-H1 — the Whistle out of an enemy's Shrouded Wood asks the Wood's ruler", () => {
    it('Ann, who rules the Wood, is asked where Rhys goes; Rhys has not moved', () => {
        const s = table()
        const used = whistle(s)
        expect(s.getPlayerState('rhys').siteId).toBe('h1')
        expect(s.pendingQuestions?.queue).toEqual([
            {
                kind: PowerQuestionKind.ShroudedWoodDestination,
                cardId: WOOD_CARD,
                askedPlayerId: 'ann',
                travelerPlayerId: 'rhys',
                fromSiteId: 'h1',
                power: { powerCardId: WHISTLE, userPlayerId: 'dana' }
            }
        ])
        expect(s.pendingQuestions?.askingPlayerId).toBe('dana')
        // The secret waits on the Whistle until Rhys reaches Dana's site.
        expect(s.tokensOn(WHISTLE).secrets).toBe(1)
        expect(s.getPlayerState('rhys').secrets).toBe(2)
        expect(used.metadata?.summary).toBe(
            "Whistle: the Shrouded Wood's ruler chooses rhys's destination"
        )
    })

    it("Ann picks Dana's site: Rhys goes there and takes the Whistle's secret", () => {
        const s = table()
        whistle(s)
        const answer = pick(s, 'c1')
        expect(s.getPlayerState('rhys')).toMatchObject({ siteId: 'c1', secrets: 3, supply: 4 })
        expect(s.tokensOn(WHISTLE).secrets).toBe(0)
        expect(answer.metadata?.summary).toBe(
            'sent rhys to c1; rhys took 1 secret from the Whistle'
        )
        expect(s.pendingQuestions?.queue ?? []).toEqual([])
        // Nothing hidden came out, so the pick can be taken back.
        expect(answer.revealsInfo).toBe(false)
    })

    it('Ann picks another site: Rhys goes there, and the secret stays on the Whistle', () => {
        const s = table()
        whistle(s)
        const answer = pick(s, 'c2')
        expect(s.getPlayerState('rhys')).toMatchObject({ siteId: 'c2', secrets: 2 })
        expect(s.tokensOn(WHISTLE).secrets).toBe(1)
        expect(answer.metadata?.summary).toBe('sent rhys to c2')
    })

    it('Ann may pick any site Rhys can travel to, as on a Travel', () => {
        const s = table()
        whistle(s)
        const reason = (siteId: string) =>
            HydratedAnswerQuestion.reasonCannotAnswer(s, 'ann', {
                kind: PowerQuestionKind.ShroudedWoodDestination,
                siteId
            })
        expect(['c1', 'c2', 'p1', 'p2', 'h2'].map(reason)).toEqual([
            undefined,
            undefined,
            undefined,
            undefined,
            undefined
        ])
        expect(reason('h1')).toMatch(/not a site rhys can be sent to/)
        // Only the ruler answers.
        expect(
            HydratedAnswerQuestion.reasonCannotAnswer(s, 'dana', {
                kind: PowerQuestionKind.ShroudedWoodDestination,
                siteId: 'c1'
            })
        ).toBeDefined()
    })

    it('with Toll Roads at the picked site nobody is asked for the toll before the pick; then Rhys pays and takes the secret', () => {
        const s = table({}, TOLL)
        whistle(s)
        expect(asked(s)).toMatchObject({
            kind: PowerQuestionKind.ShroudedWoodDestination,
            askedPlayerId: 'ann'
        })
        expect(s.pendingQuestions?.queue).toHaveLength(1)
        const answer = pick(s, 'c1')
        expect(answer.metadata?.tollMove).toMatchObject({
            move: PowerMoveKind.ShroudedWood,
            moverPlayerId: 'ann',
            movedPlayerId: 'rhys',
            toSiteId: 'c1',
            outcome: PowerMoveTollOutcome.Asked
        })
        expect(asked(s)).toMatchObject({
            kind: PowerQuestionKind.PayTravelToll,
            askedPlayerId: 'rhys',
            payeeId: 'dana',
            fromSiteId: 'h1',
            siteId: 'c1'
        })
        const paid = answerQuestion(s, 'rhys', { kind: PowerQuestionKind.PayTravelToll, pay: true })
        expect(s.getPlayerState('rhys')).toMatchObject({ siteId: 'c1', favor: 2, secrets: 3 })
        expect(s.getPlayerState('dana').favor).toBe(5)
        expect(s.tokensOn(WHISTLE).secrets).toBe(0)
        expect(paid.metadata?.tollMove).toMatchObject({
            outcome: PowerMoveTollOutcome.Paid,
            powerCardId: WHISTLE,
            secretsTaken: 1
        })
        expect(paid.revealsInfo).toBe(false)
    })

    it('a refused toll leaves Rhys in the Wood, and the secret on the Whistle', () => {
        const s = table({}, TOLL)
        whistle(s)
        pick(s, 'c1')
        const refused = answerQuestion(s, 'rhys', {
            kind: PowerQuestionKind.PayTravelToll,
            pay: false
        })
        expect(s.getPlayerState('rhys')).toMatchObject({ siteId: 'h1', favor: 3, secrets: 2 })
        expect(s.tokensOn(WHISTLE).secrets).toBe(1)
        expect(refused.metadata?.tollMove?.secretsTaken).toBeUndefined()
    })

    it('the Dragonskin Drum is asked once Rhys arrives, after the pick, and not while Rhys stays', () => {
        const s = table({ rhys: { relicIds: [DRUM] } }, TOLL)
        whistle(s)
        expect(s.pendingQuestions?.queue.map((q) => q.kind)).toEqual([
            PowerQuestionKind.ShroudedWoodDestination
        ])
        pick(s, 'c2')
        expect(s.pendingQuestions?.queue).toEqual([
            { kind: PowerQuestionKind.DragonskinDrum, cardId: DRUM, askedPlayerId: 'rhys' }
        ])

        const refused = table({ rhys: { relicIds: [DRUM] } }, TOLL)
        whistle(refused)
        pick(refused, 'c1')
        answerQuestion(refused, 'rhys', { kind: PowerQuestionKind.PayTravelToll, pay: false })
        expect(refused.pendingQuestions?.queue ?? []).toEqual([])

        const paid = table({ rhys: { relicIds: [DRUM] } }, TOLL)
        whistle(paid)
        pick(paid, 'c1')
        answerQuestion(paid, 'rhys', { kind: PowerQuestionKind.PayTravelToll, pay: true })
        expect(paid.pendingQuestions?.queue).toEqual([
            { kind: PowerQuestionKind.DragonskinDrum, cardId: DRUM, askedPlayerId: 'rhys' }
        ])
    })

    it("Vow of Silence keeps the secret on the Whistle at its user's site; the pull stands", () => {
        const s = table({
            dana: { advisers: [{ cardId: 'denizen.arcane.vow-of-silence', faceUp: true }] }
        })
        whistle(s)
        pick(s, 'c1')
        expect(s.getPlayerState('rhys')).toMatchObject({ siteId: 'c1', secrets: 2 })
        expect(s.tokensOn(WHISTLE).secrets).toBe(1)
    })

    describe('no pick: the Whistle pulls Rhys straight to Dana, as before', () => {
        it('Rhys rules the Wood', () => {
            const s = table(
                {},
                {
                    warbandsBySite: {
                        c1: { dana: 2 },
                        h1: { rhys: 2 },
                        p1: { [IMPERIAL_WARBANDS]: 2 }
                    }
                }
            )
            whistle(s)
            expect(s.getPlayerState('rhys')).toMatchObject({ siteId: 'c1', secrets: 3 })
            expect(s.pendingQuestions).toBeUndefined()
        })

        it('the Empire rules the Wood and Rhys is a Citizen', () => {
            const s = table(
                { rhys: { status: PlayerStatus.Citizen } },
                {
                    warbandsBySite: {
                        c1: { dana: 2 },
                        h1: { [IMPERIAL_WARBANDS]: 2 },
                        p1: { [IMPERIAL_WARBANDS]: 2 }
                    }
                }
            )
            whistle(s)
            expect(s.getPlayerState('rhys')).toMatchObject({ siteId: 'c1', secrets: 3 })
            expect(s.pendingQuestions).toBeUndefined()
        })

        it('the bandits rule the Wood', () => {
            const s = table(
                {},
                { warbandsBySite: { c1: { dana: 2 }, h1: {}, p1: { [IMPERIAL_WARBANDS]: 2 } } }
            )
            whistle(s)
            expect(s.getPlayerState('rhys')).toMatchObject({ siteId: 'c1', secrets: 3 })
            expect(s.pendingQuestions).toBeUndefined()
        })
    })

    it('R-X.4 — in a game created before revision 15 the Whistle pulls Rhys straight to Dana, toll first', () => {
        const s = table({}, {}, before)
        whistle(s)
        expect(s.getPlayerState('rhys')).toMatchObject({ siteId: 'c1', secrets: 3 })
        expect(s.pendingQuestions).toBeUndefined()

        const toll = table({}, TOLL, before)
        whistle(toll)
        expect(asked(toll)).toMatchObject({
            kind: PowerQuestionKind.PayTravelToll,
            askedPlayerId: 'rhys',
            move: PowerMoveKind.Whistle
        })
    })
})

describe("R-11.7-H1 — the Brass Horse out of an enemy's Shrouded Wood: its ruler picks among the Horse's sites", () => {
    /** Dana, with the Brass Horse, stands in Ann's Wood; the Hinterland pile shows a Beast; Beasts lie at c1 and c2. */
    function horse(
        over: Over = {},
        state: Record<string, unknown> = {},
        oathRevision: number = atRevision
    ) {
        const s = table(
            {
                dana: { siteId: 'h1', relicIds: [HORSE], ...over['dana'] },
                rhys: { siteId: 'c2', ...over['rhys'] }
            },
            state,
            oathRevision
        )
        s.requireVault().discardPiles[Region.Hinterland] = [RANGERS]
        s.discardPileCounts[Region.Hinterland] = 1
        const used = actionPowerUse('dana', HORSE)
        used.apply(s)
        return { s, used }
    }

    it('Ann is asked, not Dana, among the sites with a Beast card', () => {
        const { s, used } = horse()
        expect(s.pendingQuestions?.queue).toEqual([
            {
                kind: PowerQuestionKind.ShroudedWoodDestination,
                cardId: WOOD_CARD,
                askedPlayerId: 'ann',
                travelerPlayerId: 'dana',
                fromSiteId: 'h1',
                power: { powerCardId: HORSE, userPlayerId: 'dana', siteIds: ['c1', 'c2'] }
            }
        ])
        expect(used.metadata?.summary).toBe(
            `Brass Horse: revealed ${RANGERS} (beast); the Shrouded Wood's ruler chooses among the sites with a beast card`
        )
    })

    it("a site outside the Horse's set is refused; one inside it takes Dana there for no Supply", () => {
        const { s } = horse()
        expect(
            HydratedAnswerQuestion.reasonCannotAnswer(s, 'ann', {
                kind: PowerQuestionKind.ShroudedWoodDestination,
                siteId: 'p1'
            })
        ).toBe('p1 is not one of the sites the Brass Horse named')
        expect(() => pick(s, 'p1')).toThrow()
        pick(s, 'c2')
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c2', supply: 6 })
        expect(s.pendingQuestions?.queue ?? []).toEqual([])
    })

    it('a toll site Dana cannot pay is left out of the set', () => {
        const { s } = horse(
            { dana: { favor: 0 } },
            {
                ...TOLL,
                warbandsBySite: {
                    c1: { [IMPERIAL_WARBANDS]: 2 },
                    h1: { ann: 2 },
                    p1: { [IMPERIAL_WARBANDS]: 2 }
                }
            }
        )
        expect(asked(s)).toMatchObject({ askedPlayerId: 'ann', power: { siteIds: ['c2'] } })
    })

    it("a toll at Ann's pick is asked of Dana after the pick, and paying takes Dana there", () => {
        const { s } = horse(
            {},
            {
                ...TOLL,
                warbandsBySite: {
                    c1: { [IMPERIAL_WARBANDS]: 2 },
                    h1: { ann: 2 },
                    p1: { [IMPERIAL_WARBANDS]: 2 }
                }
            }
        )
        expect(asked(s)).toMatchObject({ askedPlayerId: 'ann', power: { siteIds: ['c1', 'c2'] } })
        pick(s, 'c1')
        expect(asked(s)).toMatchObject({
            kind: PowerQuestionKind.PayTravelToll,
            askedPlayerId: 'dana',
            payeeId: 'bea',
            siteId: 'c1',
            power: { powerCardId: HORSE }
        })
        const paid = answerQuestion(s, 'dana', { kind: PowerQuestionKind.PayTravelToll, pay: true })
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', favor: 3, supply: 6 })
        expect(paid.metadata?.tollMove?.secretsTaken).toBeUndefined()
    })

    it('with every matched site out of reach, the free Travel stands as before', () => {
        const { s } = horse(
            { dana: { favor: 0 } },
            {
                denizensBySite: { c1: [WOLVES, TOLL_ROADS], c2: [], p1: [], h1: [] },
                warbandsBySite: {
                    c1: { [IMPERIAL_WARBANDS]: 2 },
                    h1: { ann: 2 },
                    p1: { [IMPERIAL_WARBANDS]: 2 }
                }
            }
        )
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('dana')).toMatchObject({
            siteId: 'h1',
            freeTravelAtAction: s.actionCount + 1
        })
    })

    it('Dana rules the Wood: Dana picks, as before', () => {
        const { s } = horse(
            {},
            { warbandsBySite: { c1: { dana: 2 }, h1: { dana: 2 }, p1: { [IMPERIAL_WARBANDS]: 2 } } }
        )
        expect(asked(s)).toEqual({
            kind: PowerQuestionKind.TravelFreeTo,
            cardId: HORSE,
            askedPlayerId: 'dana',
            siteIds: ['c1', 'c2']
        })
    })

    it('R-X.4 — before revision 15 Dana picks', () => {
        const { s } = horse({}, {}, before)
        expect(asked(s)).toMatchObject({
            kind: PowerQuestionKind.TravelFreeTo,
            askedPlayerId: 'dana'
        })
    })
})

describe("R-11.7-H1 on the ruler's own view", () => {
    const ann: Visibility.Perspective = { kind: 'player', playerId: 'ann' }
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, ann)), ann)

    function sameOnOwnView<T>(
        s: HydratedOathGameState,
        check: (state: HydratedOathGameState) => T,
        expected: T
    ) {
        const server = JSON.stringify(s.dehydrate())
        const seen = JSON.stringify(served(s, ann))
        expect(check(s)).toEqual(expected)
        expect(check(ownView(s))).toEqual(expected)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
        expect(JSON.stringify(served(s, ann))).toBe(seen)
    }

    const answer = (siteId: string): QuestionAnswer => ({
        kind: PowerQuestionKind.ShroudedWoodDestination,
        siteId
    })

    it("the pick's check after the Whistle and after the Brass Horse reads only what Ann sees", () => {
        // Rhys and Dana hold facedown advisers, so Ann's view does not hold everything.
        const hidden = { advisers: [{ cardId: STORYTELLER, faceUp: false }] }
        const s = table({ rhys: hidden, dana: hidden })
        whistle(s)
        sameOnOwnView(
            s,
            (state) => HydratedAnswerQuestion.reasonCannotAnswer(state, 'ann', answer('c2')),
            undefined
        )
        sameOnOwnView(
            s,
            (state) => HydratedAnswerQuestion.reasonCannotAnswer(state, 'ann', answer('h1')),
            'h1 is not a site rhys can be sent to'
        )

        const h = table({
            dana: { siteId: 'h1', relicIds: [HORSE], ...hidden },
            rhys: { siteId: 'c2', ...hidden }
        })
        h.requireVault().discardPiles[Region.Hinterland] = [RANGERS]
        h.discardPileCounts[Region.Hinterland] = 1
        actionPowerUse('dana', HORSE).apply(h)
        sameOnOwnView(
            h,
            (state) => HydratedAnswerQuestion.reasonCannotAnswer(state, 'ann', answer('c1')),
            undefined
        )
        sameOnOwnView(
            h,
            (state) => HydratedAnswerQuestion.reasonCannotAnswer(state, 'ann', answer('p1')),
            'p1 is not one of the sites the Brass Horse named'
        )
    })
})

describe("R-X.4 — the Whistle out of an enemy's Wood replays as it was recorded, at each revision", () => {
    const answer = (siteId: string): QuestionAnswer => ({
        kind: PowerQuestionKind.ShroudedWoodDestination,
        siteId
    })

    it("before revision 15 a straight pull; from it, the ruler's pick and its answer", () => {
        for (const revision of [before, atRevision]) {
            const start = table({}, {}, revision).dehydrate()
            const game = testGame(['dana', 'rhys', 'ann', 'bea'])
            const used = engine.runNext(
                buildAction(UseActionPower, {
                    playerId: 'dana',
                    cardId: WHISTLE,
                    powerIndex: powerIndexOf(WHISTLE, PowerTiming.Action),
                    choices: [player('rhys')]
                }),
                structuredClone(start),
                game
            )
            const actions = [...used.processedActions]
            let recorded = used.updatedState
            if (revision === atRevision) {
                const answered = engine.runNext(
                    buildAction(AnswerQuestion, { playerId: 'ann', answer: answer('c2') }),
                    structuredClone(recorded),
                    game
                )
                actions.push(...answered.processedActions)
                recorded = answered.updatedState
            }
            expect(recorded.players.find((p) => p.playerId === 'rhys')).toMatchObject({
                siteId: revision === atRevision ? 'c2' : 'c1'
            })

            let replayed = structuredClone(start)
            for (const action of actions)
                replayed = engine.run(
                    structuredClone(action),
                    replayed,
                    game,
                    RunMode.Single
                ).updatedState
            expect(replayed).toEqual(recorded)
        }
    })
})
