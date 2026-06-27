import * as Type from 'typebox'
import {
    GameConfigOptions,
    NumberInputConfigOption,
    BooleanConfigOption,
    ConfigOptionType
} from '@tabletop/common'

const springColOption: NumberInputConfigOption = {
    id: 'springCol',
    type: ConfigOptionType.NumberInput,
    name: 'Spring Column',
    description: 'Column of the spring intersection (0–4)',
    default: 2,
    placeholder: '0–4'
}

const springRowOption: NumberInputConfigOption = {
    id: 'springRow',
    type: ConfigOptionType.NumberInput,
    name: 'Spring Row',
    description: 'Row of the spring intersection (0–3)',
    default: 1,
    placeholder: '0–3'
}

const palmTreesOption: BooleanConfigOption = {
    id: 'palmTrees',
    type: ConfigOptionType.Boolean,
    name: 'Palm Trees',
    description: 'Place three palm trees randomly on the board at the start of the game',
    default: true
}

const publicMoneyOption: BooleanConfigOption = {
    id: 'publicMoney',
    type: ConfigOptionType.Boolean,
    name: 'Public Money',
    description: "Show all players' escudo totals to everyone (in the real game money is private)",
    default: true
}

const publicScoreOption: BooleanConfigOption = {
    id: 'publicScore',
    type: ConfigOptionType.Boolean,
    name: 'Public Score',
    description: "Show each player's current field score to everyone during the game",
    default: true
}

export type SantiagoGameConfig = Type.Static<typeof SantiagoGameConfig>
export const SantiagoGameConfig = Type.Object({
    springCol: Type.Optional(Type.Number({ default: 2 })),
    springRow: Type.Optional(Type.Number({ default: 1 })),
    palmTrees: Type.Optional(Type.Boolean({ default: true })),
    publicMoney: Type.Optional(Type.Boolean({ default: true })),
    publicScore: Type.Optional(Type.Boolean({ default: true }))
})

export const SantiagoGameConfigOptions: GameConfigOptions = [
    palmTreesOption,
    publicMoneyOption,
    publicScoreOption,
    springColOption,
    springRowOption
]
