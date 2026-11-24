import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { RegionIds, type RegionId } from '../data/regionTiles.js'
import { LastEpoch } from '../data/tracks.js'
import { ActionType } from '../definition/actions.js'
import { markRevealsInfo } from '../definition/revealing.js'
import { beginPhase, PhaseName } from '../definition/phases.js'
import { triggeredEpoch } from '../model/epochConditions.js'
import { TriggeredEpoch } from '../model/flow.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { legalStackRegions, removeTopTile } from '../model/regionStacks.js'
import { LandscapeKindSchema, TileIdSchema } from '../model/stateSchemas.js'

const RegionIdSchema = Type.Enum(RegionIds)

export type RollProgressDieMetadata = Type.Static<typeof RollProgressDieMetadata>
export const RollProgressDieMetadata = Type.Object({
    /** R-4.11.1 Every face in order, the last the one that counted; empty: the die wasn't rolled. */
    faces: Type.Array(RegionIdSchema),
    /** R-4.11.1, R-4.11-H2 */
    removed: Type.Optional(
        Type.Object({
            region: RegionIdSchema,
            tileId: TileIdSchema,
            landscape: LandscapeKindSchema
        })
    ),
    /** R-4.11.2 */
    epochTriggered: Type.Optional(TriggeredEpoch)
})

export type RollProgressDie = Type.Static<typeof RollProgressDie>
export const RollProgressDie = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source']),
        Type.Object({
            type: Type.Literal(ActionType.RollProgressDie),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(RollProgressDieMetadata)
        })
    ])
)

export const RollProgressDieValidator = Compile(RollProgressDie)

export function isRollProgressDie(action?: GameAction): action is RollProgressDie {
    return action?.type === ActionType.RollProgressDie
}

export class HydratedRollProgressDie
    extends HydratableAction<typeof RollProgressDie>
    implements RollProgressDie
{
    declare type: ActionType.RollProgressDie
    declare source: ActionSource.System
    declare metadata?: RollProgressDieMetadata

    constructor(data: RollProgressDie) {
        super(data, RollProgressDieValidator)
    }

    /** R-4.11.1, R-4.11.2, R-X.2 A roll is a barrier; with no roll nothing was revealed. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        beginPhase(state, PhaseName.Progress)
        const faces = HydratedRollProgressDie.rollFaces(state)
        const removed = HydratedRollProgressDie.removeRolledTile(state, faces.at(-1))
        if (removed) {
            markRevealsInfo(this, true)
        }
        const epochTriggered = HydratedRollProgressDie.triggerNextEpoch(state)
        this.metadata = {
            faces,
            ...(removed ? { removed } : {}),
            ...(epochTriggered ? { epochTriggered } : {})
        }
    }

    /** R-4.11.1, R-6.1-H1 On the protected stream. */
    private static rollFaces(state: HydratedFeudumGameState): RegionId[] {
        const legal = legalStackRegions(state)
        if (legal.length === 0 || triggeredEpoch(state)?.epoch === LastEpoch) {
            return []
        }
        const { randInt } = state.getProtectedPrng()
        const faces: RegionId[] = []
        let face: RegionId
        do {
            face = RegionIds[randInt(RegionIds.length)]
            faces.push(face)
        } while (!legal.includes(face))
        return faces
    }

    /** R-4.11.1, R-4.11-H2 The tile the last face shows leaves the game, its landscape shown. */
    private static removeRolledTile(
        state: HydratedFeudumGameState,
        region: RegionId | undefined
    ): RollProgressDieMetadata['removed'] {
        if (!region) {
            return undefined
        }
        const { tile, landscape } = removeTopTile(state, region)
        return { region, tileId: tile.id, landscape }
    }

    /** R-4.11.2, R-4.11-H1 Only here, and one epoch at a time. The first epoch is never next. */
    private static triggerNextEpoch(state: HydratedFeudumGameState): TriggeredEpoch | undefined {
        const next = triggeredEpoch(state)?.id
        const triggered = next === 'track.epoch.i' ? undefined : next
        state.flow.epochTriggered = triggered
        return triggered
    }
}
