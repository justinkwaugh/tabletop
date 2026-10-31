import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    Color,
    GameResult,
    RecordedHistory,
    assertExists,
    createCallGameAction,
    latestPlayerUndoTarget,
    type GameAction
} from '@tabletop/common'
import { OathHydrator } from '../definition/hydrator.js'
import { engine } from '../testing/engine.js'
import { buildAction, machineContext } from '../testing/actions.js'
import { testBanners, testPlayer, testState } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { served, spectator } from '../testing/projection.js'
import {
    placeEdifice,
    HALL_OF_DEBATE,
    SPRAWLING_RAMPART,
    GREAT_SPIRE
} from '../testing/edifices.js'
import { chronicleAnswer, wonTable, wonWithActions } from '../testing/chronicle.js'
import { chronicleCensus, wholeWorld } from '../testing/chronicleWorld.js'
import { PRINTED_DENIZENS_BY_SUIT } from '../data/cardRegistry.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { OathStateHandlers } from '../definition/stateHandlers.js'
import { Banner, OathType, PlayerStatus, Suit } from '../model/oathEnums.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import type { AdviserRow, OathPlayerState } from '../model/playerState.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { CHRONICLE_STORY_LIMIT, ChronicleStep, type TableRecord } from '../model/chronicle.js'
import { WinKind } from '../model/ending.js'
import { ChooseOath, ChooseOathValidator } from '../actions/chooseOath.js'
import { OfferChronicleCitizenship } from '../actions/offerChronicleCitizenship.js'
import {
    AnswerChronicleCitizenship,
    isAnswerChronicleCitizenship
} from '../actions/answerChronicleCitizenship.js'
import { BuildOrRepairEdifice, isBuildOrRepairEdifice } from '../actions/buildOrRepairEdifice.js'
import { ChooseChronicleSuit, isChooseChronicleSuit } from '../actions/chooseChronicleSuit.js'
import { ChooseHealStack } from '../actions/chooseHealStack.js'
import {
    WriteChronicleStory,
    WriteChronicleStoryValidator as StoryValidator,
    isWriteChronicleStory
} from '../actions/writeChronicleStory.js'
import { isChronicleFlipCitizens } from '../actions/chronicleFlipCitizens.js'
import { SkipChronicleStory } from '../actions/skipChronicleStory.js'
import { ResolveWake } from '../actions/resolveWake.js'
import { HydratedLetPeek, LetPeek, LetPeekSubjectKind } from '../actions/letPeek.js'
import {
    chronicleSuitLeaders,
    citizenshipEligible,
    edificeChoices,
    reasonCannotWriteChronicleStory,
    vowableOaths
} from '../util/chronicleChoices.js'
import { OathRevision } from '../util/revision.js'
import { CHRONICLE_CITIZENSHIP_GROUP } from '../util/chronicleChoices.js'
import type { GameOutcome } from '../util/victory.js'
import '../powers/index.js'

const DANA = 'dana'
const RHYS = 'rhys'
const ANN = 'ann'
const BEA = 'bea'
const CY = 'cy'
const TABLE: TableRecord = {
    name: 'Thursday table',
    date: '2026-10-22',
    seatNames: { dana: 'Dana', rhys: 'Rhys', ann: 'Ann', bea: 'Bea', cy: 'Cy' }
}

const PLAINS = 'c1'
const RIVER = 'c2'
const ANCIENT_CITY = 'p1'
const STEPPE = 'p2'
const HIDDEN_PLACE = 'p3'
const DEEP_WOODS = 'h1'
const WASTES = 'h2'
const MOUNTAIN = 'h3'

const SITES = {
    [PLAINS]: 'site.plains',
    [RIVER]: 'site.river',
    [ANCIENT_CITY]: 'site.ancient-city',
    [STEPPE]: 'site.steppe',
    [HIDDEN_PLACE]: 'site.the-hidden-place',
    [DEEP_WOODS]: 'site.deep-woods',
    [WASTES]: 'site.wastes',
    [MOUNTAIN]: 'site.mountain'
}

const LONGBOWS = 'denizen.order.longbows'
const CURFEW = 'denizen.order.curfew'
const TOLL_ROADS = 'denizen.order.toll-roads'
const KNIGHTS_ERRANT = 'denizen.order.knights-errant'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const MARRIAGE = 'denizen.hearth.marriage'
const WOLVES = 'denizen.beast.wolves'
const BRACKEN = 'denizen.beast.bracken'
const RANGERS = 'denizen.beast.rangers'
const BIRDSONG = 'denizen.beast.birdsong'
const ALCHEMIST = 'denizen.arcane.alchemist'
const CHARLATAN = 'denizen.discord.charlatan'
const GREAT_HERD = 'denizen.nomad.great-herd'
const BANDIT_CROWN = 'relic.bandit-crown'
const FAITH = 'vision.faith'

const USURPER: GameOutcome = { winnerPlayerId: DANA, kind: WinKind.Usurper, rule: 'R-3.1' }

const faceup = (cardId: string): AdviserRow => ({ cardId, faceUp: true })
const facedown = (cardId: string): AdviserRow => ({ cardId, faceUp: false })

function seat(
    playerId: string,
    color: Color,
    status: PlayerStatus,
    overrides: Partial<OathPlayerState> = {}
): OathPlayerState {
    return testPlayer({ playerId, color, status, siteId: PLAINS, ...overrides })
}

/**
 * A table at the chronicle revision, started with its table record, and every card of the game
 * somewhere: R-8's steps deal with all of them.
 */
function tableOf(players: OathPlayerState[], overrides: Partial<OathProjectedState> = {}) {
    return wholeWorld(
        testState(players, {
            oathRevision: OathRevision.Chronicle,
            table: TABLE,
            siteCards: SITES,
            ...overrides
        })
    )
}

/**
 * Game 1 at its end, under Supremacy: Rhys the Chancellor; Dana (red), the Usurper, rules
 * the Plains and Deep Woods; Ann (blue) Ancient City and Steppe; Rhys River and The Hidden Place;
 * Wastes has no warbands. Dana's faceup advisers are two Beast and one Order, and one is facedown.
 */
function gameOne(
    over: Partial<Record<string, Partial<OathPlayerState>>> = {},
    state: Partial<OathProjectedState> = {}
): HydratedOathGameState {
    return tableOf(
        [
            seat(DANA, Color.Red, PlayerStatus.Exile, {
                advisers: [faceup(WOLVES), faceup(BRACKEN), faceup(CURFEW), facedown(ALCHEMIST)],
                ...over[DANA]
            }),
            seat(RHYS, Color.Purple, PlayerStatus.Chancellor, {
                advisers: [facedown(CHARLATAN)],
                ...over[RHYS]
            }),
            seat(ANN, Color.Blue, PlayerStatus.Exile, {
                advisers: [facedown(GREAT_HERD)],
                ...over[ANN]
            }),
            ...(over[BEA] ? [seat(BEA, Color.Yellow, PlayerStatus.Exile, over[BEA])] : []),
            ...(over[CY] ? [seat(CY, Color.White, PlayerStatus.Exile, over[CY])] : [])
        ],
        {
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: DANA,
            oathkeeperIsUsurper: true,
            warbandsBySite: {
                [PLAINS]: { [DANA]: 2 },
                [DEEP_WOODS]: { [DANA]: 1 },
                [ANCIENT_CITY]: { [ANN]: 2 },
                [STEPPE]: { [ANN]: 1 },
                [RIVER]: { [IMPERIAL_WARBANDS]: 3 },
                [HIDDEN_PLACE]: { [IMPERIAL_WARBANDS]: 1 }
            },
            denizensBySite: { [PLAINS]: [LONGBOWS], [ANCIENT_CITY]: [LAND_WARDEN] },
            ...state
        }
    )
}

