import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type ChooseScoringIsland = Static<typeof ChooseScoringIsland>
export const ChooseScoringIsland = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ChooseScoringIsland),
            islandId: Type.String()
        })
    ])
)

export const ChooseScoringIslandValidator = Compile(ChooseScoringIsland)

export function isChooseScoringIsland(action?: GameAction): action is ChooseScoringIsland {
    return action?.type === ActionType.ChooseScoringIsland
}

export class HydratedChooseScoringIsland
    extends HydratableAction<typeof ChooseScoringIsland>
    implements ChooseScoringIsland
{
    declare type: ActionType.ChooseScoringIsland
    declare islandId: string

    constructor(data: ChooseScoringIsland) {
        super(data, ChooseScoringIslandValidator)
    }

    apply(state: HydratedKaivaiGameState) {
        const { valid, reason } = HydratedChooseScoringIsland.isValidIsland(state, this.islandId)

        if (!valid) {
            throw Error(reason)
        }

        state.chosenIsland = this.islandId
    }

    static isValidIsland(
        state: HydratedKaivaiGameState,
        islandId: string
    ): { valid: boolean; reason: string } {
        const board = state.board
        const island = board.islands[islandId]
        if (!island) {
            return { valid: false, reason: 'Island not found' }
        }

        if (!state.islandsToScore.includes(islandId)) {
            return { valid: false, reason: 'Island not available to score' }
        }

        return { valid: true, reason: '' }
    }
}
