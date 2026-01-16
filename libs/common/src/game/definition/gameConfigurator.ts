import type * as Type from 'typebox'
import { Value } from 'typebox/value'
import type { GameConfig, GameConfigOptions } from '../model/gameConfig.js'

export interface GameConfigurator {
    schema: Type.TSchema
    options: GameConfigOptions

    validateConfig(config: GameConfig): void
    updateConfig(
        config: GameConfig,
        update: { id: string; value: string | boolean | number | null }
    ): void
}

export abstract class BaseConfigurator implements GameConfigurator {
    abstract schema: Type.TSchema
    abstract options: GameConfigOptions

    validateConfig(config: GameConfig): void {
        if (!Value.Check(this.schema, config)) {
            throw Error(JSON.stringify(Value.Errors(this.schema, config)))
        }
    }

    updateConfig(
        config: GameConfig,
        update: { id: string; value: string | boolean | number | null }
    ): void {
        config[update.id] = update.value
    }
}
