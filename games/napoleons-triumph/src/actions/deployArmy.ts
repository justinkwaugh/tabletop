import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, Visibility } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { Deployment, deployArmy } from '../model/setup.js'

export type DeployArmy = Type.Static<typeof DeployArmy>
export const DeployArmy = Visibility.protectAction(
    Type.Evaluate(
        Type.Intersect([
            Type.Omit(GameAction, ['playerId']),
            Type.Object({
                type: Type.Literal(ActionType.DeployArmy),
                playerId: Type.String(),
                deployment: Deployment
            })
        ])
    ),
    { policy: Visibility.Policy.Actor }
)

export const DeployArmyValidator = Compile(DeployArmy)

export function isDeployArmy(action?: GameAction): action is DeployArmy {
    return action?.type === ActionType.DeployArmy
}

export class HydratedDeployArmy extends HydratableAction<typeof DeployArmy> implements DeployArmy {
    declare type: ActionType.DeployArmy
    declare playerId: string
    declare deployment: Deployment

    constructor(data: DeployArmy) {
        super(data, DeployArmyValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        deployArmy(state, this.playerId, this.deployment)
    }
}
