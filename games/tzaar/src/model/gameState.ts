import {
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
import { TzaarVersion } from '../definition/config.js'
import {
    HydratedTzaarBoard,
    PIECE_KINDS,
    PIECES_OF_KIND,
    type Piece,
    type PieceKind,
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
            version: Type.Enum(TzaarVersion),
            board: TzaarBoard
        })
    ])
)

export const TzaarGameStateValidator = Compile(TzaarGameState)

export type StackMove = {
    from: AxialCoordinates
    to: AxialCoordinates
}

export type CaptureResult = {
    moved: Piece[]
    captured: Piece[]
}

export type StackResult = {
    moved: Piece[]
    landedOn: Piece[]
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
    declare version: TzaarVersion
    declare board: HydratedTzaarBoard

    constructor(data: TzaarGameState) {
        super(data, TzaarGameStateValidator)
        this.players = data.players.map((player) => new HydratedTzaarPlayerState(player))
        this.board = new HydratedTzaarBoard(data.board)
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

    // Rule I: in the tournament version each player places their own 30 pieces.
    piecesInHand(playerId: string, kind: PieceKind): number {
        const placed = this.board.piecesOf(playerId).filter((piece) => piece.kind === kind).length
        return PIECES_OF_KIND[kind] - placed
    }

    kindsInHand(playerId: string): PieceKind[] {
        return PIECE_KINDS.filter((kind) => this.piecesInHand(playerId, kind) > 0)
    }

    pieceToPlace(playerId: string, kind: PieceKind): Piece {
        return { id: this.board.pieceCount(), playerId, kind }
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
        const covered = this.board.stackAt(to).at(-1)?.kind
        const moving = this.board.stackAt(from).at(-1)?.kind
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
        const captured = this.board.removeStack(to)
        const moved = structuredClone([...this.board.stackAt(from)])
        this.board.moveStack(from, to)
        return { moved, captured }
    }

    stack(from: AxialCoordinates, to: AxialCoordinates): StackResult {
        const moved = structuredClone([...this.board.stackAt(from)])
        const landedOn = structuredClone([...this.board.stackAt(to)])
        this.board.moveStack(from, to)
        return { moved, landedOn }
    }

    // Rule B1: a player without a Tzaar, Tzarra or Tott on top of a stack has lost.
    missingKind(playerId: string): PieceKind | undefined {
        return PIECE_KINDS.find((kind) => this.board.topsOf(playerId, kind) === 0)
    }

    capturedBy(playerId: string): number {
        return TOTAL_PIECES / 2 - this.board.piecesOf(this.opponentOf(playerId)).length
    }

    declareWinner(playerId: string) {
        this.winningPlayerIds = [playerId]
    }
}
