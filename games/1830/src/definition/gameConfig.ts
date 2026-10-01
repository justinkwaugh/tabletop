import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

const extraSixTrainOption: BooleanConfigOption = {
    id: 'extraSixTrain',
    type: ConfigOptionType.Boolean,
    name: 'Extra 6-train',
    description: 'Adds a third 6-train.',
    default: false
}

const multipleBrownFromIpoOption: BooleanConfigOption = {
    id: 'multipleBrownFromIpo',
    type: ConfigOptionType.Boolean,
    name: 'Multiple brown shares from IPO',
    description:
        'Multiple shares of a company in the brown market zone may be bought from the IPO as well as the market. Not yet enforced: only one share may be bought per turn.',
    default: false
}

const Schema = Type.Object(
    {
        extraSixTrain: Type.Optional(Type.Boolean({ default: extraSixTrainOption.default })),
        multipleBrownFromIpo: Type.Optional(
            Type.Boolean({ default: multipleBrownFromIpoOption.default })
        )
    },
    { additionalProperties: false }
)

export const EighteenThirtyGameConfig = {
    schema: Schema,
    options: (config: GameConfig | undefined) => ({
        extraSixTrain: config?.extraSixTrain === true,
        multipleBrownFromIpo: config?.multipleBrownFromIpo === true
    })
}

export class EighteenThirtyConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [extraSixTrainOption, multipleBrownFromIpoOption]
}
