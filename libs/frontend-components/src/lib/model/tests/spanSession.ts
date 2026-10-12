import { assertExists, type GameState, type HydratedGameState } from '@tabletop/common'
import {
    createSpanGame,
    spanAction,
    type SpanActionType
} from '@tabletop/common/test-fixtures/span-game'
import type { GameUIRuntime } from '../../definition/gameUiDefinition.js'
import { GameSession } from '../gameSession.svelte.js'
import { settle, uiRuntime } from './privateHandSession.fixture.js'

export class SpanSession extends GameSession<GameState, HydratedGameState> {
    readonly shown: string[] = []
    animationMilliseconds = 0

    constructor(...args: ConstructorParameters<typeof GameSession<GameState, HydratedGameState>>) {
        super(...args)
        this.addGameStateChangeListener(async ({ action }) => {
            this.shown.push(action ? `${action.type}:${action.playerId ?? ''}` : 'state')
            if (this.animationMilliseconds > 0) {
                await new Promise((resolve) => setTimeout(resolve, this.animationMilliseconds))
            }
        })
    }

    async act(type: SpanActionType, id: string) {
        assertExists(this.myPlayer, 'Nobody is acting')
        await this.applyAction({ ...spanAction(id, type, this.myPlayer.id), gameId: this.game.id })
        await settle(this)
    }
}

export function spanUiRuntime(
    runtime: ReturnType<typeof createSpanGame>['runtime']
): GameUIRuntime<GameState, HydratedGameState> {
    return { ...uiRuntime, ...runtime, sessionClass: SpanSession }
}
