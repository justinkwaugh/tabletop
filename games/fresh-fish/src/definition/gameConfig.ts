import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export type FreshFishGameConfig = Static<typeof FreshFishGameConfig>
export const FreshFishGameConfig = Type.Composite([
    Type.Object({
        forceThreeDisks: Type.Optional(Type.Boolean({ default: true })),
        auctioneerWinsTie: Type.Optional(Type.Boolean({ default: false }))
    })
])

export const FreshFishGameConfigValidator = TypeCompiler.Compile(FreshFishGameConfig)

export const FreshFishGameConfigOptions: GameConfigOptions = [
    {
        id: 'auctioneerWinsTie',
        type: ConfigOptionType.Boolean,
        name: 'Auctioneer Wins Tie',
        description: 'If there is a tie in the auction, the auctioneer wins the tile',
        default: false
    },
    {
        id: 'forceThreeDisks',
        type: ConfigOptionType.Boolean,
        name: 'Three Disks to Start',
        description: 'The first three turns for each player must be disk placements',
        default: true
    }
]
