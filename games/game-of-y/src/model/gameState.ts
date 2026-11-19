import {
    assertExists,
    Color,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { YPlayerState, HydratedYPlayerState } from './playerState.js'
import { MachineState } from '../definition/states.js'
import { HydratedYBoard, YBoard, type Stone, type StoneColor } from './board.js'

export type YGameState = Type.Static<typeof YGameState>
export const YGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(YPlayerState),
            machineState: Type.Enum(MachineState),
            board: YBoard,
            // Whether White took Black's first stone, which closes the swap.
            swapped: Type.Boolean()
        })
    ])
)

export const YGameStateValidator = Compile(YGameState)

export class HydratedYGameState
    extends HydratableGameState<typeof YGameState, HydratedYPlayerState>
    implements YGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedYPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedYBoard
    declare swapped: boolean

    constructor(data: YGameState) {
        super(data, YGameStateValidator)
        this.players = data.players.map((player) => new HydratedYPlayerState(player))
        this.board = new HydratedYBoard(data.board)
    }

    colorOf(playerId: string): StoneColor {
        const player = this.players.find((candidate) => candidate.playerId === playerId)
        assertExists(player, `No player ${playerId}`)
        return player.color === Color.Black ? Color.Black : Color.White
    }

    // The swap is White's answer to Black's first stone, before anything else is played.
    swapIsOpen(): boolean {
        return this.board.stones.length === 1 && !this.swapped
    }

    swapColors() {
        this.swapped = true
        for (const player of this.players) {
            player.color = player.color === Color.Black ? Color.White : Color.Black
        }
    }

    placeStone(playerId: string, point: string): Stone {
        return this.board.place(point, this.colorOf(playerId))
    }
}
