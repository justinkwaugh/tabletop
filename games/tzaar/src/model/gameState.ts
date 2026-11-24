import {
    assertExists,
    type AxialCoordinates,
    Color,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState,
    sameCoordinates
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { TzaarPlayerState, HydratedTzaarPlayerState } from './playerState.js'
import { MachineState } from '../definition/states.js'
import {
    HydratedTzaarBoard,
    PIECE_KINDS,
    PIECES_OF_KIND,
    type Piece,
    PieceKind,
    type PieceColor,
    TzaarBoard
} from './board.js'
import { SPACES } from './geometry.js'

export const TOTAL_PIECES = SPACES.length

export type TzaarGameState = Type.Static<typeof TzaarGameState>
export const TzaarGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(TzaarPlayerState),
            machineState: Type.Enum(MachineState),
            board: TzaarBoard
        })
    ])
)

export const TzaarGameStateValidator = Compile(TzaarGameState)

export type StackMove = {
    from: AxialCoordinates
    to: AxialCoordinates
}

// What history tells of a stack: how tall it was and the type on top.
export type StackSummary = Type.Static<typeof StackSummary>
export const StackSummary = Type.Object({
    height: Type.Integer({ minimum: 1 }),
    kind: Type.Enum(PieceKind)
})

export type CaptureResult = {
    moved: StackSummary
    captured: StackSummary
}

export type StackResult = {
    moved: StackSummary
    landedOnHeight: number
}

export class HydratedTzaarGameState
    extends HydratableGameState<typeof TzaarGameState, HydratedTzaarPlayerState>
    implements TzaarGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedTzaarPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedTzaarBoard

    constructor(data: TzaarGameState) {
        super(data, TzaarGameStateValidator)
        this.players = data.players.map((player) => new HydratedTzaarPlayerState(player))
        this.board = new HydratedTzaarBoard(data.board)
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

    // Rule I: in the tournament version each player places their own 30 pieces.
    piecesInHand(playerId: string, kind: PieceKind): number {
        const placed = this.board.piecesOf(playerId).filter((piece) => piece.kind === kind).length
        return PIECES_OF_KIND[kind] - placed
    }

    kindsInHand(playerId: string): PieceKind[] {
        return PIECE_KINDS.filter((kind) => this.piecesInHand(playerId, kind) > 0)
    }

    // Rule I: White places first and the players take turns, so White's pieces go down at the
    // even counts and Black's at the odd ones, whoever puts them down.
    colorToPlace(): PieceColor {
        return this.board.pieceCount() % 2 === 0 ? Color.White : Color.Black
    }

    ownerOfNextPiece(): string {
        return this.playerWith(this.colorToPlace())
    }

    pieceToPlace(kind: PieceKind): Piece {
        return { id: this.board.pieceCount(), playerId: this.ownerOfNextPiece(), kind }
    }

    // I set, you choose: taking the other colour takes its pieces too.
    takeColor(playerId: string, color: PieceColor) {
        if (this.getPlayerState(playerId).color === color) return
        for (const player of this.players) {
            player.color = player.color === Color.White ? Color.Black : Color.White
        }
        this.board.trade(playerId, this.opponentOf(playerId))
    }

    // Rule D: White's opening turn is a single capture, made before any piece has left the board.
    isOpeningTurn(): boolean {
        return this.board.pieceCount() === TOTAL_PIECES
    }

    captures(playerId: string): StackMove[] {
        return this.board
            .stacksOf(playerId)
            .flatMap((from) => this.board.capturesFrom(from).map((to) => ({ from, to })))
    }

    canCapture(playerId: string): boolean {
        return this.captures(playerId).length > 0
    }

    canPlayerCapture(playerId: string, from: AxialCoordinates, to: AxialCoordinates): boolean {
        return (
            this.board.ownerAt(from) === playerId &&
            this.board.capturesFrom(from).some((target) => sameCoordinates(target, to))
        )
    }

    // Agreed reading: a stack may not cover its owner's last top piece of a type, which would
    // leave them without a Tzaar, Tzarra or Tott (rule B1).
    stackings(playerId: string): StackMove[] {
        return this.board
            .stacksOf(playerId)
            .flatMap((from) => this.board.stackingTargetsFrom(from).map((to) => ({ from, to })))
            .filter((move) => !this.coversLastOfKind(playerId, move))
    }

    canPlayerStack(playerId: string, from: AxialCoordinates, to: AxialCoordinates): boolean {
        return (
            this.board.ownerAt(from) === playerId &&
            this.board.stackingTargetsFrom(from).some((target) => sameCoordinates(target, to)) &&
            !this.coversLastOfKind(playerId, { from, to })
        )
    }

    private coversLastOfKind(playerId: string, { from, to }: StackMove): boolean {
        const covered = this.board.topKindAt(to)
        const moving = this.board.topKindAt(from)
        return (
            covered !== moving &&
            covered !== undefined &&
            this.board.topsOf(playerId, covered) === 1
        )
    }

    hasSecondMove(playerId: string): boolean {
        return this.canCapture(playerId) || this.stackings(playerId).length > 0
    }

    capture(from: AxialCoordinates, to: AxialCoordinates): CaptureResult {
        const moved = this.summaryAt(from)
        const captured = this.summaryAt(to)
        this.board.captureStack(from, to)
        return { moved, captured }
    }

    stack(from: AxialCoordinates, to: AxialCoordinates): StackResult {
        const moved = this.summaryAt(from)
        const landedOnHeight = this.board.heightAt(to)
        this.board.moveStack(from, to)
        return { moved, landedOnHeight }
    }

    private summaryAt(coords: AxialCoordinates): StackSummary {
        const kind = this.board.topKindAt(coords)
        assertExists(kind, `No stack at ${coords.q},${coords.r}`)
        return { height: this.board.heightAt(coords), kind }
    }

    // Rule B1: a player without a Tzaar, Tzarra or Tott on top of a stack has lost.
    missingKind(playerId: string): PieceKind | undefined {
        return PIECE_KINDS.find((kind) => this.board.topsOf(playerId, kind) === 0)
    }

    declareWinner(playerId: string) {
        this.winningPlayerIds = [playerId]
    }
}
