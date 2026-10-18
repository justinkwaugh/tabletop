import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { EventEffectKind, eventDefinition } from '../components/events.js'
import { ActionType } from '../definition/actions.js'
import { homesteadSystems } from '../model/events.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { addSettlements } from '../model/settling.js'

export type PlaceHomesteaders = Type.Static<typeof PlaceHomesteaders>
export const PlaceHomesteaders = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceHomesteaders),
            playerId: Type.String(),
            systemId: Type.String()
        })
    ])
)

export const PlaceHomesteadersValidator = Compile(PlaceHomesteaders)

export function isPlaceHomesteaders(action?: GameAction): action is PlaceHomesteaders {
    return action?.type === ActionType.PlaceHomesteaders
}

const HOMESTEADERS = eventDefinition('homesteaders').effect

// Homesteaders: each Player it favours adds its settlements to one of their bases.
export class HydratedPlaceHomesteaders
    extends HydratableAction<typeof PlaceHomesteaders>
    implements PlaceHomesteaders
{
    declare type: ActionType.PlaceHomesteaders
    declare playerId: string
    declare systemId: string

    constructor(data: PlaceHomesteaders) {
        super(data, PlaceHomesteadersValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (
            state.homesteaders[0] !== this.playerId ||
            !homesteadSystems(state, this.playerId).includes(this.systemId) ||
            HOMESTEADERS.kind !== EventEffectKind.Homesteaders
        ) {
            throw Error('Invalid PlaceHomesteaders action')
        }
        addSettlements(state, this.playerId, this.systemId, HOMESTEADERS.settlements)
        state.homesteaders = state.homesteaders.slice(1)
    }
}
