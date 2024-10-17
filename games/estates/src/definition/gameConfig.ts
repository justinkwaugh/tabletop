import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export type EstatesGameConfig = Static<typeof EstatesGameConfig>
export const EstatesGameConfig = Type.Object({
    hiddenMoney: Type.Boolean(),
    sneakyBuildings: Type.Boolean()
})

export const EstatesGameConfigValidator = TypeCompiler.Compile(EstatesGameConfig)

export const EstatesGameConfigOptions: GameConfigOptions = [
    {
        id: 'hiddenMoney',
        type: ConfigOptionType.Boolean,
        name: 'Hidden Money',
        description: 'Hide the amount of money each player has',
        default: false
    },
    {
        id: 'sneakyBuildings',
        type: ConfigOptionType.Boolean,
        name: 'Sneaky Buildings',
        description: 'Hide the faces of building cubes',
        default: false
    }
]
