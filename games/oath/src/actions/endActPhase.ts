import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { reasonNotYourTurn } from '../util/turn.js'

export type EndActPhase = Type.Static<typeof EndActPhase>
export const EndActPhase = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndActPhase),
            playerId: Type.String()
        })
    ])
)

export const EndActPhaseValidator = Compile(EndActPhase)

export function isEndActPhase(action?: GameAction): action is EndActPhase {
    return action?.type === ActionType.EndActPhase
}

export class HydratedEndActPhase
    extends HydratableAction<typeof EndActPhase>
    implements EndActPhase
{
    declare type: ActionType.EndActPhase
    declare playerId: string

    constructor(data: EndActPhase) {
        super(data, EndActPhaseValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedEndActPhase.reasonCannotEndActPhase(state, this.playerId)
        if (reason) {
            throw Error(`Cannot end the Act Phase: ${reason}`)
        }
        // R-4.3 — the Rest Phase runs on entering RestPhase.
    }

    static reasonCannotEndActPhase(
        state: HydratedOathGameState,
        playerId: string
    ): string | undefined {
        return reasonNotYourTurn(state, playerId)
    }

    // R-4.2 allows zero actions, so ending the Act Phase is always available.
    static canDoEndActPhase(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedEndActPhase.reasonCannotEndActPhase(state, playerId) === undefined
    }
}
