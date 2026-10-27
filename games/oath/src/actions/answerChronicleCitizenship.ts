import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    acceptChronicleCitizenship,
    chronicleOf,
    reasonCannotAnswerChronicleCitizenship
} from '../util/chronicleChoices.js'

export type AnswerChronicleCitizenshipMetadata = Type.Static<
    typeof AnswerChronicleCitizenshipMetadata
>
export const AnswerChronicleCitizenshipMetadata = Type.Object({
    /** R-8.2 — the sites where the accepter's warbands became one of the winner's. */
    siteIds: Type.Array(Type.String())
})

/** R-8.2, R-X.1 — an offered Exile's own answer; the others answer on their own, in any order (R-8.2-H1). */
export type AnswerChronicleCitizenship = Type.Static<typeof AnswerChronicleCitizenship>
export const AnswerChronicleCitizenship = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AnswerChronicleCitizenship),
            playerId: Type.String(),
            accept: Type.Boolean(),
            metadata: Type.Optional(AnswerChronicleCitizenshipMetadata)
        })
    ])
)

export const AnswerChronicleCitizenshipValidator = Compile(AnswerChronicleCitizenship)

export function isAnswerChronicleCitizenship(
    action?: GameAction
): action is AnswerChronicleCitizenship {
    return action?.type === ActionType.AnswerChronicleCitizenship
}

export class HydratedAnswerChronicleCitizenship
    extends HydratableAction<typeof AnswerChronicleCitizenship>
    implements AnswerChronicleCitizenship
{
    declare type: ActionType.AnswerChronicleCitizenship
    declare playerId: string
    declare accept: boolean
    declare metadata?: AnswerChronicleCitizenshipMetadata

    constructor(data: AnswerChronicleCitizenship) {
        super(data, AnswerChronicleCitizenshipValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = reasonCannotAnswerChronicleCitizenship(state, this.playerId)
        if (reason) throw Error(reason)
        this.revealsInfo = false
        const offer = chronicleOf(state).citizenship?.offers?.find(
            (open) => open.playerId === this.playerId
        )
        assertExists(offer, `R-8.2 — an offer is open to ${this.playerId}`)
        offer.accepted = this.accept
        this.metadata = {
            siteIds: this.accept ? acceptChronicleCitizenship(state, this.playerId) : []
        }
    }

    static canDoAnswerChronicleCitizenship(
        state: HydratedOathGameState,
        playerId: string
    ): boolean {
        return reasonCannotAnswerChronicleCitizenship(state, playerId) === undefined
    }
}