/**
 * Game 2 at its end, under Protection: Ann, a Citizen (blue), won as Successor; Dana is
 * the Chancellor; Rhys (red) an Exile. Purple holds Plains, Ancient City and Steppe; red River and
 * Lush Coast; Deep Woods is empty. Ann's faceup advisers are one Order and one Hearth.
 */
function gameTwo(
    over: Partial<Record<string, Partial<OathPlayerState>>> = {},
    state: Partial<OathProjectedState> = {}
): HydratedOathGameState {
    return tableOf(
        [
            seat(DANA, Color.Purple, PlayerStatus.Chancellor, {
                advisers: [facedown(CHARLATAN)],
                ...over[DANA]
            }),
            seat(RHYS, Color.Red, PlayerStatus.Exile, {
                advisers: [facedown(GREAT_HERD)],
                ...over[RHYS]
            }),
            seat(ANN, Color.Blue, PlayerStatus.Citizen, {
                advisers: [faceup(KNIGHTS_ERRANT), faceup(LAND_WARDEN), facedown(ALCHEMIST)],
                ...over[ANN]
            })
        ],
        {
            oathType: OathType.Protection,
            siteCards: { ...SITES, [HIDDEN_PLACE]: 'site.lush-coast' },
            warbandsBySite: {
                [PLAINS]: { [IMPERIAL_WARBANDS]: 2 },
                [ANCIENT_CITY]: { [IMPERIAL_WARBANDS]: 1 },
                [STEPPE]: { [IMPERIAL_WARBANDS]: 2 },
                [RIVER]: { [RHYS]: 2 },
                [HIDDEN_PLACE]: { [RHYS]: 1 }
            },
            denizensBySite: {
                [PLAINS]: [LONGBOWS, WOLVES],
                [ANCIENT_CITY]: [MARRIAGE],
                [RIVER]: [TOLL_ROADS],
                [DEEP_WOODS]: [BRACKEN]
            },
            ...state
        }
    )
}

const SUCCESSOR: GameOutcome = { winnerPlayerId: ANN, kind: WinKind.Successor, rule: 'R-3.3.1' }
const CHANCELLOR_WINS: GameOutcome = {
    winnerPlayerId: DANA,
    kind: WinKind.StableRegime,
    rule: 'R-3.3'
}

type Played = { final: OathProjectedState; actions: GameAction[] }

function run(state: OathProjectedState, ...steps: GameAction[]): Played {
    const game = testGame(state.players.map((player) => player.playerId))
    let final = state
    const actions: GameAction[] = []
    for (const step of steps) {
        const result = engine.runNext(step, final, game)
        actions.push(...result.processedActions)
        final = result.updatedState
    }
    return { final, actions }
}

/**
 * The words a refused step reaches its player in: through the engine for a player on the clock, and
 * from the phase's own check for one who is not (the platform refuses them first, in its own words).
 */
