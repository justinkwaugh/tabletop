import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { CitizenshipTerms, CitizenshipTransfer } from '../model/citizenship.js'
import { ConsentRequestKind } from '../model/consent.js'
import { canUseGrandScepter, holdsGrandScepter, reliquarySlot } from '../util/imperial.js'
import { reasonTransferInvalid } from '../util/exchange.js'

export { CitizenshipTerms, CitizenshipTransfer }

export type OfferCitizenshipMetadata = Type.Static<typeof OfferCitizenshipMetadata>
export const OfferCitizenshipMetadata = Type.Object({
    // Carried on the action because the engine writes machineState after onAction returns.
    resumeMachineState: Type.Enum(MachineState)
})

export type OfferCitizenship = Type.Static<typeof OfferCitizenship>
export const OfferCitizenship = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.OfferCitizenship),
            playerId: Type.String(),
            exilePlayerId: Type.String(),
            reliquarySlotId: Type.String(),
            terms: Type.Optional(CitizenshipTerms),
            metadata: Type.Optional(OfferCitizenshipMetadata)
        })
    ])
)

export const OfferCitizenshipValidator = Compile(OfferCitizenship)

export function isOfferCitizenship(action?: GameAction): action is OfferCitizenship {
    return action?.type === ActionType.OfferCitizenship
}

export class HydratedOfferCitizenship
    extends HydratableAction<typeof OfferCitizenship>
    implements OfferCitizenship
{
    declare type: ActionType.OfferCitizenship
    declare playerId: string
    declare exilePlayerId: string
    declare reliquarySlotId: string
    declare terms?: CitizenshipTerms
    declare metadata?: OfferCitizenshipMetadata

    constructor(data: OfferCitizenship) {
        super(data, OfferCitizenshipValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = HydratedOfferCitizenship.reasonCannotOffer(state, this.playerId, this)
        if (reason) {
            throw Error(`Cannot offer Citizenship: ${reason}`)
        }

        state.pendingConsent = {
            request: {
                kind: ConsentRequestKind.CitizenshipOffer,
                exilePlayerId: this.exilePlayerId,
                reliquarySlotId: this.reliquarySlotId,
                terms: this.terms
            },
            askingPlayerId: this.playerId,
            askedPlayerId: this.exilePlayerId,
            resumeMachineState: MachineState.ActPhase
        }

        // R-X.3: nothing moved and no vault was read, so the offer is undoable until answered.
        this.revealsInfo = false

        this.metadata = { resumeMachineState: MachineState.ActPhase }
    }

    static reasonCannotOffer(
        state: HydratedOathGameState,
        playerId: string,
        choice: {
            exilePlayerId: string
            reliquarySlotId: string
            terms?: CitizenshipTerms
        }
    ): string | undefined {
        if (state.pendingConsent) {
            return 'a question is already open and unanswered'
        }

        // R-6.6.1: the Grand Scepter, not the Chancellor's seat.
        if (!holdsGrandScepter(state, playerId)) {
            return 'offering Citizenship requires the Grand Scepter'
        }
        if (!canUseGrandScepter(state, playerId)) {
            return 'the Grand Scepter cannot be used on the turn it was taken'
        }

        const exile = state.findPlayerState(choice.exilePlayerId)
        if (!exile) return `no such player ${choice.exilePlayerId}`
        // R-6.6.1: "any Exile (including yourself)", so no self-offer check.
        if (exile.status !== PlayerStatus.Exile) {
            return `${choice.exilePlayerId} is a ${exile.status}, not an Exile`
        }

        if (!reliquarySlot(state, choice.reliquarySlotId)) {
            return `${choice.reliquarySlotId} is not an occupied space in the Imperial Reliquary`
        }

        return reasonTermsInvalid(state, playerId, choice.exilePlayerId, choice.terms)
    }

    static canDoOfferCitizenship(state: HydratedOathGameState, playerId: string): boolean {
        if (!canUseGrandScepter(state, playerId)) return false
        if (state.reliquarySlots().length === 0) return false
        return state.players.some((p) => p.status === PlayerStatus.Exile)
    }
}

export function reasonTermsInvalid(
    state: HydratedOathGameState,
    scepterHolderId: string,
    exileId: string,
    terms?: CitizenshipTerms
): string | undefined {
    if (!terms) return undefined
    return (
        reasonTransferInvalid(state, scepterHolderId, exileId, terms.fromScepterHolder) ??
        reasonTransferInvalid(state, exileId, scepterHolderId, terms.fromExile)
    )
}
