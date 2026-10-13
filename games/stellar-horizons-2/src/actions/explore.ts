import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import {
    ExplorationResult,
    canExplore,
    canExploreAnyShip,
    explore
} from '../model/exploration.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type Explore = Type.Static<typeof Explore>
export const Explore = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Explore),
            playerId: Type.String(),
            shipId: Type.String(),
            metadata: Type.Optional(ExplorationResult)
        })
    ])
)

export const ExploreValidator = Compile(Explore)

export function isExplore(action?: GameAction): action is Explore {
    return action?.type === ActionType.Explore
}

export class HydratedExplore extends HydratableAction<typeof Explore> implements Explore {
    declare type: ActionType.Explore
    declare playerId: string
    declare shipId: string
    declare metadata?: ExplorationResult

    constructor(data: Explore) {
        super(data, ExploreValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const ship = state.playerShip(this.playerId, this.shipId)
        if (!ship || !canExplore(state, ship)) {
            throw Error('Invalid Explore action')
        }
        this.metadata = explore(state, ship)
        this.revealsInfo = true
    }

    static canExplore(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        return canExploreAnyShip(state, playerId)
    }
}
