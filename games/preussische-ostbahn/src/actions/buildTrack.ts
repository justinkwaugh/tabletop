import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RailroadId } from '../components/railroads.js'
import type { HydratedOstbahnGameState } from '../model/gameState.js'
import { canBuild, tallyAfter, trackCharge } from '../model/expansion.js'
import { directConnections } from '../model/network.js'

export type BuildTrackMetadata = Type.Static<typeof BuildTrackMetadata>
export const BuildTrackMetadata = Type.Object({
    charge: Type.Number(),
    incomeBefore: Type.Optional(Type.Number())
})

export type BuildTrack = Type.Static<typeof BuildTrack>
export const BuildTrack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuildTrack),
            playerId: Type.String(),
            metadata: Type.Optional(BuildTrackMetadata),
            railroadId: Type.Enum(RailroadId),
            spaceId: Type.String()
        })
    ])
)

export const BuildTrackValidator = Compile(BuildTrack)

export function isBuildTrack(action?: GameAction): action is BuildTrack {
    return action?.type === ActionType.BuildTrack
}

export class HydratedBuildTrack extends HydratableAction<typeof BuildTrack> implements BuildTrack {
    declare type: ActionType.BuildTrack
    declare playerId: string
    declare metadata?: BuildTrackMetadata
    declare railroadId: RailroadId
    declare spaceId: string

    constructor(data: BuildTrack) {
        super(data, BuildTrackValidator)
    }

    apply(state: HydratedOstbahnGameState, _context?: MachineContext) {
        const expansion = state.expansion
        if (expansion) {
            assert(state.isExpanding(this.playerId), 'It is not your Expansion')
            assert(
                expansion.railroadId === this.railroadId,
                'This Expansion builds for another railroad'
            )
        } else {
            assert(state.isSlotPlayer(this.playerId), 'It is not your turn')
            assert(
                state.sharesHeld(this.railroadId, this.playerId) > 0,
                'You must hold a share of that railroad'
            )
        }
        const tally = state.expansionTally(this.railroadId)
        assert(
            canBuild(state.railroads, this.railroadId, this.spaceId, tally),
            'That track cannot be built'
        )
        const charge = trackCharge(state.railroads, this.railroadId, this.spaceId, tally)
        const next = tallyAfter(state.railroads, this.railroadId, this.spaceId, tally)
        const railroad = state.railroad(this.railroadId)
        const started = expansion ?? {
            railroadId: this.railroadId,
            built: [],
            spent: 0,
            freeRuralCost: 0,
            connectedBefore: directConnections(state.railroads, this.railroadId)
        }
        const incomeBefore = expansion ? undefined : state.income(this.railroadId)
        railroad.track.push(this.spaceId)
        railroad.treasury -= charge
        state.expansion = {
            ...started,
            built: [...started.built, this.spaceId],
            spent: next.spent,
            freeRuralCost: next.freeRuralCost
        }
        this.metadata = { charge, ...(incomeBefore !== undefined ? { incomeBefore } : {}) }
    }

    static canBuild(state: HydratedOstbahnGameState, playerId: string): boolean {
        if (state.expansion) {
            return (
                state.isExpanding(playerId) &&
                state.buildChoices(state.expansion.railroadId).length > 0
            )
        }
        return state.isSlotPlayer(playerId) && state.expandableRailroads(playerId).length > 0
    }
}
