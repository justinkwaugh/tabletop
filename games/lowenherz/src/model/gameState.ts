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
import { PieceOwner } from './owner.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { ActionCard } from '../definition/actionCards.js'
import { PoliticsCard } from '../definition/politicsCards.js'
import { repairDuplicateRegionIds } from '../util/regionDetection.js'

// Rulebook: "Castles of the same prince must have 6 spaces between them (exclusive) on an
// orthogonal path" - six empty squares, so a Manhattan distance of 7. Games created before
// this was read correctly recorded castles at distance 6 (five empty squares) and carry no
// minimumCastleDistance; they keep the legacy value so their actions still replay.
export const RULEBOOK_CASTLE_MIN_DISTANCE = 7
export const LEGACY_CASTLE_MIN_DISTANCE = 6

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

// An in-progress 2-player negotiation over a tied slot: turn-based, not simultaneous -
// whoever proposes last is waited on by the other side, who can either counter with
// different terms (taking the turn back) or propose the exact same terms back, which
// is acceptance and executes the deal immediately (see NegotiationMove.apply).
// lastProposedBy is who made the standing offer; undefined means neither side has
// proposed yet, and either can open. Either player can also decline outright at any
// stage, turn or no turn, forcing a duel instead.
export type Negotiation = Type.Static<typeof Negotiation>
export const Negotiation = Type.Object({
    slot: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
    playerIds: Type.Array(Type.String()),
    offer: Type.Optional(Type.Object({ fromPlayerId: Type.String(), amount: Type.Number() })),
    lastProposedBy: Type.Optional(Type.String())
})

