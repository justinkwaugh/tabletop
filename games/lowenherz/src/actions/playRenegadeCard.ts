import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
import { getSquare, isOnBoard, isWalledBetween, neighbors, squareKey, SquareType } from '../model/board.js'
import { regionsAreNeighboring } from '../util/regionScoring.js'
import { isKnightSafeToRemove } from '../util/knightConnectivity.js'
import { currentChoosingPlayerId } from '../util/decisionPlan.js'
import { KNIGHT_NOT_ADJACENT_REASON, WOODED_KNIGHT_COST } from './placeKnight.js'

export type PlayRenegadeCardMetadata = Type.Static<typeof PlayRenegadeCardMetadata>
export const PlayRenegadeCardMetadata = Type.Object({
    victimColor: Type.Enum(Color),
    removedSquareKey: Type.String(),
    placedSquareKey: Type.String(),
    removalWoodedCostPaid: Type.Optional(Type.Number()),
    placementWoodedCostPaid: Type.Optional(Type.Number())
})

export type PlayRenegadeCard = Type.Static<typeof PlayRenegadeCard>
export const PlayRenegadeCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.PlayRenegadeCard), // This action is always this type
            playerId: Type.String(), // Required now
            cardId: Type.String(),
            // One of the player's own regions, and a neighboring enemy region - the
            // knight is removed from the enemy region, the replacement is placed into
            // the own region.
            ownRegionId: Type.String(),
            enemyRegionId: Type.String(),
            removedCol: Type.Number(),
            removedRow: Type.Number(),
            placedCol: Type.Number(),
            placedRow: Type.Number(),
            metadata: Type.Optional(PlayRenegadeCardMetadata) // Always optional, because it is an output
        })
    ])
)

export const PlayRenegadeCardValidator = Compile(PlayRenegadeCard)

export function isPlayRenegadeCard(action?: GameAction): action is PlayRenegadeCard {
    return action?.type === ActionType.PlayRenegadeCard
}

