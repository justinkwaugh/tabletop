import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { afterTravelPersistent } from '../util/persistent.js'
import { payTolls } from '../util/tolls.js'
import { flipSecretFacedown, shroudedWoodChooser } from '../util/siteTravel.js'
import { ActionType } from '../definition/actions.js'
import {
    modifierSummary,
    ModifierUse,
    ModifierUses,
    payModifierCosts,
    runAfter
} from '../util/modifiers.js'
import { flipSiteFromVault } from '../util/hiddenInputs.js'
import { isFreeTravelNow, woodTravelPaysAtPick } from '../util/shroudedWood.js'
import { nextActionIndex } from '../util/freeActions.js'
import {
    endStepOutOfTurn,
    freeActionOutOfTurnOfferedTo,
    holdTurnForFreeActionOutOfTurn
} from '../util/sneakAttack.js'
import { MachineState } from '../definition/states.js'
import { pawnSiteId } from '../util/pawn.js'
import { askQuestion } from '../util/questions.js'
import { PowerQuestionKind } from '../model/question.js'
import {
    canTravel,
    legalTravelDestinations,
    legalTravelTerms,
    reasonCannotLeaveShroudedWood,
    reasonCannotTravel,
    shroudedWoodTravelCost,
    travelCostFor,
    travelPlan
} from '../util/travelPlan.js'

export type { TravelTerms } from '../util/travelPlan.js'

export type TravelMetadata = Type.Static<typeof TravelMetadata>
export const TravelMetadata = Type.Object({
    fromSiteId: Type.Optional(Type.String()),
    /** R-11.7 */
    destinationChooser: Type.Optional(Type.String()),
    /** R-11.7 — the Supply is paid when the Shrouded Wood's ruler picks the site. */
    paysAtPick: Type.Optional(Type.Boolean()),
    supplySpent: Type.Number(),
    supplyRemaining: Type.Number(),
    /** R-5.6.2 */
    revealedSiteCardId: Type.Optional(Type.String()),
    /** R-2.8.2 */
    relicsRevealed: Type.Optional(Type.Number()),
    /** R-7.4 */
    modifiers: Type.Optional(Type.Array(Type.String())),
    modifierNotes: Type.Optional(Type.Array(Type.String())),
    /** R-4.2 (Special Envoy) */
    endsActPhase: Type.Optional(Type.Boolean()),
    /** R-7.1.4 */
    tollsPaid: Type.Optional(Type.Array(Type.String())),
    /** R-11 */
    siteNotes: Type.Optional(Type.Array(Type.String())),
    secretFlipped: Type.Optional(Type.Boolean()),
    /** Second Wind out of turn (revision 7) — the card whose free Travel this was. */
    freeActionOf: Type.Optional(Type.String()),
    /** Second Wind out of turn — where the held turn resumes once nothing more is asked. */
    resumeMachineState: Type.Optional(Type.Enum(MachineState))
})

export type Travel = Type.Static<typeof Travel>
export const Travel = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Travel),
            playerId: Type.String(),
            /** R-11.7 — absent when the ruler of the Shrouded Wood being left chooses it. */
            siteId: Type.Optional(Type.String()),
            /** R-7.4 — declared at the start of the action. */
            modifiers: ModifierUses,
            /** R-7.1.4 (Toll Roads, Way Station) */
            tolls: Type.Optional(Type.Array(Type.String(), { maxItems: 8 })),
            /** R-11.12, R-11.13 — for the site that asks. */
            flipSecret: Type.Optional(Type.Boolean()),
            metadata: Type.Optional(TravelMetadata)
        })
    ])
)

export const TravelValidator = Compile(Travel)

export function isTravel(action?: GameAction): action is Travel {
    return action?.type === ActionType.Travel
}

export class HydratedTravel extends HydratableAction<typeof Travel> implements Travel {
    declare type: ActionType.Travel
    declare playerId: string
    declare siteId?: string
    declare modifiers?: ModifierUse[]
    declare tolls?: string[]
    declare flipSecret?: boolean
    declare metadata?: TravelMetadata

