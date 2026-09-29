import { assert, Game, GameAction, GameEngine, GameStatus } from '@tabletop/common'
import { EighteenXXStateValidator } from '@tabletop/18xx'
import { Definition as TheOldPrince } from '@tabletop/the-old-prince'
import { Definition as Shikoku1889 } from '@tabletop/shikoku-1889'
import * as Value from 'typebox/value'

const finishedGames = {
    'the-old-prince': {
        definition: TheOldPrince,
        fixture: () => import('./fixtures/top-finished.json')
    },
    'shikoku-1889': {
        definition: Shikoku1889,
        fixture: () => import('./fixtures/1889-finished.json')
    }
}
export type FinishedGameTitle = keyof typeof finishedGames
export function hasFinishedGame(typeId: string): typeId is FinishedGameTitle {
    return typeId in finishedGames
}

export async function finishedGame(
    ownerId: string,
    name: string,
    typeId: FinishedGameTitle = 'the-old-prince'
) {
    const { definition, fixture: load } = finishedGames[typeId]
    const fixture = (await load()).default
    const game = Value.Convert(Game, structuredClone(fixture.game))
    assert(Value.Check(Game, game), 'Invalid finished game definition')
    const initialState: unknown = structuredClone(fixture.initialState)
    assert(EighteenXXStateValidator.Check(initialState), 'Invalid finished game opening state')
    game.ownerId = ownerId
    game.name = name
    game.players = game.players.map((player) => ({ ...player, userId: ownerId }))
    const engine = new GameEngine(definition.runtime)
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
