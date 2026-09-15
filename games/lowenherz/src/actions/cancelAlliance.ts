import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceOwner } from '../model/owner.js'
import { PoliticsCard, PoliticsCardType, removePoliticsCard } from '../definition/politicsCards.js'

export const ALLIANCE_CANCELLATION_COST = 10

export type CancelAllianceMetadata = Type.Static<typeof CancelAllianceMetadata>
export const CancelAllianceMetadata = Type.Object({
    otherOwner: PieceOwner,
    // Ducats actually paid from the player's money - the whole cost, or only the top-up when a
    // Treasure card covered the rest. Optional for actions recorded before it existed.
    ducatsPaid: Type.Optional(Type.Number()),
    // A snapshot of the Treasure card spent on the cost, if any.
    paidWithTreasureCard: Type.Optional(PoliticsCard)
})

export type CancelAlliance = Type.Static<typeof CancelAlliance>
export const CancelAlliance = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.CancelAlliance), // This action is always this type
            playerId: Type.String(), // Required now
            allianceId: Type.String(),
            // Optional Treasure card to put toward the cost instead of ducats - identified by its
            // printed value, since values are unique in the deck. A card worth less than the cost
            // is topped up from the player's money; any excess is lost, as for a wooded knight.
            treasureValue: Type.Optional(Type.Number()),
            metadata: Type.Optional(CancelAllianceMetadata) // Always optional, because it is an output
        })
    ])
)

export const CancelAllianceValidator = Compile(CancelAlliance)

export function isCancelAlliance(action?: GameAction): action is CancelAlliance {
    return action?.type === ActionType.CancelAlliance
}

// Ends an existing alliance early, by paying its 10-ducat cancellation cost to the
// bank - "an alliance can be ended at any time if one of the two players
// participating in it pays ten ducats to the bank."
//
// "Any time" here means any time it's the canceling player's turn to act at all -
// laying a decision card, but equally while spending an action they've won (placing
// knights, placing walls, taking a politics card). That's what makes the rulebook's
// central use of this card possible: an alliance blocks expansion between the two
// regions, so cancelling has to be available in the same breath as the knight action
// you'd then expand with - which is long past your decision-laying turn.
//
// It stops short of letting you cancel while ANOTHER player is acting, and that's a
// platform limit rather than a rules judgment: GameEngine.isPlayerAllowed rejects any
// action from a player who isn't in activePlayerIds, so out-of-turn actions aren't
// expressible for any game here.
export class HydratedCancelAlliance extends HydratableAction<typeof CancelAlliance> implements CancelAlliance {
    declare type: ActionType.CancelAlliance
    declare playerId: string
    declare allianceId: string
    declare treasureValue?: number
    declare metadata?: CancelAllianceMetadata

    constructor(data: CancelAlliance) {
        super(data, CancelAllianceValidator)
    }

    apply(state: HydratedLowenherzGameState, _context?: MachineContext) {
        if (!this.isValidCancelAlliance(state)) {
            throw Error('Invalid CancelAlliance action')
        }

        const playerState = state.getPlayerState(this.playerId)
        const alliance = state.alliances.find((a) => a.id === this.allianceId)!
        const regionA = state.regions.find((r) => r.id === alliance.regionAId)!
        const regionB = state.regions.find((r) => r.id === alliance.regionBId)!
        const otherOwner = regionA.owner === this.playerId ? regionB.owner! : regionA.owner!

        const ducatsPaid = this.ducatsToPay()
        const paidWithTreasureCard =
            this.treasureValue === undefined
                ? undefined
                : removePoliticsCard(playerState.getPoliticsCards(), {
                      type: PoliticsCardType.Treasure,
                      value: this.treasureValue
                  })
        if (paidWithTreasureCard) playerState.syncPoliticsCardCount()
        playerState.adjustMoney(-ducatsPaid)
        state.alliances = state.alliances.filter((a) => a.id !== this.allianceId)

        this.metadata = {
            otherOwner,
            ducatsPaid,
            ...(paidWithTreasureCard ? { paidWithTreasureCard } : {})
        }
    }

    private ducatsToPay(): number {
        return Math.max(0, ALLIANCE_CANCELLATION_COST - (this.treasureValue ?? 0))
    }

    isValidCancelAlliance(state: HydratedLowenherzGameState): boolean {
        return this.invalidCancelAllianceReason(state) === undefined
    }

    // Same checks as isValidCancelAlliance, but reports WHY a cancellation is
    // rejected - the client uses this to show a specific message instead of one
    // generic one.
    invalidCancelAllianceReason(state: HydratedLowenherzGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) {
            return "You can only cancel an alliance while it's your turn to act."
        }

        const alliance = state.alliances.find((a) => a.id === this.allianceId)
        if (!alliance) {
            return "That alliance doesn't exist (any more)."
        }

        const playerState = state.getPlayerState(this.playerId)
        const regionA = state.regions.find((r) => r.id === alliance.regionAId)
        const regionB = state.regions.find((r) => r.id === alliance.regionBId)
        const isParticipant = regionA?.owner === this.playerId || regionB?.owner === this.playerId
        if (!isParticipant) {
            return "You're not one of the two princes in that alliance."
        }

        if (this.treasureValue !== undefined) {
            const holdsCard = playerState
                .getPoliticsCards()
                .some((c) => c.type === PoliticsCardType.Treasure && c.value === this.treasureValue)
            if (!holdsCard) {
                return "That Treasure card isn't in your hand."
            }
            const topUp = this.ducatsToPay()
            if (playerState.getMoney() < topUp) {
                return `That Treasure card covers ${this.treasureValue} of the ${ALLIANCE_CANCELLATION_COST} ducats; you need ${topUp} more.`
            }
            return undefined
        }

        if (playerState.getMoney() < ALLIANCE_CANCELLATION_COST) {
            return `You need ${ALLIANCE_CANCELLATION_COST} ducats to cancel an alliance.`
        }

        return undefined
    }
}