    constructor(data: Travel) {
        super(data, TravelValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        // Second Wind out of turn (revision 7) — the Travel is the holder's answer to "Travel now?".
        const outOfTurn = freeActionOutOfTurnOfferedTo(state, this.playerId, ActionType.Travel)
        const chooser = shroudedWoodChooser(state, this.playerId)
        if (chooser !== undefined) {
            this.leaveShroudedWood(state, chooser, outOfTurn?.cardId)
            return
        }
        const siteId = this.siteId
        if (siteId === undefined) throw Error('Cannot travel: no destination is named')
        const player = state.getPlayerState(this.playerId)
        const plan = HydratedTravel.plan(
            state,
            this.playerId,
            siteId,
            this.modifiers,
            this.tolls,
            this.flipSecret
        )
        if (plan.reason) {
            throw Error(`Cannot travel: ${plan.reason}`)
        }
        const { cost, active } = plan
        if (outOfTurn) holdTurnForFreeActionOutOfTurn(state, this.playerId, ActionType.Travel)
        // R-11.12, R-11.13
        if (this.flipSecret) flipSecretFacedown(state, this.playerId)

        const fromSiteId = pawnSiteId(state, this.playerId)

        // R-7.1.2, R-7.4 — paid at declaration.
        payModifierCosts(state, this.playerId, active)
        // R-7.1.4 (Toll Roads, Way Station) — paid before the move.
        const tollNotes = payTolls(
            state,
            this.playerId,
            { kind: 'travel', toSiteId: siteId },
            this.tolls
        )

        player.spendSupply(cost)
        HydratedTravel.useFreeTravel(state, this.playerId)

        // R-5.6.2
        player.siteId = siteId

        const revealed = state.isSiteFaceup(siteId) ? undefined : flipSiteFromVault(state, siteId)
        this.revealsInfo = revealed !== undefined

        // R-7.4 (Tyrant, Special Envoy) — once the pawn has arrived.
        const after = runAfter(state, this.playerId, active, { destinationSiteId: siteId })
        // R-7.1.4 (Grasping Vines, Boiling Lake)
        const persistent = afterTravelPersistent(state, this.playerId, fromSiteId, siteId)

        this.metadata = {
            fromSiteId,
            supplySpent: cost,
            supplyRemaining: player.supply,
            ...HydratedTravel.afterStepOutOfTurn(state, this.playerId, outOfTurn?.cardId),
            revealedSiteCardId: revealed?.siteCardId,
            relicsRevealed: revealed?.relicsRevealed ?? 0,
            modifiers: active.length > 0 ? modifierSummary(active) : undefined,
            modifierNotes:
                after.notes.length + persistent.length > 0
                    ? [...after.notes, ...persistent]
                    : undefined,
            // Like Martial Culture's, an "end your Act Phase" ends nothing for a traveller out of turn.
            endsActPhase: (after.endsActPhase && !outOfTurn) || undefined,
            tollsPaid: tollNotes.length > 0 ? tollNotes : undefined,
            siteNotes: plan.siteNotes.length > 0 ? plan.siteNotes : undefined,
            secretFlipped: this.flipSecret || undefined
        }
    }

    // R-11.7, R-X.4 — the ruler's answer moves the pawn and, from `UiBatch1`, pays.
    private leaveShroudedWood(
        state: HydratedOathGameState,
        chooser: string,
        outOfTurnBy: string | undefined
    ) {
        const reason = HydratedTravel.reasonCannotLeaveShroudedWood(state, this.playerId, this)
        if (reason) throw Error(`Cannot travel: ${reason}`)
        if (outOfTurnBy) holdTurnForFreeActionOutOfTurn(state, this.playerId, ActionType.Travel)
        const player = state.getPlayerState(this.playerId)
        const fromSiteId = pawnSiteId(state, this.playerId)
        const paysAtPick = woodTravelPaysAtPick(state)
        const free = isFreeTravelNow(state, this.playerId)
        const cost = paysAtPick ? 0 : HydratedTravel.shroudedWoodCost(state, this.playerId)
        player.spendSupply(cost)
        HydratedTravel.useFreeTravel(state, this.playerId)
        askQuestion(state, this.playerId, {
            kind: PowerQuestionKind.ShroudedWoodDestination,
            cardId: state.siteCardAt(fromSiteId) ?? fromSiteId,
            askedPlayerId: chooser,
            travelerPlayerId: this.playerId,
            fromSiteId,
            ...(paysAtPick ? { travel: { free } } : {})
        })
        this.metadata = {
            fromSiteId,
            destinationChooser: chooser,
            paysAtPick: paysAtPick || undefined,
            supplySpent: cost,
            supplyRemaining: player.supply,
            ...HydratedTravel.afterStepOutOfTurn(state, this.playerId, outOfTurnBy)
        }
    }

    /** Second Wind out of turn — the free Campaign is asked next, after the Travel's own questions. */
    private static afterStepOutOfTurn(
        state: HydratedOathGameState,
        playerId: string,
        outOfTurnBy: string | undefined
    ): Pick<TravelMetadata, 'freeActionOf' | 'resumeMachineState'> {
        if (outOfTurnBy === undefined) return {}
        return {
            freeActionOf: outOfTurnBy,
            resumeMachineState: endStepOutOfTurn(state, playerId)
        }
    }

    // Second Wind, Brass Horse — the free Travel is this action; a free Campaign may follow it.
    private static useFreeTravel(state: HydratedOathGameState, playerId: string) {
        const player = state.getPlayerState(playerId)
        if (player.freeTravelAtAction !== state.actionCount) return
        delete player.freeTravelAtAction
        if (player.freeCampaignAtAction === state.actionCount) {
            player.freeCampaignAtAction = nextActionIndex(state)
        }
    }

    static readonly shroudedWoodCost = shroudedWoodTravelCost
    static readonly reasonCannotLeaveShroudedWood = reasonCannotLeaveShroudedWood
    static readonly plan = travelPlan
    static readonly reasonCannotTravel = reasonCannotTravel
    static readonly costFor = travelCostFor
    static readonly legalTerms = legalTravelTerms
    static readonly legalDestinations = legalTravelDestinations
    static readonly canDoTravel = canTravel
}
