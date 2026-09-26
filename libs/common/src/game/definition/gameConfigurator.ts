import type * as Type from 'typebox'
import * as Value from 'typebox/value'
import type { GameConfig, GameConfigOptions } from '../model/gameConfig.js'

export interface GameConfigNormalizer<C extends GameConfig = GameConfig> {
    // Receives null-stripped stored values and returns canonical config; pure and idempotent.
    normalizeConfig(config: GameConfig): C
}

export interface GameConfigurator<C extends GameConfig = GameConfig> extends Partial<
    GameConfigNormalizer<C>
> {
    schema: Type.TSchema
    options: GameConfigOptions

    validateConfig(config: GameConfig): void
    updateConfig(
        config: GameConfig,
        update: { id: string; value: string | boolean | number | null }
    ): void
}

export abstract class BaseConfigurator<
    C extends GameConfig = GameConfig
> implements GameConfigurator<C> {
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
