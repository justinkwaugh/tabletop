import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    getSquare,
    isOnBoard,
    isWalledBetween,
    neighbors,
    squareKey,
    SquareType,
    wallBetween
} from '../model/board.js'
import { Region } from '../model/region.js'
import { detectNewRegions } from '../util/regionDetection.js'
import { areRegionsAllied } from '../util/allianceHelpers.js'
import {
    countKnights,
    countTowns,
    findConnectedComponents,
    removeInteriorWalls,
    scoreRegion
} from '../util/regionScoring.js'

export type ExpandRegionSpace = Type.Static<typeof ExpandRegionSpace>
export const ExpandRegionSpace = Type.Object({ col: Type.Number(), row: Type.Number() })

export type ExpandRegionInvasionMetadata = Type.Static<typeof ExpandRegionInvasionMetadata>
export const ExpandRegionInvasionMetadata = Type.Object({
    victimColor: Type.Enum(Color),
    directSpacesLost: Type.Number(),
    directPointsLost: Type.Number(),
    // Where to anchor a "-N" board popup for the direct loss - one of the squares
    // actually taken from this victim.
    directAnchorSquareKey: Type.String(),
    disconnectedSpaces: Type.Number(),
    disconnectedPointsLost: Type.Number(),
    // Where to anchor a separate "-N" popup for the disconnection loss - only
    // present when disconnectedSpaces > 0, since that loss happens somewhere else
    // on the board than the directly-taken squares.
    disconnectedAnchorSquareKey: Type.Optional(Type.String())
})

export type ExpandRegionMetadata = Type.Static<typeof ExpandRegionMetadata>
export const ExpandRegionMetadata = Type.Object({
    spacesTaken: Type.Optional(Type.Number()),
    townsTaken: Type.Optional(Type.Number()),
    pointsGained: Type.Optional(Type.Number()),
    // Present only when this expansion invaded another prince's region(s) - one entry
    // per victim, since a 2-space expansion can (rarely) reach into two different
    // regions.
    invasions: Type.Optional(Type.Array(ExpandRegionInvasionMetadata)),
    // Present only when the new walls added around the expansion happened to also
    // fully enclose some OTHER area of the board - e.g. boxing in a castle+knight
    // pair that had never been walled off before. Same shape and scoring as
    // PlaceWall's completedRegions, since it's the same underlying event.
    completedRegions: Type.Optional(
        Type.Array(
            Type.Object({
                ownerColor: Type.Optional(Type.Enum(Color)),
                spaceCount: Type.Number(),
                townCount: Type.Number(),
                points: Type.Number(),
                anchorSquareKey: Type.String()
            })
        )
    )
})

export type ExpandRegion = Type.Static<typeof ExpandRegion>
export const ExpandRegion = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.ExpandRegion), // This action is always this type
            playerId: Type.String(), // Required now
            regionId: Type.String(),
            // 1 or 2 spaces, in order - the 2nd (if present) must be adjacent to the
            // region as extended by the 1st, not necessarily the original region.
            spaces: Type.Array(ExpandRegionSpace),
            metadata: Type.Optional(ExpandRegionMetadata) // Always optional, because it is an output
        })
    ])
)

export const ExpandRegionValidator = Compile(ExpandRegion)

export function isExpandRegion(action?: GameAction): action is ExpandRegion {
    return action?.type === ActionType.ExpandRegion
}

