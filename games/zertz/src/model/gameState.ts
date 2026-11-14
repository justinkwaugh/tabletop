import {
    addToChecksum,
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
import { ZertzPlayerState, HydratedZertzPlayerState } from './playerState.js'
import { MachineState } from '../definition/states.js'
import { SETUP_RULES, ZertzSetup } from '../definition/config.js'
import { HydratedZertzBoard, ZertzBoard, type Jump, type Ring } from './board.js'
import { MARBLE_COLORS, MarbleColor, MarbleCounts, hasAnyMarble } from './marbles.js'

export enum EndReason {
    Captures = 'Captures',
    FullBoard = 'FullBoard',
    NoMarbles = 'NoMarbles',
    Repetition = 'Repetition'
}

// The rules' tie for a repeated sequence of moves: a drawn game once a position, with the same
// player to move, comes round a third time.
const REPETITIONS_TO_DRAW = 3

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
            // A position can come round again only while the pool is empty and no ring leaves the
            // board, so only the turns since then are kept, each as a hash of its position.
            positions: Type.Array(Type.Number()),
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
    declare positions: number[]
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

    // Rulebook section C: capturing is compulsory, and a chain goes on with the marble that jumped.
    openJumps(): Jump[] {
        const chainFrom = this.captureChainFrom
        return chainFrom === undefined ? this.board.allJumps() : this.board.jumpsFrom(chainFrom)
    }

    findOpenJump(from: AxialCoordinates, to: AxialCoordinates): Jump | undefined {
        return this.openJumps().find(
            (jump) => sameCoordinates(jump.from, from) && sameCoordinates(jump.to, to)
        )
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

    placeMarble(
        playerId: string,
        color: MarbleColor,
        coords: AxialCoordinates
    ): { source: MarbleSource; claimed: Ring[] } {
        const source = this.takeMarble(playerId, color)
        this.board.placeMarble(coords, color)
        const claimed = this.claimFullGroups(playerId)
        this.concludeMove(playerId)
        return { source, claimed }
    }

    // A free ring is removed after placing, if one is left and the game goes on.
    removableAfterPlacing(
        playerId: string,
        color: MarbleColor,
        coords: AxialCoordinates
    ): AxialCoordinates[] {
        const trial = new HydratedZertzGameState(this.dehydrate())
        trial.placeMarble(playerId, color, coords)
        return trial.isOver ? [] : trial.board.freeRings().map((ring) => ring.coords)
    }

    removeRing(coords: AxialCoordinates) {
        this.board.removeRing(coords)
        this.positions = []
    }

    claimFullGroups(playerId: string): Ring[] {
        const claimed = this.board.claimFullGroups()
        if (claimed.length > 0) this.positions = []
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

    // Records the position the player to move faces, and says whether it has now come round
    // often enough to draw the game.
    recordPosition(playerId: string): boolean {
        if (hasAnyMarble(this.pool)) return false
        const position = JSON.stringify({
            rings: this.board.rings,
            captured: this.players.map((player) => player.captured),
            playerId
        })
        const hash = addToChecksum(0, [position])
        this.positions.push(hash)
        const seen = this.positions.filter((other) => other === hash).length
        return seen >= REPETITIONS_TO_DRAW
    }

    declareDraw() {
        this.winningPlayerIds = this.players.map((player) => player.playerId)
        this.endReason = EndReason.Repetition
    }

    opponentOf(playerId: string): string {
        const opponent = this.players.find((player) => player.playerId !== playerId)
        assertExists(opponent, `No opponent for ${playerId}`)
        return opponent.playerId
    }
}
