import {
    type AxialCoordinates,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { YinshPlayerState, HydratedYinshPlayerState } from './playerState.js'
import { MachineState } from '../definition/states.js'
import { RINGS_TO_WIN, YinshVersion } from '../definition/config.js'
import { HydratedYinshBoard, YinshBoard, type RingMove } from './board.js'

export const RINGS_PER_PLAYER = 5
export const MARKERS = 51

export enum EndReason {
    Rows = 'Rows',
    PoolEmpty = 'PoolEmpty',
    NoMoves = 'NoMoves'
}

export type YinshGameState = Type.Static<typeof YinshGameState>
export const YinshGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(YinshPlayerState),
            machineState: Type.Enum(MachineState),
            version: Type.Enum(YinshVersion),
            board: YinshBoard,
            resolvingPlayerIds: Type.Array(Type.String()),
            endReason: Type.Optional(Type.Enum(EndReason))
        })
    ])
)

export const YinshGameStateValidator = Compile(YinshGameState)

export class HydratedYinshGameState
    extends HydratableGameState<typeof YinshGameState, HydratedYinshPlayerState>
    implements YinshGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedYinshPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare version: YinshVersion
    declare board: HydratedYinshBoard
    declare resolvingPlayerIds: string[]
    declare endReason?: EndReason

    constructor(data: YinshGameState) {
        super(data, YinshGameStateValidator)
        this.players = data.players.map((player) => new HydratedYinshPlayerState(player))
        this.board = new HydratedYinshBoard(data.board)
    }

    get ringsToWin(): number {
        return RINGS_TO_WIN[this.version]
    }

    opponentOf(playerId: string): string {
        const opponent = this.players.find((player) => player.playerId !== playerId)
        if (opponent === undefined) {
            throw Error(`No opponent for ${playerId}`)
        }
        return opponent.playerId
    }

    ringsToPlace(playerId: string): number {
        const player = this.getPlayerState(playerId)
        return RINGS_PER_PLAYER - player.ringsRemoved - this.board.ringsOf(playerId).length
    }

    allRingsPlaced(): boolean {
        return this.players.every((player) => this.ringsToPlace(player.playerId) === 0)
    }

    markersInPool(): number {
        return MARKERS - this.board.markerCount()
    }

    movesFor(playerId: string): { from: AxialCoordinates; moves: RingMove[] }[] {
        return this.board
            .ringsOf(playerId)
            .map((from) => ({ from, moves: this.board.movesFrom(from) }))
            .filter((ring) => ring.moves.length > 0)
    }

    canMove(playerId: string): boolean {
        return this.movesFor(playerId).length > 0
    }

    moveRing(playerId: string, from: AxialCoordinates, to: AxialCoordinates): RingMove {
        const move = this.board.findMove(from, to)
        if (move === undefined || this.board.ringAt(from) !== playerId) {
            throw Error('The ring cannot move there')
        }
        this.board.moveRing(from, move, playerId, this.opponentOf(playerId))
        return move
    }

    removeRing(playerId: string, coords: AxialCoordinates): number {
        this.board.removeRing(coords)
        const player = this.getPlayerState(playerId)
        player.ringsRemoved += 1
        return player.ringsRemoved
    }

    hasWon(playerId: string): boolean {
        return this.getPlayerState(playerId).ringsRemoved >= this.ringsToWin
    }

    declareWinner(playerId: string) {
        this.winningPlayerIds = [playerId]
        this.endReason = EndReason.Rows
    }

    // Rule H3: most rings removed wins; equal counts draw, which the platform records with both
    // players as winners.
    declareWinnerByRings(reason: EndReason) {
        this.endReason = reason
        const most = Math.max(...this.players.map((player) => player.ringsRemoved))
        this.winningPlayerIds = this.players
            .filter((player) => player.ringsRemoved === most)
            .map((player) => player.playerId)
    }
}
