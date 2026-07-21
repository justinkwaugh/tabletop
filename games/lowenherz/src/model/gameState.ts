import {
    Color,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import { LowenherzPlayerState, HydratedLowenherzPlayerState } from './playerState.js'
import { LowenherzBoard } from './board.js'
import { Region } from './region.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { ActionCard } from '../definition/actionCards.js'
import { PoliticsCard } from '../definition/politicsCards.js'

// One committed decision-card placement: which player placed it, and which slot
// (1 = top action, 2 = middle, 3 = bottom) they chose.
export type Decision = Type.Static<typeof Decision>
export const Decision = Type.Object({
    playerId: Type.String(),
    slot: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)])
})

// The outcome of resolving one slot's contest - who (if anyone) won the right to
// perform it. Also used to mark a Money Bag slot as handled (it's split among every
// chooser rather than having a single "winner" - see distributeMoneyBag).
export type ResolvedSlot = Type.Static<typeof ResolvedSlot>
export const ResolvedSlot = Type.Object({
    slot: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
    winnerPlayerId: Type.Optional(Type.String())
})

// An in-progress 2-player negotiation over a tied slot: players alternate making
// ducat offers to the other in exchange for the right to perform the action, until
// one accepts the standing offer or either player declines (forcing a duel instead).
export type Negotiation = Type.Static<typeof Negotiation>
export const Negotiation = Type.Object({
    slot: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
    playerIds: Type.Array(Type.String()),
    turnPlayerId: Type.String(),
    offer: Type.Optional(Type.Object({ fromPlayerId: Type.String(), amount: Type.Number() }))
})

// An in-progress duel over a tied slot: every participant submits one ducat bid
// (optionally backed by one Treasure card, added to the ducat amount) - the highest
// total wins and pays the bank. Ties re-duel once among just the tied bidders
// (tieCount tracks this) - a second tie means no one performs the action.
export type Duel = Type.Static<typeof Duel>
export const Duel = Type.Object({
    slot: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
    playerIds: Type.Array(Type.String()),
    bids: Type.Array(
        Type.Object({
            playerId: Type.String(),
            amount: Type.Number(),
            treasureCardId: Type.Optional(Type.String())
        })
    ),
    tieCount: Type.Number()
})

// An alliance between two neighboring regions of different princes, created by
// playing an Alliance politics card - neither region may be expanded into the other
// while it lasts. Tracked by region id rather than by a specific board wall, since
// that's the only thing that stays stable across later expansion/invasion - the
// rulebook's "if the space with the turned boundary wall is later taken over, the
// alliance...remains intact" note is satisfied automatically as long as both
// original regions (by id) still exist.
export type Alliance = Type.Static<typeof Alliance>
export const Alliance = Type.Object({
    id: Type.String(),
    regionAId: Type.String(),
    regionBId: Type.String()
})

export type LowenherzGameState = Type.Static<typeof LowenherzGameState>
export const LowenherzGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(LowenherzPlayerState), // Redefine with the specific player state type
            machineState: Type.Enum(MachineState), // Redefine with the specific machine states

            board: LowenherzBoard,
            regions: Type.Array(Region),
            alliances: Type.Array(Alliance),

            // Fixed clockwise seating order, chosen once at game start. firstPlayerId
            // rotates to the next entry in this list after each action card resolves.
            turnOrder: Type.Array(Type.String()),
            firstPlayerId: Type.String(),

            // Set only in a 3-player game: the unused 4th color, placed as neutral
            // obstacles during setup. Undefined in 2- and 4-player games.
            neutralColor: Type.Optional(Type.Enum(Color)),

            // Remaining undrawn action cards, in draw order (index 0 draws next).
            actionDeck: Type.Array(ActionCard),
            // The currently face-up standard card players are choosing actions from -
            // unset before the first draw, and while a Mining/King-is-Dead card is being
            // auto-resolved (they never linger here for player interaction).
            currentActionCard: Type.Optional(ActionCard),
            // Decision-card placements committed so far this round. Reset to [] whenever
            // a new standard card is drawn.
            decisions: Type.Array(Decision),

            // Slots resolved so far this round (in top/middle/bottom order). Reset to []
            // whenever a new standard card is drawn.
            resolvedSlots: Type.Array(ResolvedSlot),
            // Set while a 2-player tie on the current slot is being negotiated.
            negotiation: Type.Optional(Negotiation),
            // Set while a 3+-player tie (or a declined negotiation) is being dueled.
            duel: Type.Optional(Duel),
            // Set while the winner of a border action is placing their walls - counts
            // down from the card's border count (1-3) to 0.
            wallsRemaining: Type.Optional(Type.Number()),
            wallPlacingPlayerId: Type.Optional(Type.String()),
            // Set while the winner of a knight action is placing their knights - counts
            // down from the card's knight count (1-2) to 0 (or fewer, if their knight
            // stock ran out first).
            knightsRemaining: Type.Optional(Type.Number()),
            knightPlacingPlayerId: Type.Optional(Type.String()),

            // The two face-down politics-card piles the "Crown and Scepter" action
            // draws from - set once at game start, drawn down over the game.
            politicsCardPileA: Type.Array(PoliticsCard),
            politicsCardPileB: Type.Array(PoliticsCard),
            // Set while the winner of a politics action is looking through their
            // chosen pile and picking a card.
            politicsTakingPlayerId: Type.Optional(Type.String())
        })
    ])
)

const LowenherzGameStateValidator = Compile(LowenherzGameState)

export class HydratedLowenherzGameState
    extends HydratableGameState<typeof LowenherzGameState, HydratedLowenherzPlayerState>
    implements LowenherzGameState
{
    // Declare properties to satisfy the interface, they will be populated by the base class
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedLowenherzPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]

    declare board: LowenherzBoard
    declare regions: Region[]
    declare alliances: Alliance[]
    declare turnOrder: string[]
    declare firstPlayerId: string
    declare neutralColor?: Color

    declare actionDeck: ActionCard[]
    declare currentActionCard?: ActionCard
    declare decisions: Decision[]

    declare resolvedSlots: ResolvedSlot[]
    declare negotiation?: Negotiation
    declare duel?: Duel
    declare wallsRemaining?: number
    declare wallPlacingPlayerId?: string
    declare knightsRemaining?: number
    declare knightPlacingPlayerId?: string

    declare politicsCardPileA: PoliticsCard[]
    declare politicsCardPileB: PoliticsCard[]
    declare politicsTakingPlayerId?: string

    constructor(data: LowenherzGameState) {
        super(data, LowenherzGameStateValidator)

        this.players = data.players.map((player) => new HydratedLowenherzPlayerState(player))
    }
}
