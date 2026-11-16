import {
    assertExists,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { LyngkPlayerState, HydratedLyngkPlayerState } from './playerState.js'
import { MachineState } from '../definition/states.js'
import { LyngkVariant, VARIANT_RULES } from '../definition/config.js'
import { LyngkBoard, HydratedLyngkBoard, type MovePath } from './board.js'
import { ACTIVE_COLORS, PieceColor, topOf, type ColorRights } from './pieces.js'

export enum EndReason {
    StackOfSix = 'StackOfSix',
    NoMoves = 'NoMoves'
}

export type LyngkGameState = Type.Static<typeof LyngkGameState>
export const LyngkGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(LyngkPlayerState),
            machineState: Type.Enum(MachineState),
            variant: Type.Enum(LyngkVariant),
            board: LyngkBoard,
            claimedThisTurn: Type.Boolean(),
            endReason: Type.Optional(Type.Enum(EndReason))
        })
    ])
)

export const LyngkGameStateValidator = Compile(LyngkGameState)

export type MoveOutcome = {
    moved: PieceColor[]
    landedOn: PieceColor[]
    scored: boolean
    completedSix: boolean
}

export class HydratedLyngkGameState
    extends HydratableGameState<typeof LyngkGameState, HydratedLyngkPlayerState>
    implements LyngkGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedLyngkPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare variant: LyngkVariant
    declare board: HydratedLyngkBoard
    declare claimedThisTurn: boolean
    declare endReason?: EndReason

    constructor(data: LyngkGameState) {
        super(data, LyngkGameStateValidator)
        this.players = data.players.map((player) => new HydratedLyngkPlayerState(player))
        this.board = new HydratedLyngkBoard(data.board)
    }

    get rules() {
        return VARIANT_RULES[this.variant]
    }

    opponentOf(playerId: string): string {
        const opponent = this.players.find((player) => player.playerId !== playerId)
        assertExists(opponent, `No opponent for ${playerId}`)
        return opponent.playerId
    }

    claimantOf(color: PieceColor): string | undefined {
        return this.players.find((player) => player.claimed.includes(color))?.playerId
    }

    unclaimedColors(): PieceColor[] {
        return ACTIVE_COLORS.filter((color) => this.claimantOf(color) === undefined)
    }

    rightsOf(playerId: string, claiming?: PieceColor): ColorRights {
        const claimed = this.getPlayerState(playerId).claimed
        const owned = claiming === undefined ? claimed : [...claimed, claiming]
        return {
            owned,
            neutral: this.unclaimedColors().filter((color) => color !== claiming)
        }
    }

    pathsFor(playerId: string): MovePath[] {
        return this.board.allPaths(this.rightsOf(playerId), this.rules.maxHeight)
    }

    hasMove(playerId: string): boolean {
        return this.board.hasMove(this.rightsOf(playerId), this.rules.maxHeight)
    }

    // A claim must leave the player a move, so a player who claims to escape a pass is never stuck.
    claimableColors(playerId: string): PieceColor[] {
        const isTheirTurn = this.turnManager.currentTurn()?.playerId === playerId
        if (
            !isTheirTurn ||
            this.claimedThisTurn ||
            !this.getPlayerState(playerId).hasClaimsLeft()
        ) {
            return []
        }
        return this.unclaimedColors().filter((color) =>
            this.board.hasMove(this.rightsOf(playerId, color), this.rules.maxHeight)
        )
    }

    // Rule E11: a player passes only when no move exists, counting moves a claim would open.
    canAct(playerId: string): boolean {
        if (this.hasMove(playerId)) {
            return true
        }
        const player = this.getPlayerState(playerId)
        return (
            player.hasClaimsLeft() &&
            this.unclaimedColors().some((color) =>
                this.board.hasMove(this.rightsOf(playerId, color), this.rules.maxHeight)
            )
        )
    }

    claim(playerId: string, color: PieceColor) {
        this.getPlayerState(playerId).claimed.push(color)
        this.claimedThisTurn = true
    }

    move(playerId: string, path: MovePath): MoveOutcome {
        const landedOn = [...this.board.stackAt(path.to)]
        const moved = this.board.stackAt(path.from)
        this.board.drop(path.to, this.board.lift(path.from))
        const result = this.board.stackAt(path.to)
        const top = topOf(result)
        const ownsTop = top !== undefined && this.getPlayerState(playerId).claimed.includes(top)
        const scored =
            ownsTop && this.rules.removesCompletedStacks && result.length === this.rules.maxHeight
        if (scored) {
            this.getPlayerState(playerId).scored.push(this.board.lift(path.to))
        }
        const completedSix =
            ownsTop && this.variant === LyngkVariant.StackOfSix && result.length === 6
        return { moved, landedOn, scored, completedSix }
    }

    // Rule G2 and H6: compare scored stacks (or 5-stacks on the board), then 4s, 3s, 2s and singles.
    rankingOf(playerId: string): number[] {
        const claimed = this.getPlayerState(playerId).claimed
        const firstCount =
            this.variant === LyngkVariant.StackOfSix
                ? this.board.stacksOfHeight(5, claimed)
                : this.getPlayerState(playerId).scored.length
        return [
            firstCount,
            ...[4, 3, 2, 1].map((height) => this.board.stacksOfHeight(height, claimed))
        ]
    }

    scoreOf(playerId: string): number {
        return this.rankingOf(playerId)[0]
    }

    declareWinner(playerId: string, reason: EndReason) {
        this.winningPlayerIds = [playerId]
        this.endReason = reason
    }

    // Each count the ranking compares, by the height of the stacks it counts: 5 for the stacks
    // scored (in Stack of 6, stacks of 5 on the board), then 4, 3, 2 and 1.
    rankingCounts(playerId: string): { height: number; count: number }[] {
        return this.rankingOf(playerId).map((count, index) => ({ height: 5 - index, count }))
    }

    // Where the two players' rankings first differ; none for a full tie.
    deciderIndex(): number | undefined {
        const [first, second] = this.players.map((player) => this.rankingOf(player.playerId))
        const index = first.findIndex((count, at) => count !== second[at])
        return index < 0 ? undefined : index
    }

    // Rule G3: a full tie is a draw, which the platform records with both players as winners.
    declareWinnerByRanking() {
        this.endReason = EndReason.NoMoves
        const decider = this.deciderIndex()
        if (decider === undefined) {
            this.winningPlayerIds = this.players.map((player) => player.playerId)
            return
        }
        const [first, second] = this.players
        const ahead =
            this.rankingOf(first.playerId)[decider] > this.rankingOf(second.playerId)[decider]
        this.winningPlayerIds = [(ahead ? first : second).playerId]
    }
}
