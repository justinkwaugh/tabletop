import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { isLayTrackSpace, type CompanyId, type LayTrackSpace } from '../editions/types.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { Placement, PlacementEffect } from '../model/track.js'

export type LayTrackMetadata = Type.Static<typeof LayTrackMetadata>
export const LayTrackMetadata = Type.Object({
    effects: Type.Array(PlacementEffect)
})

export type LayTrack = Type.Static<typeof LayTrack>
export const LayTrack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.LayTrack),
            playerId: Type.String(),
            metadata: Type.Optional(LayTrackMetadata),
            placements: Type.Array(Placement)
        })
    ])
)

export const LayTrackValidator = Compile(LayTrack)

export function isLayTrack(action?: GameAction): action is LayTrack {
    return action?.type === ActionType.LayTrack
}

export class HydratedLayTrack extends HydratableAction<typeof LayTrack> implements LayTrack {
    declare type: ActionType.LayTrack
    declare playerId: string
    declare metadata?: LayTrackMetadata
    declare placements: Placement[]

    constructor(data: LayTrack) {
        super(data, LayTrackValidator)
    }

    apply(state: HydratedRailheadsGameState, _context?: MachineContext) {
        const space = state.activeSpace
        assert(space !== undefined && isLayTrackSpace(space), 'No Lay Track action is being taken')
        HydratedLayTrack.assertWithinLimits(state, this.playerId, space, this.placements)
        const effects = this.placements.map((placement) =>
            state.placeTrack(this.playerId, space, placement)
        )
        this.metadata = { effects }
    }

    static companiesIn(placements: readonly Placement[]): CompanyId[] {
        return [...new Set(placements.map((placement) => placement.companyId))]
    }

    static assertWithinLimits(
        state: HydratedRailheadsGameState,
        playerId: string,
        space: LayTrackSpace,
        placements: readonly Placement[]
    ) {
        const rules = state.layTrackRules(space)
        const companies = HydratedLayTrack.companiesIn(placements)
        const buildable = state.buildableCompanies(playerId, space)
        assert(companies.length <= rules.maxCompanies, 'Too many companies for this action')
        for (const companyId of companies) {
            assert(buildable.includes(companyId), `You cannot build for ${companyId}`)
            assert(
                placements.filter((placement) => placement.companyId === companyId).length <=
                    rules.placementsPerCompany,
                `Too many pieces for ${companyId}`
            )
        }
    }

    static canLay(state: HydratedRailheadsGameState, playerId: string): boolean {
        return state.turnPlayerId() === playerId && state.isLayTrackTurn()
    }
}
