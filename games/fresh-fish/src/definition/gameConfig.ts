import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import {
    BooleanConfigOption,
    ConfigOptionType,
    GameConfigOptions,
    NumberInputConfigOption
} from '@tabletop/common'

const auctioneerWinsTieOption: BooleanConfigOption = {
    id: 'auctioneerWinsTie',
    type: ConfigOptionType.Boolean,
    name: 'Auctioneer Wins Tie',
    description: 'If there is a tie in the auction, the auctioneer wins the tile',
    default: false
}

const forceThreeDisksOption: BooleanConfigOption = {
    id: 'forceThreeDisks',
    type: ConfigOptionType.Boolean,
    name: 'Three Disks to Start',
    description: 'The first three turns for each player must be disk placements',
    default: true
}

const boardSeedOption: NumberInputConfigOption = {
    id: 'boardSeed',
    type: ConfigOptionType.NumberInput,
    name: 'Board Seed',
    description: 'Seed a specific board layout',
    default: undefined,
    placeholder: 'seed value'
}

export type FreshFishGameConfig = Static<typeof FreshFishGameConfig>
export const FreshFishGameConfig = Type.Object({
    forceThreeDisks: Type.Optional(Type.Boolean({ default: forceThreeDisksOption.default })),
    auctioneerWinsTie: Type.Optional(Type.Boolean({ default: auctioneerWinsTieOption.default })),
    boardSeed: Type.Optional(Type.Number())
})

export const FreshFishGameConfigValidator = Compile(FreshFishGameConfig)

export const FreshFishGameConfigOptions: GameConfigOptions = [
    auctioneerWinsTieOption,
    forceThreeDisksOption,
    boardSeedOption
]
