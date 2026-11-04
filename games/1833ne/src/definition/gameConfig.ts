import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

const takeoverOption: BooleanConfigOption = {
    id: 'takeover',
    type: ConfigOptionType.Boolean,
    name: 'Takeover game',
    description:
        'Five Variable Start railroads may start in any open city from phase II, train limits fall from phase III, and after every second operating round each railroad may take over another it connects to (§11).',
    default: false
}

const Schema = Type.Object(
    { takeover: Type.Optional(Type.Boolean({ default: takeoverOption.default })) },
    { additionalProperties: false }
)

export const GameConfig1833NE = {
    schema: Schema,
    takeoverGame: (config: GameConfig | undefined) => config?.takeover === true
}

export class Configurator1833NE extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [takeoverOption]
}
