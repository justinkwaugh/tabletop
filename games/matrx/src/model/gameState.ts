import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState,
    sameCoordinates,
    type AxialCoordinates
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { HydratedMatrxPlayerState, MatrxPlayerState } from './playerState.js'
import { MachineState } from '../definition/states.js'
import {
    HydratedMatrxBoard,
    isPotentialKind,
    MatrxBoard,
    PieceKind,
    POTENTIAL_KINDS,
    discsBroughtIn,
    isPair,
    type PlacedUnit,
    type Row,
    type Unit
} from './board.js'
import { CENTRE, type Entry } from './geometry.js'

export enum EndReason {
    NoGipfPieces = 'NoGipfPieces',
    NoMoves = 'NoMoves'
}

export const GIPF_PIECES = 3

export type MatrxGameState = Type.Static<typeof MatrxGameState>
export const MatrxGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(MatrxPlayerState),
            machineState: Type.Enum(MachineState),
            board: MatrxBoard,
            movedThisTurn: Type.Boolean(),
            resolvingPlayerIds: Type.Array(Type.String()),
            // Owners of a TAMSK stack the opponent pushed onto E5, owed an extra move to open their
            // turn (rule H1.3).
            extraMoveOwedIds: Type.Array(Type.String()),
            nextDiscId: Type.Integer({ minimum: 0 }),
            endReason: Type.Optional(Type.Enum(EndReason))
        })
    ])
)

export const MatrxGameStateValidator = Compile(MatrxGameState)

export type PotentialMove = { from: AxialCoordinates; to: AxialCoordinates }

export class HydratedMatrxGameState
    extends HydratableGameState<typeof MatrxGameState, HydratedMatrxPlayerState>
    implements MatrxGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedMatrxPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedMatrxBoard
    declare movedThisTurn: boolean
    declare nextDiscId: number
    declare resolvingPlayerIds: string[]
    declare extraMoveOwedIds: string[]
    declare endReason?: EndReason

    constructor(data: MatrxGameState) {
        super(data, MatrxGameStateValidator)
        this.players = data.players.map((player) => new HydratedMatrxPlayerState(player))
        this.board = new HydratedMatrxBoard(data.board)
    }

    opponentOf(playerId: string): string {
        const opponent = this.players.find((player) => player.playerId !== playerId)
        if (opponent === undefined) {
            throw Error(`No opponent for ${playerId}`)
        }
        return opponent.playerId
    }

    gipfPiecesLeft(playerId: string): number {
        return this.getPlayerState(playerId).gipfPieces + this.board.gipfPiecesOf(playerId)
    }

    // Rule F5: a GIPF-piece in reserve goes back into play first, wherever a push is possible.
    mustPlayGipf(playerId: string): boolean {
        return this.getPlayerState(playerId).gipfPieces > 0 && this.board.legalEntries().length > 0
    }

    pushableKinds(playerId: string): PieceKind[] {
        if (this.board.legalEntries().length === 0) {
            return []
        }
        if (this.mustPlayGipf(playerId)) {
            return [PieceKind.Gipf]
        }
        const player = this.getPlayerState(playerId)
        return POTENTIAL_KINDS.filter((kind) => player.stacksOf(kind) > 0)
    }

    potentialMoves(playerId: string): PotentialMove[] {
        if (this.mustPlayGipf(playerId)) {
            return []
        }
        return this.board
            .tops()
            .filter(({ unit }) => unit.playerId === playerId && isPair(unit))
            .flatMap(({ coords }) =>
                this.board.potentialTargets(coords).map((to) => ({ from: coords, to }))
            )
    }

    canMove(playerId: string): boolean {
        return this.pushableKinds(playerId).length > 0 || this.potentialMoves(playerId).length > 0
    }

    ownTamskOnCentre(playerId: string): boolean {
        const top = this.board.topAt(CENTRE)
        return top?.kind === PieceKind.Tamsk && isPair(top) && top.playerId === playerId
    }

    pushPiece(playerId: string, entry: Entry, kind: PieceKind): string | undefined {
        const player = this.getPlayerState(playerId)
        const count = discsBroughtIn(kind)
        if (isPotentialKind(kind)) {
            player.potentials[kind] -= count
        } else {
            player.gipfPieces -= count
        }
        return this.push(entry, { playerId, kind, discIds: this.newDiscIds(count) })
    }

    private newDiscIds(count: number): number[] {
        const first = this.nextDiscId
        this.nextDiscId = first + count
        return Array.from({ length: count }, (_, index) => first + index)
    }

    // Rule H1: the TAMSK stack on the centre gives its top piece for a push from a dot.
    pushTamsk(entry: Entry): string | undefined {
        return this.push(entry, this.board.takeTopOfPair(CENTRE))
    }

    // Rule H1: an extra move not made that turn is lost, and its TAMSK-potential with it.
    forfeitTamsk() {
        this.board.takeTopOfPair(CENTRE)
    }

    movePotential(from: AxialCoordinates, to: AxialCoordinates): Unit | undefined {
        const covered = this.board.topAt(to)
        this.board.movePotential(from, to)
        return covered
    }

    // Returns the owner of a TAMSK stack the push lands on the centre.
    private push(entry: Entry, unit: Unit): string | undefined {
        const centre = this.board.push(entry, unit)
        const top = centre?.[centre.length - 1]
        return top?.kind === PieceKind.Tamsk && isPair(top) ? top.playerId : undefined
    }

    // Own pieces return to reserve; the opponent's are captured. Kept pairs stay.
    removeRow(playerId: string, row: Row, keep: readonly AxialCoordinates[]): PlacedUnit[] {
        const player = this.getPlayerState(playerId)
        const removed: PlacedUnit[] = []
        for (const coords of row.reach) {
            if (keep.some((kept) => sameCoordinates(kept, coords))) continue
            const unit = this.board.removeTop(coords)
            const size = unit.discIds.length
            if (unit.playerId !== playerId) {
                player.captured[unit.kind] += size
            } else if (isPotentialKind(unit.kind)) {
                player.potentials[unit.kind] += size
            } else {
                player.gipfPieces += 1
            }
            removed.push({ coords, unit })
        }
        return removed
    }

    declareWinner(playerId: string, reason: EndReason) {
        this.winningPlayerIds = [playerId]
        this.endReason = reason
    }
}
