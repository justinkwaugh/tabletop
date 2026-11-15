import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import {
    TrackConsent,
    pendingCompanyDecision,
    type CompanyDecisionState
} from '../privates/companyDecision.js'
import { TrackRequest, TrackConstruction, type TrackRules } from './trackConstruction.js'
import { applyTrackLay } from './layTile.js'
export const RequestTrackConsent = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        ...TrackRequest.properties,
        type: Type.Literal('RequestTrackConsent'),
        expectedCost: Type.Integer({ minimum: 0 }),
        /** The player asked, where more than one player's agreement would serve. */
        askedPlayerId: Type.Optional(Type.String())
    },
    { additionalProperties: false }
)
export type RequestTrackConsent = Type.Static<typeof RequestTrackConsent>
const Validator = Compile(RequestTrackConsent)
export class HydratedRequestTrackConsent
    extends HydratableAction<typeof RequestTrackConsent>
    implements RequestTrackConsent
{
    declare type: 'RequestTrackConsent'
    declare playerId: string
    declare companyId: string
    declare locationId: string
    declare definitionId: string
    declare rotation: TrackRequest['rotation']
    declare nodeMapping: TrackRequest['nodeMapping']
    declare expectedCost: number
    declare askedPlayerId?: string
    readonly #rules: TrackRules
    constructor(data: RequestTrackConsent, rules: TrackRules) {
        super(data instanceof HydratedRequestTrackConsent ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: CompanyDecisionState): boolean {
        const construction = new TrackConstruction(state, this.#rules)
        const details = construction.evaluate(this).details
        const consenters = construction.consenters(this)
        return (
            this.source === ActionSource.User &&
            state.machineState === 'LayingTrack' &&
            !pendingCompanyDecision(state) &&
            state.activePlayerIds.includes(this.playerId) &&
            construction.canAct(this.playerId, this.companyId) &&
            details?.cost === this.expectedCost &&
            consenters.length > 0 &&
            !consenters.includes(this.playerId) &&
            (this.askedPlayerId === undefined || consenters.includes(this.askedPlayerId))
        )
    }
    apply(state: HydratedGameState & CompanyDecisionState): void {
        assert(this.isValid(state), 'Invalid track permission request')
        const details = new TrackConstruction(state, this.#rules).evaluate(this).details
        assertExists(details, 'A valid request has its lay')
        state.trackConsent = {
            id: this.id,
            playerId: this.playerId,
            details: this.askedPlayerId
                ? { ...details, consentPlayerId: this.askedPlayerId }
                : details
        }
    }
}
export const RespondToTrackConsent = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('RespondToTrackConsent'),
        requestId: Type.String(),
        accept: Type.Boolean(),
        metadata: Type.Optional(Type.Object({ request: TrackConsent, accepted: Type.Boolean() }))
    },
    { additionalProperties: false }
)
export type RespondToTrackConsent = Type.Static<typeof RespondToTrackConsent>
const ResponseValidator = Compile(RespondToTrackConsent)
export class HydratedRespondToTrackConsent
    extends HydratableAction<typeof RespondToTrackConsent>
    implements RespondToTrackConsent
{
    declare type: 'RespondToTrackConsent'
    declare playerId: string
    declare requestId: string
    declare accept: boolean
    declare metadata?: RespondToTrackConsent['metadata']
    readonly #rules: TrackRules
    constructor(data: RespondToTrackConsent, rules: TrackRules) {
        super(
            data instanceof HydratedRespondToTrackConsent ? data.dehydrate() : data,
            ResponseValidator
        )
        this.#rules = rules
    }
    isValid(state: CompanyDecisionState): boolean {
        const pending = state.trackConsent
        if (
            this.source !== ActionSource.User ||
            pending?.id !== this.requestId ||
            pending.details.consentPlayerId !== this.playerId ||
            !state.activePlayerIds.includes(this.playerId)
        )
            return false
        if (!this.accept) return true
        const construction = new TrackConstruction(state, this.#rules)
        const current = construction.evaluate(pending.details).details
        return (
            construction.canAct(pending.playerId, pending.details.companyId) &&
            current?.cost === pending.details.cost &&
            construction.consenters(pending.details).includes(this.playerId)
        )
    }
    apply(state: HydratedGameState & CompanyDecisionState): void {
        assert(this.isValid(state), 'Invalid or stale track permission response')
        const request = state.trackConsent!
        if (this.accept) {
            const details = new TrackConstruction(state, this.#rules).evaluate(
                request.details
            ).details!
            applyTrackLay(
                state,
                this.#rules,
                details,
                { kind: 'company', companyId: details.companyId },
                true
            )
        }
        delete state.trackConsent
        this.metadata = { request, accepted: this.accept }
    }
}

export function isRequestTrackConsent(action: GameAction): action is RequestTrackConsent {
    return (
        action instanceof HydratedRequestTrackConsent ||
        (action.type === 'RequestTrackConsent' && Validator.Check(action))
    )
}

export function isRespondToTrackConsent(action: GameAction): action is RespondToTrackConsent {
    return (
        action instanceof HydratedRespondToTrackConsent ||
        (action.type === 'RespondToTrackConsent' && ResponseValidator.Check(action))
    )
}
