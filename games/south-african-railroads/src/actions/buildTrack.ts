import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RailroadId } from '../maps/types.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { Payout, payShareholders } from '../model/payouts.js'
import { homeLinks } from '../model/track.js'

// Paid to a railroad's shareholders when its track first reaches the metro railroad's home, or
// to the metro railroad's when its track first meets another's.
export type BuildSpecialDividend = Type.Static<typeof BuildSpecialDividend>
export const BuildSpecialDividend = Type.Object({
    railroadId: Type.Enum(RailroadId),
    perShare: Type.Number(),
    payouts: Type.Array(Payout)
})

export type BuildTrackMetadata = Type.Static<typeof BuildTrackMetadata>
export const BuildTrackMetadata = Type.Object({
    cost: Type.Number(),
    income: Type.Number(),
    opensRailroad: Type.Optional(Type.Enum(RailroadId)),
    specialDividends: Type.Optional(Type.Array(BuildSpecialDividend))
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
            linkIds: Type.Array(Type.String(), { minItems: 1, maxItems: 2 })
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
    declare linkIds: string[]

    constructor(data: BuildTrack) {
        super(data, BuildTrackValidator)
    }

    apply(state: HydratedSarGameState, _context?: MachineContext) {
        const free = state.freeBuild !== undefined
        const cost = free ? this.validateFreeBuild(state) : this.validatePaidBuild(state)
        const opensRailroad = free ? undefined : state.railroadOpenedBy(this.linkIds)
        const milestones = state.metroMilestones()
        state.railroad(this.railroadId).treasury -= cost
        for (const linkId of this.linkIds) {
            state.track.push({ linkId, railroadId: this.railroadId })
        }
        state.freeBuild = undefined
        state.delegation = undefined
        const specialDividends = state.metroSpecialDividendEarners(milestones).map((railroadId) => {
            const perShare = state.specialDividendPerShare(railroadId)
            return {
                railroadId,
                perShare,
                payouts: payShareholders(state, [{ railroadId, perShare }])
            }
        })
        this.metadata = {
            cost,
            income: state.income(this.railroadId),
            ...(opensRailroad ? { opensRailroad } : {}),
            ...(specialDividends.length > 0 ? { specialDividends } : {})
        }
    }

    private validateFreeBuild(state: HydratedSarGameState): number {
        const due = state.freeBuild
        assert(
            due?.playerId === this.playerId && due.railroadId === this.railroadId,
            'This free build belongs to another railroad'
        )
        assert(
            this.linkIds.length === 1 &&
                homeLinks(state, state.map.home(this.railroadId)).includes(this.linkIds[0]),
            'The free link must leave the railroad’s home'
        )
        return 0
    }

    private validatePaidBuild(state: HydratedSarGameState): number {
        assert(
            state.builderRailroads(this.playerId).includes(this.railroadId),
            'You cannot build for this railroad'
        )
        if (this.linkIds.length === 1) {
            assert(
                state.singleBuilds(this.railroadId).includes(this.linkIds[0]),
                'That link cannot be built'
            )
            return state.linkCost(this.railroadId)
        }
        assert(
            state
                .doubleBuilds(this.railroadId)
                .some(([first, second]) => first === this.linkIds[0] && second === this.linkIds[1]),
            'Those links cannot be built together'
        )
        return state.doubleLinkCost(this.railroadId)
    }

    static canBuild(state: HydratedSarGameState, playerId: string): boolean {
        if (state.freeBuild) {
            return state.freeBuild.playerId === playerId
        }
        return state
            .builderRailroads(playerId)
            .some((railroadId) => state.singleBuilds(railroadId).length > 0)
    }
}
