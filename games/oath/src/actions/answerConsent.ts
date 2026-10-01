import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { ConsentRequestKind, type ConsentRequest } from '../model/consent.js'
import { CampaignBattleMetadata, HydratedCampaign } from './campaign.js'
import { HydratedMoveWarbands } from './moveWarbands.js'
import { usableBattlePlans } from '../util/battlePlans.js'
import { BattlePlanSide } from '../data/cardPowers.js'

export type AnswerConsentMetadata = Type.Static<typeof AnswerConsentMetadata>
export const AnswerConsentMetadata = Type.Object({
    kind: Type.Enum(ConsentRequestKind),
    granted: Type.Boolean(),
    askingPlayerId: Type.String(),
    /** R-5.5.2.a */
    citizenPlayerId: Type.Optional(Type.String()),
    /** Carried on the action because the engine writes machineState after onAction returns. */
    resumeMachineState: Type.Optional(Type.Enum(MachineState)),
    /** R-5.5.2.a — the last answer musters the Campaign it held. */
    battle: Type.Optional(CampaignBattleMetadata)
})

/** R-X.1, R-6.5.a, R-6.5.b, R-5.5.2.a */
export type AnswerConsent = Type.Static<typeof AnswerConsent>
export const AnswerConsent = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AnswerConsent),
            playerId: Type.String(),
            granted: Type.Boolean(),
            metadata: Type.Optional(AnswerConsentMetadata)
        })
    ])
)

export const AnswerConsentValidator = Compile(AnswerConsent)

export function isAnswerConsent(action?: GameAction): action is AnswerConsent {
    return action?.type === ActionType.AnswerConsent
}

export class HydratedAnswerConsent
    extends HydratableAction<typeof AnswerConsent>
    implements AnswerConsent
{
    declare type: ActionType.AnswerConsent
    declare playerId: string
    declare granted: boolean
    declare metadata?: AnswerConsentMetadata

    constructor(data: AnswerConsent) {
        super(data, AnswerConsentValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = HydratedAnswerConsent.reasonCannotAnswer(state, this.playerId, this.granted)
        if (reason) {
            throw Error(`Cannot answer: ${reason}`)
        }
        const pending = state.pendingConsent
        assertExists(pending, 'no request is open')
        const request = pending.request
        state.pendingConsent = undefined

        let citizenPlayerId: string | undefined
        let battle: CampaignBattleMetadata | undefined
        switch (request.kind) {
            case ConsentRequestKind.WarbandMove: {
                if (!this.granted) break
                const endpoints = HydratedMoveWarbands.endpoints(
                    state,
                    pending.askingPlayerId,
                    request.move
                )
                HydratedMoveWarbands.carryOut(
                    state,
                    endpoints.from,
                    endpoints.to,
                    request.owner,
                    request.count
                )
                break
            }
            case ConsentRequestKind.JoinDefence:
                citizenPlayerId = request.citizenPlayerId
                if (this.granted) HydratedAnswerConsent.askDefenderToAdmit(state, citizenPlayerId)
                else battle = HydratedAnswerConsent.askNextOrMuster(state)
                break
            case ConsentRequestKind.AdmitAlly: {
                citizenPlayerId = request.citizenPlayerId
                const held = state.pendingCampaign
                assertExists(held, 'An ally is admitted only to a held Campaign')
                if (this.granted) held.declaration.allyPlayerIds.push(citizenPlayerId)
                battle = HydratedAnswerConsent.askNextOrMuster(state)
                break
            }
            case ConsentRequestKind.CitizenshipOffer:
                throw Error('A Citizenship offer is answered by ResolveCitizenshipOffer')
        }

        // R-X.3 — the muster rolls, or commits to the roll the defending side's plans precede.
        this.revealsInfo = battle !== undefined
        this.metadata = {
            kind: request.kind,
            granted: this.granted,
            askingPlayerId: pending.askingPlayerId,
            citizenPlayerId,
            resumeMachineState: pending.resumeMachineState,
            battle
        }
    }

    /** R-5.5.2.a */
    private static askNextOrMuster(
        state: HydratedOathGameState
    ): CampaignBattleMetadata | undefined {
        const held = state.pendingCampaign
        assertExists(held, 'Citizens are asked only while a Campaign is held for them')
        const [, next, ...rest] = held.toAsk
        if (next !== undefined) {
            held.toAsk = [next, ...rest]
            HydratedCampaign.askToJoinDefence(state)
            return undefined
        }
        // R-5.5.3 — the attacker's plans follow the Citizens' answers.
        const attackerId = held.declaration.attackerPlayerId
        if (usableBattlePlans(state, attackerId, BattlePlanSide.Attacker).length > 0) {
            held.awaitingAttackerPlans = true
            return undefined
        }
        state.pendingCampaign = undefined
        return HydratedCampaign.muster(state, held.declaration)
    }

    private static askDefenderToAdmit(state: HydratedOathGameState, citizenPlayerId: string) {
        const held = state.pendingCampaign
        assertExists(held, 'Citizens are asked only while a Campaign is held for them')
        const defenderPlayerId = held.declaration.defenderPlayerId
        assertExists(defenderPlayerId, 'R-5.5.2.a asks Citizens only when a player defends')
        state.pendingConsent = {
            request: { kind: ConsentRequestKind.AdmitAlly, citizenPlayerId },
            askingPlayerId: citizenPlayerId,
            askedPlayerId: defenderPlayerId
        }
    }

    static reasonCannotAnswer(
        state: HydratedOathGameState,
        playerId: string,
        granted: boolean
    ): string | undefined {
        const pending = state.pendingConsent
        if (!pending || pending.request.kind === ConsentRequestKind.CitizenshipOffer) {
            return 'no request is open'
        }
        if (playerId !== pending.askedPlayerId) {
            return `the request was made to ${pending.askedPlayerId}, not to ${playerId}`
        }
        return granted
            ? HydratedAnswerConsent.reasonCannotGrant(
                  state,
                  pending.askingPlayerId,
                  pending.request
              )
            : undefined
    }

    /** R-6.5 — a move granted must still be one its player could make. */
    private static reasonCannotGrant(
        state: HydratedOathGameState,
        askingPlayerId: string,
        request: ConsentRequest
    ): string | undefined {
        return request.kind === ConsentRequestKind.WarbandMove
            ? HydratedMoveWarbands.reasonCannotMove(state, askingPlayerId, request)
            : undefined
    }

    static canDoAnswerConsent(state: HydratedOathGameState, playerId: string): boolean {
        const pending = state.pendingConsent
        return (
            pending !== undefined &&
            pending.request.kind !== ConsentRequestKind.CitizenshipOffer &&
            pending.askedPlayerId === playerId
        )
    }
}
