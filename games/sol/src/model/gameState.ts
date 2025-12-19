import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedSimpleTurnManager,
    PrngState
} from '@tabletop/common'
import { SolPlayerState, HydratedSolPlayerState } from './playerState.js'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { HydratedSolGameBoard, SolGameBoard } from '../components/gameBoard.js'
import { Effect, EffectType } from '../components/effects.js'
import { Deck, HydratedDeck } from '../components/deck.js'
import { Sundiver } from '../components/sundiver.js'
import { Station } from '../components/stations.js'
import { Activation } from './activation.js'
import { Suit } from '../components/cards.js'
import { Ring } from '../utils/solGraph.js'

export type SolGameState = Static<typeof SolGameState>
export const SolGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(SolPlayerState),
            machineState: Type.Enum(MachineState),
            board: SolGameBoard,
            deck: Deck,
            effects: Type.Record(Type.String(), Effect),
            instability: Type.Number(),
            energyCubes: Type.Number(),
            activation: Type.Optional(Activation),
            cardsToDraw: Type.Number({ default: 0 }),
            solarFlares: Type.Number({ default: 0 }),
            solarFlaresRemaining: Type.Number({ default: 0 }),
            solarFlareActivations: Type.Array(Activation),
            hurled: Type.Boolean({ default: false }),
            moved: Type.Optional(Type.Boolean({ default: false })),
            paidPlayerIds: Type.Array(Type.String()),
            activeEffect: Type.Optional(Type.Enum(EffectType)),
            effectTracking: Type.Optional(
                Type.Object({
                    outerRingLaunches: Type.Number(), // For Ceremony effect
                    convertedStation: Type.Optional(Station), // For Motivate effect
                    clustersRemaining: Type.Number(), // For Cluster effect
                    squeezed: Type.Boolean(), // For Squeeze effect
                    flownSundiverId: Type.Optional(Type.String()), // For Hyperdrive effect
                    flownStationId: Type.Optional(Type.String()), // For Juggernaut effect
                    movementUsed: Type.Number(), // For Hyperdrive effect
                    suitChosen: Type.Optional(Type.Enum(Suit)), // For Pillar effect
                    preEffectState: Type.Optional(Type.Enum(MachineState)), // For Hatch / Accelerate effect
                    catapultedIds: Type.Array(Type.String()), // For Catapult effect
                    fuelRemaining: Type.Number(), // For Fuel effect
                    passageSundiverId: Type.Optional(Type.String()), // For Passage effect
                    passageGates: Type.Array(Type.Number()) // For Passage effect
                })
            )
        })
    ])
)

const SolGameStateValidator = Compile(SolGameState)

export class HydratedSolGameState
    extends HydratableGameState<typeof SolGameState, HydratedSolPlayerState>
    implements SolGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedSolPlayerState[]
    declare turnManager: HydratedSimpleTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedSolGameBoard
    declare deck: HydratedDeck
    declare effects: Record<string, Effect>
    declare instability: number
    declare energyCubes: number
    declare activation?: Activation
    declare cardsToDraw: number
    declare solarFlares: number
    declare solarFlaresRemaining: number
    declare solarFlareActivations: Activation[]
    declare hurled: boolean
    declare moved?: boolean
    declare paidPlayerIds: string[]
    declare activeEffect?: EffectType
    declare effectTracking?: {
        outerRingLaunches: number
        convertedStation?: Station
        clustersRemaining: number
        squeezed: boolean
        flownSundiverId?: string
        flownStationId?: string
        movementUsed: number
        suitChosen?: Suit
        preEffectState?: MachineState
        catapultedIds: string[]
        fuelRemaining: number
        passageSundiverId?: string
        passageGates: number[]
    }

    constructor(data: SolGameState) {
        super(data, SolGameStateValidator)

        this.turnManager = new HydratedSimpleTurnManager(data.turnManager)
        this.players = data.players.map((player) => new HydratedSolPlayerState(player))
        this.board = new HydratedSolGameBoard(data.board)
        this.deck = new HydratedDeck(data.deck)
    }

    getEffectTracking() {
        if (!this.effectTracking) {
            this.effectTracking = {
                outerRingLaunches: 0,
                clustersRemaining: 0,
                squeezed: false,
                movementUsed: 0,
                catapultedIds: [],
                fuelRemaining: 0,
                passageGates: []
            }
        }
        return this.effectTracking
    }

    advanceMothership(playerId: string) {
        const currentLocation = this.board.motherships[playerId]
        if (currentLocation === undefined) {
            return
        }
        let newLocation = currentLocation - 1
        if (newLocation < 0) {
            const numSpots = this.board.numMothershipLocations
            newLocation = numSpots - 1
        }
        this.board.motherships[playerId] = newLocation
    }

    *getAllSundivers(): Iterable<Sundiver> {
        for (const playerState of this.players) {
            for (const diver of playerState.holdSundivers) {
                yield diver
            }
            for (const diver of playerState.reserveSundivers) {
                yield diver
            }
        }
        for (const cell of this.board) {
            for (const diver of cell.sundivers) {
                yield diver
            }
        }
    }

    getActivatingStation(): Station {
        if (!this.activation || !this.activation.currentStationId) {
            throw Error('No activating station')
        }

        const station = this.board.findStation(this.activation.currentStationId)
        if (!station) {
            throw Error('Cannot find activating station')
        }

        return station
    }

    hasActivatedStation(stationId: string): boolean {
        return this.activation?.activatedIds.includes(stationId) ?? false
    }

    playerHasCardForEffect(playerId: string, effect: EffectType): boolean {
        const player = this.getPlayerState(playerId)
        return player.card !== undefined && this.effects[player.card.suit].type === effect
    }

    calculatePlayerMovement(playerId: string): number {
        return Iterator.from(Object.values(Ring)).reduce(
            (acc, ring) => (this.board.hasStationInRing(playerId, ring as Ring) ? acc + 1 : acc),
            3
        )
    }
}
