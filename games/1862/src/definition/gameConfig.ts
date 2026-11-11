import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

const Schema = Type.Object(
    {
        length: Type.Optional(
            Type.Union([Type.Literal('short'), Type.Literal('standard'), Type.Literal('long')])
        ),
        eightStations: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
)

export class Configurator1862 extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [
        {
            id: 'length',
            type: ConfigOptionType.List,
            name: 'Game length',
            description: 'How many trains of each band the game uses (§2.4.3).',
            default: 'standard',
            options: [
                { name: 'Short', value: 'short', description: 'Fewer A, B and C trains.' },
                { name: 'Standard', value: 'standard', description: 'The standard roster.' },
                { name: 'Long', value: 'long', description: 'More C and D trains.' }
            ]
        },
        {
            id: 'eightStations',
            type: ConfigOptionType.Boolean,
            name: 'Eight stations',
            description:
                'Companies may hold eight stations rather than seven, which makes late token blocking harsher (§11.4).',
            default: false
        }
    ]
}
