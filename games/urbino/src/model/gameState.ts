import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import { UrbinoPlayerState, HydratedUrbinoPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { BoardSquare } from '../components/building.js'

export type UrbinoGameState = Type.Static<typeof UrbinoGameState>
export const UrbinoGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(UrbinoPlayerState),
            machineState: Type.Enum(MachineState),
            board: Type.Array(BoardSquare),        // 81 squares (9×9 grid), index = row*9 + col
            architects: Type.Array(Type.Number()), // [pos0, pos1], -1 if not yet placed
            architectsPlaced: Type.Number(),       // 0, 1, or 2
            consecutivePasses: Type.Number(),
            hasRepositionedThisTurn: Type.Boolean(),
            monumentsVariant: Type.Boolean(),
        })
    ])
)

const UrbinoGameStateValidator = Compile(UrbinoGameState)

export class HydratedUrbinoGameState
    extends HydratableGameState<typeof UrbinoGameState, HydratedUrbinoPlayerState>
    implements UrbinoGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedUrbinoPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: BoardSquare[]
    declare architects: number[]
    declare architectsPlaced: number
    declare consecutivePasses: number
    declare hasRepositionedThisTurn: boolean
    declare monumentsVariant: boolean

    constructor(data: UrbinoGameState) {
        super(data, UrbinoGameStateValidator)
        this.players = data.players.map((player) => new HydratedUrbinoPlayerState(player))
    }
}
