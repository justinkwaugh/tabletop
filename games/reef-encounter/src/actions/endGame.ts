import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CoralColor } from '../components/colors.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'

// No earlier action could show the polyp each player fed their parrotfish at setup.
export type GameEndReveal = Type.Static<typeof GameEndReveal>
export const GameEndReveal = Type.Object({
    setupParrotfish: Type.Record(Type.String(), Type.Enum(CoralColor))
})

// Everything hidden is revealed when the game ends, so Undo cannot step back past it.
export type EndGame = Type.Static<typeof EndGame>
export const EndGame = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.EndGame),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(GameEndReveal)
        })
    ])
)

export const EndGameValidator = Compile(EndGame)

export function isEndGame(action?: GameAction): action is EndGame {
    return action?.type === ActionType.EndGame
}

export class HydratedEndGame extends HydratableAction<typeof EndGame> implements EndGame {
    declare type: ActionType.EndGame
    declare revealsInfo: true
    declare metadata?: GameEndReveal

    constructor(data: EndGame) {
        super(data, EndGameValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        this.metadata = { setupParrotfish: state.setupParrotfishColors() }
    }
}
