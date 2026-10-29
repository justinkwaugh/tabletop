import { Compile } from 'typebox/compile'
import {
    assert,
    assertExists,
    type GameConfig,
    type GameContinuation,
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState,
    Game,
    Player,
    HydratedTurnManager,
    shuffle,
    type StartingPositionAssignment
} from '@tabletop/common'
import {
    HydratedOathGameState,
    type OathGameState,
    type OathProjectedState
} from '../model/gameState.js'
import { OathPlayerState } from '../model/playerState.js'

import { MachineState } from './states.js'
import { OathGameConfig } from './config.js'
import { OathExileColors, OathImperialColor } from './colors.js'
import { Banner, OathType, PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import {
    applySetupDeal,
    buildContinuedVault,
    buildInitialPublicState,
    buildSetupVault,
    resolveSetupDeal
} from '../util/setup.js'
import { EVERYONE, noKnownDiscardPiles } from '../util/knowledge.js'
import { carriedOathVault, createOathVault } from '../model/vault.js'
import { teachReliquaryToScepterHolder } from '../util/hiddenInputs.js'
import { bySuit } from '../data/typedData.js'
import { SetupVariant } from '../model/oathEnums.js'
import { BoardSide } from '../model/chronicle.js'
import { isVision } from '../data/cardRegistry.js'
import { CURRENT_OATH_REVISION } from '../util/revision.js'
import { tableRecordOf } from '../util/chronicle.js'
import {
    carriedMapOf,
    chooseChancellor,
    matchContinuedPlayers,
    readFinishedGame,
    settleBoards
} from '../util/continuation.js'

const OathGameConfigValidator = Compile(OathGameConfig)

export function readOathGameConfig(config: GameConfig | undefined): OathGameConfig {
    if (config === undefined) return {}
    assert(OathGameConfigValidator.Check(config), 'Game configuration is not a valid Oath setup')
    return config
}

/** R-1.1 to R-1.22; R-1.23's choices are the `Setup` state's actions. */
export class OathGameInitializer
    extends BaseGameInitializer<OathProjectedState, HydratedOathGameState>
    implements GameInitializer<OathProjectedState, HydratedOathGameState>
{
    readonly supportsStartingPositions = true
    /** R-8.7, R-1 — a game won at the chronicle revision opens the next game of its chronicle. */
    readonly supportsContinuation = true

    // R-1.7 — an assigned position zero is the Chancellor, and the rest sit in the assigned order.
    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment,
        continuation?: GameContinuation<OathProjectedState>
    ): HydratedOathGameState {
        if (continuation !== undefined) {
            return this.initializeContinuedGame(game, state, assignment, continuation)
        }
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game)
        assertPlayerIds(players)

        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)

        const orderedPlayers: OathPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            if (player) {
                orderedPlayers.push(player)
            }
        }

        // R-1.7 — the turn manager already seats the Chancellor first and the rest randomly.
        const exileColors = structuredClone(OathExileColors)
        shuffle(exileColors, prng.random)

        const chancellor = orderedPlayers[0]
        chancellor.status = PlayerStatus.Chancellor
        chancellor.color = OathImperialColor
        orderedPlayers.slice(1).forEach((player, index) => {
            const color = exileColors[index]
            if (!color) {
                throw Error(
                    `R-1.9 seats at most ${exileColors.length} Exiles alongside the ` +
                        `Chancellor; this game has ${orderedPlayers.length - 1}`
                )
            }
            player.color = color
        })

        const config = readOathGameConfig(game.config)
        // R-8.1, R-1.13 — a first game is the Oath of Supremacy, or the Oath a stored config names.
        const oathType = config.oathType ?? OathType.Supremacy
        const setupVariant = config.setupVariant ?? SetupVariant.Randomized
        const seeded = seedRequiredFields(state, {
            players: orderedPlayers,
            machineState: MachineState.Setup,
            turnManager,
            // R-1.1 — empty until the map is dealt, then replaced.
            vault: createOathVault({}, prng.random)
        })

        // Drawn from the hydrated state's own cursor, so the saved state counts the site deal.
        const hydrated = new HydratedOathGameState(seeded)
        const initial = buildInitialPublicState(hydrated, {
            oathType,
            turnOrder: turnManager.turnOrder,
            random: hydrated.getPublicPrng().random,
            setupVariant
        })
        initial.vault = buildSetupVault(initial, initial.getProtectedPrng().random)
        applySetupDeal(
            initial,
            resolveSetupDeal(initial.requireVault(), initial.turnManager.turnOrder)
        )
        teachReliquaryToScepterHolder(initial)
        initial.oathRevision = CURRENT_OATH_REVISION
        // R-8 — the chronicle's record names the table as it started.
        initial.table = tableRecordOf(game)
        return initial
    }

    /**
     * R-8.7 to R-1 — the next game of a chronicle: the world the finished game saved, each fact in
     * the secrecy class it had there; the seats settled from its final state (R-1.7-H1, R-1.9-H1);
     * then setup as the Law gives it, on the carried map. Its public draws, in order: the
     * Chancellor (only when there is a choice), the seating, the free boards.
     */
    private initializeContinuedGame(
        game: Game,
        state: UninitializedGameState,
        assignment: StartingPositionAssignment | undefined,
        continuation: GameContinuation<OathProjectedState>
    ): HydratedOathGameState {
        // R-1.7-H1 decides the Chancellor, so an assigned seat would have to be ignored.
        assert(
            assignment === undefined,
            'A continued game seats its Chancellor by the last game (R-1.7-H1), so its seats cannot be assigned'
        )
        const previous = readFinishedGame(continuation.previousState)
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game)
        assertPlayerIds(players)
        const people = matchContinuedPlayers(continuation.previousPlayers, game.players)

        // R-1.7-H1, then R-1.7's "Seat the other players randomly".
        const chancellorSeat = chooseChancellor(
            previous,
            people,
            players.map((player) => player.playerId),
            prng.random
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random)
        const turnOrder = [
            chancellorSeat.playerId,
            ...turnManager.turnOrder.filter((id) => id !== chancellorSeat.playerId)
        ]
        turnManager.turnOrder.splice(0, turnOrder.length, ...turnOrder)

        // R-1.9-H1
        const { boards, boxedCitizenColors } = settleBoards(
            previous,
            people,
            turnOrder.slice(1),
            prng.random
        )
        const orderedPlayers = turnOrder.map((playerId) => {
            const player = players.find((p) => p.playerId === playerId)
            assertExists(player, `${playerId} is seated`)
            return player
        })
        const [chancellor, ...others] = orderedPlayers
        chancellor.status = PlayerStatus.Chancellor
        chancellor.color = OathImperialColor
        others.forEach((player, index) => {
            const board = boards[index]
            player.color = board.color
            // R-1.15 — a board on its Citizen side makes its taker a Citizen.
            player.status =
                board.side === BoardSide.Citizen ? PlayerStatus.Citizen : PlayerStatus.Exile
        })

        const seeded = seedRequiredFields(state, {
            players: orderedPlayers,
            machineState: MachineState.Setup,
            turnManager,
            vault: carriedOathVault({})
        })
        const hydrated = new HydratedOathGameState(seeded)
        const vowedOath = previous.chronicle?.vowedOath
        assertExists(vowedOath, 'R-8.1 — the finished game vowed the next Oath')
        const initial = buildInitialPublicState(hydrated, {
            // R-8.1 to R-1.13 — the Oath the winner vowed, whatever the form says.
            oathType: vowedOath,
            turnOrder,
            random: hydrated.getPublicPrng().random,
            // Every card of the game may be in play, as in a first game built from all of them.
            setupVariant: SetupVariant.Randomized,
            carried: carriedMapOf(previous)
        })
        const vault = buildContinuedVault(
            initial,
            previous.requireVault(),
            initial.getProtectedPrng().random
        )
        initial.vault = vault
        // R-8.5 — the Dispossessed lies facedown: its size is public, its cards are not.
        initial.dispossessedCount = vault.dispossessed.length
        // R-8.8 — every Vision is in the rebuilt deck.
        initial.worldDeckVisions = vault.worldDeck.filter(isVision).length
        applySetupDeal(initial, resolveSetupDeal(vault, turnOrder))
        teachReliquaryToScepterHolder(initial)
        initial.oathRevision = CURRENT_OATH_REVISION
        initial.table = tableRecordOf(game)
        // R-8 — the record, copied unchanged; this game's entry joins it at its own end.
        assertExists(previous.chronicleRecord, 'A finished chronicle has written its entry')
        initial.chronicleRecord = structuredClone(previous.chronicleRecord)
        if (boxedCitizenColors.length > 0) initial.boxedCitizenColors = boxedCitizenColors
        initial.openingSeats = { chancellor: chancellorSeat, boards }
        return initial
    }

    /** The empty shape the validator needs; `buildInitialPublicState` fills it in. */
    private initializePlayers(game: Game): OathPlayerState[] {
        return game.players.map((player: Player, index: number) => {
            return {
                playerId: player.id,
                color: OathExileColors[index % OathExileColors.length],
                status: PlayerStatus.Exile,
                supply: 0,
                supplySpentThisTurn: 0,
                supplyAtTurnStart: 0,
                favor: 0,
                secrets: 0,
                secretsFacedown: 0,
                warbandsOnBoard: {},
                warbandsInPersonalBank: {},
                siteId: undefined,
                relicIds: [],
                advisers: [],
                adviserIds: [],
                adviserLimit: 3,
                handIds: [],
                handCount: 0,
                handVisions: 0,
                revealedVisionId: undefined,
                peekedRelicSlotIds: [],
                peekedRelics: {},
                peekedSiteSlotIds: [],
                peekedSites: {},
                knownWorldDeckTop: [],
                knownDiscardPiles: noKnownDiscardPiles(),
                knownRelicDeckBottom: [],
                knownWorldDeckBottom: [],
                knownHands: {},
                handSeen: [],
                homelandUsedThisTurn: [],
                restPowersUsedThisTurn: []
            }
        })
    }
}

