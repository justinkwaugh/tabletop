import * as Type from 'typebox'

export enum ConfigOptionType {
    Boolean = 'Boolean',
    List = 'List',
    StringInput = 'StringInput',
    NumberInput = 'NumberInput'
}

export type BaseConfigOption = Type.Static<typeof BaseConfigOption>
export const BaseConfigOption = Type.Object({
    id: Type.String(),
    type: Type.Enum(ConfigOptionType),
    name: Type.String(),
    description: Type.String(),
    alwaysShow: Type.Optional(Type.Boolean())
})

export type BooleanConfigOption = Type.Static<typeof BooleanConfigOption>
export const BooleanConfigOption = Type.Object({
    ...BaseConfigOption.properties,
    type: Type.Literal(ConfigOptionType.Boolean),
    default: Type.Boolean()
})

export type ListConfigOption = Type.Static<typeof ListConfigOption>
export const ListConfigOption = Type.Object({
    ...BaseConfigOption.properties,
    type: Type.Literal(ConfigOptionType.List),
    default: Type.String(),
    options: Type.Array(
        Type.Object({
            name: Type.String(),
            value: Type.String()
        })
    )
})

export type InputConfigOption = Type.Static<typeof InputConfigOption>
export const InputConfigOption = Type.Object({
    ...BaseConfigOption.properties,
    placeholder: Type.Optional(Type.String())
})

export type StringInputConfigOption = Type.Static<typeof StringInputConfigOption>
export const StringInputConfigOption = Type.Object({
    ...InputConfigOption.properties,
    type: Type.Literal(ConfigOptionType.StringInput),
    value: Type.Optional(Type.String()),
    default: Type.Optional(Type.String())
})

export type NumberInputConfigOption = Type.Static<typeof NumberInputConfigOption>
export const NumberInputConfigOption = Type.Object({
    ...InputConfigOption.properties,
    type: Type.Literal(ConfigOptionType.NumberInput),
    value: Type.Optional(Type.Number()),
    default: Type.Optional(Type.Number())
})

export type ConfigOption = Type.Static<typeof ConfigOption>
export const ConfigOption = Type.Union([
    BooleanConfigOption,
    ListConfigOption,
    StringInputConfigOption,
    NumberInputConfigOption
])

export function isListConfigOption(option: ConfigOption): option is ListConfigOption {
    return option.type === ConfigOptionType.List
}

export function isBooleanConfigOption(option: ConfigOption): option is BooleanConfigOption {
    return option.type === ConfigOptionType.Boolean
}

export function isStringInputConfigOption(option: ConfigOption): option is StringInputConfigOption {
    return option.type === ConfigOptionType.StringInput
}

export function isNumberInputConfigOption(option: ConfigOption): option is NumberInputConfigOption {
    return option.type === ConfigOptionType.NumberInput
}

export type GameConfigOptions = Type.Static<typeof GameConfigOptions>
export const GameConfigOptions = Type.Array(ConfigOption)

export type GameConfig = Type.Static<typeof GameConfig>
export const GameConfig = Type.Record(
    Type.String(),
    Type.Union([Type.Boolean(), Type.String(), Type.Number(), Type.Null()])
)
