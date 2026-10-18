import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import {
    anomalyDifficulty,
    attemptStrength,
    attemptableSystemIds,
    commitAnomalyAttempt,
    isValidAnomalyAttempt
} from '../model/anomalies.js'
import { anomalyDefinition } from '../components/anomalies.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type AttemptAnomalyMetadata = Type.Static<typeof AttemptAnomalyMetadata>
export const AttemptAnomalyMetadata = Type.Object({
    anomalyId: Type.String(),
    strength: Type.Number(),
    difficulty: Type.Number()
})

export type AttemptAnomaly = Type.Static<typeof AttemptAnomaly>
export const AttemptAnomaly = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AttemptAnomaly),
            playerId: Type.String(),
            systemId: Type.String(),
            shipIds: Type.Array(Type.String()),
            metadata: Type.Optional(AttemptAnomalyMetadata)
        })
    ])
)

export const AttemptAnomalyValidator = Compile(AttemptAnomaly)

export function isAttemptAnomaly(action?: GameAction): action is AttemptAnomaly {
    return action?.type === ActionType.AttemptAnomaly
}

export class HydratedAttemptAnomaly
    extends HydratableAction<typeof AttemptAnomaly>
    implements AttemptAnomaly
{
    declare type: ActionType.AttemptAnomaly
    declare playerId: string
    declare systemId: string
    declare shipIds: string[]
    declare metadata?: AttemptAnomalyMetadata

    constructor(data: AttemptAnomaly) {
        super(data, AttemptAnomalyValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (!isValidAnomalyAttempt(state, this.playerId, this.systemId, this.shipIds)) {
            throw Error('Invalid AttemptAnomaly action')
        }
        const ships = this.shipIds.map((shipId) => state.ship(shipId))
        const attempt = commitAnomalyAttempt(state, this.playerId, this.systemId, this.shipIds)
        this.metadata = {
            anomalyId: attempt.anomalyId,
            strength: attemptStrength(ships, anomalyDefinition(attempt.anomalyId).challenge),
            difficulty: anomalyDifficulty(state, attempt.anomalyId, this.playerId)
        }
    }

    static canAttemptAnomaly(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        return attemptableSystemIds(state, playerId).length > 0
    }
}