function assertPlayerIds(players: readonly OathPlayerState[]): void {
    assert(
        players.every((player) => player.playerId !== IMPERIAL_WARBANDS),
        `R-10.13 — "${IMPERIAL_WARBANDS}" names the Empire's warbands, so no player may hold it as an id`
    )
    assert(
        players.every((player) => player.playerId !== EVERYONE),
        `"${EVERYONE}" names the whole table as a witness, so no player may hold it as an id`
    )
}

/** Every Oath field must exist before the validator will hydrate the state. */
function seedRequiredFields(
    base: UninitializedGameState,
    seats: Pick<OathGameState, 'players' | 'machineState' | 'turnManager' | 'vault'>
): OathGameState {
    return {
        ...base,
        ...seats,
        round: 1,
        map: { cradle: [], provinces: [], hinterland: [] },
        siteCards: {},
        denizensBySite: {},
        cardTokens: {},
        relicsBySite: {},
        warbandsBySite: {},
        warbandsOnCards: {},
        reliquary: [],
        favorBank: bySuit(() => 0),
        favorSupply: 0,
        banners: {
            [Banner.PeoplesFavor]: { value: 0, mobSide: false },
            [Banner.DarkestSecret]: { value: 0 }
        },
        worldDeckExhausted: false,
        visionsDrawn: 0,
        worldDeckDrawn: 0,
        worldDeckVisions: 0,
        discardPileCounts: { cradle: 0, provinces: 0, hinterland: 0 },
        discardTopBackType: {},
        seenDiscardPiles: noKnownDiscardPiles(),
        seenWorldDeckBottom: [],
        seenRelicDeckBottom: [],
        seenRelics: {},
        dispossessedCount: 0,
        boxIds: [],
        siteCapacityOverrides: {},
        oathType: OathType.Supremacy
    }
}
