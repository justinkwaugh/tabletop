import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedSimpleTurnManager,
    PrngState
} from '@tabletop/common'
import { SolPlayerState, HydratedSolPlayerState } from './playerState.js'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { MachineState } from '../definition/states.js'
import { HydratedSolGameBoard, SolGameBoard } from '../components/gameBoard.js'
import { Effect } from '../components/effects.js'
import { Deck, HydratedDeck } from '../components/deck.js'

export type SolGameState = Static<typeof SolGameState>
export const SolGameState = Type.Composite([
    Type.Omit(GameState, ['players', 'machineState']),
    Type.Object({
        players: Type.Array(SolPlayerState),
        machineState: Type.Enum(MachineState),
        board: SolGameBoard,
        deck: Deck,
        effects: Type.Record(Type.String(), Effect),
        instability: Type.Number(),
        energyCubes: Type.Number()
    })
])

const SolGameStateValidator = TypeCompiler.Compile(SolGameState)

type HydratedProperties = {
    turnManager: HydratedSimpleTurnManager
    players: HydratedSolPlayerState[]
    board: HydratedSolGameBoard
    deck: HydratedDeck
}

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

    constructor(data: SolGameState) {
        const hydratedProperties: HydratedProperties = {
            turnManager: new HydratedSimpleTurnManager(data.turnManager),
            players: data.players.map((player) => new HydratedSolPlayerState(player)),
            board: new HydratedSolGameBoard(data.board),
            deck: new HydratedDeck(data.deck)
        }
        super(data, SolGameStateValidator, hydratedProperties)
    }
}