import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    GameResult,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { endingDue, type EndingState, type EndingRules } from './gameEnding.js'
import { PlayerWealth, finalWealth } from './finalWealth.js'
const Fields = Type.Object({
    type: Type.Literal('EndGame'),
    metadata: Type.Optional(Type.Array(PlayerWealth))
})
export const EndGame: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof Fields.properties
> = Type.Object({ ...GameAction.properties, ...Fields.properties }, { additionalProperties: false })
export type EndGame = Type.Static<typeof EndGame>
const Validator = Compile(EndGame)
export function isEndGame(action: GameAction): action is EndGame {
    return (
        action instanceof HydratedEndGame || (action.type === 'EndGame' && Validator.Check(action))
    )
}
export class HydratedEndGame extends HydratableAction<typeof EndGame> implements EndGame {
    declare type: 'EndGame'
    declare metadata?: PlayerWealth[]
    readonly #rules: EndingRules
    constructor(data: EndGame, rules: EndingRules) {
        super(data instanceof HydratedEndGame ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: EndingState): boolean {
        return this.source === ActionSource.System && endingDue(state)
    }
    apply(state: HydratedGameState & EndingState & { finalWealth?: PlayerWealth[] }): void {
        assert(this.isValid(state), 'The game has not reached its ending boundary')
        state.finalWealth = finalWealth(state, this.#rules)
        const maximum = Math.max(...state.finalWealth.map((player) => player.total))
        state.winningPlayerIds = state.finalWealth
            .filter((player) => player.total === maximum)
            .map((player) => player.playerId)
        state.result = state.winningPlayerIds.length > 1 ? GameResult.Draw : GameResult.Win
        if (state.operatingSet && state.gameEnding?.finalOperatingSet !== undefined)
            state.operatingSet.completed = true
        state.activePlayerIds = []
        this.metadata = structuredClone(state.finalWealth)
    }
}
