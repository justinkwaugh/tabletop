import {
    ActionSource,
    Color,
    GameEngine,
    GameStatus,
    GameStorage,
    PlayerStatus as SeatStatus,
    calculateActionChecksum,
    captureGameContinuation,
    createAction,
    type Game,
    type GameAction,
    type GameContinuation,
    type Player
} from '@tabletop/common'
import {
    ActionType,
    AnswerChronicleCitizenship,
    Banner,
    BuildOrRepairEdifice,
    CURRENT_OATH_REVISION,
    ChooseChronicleSuit,
    ChooseOath,
    ChronicleMark,
    Definition,
    HydratedOathGameState,
    IMPERIAL_WARBANDS,
    MachineState,
    OathType,
    OfferChronicleCitizenship,
    PRINTED_DENIZENS_BY_SUIT,
    PlayerStatus,
    Region,
    ResolveWake,
    RollEndDie,
    SkipChronicleStory,
    Suit,
    WinKind,
    WriteChronicleStory,
    allMapSlots,
    mapSlotsFor,
    type AdviserRow,
    type GameOutcome,
    type ChronicleEntry,
    type OathPlayerState,
    type OathProjectedState,
    type TableRecord
} from '@tabletop/oath'
import {
    buildAction,
    openTurn,
    testBanners,
    testPlayer,
    testState,
    testVaultWithRelics,
    wholeWorld,
    wonTable
} from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

// R-8 — the chronicle at the end of a won game, in a story of three games (invented seats,
// they/them): game 1 won by Dana as Usurper, game 2 by Ann as Successor, game 3 carrying both.

export const DANA = 'dana'
export const RHYS = 'rhys'
export const ANN = 'ann'
export const BEA = 'bea'

export const [CRADLE_1, CRADLE_2] = mapSlotsFor(Region.Cradle)
export const [PROVINCES_1, PROVINCES_2, PROVINCES_3] = mapSlotsFor(Region.Provinces)
export const [HINTERLAND_1, HINTERLAND_2, HINTERLAND_3] = mapSlotsFor(Region.Hinterland)

export const LONGBOWS = 'denizen.order.longbows'
export const HERALD = 'denizen.hearth.herald'
export const FAE_MERCHANT = 'denizen.beast.fae-merchant'
export const ALCHEMIST = 'denizen.arcane.alchemist'
export const GREAT_SPIRE = 'edifice.arcane.great-spire'
export const SPRAWLING_RAMPART = 'edifice.order.sprawling-rampart'

const TABLE: TableRecord = {
    name: 'Thursday table',
    date: '2026-10-22',
    seatNames: { dana: 'Dana', rhys: 'Rhys', ann: 'Ann', bea: 'Bea' }
}

/** Dana's story of game 1, 334 characters. */
export const GAME_ONE_STORY =
    'Rhys held the Cradle and the Scepter, so Ann and I split the frontier between us. The ' +
    'Plains and the Woods stayed red to the end, and when the others caught me at two sites ' +
    'each, the title stayed with me. Ann took my offer at the end and joins the Empire. Next ' +
    'time I sit by the Cradle, and the relics will decide who keeps the peace.'

const FAITH = 'vision.faith'

const faceup = (cardId: string): AdviserRow => ({ cardId, faceUp: true })
const facedown = (cardId: string): AdviserRow => ({ cardId, faceUp: false })

function seat(
    playerId: string,
    color: Color,
    status: PlayerStatus,
    overrides: Partial<OathPlayerState>
): OathPlayerState {
    return testPlayer({ playerId, color, status, siteId: CRADLE_1, ...overrides })
}

/** Every card of the game somewhere, at the chronicle revision, with its table record. */
function atTheEnd(
    players: OathPlayerState[],
    overrides: Partial<OathProjectedState>
): HydratedOathGameState {
    const state = testState(players, {
        oathRevision: CURRENT_OATH_REVISION,
        table: TABLE,
        map: allMapSlots(),
        round: 6,
        ...overrides
    })
    state.vault = testVaultWithRelics({})
    return wholeWorld(state)
}

