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
import { EconomicTile } from '../components/economicTiles.js'
import { EscalationMarker } from '../components/escalation.js'
import { TradeGood } from '../components/tradeGoods.js'
import { ScenarioId, scenarioDefinition, type ScenarioDefinition } from '../components/scenarios.js'
import { MachineState } from '../definition/states.js'
import {
    AttackRecord,
    Base,
    Blockade,
    BlockadeStep,
    CardPile,
    CardsResume,
    Combat,
    ConversionChance,
    DirectivePile,
    DirectiveResumePoint,
    OptionalRules,
    RemovedDirective,
    FoughtCombat,
    ShipState,
    SurveyWorldChoice,
    SystemState,
    TechPools,
    TerraformChoice,
    ActiveEvent,
    DemandDraw,
    DemandResume,
    EscalationDiscard,
    EventPlacement,
    GoodsReward,
    Pact,
    PledgeableShip,
    SettlementReward,
    SystemAttack,
    TerraformRecord,
    baseKey
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
    ships: Type.Record(Type.String(), ShipState),
    bases: Type.Record(Type.String(), Base),
    worldPool: Type.Array(Type.String()),
    removedWorlds: Type.Array(Type.String()),
    techPools: TechPools,
    anomalyPool: Type.Array(Type.String()),
    surveyChoice: Type.Optional(SurveyWorldChoice),
    terraformQueue: Type.Array(Type.String()),
    terraformChoice: Type.Optional(TerraformChoice),
    terraformedWorlds: Type.Array(TerraformRecord),
    settlementRewards: Type.Array(SettlementReward),
    goodsRewards: Type.Array(GoodsReward),
    goodsPool: Type.Array(Type.Enum(TradeGood)),
    demandPool: Type.Array(Type.Enum(TradeGood)),
    demandDraws: Type.Array(DemandDraw),
    resumeAfterDemand: Type.Optional(Type.Enum(DemandResume)),
    remainingTraders: Type.Array(Type.String()),
    eventPool: Type.Array(Type.String()),
    events: Type.Array(ActiveEvent),
    eventPlacement: Type.Optional(EventPlacement),
    homesteaders: Type.Array(Type.String()),
    pacts: Type.Array(Pact),
    pledgeableShips: Type.Array(PledgeableShip),
    setAsideWorlds: Type.Array(Type.String()),
    economicTilePool: Type.Array(Type.Enum(EconomicTile)),
    economicTile: Type.Optional(Type.Enum(EconomicTile)),
    cardPiles: Type.Array(CardPile),
    resumeAfterCards: Type.Optional(Type.Enum(CardsResume)),
    // Players with Prolific Breeders still to choose a base, and the conversion rolls still to
    // take, after growth (rulebook 4.6).
    growthChoosers: Type.Array(Type.String()),
    conversions: Type.Array(ConversionChance),
    // Rulebook 3.0: no faction may attack another until a roll ends the truce.
    truce: Type.Boolean(),
    escalationPool: Type.Array(Type.Enum(EscalationMarker)),
    escalationDiscard: Type.Optional(EscalationDiscard),
    // Blockades come before base production and growth, in reverse initiative order (4.4, 4.6).
    blockadeStep: Type.Optional(Type.Enum(BlockadeStep)),
    remainingBlockaders: Type.Array(Type.String()),
    blockades: Type.Array(Blockade),
    // The combat phase on the Main Line in initiative order: who has still to attack, the
    // systems each has attacked in, the combat being fought, and the one just fought for the
    // Players to see (rulebook 1.3).
    remainingAttackers: Type.Array(Type.String()),
    systemAttacks: Type.Array(SystemAttack),
    combat: Type.Optional(Combat),
    foughtCombat: Type.Optional(FoughtCombat),
    attacks: Type.Array(AttackRecord),
    optionalRules: OptionalRules,
    // Rulebook 5.1: the directives left to draw, those removed from the game, and where play
    // resumes once drawn directives are chosen.
    directivePile: DirectivePile,
    removedDirectives: Type.Array(RemovedDirective),
    directiveResume: Type.Optional(DirectiveResumePoint)
})

