import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import {
    TrackRequest,
    TrackLayDetails,
    type TrackRules
} from '../construction/trackConstruction.js'
import { applyTrackLay } from '../construction/layTile.js'
import { evaluatePrivateTrack, type PrivatePowerRules } from './privatePowers.js'
import type { CompanyDecisionState } from './companyDecision.js'
export const LayPrivateTile = Type.Object(
    {
        ...PlayerAction.properties,
        ...TrackRequest.properties,
        type: Type.Literal('LayPrivateTile'),
        privateCompanyId: Type.String(),
        expectedCost: Type.Integer({ minimum: 0 }),
        metadata: Type.Optional(TrackLayDetails)
    },
    { additionalProperties: false }
)
export type LayPrivateTile = Type.Static<typeof LayPrivateTile>
const Validator = Compile(LayPrivateTile)
export class HydratedLayPrivateTile
    extends HydratableAction<typeof LayPrivateTile>
    implements LayPrivateTile
{
    declare type: 'LayPrivateTile'
    declare playerId: string
    declare privateCompanyId: string
    declare companyId: string
    declare locationId: string
    declare definitionId: string
    declare rotation: TrackRequest['rotation']
    declare nodeMapping: TrackRequest['nodeMapping']
    declare expectedCost: number
    declare metadata?: TrackLayDetails
    readonly #powers: PrivatePowerRules
    readonly #track: TrackRules
    constructor(data: LayPrivateTile, powers: PrivatePowerRules, track: TrackRules) {
        super(data instanceof HydratedLayPrivateTile ? data.dehydrate() : data, Validator)
        this.#powers = powers
        this.#track = track
    }
    isValid(state: CompanyDecisionState): boolean {
        return (
            this.source === ActionSource.User &&
            !state.purchaseOffer &&
            !state.trackConsent &&
            state.activePlayerIds.includes(this.playerId) &&
            evaluatePrivateTrack(
                state,
                this.privateCompanyId,
                this.playerId,
                this,
                this.#powers,
                this.#track
            ).details?.cost === this.expectedCost
        )
    }
    apply(state: HydratedGameState & CompanyDecisionState): void {
        assert(this.isValid(state), 'Invalid private tile lay')
        const details = evaluatePrivateTrack(
            state,
            this.privateCompanyId,
            this.playerId,
            this,
            this.#powers,
            this.#track
        ).details!
        const terms = this.#powers.trackTerms(state, this.privateCompanyId, this.playerId)!
        applyTrackLay(state, this.#track, details, terms.payer, false)
        state.usedPrivatePowerIds.push(this.privateCompanyId)
        delete state.privateTrackLay
        this.metadata = details
    }
}
export const DeclinePrivateTile = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('DeclinePrivateTile'),
        privateCompanyId: Type.String()
    },
    { additionalProperties: false }
)
export type DeclinePrivateTile = Type.Static<typeof DeclinePrivateTile>
const DeclineValidator = Compile(DeclinePrivateTile)
export class HydratedDeclinePrivateTile
    extends HydratableAction<typeof DeclinePrivateTile>
    implements DeclinePrivateTile
{
    declare type: 'DeclinePrivateTile'
    declare playerId: string
    declare privateCompanyId: string
    constructor(data: DeclinePrivateTile) {
        super(
            data instanceof HydratedDeclinePrivateTile ? data.dehydrate() : data,
            DeclineValidator
        )
    }
    isValid(state: CompanyDecisionState): boolean {
        return (
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            state.privateTrackLay?.privateCompanyId === this.privateCompanyId &&
            state.privateTrackLay.playerId === this.playerId
        )
    }
    apply(state: HydratedGameState & CompanyDecisionState): void {
        assert(this.isValid(state), 'Only the entitled seller may decline this tile lay')
        state.usedPrivatePowerIds.push(this.privateCompanyId)
        delete state.privateTrackLay
    }
}

export function isLayPrivateTile(action: GameAction): action is LayPrivateTile {
    return (
        action instanceof HydratedLayPrivateTile ||
        (action.type === 'LayPrivateTile' && Validator.Check(action))
    )
}

export function isDeclinePrivateTile(action: GameAction): action is DeclinePrivateTile {
    return (
        action instanceof HydratedDeclinePrivateTile ||
        (action.type === 'DeclinePrivateTile' && DeclineValidator.Check(action))
    )
}
