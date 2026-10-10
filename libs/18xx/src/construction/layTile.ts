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
import type { Owner } from '../finance/finance.js'
import { settleCashPayments } from '../finance/cashPayments.js'
import { closePrivate } from '../privates/privateCompany.js'
import {
    TrackRequest,
    TrackLayDetails,
    TrackConstruction,
    type ConstructionState,
    type TrackRules
} from './trackConstruction.js'

export const LayTile = Type.Object(
    {
        ...PlayerAction.properties,
        ...TrackRequest.properties,
        type: Type.Literal('LayTile'),
        expectedCost: Type.Integer({ minimum: 0 }),
        metadata: Type.Optional(TrackLayDetails)
    },
    { additionalProperties: false }
)
export type LayTile = Type.Static<typeof LayTile>
const Validator = Compile(LayTile)
export function isLayTile(action: GameAction): action is LayTile {
    return (
        action instanceof HydratedLayTile || (action.type === 'LayTile' && Validator.Check(action))
    )
}
export class HydratedLayTile extends HydratableAction<typeof LayTile> implements LayTile {
    declare type: 'LayTile'
    declare playerId: string
    declare companyId: string
    declare locationId: string
    declare definitionId: string
    declare rotation: LayTile['rotation']
    declare nodeMapping: LayTile['nodeMapping']
    declare expectedCost: number
    declare metadata?: TrackLayDetails
    readonly #rules: TrackRules
    constructor(data: LayTile, rules: TrackRules) {
        super(data instanceof HydratedLayTile ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & ConstructionState): void {
        const construction = new TrackConstruction(state, this.#rules)
        assert(
            this.source === ActionSource.User &&
                state.activePlayerIds.includes(this.playerId) &&
                construction.canAct(this.playerId, this.companyId),
            'Only the operating company’s controlling owner may lay track'
        )
        const result = construction.evaluate(this)
        assert(result.details, result.reason ?? 'Invalid track lay')
        const details = result.details
        assert(details.cost === this.expectedCost, 'Construction cost has changed')
        assert(
            !details.consentPlayerId || details.consentPlayerId === this.playerId,
            'Track requires the private owner’s consent'
        )
        this.metadata = applyTrackLay(
            state,
            this.#rules,
            details,
            { kind: 'company', companyId: this.companyId },
            true
        )
    }
}

export function applyTrackLay(
    state: ConstructionState,
    rules: TrackRules,
    details: TrackLayDetails,
    payer: Owner,
    countsAsOrdinaryLay: boolean
): TrackLayDetails {
    const construction = new TrackConstruction(state, rules, payer)
    const inventory = construction.inventoryAfter(details)
    const { stations, stationReservations } = construction.stationsAfter(details)
    if (details.cost)
        settleCashPayments(state, [{ from: payer, to: { kind: 'bank' }, amount: details.cost }])
    state.tileInventory = inventory
    state.stations = stations
    state.stationReservations = stationReservations
    if (countsAsOrdinaryLay) {
        assert(state.trackStep, 'An ordinary lay requires a track step')
        const color = rules.tileSet.definitions.find((tile) => tile.id === details.definitionId)!
            .face.color
        state.trackStep.lays.push({ locationId: details.locationId, color, cost: details.cost })
    }
    const effects = rules.afterLay?.(state, details, payer)
    if (!effects) return details
    settleCashPayments(state, effects.payments)
    for (const privateId of effects.closedPrivateIds) closePrivate(state, privateId)
    return effects.payments.length || effects.closedPrivateIds.length
        ? { ...details, effects }
        : details
}
