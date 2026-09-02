import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    getSquare,
    isOnBoard,
    isWalledBetween,
    regionCentroidSquareKey,
    separatesSamePrincePieces,
    squareKey,
    wallBetween
} from '../model/board.js'
import { detectNewRegions } from '../util/regionDetection.js'
import { countTowns, removeInteriorWalls, scoreRegion } from '../util/regionScoring.js'
import { PieceOwner } from '../model/owner.js'

export type PlaceWallMetadata = Type.Static<typeof PlaceWallMetadata>
export const PlaceWallMetadata = Type.Object({
    // Any region(s) this specific wall completed - only present when scoring happened,
    // used by history to explain the resulting power-point change, and by the board
    // UI (anchorSquareKey) to show a floating score popup at the right spot.
    completedRegions: Type.Optional(
        Type.Array(
            Type.Object({
                owner: Type.Optional(PieceOwner),
                spaceCount: Type.Number(),
                townCount: Type.Number(),
                points: Type.Number(),
                anchorSquareKey: Type.String()
            })
        )
    )
})

export type PlaceWall = Type.Static<typeof PlaceWall>
export const PlaceWall = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.PlaceWall), // This action is always this type
            playerId: Type.String(), // Required now
            // The two adjacent squares the wall goes between - the engine works out
            // the canonical col/row/edge storage from these.
            col1: Type.Number(),
            row1: Type.Number(),
            col2: Type.Number(),
            row2: Type.Number(),
            metadata: Type.Optional(PlaceWallMetadata) // Always optional, because it is an output
        })
    ])
)

export const PlaceWallValidator = Compile(PlaceWall)

export function isPlaceWall(action?: GameAction): action is PlaceWall {
    return action?.type === ActionType.PlaceWall
}

export class HydratedPlaceWall extends HydratableAction<typeof PlaceWall> implements PlaceWall {
    declare type: ActionType.PlaceWall
    declare playerId: string
    declare col1: number
    declare row1: number
    declare col2: number
    declare row2: number
    declare metadata?: PlaceWallMetadata

    constructor(data: PlaceWall) {
        super(data, PlaceWallValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidPlaceWall(state)) {
            throw Error('Invalid PlaceWall action')
        }

        const wall = wallBetween(this.col1, this.row1, this.col2, this.row2)!
        state.board.walls.push(wall)
        state.wallsRemaining = (state.wallsRemaining ?? 1) - 1

        const newRegions = detectNewRegions(state.board, state.regions)
        const completedRegions: NonNullable<PlaceWallMetadata['completedRegions']> = []
        // A region belonging to a colour no player holds - the neutral prince in the
        // 2-player variant, or an unchosen colour's castles at 3 players - scores for
        // NOBODY. That's deliberate, not an oversight the `if (player)` guard is hiding:
        // points exist only to decide who succeeds the King, and the neutral prince can't
        // win, so there is nobody to award them to. It also gives walling in neutral
        // territory a purpose of its own - denial, locking its spaces, hills and towns away
        // from your opponent - rather than the gift that enclosing a real prince's region
        // is ("the owner of the newly created region... moves his power marker", even when
        // someone else's play created it). Awarding them to the enclosing player instead
        // would be a house rule, and a significant change to 2-player balance.
        for (const region of newRegions) {
            const points = region.owner ? scoreRegion(region, state.board) : 0
            if (region.owner) {
                const player = state.players.find((p) => p.playerId === region.owner)
                if (player) {
                    player.powerPoints += points
                }
            }
            completedRegions.push({
                owner: region.owner,
                spaceCount: region.squareKeys.length,
                townCount: countTowns(region, state.board),
                points,
                anchorSquareKey: regionCentroidSquareKey(region.squareKeys)
            })
            state.regions.push(region)
            removeInteriorWalls(state.board, region)
        }

        this.metadata = completedRegions.length > 0 ? { completedRegions } : {}
    }

    isValidPlaceWall(state: HydratedLowenherzGameState): boolean {
        return this.invalidPlaceWallReason(state) === undefined
    }

    // Same checks as isValidPlaceWall, but reports WHY a placement is rejected - the
    // client uses this to show a specific message instead of one generic one.
    invalidPlaceWallReason(state: HydratedLowenherzGameState): string | undefined {
        if (state.wallPlacingPlayerId !== this.playerId) {
            return "It isn't your turn to place a wall."
        }
        if (!state.wallsRemaining || state.wallsRemaining <= 0) {
            return "You have no walls left to place this turn."
        }

        if (!isOnBoard(this.col1, this.row1) || !isOnBoard(this.col2, this.row2)) {
            return 'That square is off the board.'
        }

        const wall = wallBetween(this.col1, this.row1, this.col2, this.row2)
        if (!wall) {
            return "Those two squares aren't directly adjacent to each other."
        }

        if (isWalledBetween(state.board, this.col1, this.row1, this.col2, this.row2)) {
            return "There's already a wall between those two squares."
        }

        const square1 = getSquare(state.board, this.col1, this.row1)
        const square2 = getSquare(state.board, this.col2, this.row2)
        if (!square1 || !square2) {
            return 'That square is off the board.'
        }

        // Never between two knights of the same prince, or a knight and that same
        // prince's castle (see separatesSamePrincePieces - ExpandRegion's wall ring honours
        // the same rule, so it lives next to the board model rather than in here).
        if (separatesSamePrincePieces(square1, square2)) {
            if (square1.knightOwner && square1.knightOwner === square2.knightOwner) {
                return "A wall can't separate two knights of the same prince."
            }
            return "A wall can't separate a knight from its own castle."
        }

        // Never inside an already-sealed region - both squares already belonging to
        // the same existing region means this wall would be pointless clutter.
        const key1 = squareKey(this.col1, this.row1)
        const key2 = squareKey(this.col2, this.row2)
        const alreadyInSameRegion = state.regions.some(
            (region) => region.squareKeys.includes(key1) && region.squareKeys.includes(key2)
        )
        if (alreadyInSameRegion) {
            return "Those two squares are already inside the same completed region."
        }

        return undefined
    }
}
