import { describe, expect, it } from 'vitest'
import {
    ActionType,
    Banner,
    CardKind,
    OathType,
    PlayerStatus,
    SearchPlay,
    SearchSource,
    ChronicleMark,
    WinKind,
    type HydratedOathGameState,
    type OpenDeal,
    type WinRule
} from '@tabletop/oath'
import { ActionSource, Color, assertExists, type GameAction } from '@tabletop/common'
import { testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import { tokenParts } from './tokenText.js'
import {
    MajorEventKind,
    campaignsBefore,
    endingRecord,
    endingRule,
    gameEndEvent,
    historyRows,
    majorEventOf,
    wonGame,
    type MajorEventContext
} from './majorEvents.js'

const names: Record<string, string> = { p1: 'Ann', p2: 'Ben', p3: 'Cass' }
const nameOf = (playerId: string) => names[playerId] ?? playerId

function context(viewerId?: string, extra: Partial<MajorEventContext> = {}): MajorEventContext {
    return { viewerId, nameOf, oathType: OathType.Protection, ...extra }
}

function action(
    fields: { type: ActionType; playerId?: string } & Record<string, unknown>
): GameAction {
    return { id: `a-${fields.type}`, gameId: 'g1', source: ActionSource.User, ...fields }
}

/** Squalid District's answer, as the engine records it (its metadata's `endDie`). */
function squalidAnswer(by: number, endDie: Record<string, unknown>): GameAction {
    return action({
        type: ActionType.AnswerQuestion,
        playerId: 'p2',
        answer: { kind: 'adjustEndDie', by },
        metadata: { summary: 'adjusted', endDie }
    })
}

const DEAL: OpenDeal = {
    id: 'd1',
    proposerPlayerId: 'p1',
    counterpartyPlayerId: 'p2',
    proposerPromise: 'I stay home.',
    round: 2
}

const VISION = 'vision.conquest'
const FAITH = 'vision.faith'

/** The game-end row as a game below the chronicle revision reads it: from the log and the Visions. */
function endEvent(
    state: HydratedOathGameState,
    winnerId: string,
    rule: WinRule,
    viewing: MajorEventContext
) {
    state.winningPlayerIds = [winnerId]
    const won = wonGame(state, [
        action({
            type: ActionType.RollEndDie,
            playerId: winnerId,
            metadata: { roll: 5, round: 6, threshold: 5, wonBy: rule }
        })
    ])
    assertExists(won, 'the log records the win')
    return gameEndEvent(state, won, viewing)
}
const REBELLION = 'vision.rebellion'

/** R-3.2 — three Visions drawn, Cass holding the Darkest Secret that Faith's goal asks for. */
function ended(
    over: Record<string, Record<string, unknown>> = {},
    state: Record<string, unknown> = {}
) {
    return testState(
        [
            testPlayer({
                playerId: 'p1',
                status: PlayerStatus.Chancellor,
                color: Color.Purple,
                ...over['p1']
            }),
            testPlayer({ playerId: 'p2', color: Color.Blue, ...over['p2'] }),
            testPlayer({ playerId: 'p3', color: Color.Red, ...over['p3'] })
        ],
        {
            chancellorPlayerId: 'p1',
            visionsDrawn: 3,
            round: 7,
            banners: testBanners({ [Banner.DarkestSecret]: 'p3' }),
            ...state
        }
    )
}

function search(metadata: Record<string, unknown>) {
    return action({
        type: ActionType.Search,
        playerId: 'p3',
        drawFrom: SearchSource.WorldDeck,
        metadata: { supplySpent: 3, cardsDrawn: 2, ...metadata }
    })
}

describe('a Vision drawn (R-5.1.2, R-2.7.1, R-9.4)', () => {
    it('shows the drawer the Vision drawn, and everyone else its back', () => {
        const drawn = search({
            visionsDrawn: 2,
            stoppedOnVision: true,
            draw: {
                drawnCardIds: ['denizen.order.wrestlers', VISION],
                stoppedOnVision: true,
                worldDeckExhausted: false
            }
        })
        expect(majorEventOf(drawn, context('p3'))?.pictures).toEqual([
            { kind: 'card', cardId: VISION }
        ])
        const others = search({ visionsDrawn: 2, stoppedOnVision: true })
        expect(majorEventOf(others, context('p1'))).toMatchObject({
            kind: MajorEventKind.VisionDrawn,
            heading: 'Vision drawn',
            aside: '2nd of 5',
            pictures: [{ kind: 'back', cardKind: CardKind.Vision }]
        })
    })

    it('says when the world deck’s cost steps, and when Visions open (R-2.1.6, R-3.2)', () => {
        expect(
            majorEventOf(search({ visionsDrawn: 1, stoppedOnVision: true }), context())?.consequence
        ).toBe(
            'Search cost up: the world deck now costs 3 Supply, 2 for the Darkest Secret’s holder'
        )
        expect(
            majorEventOf(search({ visionsDrawn: 2, stoppedOnVision: true }), context())?.consequence
        ).toBeUndefined()
        expect(
            majorEventOf(search({ visionsDrawn: 3, stoppedOnVision: true }), context())?.consequence
        ).toBe(
            'Search cost up: the world deck now costs 4 Supply, 2 for the Darkest Secret’s holder · Visions can now win'
        )
    })

    it('gives another seat nothing for a Search recorded before the public flag', () => {
        const legacy = search({ visionsDrawn: 1 })
        expect(majorEventOf(legacy, context('p1'))).toBeUndefined()
    })

    it('counts Oracle’s draw as a Vision drawn', () => {
        const oracle = action({
            type: ActionType.UseActionPower,
            playerId: 'p3',
            cardId: 'denizen.nomad.oracle',
            powerIndex: 0,
            metadata: { summary: '', visionDrawn: true }
        })
        expect(majorEventOf(oracle, context('p1'))?.kind).toBe(MajorEventKind.VisionDrawn)
    })
})

describe('the other major events', () => {
    it('a Vision revealed shows its face and its goal', () => {
        const revealed = action({
            type: ActionType.SearchResolve,
            playerId: 'p3',
            keptCardId: VISION,
            discardOrder: [],
            play: SearchPlay.RevealedVision,
            metadata: { playedCardId: VISION }
        })
        expect(majorEventOf(revealed, context())).toMatchObject({
            kind: MajorEventKind.VisionRevealed,
            pictures: [{ kind: 'card', cardId: VISION }],
            consequence: 'Goal: rule the most sites'
        })
    })

    it('the title moving names the Oath, or says nobody holds it', () => {
        const moved = action({
            type: ActionType.TransferOathkeeper,
            source: ActionSource.System,
            fromPlayerId: 'p1',
            toPlayerId: 'p3'
        })
        expect(majorEventOf(moved, context())).toMatchObject({
            kind: MajorEventKind.Oathkeeper,
            pictures: [{ kind: 'title', usurper: false }],
            consequence: 'Oath of Protection: hold the most relics and banners'
        })
        const vacated = action({
            type: ActionType.TransferOathkeeper,
            source: ActionSource.System,
            fromPlayerId: 'p1'
        })
        expect(majorEventOf(vacated, context())?.consequence).toBe('Nobody holds the title')
    })

    it('the Usurper flip says what it threatens, to the holder in the second person', () => {
        const flip = action({
            type: ActionType.ResolveWake,
            playerId: 'p3',
            favorSteps: [],
            metadata: { flippedToUsurper: true }
        })
        expect(majorEventOf(flip, context('p1'))?.consequence).toBe(
            'If Cass still holds it at their next Wake, Cass wins'
        )
        expect(majorEventOf(flip, context('p3'))?.consequence).toBe(
            'If you still hold it at your next Wake, you win'
        )
    })

    it('Citizenship taken and lost', () => {
        expect(
            majorEventOf(
                action({ type: ActionType.ResolveCitizenshipOffer, playerId: 'p2', granted: true }),
                context()
            )?.consequence
        ).toBe('Ben is a Citizen of the Empire')
        expect(
            majorEventOf(
                action({
                    type: ActionType.ResolveCitizenshipOffer,
                    playerId: 'p2',
                    granted: false
                }),
                context()
            )
        ).toBeUndefined()
        expect(
            majorEventOf(
                action({ type: ActionType.ExileCitizen, playerId: 'p1', citizenPlayerId: 'p2' }),
                context('p2')
            )?.consequence
        ).toBe('You are an Exile again')
    })

    it('a Campaign won pictures what changed hands; who fought whom is its ledger’s, not an aside', () => {
        const campaign = action({
            type: ActionType.Campaign,
            playerId: 'p3',
            defender: { kind: 'player', playerId: 'p1' },
            targets: [],
            attackDice: 3
        })
        const spoils = action({
            type: ActionType.CampaignResolveVictory,
            playerId: 'p3',
            metadata: {
                warbandsPlaced: 0,
                seizeBurned: 0,
                favorBurned: 0,
                relicsTaken: ['relic.book-of-records'],
                bannersSeized: [Banner.DarkestSecret]
            }
        })
        const [, belongsTo] = campaignsBefore([campaign, spoils])
        expect(belongsTo).toBe(campaign)
        const won = majorEventOf(spoils, context('p2'))
        expect(won).toMatchObject({ kind: MajorEventKind.CampaignWon, heading: 'Campaign won' })
        expect(won?.aside).toBeUndefined()
        expect(won?.consequence).toBeUndefined()
        expect(won?.pictures).toEqual([
            { kind: 'card', cardId: 'relic.book-of-records' },
            { kind: 'banner', banner: Banner.DarkestSecret }
        ])
    })

    it('a Campaign lost is rose; its ledger tells the rest', () => {
        const lost = action({
            type: ActionType.CampaignSacrifice,
            playerId: 'p3',
            sacrifice: 0,
            metadata: { attack: 2, defense: 3, attackerVictorious: false, sacrificed: 0 }
        })
        const event = majorEventOf(lost, context())
        expect(event).toMatchObject({
            kind: MajorEventKind.CampaignLost,
            heading: 'Campaign lost',
            tone: 'danger',
            pictures: []
        })
        expect(event?.aside).toBeUndefined()
        expect(event?.consequence).toBeUndefined()
    })

    it('the end die, by the Chancellor’s roll or inside a Rest recorded before', () => {
        const roll = action({
            type: ActionType.RollEndDie,
            playerId: 'p1',
            metadata: { roll: 3, round: 6, threshold: 5 }
        })
        expect(majorEventOf(roll, context())).toMatchObject({
            kind: MajorEventKind.EndDie,
            tone: 'danger',
            aside: 'end of round 6',
            pictures: [{ kind: 'die', value: 3 }],
            consequence: 'a 5 or higher ends the game in round 6 · play goes on to round 7'
        })
        const ending = action({
            type: ActionType.RollEndDie,
            playerId: 'p1',
            metadata: { roll: 5, round: 6, threshold: 5, wonBy: 'R-3.3' }
        })
        expect(majorEventOf(ending, context())?.consequence).toBe(
            'a 5 or higher ends the game in round 6 · the game ends'
        )
        const fifth = action({
            type: ActionType.RollEndDie,
            playerId: 'p1',
            metadata: { roll: 2, round: 5, threshold: 6 }
        })
        expect(majorEventOf(fifth, context())?.consequence).toBe(
            'a 6 ends the game in round 5 · play goes on to round 6'
        )
        const legacy = action({
            type: ActionType.CompleteRest,
            playerId: 'p2',
            metadata: { endedRound: true, endDieRoll: 4, round: 8 }
        })
        expect(majorEventOf(legacy, context())).toMatchObject({
            aside: 'end of round 7',
            consequence: 'a 3 or higher ends the game in round 7 · play goes on to round 8'
        })
    })

    it('Squalid District: the event is the answer’s, the die as it stands after it; the roll it waits on is none', () => {
        const asked = action({
            type: ActionType.RollEndDie,
            playerId: 'p1',
            metadata: { roll: 5, round: 6, threshold: 5, adjustedBy: 'p2' }
        })
        expect(majorEventOf(asked, context())).toBeUndefined()
        const lowered = squalidAnswer(-1, { rolled: 5, roll: 4, round: 6, threshold: 5 })
        expect(majorEventOf(lowered, context())).toMatchObject({
            kind: MajorEventKind.EndDie,
            aside: 'end of round 6',
            pictures: [{ kind: 'die', value: 4 }],
            consequence: 'a 5 or higher ends the game in round 6 · play goes on to round 7'
        })
        const raised = squalidAnswer(1, {
            rolled: 4,
            roll: 5,
            round: 6,
            threshold: 5,
            wonBy: 'R-3.3'
        })
        expect(majorEventOf(raised, context())).toMatchObject({
            pictures: [{ kind: 'die', value: 5 }],
            consequence: 'a 5 or higher ends the game in round 6 · the game ends'
        })
        // A 6 raised to 7 is off the die: the face drawn is the one rolled.
        const offTheDie = squalidAnswer(1, {
            rolled: 6,
            roll: 7,
            round: 5,
            threshold: 6,
            wonBy: 'R-3.3'
        })
        expect(majorEventOf(offTheDie, context())?.pictures).toEqual([{ kind: 'die', value: 6 }])
        // Any other answer is no major event.
        expect(
            majorEventOf(
                action({
                    type: ActionType.AnswerQuestion,
                    playerId: 'p2',
                    answer: { kind: 'joinSite', join: true },
                    metadata: { summary: 'went' }
                }),
                context()
            )
        ).toBeUndefined()
    })

    it('Squalid District: the ending is read from the answer that decided it (R-3)', () => {
        const asked = action({
            type: ActionType.RollEndDie,
            playerId: 'p1',
            metadata: { roll: 4, round: 6, threshold: 5, adjustedBy: 'p2' }
        })
        const raised = squalidAnswer(1, {
            rolled: 4,
            roll: 5,
            round: 6,
            threshold: 5,
            wonBy: 'R-3.3',
            openDealsDropped: [DEAL]
        })
        expect(endingRecord([asked, raised])).toEqual({ rule: 'R-3.3', openDealsDropped: [DEAL] })
        expect(endingRule([asked, raised])).toBe('R-3.3')
        const lowered = squalidAnswer(-1, { rolled: 4, roll: 3, round: 6, threshold: 5 })
        expect(endingRecord([asked, lowered])).toBeUndefined()
    })

    it('ordinary actions are not major events', () => {
        expect(
            majorEventOf(action({ type: ActionType.EndActPhase, playerId: 'p1' }), context())
        ).toBeUndefined()
        expect(majorEventOf(search({ visionsDrawn: 0 }), context())).toBeUndefined()
        expect(
            majorEventOf(
                action({ type: ActionType.CompleteRest, playerId: 'p1', metadata: {} }),
                context()
            )
        ).toBeUndefined()
    })
})

describe('the History’s rows and its game-end row', () => {
    it('lists every action newest first, with its event', () => {
        const rows = historyRows(
            [
                action({ type: ActionType.EndActPhase, playerId: 'p1' }),
                search({ visionsDrawn: 1, stoppedOnVision: true })
            ],
            context()
        )
        expect(rows.map((row) => row.event?.kind)).toEqual([MajorEventKind.VisionDrawn, undefined])
    })

    it('reads the ending from the action that recorded it (R-3)', () => {
        const ending = [
            action({
                type: ActionType.RollEndDie,
                playerId: 'p1',
                metadata: { roll: 5, round: 6, threshold: 5, wonBy: 'R-3.3' }
            })
        ]
        expect(endingRule(ending)).toBe('R-3.3')
        const usurper = endEvent(
            ended({ p3: { revealedVisionId: FAITH } }),
            'p3',
            'R-3.1',
            context('p1')
        )
        expect(usurper).toMatchObject({
            heading: 'Game end',
            aside: 'round 7',
            pictures: [{ kind: 'title', usurper: true }]
        })
        expect(usurper.sentence).toBe('Cass won as Usurper')
        expect(usurper.consequence).toBe(
            'An Exile holding the Oathkeeper title on its Usurper side'
        )
        expect(
            endEvent(ended({ p3: { revealedVisionId: FAITH } }), 'p3', 'R-3.2', context('p3'))
                .sentence
        ).toMatch(/^You won as Visionary/)
    })

    describe('from the chronicle revision, the result reads the ending the win stored (R-8)', () => {
        function chronicled(
            rule: WinRule,
            kind: WinKind,
            mark: ChronicleMark,
            visionIds: string[]
        ) {
            // R-8.5 has set every Vision aside: none is revealed when the result shows.
            const state = ended()
            state.winningPlayerIds = ['p3']
            state.chronicle = {
                ending: {
                    winnerPlayerId: 'p3',
                    kind,
                    rule,
                    mark,
                    waysMet: { usurper: false, visionIds, empire: false }
                }
            }
            return state
        }

        it('a Visionary’s result keeps the first Vision they met, though 8.5 set it aside', () => {
            const state = chronicled('R-3.2', WinKind.Visionary, ChronicleMark.Visionary, [
                FAITH,
                VISION
            ])
            const won = wonGame(state, [])
            expect(won).toEqual({ winnerId: 'p3', rule: 'R-3.2', visionId: FAITH })
            assertExists(won, 'the chronicle holds the ending')
            expect(gameEndEvent(state, won, context()).pictures).toEqual([
                { kind: 'card', cardId: FAITH }
            ])
        })

        it('each mark: O and S show the title, V the Vision, with no action in the log', () => {
            const cases: [WinRule, WinKind, ChronicleMark, boolean][] = [
                ['R-3.1', WinKind.Usurper, ChronicleMark.Oathkeeper, true],
                ['R-3.3', WinKind.StableRegime, ChronicleMark.Oathkeeper, false],
                ['R-3.3.1', WinKind.Successor, ChronicleMark.Successor, false],
                ['R-3.4.1', WinKind.WarExhaustion, ChronicleMark.Oathkeeper, false]
            ]
            for (const [rule, kind, mark, usurper] of cases) {
                const state = chronicled(rule, kind, mark, [])
                const won = wonGame(state, [])
                assertExists(won, 'the chronicle holds the ending')
                expect(won.rule).toBe(rule)
                expect(gameEndEvent(state, won, context()).pictures).toEqual([
                    { kind: 'title', usurper }
                ])
            }
            const state = chronicled('R-3.4.3', WinKind.Visionary, ChronicleMark.Visionary, [FAITH])
            expect(wonGame(state, [])?.visionId).toBe(FAITH)
        })
    })

    describe('R-3.2, R-3.4.3 — a Vision ending shows the Vision the winner met', () => {
        it('their own Vision', () => {
            const state = ended({ p3: { revealedVisionId: FAITH } })
            expect(endEvent(state, 'p3', 'R-3.2', context()).pictures).toEqual([
                { kind: 'card', cardId: FAITH }
            ])
            expect(endEvent(state, 'p3', 'R-3.4.3', context()).pictures).toEqual([
                { kind: 'card', cardId: FAITH }
            ])
        })

        it('a Vision they share through False Prophet, with none of their own', () => {
            const state = ended(
                { p2: { revealedVisionId: FAITH } },
                { warbandsOnCards: { [FAITH]: { p3: 1 } } }
            )
            expect(endEvent(state, 'p3', 'R-3.2', context()).pictures).toEqual([
                { kind: 'card', cardId: FAITH }
            ])
        })

        it('a Vision they share, beside an own Vision whose goal they did not meet', () => {
            const state = ended(
                { p2: { revealedVisionId: FAITH }, p3: { revealedVisionId: VISION } },
                { warbandsOnCards: { [FAITH]: { p3: 1 } } }
            )
            expect(endEvent(state, 'p3', 'R-3.2', context()).pictures).toEqual([
                { kind: 'card', cardId: FAITH }
            ])
        })

        it('their own Vision before a shared one when they meet both', () => {
            const banners = testBanners({
                [Banner.DarkestSecret]: 'p3',
                [Banner.PeoplesFavor]: 'p3'
            })
            const state = ended(
                { p2: { revealedVisionId: FAITH }, p3: { revealedVisionId: REBELLION } },
                { banners, warbandsOnCards: { [FAITH]: { p3: 1 } } }
            )
            expect(endEvent(state, 'p3', 'R-3.2', context()).pictures).toEqual([
                { kind: 'card', cardId: REBELLION }
            ])
        })
    })
})

describe('every seat a framed row names is its chip: the aside, the line that follows, the winner', () => {
    /** The words as the History draws them: each seat its chip, "<you>" for the reader. */
    const drawn = (text: string | undefined, viewerId: string | undefined) =>
        tokenParts(text ?? '', {
            seats: { names: { player: nameOf, seats: ['p1', 'p2', 'p3'] }, viewerId }
        })
            .map((part) =>
                part.kind === 'seat'
                    ? part.playerId === viewerId
                        ? '<you>'
                        : `<${nameOf(part.playerId)}>`
                    : part.kind === 'text'
                      ? part.text
                      : `[${part.kind}]`
            )
            .join('')
    const chips = (viewerId?: string, extra: Partial<MajorEventContext> = {}) =>
        context(viewerId, { seatsById: true, ...extra })

    it('Citizenship and the Usurper: the seat starts the line as its chip, and the verb agrees with "you"', () => {
        const taken = action({
            type: ActionType.ResolveCitizenshipOffer,
            playerId: 'p2',
            granted: true
        })
        expect(drawn(majorEventOf(taken, chips('p1'))?.consequence, 'p1')).toBe(
            '<Ben> is a Citizen of the Empire'
        )
        expect(drawn(majorEventOf(taken, chips('p2'))?.consequence, 'p2')).toBe(
            '<you> are a Citizen of the Empire'
        )
        const exiled = action({
            type: ActionType.ExileCitizen,
            playerId: 'p1',
            citizenPlayerId: 'p2'
        })
        expect(drawn(majorEventOf(exiled, chips('p3'))?.consequence, 'p3')).toBe(
            '<Ben> is an Exile again'
        )
        const flip = action({
            type: ActionType.ResolveWake,
            playerId: 'p3',
            favorSteps: [],
            metadata: { flippedToUsurper: true }
        })
        expect(drawn(majorEventOf(flip, chips('p1'))?.consequence, 'p1')).toBe(
            'If <Cass> still holds it at their next Wake, <Cass> wins'
        )
        expect(drawn(majorEventOf(flip, chips('p3'))?.consequence, 'p3')).toBe(
            'If <you> still hold it at your next Wake, <you> win'
        )
    })

    it('the game-end row names its winner by their chip', () => {
        const state = ended({ p3: { revealedVisionId: FAITH } })
        expect(drawn(endEvent(state, 'p3', 'R-3.1', chips('p1')).sentence, 'p1')).toBe(
            '<Cass> won as Usurper'
        )
        expect(drawn(endEvent(state, 'p3', 'R-3.1', chips('p3')).sentence, 'p3')).toBe(
            '<you> won as Usurper'
        )
    })
})
