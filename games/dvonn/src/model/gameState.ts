import {
    type AxialCoordinates,
    Color,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { DvonnPlayerState, HydratedDvonnPlayerState } from './playerState.js'
import { MachineState } from '../definition/states.js'
import { DvonnVersion } from '../definition/config.js'
import { DvonnBoard, HydratedDvonnBoard, type Piece, type RemovedStack } from './board.js'

export const DVONN_PIECES = 3
export const PIECES_PER_PLAYER = 23

export type DvonnGameState = Type.Static<typeof DvonnGameState>
export const DvonnGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(DvonnPlayerState),
            machineState: Type.Enum(MachineState),
            version: Type.Enum(DvonnVersion),
            board: DvonnBoard
        })
    ])
)

export const DvonnGameStateValidator = Compile(DvonnGameState)

export type StackMove = {
    moved: Piece[]
    landedOn: Piece[]
    removed: RemovedStack[]
}

export class HydratedDvonnGameState
    extends HydratableGameState<typeof DvonnGameState, HydratedDvonnPlayerState>
    implements DvonnGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedDvonnPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare version: DvonnVersion
    declare board: HydratedDvonnBoard

    constructor(data: DvonnGameState) {
        super(data, DvonnGameStateValidator)
        this.players = data.players.map((player) => new HydratedDvonnPlayerState(player))
        this.board = new HydratedDvonnBoard(data.board)
    }

    opponentOf(playerId: string): string {
        const opponent = this.players.find((player) => player.playerId !== playerId)
        if (opponent === undefined) {
            throw Error(`No opponent for ${playerId}`)
        }
        return opponent.playerId
    }

    whitePlayerId(): string {
        const white = this.players.find((player) => player.color === Color.White)
        if (white === undefined) {
            throw Error('No player has White')
        }
        return white.playerId
    }

    // Rule D1: the three DVONN pieces go down first, then each player's own pieces.
    placesDvonnNext(): boolean {
        return this.board.dvonnCount() < DVONN_PIECES
    }

    pieceToPlace(playerId: string, placedAt: AxialCoordinates): Piece {
        return this.placesDvonnNext() ? { dvonn: true, placedAt } : { playerId, placedAt }
    }

    movableStacks(playerId: string): AxialCoordinates[] {
        return this.board
            .stacksOf(playerId)
            .filter((from) => this.board.destinationsFrom(from).length > 0)
    }

    canMove(playerId: string): boolean {
        return this.movableStacks(playerId).length > 0
    }

    canPlayerMove(playerId: string, from: AxialCoordinates, to: AxialCoordinates): boolean {
        return this.board.ownerAt(from) === playerId && this.board.canMove(from, to)
    }

    moveStack(from: AxialCoordinates, to: AxialCoordinates): StackMove {
        const moved = structuredClone([...this.board.stackAt(from)])
        const landedOn = structuredClone([...this.board.stackAt(to)])
        this.board.moveStack(from, to)
        return { moved, landedOn, removed: this.board.removeIsolated() }
    }

    score(playerId: string): number {
        return this.board.controlledPieces(playerId)
    }

    // Rules G2 and G3: the bigger combined stack wins; equal stacks tie, which the platform
    // records with both players as winners.
    declareResult() {
        const most = Math.max(...this.players.map((player) => this.score(player.playerId)))
        this.winningPlayerIds = this.players
            .filter((player) => this.score(player.playerId) === most)
            .map((player) => player.playerId)
    }
}
