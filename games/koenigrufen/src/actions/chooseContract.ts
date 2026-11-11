import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Contract, ContractSchema } from '../components/contracts.js'
import { ActionType } from '../definition/actions.js'
import { Bonus, BonusSchema } from '../model/announcements.js'
import { bidChoice } from '../model/auction.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

// After "Mein Spiel" is passed out, Forehand names any contract.
export type ChooseContract = Type.Static<typeof ChooseContract>
export const ChooseContract = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseContract),
            playerId: Type.String(),
            contract: ContractSchema,
            // Besserrufer's bird.
            bird: Type.Optional(BonusSchema)
        })
    ])
)

export const ChooseContractValidator = Compile(ChooseContract)

export function isChooseContract(action?: GameAction): action is ChooseContract {
    return action?.type === ActionType.ChooseContract
}

export class HydratedChooseContract
    extends HydratableAction<typeof ChooseContract>
    implements ChooseContract
{
    declare type: ActionType.ChooseContract
    declare playerId: string
    declare contract: Contract
    declare bird?: Bonus

    constructor(data: ChooseContract) {
        super(data, ChooseContractValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        state.nameContract(this.playerId, bidChoice(this.contract, this.bird))
    }
}
