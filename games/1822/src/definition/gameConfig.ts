import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type ListConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

import { ScenarioCatalog1822, ScenarioId1822, ScenarioIds1822 } from '../scenarioCatalog.js'

const StandardGame = 'standard'

// The 1822+ expansion (§2.1.7, §6.2.2) and the variants of §6.1.
const plusOption: BooleanConfigOption = {
    id: 'plus',
    type: ConfigOptionType.Boolean,
    name: '1822+ expansion',
    description:
        'Six more minor companies and three more private companies. Eighteen of the twenty-one private companies are used, and each private bidding box has its own stack: trains in box 1, track in box 2 and the rest in box 3.',
    default: false
}

const allPrivatesOption: BooleanConfigOption = {
    id: 'allPrivates',
    type: ConfigOptionType.Boolean,
    name: '1822+: all 21 private companies',
    description: 'With 1822+, no private company is removed during setup.',
    default: false
}

const mixedPrivatesOption: BooleanConfigOption = {
    id: 'mixedPrivates',
    type: ConfigOptionType.Boolean,
    name: '1822+: one private stack',
    description:
        'With 1822+, the private companies are shuffled into one stack as in the original game. The permanent L-train may then be for sale in the first stock round, which can bring phase 2 in the first operating round.',
    default: false
}

const taxHavenSharesOption: BooleanConfigOption = {
    id: 'taxHavenShares',
    type: ConfigOptionType.Boolean,
    name: 'Tax haven buys further shares',
    description:
        'Once its owner has bought the tax haven its first share, the money it collects buys further shares: one each stock round as its owner’s action, and never a second share of a company.',
    default: false
}

// The scenarios of the designer's print-and-play pack (§6.2.1), each a shorter game.
const scenarioOption: ListConfigOption = {
    id: 'scenario',
    type: ConfigOptionType.List,
    name: 'Scenario',
    description:
        'A shorter game: on part of the map with set companies removed, or on the whole map with companies removed at random. Fewer trains, less start money and a lower share value that ends the game. A scenario is played without 1822+.',
    default: StandardGame,
    options: [
        { name: 'Standard game', value: StandardGame, description: 'The whole game.' },
        ...ScenarioCatalog1822.map(({ id, name, summary }) => ({
            name,
            value: id,
            description: summary
        }))
    ],
    alwaysShow: true
}

const Schema = Type.Object(
    {
        scenario: Type.Optional(
            Type.Union([Type.Literal(StandardGame), ScenarioId1822], { default: StandardGame })
        ),
        plus: Type.Optional(Type.Boolean({ default: plusOption.default })),
        allPrivates: Type.Optional(Type.Boolean({ default: allPrivatesOption.default })),
        mixedPrivates: Type.Optional(Type.Boolean({ default: mixedPrivatesOption.default })),
        taxHavenShares: Type.Optional(Type.Boolean({ default: taxHavenSharesOption.default }))
    },
    { additionalProperties: false }
)

export type Variants1822 = {
    scenario?: ScenarioId1822
    plus?: true
    allPrivates?: true
    mixedPrivates?: true
    taxHavenShares?: true
}

export const GameConfig1822 = {
    schema: Schema,
    variants: (config: GameConfig | undefined): Variants1822 => {
        const scenario = ScenarioIds1822.find((id) => id === config?.scenario)
        // The scenarios are of the original game; the private company setup choices belong to
        // the expansion (§6.1.3).
        const plus = !scenario && config?.plus === true
        return {
            ...(scenario ? { scenario } : {}),
            ...(plus ? { plus: true as const } : {}),
            ...(plus && config?.allPrivates === true ? { allPrivates: true as const } : {}),
            ...(plus && config?.mixedPrivates === true ? { mixedPrivates: true as const } : {}),
            ...(config?.taxHavenShares === true ? { taxHavenShares: true as const } : {})
        }
    }
}

export class Configurator1822 extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [
        scenarioOption,
        plusOption,
        allPrivatesOption,
        mixedPrivatesOption,
        taxHavenSharesOption
    ]
}
