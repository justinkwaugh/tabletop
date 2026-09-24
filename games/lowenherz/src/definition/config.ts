import * as Type from 'typebox'
import { GameConfigOptions, BooleanConfigOption, ConfigOptionType } from '@tabletop/common'

// All three are presented inverted: the toggle names the variant and starts off, while the
// stored value keeps its original sense with `true` as the ordinary game. That leaves every
// existing game record and every `!== false` reader of these keys exactly as they were.
const publicMoneyOption: BooleanConfigOption = {
    id: 'publicMoney',
    type: ConfigOptionType.Boolean,
    name: 'Private money',
    description: 'Keep balances private until the end of the game.',
    default: true,
    invertPresentation: true
}

// The rulebook's two ways to start a game: "variable construction rules" (each player
// manually places 3 castles/knights of their own at the start, using the PlacingCastles
// flow - the A-lettered action cards are shuffled in on top since they're only used
// with this mode) versus the "basic game" (a fixed board/castle/knight/wall layout
// exactly as printed in the rulebook's setup diagram, skipping manual placement
// entirely and discarding the A-lettered cards, starting from B instead). Stored as
// on (player-placed), matching this implementation's only mode before this option
// existed; presented as the standard setup being switched on.
const playerPlacedCastlesOption: BooleanConfigOption = {
    id: 'playerPlacedCastles',
    type: ConfigOptionType.Boolean,
    name: 'Standard rulebook setup',
    description:
        'Begin from the fixed board layout printed in the rulebook instead of players placing their own castles and knights. Ignored in a 2-player game, whose variant is built on player placement.',
    default: true,
    invertPresentation: true
}

// The rulebook settles a tie by having the two princes bargain, and a bargain in which
// nothing changes hands is not much of one - so an offer has to move at least a single
// ducat. Allowing a zero-ducat offer is really a way of saying "you take it, I want
// nothing", reached through the same propose/accept exchange rather than by declining
// into a duel.
const minimumOneDucatOption: BooleanConfigOption = {
    id: 'minimumOneDucat',
    type: ConfigOptionType.Boolean,
    name: 'Allow zero-ducat offers',
    description: 'Allow negotiation offers of zero ducats.',
    default: true,
    invertPresentation: true
}

export type LowenherzGameConfig = Type.Static<typeof LowenherzGameConfig>
export const LowenherzGameConfig = Type.Object({
    publicMoney: Type.Optional(Type.Boolean({ default: true })),
    playerPlacedCastles: Type.Optional(Type.Boolean({ default: true })),
    minimumOneDucat: Type.Optional(Type.Boolean({ default: true }))
})

export const LowenherzGameConfigOptions: GameConfigOptions = [
    publicMoneyOption,
    playerPlacedCastlesOption,
    minimumOneDucatOption
]
