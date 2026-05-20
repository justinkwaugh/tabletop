import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedUrbinoGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type ChooseFirstPlayerMetadata = Type.Static<typeof ChooseFirstPlayerMetadata>
export const ChooseFirstPlayerMetadata = Type.Object({})

export type ChooseFirstPlayer = Type.Static<typeof ChooseFirstPlayer>
export const ChooseFirstPlayer = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseFirstPlayer),
            playerId: Type.String(),
            startingPlayerId: Type.String(),
            metadata: Type.Optional(ChooseFirstPlayerMetadata),
        })
    ])
)

export const ChooseFirstPlayerValidator = Compile(ChooseFirstPlayer)

export function isChooseFirstPlayer(action?: GameAction): action is ChooseFirstPlayer {
    return action?.type === ActionType.ChooseFirstPlayer
}

export class HydratedChooseFirstPlayer
    extends HydratableAction<typeof ChooseFirstPlayer>
    implements ChooseFirstPlayer
{
    declare type: ActionType.ChooseFirstPlayer
    declare playerId: string
    declare startingPlayerId: string
    declare metadata?: ChooseFirstPlayerMetadata

    constructor(data: ChooseFirstPlayer) {
        super(data, ChooseFirstPlayerValidator)
    }

    apply(state: HydratedUrbinoGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid ChooseFirstPlayer action')
        }
        this.metadata = {}
    }

    isValid(state: HydratedUrbinoGameState): boolean {
        return state.players.some((p) => p.playerId === this.startingPlayerId)
    }
}
