import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolPlayerState } from '../model/playerState.js'
import { MachineState } from '../definition/states.js'

export type HurlMetadata = Static<typeof HurlMetadata>
export const HurlMetadata = Type.Object({})

export type Hurl = Static<typeof Hurl>
export const Hurl = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.Hurl),
        playerId: Type.String(),
        sundiverId: Type.String(),
        start: OffsetCoordinates,
        metadata: Type.Optional(HurlMetadata)
    })
])

export const HurlValidator = TypeCompiler.Compile(Hurl)

export function isHurl(action?: GameAction): action is Hurl {
    return action?.type === ActionType.Hurl
}

export class HydratedHurl extends HydratableAction<typeof Hurl> implements Hurl {
    declare type: ActionType.Hurl
    declare playerId: string
    declare sundiverId: string
    declare start: OffsetCoordinates
    declare metadata?: HurlMetadata

    constructor(data: Hurl) {
        super(data, HurlValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)
    }
}
