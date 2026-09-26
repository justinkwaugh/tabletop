import * as Type from 'typebox'
import {
    BaseConfigurator,
    defineGame,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'
import { createPrivateHandGame, info } from '@tabletop/common/test-fixtures/private-hand'
import { GameContext } from '../gameContext.svelte.js'
import { uiRuntime } from './privateHandSession.fixture.js'

class Configurator extends BaseConfigurator {
    schema = Type.Object({ enabled: Type.Boolean() })
    options: GameConfigOptions = []
    normalizeConfig(config: GameConfig): GameConfig {
        const { legacyEnabled, ...current } = config
        return { ...current, enabled: legacyEnabled ?? current.enabled ?? false }
    }
}

export function normalizedClientContexts(): Record<string, GameConfig> {
    const { game, state } = createPrivateHandGame()
    const legacy = { ...game, config: { legacyEnabled: true } }
    const runtime = {
        ...uiRuntime,
        ...defineGame({ info: { ...info, configurator: new Configurator() }, runtime: uiRuntime })
            .runtime
    }
    const context = new GameContext({ runtime, game: legacy, state, actions: [] })
    const loaded = context.game.config
    const clone = context.clone({
        interceptGame(game) {
            game.config = { legacyEnabled: false }
        }
    })
    const refreshed = { ...game, config: { legacyEnabled: false } }
    context.updateGame(refreshed)
    const oldArtifact = new GameContext({
        runtime: uiRuntime,
        game: { ...game, config: { retained: null } },
        state,
        actions: []
    })
    return {
        loaded,
        cloned: clone.game.config,
        cloneFrozen: {
            game: Object.isFrozen(clone.game),
            config: Object.isFrozen(clone.game.config)
        },
        refreshed: context.game.config,
        original: legacy.config,
        updateInput: refreshed.config,
        oldArtifact: oldArtifact.game.config
    }
}
