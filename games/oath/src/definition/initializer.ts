import { Compile } from 'typebox/compile'
import {
    assert,
    type GameConfig,
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
    buildInitialPublicState,
    buildSetupVault,
    resolveSetupDeal
} from '../util/setup.js'
import { EVERYONE, noKnownDiscardPiles } from '../util/knowledge.js'
import { createOathVault } from '../model/vault.js'
import { teachReliquaryToScepterHolder } from '../util/hiddenInputs.js'
import { bySuit } from '../data/typedData.js'
import { SetupVariant } from '../model/oathEnums.js'
import { CURRENT_OATH_REVISION } from '../util/revision.js'

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

    // R-1.7 — an assigned position zero is the Chancellor, and the rest sit in the assigned order.
    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedOathGameState {
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game)
        assert(
            players.every((player) => player.playerId !== IMPERIAL_WARBANDS),
            `R-10.13 — "${IMPERIAL_WARBANDS}" names the Empire's warbands, so no player may hold it as an id`
        )
        assert(
            players.every((player) => player.playerId !== EVERYONE),
            `"${EVERYONE}" names the whole table as a witness, so no player may hold it as an id`
        )

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
        // R-8.1 — a first game reads the Oath from config; default as in `OathGameConfigOptions`.
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
