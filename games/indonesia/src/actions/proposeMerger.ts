import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type ProposeMergerMetadata = Type.Static<typeof ProposeMergerMetadata>
export const ProposeMergerMetadata = Type.Object({
})

export type ProposeMerger = Type.Static<typeof ProposeMerger>
export const ProposeMerger = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.ProposeMerger), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(ProposeMergerMetadata) // Always optional, because it is an output
        })
    ])
)

export const ProposeMergerValidator = Compile(ProposeMerger)

export function isProposeMerger(action?: GameAction): action is ProposeMerger {
    return action?.type === ActionType.ProposeMerger
}

export class HydratedProposeMerger extends HydratableAction<typeof ProposeMerger> implements ProposeMerger {
    declare type: ActionType.ProposeMerger
    declare playerId: string
    declare metadata?: ProposeMergerMetadata

    constructor(data: ProposeMerger) {
        super(data, ProposeMergerValidator)
    }

    apply(state: HydratedIndonesiaGameState, context?: MachineContext) {
        if (!this.isValidProposeMerger(state)) {
            throw Error('Invalid ProposeMerger action')
        }

        this.metadata = {}
    }

    isValidProposeMerger(state: HydratedIndonesiaGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        return true
    }

    static canProposeMerger(state: HydratedIndonesiaGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return true
    }
}