export const StellarHorizonsGameStateValidator = Compile(StellarHorizonsGameState)
export const StellarHorizonsProjectedState =
    Visibility.createProjectionSchema(StellarHorizonsGameState)
export type StellarHorizonsProjectedState = Type.Static<typeof StellarHorizonsProjectedState>
export const StellarHorizonsProjectedStateValidator = Compile(StellarHorizonsProjectedState)

function sortedValues<T>(record: Record<string, T>): T[] {
    return Object.keys(record)
        .toSorted()
        .map((key) => record[key])
}

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
    declare ships: Record<string, ShipState>
    declare bases: Record<string, Base>
    declare worldPool: string[]
    declare removedWorlds: string[]
    declare techPools: TechPools
    declare anomalyPool: string[]
    declare surveyChoice?: SurveyWorldChoice
    declare terraformQueue: string[]
    declare terraformChoice?: TerraformChoice
    declare terraformedWorlds: TerraformRecord[]
    declare settlementRewards: SettlementReward[]
    declare goodsRewards: GoodsReward[]
    declare goodsPool: TradeGood[]
    declare demandPool: TradeGood[]
    declare demandDraws: DemandDraw[]
    declare resumeAfterDemand?: DemandResume
    declare remainingTraders: string[]
    declare eventPool: string[]
    declare events: ActiveEvent[]
    declare eventPlacement?: EventPlacement
    declare homesteaders: string[]
    declare pacts: Pact[]
    declare pledgeableShips: PledgeableShip[]
    declare setAsideWorlds: string[]
    declare economicTilePool: EconomicTile[]
    declare economicTile?: EconomicTile
    declare cardPiles: CardPile[]
    declare resumeAfterCards?: CardsResume
    declare growthChoosers: string[]
    declare conversions: ConversionChance[]
    declare truce: boolean
    declare escalationPool: EscalationMarker[]
    declare escalationDiscard?: EscalationDiscard
    declare blockadeStep?: BlockadeStep
    declare remainingBlockaders: string[]
    declare blockades: Blockade[]
    declare remainingAttackers: string[]
    declare systemAttacks: SystemAttack[]
    declare combat?: Combat
    declare foughtCombat?: FoughtCombat
    declare attacks: AttackRecord[]
    declare optionalRules: OptionalRules
    declare directivePile: DirectivePile
    declare removedDirectives: RemovedDirective[]
    declare directiveResume?: DirectiveResumePoint

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

    allShips(): ShipState[] {
        return sortedValues(this.ships)
    }

    ship(shipId: string): ShipState {
        const ship = this.findShip(shipId)
        assertExists(ship, `Ship ${shipId} is not in play`)
        return ship
    }

    findShip(shipId: string): ShipState | undefined {
        return Object.hasOwn(this.ships, shipId) ? this.ships[shipId] : undefined
    }

    playerShip(playerId: string, shipId: string): ShipState | undefined {
        const ship = this.findShip(shipId)
        return ship?.playerId === playerId ? ship : undefined
    }

    shipsOf(playerId: string): ShipState[] {
        return this.allShips().filter((ship) => ship.playerId === playerId)
    }

    allBases(): Base[] {
        return sortedValues(this.bases)
    }

    base(playerId: string, systemId: string): Base | undefined {
        const key = baseKey(playerId, systemId)
        return Object.hasOwn(this.bases, key) ? this.bases[key] : undefined
    }

    basesOf(playerId: string): Base[] {
        return this.allBases().filter((base) => base.playerId === playerId)
    }

    otherPlayers(playerId: string): HydratedStellarHorizonsPlayerState[] {
        return this.players.filter((player) => player.playerId !== playerId)
    }
}
