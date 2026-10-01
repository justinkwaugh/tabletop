import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { reasonCannotResolveOathkeeperChoice, resolveOathkeeperChoice } from '../util/title.js'

export type ResolveOathkeeperMetadata = Type.Static<typeof ResolveOathkeeperMetadata>
export const ResolveOathkeeperMetadata = Type.Object({
    // Carried on the action because the engine writes machineState after onAction returns.
    resumeMachineState: Type.Enum(MachineState)
})

export type ResolveOathkeeper = Type.Static<typeof ResolveOathkeeper>
export const ResolveOathkeeper = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ResolveOathkeeper),
            playerId: Type.String(),
            chosenPlayerId: Type.String(),
            metadata: Type.Optional(ResolveOathkeeperMetadata)
        })
    ])
)

export const ResolveOathkeeperValidator = Compile(ResolveOathkeeper)

export function isResolveOathkeeper(action?: GameAction): action is ResolveOathkeeper {
    return action?.type === ActionType.ResolveOathkeeper
}

export class HydratedResolveOathkeeper
    extends HydratableAction<typeof ResolveOathkeeper>
    implements ResolveOathkeeper
{
    declare type: ActionType.ResolveOathkeeper
    declare playerId: string
    declare chosenPlayerId: string
    declare metadata?: ResolveOathkeeperMetadata

    constructor(data: ResolveOathkeeper) {
        super(data, ResolveOathkeeperValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const resumeMachineState = resolveOathkeeperChoice(
            state,
            this.playerId,
            this.chosenPlayerId
        )
        this.metadata = { resumeMachineState }
    }

    static reasonCannotResolveOathkeeper(
        state: HydratedOathGameState,
        playerId: string,
        chosenPlayerId: string
    ): string | undefined {
        return reasonCannotResolveOathkeeperChoice(state, playerId, chosenPlayerId)
    }

    static canDoResolveOathkeeper(state: HydratedOathGameState, playerId: string): boolean {
        return state.pendingOathkeeperChoice?.holderPlayerId === playerId
    }
}
