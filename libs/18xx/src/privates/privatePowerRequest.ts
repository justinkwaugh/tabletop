import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    PlayerAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { getCompany, privateOwner } from '../finance/finance.js'
import type { CompanyDecisionState } from './companyDecision.js'
import { privateTrackConstruction, type PrivatePowerRules } from './privatePowers.js'
import type { TrackRules } from '../construction/trackConstruction.js'

export const PrivatePowerRequestDropReason = Type.Union([
    Type.Literal('no-legal-use'),
    Type.Literal('private-closed'),
    Type.Literal('owner-changed')
])
export type PrivatePowerRequestDropReason = Type.Static<typeof PrivatePowerRequestDropReason>

export const SetPrivatePowerRequest = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('SetPrivatePowerRequest'),
        outOfTurn: Type.Literal(true),
        supersedable: Type.Literal(true),
        requested: Type.Boolean()
    },
    { additionalProperties: false }
)
export type SetPrivatePowerRequest = Type.Static<typeof SetPrivatePowerRequest>
const SetValidator = Compile(SetPrivatePowerRequest)
export function isSetPrivatePowerRequest(action: GameAction): action is SetPrivatePowerRequest {
    return (
        action instanceof HydratedSetPrivatePowerRequest ||
        (action.type === 'SetPrivatePowerRequest' && SetValidator.Check(action))
    )
}

const DropFields = Type.Object(
    {
        type: Type.Literal('DropPrivatePowerRequest'),
        requesterId: Type.String(),
        reason: PrivatePowerRequestDropReason
    },
    { additionalProperties: false }
)
export const DropPrivatePowerRequest: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof DropFields.properties
> = Type.Object(
    { ...GameAction.properties, ...DropFields.properties },
    { additionalProperties: false }
)
export type DropPrivatePowerRequest = Type.Static<typeof DropPrivatePowerRequest>
const DropValidator = Compile(DropPrivatePowerRequest)
export function isDropPrivatePowerRequest(action: GameAction): action is DropPrivatePowerRequest {
    return (
        action instanceof HydratedDropPrivatePowerRequest ||
        (action.type === 'DropPrivatePowerRequest' && DropValidator.Check(action))
    )
}

export function hasPrivatePowerRequest(state: CompanyDecisionState, playerId: string): boolean {
    return state.privatePowerRequests?.includes(playerId) ?? false
}

export function endPrivatePowerRequest(state: CompanyDecisionState, playerId: string): void {
    const remaining = (state.privatePowerRequests ?? []).filter((id) => id !== playerId)
    if (remaining.length) state.privatePowerRequests = remaining
    else delete state.privatePowerRequests
}

export function requestablePrivateIds(
    state: CompanyDecisionState,
    playerId: string,
    rules: PrivatePowerRules
): string[] {
    return (rules.betweenTurnsPrivateIds ?? []).filter((id) => {
        const owner = privateOwner(state, id)
        return (
            owner?.kind === 'player' &&
            owner.playerId === playerId &&
            !getCompany(state, id).closed &&
            !state.usedPrivatePowerIds.includes(id)
        )
    })
}

export function hasLegalPrivateTrackUse(
    state: CompanyDecisionState,
    privateCompanyId: string,
    playerId: string,
    rules: PrivatePowerRules,
    track: TrackRules
): boolean {
    const terms = rules.trackTerms(state, privateCompanyId, playerId)
    if (!terms) return false
    const construction = privateTrackConstruction(state, terms, track)
    return terms.locationIds.some((id) => construction.choices(id).length > 0)
}

export function privatePowerRequestDropReason(
    state: CompanyDecisionState,
    playerId: string,
    rules: PrivatePowerRules,
    track: TrackRules
): PrivatePowerRequestDropReason | undefined {
    const ids = rules.betweenTurnsPrivateIds ?? []
    const owned = ids.filter((id) => {
        const owner = privateOwner(state, id)
        return owner?.kind === 'player' && owner.playerId === playerId
    })
    if (!owned.length) return 'owner-changed'
    const open = owned.filter((id) => !getCompany(state, id).closed)
    if (!open.length) return 'private-closed'
    return open.some((id) => hasLegalPrivateTrackUse(state, id, playerId, rules, track))
        ? undefined
        : 'no-legal-use'
}

export class HydratedSetPrivatePowerRequest
    extends HydratableAction<typeof SetPrivatePowerRequest>
    implements SetPrivatePowerRequest
{
    declare type: 'SetPrivatePowerRequest'
    declare playerId: string
    declare outOfTurn: true
    declare supersedable: true
    declare requested: boolean
    readonly #rules: PrivatePowerRules
    constructor(data: SetPrivatePowerRequest, rules: PrivatePowerRules) {
        super(
            data instanceof HydratedSetPrivatePowerRequest ? data.dehydrate() : data,
            SetValidator
        )
        this.#rules = rules
    }
    isValid(state: CompanyDecisionState): boolean {
        return (
            this.source === ActionSource.User &&
            (this.requested
                ? !hasPrivatePowerRequest(state, this.playerId) &&
                  requestablePrivateIds(state, this.playerId, this.#rules).length > 0
                : hasPrivatePowerRequest(state, this.playerId))
        )
    }
    apply(state: HydratedGameState & CompanyDecisionState): void {
        assert(this.isValid(state), 'Invalid private power request')
        if (this.requested)
            state.privatePowerRequests = [...(state.privatePowerRequests ?? []), this.playerId]
        else endPrivatePowerRequest(state, this.playerId)
    }
}

export class HydratedDropPrivatePowerRequest
    extends HydratableAction<typeof DropPrivatePowerRequest>
    implements DropPrivatePowerRequest
{
    declare type: 'DropPrivatePowerRequest'
    declare requesterId: string
    declare reason: PrivatePowerRequestDropReason
    constructor(data: DropPrivatePowerRequest) {
        super(
            data instanceof HydratedDropPrivatePowerRequest ? data.dehydrate() : data,
            DropValidator
        )
    }
    apply(state: HydratedGameState & CompanyDecisionState): void {
        assert(
            this.source === ActionSource.System && hasPrivatePowerRequest(state, this.requesterId),
            'Only a standing private power request can be dropped'
        )
        endPrivatePowerRequest(state, this.requesterId)
    }
}
