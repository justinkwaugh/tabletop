import { assert, assertExists, type GameState, type HydratedGameState } from '@tabletop/common'
import {
    createSpanGame,
    isSpanGameState,
    spanAction,
    summary,
    type SpanActionType,
    type SpanGameState
} from '@tabletop/common/test-fixtures/span-game'
import type { GameUIRuntime } from '../../definition/gameUiDefinition.js'
import { GameSession } from '../gameSession.svelte.js'
import { settle, uiRuntime } from './privateHandSession.fixture.js'

export class SpanSession extends GameSession<GameState, HydratedGameState> {
    readonly shown: string[] = []
    readonly shownKinds: string[] = []
    animationMilliseconds = 0
    readonly animationMillisecondsFor: Record<string, number> = {}

    constructor(...args: ConstructorParameters<typeof GameSession<GameState, HydratedGameState>>) {
        super(...args)
        this.addGameStateChangeListener(async ({ action, kind }) => {
            const step = action ? summary([action])[0] : 'state'
            this.shown.push(step)
            this.shownKinds.push(`${kind}:${step}`)
            const milliseconds = this.animationMillisecondsFor[step] ?? this.animationMilliseconds
            if (milliseconds > 0) {
                await new Promise((resolve) => setTimeout(resolve, milliseconds))
            }
        })
    }

    async act(type: SpanActionType, id: string, fields: Record<string, unknown> = {}) {
        assertExists(this.myPlayer, 'Nobody is acting')
        await this.applyAction({
            ...spanAction(id, type, this.myPlayer.id),
            ...fields,
            gameId: this.game.id
        })
        await settle(this)
    }

    get spanState(): SpanGameState {
        const state = this.gameState.dehydrate()
        assert(isSpanGameState(state), 'The Game State is not the span fixture’s')
        return state
    }
}

export function spanUiRuntime(
    runtime: ReturnType<typeof createSpanGame>['runtime']
): GameUIRuntime<GameState, HydratedGameState> {
    return { ...uiRuntime, ...runtime, sessionClass: SpanSession }
}
