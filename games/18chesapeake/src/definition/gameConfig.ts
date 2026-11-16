import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

const offTheRailsOption: BooleanConfigOption = {
    id: 'offTheRails',
    type: ConfigOptionType.Boolean,
    name: 'Off the Rails',
    description:
        'The expansion’s fast game: a deeper market with orange and brown zones ending at $300, a $12,000 bank, sell–buy–sell turns, companies floating at 50%, fewer trains and no exports, and $1,100 D-trains.',
    default: false
}

const Schema = Type.Object(
    { offTheRails: Type.Optional(Type.Boolean({ default: offTheRailsOption.default })) },
    { additionalProperties: false }
)

export const GameConfigChesapeake = {
    schema: Schema,
    options: (config: GameConfig | undefined) => ({ offTheRails: config?.offTheRails === true })
}

export class ConfiguratorChesapeake extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [offTheRailsOption]
}
