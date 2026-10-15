import {
    AxialCoordinates,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ZertzPlayerState, HydratedZertzPlayerState } from './playerState.js'
import { MachineState } from '../definition/states.js'
import { SETUP_RULES, ZertzSetup } from '../definition/config.js'
import { HydratedZertzBoard, ZertzBoard, type Ring } from './board.js'
import { MARBLE_COLORS, MarbleColor, MarbleCounts, hasAnyMarble } from './marbles.js'

export enum EndReason {
    Captures = 'Captures',
    FullBoard = 'FullBoard',
    NoMarbles = 'NoMarbles'
}

export enum MarbleSource {
    Pool = 'Pool',
    Captured = 'Captured'
}

export type ZertzGameState = Type.Static<typeof ZertzGameState>
export const ZertzGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(ZertzPlayerState),
            machineState: Type.Enum(MachineState),
            setup: Type.Enum(ZertzSetup),
            board: ZertzBoard,
            pool: MarbleCounts,
            captureChainFrom: Type.Optional(AxialCoordinates),
            endReason: Type.Optional(Type.Enum(EndReason))
        })
    ])
)

export const ZertzGameStateValidator = Compile(ZertzGameState)

export class HydratedZertzGameState
    extends HydratableGameState<typeof ZertzGameState, HydratedZertzPlayerState>
    implements ZertzGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedZertzPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare setup: ZertzSetup
    declare board: HydratedZertzBoard
    declare pool: MarbleCounts
    declare captureChainFrom?: AxialCoordinates
    declare endReason?: EndReason

    constructor(data: ZertzGameState) {
        super(data, ZertzGameStateValidator)
        this.players = data.players.map((player) => new HydratedZertzPlayerState(player))
        this.board = new HydratedZertzBoard(data.board)
    }

    get isOver(): boolean {
        return this.endReason !== undefined
    }

    marbleSource(): MarbleSource {
        return hasAnyMarble(this.pool) ? MarbleSource.Pool : MarbleSource.Captured
    }

    // Rulebook section F: once the pool is empty, a player places from their own captures.
    placeableColors(playerId: string): MarbleColor[] {
        const supply =
            this.marbleSource() === MarbleSource.Pool
                ? this.pool
                : this.getPlayerState(playerId).captured
        return MARBLE_COLORS.filter((color) => supply[color] > 0)
    }

    canPlaceMarble(playerId: string): boolean {
        return this.placeableColors(playerId).length > 0 && this.board.hasVacantRing()
    }

    hasLegalMove(playerId: string): boolean {
        return this.board.hasAnyJump() || this.canPlaceMarble(playerId)
    }

    takeMarble(playerId: string, color: MarbleColor): MarbleSource {
        const source = this.marbleSource()
        const supply =
            source === MarbleSource.Pool ? this.pool : this.getPlayerState(playerId).captured
        if (supply[color] <= 0) {
            throw Error(`No ${color} marble available`)
        }
        supply[color] -= 1
        return source
    }

    claimFullGroups(playerId: string): Ring[] {
        const claimed = this.board.claimFullGroups()
        const player = this.getPlayerState(playerId)
        for (const ring of claimed) {
            if (ring.marble !== undefined) {
                player.capture(ring.marble)
            }
        }
        return claimed
    }

    hasWinningCaptures(playerId: string): boolean {
        const { win } = SETUP_RULES[this.setup]
        const { captured } = this.getPlayerState(playerId)
        return (
            MARBLE_COLORS.every((color) => captured[color] >= win.eachColor) ||
            MARBLE_COLORS.some((color) => captured[color] >= win.singleColor[color])
        )
    }

    // Applies the end of game checks that follow a move's captures and claims.
    concludeMove(playerId: string) {
        if (this.board.rings.length === 0) {
            this.declareWinner(playerId, EndReason.FullBoard)
        } else if (this.hasWinningCaptures(playerId)) {
            this.declareWinner(playerId, EndReason.Captures)
        }
    }

    declareWinner(playerId: string, reason: EndReason) {
        this.winningPlayerIds = [playerId]
        this.endReason = reason
    }

    opponentOf(playerId: string): string {
        const opponent = this.players.find((player) => player.playerId !== playerId)
        if (opponent === undefined) {
            throw Error(`No opponent for ${playerId}`)
        }
        return opponent.playerId
    }
}
