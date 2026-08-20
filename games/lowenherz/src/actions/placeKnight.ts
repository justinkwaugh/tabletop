import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getSquare, isOnBoard, isWalledBetween, neighbors, SquareType } from '../model/board.js'
import { PoliticsCard, PoliticsCardType } from '../definition/politicsCards.js'

export const WOODED_KNIGHT_COST = 5

export type PlaceKnightMetadata = Type.Static<typeof PlaceKnightMetadata>
export const PlaceKnightMetadata = Type.Object({
    woodedCostPaid: Type.Optional(Type.Number()),
    // A snapshot of the Treasure card used to cover the wooded cost, if any - the
    // rulebook's "no change given" means the whole card is spent regardless of its
    // face value versus the 5-ducat cost.
    paidWithTreasureCard: Type.Optional(PoliticsCard)
})

export type PlaceKnight = Type.Static<typeof PlaceKnight>
export const PlaceKnight = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.PlaceKnight), // This action is always this type
            playerId: Type.String(), // Required now
            col: Type.Number(),
            row: Type.Number(),
            // Optional Treasure card to cover the wooded-space cost instead of ducats -
            // only meaningful when the target square is wooded.
            treasureCardId: Type.Optional(Type.String()),
            metadata: Type.Optional(PlaceKnightMetadata) // Always optional, because it is an output
        })
    ])
)

export const PlaceKnightValidator = Compile(PlaceKnight)

export function isPlaceKnight(action?: GameAction): action is PlaceKnight {
    return action?.type === ActionType.PlaceKnight
}

// Places one knight during regular play - distinct from setup's PlaceCastle-bundled
// knight (which forbids wooded spaces and only allows adjacency to the castle just
// placed). Here, wooded spaces are allowed for a 5-ducat cost, and adjacency is to any
// of the player's own knights or castles anywhere on the board.
export class HydratedPlaceKnight
    extends HydratableAction<typeof PlaceKnight>
    implements PlaceKnight
{
    declare type: ActionType.PlaceKnight
    declare playerId: string
    declare col: number
    declare row: number
    declare treasureCardId?: string
    declare metadata?: PlaceKnightMetadata

    constructor(data: PlaceKnight) {
        super(data, PlaceKnightValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidPlaceKnight(state)) {
            throw Error('Invalid PlaceKnight action')
        }

        const square = getSquare(state.board, this.col, this.row)!
        const playerState = state.getPlayerState(this.playerId)

        state.board.squares[this.row][this.col] = { ...square, knightColor: playerState.color }
        state.knightsRemaining = (state.knightsRemaining ?? 1) - 1
        playerState.knightsInStock -= 1

        if (square.type === SquareType.Forest) {
            if (this.treasureCardId) {
                const card = playerState.politicsCards.find((c) => c.id === this.treasureCardId)!
                playerState.politicsCards = playerState.politicsCards.filter(
                    (c) => c.id !== this.treasureCardId
                )
                this.metadata = { woodedCostPaid: WOODED_KNIGHT_COST, paidWithTreasureCard: card }
            } else {
                playerState.money -= WOODED_KNIGHT_COST
                this.metadata = { woodedCostPaid: WOODED_KNIGHT_COST }
            }
        } else {
            this.metadata = {}
        }
    }

    isValidPlaceKnight(state: HydratedLowenherzGameState): boolean {
        return this.invalidPlaceKnightReason(state) === undefined
    }

    // Same checks as isValidPlaceKnight, but reports WHY a placement is rejected - the
    // client uses this to show a specific message instead of one generic one.
    invalidPlaceKnightReason(state: HydratedLowenherzGameState): string | undefined {
        if (state.knightPlacingPlayerId !== this.playerId) {
            return "It isn't your turn to place a knight."
        }
        if (!state.knightsRemaining || state.knightsRemaining <= 0) {
            return 'You have no knights left to place this turn.'
        }
        // "If he has no more knights, he may place no more" - knightsRemaining counts
        // the action's swords, which aren't capped by stock (an unspendable-on-knights
        // sword can still buy a region expansion - see resolveBandForWinner), so the
        // stock limit is enforced here instead.
        if (state.getPlayerState(this.playerId).knightsInStock <= 0) {
            return 'You have no knights left in your stock.'
        }

        if (!isOnBoard(this.col, this.row)) {
            return 'That square is off the board.'
        }

        const square = getSquare(state.board, this.col, this.row)
        if (!square) {
            return 'That square is off the board.'
        }

        if (square.type !== SquareType.Blank && square.type !== SquareType.Forest) {
            return "Knights can't be placed on a hill or town space."
        }

        if (square.knightColor || square.castleColor) {
            return "That square is already occupied."
        }

        const playerState = state.getPlayerState(this.playerId)

        if (this.treasureCardId) {
            if (square.type !== SquareType.Forest) {
                return "There's no cost to pay with a Treasure card here."
            }
            const card = playerState.politicsCards.find((c) => c.id === this.treasureCardId)
            if (!card || card.type !== PoliticsCardType.Treasure) {
                return "That Treasure card isn't in your hand."
            }
            if (card.value! < WOODED_KNIGHT_COST) {
                return `That Treasure card isn't worth enough to cover the ${WOODED_KNIGHT_COST}-ducat wooded cost.`
            }
        } else {
            const woodedCost = square.type === SquareType.Forest ? WOODED_KNIGHT_COST : 0
            if (woodedCost > playerState.money) {
                return `Placing a knight in the woods costs ${WOODED_KNIGHT_COST} ducats, which you can't afford.`
            }
        }

        const isAdjacentToOwnPiece = neighbors(this.col, this.row).some((n) => {
            if (!isOnBoard(n.col, n.row)) return false
            if (isWalledBetween(state.board, this.col, this.row, n.col, n.row)) return false
            const neighborSquare = getSquare(state.board, n.col, n.row)
            return (
                neighborSquare?.knightColor === playerState.color ||
                neighborSquare?.castleColor === playerState.color
            )
        })
        if (!isAdjacentToOwnPiece) {
            return "A knight must be placed next to one of your own knights or castles."
        }

        return undefined
    }
}
