import {
    BaseGameInitializer,
    HydratedTurnManager,
    Prng,
    assertExists,
    shuffle,
    type Game,
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { FACTION_COLORS } from '../components/factions.js'
import { FOOTFALL, ScenarioId } from '../components/scenarios.js'
import { systemsInSectors } from '../components/systems.js'
import { TECH_FIELDS } from '../components/techFields.js'
import { techsThroughColumn } from '../components/techs.js'
import { ALL_WORLD_TILE_IDS } from '../components/worlds.js'
import {
    HydratedStellarHorizonsGameState,
    type StellarHorizonsGameState,
    type StellarHorizonsProjectedState
} from '../model/gameState.js'
import { HydratedStellarHorizonsPlayerState } from '../model/playerState.js'
import { drawTechMarkers, fullTechPool } from '../model/pools.js'
import { TurnStep } from '../model/turn.js'
import { DECADE } from '../model/turnCycle.js'
import { MachineState } from './states.js'

export class StellarHorizonsGameInitializer
    extends BaseGameInitializer<StellarHorizonsProjectedState, HydratedStellarHorizonsGameState>
    implements GameInitializer<StellarHorizonsProjectedState, HydratedStellarHorizonsGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedStellarHorizonsGameState {
        const scenario = FOOTFALL
        const prng = new Prng(state.prng)
        const colors = [...FACTION_COLORS]
        shuffle(colors, prng.random)
        const startingTechs = techsThroughColumn(scenario.techColumns).map((techId) => ({
            techId,
            year: scenario.startYear - DECADE
        }))
        const players = game.players.map(
            (player, index) =>
                new HydratedStellarHorizonsPlayerState({
                    playerId: player.id,
                    color: colors[index],
                    cash: scenario.startingCash,
                    techMarkers: { Biology: [], Physics: [], Engineering: [] },
                    techs: structuredClone(startingTechs),
                    step: TurnStep.Build,
                    remoteRepairUsed: false,
                    fieldsDeveloped: []
                })
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        assertExists(state.protectedPrng, 'Drawing starting tech markers requires protectedPrng')

        const stellarState: StellarHorizonsGameState = Object.assign(state, {
            players,
            machineState: MachineState.ChoosingFactions,
            turnManager,
            scenario: ScenarioId.Footfall,
            year: scenario.startYear,
            systems: systemsInSectors(scenario.sectors).map((system) => ({
                systemId: system.id,
                explorationMarker: system.worldSlots > 0 ? scenario.explorationMarkerValue : 0,
                worlds: []
            })),
            ships: [],
            bases: [],
            worldPool: [...ALL_WORLD_TILE_IDS],
            removedWorlds: [],
            techPools: {
                Biology: fullTechPool(),
                Physics: fullTechPool(),
                Engineering: fullTechPool()
            },
            pendingSurveys: [],
            terraformQueue: []
        })
        const hydrated = new HydratedStellarHorizonsGameState(stellarState)
        for (const playerId of hydrated.initiativeOrder()) {
            const player = hydrated.getPlayerState(playerId)
            for (const field of TECH_FIELDS) {
                player.techMarkers[field] = drawTechMarkers(
                    hydrated,
                    field,
                    scenario.startingTechMarkersPerField
                )
            }
        }
        return hydrated
    }
}
