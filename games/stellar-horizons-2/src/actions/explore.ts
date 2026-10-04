import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ExplorationResult, canExplore, explore } from '../model/exploration.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnStep } from '../model/turn.js'

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
        if (
            !ship ||
            state.getPlayerState(this.playerId).step !== TurnStep.Exploration ||
            !canExplore(state, ship)
        ) {
            throw Error('Invalid Explore action')
        }
        const result = explore(state, ship)
        if (result.survey) {
            state.pendingSurveys.push({
                playerId: this.playerId,
                shipId: this.shipId,
                systemId: result.systemId
            })
        }
        this.metadata = result
        this.revealsInfo = true
    }

    static canExplore(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        return (
            state.getPlayerState(playerId).step === TurnStep.Exploration &&
            state.shipsOf(playerId).some((ship) => canExplore(state, ship))
        )
    }
}