/**
 * Game 1 as Dana's Wake opens, under Supremacy: Rhys (purple) is the Chancellor; Dana (red), the
 * Usurper, rules the Plains and Deep Woods; Ann (blue) Ancient City and Steppe; Rhys River and The
 * Hidden Place; Wastes has no warbands; one Hinterland site is facedown. Dana's faceup advisers
 * are two Beast and one Order.
 */
function gameOneEnd(vision = false): HydratedOathGameState {
    const state = atTheEnd(
        [
            seat(DANA, Color.Red, PlayerStatus.Exile, {
                advisers: [
                    faceup('denizen.beast.wolves'),
                    faceup('denizen.beast.bracken'),
                    faceup('denizen.order.curfew'),
                    facedown('denizen.nomad.great-herd')
                ],
                relicIds: ['relic.book-of-records', 'relic.cup-of-plenty'],
                ...(vision ? { revealedVisionId: FAITH } : {})
            }),
            seat(RHYS, Color.Purple, PlayerStatus.Chancellor, {
                siteId: PROVINCES_1,
                advisers: [facedown('denizen.discord.chaos-cult')],
                relicIds: ['relic.grand-scepter', 'relic.brass-horse']
            }),
            seat(ANN, Color.Blue, vision ? PlayerStatus.Citizen : PlayerStatus.Exile, {
                siteId: CRADLE_2,
                advisers: [facedown('denizen.hearth.land-warden')],
                relicIds: ['relic.dowsing-sticks']
            })
        ],
        {
            machineState: MachineState.WakePhase,
            chancellorPlayerId: RHYS,
            oathType: OathType.Supremacy,
            // `vision`: Dana holds the Darkest Secret their Vision of Faith asks for, and Rhys the title.
            ...(vision
                ? {
                      oathkeeperPlayerId: RHYS,
                      visionsDrawn: 3,
                      banners: testBanners({ [Banner.DarkestSecret]: DANA })
                  }
                : { oathkeeperPlayerId: DANA, oathkeeperIsUsurper: true }),
            siteCards: {
                [CRADLE_1]: 'site.plains',
                [CRADLE_2]: 'site.ancient-city',
                [PROVINCES_1]: 'site.river',
                [PROVINCES_2]: 'site.steppe',
                [PROVINCES_3]: 'site.deep-woods',
                [HINTERLAND_1]: 'site.the-hidden-place',
                [HINTERLAND_3]: 'site.wastes'
            },
            denizensBySite: {
                [CRADLE_1]: [LONGBOWS, HERALD],
                [CRADLE_2]: [FAE_MERCHANT],
                [PROVINCES_1]: ['denizen.discord.charlatan'],
                [PROVINCES_2]: [ALCHEMIST],
                [PROVINCES_3]: ['denizen.beast.forest-council'],
                [HINTERLAND_1]: ['denizen.order.bear-traps']
            },
            warbandsBySite: {
                [CRADLE_1]: { [DANA]: 2 },
                [PROVINCES_3]: { [DANA]: 1 },
                [CRADLE_2]: { [ANN]: 2 },
                [PROVINCES_2]: { [ANN]: 1 },
                [PROVINCES_1]: { [IMPERIAL_WARBANDS]: 3 },
                [HINTERLAND_1]: { [IMPERIAL_WARBANDS]: 1 }
            }
        }
    )
    openTurn(state, DANA)
    state.activePlayerIds = [DANA]
    return state
}

/** R-3.1 — Dana's Wake: the Usurper wins, and the chronicle's Vow waits on Dana. */
export function gameOneWon(): PlayedTable {
    const table = tableOf(gameOneEnd())
    return played(table, [
        createAction(ResolveWake, {
            gameId: table.state.gameId,
            source: ActionSource.User,
            type: ActionType.ResolveWake,
            playerId: DANA,
            favorSteps: []
        })
    ])
}

export type GameOneStep = 'vow' | 'offer' | 'answer' | 'story' | 'result' | 'refused'

