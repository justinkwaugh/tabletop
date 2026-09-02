import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceOwner } from '../model/owner.js'

export const ALLIANCE_CANCELLATION_COST = 10

export type CancelAllianceMetadata = Type.Static<typeof CancelAllianceMetadata>
export const CancelAllianceMetadata = Type.Object({
    otherOwner: PieceOwner
})

export type CancelAlliance = Type.Static<typeof CancelAlliance>
export const CancelAlliance = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.CancelAlliance), // This action is always this type
            playerId: Type.String(), // Required now
            allianceId: Type.String(),
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
    declare metadata?: CancelAllianceMetadata

    constructor(data: CancelAlliance) {
        super(data, CancelAllianceValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidCancelAlliance(state)) {
            throw Error('Invalid CancelAlliance action')
        }

        const playerState = state.getPlayerState(this.playerId)
        const alliance = state.alliances.find((a) => a.id === this.allianceId)!
        const regionA = state.regions.find((r) => r.id === alliance.regionAId)!
        const regionB = state.regions.find((r) => r.id === alliance.regionBId)!
        const otherOwner = regionA.owner === this.playerId ? regionB.owner! : regionA.owner!

        playerState.money -= ALLIANCE_CANCELLATION_COST
        state.alliances = state.alliances.filter((a) => a.id !== this.allianceId)

        this.metadata = { otherOwner }
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

        if (playerState.money < ALLIANCE_CANCELLATION_COST) {
            return `You need ${ALLIANCE_CANCELLATION_COST} ducats to cancel an alliance.`
        }

        return undefined
    }
}
