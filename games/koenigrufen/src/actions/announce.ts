import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Bonus, BonusSchema, DoubleTarget, MaxDoubles, SideSchema } from '../model/announcements.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

// Announcing for a side tells everyone which side the speaker is on.
export type AnnounceResult = Type.Static<typeof AnnounceResult>
export const AnnounceResult = Type.Object({
    side: SideSchema,
    // How far each double went: 1 Kontra, 2 Re, 3 Sub.
    doubleLevels: Type.Array(Type.Integer({ minimum: 1, maximum: MaxDoubles }))
})

// One turn of the announcements: bonuses for the speaker's side and Kontras (or Re, Sub). Saying
// nothing passes.
export type Announce = Type.Static<typeof Announce>
export const Announce = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Announce),
            playerId: Type.String(),
            bonuses: Type.Array(BonusSchema),
            doubles: Type.Array(DoubleTarget),
            metadata: Type.Optional(AnnounceResult)
        })
    ])
)

export const AnnounceValidator = Compile(Announce)

export function isAnnounce(action?: GameAction): action is Announce {
    return action?.type === ActionType.Announce
}

export class HydratedAnnounce extends HydratableAction<typeof Announce> implements Announce {
    declare type: ActionType.Announce
    declare playerId: string
    declare bonuses: Bonus[]
    declare doubles: DoubleTarget[]
    declare metadata?: AnnounceResult

    constructor(data: Announce) {
        super(data, AnnounceValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        const result = state.announce(this.playerId, this.bonuses, this.doubles)
        if (this.bonuses.length > 0 || this.doubles.length > 0) {
            this.metadata = result
        }
    }
}
