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
import { GipfPotentialsPlayerState, HydratedGipfPotentialsPlayerState } from './playerState.js'
import { MachineState } from '../definition/states.js'
import { GipfVersion, VERSION_RULES } from '../definition/config.js'
import {
    GipfPotentialsBoard,
    HydratedGipfPotentialsBoard,
    type PlacedUnit,
    type Row
} from './board.js'
import {
    countsOfEachKind,
    isPotentialKind,
    PieceKind,
    POTENTIAL_KINDS,
    type PotentialCounts,
    type Unit
} from './pieces.js'
import { CENTRE, type Entry } from './geometry.js'

export enum EndReason {
    NoGipfPieces = 'NoGipfPieces',
    NoMoves = 'NoMoves'
}

export type GipfPotentialsGameState = Type.Static<typeof GipfPotentialsGameState>
export const GipfPotentialsGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(GipfPotentialsPlayerState),
            machineState: Type.Enum(MachineState),
            version: Type.Enum(GipfVersion),
            board: GipfPotentialsBoard,
            movedThisTurn: Type.Boolean(),
            resolvingPlayerIds: Type.Array(Type.String()),
            // Players whose TAMSK-loaded piece the opponent pushed onto the centre: an extra move
            // to open their next turn.
            extraMoveOwedIds: Type.Array(Type.String()),
            // The id the next disc to enter the board takes.
            nextDiscId: Type.Integer({ minimum: 0 }),
            endReason: Type.Optional(Type.Enum(EndReason))
        })
    ])
)

export const GipfPotentialsGameStateValidator = Compile(GipfPotentialsGameState)

export type PotentialMove = { from: AxialCoordinates; to: AxialCoordinates }

export type PushResult = { tamskOwnerId?: string; forfeited?: PotentialCounts }

const GIPF_PIECE_SIZE = 2

