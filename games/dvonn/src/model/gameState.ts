import {
    assertExists,
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
import {
    DvonnBoard,
    HydratedDvonnBoard,
    type Piece,
    type PieceColor,
    type RemovedStack
} from './board.js'

export const DVONN_PIECES = 3
export const PIECES_PER_PLAYER = 23

export type DvonnGameState = Type.Static<typeof DvonnGameState>
export const DvonnGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(DvonnPlayerState),
            machineState: Type.Enum(MachineState),
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
    declare board: HydratedDvonnBoard

    constructor(data: DvonnGameState) {
        super(data, DvonnGameStateValidator)
        this.players = data.players.map((player) => new HydratedDvonnPlayerState(player))
        this.board = new HydratedDvonnBoard(data.board)
    }

    opponentOf(playerId: string): string {
        const opponent = this.players.find((player) => player.playerId !== playerId)
        assertExists(opponent, `No opponent for ${playerId}`)
        return opponent.playerId
    }

    playerWith(color: Color): string {
        const player = this.players.find((candidate) => candidate.color === color)
        assertExists(player, `No player has ${color}`)
        return player.playerId
    }

    // The player who places the first piece, who sets the board in I set, you choose.
    firstPlayerId(): string {
        const first = this.turnManager.turnOrder[0]
        assertExists(first, 'The game has a first player')
        return first
    }

    // Each player starts with PIECES_PER_PLAYER; those not yet placed are in hand.
    piecesInHand(playerId: string): number {
        return this.machineState === MachineState.PlacingPieces
            ? PIECES_PER_PLAYER - this.board.piecesOf(playerId)
            : 0
    }

    // Rule D1: the three DVONN pieces go down first, then each player's own pieces.
    placesDvonnNext(): boolean {
        return this.board.dvonnCount() < DVONN_PIECES
    }

    // Rule D1: White places first and the players take turns, so White's pieces go down at the
    // even counts and Black's at the odd ones, whoever puts them down.
    colorToPlace(): PieceColor {
        return this.board.stacks.length % 2 === 0 ? Color.White : Color.Black
    }

    pieceToPlace(placedAt: AxialCoordinates): Piece {
        return this.placesDvonnNext()
            ? { dvonn: true, placedAt }
            : { playerId: this.playerWith(this.colorToPlace()), placedAt }
    }

    // I set, you choose: taking the other colour takes its pieces too.
    takeColor(playerId: string, color: PieceColor) {
        if (this.getPlayerState(playerId).color === color) return
        for (const player of this.players) {
            player.color = player.color === Color.White ? Color.Black : Color.White
        }
        this.board.trade(playerId, this.opponentOf(playerId))
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