/** Game 1's chronicle as far as `step`: Dana vows Protection, offers Ann, Ann accepts, Dana writes. */
export function gameOneAt(step: GameOneStep): PlayedTable {
    const steps: GameAction[] = []
    const won = gameOneWon()
    if (step === 'vow') return won
    steps.push(buildAction(ChooseOath, { playerId: DANA, oathType: OathType.Protection }))
    if (step === 'offer') return played(won, steps)
    steps.push(buildAction(OfferChronicleCitizenship, { playerId: DANA, exilePlayerIds: [ANN] }))
    if (step === 'answer') return played(won, steps)
    steps.push(
        buildAction(AnswerChronicleCitizenship, { playerId: ANN, accept: step !== 'refused' })
    )
    if (step === 'story' || step === 'refused') return played(won, steps)
    steps.push(buildAction(WriteChronicleStory, { playerId: DANA, text: GAME_ONE_STORY }))
    return played(won, steps)
}

/**
 * Game 2 at its end, under Protection: Ann (blue), a Citizen, won as Successor; Dana (purple) is
 * the Chancellor; Rhys (red) an Exile. Purple holds Plains, Ancient City and Steppe, so Ann rules
 * them (R-6.6.3); red River and Lush Coast. Ann's faceup advisers are one Order and one Hearth.
 * `ruin`: the Great Spire stands ruined at Steppe. `record`: the entries game 2 carried in.
 */
function gameTwoEnd(ruin: boolean, record?: ChronicleEntry[]): HydratedOathGameState {
    const state = atTheEnd(
        [
            seat(DANA, Color.Purple, PlayerStatus.Chancellor, {
                advisers: [facedown('denizen.discord.chaos-cult')]
            }),
            seat(RHYS, Color.Red, PlayerStatus.Exile, {
                siteId: PROVINCES_1,
                advisers: [facedown('denizen.nomad.great-herd')]
            }),
            seat(ANN, Color.Blue, PlayerStatus.Citizen, {
                siteId: CRADLE_2,
                advisers: [
                    faceup('denizen.order.knights-errant'),
                    faceup('denizen.hearth.land-warden'),
                    facedown('denizen.arcane.bewitch')
                ]
            })
        ],
        {
            machineState: MachineState.EndOfRound,
            chancellorPlayerId: DANA,
            oathType: OathType.Protection,
            siteCards: {
                [CRADLE_1]: 'site.plains',
                [CRADLE_2]: 'site.ancient-city',
                [PROVINCES_1]: 'site.river',
                [PROVINCES_2]: 'site.steppe',
                [PROVINCES_3]: 'site.deep-woods',
                [HINTERLAND_1]: 'site.mountain',
                [HINTERLAND_2]: 'site.lush-coast'
            },
            denizensBySite: {
                [CRADLE_1]: [LONGBOWS, HERALD],
                [CRADLE_2]: [FAE_MERCHANT],
                [PROVINCES_1]: ['denizen.discord.charlatan'],
                [PROVINCES_2]: ruin ? [GREAT_SPIRE, ALCHEMIST] : [ALCHEMIST],
                [PROVINCES_3]: ['denizen.beast.forest-council'],
                [HINTERLAND_2]: ['denizen.order.toll-roads']
            },
            ...(ruin ? { ruinedEdificeIds: [GREAT_SPIRE] } : {}),
            warbandsBySite: {
                [CRADLE_1]: { [IMPERIAL_WARBANDS]: 2 },
                [CRADLE_2]: { [IMPERIAL_WARBANDS]: 1 },
                [PROVINCES_2]: { [IMPERIAL_WARBANDS]: 2 },
                [PROVINCES_1]: { [RHYS]: 2 },
                [HINTERLAND_2]: { [RHYS]: 1 }
            }
        }
    )
    if (record) state.chronicleRecord = record
    return state
}

const SUCCESSOR = { winnerPlayerId: ANN, kind: WinKind.Successor, rule: 'R-3.3.1' } as const
const VISIONARY = { winnerPlayerId: DANA, kind: WinKind.Visionary, rule: 'R-3.2' } as const

/**
 * A table that starts from the win: `wonTable` writes the chronicle up to its first stop, and the
 * action that recorded the win is written into the log with it, as the History finds it.
 */
function wonWith(state: HydratedOathGameState, outcome: GameOutcome, won: GameAction): PlayedTable {
    const action = { ...won, id: 'won', index: 0, createdAt: new Date() }
    // The log's one action, so its history is whole from the start: count and checksum agree.
    return {
        state: {
            ...wonTable(state, outcome),
            actionCount: 1,
            actionChecksum: calculateActionChecksum(0, [action])
        },
        actions: [action]
    }
}

