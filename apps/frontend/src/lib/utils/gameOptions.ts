import {
    ConfigOptionType,
    normalizeGameConfig,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

export function configuredGameOptions(
    config: GameConfig,
    definition: GameConfigOptions | GameConfigurator
) {
    const resolved = resolveConfiguration(config, definition)
    const definitions = resolved.definitions
    return Object.entries(resolved.config).map(([id, value]) => {
        const option = definitions.find((candidate) => candidate.id === id)
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
                        ? 'Yes'
                        : 'No'
                    : value === null
                      ? 'None'
                      : String(value))
        }
    })
}

export function gameCardOptions(
    config: GameConfig,
    definition: GameConfigOptions | GameConfigurator
) {
    const resolved = resolveConfiguration(config, definition)
    const definitions = resolved.definitions
    const visibleConfig = Object.fromEntries(
        Object.entries(resolved.config).filter(([id, value]) => {
            const option = definitions.find((candidate) => candidate.id === id)
            return option && (option.alwaysShow || value !== (option.default ?? null))
        })
    )
    return configuredGameOptions(visibleConfig, definitions)
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