// An in-progress duel over a tied slot: every participant submits one ducat bid
// (optionally backed by any number of Treasure cards, each added to the ducat amount -
// nothing in the rulebook caps it at one) - the highest total wins and pays the bank.
// Ties re-duel once among just the tied bidders (tieCount tracks this) - a second tie
// means no one performs the action.
export type Duel = Type.Static<typeof Duel>
export const Duel = Type.Object({
    slot: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
    playerIds: Type.Array(Type.String()),
    bids: Type.Array(
        Type.Object({
            playerId: Type.String(),
            amount: Type.Number(),
            treasureCardIds: Type.Optional(Type.Array(Type.String()))
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

            // The color the neutral prince's pieces are drawn in: whichever of the four
            // colors no player was dealt. Set in 2- and 3-player games (see
            // LowenherzInitializer); undefined at 4 players, where there is no prince.
            // Pieces record NEUTRAL_OWNER, not this color - see PieceOwner.
            neutralColor: Type.Optional(Type.Enum(Color)),

            // Whether a negotiation offer has to move at least one ducat (the
            // minimumOneDucat config option, resolved once at initialization). Held on
            // state rather than read from config at validation time so the rule replays
            // with the game and NegotiationMove can stay a function of state alone.
            // Read as `!== false`, like the config option it comes from: absent means
            // the rule is on, so a state built without it gets the stricter reading.
            minimumOneDucat: Type.Optional(Type.Boolean()),

            // Minimum orthogonal distance between two castles of the same owner, resolved
            // once at initialization (see RULEBOOK_CASTLE_MIN_DISTANCE). Absent on games
            // created before the rule was corrected, which read as LEGACY_CASTLE_MIN_DISTANCE.
            minimumCastleDistance: Type.Optional(Type.Number()),
            // The setup castle whose knight has not been placed yet, and who is placing
            // it. Set by PlaceCastle and cleared by PlaceSetupKnight, so it is defined
            // exactly while machineState is PlacingSetupKnight. Recorded rather than
            // derived from the board because a castle with no adjacent knight is not
            // otherwise distinguishable from one whose knight was placed further along.
            pendingSetupCastle: Type.Optional(
                Type.Object({
                    col: Type.Number(),
                    row: Type.Number(),
                    playerId: Type.String()
                })
            ),

            // Remaining undrawn action cards, in draw order (index 0 draws next).
            actionDeck: Type.Array(ActionCard),
            // The currently face-up standard card players are choosing actions from -
            // unset before the first draw, and immediately after a Mining card resolves
            // (it never lingers here for player interaction - see discardedActionCard
            // for what it leaves behind instead). A King-is-Dead card, by contrast,
            // stays put - the game is over, so there's nothing left to draw next.
            currentActionCard: Type.Optional(ActionCard),
            // The last action card resolved off to the side rather than through the
            // normal 3-slot flow (currently just Mining) - kept around purely so the
            // client has something to show on its discard pile after the card resolves
            // and before the next one is manually drawn.
            discardedActionCard: Type.Optional(ActionCard),
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
            // Set while the winner of a knight action is spending it - counts down from
            // the card's knight count (1-2, "swords") to 0. One sword buys either one
            // knight placement or one region expansion (of the expansion's full 1-2
            // spaces), which is how "place one knight and expand one of his regions by
            // two spaces" fits inside a single two-sword action. NOT capped by the
            // player's knight stock: an empty stock only rules out the placing half
            // (see PlaceKnight.invalidPlaceKnightReason), not the expanding half.
            knightsRemaining: Type.Optional(Type.Number()),
            knightPlacingPlayerId: Type.Optional(Type.String()),
            // Set right after a region expansion's first space, naming which region -
            // a 1-2 space expansion is submitted as up to two separate ExpandRegion
            // actions (one space each) rather than one combined action, so Undo can
            // step back a single space at a time. Its presence is what allows a 2nd
            // ExpandRegion action for the SAME region without paying a second sword
            // (see ExpandRegion.apply) - cleared once that 2nd space is added, the
            // player moves on to a knight instead, or they stop after just the first.
            expandingRegionId: Type.Optional(Type.String()),
            // Whether this knight action has already been used to expand a region -
            // "using this action to expand twice is not allowed", so a second FRESH
            // expansion is refused even when a sword is still unspent. Cleared when a
            // new knight action starts (see resolveBandForWinner).
            expansionUsed: Type.Optional(Type.Boolean()),
            // Neutral zones this expansion has already stranded, per victim owner, with
            // the points already charged for them. A 1-2 space expansion is submitted as up
            // to two separate ExpandRegion actions, but the rulebook scores the loss as one
            // event - "if a player loses spaces in two or more neutral zones, the spaces are
            // added together to determine the lost power points" - so the 2nd space charges
            // the DIFFERENCE between the combined total and what the 1st already took (see
            // ExpandRegion.apply). Cleared with expandingRegionId when the expansion ends.
            expansionStrandings: Type.Optional(
                Type.Array(
                    Type.Object({
                        owner: PieceOwner,
                        spaces: Type.Number(),
                        towns: Type.Number(),
                        pointsCharged: Type.Number()
                    })
                )
            ),

            // The two face-down politics-card piles the "Crown and Scepter" action
            // draws from - set once at game start, drawn down over the game.
            politicsCardPileA: Type.Array(PoliticsCard),
            politicsCardPileB: Type.Array(PoliticsCard),
            // Set while the winner of a politics action is looking through their
            // chosen pile and picking a card.
            politicsTakingPlayerId: Type.Optional(Type.String()),
            // Which pile (if either) the taking player has committed to looking
            // through, set by LookAtPoliticsPile and cleared once TakePoliticsCard
            // completes. Split from the pick itself so undo can freely retry a
            // different card from this same pile without also permitting a
            // switch to the other, unopened pile.
            openedPoliticsPile: Type.Optional(Type.Union([Type.Literal('A'), Type.Literal('B')]))
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
    declare minimumOneDucat?: boolean
    declare minimumCastleDistance?: number
    declare pendingSetupCastle?: { col: number; row: number; playerId: string }

    declare actionDeck: ActionCard[]
    declare currentActionCard?: ActionCard
    declare discardedActionCard?: ActionCard
    declare decisions: Decision[]

    declare resolvedSlots: ResolvedSlot[]
    declare negotiation?: Negotiation
    declare duel?: Duel
    declare wallsRemaining?: number
    declare wallPlacingPlayerId?: string
    declare knightsRemaining?: number
    declare knightPlacingPlayerId?: string
    declare expandingRegionId?: string
    declare expansionUsed?: boolean
    declare expansionStrandings?: {
        owner: PieceOwner
        spaces: number
        towns: number
        pointsCharged: number
    }[]

    declare politicsCardPileA: PoliticsCard[]
    declare politicsCardPileB: PoliticsCard[]
    declare politicsTakingPlayerId?: string
    declare openedPoliticsPile?: 'A' | 'B'

    constructor(data: LowenherzGameState) {
        super(data, LowenherzGameStateValidator)

        this.players = data.players.map((player) => new HydratedLowenherzPlayerState(player))

        // Games that started before detectNewRegions minted collision-free ids can have
        // two live regions sharing one - which breaks every find-by-id in this engine
        // (region ownership, alliances, the in-progress expansion). Repaired here rather
        // than left to each lookup to second-guess: it's deterministic and runs the same
        // way on client and server, so both agree on the resulting ids.
        repairDuplicateRegionIds(this.regions)
    }

    // activePlayerIds narrows to whoever's turn it is to move a negotiation forward (see
    // NegotiatingStateHandler.enter), so the other negotiator can't submit most actions -
    // correctly, since it isn't their move. Force-a-duel is the one exception: either
    // negotiator can decline at any stage, turn or no turn (see
    // NegotiationMove.isValidNegotiationMove), and the engine's own action gate
    // (GameEngine.isPlayerAllowed) checks isActivePlayer before any action-specific
    // validation even runs, with no per-action-type exception - so without this, a
    // negotiator between turns could never submit a Decline at all.
    //
    // This only widens what the ENGINE'S GATE allows attempting; it does not touch
    // activePlayerIds itself, so every display that reads that list directly (player
    // panels, the action bar, hotseat's active-seat resolution) still correctly shows
    // only the active proposer. isValidNegotiationMove is what actually rejects an
    // out-of-turn Propose from the player this lets back in.
    override isActivePlayer(playerId: string): boolean {
        if (super.isActivePlayer(playerId)) return true
        return this.negotiation?.playerIds.includes(playerId) ?? false
    }

    get requiredCastleDistance(): number {
        return this.minimumCastleDistance ?? LEGACY_CASTLE_MIN_DISTANCE
    }
}