/** R-3.3.1 — the Chancellor's end die ends round 6, and Ann, a Citizen, takes the empire. */
function gameTwoWon(state: HydratedOathGameState): PlayedTable {
    return wonWith(
        state,
        SUCCESSOR,
        createAction(RollEndDie, {
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.RollEndDie,
            playerId: DANA,
            metadata: { roll: 6, round: 6, threshold: 5, wonBy: SUCCESSOR.rule }
        })
    )
}

/**
 * R-3.2 — Dana wins at their Wake with the Vision of Faith alone: the Vow is the Vision's (R-8.1),
 * Ann's Citizen board flips back with no one to offer (R-8.2), and Dana's advisers lead with one
 * suit, so everything up to the story runs inside the action that won.
 */
export function gameOneVisionWon(): PlayedTable {
    const state = gameOneEnd(true)
    return wonWith(
        state,
        VISIONARY,
        createAction(ResolveWake, {
            gameId: state.gameId,
            source: ActionSource.User,
            type: ActionType.ResolveWake,
            playerId: DANA,
            favorSteps: [],
            metadata: { wonBy: VISIONARY.rule }
        })
    )
}

export type GameTwoStep = 'build' | 'ruin' | 'suit' | 'heal' | 'story'

/**
 * Game 2's chronicle as far as `step`: Ann vows Devotion, then builds, picks a suit or a stack.
 * `record`: the entries game 2 carried in, game 1's unless given.
 */
export function gameTwoAt(
    step: GameTwoStep,
    record: ChronicleEntry[] = [GAME_ONE_ENTRY]
): PlayedTable {
    const state = gameTwoEnd(step === 'ruin', record)
    if (step === 'heal') shortOfOrder(state)
    const vowed = played(gameTwoWon(state), [
        buildAction(ChooseOath, { playerId: ANN, oathType: OathType.Devotion })
    ])
    if (step === 'build' || step === 'ruin') return vowed
    const suit = played(vowed, [buildAction(BuildOrRepairEdifice, { playerId: ANN })])
    if (step === 'suit') return suit
    const chosen = played(suit, [
        buildAction(ChooseChronicleSuit, { playerId: ANN, suit: Suit.Order })
    ])
    // 'heal' waits on the tied stacks; 'story' on Ann's story.
    return chosen
}

/**
 * R-8.4.a — the Archive keeps two Order cards, so Ann's Order cannot add its three; the
 * Dispossessed's Order and Beast stacks tie at five.
 */
function shortOfOrder(state: HydratedOathGameState): void {
    const vault = state.requireVault()
    vault.worldDeck.push(...vault.dispossessed)
    const inGame = new Set([
        ...vault.worldDeck,
        ...Object.values(vault.discardPiles).flat(),
        ...Object.values(state.denizensBySite).flat(),
        ...state.players.flatMap((player) => player.advisers.map((row) => row.cardId))
    ])
    // The Archive is every printed denizen out of the game: all but two Order cards join the deck.
    const archive = (suit: Suit) =>
        PRINTED_DENIZENS_BY_SUIT[suit].filter((cardId) => !inGame.has(cardId))
    vault.worldDeck.push(...archive(Suit.Order).slice(2), ...archive(Suit.Beast))
    const fromDeck = (suit: Suit) => {
        const taken = vault.worldDeck
            .filter((cardId) => PRINTED_DENIZENS_BY_SUIT[suit].includes(cardId))
            .slice(0, 5)
        vault.worldDeck = vault.worldDeck.filter((cardId) => !taken.includes(cardId))
        return taken
    }
    vault.dispossessed = [...fromDeck(Suit.Order), ...fromDeck(Suit.Beast)]
    state.dispossessedCount = vault.dispossessed.length
}

/** Game 2's entry and game 1's, as game 3 carries them in. */
export const GAME_ONE_ENTRY: ChronicleEntry = {
    gameNumber: 1,
    sessionName: 'Thursday table',
    date: '2026-10-15',
    startingOath: OathType.Supremacy,
    mark: ChronicleMark.Oathkeeper,
    kind: WinKind.Usurper,
    rule: 'R-3.1',
    winner: { name: 'Dana', color: Color.Red },
    nextOath: OathType.Protection,
    added: { suits: [Suit.Beast, Suit.Nomad, Suit.Discord] },
    citizens: [{ name: 'Ann', color: Color.Blue }],
    story: GAME_ONE_STORY
}