function refusal(state: OathProjectedState, step: GameAction): string {
    const game = testGame(state.players.map((player) => player.playerId))
    try {
        if (step.playerId && state.activePlayerIds.includes(step.playerId)) {
            engine.runNext(step, state, game)
        } else {
            OathStateHandlers[MachineState.Chronicle].isValidAction(
                new OathHydrator().hydrateAction(step),
                machineContext(hydrated(state))
            )
        }
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
    throw Error('the step was accepted')
}

function validFor(state: OathProjectedState, playerId: string) {
    const game = testGame(state.players.map((player) => player.playerId))
    const view = served(state, { kind: 'player', playerId })
    return engine.getValidActionTypesForPlayer(game, view, playerId)
}

const hydrated = (state: OathProjectedState) => new HydratedOathGameState(state)

const vow = (playerId: string, oathType: OathType, id = 'vow') =>
    buildAction(ChooseOath, { id, playerId, oathType })
const offer = (exilePlayerIds: string[], playerId = DANA, id = 'offer') =>
    buildAction(OfferChronicleCitizenship, { id, playerId, exilePlayerIds })
const answer = (playerId: string, accept: boolean) => chronicleAnswer(playerId, accept)
const build = (playerId: string, choice?: { siteId: string; cardId: string }) =>
    buildAction(BuildOrRepairEdifice, { id: 'build', playerId, ...(choice ? { choice } : {}) })
const suit = (playerId: string, chosen: Suit) =>
    buildAction(ChooseChronicleSuit, { id: 'suit', playerId, suit: chosen })
const skip = (playerId: string) => buildAction(SkipChronicleStory, { id: 'skip', playerId })
const story = (playerId: string, text: string) =>
    buildAction(WriteChronicleStory, { id: 'story', playerId, text })

/**
 * R-X.3, the projected-state rule: the offer on the chooser's own view is the offer on the full
 * state, and every other seat, on its own view and the spectator's, is offered nothing.
 */
function expectOfferedOnlyTo(
    state: OathProjectedState,
    choosers: string[],
    expected: string[],
    offerOf: (state: HydratedOathGameState) => unknown
) {
    const full = offerOf(hydrated(state))
    expect(state.activePlayerIds).toEqual(choosers)
    for (const player of state.players) {
        const own = served(state, { kind: 'player', playerId: player.playerId })
        expect(offerOf(hydrated(own))).toEqual(full)
        if (choosers.includes(player.playerId)) {
            expect(validFor(state, player.playerId)).toEqual(expected)
        } else {
            expect(validFor(state, player.playerId)).toEqual([])
        }
    }
    // The spectator sees the same offer, and has no seat to act from.
    expect(offerOf(hydrated(served(state, spectator)))).toEqual(full)
}

describe('R-8.1 — the Vow', () => {
    it('a free Vow offers every Oath but the one this game was played under', () => {
        const won = wonTable(gameOne(), USURPER)
        expect(won.machineState).toBe(MachineState.Chronicle)
        expect(won.chronicle?.step).toBe(ChronicleStep.Vow)
        expect(vowableOaths(hydrated(won))).toEqual([
            OathType.ThePeople,
            OathType.Devotion,
            OathType.Protection
        ])
        expect(refusal(won, vow(DANA, OathType.Supremacy))).toBe(
            'the next Oath cannot be the one this game was played under'
        )
    })

    it('the winner vows: the chronicle and the record keep the next Oath, and this game’s stays', () => {
        const { final } = run(wonTable(gameOne(), USURPER), vow(DANA, OathType.Protection))
        expect(final.chronicle?.vowedOath).toBe(OathType.Protection)
        expect(final.oathType).toBe(OathType.Supremacy)
        expect(final.chronicle?.step).toBe(ChronicleStep.Citizenship)
    })

    it('refuses another seat, another step and an unknown Oath', () => {
        const won = wonTable(gameOne(), USURPER)
        expect(refusal(won, vow(ANN, OathType.Protection))).toBe('Dana vows the Oath, not Ann')
        const offering = run(won, vow(DANA, OathType.Protection)).final
        expect(refusal(offering, vow(DANA, OathType.Devotion))).toBe(
            'the Oath is chosen only while the chronicle asks for it'
        )
        expect(
            ChooseOathValidator.Check({ ...vow(DANA, OathType.Protection), oathType: 'conquest' })
        ).toBe(false)
    })

    describe('a win with a Vision alone', () => {
        /** R-3.2 — Dana, an Exile who is not the Oathkeeper, meets their revealed Faith under Devotion. */
        function faithAlone() {
            return gameOne(
                { [DANA]: { revealedVisionId: FAITH } },
                {
                    oathType: OathType.Devotion,
                    oathkeeperPlayerId: RHYS,
                    oathkeeperIsUsurper: undefined,
                    banners: testBanners({ [Banner.DarkestSecret]: DANA }),
                    visionsDrawn: 3
                }
            )
        }
        const VISIONARY: GameOutcome = {
            winnerPlayerId: DANA,
            kind: WinKind.Visionary,
            rule: 'R-3.2'
        }

        it('does not stop: the Oath is Faith’s, Devotion, even though it is this game’s', () => {
            const { final: won, actions } = wonWithActions(faithAlone(), VISIONARY)
            expect(won.chronicle?.ending.waysMet).toEqual({
                usurper: false,
                visionIds: [FAITH],
                empire: false
            })
            expect(won.chronicle?.vowedOath).toBe(OathType.Devotion)
            // The Vision that vowed it is the System Action's record, not the State's.
            expect(
                actions.find((action) => action.type === ActionType.ChronicleForcedVow)
            ).toMatchObject({
                source: ActionSource.System,
                revealsInfo: false,
                metadata: { winnerPlayerId: DANA, oathType: OathType.Devotion, visionId: FAITH }
            })
            expect(Object.keys(won.chronicle ?? {})).not.toContain('vowedByVisionId')
            expect(won.chronicle?.step).toBe(ChronicleStep.Citizenship)
        })

        it('while its System Action is due, the winner is offered nothing and a chosen Oath is refused', () => {
            const state = hydrated(wonTable(faithAlone(), VISIONARY))
            const chronicle = state.chronicle
            assertExists(chronicle, 'the win stored its ending')
            chronicle.step = ChronicleStep.Vow
            delete chronicle.vowedOath
            const handler = OathStateHandlers[MachineState.Chronicle]
            const context = machineContext(state)
            expect(handler.validActionsForPlayer(DANA, context)).toEqual([])
            expect(() =>
                handler.isValidAction(
                    new OathHydrator().hydrateAction(vow(DANA, OathType.Protection)),
                    context
                )
            ).toThrow('R-8 — the rules settle this step of the chronicle alone')
        })

        it('records the Vision’s Oath as the next one', () => {
            const won = wonTable(faithAlone(), VISIONARY)
            const { final } = run(won, offer([]), skip(DANA))
            expect(final.chronicleRecord?.at(-1)?.nextOath).toBe(OathType.Devotion)
        })
    })

    it('the offer is the same on the winner’s view; no other seat is offered anything', () => {
        expectOfferedOnlyTo(
            wonTable(gameOne(), USURPER),
            [DANA],
            [ActionType.ChooseOath],
            vowableOaths
        )
    })
})

describe('R-8.2 — Citizenship, an Exile winner only', () => {
    function vowed(table = gameOne()) {
        return run(wonTable(table, USURPER), vow(DANA, OathType.Protection)).final
    }

    it('offers every other Exile: never the winner (R-8.2-H1) or the Chancellor', () => {
        const offering = vowed()
        expect(offering.activePlayerIds).toEqual([DANA])
        expect(citizenshipEligible(hydrated(offering))).toEqual([ANN])
        expect(refusal(offering, offer([DANA]))).toBe('Dana cannot offer Citizenship to themselves')
        expect(refusal(offering, offer([RHYS]))).toBe('Rhys is not an Exile')
        expect(refusal(offering, offer([ANN, ANN]))).toBe('Ann is named twice')
        expect(refusal(offering, offer(['zed']))).toBe('zed is not seated in this game')
        expect(refusal(offering, offer([ANN], ANN))).toBe('Dana offers Citizenship, not Ann')
    })

    it('flips every Citizen board to Exile first, the box’s too; those just flipped are not offered', () => {
        const table = gameOne({ [BEA]: { status: PlayerStatus.Citizen } })
        table.boxedCitizenColors = [Color.White]
        const { final: offering, actions } = run(
            wonTable(table, USURPER),
            vow(DANA, OathType.Protection)
        )
        expect(offering.players.find((player) => player.playerId === BEA)?.status).toBe(
            PlayerStatus.Exile
        )
        // State keeps who may not be offered; the boxed boards' colours are the flip's record.
        expect(offering.chronicle?.citizenship).toEqual({ flippedPlayerIds: [BEA] })
        expect(actions.find(isChronicleFlipCitizens)?.metadata).toEqual({
            flippedPlayerIds: [BEA],
            flippedBoxColors: [Color.White]
        })
        expect(Object.keys(offering)).not.toContain('boxedCitizenColors')
        expect(citizenshipEligible(hydrated(offering))).toEqual([ANN])
        expect(refusal(offering, offer([BEA]))).toBe("Bea's board just flipped to its Exile side")
    })

    it('the offers go out together and the Exiles answer in any order; the phase waits for the last', () => {
        const offering = vowed(gameOne({ [BEA]: { status: PlayerStatus.Exile } }))
        const offered = run(offering, offer([ANN, BEA])).final
        expect(offered.machineState).toBe(MachineState.Chronicle)
        expect(offered.chronicle?.step).toBe(ChronicleStep.Citizenship)
        expect(offered.activePlayerIds).toEqual([ANN, BEA])

        const beaAnswered = run(offered, answer(BEA, false)).final
        expect(beaAnswered.chronicle?.step).toBe(ChronicleStep.Citizenship)
        expect(beaAnswered.activePlayerIds).toEqual([ANN])
        expect(refusal(beaAnswered, answer(BEA, true))).toBe('Bea has already answered')

        const done = run(beaAnswered, answer(ANN, true)).final
        expect(done.chronicle?.step).toBe(ChronicleStep.Story)
        expect(done.chronicle?.citizenship?.offers).toEqual([
            { playerId: ANN, accepted: true },
            { playerId: BEA, accepted: false }
        ])
    })

    /** Ann and Bea offered: the phase waits on Bea, so Ann's answer is seen before R-8.3.4 clears the map. */
    function offeredWithBea(over: Partial<Record<string, Partial<OathPlayerState>>> = {}) {
        return run(
            vowed(gameOne({ [BEA]: { status: PlayerStatus.Exile }, ...over })),
            offer([ANN, BEA])
        ).final
    }

    it('an accepter flips to Citizen; one of the winner’s warbands replaces all of theirs at each site they rule', () => {
        const { final, actions } = run(offeredWithBea(), answer(ANN, true))
        const ann = final.players.find((player) => player.playerId === ANN)
        expect(ann?.status).toBe(PlayerStatus.Citizen)
        expect(final.warbandsBySite[ANCIENT_CITY]).toEqual({ [ANN]: 0, [DANA]: 1 })
        expect(final.warbandsBySite[STEPPE]).toEqual({ [ANN]: 0, [DANA]: 1 })
        // Nowhere else: Dana's own sites and the Empire's are as they were.
        expect(final.warbandsBySite[PLAINS]).toEqual({ [DANA]: 2 })
        expect(final.warbandsBySite[RIVER]).toEqual({ [IMPERIAL_WARBANDS]: 3 })
        expect(final.warbandsBySite[WASTES]).toBeUndefined()
        expect(actions.find(isAnswerChronicleCitizenship)?.metadata).toEqual({
            siteIds: [ANCIENT_CITY, STEPPE],
            siteCardIds: [SITES[ANCIENT_CITY], SITES[STEPPE]],
            winnerPlayerId: DANA
        })
    })

    it('an accepter holding the Bandit Crown: a warband even at the empty sites the bandits hold for them', () => {
        const offered = offeredWithBea({ [ANN]: { relicIds: [BANDIT_CROWN] } })
        const { final, actions } = run(offered, answer(ANN, true))
        // Wastes and Mountain hold no warbands, so the Crown's bandits serve Ann there (R-7.6.5-H1).
        expect(actions.find(isAnswerChronicleCitizenship)?.metadata).toEqual({
            siteIds: [ANCIENT_CITY, STEPPE, WASTES, MOUNTAIN],
            siteCardIds: [SITES[ANCIENT_CITY], SITES[STEPPE], SITES[WASTES], SITES[MOUNTAIN]],
            winnerPlayerId: DANA
        })
        expect(final.warbandsBySite[WASTES]).toEqual({ [DANA]: 1 })
        expect(final.warbandsBySite[MOUNTAIN]).toEqual({ [DANA]: 1 })
        expect(final.warbandsBySite[ANCIENT_CITY]).toEqual({ [ANN]: 0, [DANA]: 1 })
    })

    it('a refusal changes nothing; only the offered answer, each once', () => {
        const offered = offeredWithBea()
        expect(refusal(offered, answer(DANA, true))).toBe('no offer is open to Dana')
        expect(refusal(offered, answer(RHYS, true))).toBe('no offer is open to Rhys')
        const { final } = run(offered, answer(ANN, false))
        expect(final.players.find((player) => player.playerId === ANN)?.status).toBe(
            PlayerStatus.Exile
        )
        expect(final.warbandsBySite[ANCIENT_CITY]).toEqual({ [ANN]: 2 })
    })

    it('the record lists the accepters by name and the colour they played', () => {
        const offered = run(vowed(), offer([ANN])).final
        const { final } = run(offered, answer(ANN, true), story(DANA, 'The Usurper held.'))
        expect(final.chronicleRecord?.at(-1)).toMatchObject({
            nextOath: OathType.Protection,
            citizens: [{ name: 'Ann', color: Color.Blue }]
        })
    })

    it('a call while the offers wait on answers ends the game with no continuation', () => {
        const offered = run(vowed(), offer([ANN])).final
        const call = createCallGameAction({
            gameId: 'game-1',
            ballot: {
                initiatorPlayerId: RHYS,
                declaredWinnerId: DANA,
                approvingPlayerIds: [DANA, RHYS, ANN],
                decliningPlayerIds: []
            },
            players: [{}, {}, {}]
        })
        const called = engine.runNext(call, offered, testGame([DANA, RHYS, ANN])).updatedState
        expect(called.result).toBe(GameResult.Win)
        expect(called.canContinue).toBeUndefined()
    })

    it('"No offer" moves on, and the record lists no Citizens', () => {
        const { final } = run(vowed(), offer([]))
        expect(final.chronicle?.step).toBe(ChronicleStep.Story)
        expect(final.chronicle?.citizenship?.offers).toEqual([])
        expect(
            Object.keys(run(final, skip(DANA)).final.chronicleRecord?.at(-1) ?? {})
        ).not.toContain('citizens')
    })

    it('no step when nobody can be offered: the Chancellor is the only other seat', () => {
        const table = tableOf(
            [
                seat(DANA, Color.Red, PlayerStatus.Exile),
                seat(RHYS, Color.Purple, PlayerStatus.Chancellor)
            ],
            { oathkeeperPlayerId: DANA, oathkeeperIsUsurper: true }
        )
        const { final } = run(wonTable(table, USURPER), vow(DANA, OathType.Protection))
        expect(final.chronicle?.citizenship).toEqual({ flippedPlayerIds: [] })
        expect(final.chronicle?.step).toBe(ChronicleStep.Suit)
    })

    it('a Chancellor or Citizen winner has no 8.2: no board flips, no offer', () => {
        const won = wonTable(gameTwo(), SUCCESSOR)
        const vowedTwo = run(won, vow(ANN, OathType.Devotion)).final
        expect(vowedTwo.chronicle?.citizenship).toBeUndefined()
        expect(vowedTwo.chronicle?.step).toBe(ChronicleStep.BuildOrRepair)
        expect(vowedTwo.players.find((player) => player.playerId === ANN)?.status).toBe(
            PlayerStatus.Citizen
        )
    })

    it('the offer and the answers are the same on each chooser’s view, and nobody else’s', () => {
        const offering = vowed(gameOne({ [BEA]: { status: PlayerStatus.Exile } }))
        expectOfferedOnlyTo(
            offering,
            [DANA],
            [ActionType.OfferChronicleCitizenship],
            citizenshipEligible
        )
        const offered = run(offering, offer([ANN, BEA])).final
        expectOfferedOnlyTo(
            offered,
            [ANN, BEA],
            [ActionType.AnswerChronicleCitizenship],
            (state) => state.chronicle?.citizenship
        )
    })
})

describe('R-8.3.1 — build or repair, a Chancellor or Citizen winner only', () => {
    function building(table = gameTwo()) {
        return run(wonTable(table, SUCCESSOR), vow(ANN, OathType.Devotion)).final
    }

    it('offers each denizen at a site the winner rules whose suit’s edifice is in the Archive', () => {
        const state = building()
        expect(state.activePlayerIds).toEqual([ANN])
        // Ann rules every purple site (R-6.6.3), not Rhys's River or the empty Deep Woods.
        expect(edificeChoices(hydrated(state))).toEqual([
            { siteId: PLAINS, cardId: LONGBOWS, edificeId: SPRAWLING_RAMPART, repair: false },
            {
                siteId: PLAINS,
                cardId: WOLVES,
                edificeId: 'edifice.beast.forest-temple',
                repair: false
            },
            { siteId: ANCIENT_CITY, cardId: MARRIAGE, edificeId: HALL_OF_DEBATE, repair: false }
        ])
    })

    it('builds Sprawling Rampart at the Plains in Longbows’ place; Longbows waits, public, for the world deck’s rebuild', () => {
        const { final, actions } = run(building(), build(ANN, { siteId: PLAINS, cardId: LONGBOWS }))
        expect(final.denizensBySite[PLAINS]).toEqual([SPRAWLING_RAMPART, WOLVES])
        expect(final.chronicle?.returnedDenizenId).toBe(LONGBOWS)
        expect(final.chronicle?.built).toEqual({
            edificeId: SPRAWLING_RAMPART,
            siteId: PLAINS,
            siteCardId: 'site.plains',
            repaired: false
        })
        expect(actions.find(isBuildOrRepairEdifice)?.metadata).toEqual({
            edificeId: SPRAWLING_RAMPART,
            siteCardId: 'site.plains',
            repaired: false,
            returnedDenizenId: LONGBOWS
        })
        // R-8.3.2 to R-8.3.5 run as the System Action after the build, and they draw (R-X.3).
        expect(actions.map((action) => [action.type, action.revealsInfo]).slice(0, 2)).toEqual([
            [ActionType.BuildOrRepairEdifice, false],
            [ActionType.ChronicleMap, true]
        ])
        const ended = run(final, suit(ANN, Suit.Order), skip(ANN)).final
        expect(ended.chronicleRecord?.at(-1)?.built).toEqual({
            edificeId: SPRAWLING_RAMPART,
            siteId: PLAINS,
            siteCardId: 'site.plains',
            repaired: false
        })
    })

    it('refuses a site the winner does not rule', () => {
        expect(refusal(building(), build(ANN, { siteId: RIVER, cardId: TOLL_ROADS }))).toBe(
            'you do not rule River'
        )
    })

    it('refuses a site that holds an edifice on either side, and repairs the ruin there instead', () => {
        const table = gameTwo()
        placeEdifice(table, STEPPE, GREAT_SPIRE, { ruined: true })
        table.denizensBySite[STEPPE].push(CURFEW)
        const state = building(table)
        expect(refusal(state, build(ANN, { siteId: STEPPE, cardId: CURFEW }))).toBe(
            'Steppe already holds an edifice'
        )
        expect(edificeChoices(hydrated(state))).toContainEqual({
            siteId: STEPPE,
            cardId: GREAT_SPIRE,
            edificeId: GREAT_SPIRE,
            repair: true
        })
        const { final } = run(state, build(ANN, { siteId: STEPPE, cardId: GREAT_SPIRE }))
        expect(final.ruinedEdificeIds).toBeUndefined()
        expect(final.chronicle?.built).toEqual({
            edificeId: GREAT_SPIRE,
            siteId: STEPPE,
            siteCardId: 'site.steppe',
            repaired: true
        })
        expect(final.chronicle?.returnedDenizenId).toBeUndefined()
    })

    it('an intact edifice at a site the winner rules is not offered for repair', () => {
        const table = gameTwo()
        placeEdifice(table, STEPPE, GREAT_SPIRE)
        const state = building(table)
        expect(edificeChoices(hydrated(state)).map((choice) => choice.siteId)).not.toContain(STEPPE)
        expect(refusal(state, build(ANN, { siteId: STEPPE, cardId: GREAT_SPIRE }))).toBe(
            'Great Spire is not a ruin'
        )
    })

    it('an edifice ruined at a site the winner does not rule is not in the Archive', () => {
        const table = gameTwo()
        placeEdifice(table, RIVER, HALL_OF_DEBATE, { ruined: true })
        const state = building(table)
        expect(edificeChoices(hydrated(state)).map((choice) => choice.cardId)).not.toContain(
            MARRIAGE
        )
        expect(refusal(state, build(ANN, { siteId: ANCIENT_CITY, cardId: MARRIAGE }))).toBe(
            'the Hearth edifice is not in the Archive'
        )
        expect(refusal(state, build(ANN, { siteId: RIVER, cardId: HALL_OF_DEBATE }))).toBe(
            'you do not rule River'
        )
    })

    it('a suit whose edifice is intact on the map is not offered', () => {
        const table = gameTwo()
        placeEdifice(table, DEEP_WOODS, SPRAWLING_RAMPART)
        expect(
            edificeChoices(hydrated(building(table))).map((choice) => choice.cardId)
        ).not.toContain(LONGBOWS)
    })

    it('"None" is always legal and builds nothing', () => {
        const { final } = run(building(), build(ANN))
        expect(final.denizensBySite[PLAINS]).toEqual([LONGBOWS, WOLVES])
        expect(final.chronicle?.built).toBeUndefined()
        expect(final.chronicle?.step).toBe(ChronicleStep.Suit)
    })

    it('a Chancellor winner rules the sites a Citizen’s Bandit Crown holds (its chronicle answer)', () => {
        const table = gameTwo({ [ANN]: { relicIds: [BANDIT_CROWN] } })
        const state = run(wonTable(table, CHANCELLOR_WINS), vow(DANA, OathType.Devotion)).final
        expect(state.chronicle?.step).toBe(ChronicleStep.BuildOrRepair)
        expect(edificeChoices(hydrated(state)).map((choice) => choice.siteId)).toContain(DEEP_WOODS)
    })

    it('an Exile winner who rules only a ruin never repairs it', () => {
        const table = gameOne()
        placeEdifice(table, HIDDEN_PLACE, SPRAWLING_RAMPART, { ruined: true })
        table.warbandsBySite[HIDDEN_PLACE] = { [DANA]: 1 }
        const { final } = run(wonTable(table, USURPER), vow(DANA, OathType.Protection), offer([]))
        expect(final.chronicle?.step).toBe(ChronicleStep.Story)
        expect(final.ruinedEdificeIds).toEqual([SPRAWLING_RAMPART])
        expect(
            refusal(final, build(DANA, { siteId: HIDDEN_PLACE, cardId: SPRAWLING_RAMPART }))
        ).toBe('an edifice is built or repaired only while the chronicle asks for it')
    })

    it('the pairs are the same on the winner’s view; no other seat is offered anything', () => {
        expectOfferedOnlyTo(building(), [ANN], [ActionType.BuildOrRepairEdifice], edificeChoices)
    })
})

describe('R-8.4 — the suit', () => {
    function toSuit(over: Partial<OathPlayerState>, state: Partial<OathProjectedState> = {}) {
        return run(
            wonTable(gameTwo({ [ANN]: over }, state), SUCCESSOR),
            vow(ANN, OathType.Devotion),
            build(ANN)
        ).final
    }

    it('a single leader does not stop: it is recorded; a facedown adviser has no suit (R-10.14)', () => {
        const state = toSuit({
            advisers: [faceup(KNIGHTS_ERRANT), facedown(RANGERS), facedown(BIRDSONG)]
        })
        expect(state.chronicle?.suit).toBe(Suit.Order)
        expect(state.chronicle?.step).toBe(ChronicleStep.Story)
    })

    it('a tie stops: the winner picks among the tied suits only, in the clockwise order', () => {
        const state = toSuit({})
        expect(state.chronicle?.step).toBe(ChronicleStep.Suit)
        expect(chronicleSuitLeaders(hydrated(state))).toEqual([Suit.Order, Suit.Hearth])
        expect(refusal(state, suit(ANN, Suit.Arcane))).toBe(
            'Arcane is not among the most common suits in your advisers'
        )
        const { final, actions } = run(state, suit(ANN, Suit.Order))
        expect(final.chronicle?.suit).toBe(Suit.Order)
        // The choice's record says what it adds; the System Action after it draws them.
        expect(actions.find(isChooseChronicleSuit)?.metadata).toEqual({
            tiedSuits: [Suit.Order, Suit.Hearth],
            added: { suits: [Suit.Order, Suit.Hearth, Suit.Beast] }
        })
        expect(
            actions.find((action) => action.type === ActionType.ChronicleAddCards)
        ).toMatchObject({
            revealsInfo: true,
            metadata: {
                suit: Suit.Order,
                chosen: true,
                added: { suits: [Suit.Order, Suit.Hearth, Suit.Beast] }
            }
        })
    })

    it('no faceup advisers: all six suits tie', () => {
        const state = toSuit({ advisers: [facedown(RANGERS)] })
        expect(chronicleSuitLeaders(hydrated(state))).toEqual([
            Suit.Discord,
            Suit.Arcane,
            Suit.Order,
            Suit.Hearth,
            Suit.Beast,
            Suit.Nomad
        ])
    })

    it('Marriage counts as two Hearth advisers (R-2.2.2-H1)', () => {
        // Marriage is Ann's, so it is not at Ancient City too.
        const state = toSuit(
            { advisers: [faceup(KNIGHTS_ERRANT), faceup(MARRIAGE)] },
            {
                denizensBySite: {
                    [PLAINS]: [LONGBOWS, WOLVES],
                    [RIVER]: [TOLL_ROADS],
                    [DEEP_WOODS]: [BRACKEN]
                }
            }
        )
        expect(state.chronicle?.suit).toBe(Suit.Hearth)
    })

    it('the tied suits are the same on the winner’s view; no other seat is offered anything', () => {
        expectOfferedOnlyTo(
            toSuit({}),
            [ANN],
            [ActionType.ChooseChronicleSuit],
            chronicleSuitLeaders
        )
    })
})

describe('R-8.4.a-H1 — the heal stack, once a tie is published', () => {
    /**
     * Game 2 with the Archive short of Order: Ann picks Order, so R-8.4 cannot add its three, and
     * the Dispossessed's Order and Beast stacks tie at five.
     */
    function healing() {
        const table = gameTwo()
        const vault = table.requireVault()
        const inGame = new Set([LONGBOWS, TOLL_ROADS, KNIGHTS_ERRANT, WOLVES, BRACKEN])
        const order = PRINTED_DENIZENS_BY_SUIT[Suit.Order].filter((id) => !inGame.has(id))
        const beast = PRINTED_DENIZENS_BY_SUIT[Suit.Beast].filter((id) => !inGame.has(id))
        vault.dispossessed = [...order.slice(0, 5), ...beast.slice(0, 5)]
        table.dispossessedCount = 10
        // Two Order cards stay in the Archive.
        vault.worldDeck.push(...order.slice(5, -2))
        return run(
            wonTable(table, SUCCESSOR),
            vow(ANN, OathType.Devotion),
            build(ANN),
            suit(ANN, Suit.Order)
        ).final
    }
    const heal = (chosen: Suit) =>
        buildAction(ChooseHealStack, { id: 'heal', playerId: ANN, suit: chosen })

    it('the winner chooses among the tied stacks only', () => {
        const state = healing()
        expect(state.chronicle?.step).toBe(ChronicleStep.HealStack)
        expect(state.chronicle?.healTie).toEqual({ suits: [Suit.Order, Suit.Beast], count: 5 })
        expect(refusal(state, heal(Suit.Arcane))).toBe(
            'Arcane is not among the largest Dispossessed stacks'
        )
        const { final } = run(state, heal(Suit.Beast))
        expect(final.chronicle?.healSuit).toBe(Suit.Beast)
        expect(final.chronicle?.added).toEqual({ heal: { suit: Suit.Beast, count: 5 } })
        expect(final.chronicle?.step).toBe(ChronicleStep.Story)
    })

    it('no tie published, no step', () => {
        const { final } = run(
            wonTable(gameTwo(), SUCCESSOR),
            vow(ANN, OathType.Devotion),
            build(ANN),
            suit(ANN, Suit.Order)
        )
        expect(final.chronicle?.step).toBe(ChronicleStep.Story)
    })

    it('the tie is the same on the winner’s view; no other seat is offered anything', () => {
        expectOfferedOnlyTo(
            healing(),
            [ANN],
            [ActionType.ChooseHealStack],
            (state) => state.chronicle?.healTie
        )
    })
})

describe('the story, the last step', () => {
    function atStory() {
        return run(wonTable(gameOne(), USURPER), vow(DANA, OathType.Protection), offer([])).final
    }

    it('nothing is final before it is answered: no result, no continuation, no entry', () => {
        const state = atStory()
        expect(state.chronicle?.step).toBe(ChronicleStep.Story)
        expect(state.result).toBeUndefined()
        expect(state.canContinue).toBeUndefined()
        expect(state.chronicleRecord).toBeUndefined()
    })

    it('Write: the trimmed text is kept once, in the record, then the result and the continuation', () => {
        const { final, actions } = run(
            atStory(),
            story(DANA, '  The Usurper held.\r\nNo one else did.  ')
        )
        expect(final.chronicleRecord?.at(-1)?.story).toBe('The Usurper held.\nNo one else did.')
        expect(final.chronicle && Object.keys(final.chronicle)).not.toContain('story')
        // The row names the game from the action's own record.
        expect(actions.find(isWriteChronicleStory)?.metadata).toEqual({ gameNumber: 1 })
        expect(final.result).toBe(GameResult.Win)
        expect(final.canContinue).toBe(true)
        expect(reasonCannotWriteChronicleStory(hydrated(final), DANA, 'Again.')).toBe(
            'the story of this game is already written'
        )
    })

    it('Skip: no story in the record', () => {
        const { final } = run(atStory(), skip(DANA))
        expect(final.result).toBe(GameResult.Win)
        expect(Object.keys(final.chronicleRecord?.at(-1) ?? {})).not.toContain('story')
    })

    it('counts up to 1,000 characters as code points: 1,000 astral characters are taken, 1,001 refused', () => {
        const state = atStory()
        expect(CHRONICLE_STORY_LIMIT).toBe(1000)
        const longest = '🜂'.repeat(1000)
        expect(run(state, story(DANA, longest)).final.chronicleRecord?.at(-1)?.story).toBe(longest)
        // The schema caps it too, counting grapheme clusters: never fewer allowed than the handler.
        expect(() => story(DANA, `${longest}a`)).toThrow()
        expect(StoryValidator.Check(story(DANA, longest))).toBe(true)
        // 1,001 code points in 1,000 clusters pass the schema; the handler counts code points.
        const combined = `${'a'.repeat(999)}e\u0301`
        expect(StoryValidator.Check(story(DANA, combined))).toBe(true)
        expect(refusal(state, story(DANA, combined))).toBe(
            'the story is longer than 1,000 characters'
        )
        expect(refusal(state, story(DANA, '   \n '))).toBe('the story is empty')
        expect(refusal(state, story(DANA, 'a\u0007b'))).toBe(
            'the story holds a character that is not plain text'
        )
        expect(refusal(state, story(ANN, 'Mine.'))).toBe('Dana writes the story, not Ann')
    })

    it('Write and Skip are the winner’s alone, on their own view', () => {
        expectOfferedOnlyTo(
            atStory(),
            [DANA],
            [ActionType.WriteChronicleStory, ActionType.SkipChronicleStory],
            (state) => state.chronicle?.step
        )
    })
})

describe('two games of a chronicle', () => {
    it('game 1: Dana vows Protection, offers Ann, who accepts at Ancient City and Steppe; Beast leads', () => {
        const { final } = run(
            wonTable(gameOne(), USURPER),
            vow(DANA, OathType.Protection),
            offer([ANN]),
            answer(ANN, true),
            story(DANA, 'Dana held the Plains to the end.')
        )
        expect(Object.keys(final.chronicle ?? {}).sort()).toEqual([
            'ending',
            'rebuilt',
            'vowedOath'
        ])
        expect(final.chronicleRecord).toEqual([
            {
                gameNumber: 1,
                sessionName: 'Thursday table',
                date: '2026-10-22',
                startingOath: OathType.Supremacy,
                rule: 'R-3.1',
                winner: { name: 'Dana', color: Color.Red },
                nextOath: OathType.Protection,
                added: { suits: [Suit.Beast, Suit.Nomad, Suit.Discord] },
                citizens: [{ name: 'Ann', color: Color.Blue }],
                story: 'Dana held the Plains to the end.'
            }
        ])
        expect(chronicleCensus(hydrated(final))).toEqual([])
    })

    it('game 2: Ann vows Devotion, builds Sprawling Rampart at the Plains, ties Order and Hearth, picks Order, skips', () => {
        const { final } = run(
            wonTable(gameTwo(), SUCCESSOR),
            vow(ANN, OathType.Devotion),
            build(ANN, { siteId: PLAINS, cardId: LONGBOWS }),
            suit(ANN, Suit.Order),
            skip(ANN)
        )
        expect(Object.keys(final.chronicle ?? {}).sort()).toEqual([
            'ending',
            'rebuilt',
            'vowedOath'
        ])
        expect(final.chronicleRecord?.at(-1)).toEqual({
            gameNumber: 1,
            sessionName: 'Thursday table',
            date: '2026-10-22',
            startingOath: OathType.Protection,
            rule: 'R-3.3.1',
            winner: { name: 'Ann', color: Color.Blue },
            nextOath: OathType.Devotion,
            added: { suits: [Suit.Order, Suit.Hearth, Suit.Beast] },
            built: {
                edificeId: SPRAWLING_RAMPART,
                siteId: PLAINS,
                siteCardId: 'site.plains',
                repaired: false
            }
        })
        expect(chronicleCensus(hydrated(final))).toEqual([])
    })

    it('Dana, the Chancellor, builds Sprawling Rampart at the Mountain in Toll Roads’ place, and picks Hearth', () => {
        const table = gameTwo(
            {
                [DANA]: {
                    advisers: [faceup(KNIGHTS_ERRANT), faceup(LAND_WARDEN), facedown(ALCHEMIST)]
                },
                [ANN]: { status: PlayerStatus.Exile, advisers: [] }
            },
            {
                oathType: OathType.Supremacy,
                denizensBySite: { [MOUNTAIN]: [TOLL_ROADS] },
                warbandsBySite: { [MOUNTAIN]: { [IMPERIAL_WARBANDS]: 1 } }
            }
        )
        const { final } = run(
            wonTable(table, CHANCELLOR_WINS),
            vow(DANA, OathType.ThePeople),
            build(DANA, { siteId: MOUNTAIN, cardId: TOLL_ROADS }),
            suit(DANA, Suit.Hearth),
            skip(DANA)
        )
        // The only site kept, R-8.3.5 moved the Mountain to the top Cradle slot, with its edifice.
        const mountainNow = Object.keys(final.siteCards).find(
            (slotId) => final.siteCards[slotId] === SITES[MOUNTAIN]
        )
        expect(mountainNow).toBe(PLAINS)
        expect(final.denizensBySite[PLAINS]).toEqual([SPRAWLING_RAMPART])
        expect(final.chronicleRecord?.at(-1)).toMatchObject({
            nextOath: OathType.ThePeople,
            added: { suits: [Suit.Hearth, Suit.Beast, Suit.Nomad] },
            built: { edificeId: SPRAWLING_RAMPART, siteId: MOUNTAIN, repaired: false }
        })
    })
})

describe('R-X.3 — a choice that reveals nothing is its chooser’s to undo, until a step draws', () => {
    /** The player's undo target, which must be an action of `type`. */
    function undoTarget(actions: GameAction[], playerId: string, type: ActionType) {
        const target = latestPlayerUndoTarget(actions, playerId)
        expect(target?.type).toBe(type)
        assertExists(target, `${playerId} may undo`)
        return target
    }

    /** The state the target's undo restores. */
    function undone(played: Played, target: GameAction): OathProjectedState {
        const transitions = new RecordedHistory(played.final, played.actions).select((state) =>
            structuredClone(state)
        )
        const transition = transitions.get(target.id)
        assertExists(transition?.before, `${target.type} has a state before it`)
        return transition.before
    }

    it('a Vow: the winner’s undo goes back to the Vow', () => {
        const played = run(wonTable(gameOne(), USURPER), vow(DANA, OathType.Protection))
        expect(played.actions.every((action) => !action.revealsInfo)).toBe(true)
        const before = undone(played, undoTarget(played.actions, DANA, ActionType.ChooseOath))
        expect(before.chronicle?.step).toBe(ChronicleStep.Vow)
        expect(before.chronicle?.vowedOath).toBeUndefined()
        expect(before.activePlayerIds).toEqual([DANA])
    })

    it('an offer, until an Exile answers it; an answer the phase still waits after is the Exile’s own to undo', () => {
        const table = gameOne({ [BEA]: { status: PlayerStatus.Exile } })
        const vowed = run(wonTable(table, USURPER), vow(DANA, OathType.Protection)).final
        const offered = run(vowed, offer([ANN, BEA]))
        const target = undoTarget(offered.actions, DANA, ActionType.OfferChronicleCitizenship)
        expect(undone(offered, target).chronicle?.citizenship?.offers).toBeUndefined()
        const answered = run(offered.final, answer(ANN, true))
        const all = [...offered.actions, ...answered.actions]
        expect(latestPlayerUndoTarget(all, DANA)).toBeUndefined()
        undoTarget(all, ANN, ActionType.AnswerChronicleCitizenship)
        // The last answer is followed by R-8.3.2's shuffle and the steps after it, each a System
        // Action: no one undoes past them.
        const last = run(answered.final, answer(BEA, false))
        expect(last.actions.map((action) => [action.type, action.revealsInfo]).slice(0, 2)).toEqual(
            [
                [ActionType.AnswerChronicleCitizenship, false],
                [ActionType.ChronicleMap, true]
            ]
        )
        expect(latestPlayerUndoTarget([...all, ...last.actions], BEA)).toBeUndefined()
        expect(latestPlayerUndoTarget([...all, ...last.actions], ANN)).toBeUndefined()
    })

    it('a build is followed by the map step, which draws: no undo', () => {
        const building = run(wonTable(gameTwo(), SUCCESSOR), vow(ANN, OathType.Devotion)).final
        const played = run(building, build(ANN, { siteId: PLAINS, cardId: LONGBOWS }))
        expect(played.actions[0].revealsInfo).toBe(false)
        expect(played.actions[1]).toMatchObject({
            type: ActionType.ChronicleMap,
            source: ActionSource.System,
            revealsInfo: true
        })
        expect(latestPlayerUndoTarget(played.actions, ANN)).toBeUndefined()
    })

    it('undoing the winning action from the chronicle puts the game back in play, with no chronicle', () => {
        const table = gameOne({}, { machineState: MachineState.WakePhase }).dehydrate()
        table.turnManager = {
            series: [{ type: 'turn', playerId: DANA, start: 0 }],
            turnOrder: [DANA, RHYS, ANN],
            turnCounts: { [DANA]: 0, [RHYS]: 0, [ANN]: 0 }
        }
        table.activePlayerIds = [DANA]
        const played = run(table, buildAction(ResolveWake, { playerId: DANA, favorSteps: [] }))
        expect(played.final.machineState).toBe(MachineState.Chronicle)
        const before = undone(played, undoTarget(played.actions, DANA, ActionType.ResolveWake))
        expect(before.machineState).toBe(MachineState.WakePhase)
        expect(before.winningPlayerIds).toEqual([])
        expect(Object.keys(before)).not.toContain('chronicle')
    })
})

describe('R-8 — what the rules settle alone runs as System Actions after the action that reaches it', () => {
    it('the flip, the map, the settled suit, the six, the Dispossessed, the relics and the rebuild: each its own System Action', () => {
        const table = gameOne({ [BEA]: { status: PlayerStatus.Citizen } })
        const vowed = run(wonTable(table, USURPER), vow(DANA, OathType.Protection))
        const offered = run(vowed.final, offer([]))
        const record = (action: GameAction) => [action.type, action.source, action.revealsInfo]
        expect(vowed.actions.map(record)).toEqual([
            [ActionType.ChooseOath, ActionSource.User, false],
            [ActionType.ChronicleFlipCitizens, ActionSource.System, false]
        ])
        expect(offered.actions.map(record)).toEqual([
            [ActionType.OfferChronicleCitizenship, ActionSource.User, false],
            [ActionType.ChronicleMap, ActionSource.System, true],
            [ActionType.ChronicleSettleSuit, ActionSource.System, false],
            [ActionType.ChronicleAddCards, ActionSource.System, true],
            [ActionType.ChronicleDispossess, ActionSource.System, true],
            [ActionType.ChronicleRelics, ActionSource.System, true],
            [ActionType.ChronicleRebuild, ActionSource.System, true]
        ])
        expect(offered.final.chronicle?.step).toBe(ChronicleStep.Story)
        expect(offered.final.activePlayerIds).toEqual([DANA])
    })

    it('each records what the table saw in its metadata', () => {
        const table = gameOne({ [BEA]: { status: PlayerStatus.Citizen } })
        table.boxedCitizenColors = [Color.Black]
        const vowed = run(wonTable(table, USURPER), vow(DANA, OathType.Protection))
        const offered = run(vowed.final, offer([]))
        const of = (type: ActionType) => {
            const found = [...vowed.actions, ...offered.actions].find(
                (action) => action.type === type
            )
            return found && 'metadata' in found ? found.metadata : undefined
        }
        expect(of(ActionType.ChronicleFlipCitizens)).toEqual({
            flippedPlayerIds: [BEA],
            flippedBoxColors: [Color.Black]
        })
        expect(of(ActionType.ChronicleMap)).toMatchObject({ winnerPlayerId: DANA })
        expect(of(ActionType.ChronicleSettleSuit)).toEqual({ suit: Suit.Beast })
        expect(of(ActionType.ChronicleAddCards)).toMatchObject({
            suit: Suit.Beast,
            chosen: false,
            added: { suits: [Suit.Beast, Suit.Nomad, Suit.Discord] }
        })
        expect(of(ActionType.ChronicleDispossess)).toEqual({ count: 3 })
        expect(of(ActionType.ChronicleRelics)).toMatchObject({ winnerPlayerId: DANA })
        expect(of(ActionType.ChronicleRebuild)).toEqual({ visions: 5 })
    })

    it('the State keeps only what a rule still reads, and once the entry is written only the ending, the Oath vowed and the rebuild', () => {
        const table = gameOne({ [BEA]: { status: PlayerStatus.Citizen } })
        const offered = run(
            run(wonTable(table, USURPER), vow(DANA, OathType.Protection)).final,
            offer([])
        ).final
        const chronicle = offered.chronicle
        assertExists(chronicle)
        expect(Object.keys(chronicle)).not.toContain('map')
        expect(Object.keys(chronicle)).not.toContain('relics')
        expect(chronicle.citizenship).toEqual({ flippedPlayerIds: [BEA], offers: [] })
        const written = run(offered, skip(DANA)).final
        expect(Object.keys(written.chronicle ?? {}).sort()).toEqual([
            'ending',
            'rebuilt',
            'vowedOath'
        ])
        expect(Object.keys(written.chronicle?.ending ?? {}).sort()).toEqual([
            'rule',
            'waysMet',
            'winnerPlayerId'
        ])
    })
})

describe('R-8.2-H1 — the offered Exiles answer as one simultaneous group', () => {
    const grouped = (playerId: string, accept: boolean, index: number) => ({
        ...answer(playerId, accept),
        index
    })
    const ungrouped = (playerId: string, accept: boolean) =>
        buildAction(AnswerChronicleCitizenship, { id: `answer-${playerId}`, playerId, accept })

    function offeredToThree() {
        return run(vowed3(), offer([ANN, BEA, CY])).final
    }

    function vowed3() {
        const table = gameOne({
            [BEA]: { status: PlayerStatus.Exile },
            [CY]: { status: PlayerStatus.Exile }
        })
        return run(wonTable(table, USURPER), vow(DANA, OathType.Protection)).final
    }

    it('an answer sent against the state before another Exile’s answer is still taken', () => {
        const offered = offeredToThree()
        const game = testGame(offered.players.map((player) => player.playerId))
        const at = offered.actionCount
        const first = engine.run(grouped(ANN, true, at), offered, game).updatedState
        const second = engine.run(grouped(BEA, false, at), first, game)
        expect(second.updatedState.activePlayerIds).toEqual([CY])
        expect(second.updatedState.chronicle?.citizenship?.offers).toEqual([
            { playerId: ANN, accepted: true },
            { playerId: BEA, accepted: false },
            { playerId: CY }
        ])
    })

    it('an answer outside the group is refused', () => {
        const offered = offeredToThree()
        expect(refusal(offered, ungrouped(ANN, true))).toBe(
            'an answer to Citizenship belongs to the offered Exiles’ group'
        )
        expect(answer(ANN, true).simultaneousGroupId).toBe(CHRONICLE_CITIZENSHIP_GROUP)
    })

    it('each Exile can still undo their own answer after another has answered', () => {
        const offered = offeredToThree()
        const game = testGame(offered.players.map((player) => player.playerId))
        const at = offered.actionCount
        const first = engine.run(grouped(ANN, true, at), offered, game)
        const second = engine.run(grouped(BEA, false, at + 1), first.updatedState, game)
        const actions = [...first.processedActions, ...second.processedActions]
        expect(latestPlayerUndoTarget(actions, ANN)?.id).toBe(`answer-${ANN}`)
        expect(latestPlayerUndoTarget(actions, BEA)?.id).toBe(`answer-${BEA}`)
    })
})

describe('R-3 — once the game is won, no one lets another peek, while the chronicle is written', () => {
    it('Rhys, not on the clock, cannot show Ann their facedown adviser; the Vow still waits on Dana', () => {
        const won = wonTable(gameOne(), USURPER)
        const peek = buildAction(LetPeek, {
            playerId: RHYS,
            toPlayerId: ANN,
            subject: { kind: LetPeekSubjectKind.Adviser, cardId: CHARLATAN }
        })
        expect(HydratedLetPeek.reasonCannotShowNow(hydrated(won), RHYS)).toBe('the game is over')
        expect(validFor(won, RHYS)).toEqual([])
        expect(() =>
            engine.runNext(peek, won, testGame(won.players.map((player) => player.playerId)))
        ).toThrow('Action of type letPeek is not valid in state Chronicle')
        expect(won.chronicle?.step).toBe(ChronicleStep.Vow)
        expect(won.activePlayerIds).toEqual([DANA])
    })
})
