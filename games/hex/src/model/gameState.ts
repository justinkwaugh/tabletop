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
import { HexPlayerState, HydratedHexPlayerState } from './playerState.js'
import { MachineState } from '../definition/states.js'
import { HydratedHexBoard, HexBoard, type Stone, type StoneColor } from './board.js'

export type HexGameState = Type.Static<typeof HexGameState>
export const HexGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(HexPlayerState),
            machineState: Type.Enum(MachineState),
            board: HexBoard,
            // Whether Blue took Red's first stone, which closes the swap.
            swapped: Type.Boolean()
        })
    ])
)

export const HexGameStateValidator = Compile(HexGameState)

export class HydratedHexGameState
    extends HydratableGameState<typeof HexGameState, HydratedHexPlayerState>
    implements HexGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedHexPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedHexBoard
    declare swapped: boolean

    constructor(data: HexGameState) {
        super(data, HexGameStateValidator)
        this.players = data.players.map((player) => new HydratedHexPlayerState(player))
        this.board = new HydratedHexBoard(data.board)
    }

    colorOf(playerId: string): StoneColor {
        const player = this.players.find((candidate) => candidate.playerId === playerId)
        assertExists(player, `No player ${playerId}`)
        return player.color === Color.Red ? Color.Red : Color.Blue
    }

    // The swap is Blue's answer to Red's first stone, before anything else is played.
    swapIsOpen(): boolean {
        return this.board.stones.length === 1 && !this.swapped
    }

    swapColors() {
        this.swapped = true
        for (const player of this.players) {
            player.color = player.color === Color.Red ? Color.Blue : Color.Red
        }
    }

    placeStone(playerId: string, cell: string): Stone {
        return this.board.place(cell, this.colorOf(playerId))
    }
}