export const GAME_TWO_ENTRY: ChronicleEntry = {
    gameNumber: 2,
    sessionName: 'Thursday table',
    date: '2026-10-22',
    startingOath: OathType.Protection,
    mark: ChronicleMark.Successor,
    kind: WinKind.Successor,
    rule: 'R-3.3.1',
    winner: { name: 'Ann', color: Color.Blue },
    nextOath: OathType.Devotion,
    added: { suits: [Suit.Order, Suit.Hearth, Suit.Beast] },
    built: {
        edificeId: SPRAWLING_RAMPART,
        siteId: CRADLE_1,
        siteCardId: 'site.plains',
        repaired: false
    }
}

/**
 * Game 3 at its start, carrying games 1 and 2: Ann (purple) the Chancellor, Dana (blue) a
 * Citizen, Bea (yellow) an Exile. Game 1's Dana keeps the red they played then.
 */
export function gameThreeOpen(): PlayedTable {
    const state = testState(
        [
            seat(ANN, Color.Purple, PlayerStatus.Chancellor, {}),
            seat(DANA, Color.Blue, PlayerStatus.Citizen, {}),
            seat(BEA, Color.Yellow, PlayerStatus.Exile, {})
        ],
        {
            oathRevision: CURRENT_OATH_REVISION,
            table: { ...TABLE, date: '2026-10-29' },
            map: allMapSlots(),
            siteCards: { [CRADLE_1]: 'site.plains' },
            oathType: OathType.Devotion,
            chancellorPlayerId: ANN,
            chronicleRecord: [GAME_ONE_ENTRY, GAME_TWO_ENTRY]
        }
    )
    openTurn(state, ANN)
    state.activePlayerIds = [ANN]
    return tableOf(state)
}

/** Ann's story skipped, so game 2 ends: no story row. */
export function gameTwoSkipped(): PlayedTable {
    return played(gameTwoAt('story'), [buildAction(SkipChronicleStory, { playerId: ANN })])
}

/** Ann, Dana and Bea seated in that order, Dana dealt blue and Bea yellow (the seed is the given). */
const GAME_THREE_SEED = '0000000000000000000000000000003f'

function hosted(playerId: string): Player {
    const name = playerId.charAt(0).toUpperCase() + playerId.slice(1)
    return { id: playerId, isHuman: true, userId: `u-${playerId}`, name, status: SeatStatus.Joined }
}

/**
 * Game 3 as Continue opens it, through the real definition: game 2 (carrying game 1) won by Ann
 * and finished; Rhys does not continue and Bea joins. Ann, game 2's winner, is the Chancellor;
 * Dana is dealt the blue board, still on its Citizen side, and Bea the yellow one (R-1.7-H1,
 * R-1.9-H1). The table waits on Ann's setup choice.
 */
export function gameThreeContinued(): PlayedTable {
    const finished = played(gameTwoAt('story', [GAME_ONE_ENTRY]), [
        buildAction(SkipChronicleStory, { playerId: ANN })
    ]).state
    const source: Game = {
        id: finished.gameId,
        typeId: Definition.info.id,
        status: GameStatus.Finished,
        isPublic: false,
        deleted: false,
        ownerId: 'u-dana',
        name: TABLE.name,
        players: [DANA, RHYS, ANN].map(hosted),
        config: {},
        hotseat: false,
        createdAt: new Date('2026-10-22T19:00:00Z'),
        winningPlayerIds: [ANN],
        storage: GameStorage.Local
    }
    const continuation = captureGameContinuation(source, finished, Definition as never)
    const next: Game = {
        ...source,
        id: 'game-3',
        status: GameStatus.WaitingToStart,
        players: [ANN, DANA, BEA].map(hosted),
        createdAt: new Date('2026-10-29T19:00:00Z'),
        winningPlayerIds: [],
        continuedFromGameId: source.id
    }
    const { initialState } = new GameEngine(Definition.runtime).startGame(next, {
        masterSeed: GAME_THREE_SEED,
        continuation: continuation as GameContinuation<OathProjectedState>
    })
    return { state: initialState, actions: [] }
}
