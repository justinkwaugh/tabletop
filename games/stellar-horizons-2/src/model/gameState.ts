import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState,
    Visibility,
    assertExists,
    type RandomState
} from '@tabletop/common'
import { ScenarioId, scenarioDefinition, type ScenarioDefinition } from '../components/scenarios.js'
import { MachineState } from '../definition/states.js'
import {
    Base,
    PendingSurvey,
    ShipState,
    SurveyWorldChoice,
    SystemState,
    TechPools,
    TerraformChoice
} from './pieces.js'
import { HydratedStellarHorizonsPlayerState, StellarHorizonsPlayerState } from './playerState.js'

export type StellarHorizonsGameState = Type.Static<typeof StellarHorizonsGameState>
export const StellarHorizonsGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(StellarHorizonsPlayerState),
    machineState: Type.Enum(MachineState),
    scenario: Type.Enum(ScenarioId),
    year: Type.Number(),
    systems: Type.Array(SystemState),
    ships: Type.Array(ShipState),
    bases: Type.Array(Base),
    worldPool: Type.Array(Type.String()),
    removedWorlds: Type.Array(Type.String()),
    techPools: TechPools,
    pendingSurveys: Type.Array(PendingSurvey),
    surveyChoice: Type.Optional(SurveyWorldChoice),
    terraformQueue: Type.Array(Type.String()),
    terraformChoice: Type.Optional(TerraformChoice)
})

export const StellarHorizonsGameStateValidator = Compile(StellarHorizonsGameState)
export const StellarHorizonsProjectedState =
    Visibility.createProjectionSchema(StellarHorizonsGameState)
export type StellarHorizonsProjectedState = Type.Static<typeof StellarHorizonsProjectedState>
export const StellarHorizonsProjectedStateValidator = Compile(StellarHorizonsProjectedState)

export class HydratedStellarHorizonsGameState
    extends HydratableGameState<
        typeof StellarHorizonsProjectedState,
        HydratedStellarHorizonsPlayerState
    >
    implements StellarHorizonsProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedStellarHorizonsPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare scenario: ScenarioId
    declare year: number
    declare systems: SystemState[]
    declare ships: ShipState[]
    declare bases: Base[]
    declare worldPool: string[]
    declare removedWorlds: string[]
    declare techPools: TechPools
    declare pendingSurveys: PendingSurvey[]
    declare surveyChoice?: SurveyWorldChoice
    declare terraformQueue: string[]
    declare terraformChoice?: TerraformChoice

    constructor(data: StellarHorizonsProjectedState) {
        super(data, StellarHorizonsProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedStellarHorizonsPlayerState(player))
    }

    scenarioDefinition(): ScenarioDefinition {
        return scenarioDefinition(this.scenario)
    }

    initiativeOrder(): string[] {
        return this.turnManager.turnOrder
    }

    systemState(systemId: string): SystemState {
        const system = this.systems.find((candidate) => candidate.systemId === systemId)
        assertExists(system, `System ${systemId} is not in play`)
        return system
    }

    isSystemInPlay(systemId: string): boolean {
        return this.systems.some((system) => system.systemId === systemId)
    }

    ship(shipId: string): ShipState {
        const ship = this.findShip(shipId)
        assertExists(ship, `Ship ${shipId} is not in play`)
        return ship
    }

    findShip(shipId: string): ShipState | undefined {
        return this.ships.find((candidate) => candidate.shipId === shipId)
    }

    playerShip(playerId: string, shipId: string): ShipState | undefined {
        const ship = this.findShip(shipId)
        return ship?.playerId === playerId ? ship : undefined
    }

    shipsOf(playerId: string): ShipState[] {
        return this.ships.filter((ship) => ship.playerId === playerId)
    }

    base(playerId: string, systemId: string): Base | undefined {
        return this.bases.find((base) => base.playerId === playerId && base.systemId === systemId)
    }

    basesOf(playerId: string): Base[] {
        return this.bases.filter((base) => base.playerId === playerId)
    }

    otherPlayers(playerId: string): HydratedStellarHorizonsPlayerState[] {
        return this.players.filter((player) => player.playerId !== playerId)
    }
}
