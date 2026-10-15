import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CoralColor } from '../components/colors.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'

export type SetupParrotfishPolyp = Type.Static<typeof SetupParrotfishPolyp>
export const SetupParrotfishPolyp = Type.Object({
    playerId: Type.String(),
    color: Type.Enum(CoralColor)
})

// The parrotfish polyps fed at setup, which nobody else saw until now (rulebook p. 3).
export type GameEnded = Type.Static<typeof GameEnded>
export const GameEnded = Type.Object({ setupParrotfishPolyps: Type.Array(SetupParrotfishPolyp) })

// Everything hidden is revealed when the game ends, so Undo cannot step back past it.
export type EndGame = Type.Static<typeof EndGame>
export const EndGame = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.EndGame),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(GameEnded)
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
    declare metadata?: GameEnded

    constructor(data: EndGame) {
        super(data, EndGameValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        this.metadata = {
            setupParrotfishPolyps: state.players.map((player) => ({
                playerId: player.playerId,
                color: player.setupParrotfishPolyp()
            }))
        }
    }
}
