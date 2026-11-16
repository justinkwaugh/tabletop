import {
    assertExists,
    AxialCoordinates,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState,
    sameCoordinates
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { HydratedPunctPlayerState, PunctPlayerState } from './playerState.js'
import { MachineState } from '../definition/states.js'
import { HydratedPunctBoard, PunctBoard, type PlacedPiece, type Placement } from './board.js'
import { PIECE_KINDS, PieceKind, sameOrientation, SET_COUNTS, SET_SIZE } from './pieces.js'
import { Variant } from '../definition/config.js'

export enum EndReason {
    Connection = 'Connection',
    CentreCount = 'CentreCount',
    LastPiece = 'LastPiece',
    NoMoves = 'NoMoves'
}

export type PunctGameState = Type.Static<typeof PunctGameState>
export const PunctGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(PunctPlayerState),
            machineState: Type.Enum(MachineState),
            variant: Type.Enum(Variant),
            board: PunctBoard,
            endReason: Type.Optional(Type.Enum(EndReason))
        })
    ])
)

export const PunctGameStateValidator = Compile(PunctGameState)

export class HydratedPunctGameState
    extends HydratableGameState<typeof PunctGameState, HydratedPunctPlayerState>
    implements PunctGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedPunctPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare variant: Variant
    declare board: HydratedPunctBoard
    declare endReason?: EndReason

    constructor(data: PunctGameState) {
        super(data, PunctGameStateValidator)
        this.players = data.players.map((player) => new HydratedPunctPlayerState(player))
        this.board = new HydratedPunctBoard(data.board)
    }

    opponentOf(playerId: string): string {
        const opponent = this.players.find((player) => player.playerId !== playerId)
        assertExists(opponent, `No opponent for ${playerId}`)
        return opponent.playerId
    }

    firstPlayerId(): string {
        return this.turnManager.turnOrder[0]
    }

    // Rule B1: a player's reserve is their set less the pieces they have brought into play, which
    // never leave the board.
    reserveCount(playerId: string, kind: PieceKind): number {
        return (
            SET_COUNTS[kind] -
            this.board.pieces.filter((piece) => piece.playerId === playerId && piece.kind === kind)
                .length
        )
    }

    reserveSize(playerId: string): number {
        return SET_SIZE - this.board.pieces.filter((piece) => piece.playerId === playerId).length
    }

    kindsInReserve(playerId: string): PieceKind[] {
        return PIECE_KINDS.filter((kind) => this.reserveCount(playerId, kind) > 0)
    }

    // Basic game rule B1/2: the first player's first piece stays out of the central hexagon.
    // Standard game rule 1: every new piece does.
    entersOutsideCentre(playerId: string): boolean {
        return (
            this.variant === Variant.Standard ||
            (playerId === this.firstPlayerId() && this.reserveSize(playerId) === SET_SIZE)
        )
    }

    entriesOf(playerId: string, kind: PieceKind): Placement[] {
        if (this.reserveCount(playerId, kind) === 0) {
            return []
        }
        return this.board.entriesOf(kind, this.entersOutsideCentre(playerId))
    }

    canEnter(
        playerId: string,
        kind: PieceKind,
        punct: AxialCoordinates,
        rotation: number
    ): boolean {
        return (
            this.reserveCount(playerId, kind) > 0 &&
            this.board.canEnter(kind, punct, rotation, this.entersOutsideCentre(playerId))
        )
    }

    // The player's piece whose PÜNCT is the top dot on a space.
    pieceWithPunctAt(playerId: string, coords: AxialCoordinates): PlacedPiece | undefined {
        const top = this.board.topAt(coords)
        return top !== undefined && top.dot === 0 && top.piece.playerId === playerId
            ? top.piece
            : undefined
    }

    moveFor(
        playerId: string,
        from: AxialCoordinates,
        to: AxialCoordinates,
        rotation: number
    ): Placement | undefined {
        const piece = this.pieceWithPunctAt(playerId, from)
        if (piece === undefined) return undefined
        const move = this.board
            .movesOf(piece)
            .find(
                (candidate) =>
                    sameCoordinates(candidate.punct, to) &&
                    sameOrientation(piece.kind, candidate.rotation, rotation)
            )
        return move === undefined ? undefined : { ...move, rotation }
    }

    canPlace(playerId: string): boolean {
        const outsideCentre = this.entersOutsideCentre(playerId)
        return this.kindsInReserve(playerId).some((kind) =>
            this.board.hasEntry(kind, outsideCentre)
        )
    }

    canMove(playerId: string): boolean {
        return this.board.canMove(playerId)
    }

    canAct(playerId: string): boolean {
        return this.canPlace(playerId) || this.canMove(playerId)
    }

    placePiece(
        playerId: string,
        kind: PieceKind,
        punct: AxialCoordinates,
        rotation: number
    ): PlacedPiece {
        return this.board.place(playerId, kind, punct, rotation)
    }

    movePiece(piece: PlacedPiece, placement: Placement) {
        this.board.move(piece, placement)
    }

    declareWinner(playerId: string, reason: EndReason) {
        this.result = GameResult.Win
        this.winningPlayerIds = [playerId]
        this.endReason = reason
    }

    declareDraw(reason: EndReason) {
        this.result = GameResult.Draw
        this.winningPlayerIds = this.players.map((player) => player.playerId)
        this.endReason = reason
    }
}