// Renegade: played alongside laying a decision card (not instead of it - the player
// still lays their card separately). Removes one knight from a neighboring enemy
// region and places one of the player's own stock knights into their own region that
// borders it. Effect happens immediately, whether or not the player ends up actually
// performing the action their decision card referred to.
export class HydratedPlayRenegadeCard
    extends HydratableAction<typeof PlayRenegadeCard>
    implements PlayRenegadeCard
{
    declare type: ActionType.PlayRenegadeCard
    declare playerId: string
    declare cardId: string
    declare ownRegionId: string
    declare enemyRegionId: string
    declare removedCol: number
    declare removedRow: number
    declare placedCol: number
    declare placedRow: number
    declare metadata?: PlayRenegadeCardMetadata

    constructor(data: PlayRenegadeCard) {
        super(data, PlayRenegadeCardValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidPlayRenegadeCard(state)) {
            throw Error('Invalid PlayRenegadeCard action')
        }

        const playerState = state.getPlayerState(this.playerId)
        const enemyRegion = state.regions.find((r) => r.id === this.enemyRegionId)!
        const victimColor = enemyRegion.ownerColor!
        // No "!" here: a region can belong to a NEUTRAL prince, which is a colour no player
        // holds, so this is legitimately undefined and the knight has no stock to go back
        // to. Asserting it non-null crashed the whole action the moment anyone played
        // Renegade against a neutral region. Same guarded lookup expandRegion uses when an
        // invasion takes spaces off a neutral owner.
        const victimPlayer = state.players.find((p) => p.color === victimColor)

        const removedSquare = getSquare(state.board, this.removedCol, this.removedRow)!
        const removalWoodedCostPaid = removedSquare.type === SquareType.Forest ? WOODED_KNIGHT_COST : undefined
        if (removalWoodedCostPaid) {
            playerState.money -= removalWoodedCostPaid
        }
        const { knightColor: _removedKnightColor, ...clearedSquare } = removedSquare
        state.board.squares[this.removedRow][this.removedCol] = clearedSquare
        // A neutral prince keeps no stock, so its removed knight simply leaves the board.
        if (victimPlayer) {
            victimPlayer.knightsInStock += 1
        }

        const placedSquare = getSquare(state.board, this.placedCol, this.placedRow)!
        state.board.squares[this.placedRow][this.placedCol] = { ...placedSquare, knightColor: playerState.color }
        playerState.knightsInStock -= 1
        const placementWoodedCostPaid = placedSquare.type === SquareType.Forest ? WOODED_KNIGHT_COST : undefined
        if (placementWoodedCostPaid) {
            playerState.money -= placementWoodedCostPaid
        }

        playerState.politicsCards = playerState.politicsCards.filter((c) => c.id !== this.cardId)

        this.metadata = {
            victimColor,
            removedSquareKey: squareKey(this.removedCol, this.removedRow),
            placedSquareKey: squareKey(this.placedCol, this.placedRow),
            ...(removalWoodedCostPaid ? { removalWoodedCostPaid } : {}),
            ...(placementWoodedCostPaid ? { placementWoodedCostPaid } : {})
        }
    }

    isValidPlayRenegadeCard(state: HydratedLowenherzGameState): boolean {
        return this.invalidPlayRenegadeCardReason(state) === undefined
    }

    // Same checks as isValidPlayRenegadeCard, but reports WHY a play is rejected - the
    // client uses this to show a specific message instead of one generic one.
    invalidPlayRenegadeCardReason(state: HydratedLowenherzGameState): string | undefined {
        if (currentChoosingPlayerId(state.turnOrder, state.firstPlayerId, state.decisions.length) !== this.playerId) {
            return "It isn't your turn to lay a decision card."
        }

        const playerState = state.getPlayerState(this.playerId)
        const card = playerState.politicsCards.find((c) => c.id === this.cardId)
        if (!card || card.type !== PoliticsCardType.Renegade) {
            return "That Renegade card isn't in your hand."
        }
        if (playerState.knightsInStock <= 0) {
            return "You have no knights left in your stock to place, so you can't play this card."
        }

        const ownRegion = state.regions.find((r) => r.id === this.ownRegionId)
        if (!ownRegion || ownRegion.ownerColor !== playerState.color) {
            return "That isn't one of your regions."
        }

        const enemyRegion = state.regions.find((r) => r.id === this.enemyRegionId)
        if (!enemyRegion || !enemyRegion.ownerColor || enemyRegion.ownerColor === playerState.color) {
            return "That isn't another prince's region."
        }

        if (!regionsAreNeighboring(ownRegion, enemyRegion)) {
            return "Those two regions don't border each other."
        }

        const removedKey = squareKey(this.removedCol, this.removedRow)
        if (!enemyRegion.squareKeys.includes(removedKey)) {
            return "That square isn't part of the target region."
        }
        const removedSquare = getSquare(state.board, this.removedCol, this.removedRow)
        if (!removedSquare || removedSquare.knightColor !== enemyRegion.ownerColor) {
            return "There's no enemy knight on that square."
        }
        if (!isKnightSafeToRemove(state, enemyRegion.ownerColor, this.removedCol, this.removedRow)) {
            return "Removing that knight would cut off another one of their knights from their castle."
        }

        const placedKey = squareKey(this.placedCol, this.placedRow)
        if (!ownRegion.squareKeys.includes(placedKey)) {
            return "That placement square isn't part of your region."
        }
        if (!isOnBoard(this.placedCol, this.placedRow)) {
            return 'That square is off the board.'
        }
        const placedSquare = getSquare(state.board, this.placedCol, this.placedRow)
        if (!placedSquare) {
            return 'That square is off the board.'
        }
        if (placedSquare.type !== SquareType.Blank && placedSquare.type !== SquareType.Forest) {
            return "Knights can't be placed on a hill or town space."
        }
        if (placedSquare.knightColor || placedSquare.castleColor) {
            return 'That square is already occupied.'
        }
        const isAdjacentToOwnPiece = neighbors(this.placedCol, this.placedRow).some((n) => {
            if (!isOnBoard(n.col, n.row)) return false
            if (isWalledBetween(state.board, this.placedCol, this.placedRow, n.col, n.row)) return false
            const neighborSquare = getSquare(state.board, n.col, n.row)
            return (
                neighborSquare?.knightColor === playerState.color ||
                neighborSquare?.castleColor === playerState.color
            )
        })
        if (!isAdjacentToOwnPiece) {
            return KNIGHT_NOT_ADJACENT_REASON
        }

        // Both a wooded removal and a wooded placement can apply to the same play (the
        // player pays for each independently in apply()) - check the combined cost up
        // front, not each in isolation, or a player with just enough for one could
        // still end up asked to pay for both.
        const removalWoodedCost = removedSquare.type === SquareType.Forest ? WOODED_KNIGHT_COST : 0
        const placementWoodedCost = placedSquare.type === SquareType.Forest ? WOODED_KNIGHT_COST : 0
        const totalWoodedCost = removalWoodedCost + placementWoodedCost
        if (totalWoodedCost > playerState.money) {
            return `Removing/placing a knight in the woods costs ${totalWoodedCost} ducats total, which you can't afford.`
        }

        return undefined
    }
}
