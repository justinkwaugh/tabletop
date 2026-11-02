import {
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
import { PieceKind, rotationsOf, sameOrientation, SET_SIZE } from './pieces.js'
import { SPACES } from './geometry.js'

export enum Variant {
    Standard = 'Standard',
    Basic = 'Basic'
}

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
            // The id the next piece to enter the board takes.
            nextPieceId: Type.Integer({ minimum: 0 }),
            endReason: Type.Optional(Type.Enum(EndReason))
        })
    ])
)

export const PunctGameStateValidator = Compile(PunctGameState)

export type PieceMove = Placement & { pieceId: number }

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
    declare nextPieceId: number
    declare endReason?: EndReason

    constructor(data: PunctGameState) {
        super(data, PunctGameStateValidator)
        this.players = data.players.map((player) => new HydratedPunctPlayerState(player))
        this.board = new HydratedPunctBoard(data.board)
    }

    opponentOf(playerId: string): string {
        const opponent = this.players.find((player) => player.playerId !== playerId)
        if (opponent === undefined) {
            throw Error(`No opponent for ${playerId}`)
        }
        return opponent.playerId
    }

    firstPlayerId(): string {
        return this.turnManager.turnOrder[0]
    }

    // Basic game rule B1/2: the first player's first piece stays out of the central hexagon.
    // Standard game rule 1: every new piece does.
    entersOutsideCentre(playerId: string): boolean {
        return (
            this.variant === Variant.Standard ||
            (playerId === this.firstPlayerId() &&
                this.getPlayerState(playerId).reserveSize() === SET_SIZE)
        )
    }

    entriesOf(playerId: string, kind: PieceKind): Placement[] {
        if (this.getPlayerState(playerId).reserve[kind] === 0) {
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
            this.getPlayerState(playerId).reserve[kind] > 0 &&
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

    movesOf(playerId: string, from: AxialCoordinates): Placement[] {
        const piece = this.pieceWithPunctAt(playerId, from)
        return piece === undefined ? [] : this.board.movesOf(piece)
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
        return this.getPlayerState(playerId)
            .kindsInReserve()
            .some((kind) =>
                SPACES.some((punct) =>
                    rotationsOf(kind).some((rotation) =>
                        this.board.canEnter(kind, punct, rotation, outsideCentre)
                    )
                )
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
        this.getPlayerState(playerId).reserve[kind] -= 1
        const piece = { id: this.nextPieceId, playerId, kind, punct, rotation, level: 0 }
        this.nextPieceId += 1
        this.board.place(piece)
        return piece
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
