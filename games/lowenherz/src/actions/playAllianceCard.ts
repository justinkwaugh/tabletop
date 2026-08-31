import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
import { regionsAreNeighboring } from '../util/regionScoring.js'
import { areRegionsAllied } from '../util/allianceHelpers.js'
import { currentChoosingPlayerId } from '../util/decisionPlan.js'
import { PieceOwner } from '../model/owner.js'

export type PlayAllianceCardMetadata = Type.Static<typeof PlayAllianceCardMetadata>
export const PlayAllianceCardMetadata = Type.Object({
    allianceId: Type.String(),
    enemyOwner: PieceOwner
})

export type PlayAllianceCard = Type.Static<typeof PlayAllianceCard>
export const PlayAllianceCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.PlayAllianceCard), // This action is always this type
            playerId: Type.String(), // Required now
            cardId: Type.String(),
            // One of the player's own regions, and a neighboring enemy region - once
            // chosen, "this cannot be changed" (the rulebook's wording).
            ownRegionId: Type.String(),
            enemyRegionId: Type.String(),
            metadata: Type.Optional(PlayAllianceCardMetadata) // Always optional, because it is an output
        })
    ])
)

export const PlayAllianceCardValidator = Compile(PlayAllianceCard)

export function isPlayAllianceCard(action?: GameAction): action is PlayAllianceCard {
    return action?.type === ActionType.PlayAllianceCard
}

// Alliance: played alongside laying a decision card (not instead of it - the player
// still lays their card separately). Links one of the player's own regions with a
// neighboring enemy region so that neither can be expanded into the other (see the
// check in expandRegion.ts), until it's ended by paying the 10-ducat cancellation
// cost (see cancelAlliance.ts). Effect happens immediately, whether or not the player
// ends up actually performing the action their decision card referred to.
export class HydratedPlayAllianceCard
    extends HydratableAction<typeof PlayAllianceCard>
    implements PlayAllianceCard
{
    declare type: ActionType.PlayAllianceCard
    declare playerId: string
    declare cardId: string
    declare ownRegionId: string
    declare enemyRegionId: string
    declare metadata?: PlayAllianceCardMetadata

    constructor(data: PlayAllianceCard) {
        super(data, PlayAllianceCardValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidPlayAllianceCard(state)) {
            throw Error('Invalid PlayAllianceCard action')
        }

        const playerState = state.getPlayerState(this.playerId)
        const enemyRegion = state.regions.find((r) => r.id === this.enemyRegionId)!

        playerState.politicsCards = playerState.politicsCards.filter((c) => c.id !== this.cardId)

        state.alliances.push({
            id: this.id,
            regionAId: this.ownRegionId,
            regionBId: this.enemyRegionId
        })

        this.metadata = {
            allianceId: this.id,
            enemyOwner: enemyRegion.owner!
        }
    }

    isValidPlayAllianceCard(state: HydratedLowenherzGameState): boolean {
        return this.invalidPlayAllianceCardReason(state) === undefined
    }

    // Same checks as isValidPlayAllianceCard, but reports WHY a play is rejected - the
    // client uses this to show a specific message instead of one generic one.
    invalidPlayAllianceCardReason(state: HydratedLowenherzGameState): string | undefined {
        if (currentChoosingPlayerId(state.turnOrder, state.firstPlayerId, state.decisions.length) !== this.playerId) {
            return "It isn't your turn to lay a decision card."
        }

        const playerState = state.getPlayerState(this.playerId)
        const card = playerState.politicsCards.find((c) => c.id === this.cardId)
        if (!card || card.type !== PoliticsCardType.Alliance) {
            return "That Alliance card isn't in your hand."
        }

        const ownRegion = state.regions.find((r) => r.id === this.ownRegionId)
        if (!ownRegion || ownRegion.owner !== this.playerId) {
            return "That isn't one of your regions."
        }

        const enemyRegion = state.regions.find((r) => r.id === this.enemyRegionId)
        if (!enemyRegion || !enemyRegion.owner || enemyRegion.owner === this.playerId) {
            return "That isn't another prince's region."
        }

        if (!regionsAreNeighboring(ownRegion, enemyRegion)) {
            return "Those two regions don't border each other."
        }

        if (areRegionsAllied(state.alliances, ownRegion.id, enemyRegion.id)) {
            return 'Those two regions are already allied.'
        }

        return undefined
    }
}