export class HydratedGipfPotentialsGameState
    extends HydratableGameState<typeof GipfPotentialsGameState, HydratedGipfPotentialsPlayerState>
    implements GipfPotentialsGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedGipfPotentialsPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare version: GipfVersion
    declare board: HydratedGipfPotentialsBoard
    declare movedThisTurn: boolean
    declare nextDiscId: number
    declare resolvingPlayerIds: string[]
    declare extraMoveOwedIds: string[]
    declare endReason?: EndReason

    constructor(data: GipfPotentialsGameState) {
        super(data, GipfPotentialsGameStateValidator)
        this.players = data.players.map((player) => new HydratedGipfPotentialsPlayerState(player))
        this.board = new HydratedGipfPotentialsBoard(data.board)
    }

    get rules() {
        return VERSION_RULES[this.version]
    }

    get usesTournamentStart(): boolean {
        return !this.rules.startsWithGipfPieces
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

    // Tournament: a player's first piece is a GIPF-piece, and GIPF-pieces come only until their
    // first other piece.
    mustPlayGipf(playerId: string): boolean {
        return this.usesTournamentStart && !this.hasMoved(playerId)
    }

    canPlayGipf(playerId: string): boolean {
        const player = this.getPlayerState(playerId)
        return this.usesTournamentStart && !player.playedOther && player.reserve >= GIPF_PIECE_SIZE
    }

    // General use, rule 3: loaded pieces first; a plain piece may still be pushed, but the
    // potentials left in hand are then lost.
    pushableKinds(playerId: string): PieceKind[] {
        if (this.board.legalEntries().length === 0) {
            return []
        }
        const gipf = this.canPlayGipf(playerId) ? [PieceKind.Gipf] : []
        if (this.mustPlayGipf(playerId)) {
            return gipf
        }
        const player = this.getPlayerState(playerId)
        if (player.reserve === 0) {
            return gipf
        }
        const loaded = POTENTIAL_KINDS.filter((kind) => player.potentials[kind] > 0)
        return [...gipf, ...loaded, PieceKind.Basic]
    }

    potentialMoves(playerId: string): PotentialMove[] {
        if (this.mustPlayGipf(playerId)) {
            return []
        }
        const reserve = this.getPlayerState(playerId).reserve
        return this.board
            .tops()
            .filter(({ unit }) => unit.playerId === playerId)
            .flatMap(({ coords }) =>
                this.board.potentialTargets(coords, reserve).map((to) => ({ from: coords, to }))
            )
    }

    isPotentialMove(playerId: string, from: AxialCoordinates, to: AxialCoordinates): boolean {
        return this.potentialMoves(playerId).some(
            (move) => sameCoordinates(move.from, from) && sameCoordinates(move.to, to)
        )
    }

    canMove(playerId: string): boolean {
        return this.pushableKinds(playerId).length > 0 || this.potentialMoves(playerId).length > 0
    }

    ownTamskOnCentre(playerId: string): boolean {
        const top = this.board.topAt(CENTRE)
        return top?.load === PieceKind.Tamsk && top.playerId === playerId
    }

    pushPiece(playerId: string, entry: Entry, kind: PieceKind): PushResult {
        const player = this.getPlayerState(playerId)
        if (kind === PieceKind.Gipf) {
            player.reserve -= GIPF_PIECE_SIZE
            return this.push(entry, { playerId, kind, discIds: this.newDiscIds(2) })
        }
        player.reserve -= 1
        player.playedOther = true
        if (isPotentialKind(kind)) {
            player.potentials[kind] -= 1
            return this.push(entry, {
                playerId,
                kind: PieceKind.Basic,
                load: kind,
                discIds: this.newDiscIds(2)
            })
        }
        const forfeited = player.potentialsInHand() > 0 ? { ...player.potentials } : undefined
        player.potentials = countsOfEachKind(() => 0)
        const result = this.push(entry, { playerId, kind, discIds: this.newDiscIds(1) })
        return forfeited === undefined ? result : { ...result, forfeited }
    }

    // TAMSK, rule 2: the potential leaves the piece on the centre and is pushed in from a dot.
    pushTamsk(entry: Entry): PushResult {
        return this.push(entry, this.board.unload(CENTRE))
    }

    // TAMSK, rule 2: an extra move not made is lost, and its potential with it.
    forfeitTamsk() {
        this.board.unload(CENTRE)
    }

    // A PÜNCT-potential landing on a GIPF-piece leaves the game, and one or two pieces from the
    // reserve cover the GIPF-piece instead. Returns the unit the potential covered and what landed.
    movePotential(
        playerId: string,
        from: AxialCoordinates,
        to: AxialCoordinates,
        cover: number
    ): { covered?: Unit; landed: Unit } {
        const covered = this.board.topAt(to)
        const potential = this.board.unload(from)
        const landed: Unit =
            covered?.kind === PieceKind.Gipf ? this.coverPieces(playerId, cover) : potential
        this.board.place(to, landed)
        return { ...(covered === undefined ? {} : { covered: structuredClone(covered) }), landed }
    }

    private coverPieces(playerId: string, count: number): Unit {
        this.getPlayerState(playerId).reserve -= count
        return {
            playerId,
            kind: count === GIPF_PIECE_SIZE ? PieceKind.Gipf : PieceKind.Basic,
            discIds: this.newDiscIds(count)
        }
    }

    private newDiscIds(count: number): number[] {
        const first = this.nextDiscId
        this.nextDiscId = first + count
        return Array.from({ length: count }, (_, index) => first + index)
    }

    private push(entry: Entry, unit: Unit): PushResult {
        const centre = this.board.push(entry, unit)
        return centre?.load === PieceKind.Tamsk ? { tamskOwnerId: centre.playerId } : {}
    }

    // Own basic pieces return to the reserve (a GIPF-piece as two); the opponent's are captured.
    // Potentials, used or loaded, leave the game either way.
    removeRow(playerId: string, row: Row, keep: readonly AxialCoordinates[]): PlacedUnit[] {
        const player = this.getPlayerState(playerId)
        const removed: PlacedUnit[] = []
        for (const coords of row.reach) {
            if (keep.some((kept) => sameCoordinates(kept, coords))) continue
            const unit = this.board.removeTop(coords)
            const basics = unit.kind === PieceKind.Gipf ? 2 : unit.kind === PieceKind.Basic ? 1 : 0
            if (unit.playerId === playerId) {
                player.reserve += basics
            } else {
                player.captured += basics
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
