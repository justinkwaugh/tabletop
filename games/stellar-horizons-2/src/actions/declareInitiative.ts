import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { EscalationMarker } from '../components/escalation.js'
import { ActionType } from '../definition/actions.js'
import { maxInitiativeBid } from '../model/economy.js'
import { choosesEscalationKept, isValidEscalationKept } from '../model/escalation.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type DeclareInitiative = Type.Static<typeof DeclareInitiative>
export const DeclareInitiative = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclareInitiative),
            playerId: Type.String(),
            influence: Type.Number(),
            // The escalation markers to keep when half are discarded after the rolls.
            kept: Type.Optional(Type.Array(Type.Enum(EscalationMarker)))
        })
    ])
)

export const DeclareInitiativeValidator = Compile(DeclareInitiative)

export function isDeclareInitiative(action?: GameAction): action is DeclareInitiative {
    return action?.type === ActionType.DeclareInitiative
}

// Rulebook 4.1: each Player declares the IP they will spend on their roll before anyone rolls,
// and chooses the escalation markers they will keep once the rolls are made (campaign plan,
// slice 5, Q3).
export class HydratedDeclareInitiative
    extends HydratableAction<typeof DeclareInitiative>
    implements DeclareInitiative
{
    declare type: ActionType.DeclareInitiative
    declare playerId: string
    declare influence: number
    declare kept?: EscalationMarker[]

    constructor(data: DeclareInitiative) {
        super(data, DeclareInitiativeValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        if (
            !Number.isInteger(this.influence) ||
            this.influence < 0 ||
            this.influence > maxInitiativeBid(state, this.playerId) ||
            player.initiativeBid !== undefined ||
            (choosesEscalationKept(player)
                ? this.kept === undefined || !isValidEscalationKept(player, this.kept)
                : this.kept !== undefined)
        ) {
            throw Error('Invalid DeclareInitiative action')
        }
        player.influence -= this.influence
        player.initiativeBid = this.influence
        if (this.kept) {
            player.escalationKept = [...this.kept]
        }
    }
}
