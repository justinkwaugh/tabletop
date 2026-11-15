import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { chronicleOf, reasonCannotOfferChronicleCitizenship } from '../util/chronicleChoices.js'

/**
 * R-8.2 — an Exile winner's offers, made together (R-8.2-H1); an empty list offers no one. R-6.6.1's
 * terms, Scepter and Reliquary play no part.
 */
export type OfferChronicleCitizenship = Type.Static<typeof OfferChronicleCitizenship>
export const OfferChronicleCitizenship = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.OfferChronicleCitizenship),
            playerId: Type.String(),
            exilePlayerIds: Type.Array(Type.String(), { maxItems: 8 })
        })
    ])
)

export const OfferChronicleCitizenshipValidator = Compile(OfferChronicleCitizenship)

export function isOfferChronicleCitizenship(
    action?: GameAction
): action is OfferChronicleCitizenship {
    return action?.type === ActionType.OfferChronicleCitizenship
}

export class HydratedOfferChronicleCitizenship
    extends HydratableAction<typeof OfferChronicleCitizenship>
    implements OfferChronicleCitizenship
{
    declare type: ActionType.OfferChronicleCitizenship
    declare playerId: string
    declare exilePlayerIds: string[]

    constructor(data: OfferChronicleCitizenship) {
        super(data, OfferChronicleCitizenshipValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = reasonCannotOfferChronicleCitizenship(
            state,
            this.playerId,
            this.exilePlayerIds
        )
        if (reason) throw Error(reason)
        this.revealsInfo = false
        const citizenship = chronicleOf(state).citizenship
        assertExists(citizenship, 'R-8.2 — the Citizen boards flipped before the offers')
        citizenship.offers = this.exilePlayerIds.map((playerId) => ({ playerId }))
    }

    static canDoOfferChronicleCitizenship(state: HydratedOathGameState, playerId: string): boolean {
        return reasonCannotOfferChronicleCitizenship(state, playerId, []) === undefined
    }
}
