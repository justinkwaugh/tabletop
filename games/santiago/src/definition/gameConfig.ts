import * as Type from 'typebox'
import {
    GameConfigOptions,
    BooleanConfigOption,
    ConfigOptionType
} from '@tabletop/common'

const randomizeSpringOption: BooleanConfigOption = {
    id: 'randomizeSpring',
    type: ConfigOptionType.Boolean,
    name: 'Randomize Spring Location',
    description: 'Randomly place the spring (excluding the four corners) instead of letting the first player choose where to place it',
    default: true
}

const palmTreesOption: BooleanConfigOption = {
    id: 'palmTrees',
    type: ConfigOptionType.Boolean,
    name: 'Palm Trees',
    description: 'Place three palm trees randomly on the board at the start of the game',
    default: true
}

const privateMoneyOption: BooleanConfigOption = {
    id: 'privateMoney',
    type: ConfigOptionType.Boolean,
    name: 'Private Money',
    description: "Keep each player's escudo total private, as in the physical game — turn off to show everyone's money to everyone",
    default: true
}

export type SantiagoGameConfig = Type.Static<typeof SantiagoGameConfig>
export const SantiagoGameConfig = Type.Object({
    randomizeSpring: Type.Optional(Type.Boolean({ default: true })),
    palmTrees: Type.Optional(Type.Boolean({ default: true })),
    privateMoney: Type.Optional(Type.Boolean({ default: true }))
})

export const SantiagoGameConfigOptions: GameConfigOptions = [
    randomizeSpringOption,
    palmTreesOption,
    privateMoneyOption
]
