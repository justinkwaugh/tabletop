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
import { pendingCompanyDecision, type CompanyDecisionState } from './companyDecision.js'
import { endPrivatePowerRequest } from './privatePowerRequest.js'
import { privateStationPositions } from './privateStation.js'
import type { StationRules } from '../stations/stationPlacement.js'
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
type PrivateLay = Pick<LayPrivateTile, 'privateCompanyId' | 'playerId' | 'expectedCost'> &
    TrackRequest

type PrivateLayRules = { powers: PrivatePowerRules; track: TrackRules; stations: StationRules }

function applyPrivateLay(
    state: HydratedGameState & CompanyDecisionState,
    lay: PrivateLay,
    { powers, track, stations }: PrivateLayRules
): TrackLayDetails {
    const details = evaluatePrivateTrack(
        state,
        lay.privateCompanyId,
        lay.playerId,
        lay,
        powers,
        track
    ).details!
    const terms = powers.trackTerms(state, lay.privateCompanyId, lay.playerId)!
    applyTrackLay(state, track, details, terms.payer, terms.ordinaryLay === true)
    state.usedPrivatePowerIds.push(lay.privateCompanyId)
    delete state.privateTrackLay
    const station = {
        privateCompanyId: lay.privateCompanyId,
        companyId: terms.companyId,
        playerId: lay.playerId,
        locationId: lay.locationId
    }
    if (
        powers.stationPrivateIds?.includes(lay.privateCompanyId) &&
        privateStationPositions(state, stations, station).length
    )
        state.privateStation = station
    if (powers.betweenTurnsPrivateIds?.includes(lay.privateCompanyId))
        endPrivatePowerRequest(state, lay.playerId)
    return details
}

function costMatches(
    state: CompanyDecisionState,
    lay: PrivateLay,
    powers: PrivatePowerRules,
    track: TrackRules
): boolean {
    return (
        evaluatePrivateTrack(state, lay.privateCompanyId, lay.playerId, lay, powers, track).details
            ?.cost === lay.expectedCost
    )
}

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
    readonly #rules: PrivateLayRules
    constructor(data: LayPrivateTile, rules: PrivateLayRules) {
        super(data instanceof HydratedLayPrivateTile ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: CompanyDecisionState): boolean {
        return (
            this.source === ActionSource.User &&
            !state.purchaseOffer &&
            !state.trackConsent &&
            state.activePlayerIds.includes(this.playerId) &&
            costMatches(state, this, this.#rules.powers, this.#rules.track)
        )
    }
    apply(state: HydratedGameState & CompanyDecisionState): void {
        assert(this.isValid(state), 'Invalid private tile lay')
        this.metadata = applyPrivateLay(state, this, this.#rules)
    }
}

export const LayPrivateTileOutOfTurn = Type.Object(
    {
        ...LayPrivateTile.properties,
        type: Type.Literal('LayPrivateTileOutOfTurn'),
        outOfTurn: Type.Literal(true),
        sequenced: Type.Literal(true)
    },
    { additionalProperties: false }
)
export type LayPrivateTileOutOfTurn = Type.Static<typeof LayPrivateTileOutOfTurn>
const OutOfTurnValidator = Compile(LayPrivateTileOutOfTurn)
export function isLayPrivateTileOutOfTurn(action: GameAction): action is LayPrivateTileOutOfTurn {
    return (
        action instanceof HydratedLayPrivateTileOutOfTurn ||
        (action.type === 'LayPrivateTileOutOfTurn' && OutOfTurnValidator.Check(action))
    )
}
export function isPrivateTileLay(
    action: GameAction
): action is LayPrivateTile | LayPrivateTileOutOfTurn {
    return isLayPrivateTile(action) || isLayPrivateTileOutOfTurn(action)
}

export class HydratedLayPrivateTileOutOfTurn
    extends HydratableAction<typeof LayPrivateTileOutOfTurn>
    implements LayPrivateTileOutOfTurn
{
    declare type: 'LayPrivateTileOutOfTurn'
    declare playerId: string
    declare privateCompanyId: string
    declare companyId: string
    declare locationId: string
    declare definitionId: string
    declare rotation: TrackRequest['rotation']
    declare nodeMapping: TrackRequest['nodeMapping']
    declare expectedCost: number
    declare outOfTurn: true
    declare sequenced: true
    declare metadata?: TrackLayDetails
    readonly #rules: PrivateLayRules
    constructor(data: LayPrivateTileOutOfTurn, rules: PrivateLayRules) {
        super(
            data instanceof HydratedLayPrivateTileOutOfTurn ? data.dehydrate() : data,
            OutOfTurnValidator
        )
        this.#rules = rules
    }
    isValid(state: CompanyDecisionState): boolean {
        return (
            this.source === ActionSource.User &&
            state.machineState === 'StockRound' &&
            !pendingCompanyDecision(state) &&
            !state.activePlayerIds.includes(this.playerId) &&
            costMatches(state, this, this.#rules.powers, this.#rules.track)
        )
    }
    apply(state: HydratedGameState & CompanyDecisionState): void {
        assert(this.isValid(state), 'Invalid out-of-turn private tile lay')
        this.metadata = applyPrivateLay(state, this, this.#rules)
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
