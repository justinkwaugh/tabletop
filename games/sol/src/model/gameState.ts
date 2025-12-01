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
import { Effect } from '../components/effects.js'
import { Deck, HydratedDeck } from '../components/deck.js'
import { Sundiver } from 'src/components/sundiver.js'
import { Ring } from '../utils/solGraph.js'
import { Station, StationType } from '../components/stations.js'
import { Activation } from './activation.js'

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
            activation: Type.Optional(Activation)
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
    declare deck: Deck
    declare effects: Record<string, Effect>
    declare instability: number
    declare energyCubes: number
    declare activation?: Activation

    constructor(data: SolGameState) {
        super(data, SolGameStateValidator)

        this.turnManager = new HydratedSimpleTurnManager(data.turnManager)
        this.players = data.players.map((player) => new HydratedSolPlayerState(player))
        this.board = new HydratedSolGameBoard(data.board)
        this.deck = new HydratedDeck(data.deck)
    }

    advanceMothership(playerId: string) {
        const currentLocation = this.board.motherships[playerId]
        if (currentLocation === undefined) {
            return
        }
        let newLocation = currentLocation - 1
        if (newLocation < 0) {
            const numSpots = this.board.numMothershipLocations
            newLocation = numSpots
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
}
