import { TSchema } from 'typebox'
import { Value } from 'typebox/value'
import { GameConfig, GameConfigOptions } from './gameConfig.js'

export interface GameConfigurator {
    schema: TSchema
    options: GameConfigOptions

    validateConfig(config: GameConfig): void
    updateConfig(
        config: GameConfig,
        update: { id: string; value: string | boolean | number | null }
    ): void
}

export abstract class BaseConfigurator implements GameConfigurator {
    abstract schema: TSchema
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
