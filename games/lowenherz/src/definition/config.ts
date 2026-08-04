import * as Type from 'typebox'
import { GameConfigOptions, BooleanConfigOption, ConfigOptionType } from '@tabletop/common'

// A player with a perfect memory could always work out everyone's exact ducat total
// anyway - every transaction (negotiation payments, revealed duel bids, the wooded-
// space cost, money bag payouts, alliance cancellations) is public, and everyone
// starts from the same known 12. Defaults to on (money shown openly, which is what
// this implementation already did before this option existed) - turn off to make
// each player conceal their own total, closer to the physical game's actual setup
// ("A player's money is private").
const publicMoneyOption: BooleanConfigOption = {
    id: 'publicMoney',
    type: ConfigOptionType.Boolean,
    name: 'Public Money',
    description: 'Turn off to keep money private',
    default: true
}

// The rulebook's two ways to start a game: "variable construction rules" (each player
// manually places 3 castles/knights of their own at the start, using the PlacingCastles
// flow - the A-lettered action cards are shuffled in on top since they're only used
// with this mode) versus the "basic game" (a fixed board/castle/knight/wall layout
// exactly as printed in the rulebook's setup diagram, skipping manual placement
// entirely and discarding the A-lettered cards, starting from B instead). Defaults to
// on (player-placed), matching this implementation's only mode before this option
// existed.
const playerPlacedCastlesOption: BooleanConfigOption = {
    id: 'playerPlacedCastles',
    type: ConfigOptionType.Boolean,
    name: 'Player-Placed Castles',
    description:
        'Allow the players to place their own castles and knights. Turn off to begin with the standard setup in the rulebook. Ignored in a 2-player game, whose variant is built on player placement (4 castles each, plus 2 of a neutral color).',
    default: true
}

export type LowenherzGameConfig = Type.Static<typeof LowenherzGameConfig>
export const LowenherzGameConfig = Type.Object({
    publicMoney: Type.Optional(Type.Boolean({ default: true })),
    playerPlacedCastles: Type.Optional(Type.Boolean({ default: true }))
})

export const LowenherzGameConfigOptions: GameConfigOptions = [publicMoneyOption, playerPlacedCastlesOption]
