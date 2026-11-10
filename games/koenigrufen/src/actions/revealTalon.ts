import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { CardIdSchema } from '../components/cards.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export type RevealedTalon = Type.Static<typeof RevealedTalon>
export const RevealedTalon = Type.Object({ halves: Type.Array(Type.Array(CardIdSchema)) })

// The talon is turned face up in two halves of three.
export type RevealTalon = Type.Static<typeof RevealTalon>
export const RevealTalon = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.RevealTalon),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(RevealedTalon)
        })
    ])
)

export const RevealTalonValidator = Compile(RevealTalon)

export function isRevealTalon(action?: GameAction): action is RevealTalon {
    return action?.type === ActionType.RevealTalon
}

export class HydratedRevealTalon
    extends HydratableAction<typeof RevealTalon>
    implements RevealTalon
{
    declare type: ActionType.RevealTalon
    declare revealsInfo: true
    declare metadata?: RevealedTalon

    constructor(data: RevealTalon) {
        super(data, RevealTalonValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        this.metadata = { halves: state.revealTalon() }
    }
}
