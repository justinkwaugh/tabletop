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
import { ANOMALIES } from '../components/anomalies.js'
import { ECONOMIC_TILES } from '../components/economicTiles.js'
import { fullEscalationPool } from '../components/escalation.js'
import { EVENTS } from '../components/events.js'
import { FACTION_COLORS } from '../components/factions.js'
import { STAR_MAP } from '../components/starMap.js'
import { SOL_SYSTEM_ID, systemsInSectors } from '../components/systems.js'
import { TECH_FIELDS } from '../components/techFields.js'
import { techsThroughColumn } from '../components/techs.js'
import { initialDemandPool, initialGoodsPool } from '../components/tradeGoods.js'
import { ALL_WORLD_TILE_IDS, WorldClass, worldTile } from '../components/worlds.js'
import {
    HydratedStellarHorizonsGameState,
    type StellarHorizonsProjectedState
} from '../model/gameState.js'
import { HydratedStellarHorizonsPlayerState, emptyTechMarkers } from '../model/playerState.js'
import { drawTechMarkers, fullTechPool } from '../model/pools.js'
import { fillWorldSlots } from '../model/surveys.js'
import { DECADE } from '../model/turnCycle.js'
import { configuredScenario } from './config.js'
import { MachineState } from './states.js'
import { initialCardPiles } from '../model/cards.js'

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
        const scenario = configuredScenario(game.config)
        if (game.players.length < scenario.minPlayers) {
            throw new Error(`${scenario.name} needs at least ${scenario.minPlayers} players`)
        }
        if (game.players.length > scenario.maxPlayers) {
            throw new Error(`${scenario.name} takes at most ${scenario.maxPlayers} players`)
        }
        const surveyedSystemIds = scenario.surveyedAroundSol
            ? STAR_MAP.adjacentSystemIds(SOL_SYSTEM_ID)
            : []
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
                    techMarkers: emptyTechMarkers(),
                    spentMarkers: emptyTechMarkers(),
                    earnedMarkers: [],
                    techs: structuredClone(startingTechs),
                    remoteRepairUsed: false,
                    fieldsDeveloped: [],
                    pendingSurveys: [],
                    anomalyAttempts: [],
                    anomalies: [],
                    influence: 0,
                    operations: [],
                    shipTerraforms: [],
                    eventAttempts: [],
                    breakthroughs: [],
                    explorationMarkers: 0,
                    earthGoods: [],
                    drawnGoods: [],
                    discardedGoods: [],
                    hand: [],
                    cards: [],
                    cardDraws: [],
                    settlementsBought: 0,
                    escalation: [],
                    attackBanned: false
                })
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        assertExists(state.protectedPrng, 'Drawing starting tech markers requires protectedPrng')

        const stellarState: StellarHorizonsProjectedState = Object.assign(state, {
            players,
            machineState: MachineState.ChoosingFactions,
            turnManager,
            scenario: scenario.id,
            year: scenario.startYear,
            systems: systemsInSectors(scenario.sectors).map((system) => ({
                systemId: system.id,
                explorationMarker:
                    system.worldSlots > 0 && !surveyedSystemIds.includes(system.id)
                        ? scenario.explorationMarkerValue
                        : 0,
                worlds: []
            })),
            ships: {},
            bases: {},
            worldPool: [...ALL_WORLD_TILE_IDS],
            removedWorlds: [],
            techPools: {
                Biology: fullTechPool(),
                Physics: fullTechPool(),
                Engineering: fullTechPool()
            },
            anomalyPool:
                scenario.anomalies === undefined ? [] : ANOMALIES.map((anomaly) => anomaly.id),
            terraformQueue: [],
            terraformedWorlds: [],
            setAsideWorlds: [],
            economicTilePool: scenario.campaign ? [...ECONOMIC_TILES] : [],
            eventPool: scenario.campaign ? EVENTS.map((definition) => definition.id) : [],
            events: [],
            homesteaders: [],
            pacts: [],
            pledgeableShips: [],
            settlementRewards: [],
            goodsRewards: [],
            goodsPool: scenario.campaign ? initialGoodsPool() : [],
            demandPool: scenario.campaign ? initialDemandPool() : [],
            demandDraws: [],
            remainingTraders: [],
            cardPiles: scenario.campaign ? initialCardPiles() : [],
            growthChoosers: [],
            conversions: [],
            truce: scenario.campaign !== undefined,
            escalationPool: scenario.campaign ? fullEscalationPool() : [],
            remainingBlockaders: [],
            blockades: [],
            remainingAttackers: [],
            systemAttacks: [],
            attacks: []
        })
        const hydrated = new HydratedStellarHorizonsGameState(stellarState)
        for (const worldClass of Object.values(WorldClass)) {
            this.setAsideWorlds(
                hydrated,
                worldClass,
                scenario.campaign?.setAsideWorlds[worldClass] ?? 0
            )
        }

        for (const systemId of surveyedSystemIds) {
            if (hydrated.isSystemInPlay(systemId)) {
                fillWorldSlots(hydrated, systemId)
            }
        }
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

    // Rulebook 3.0 setup step 5: these worlds join the pool later, one of each class per
    // terraforming phase.
    private setAsideWorlds(
        state: HydratedStellarHorizonsGameState,
        worldClass: WorldClass,
        count: number
    ) {
        const random = state.getProtectedPrng()
        for (let index = 0; index < count; index++) {
            const candidates = state.worldPool.filter(
                (tileId) => worldTile(tileId).worldClass === worldClass
            )
            if (candidates.length === 0) {
                return
            }
            const tileId = candidates[random.randInt(candidates.length)]
            state.worldPool.splice(state.worldPool.indexOf(tileId), 1)
            state.setAsideWorlds.push(tileId)
        }
    }
}
