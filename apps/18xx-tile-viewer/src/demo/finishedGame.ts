import { assert, Game, GameAction, GameEngine, GameStatus } from '@tabletop/common'
import { FinanceExampleValidator } from '@tabletop/18xx'
import { Definition } from '@tabletop/the-old-prince'
import * as Value from 'typebox/value'
import fixture from './fixtures/top-finished.json'

export async function finishedGame(ownerId: string, name: string) {
    const game = Value.Convert(Game, structuredClone(fixture.game))
    assert(Value.Check(Game, game), 'Invalid finished game definition')
    const initialState: unknown = structuredClone(fixture.initialState)
    assert(FinanceExampleValidator.Check(initialState), 'Invalid finished game opening state')
    game.ownerId = ownerId
    game.name = name
    game.players = game.players.map((player) => ({ ...player, userId: ownerId }))
    const engine = new GameEngine(Definition.runtime)
    let state = initialState
    const actions: GameAction[] = []
    for (const [index, command] of fixture.actions.entries()) {
        assert(Value.Check(GameAction, command), 'Invalid finished game action')
        const result = engine.executeCanonicalAction({ game, state, action: command })
        state = result.updatedState
        actions.push(...result.processedActions)
        if (index % 100 === 99) await new Promise((resolve) => setTimeout(resolve, 0))
    }
    assert(state.machineState === 'GameOver', 'Finished game replay did not finish')
    for (const [playerId, total] of Object.entries(fixture.finalWealth))
        assert(
            state.finalWealth?.find((wealth) => wealth.playerId === playerId)?.total === total,
            'Finished game wealth does not match'
        )
    game.status = GameStatus.Finished
    game.startedAt = game.createdAt
    game.finishedAt = game.createdAt
    game.activePlayerIds = state.activePlayerIds
    game.winningPlayerIds = state.winningPlayerIds
    game.result = state.result
    return { game, state, actions, initialState, engine }
}
