import {
    BaseConfigurator,
    ConfigOptionType,
    assert,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'
import * as Type from 'typebox'

export type PromontoryPointGameConfig = Type.Static<typeof PromontoryPointGameConfig>
export const PromontoryPointGameConfig = Type.Object({
    // R-6.3-H1
    fourPieceVariant: Type.Optional(Type.Boolean())
})

export type NormalizedPromontoryPointGameConfig = Required<PromontoryPointGameConfig>

export const PromontoryPointGameConfigOptions: GameConfigOptions = [
    {
        id: 'fourPieceVariant',
        type: ConfigOptionType.Boolean,
        name: 'Four-piece variant',
        description:
            'Each player holds four track pieces and places three a turn, then keeps the fourth and draws three, or returns it and draws four.',
        default: false
    }
]

// R-6.3-H1: off unless chosen.
export function normalizePromontoryPointConfig(
    config: GameConfig
): NormalizedPromontoryPointGameConfig {
    const fourPieceVariant = config.fourPieceVariant ?? false
    assert(typeof fourPieceVariant === 'boolean', 'The four-piece variant option must be a boolean')
    return { ...config, fourPieceVariant }
}

export class PromontoryPointConfigurator
    extends BaseConfigurator<NormalizedPromontoryPointGameConfig>
    implements GameConfigurator<NormalizedPromontoryPointGameConfig>
{
    normalizeConfig = normalizePromontoryPointConfig
    schema = PromontoryPointGameConfig
    options = PromontoryPointGameConfigOptions
}
