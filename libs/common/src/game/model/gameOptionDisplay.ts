import type { GameConfigurator } from '../definition/gameConfigurator.js'
import {
    ConfigOptionType,
    normalizeGameConfig,
    type GameConfig,
    type GameConfigOptions
} from './gameConfig.js'

export type DisplayedGameOption = {
    name: string
    value: string
    // A Yes/No option that is switched on, so its name alone describes it.
    enabledFlag: boolean
}

/** The words for option values that have no name of their own, in the reader's language. */
export type GameOptionValueLabels = {
    yes: string
    no: string
    none: string
}

/** Every option of a game's config, by name and the name of its value. */
export function displayedGameOptions(
    config: GameConfig,
    definition: GameConfigOptions | GameConfigurator,
    labels: GameOptionValueLabels,
    // Seats are assigned, so an option the seat decides shows that instead of its setting.
    seated = false
): DisplayedGameOption[] {
    const resolved = resolveConfiguration(config, definition)
    const definitions = resolved.definitions
    return Object.entries(resolved.config).map(([id, value]) => {
        const option = definitions.find((candidate) => candidate.id === id)
        if (seated && option?.seatedValue)
            return { name: option.name, value: option.seatedValue, enabledFlag: false }
        const selected =
            option?.type === ConfigOptionType.List
                ? option.options.find((choice) => choice.value === value)?.name
                : undefined
        return {
            name: option?.name ?? id,
            value:
                selected ??
                (typeof value === 'boolean'
                    ? value
                        ? labels.yes
                        : labels.no
                    : value === null
                      ? labels.none
                      : String(value)),
            enabledFlag: value === true
        }
    })
}

/** The options a game sets away from their defaults, and those its title always shows. */
export function nonStandardGameOptions(
    config: GameConfig,
    definition: GameConfigOptions | GameConfigurator,
    labels: GameOptionValueLabels
): DisplayedGameOption[] {
    const resolved = resolveConfiguration(config, definition)
    const definitions = resolved.definitions
    const visibleConfig = Object.fromEntries(
        Object.entries(resolved.config).filter(([id, value]) => {
            const option = definitions.find((candidate) => candidate.id === id)
            return option && (option.alwaysShow || value !== (option.default ?? null))
        })
    )
    return displayedGameOptions(visibleConfig, definitions, labels)
}

function resolveConfiguration(
    config: GameConfig,
    definition: GameConfigOptions | GameConfigurator
) {
    return Array.isArray(definition)
        ? { config, definitions: definition }
        : {
              config:
                  definition.normalizeConfig === undefined
                      ? config
                      : normalizeGameConfig(config, definition),
              definitions: definition.options
          }
}
