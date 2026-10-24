import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import {
    HitOutcome,
    HitTarget,
    assignHit,
    hitChooser,
    isValidHitTarget,
    settleForcedHits
} from '../model/hits.js'
import { drewMarkers } from '../model/fleet.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type AssignHitMetadata = Type.Static<typeof AssignHitMetadata>
export const AssignHitMetadata = Type.Object({ hits: Type.Array(HitOutcome) })

export type AssignHit = Type.Static<typeof AssignHit>
export const AssignHit = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AssignHit),
            playerId: Type.String(),
            target: HitTarget,
            metadata: Type.Optional(AssignHitMetadata)
        })
    ])
)

export const AssignHitValidator = Compile(AssignHit)

export function isAssignHit(action?: GameAction): action is AssignHit {
    return action?.type === ActionType.AssignHit
}

// One hit, chosen by whoever's turn it is to choose; the hits after it that leave no choice are
// placed with it.
export class HydratedAssignHit extends HydratableAction<typeof AssignHit> implements AssignHit {
    declare type: ActionType.AssignHit
    declare playerId: string
    declare target: HitTarget
    declare metadata?: AssignHitMetadata

    constructor(data: AssignHit) {
        super(data, AssignHitValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const combat = state.combat
        if (
            !combat ||
            hitChooser(combat) !== this.playerId ||
            !isValidHitTarget(state, this.target)
        ) {
            throw Error('Invalid AssignHit action')
        }
        const chosen = assignHit(state, this.target, this.playerId)
        this.metadata = { hits: [chosen, ...settleForcedHits(state)] }
        this.revealsInfo = this.metadata.hits.some((hit) => drewMarkers(hit.lost))
    }
}
