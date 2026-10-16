import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GipfPlayerState, HydratedGipfPlayerState } from './playerState.js'
import { MachineState } from '../definition/states.js'
import { GipfVersion, VERSION_RULES } from '../definition/config.js'
import { GipfBoard, HydratedGipfBoard, type Piece, type RemovedPiece, type Row } from './board.js'
import type { AxialCoordinates } from '@tabletop/common'

export enum EndReason {
    NoReserve = 'NoReserve',
    NoGipfPieces = 'NoGipfPieces',
    Blocked = 'Blocked'
}

export type GipfGameState = Type.Static<typeof GipfGameState>
export const GipfGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(GipfPlayerState),
            machineState: Type.Enum(MachineState),
            version: Type.Enum(GipfVersion),
            board: GipfBoard,
            moverId: Type.Optional(Type.String()),
            resolvingPlayerIds: Type.Array(Type.String()),
            endReason: Type.Optional(Type.Enum(EndReason))
        })
    ])
)

export const GipfGameStateValidator = Compile(GipfGameState)

const GIPF_PIECE_SIZE = 2

export class HydratedGipfGameState
    extends HydratableGameState<typeof GipfGameState, HydratedGipfPlayerState>
    implements GipfGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedGipfPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare version: GipfVersion
    declare board: HydratedGipfBoard
    declare moverId?: string
    declare resolvingPlayerIds: string[]
    declare endReason?: EndReason

    constructor(data: GipfGameState) {
        super(data, GipfGameStateValidator)
        this.players = data.players.map((player) => new HydratedGipfPlayerState(player))
        this.board = new HydratedGipfBoard(data.board)
    }

    get rules() {
        return VERSION_RULES[this.version]
    }

    opponentOf(playerId: string): string {
        const opponent = this.players.find((player) => player.playerId !== playerId)
        if (opponent === undefined) {
            throw Error(`No opponent for ${playerId}`)
        }
        return opponent.playerId
    }

    hasMoved(playerId: string): boolean {
        return (this.turnManager.turnCounts[playerId] ?? 0) > 0
    }

    // Tournament: GIPF-pieces until a player's first single piece, and the first piece must be one.
    canPlayGipf(playerId: string): boolean {
        const player = this.getPlayerState(playerId)
        return (
            this.version === GipfVersion.Tournament &&
            !player.playedSingle &&
            player.reserve >= GIPF_PIECE_SIZE
        )
    }

    mustPlayGipf(playerId: string): boolean {
        return this.version === GipfVersion.Tournament && !this.hasMoved(playerId)
    }

    canPlaySingle(playerId: string): boolean {
        return !this.mustPlayGipf(playerId) && this.getPlayerState(playerId).reserve >= 1
    }

    canMove(playerId: string): boolean {
        const hasPiece = this.canPlaySingle(playerId) || this.canPlayGipf(playerId)
        return hasPiece && this.board.legalEntries().length > 0
    }

    pushPiece(playerId: string, dot: AxialCoordinates, firstSpot: AxialCoordinates, gipf: boolean) {
        const entry = this.board.findEntry(dot, firstSpot)
        if (entry === undefined || !this.board.canPush(entry)) {
            throw Error('No room to push along that line')
        }
        const player = this.getPlayerState(playerId)
        player.reserve -= gipf ? GIPF_PIECE_SIZE : 1
        if (!gipf) {
            player.playedSingle = true
        }
        this.board.push(entry, { playerId, gipf })
        this.moverId = playerId
    }

    // Own pieces return to reserve (a GIPF-piece as two singles); the opponent's are captured.
    removeRow(playerId: string, row: Row, keep: readonly AxialCoordinates[]): RemovedPiece[] {
        const player = this.getPlayerState(playerId)
        const removed: RemovedPiece[] = []
        for (const coords of row.reach) {
            const piece: Piece | undefined = this.board.pieceAt(coords)
            const kept =
                piece?.gipf === true && keep.some((k) => k.q === coords.q && k.r === coords.r)
            if (piece === undefined || kept) continue
            this.board.remove(coords)
            const size = piece.gipf ? GIPF_PIECE_SIZE : 1
            if (piece.playerId === playerId) {
                player.reserve += size
            } else {
                player.captured += size
            }
            removed.push({ ...piece, coords })
        }
        return removed
    }

    declareWinner(playerId: string, reason: EndReason) {
        this.winningPlayerIds = [playerId]
        this.endReason = reason
    }
}