// Extends one of the player's own regions by 1-2 spaces, into open/unclaimed
// territory, an existing neutral zone, or - if the player's knights in this region
// outnumber the defender's - another prince's region. Invading carves the taken
// squares out of the defender's region; if that disconnects part of it from its
// castle, the disconnected piece(s) become a new neutral zone and the defender loses
// extra points for them (see apply()).
export class HydratedExpandRegion
    extends HydratableAction<typeof ExpandRegion>
    implements ExpandRegion
{
    declare type: ActionType.ExpandRegion
    declare playerId: string
    declare regionId: string
    declare spaces: ExpandRegionSpace[]
    declare metadata?: ExpandRegionMetadata

    constructor(data: ExpandRegion) {
        super(data, ExpandRegionValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidExpandRegion(state)) {
            throw Error('Invalid ExpandRegion action')
        }

        const region = state.regions.find((r) => r.id === this.regionId)!
        let townsTaken = 0

        // Per invaded region id: the squares pulled out of it this turn, and how many
        // were towns - tallied here, then turned into direct losses (and checked for
        // disconnection) once every space in this action has been claimed.
        const invasions = new Map<string, { victimRegion: Region; spacesLost: string[]; townsLost: number }>()

        for (const space of this.spaces) {
            const key = squareKey(space.col, space.row)

            // If this space belonged to a tracked neutral zone or another prince's
            // region, pull it out of that region - it's being absorbed/conquered, not
            // destroyed. (A region can never lose its castle square this way - that
            // square is always "occupied" and thus rejected as a target already.)
            const owningRegion = state.regions.find((r) => r.id !== region.id && r.squareKeys.includes(key))
            if (owningRegion) {
                owningRegion.squareKeys = owningRegion.squareKeys.filter((k) => k !== key)

                if (owningRegion.ownerColor) {
                    if (!invasions.has(owningRegion.id)) {
                        invasions.set(owningRegion.id, { victimRegion: owningRegion, spacesLost: [], townsLost: 0 })
                    }
                    const invasion = invasions.get(owningRegion.id)!
                    invasion.spacesLost.push(key)
                    if (getSquare(state.board, space.col, space.row)?.type === SquareType.Village) {
                        invasion.townsLost++
                    }
                }
            }

            region.squareKeys.push(key)

            if (getSquare(state.board, space.col, space.row)?.type === SquareType.Village) {
                townsTaken++
            }
        }

        state.regions = state.regions.filter((r) => r.id === region.id || r.squareKeys.length > 0)

        // The region grew across whatever wall used to bound it there - that wall (if
        // any) is now interior to the region and gets cleaned up, same as when a wall
        // placement first seals a region.
        removeInteriorWalls(state.board, region)

        // A region is always "completely enclosed by boundary walls" - the newly
        // claimed squares need walls on every edge that doesn't border the rest of the
        // region, same as if they'd been sealed off by the Boundary Walls action.
        // (The edge shared with the pre-expansion region is deliberately left open -
        // it's already excluded here since it's part of region.squareKeys.)
        for (const space of this.spaces) {
            for (const n of neighbors(space.col, space.row)) {
                if (!isOnBoard(n.col, n.row)) continue
                if (region.squareKeys.includes(squareKey(n.col, n.row))) continue
                if (isWalledBetween(state.board, space.col, space.row, n.col, n.row)) continue

                const wall = wallBetween(space.col, space.row, n.col, n.row)!
                state.board.walls.push(wall)
            }
        }

        // Flat rate for a direct expansion (not the region-creation table - that's
        // only for brand-new regions) - 1 power point per space, +5 per town.
        const pointsGained = this.spaces.length + townsTaken * 5
        state.getPlayerState(this.playerId).powerPoints += pointsGained

        // Invasion fallout: the defender loses points at the same flat rate for the
        // spaces directly taken, and - if that cut their region into pieces - loses
        // extra points for whatever's no longer connected to their castle, scored via
        // the region-creation table instead of the flat rate (per the rulebook's
        // "special case - neutral zone"). The invader never gains those disconnection
        // points; the disconnected piece(s) become new neutral zones.
        const invasionMetadata: NonNullable<ExpandRegionMetadata['invasions']> = []
        for (const { victimRegion, spacesLost, townsLost } of invasions.values()) {
            const directPointsLost = spacesLost.length + townsLost * 5
            const victimPlayer = state.players.find((p) => p.color === victimRegion.ownerColor)
            if (victimPlayer) {
                victimPlayer.powerPoints -= directPointsLost
            }

            const components = findConnectedComponents(victimRegion.squareKeys)
            const castleComponent = components.find((c) => c.includes(victimRegion.castleSquareKey!))
            const strandedComponents = components.filter((c) => c !== castleComponent)
            victimRegion.squareKeys = castleComponent ?? []

            let disconnectedSpaces = 0
            let disconnectedPointsLost = 0
            let disconnectedAnchorSquareKey: string | undefined
            if (strandedComponents.length > 0) {
                const strandedKeys = strandedComponents.flat()
                disconnectedSpaces = strandedKeys.length
                disconnectedPointsLost = scoreRegion({ id: '', squareKeys: strandedKeys }, state.board)
                disconnectedAnchorSquareKey = strandedKeys[0]
                if (victimPlayer) {
                    victimPlayer.powerPoints -= disconnectedPointsLost
                }
                for (const component of strandedComponents) {
                    state.regions.push({
                        id: `${this.id}-neutral-${state.regions.length}`,
                        ownerColor: undefined,
                        squareKeys: component
                    })
                }
            }

            invasionMetadata.push({
                victimColor: victimRegion.ownerColor!,
                directSpacesLost: spacesLost.length,
                directPointsLost,
                directAnchorSquareKey: spacesLost[0],
                disconnectedSpaces,
                disconnectedPointsLost,
                ...(disconnectedAnchorSquareKey ? { disconnectedAnchorSquareKey } : {})
            })
        }

        // The walls added above (around the expansion, and/or freed up by a
        // now-shrunk defender region) might have happened to also fully enclose some
        // OTHER area of the board that was never walled off before - e.g. boxing in a
        // castle+knight pair still sitting in open territory. That's the same kind of
        // event a Boundary Walls action can trigger, and by the rulebook it's scored
        // "whether it is his own [region], or one of the other prince's" - regardless
        // of who caused it - so it's detected and scored the same way here.
        const newRegions = detectNewRegions(state.board, state.regions)
        const completedRegions: NonNullable<ExpandRegionMetadata['completedRegions']> = []
        for (const newRegion of newRegions) {
            const points = newRegion.ownerColor ? scoreRegion(newRegion, state.board) : 0
            if (newRegion.ownerColor) {
                const owner = state.players.find((p) => p.color === newRegion.ownerColor)
                if (owner) {
                    owner.powerPoints += points
                }
            }
            completedRegions.push({
                ownerColor: newRegion.ownerColor,
                spaceCount: newRegion.squareKeys.length,
                townCount: countTowns(newRegion, state.board),
                points,
                anchorSquareKey: newRegion.castleSquareKey ?? newRegion.squareKeys[0]
            })
            state.regions.push(newRegion)
            removeInteriorWalls(state.board, newRegion)
        }

        // Expanding always consumes the rest of this knight action - "using this card
        // to expand twice is not allowed."
        state.knightsRemaining = 0

        this.metadata = {
            spacesTaken: this.spaces.length,
            townsTaken,
            pointsGained,
            ...(invasionMetadata.length > 0 ? { invasions: invasionMetadata } : {}),
            ...(completedRegions.length > 0 ? { completedRegions } : {})
        }
    }

    isValidExpandRegion(state: HydratedLowenherzGameState): boolean {
        return this.invalidExpandRegionReason(state) === undefined
    }

    // Same checks as isValidExpandRegion, but reports WHY a placement is rejected -
    // the client uses this to show a specific message instead of one generic one.
    invalidExpandRegionReason(state: HydratedLowenherzGameState): string | undefined {
        if (state.knightPlacingPlayerId !== this.playerId) {
            return "It isn't your turn to expand a region."
        }
        if (!state.knightsRemaining || state.knightsRemaining <= 0) {
            return "You've already used this action."
        }

        if (this.spaces.length !== 1 && this.spaces.length !== 2) {
            return 'You can only expand by 1 or 2 spaces.'
        }

        const region = state.regions.find((r) => r.id === this.regionId)
        const playerState = state.getPlayerState(this.playerId)
        if (!region || region.ownerColor !== playerState.color) {
            return "That isn't one of your regions."
        }

        const claimedKeys = [...region.squareKeys]
        for (const space of this.spaces) {
            if (!isOnBoard(space.col, space.row)) {
                return 'That square is off the board.'
            }

            const key = squareKey(space.col, space.row)
            if (claimedKeys.includes(key)) {
                return "That square is already part of the region you're expanding."
            }

            const square = getSquare(state.board, space.col, space.row)
            if (!square) {
                return 'That square is off the board.'
            }
            if (
                (square.knightColor && square.knightColor !== playerState.color) ||
                (square.castleColor && square.castleColor !== playerState.color)
            ) {
                return "You can't expand into a space with another prince's knight or castle."
            }

            const owningRegion = state.regions.find((r) => r.squareKeys.includes(key))
            if (owningRegion && owningRegion.ownerColor) {
                if (owningRegion.ownerColor === playerState.color) {
                    return "You can't merge one of your own regions into another."
                }
                if (areRegionsAllied(state.alliances, region.id, owningRegion.id)) {
                    return "An alliance protects that region from expansion - it can't be invaded while allied."
                }
                // Invading is only allowed if the invader's knights in THIS region
                // outnumber the defender's knights in the target region.
                if (countKnights(region, state.board) <= countKnights(owningRegion, state.board)) {
                    return "Your knights in this region must outnumber the target region's knights to invade it."
                }
            }

            // Unlike wall-placement or knight-placement, expansion adjacency ignores
            // walls entirely - a completed region is always fully walled in (that's
            // how it became a region), so requiring an unwalled edge here would make
            // it impossible to ever expand any real region. The wall between the
            // region and the newly-added space becomes interior once absorbed (see
            // removeInteriorWalls above), which is the correct way to model "the
            // boundary just moved."
            const isAdjacent = neighbors(space.col, space.row).some((n) =>
                claimedKeys.includes(squareKey(n.col, n.row))
            )
            if (!isAdjacent) {
                return space === this.spaces[1]
                    ? 'The second space must be adjacent to the region as extended by the first space.'
                    : "That space must be adjacent to the region you're expanding."
            }

            claimedKeys.push(key)
        }

        return undefined
    }
}
