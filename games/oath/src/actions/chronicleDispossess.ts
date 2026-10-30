import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { chronicleOf } from '../util/chronicleChoices.js'
import { dispossess } from '../util/chronicleCards.js'

/** How many cards went to the Dispossessed (R-9.3: as many as there were). */
export type ChronicleDispossessMetadata = Type.Static<typeof ChronicleDispossessMetadata>
export const ChronicleDispossessMetadata = Type.Object({ count: Type.Number() })

/** R-8.5 — the Visions set aside; six of the piles and the losers' advisers to the Dispossessed, unseen. */
export type ChronicleDispossess = Type.Static<typeof ChronicleDispossess>
export const ChronicleDispossess = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChronicleDispossess),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(ChronicleDispossessMetadata)
        })
    ])
)

export const ChronicleDispossessValidator = Compile(ChronicleDispossess)

export function isChronicleDispossess(action?: GameAction): action is ChronicleDispossess {
    return action?.type === ActionType.ChronicleDispossess
}

export class HydratedChronicleDispossess
    extends HydratableAction<typeof ChronicleDispossess>
    implements ChronicleDispossess
{
    declare type: ActionType.ChronicleDispossess
    declare source: ActionSource.System
    declare metadata?: ChronicleDispossessMetadata

    constructor(data: ChronicleDispossess) {
        super(data, ChronicleDispossessValidator)
    }

    /** R-X.3 — the pool is shuffled before six are taken. */
    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = true
        const count = dispossess(state)
        chronicleOf(state).dispossessed = count
        this.metadata = { count }
    }
}
