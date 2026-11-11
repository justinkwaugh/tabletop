import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedAction
} from '@tabletop/common'
import {
    EighteenXXPlayerAction,
    RailwayMapState,
    TrackNetwork,
    controllingOwner,
    finiteCashOwnedBy,
    routeRevenue,
    settleCashPayments,
    stepAction,
    CashPayment,
    type MapStateData,
    type RevenueCenter,
    type StationState,
    type StepAction
} from '@tabletop/18xx'
import { company1850 } from './companies.js'
import { Map1850, NorthwestLocationIds } from './map.js'
import { MesabiAccess } from './mesabiAccess.js'
import { requireState1850, type HydratedState1850 } from './state.js'
import { TileSet1850 } from './tiles.js'
import { revenueStages } from './trains.js'

export const EdgeTokenPrice = 50

/** A red edge area's hexes: the Northwest is printed across two (§7.4). */
export function edgeAreaLocationIds(locationId: string): readonly string[] {
    return NorthwestLocationIds.includes(locationId) ? NorthwestLocationIds : [locationId]
}

/**
 * The operating company's edge token, if it may place one now: as its token placement for the turn,
 * once its track reaches the area (§7.2, §7.3, §7.4).
 */
export function edgeTokenChoice(
    state: HydratedState1850
): { companyId: string; locationId: string } | undefined {
    const step = state.stationStep
    if (!step || step.completed) return undefined
    const { companyId } = step
    const locationId = company1850(companyId)?.edgeArea
    if (
        !locationId ||
        state.edgeTokens.includes(companyId) ||
        state.edgeTokenPlaced ||
        step.placedStationIds.length ||
        finiteCashOwnedBy(state, { kind: 'company', companyId }) < EdgeTokenPrice
    )
        return undefined
    return reachesEdgeArea(state, companyId, locationId) ? { companyId, locationId } : undefined
}

function reachesEdgeArea(
    state: MapStateData & StationState,
    companyId: string,
    locationId: string
): boolean {
    const network = new TrackNetwork(
        new RailwayMapState(Map1850, TileSet1850, state.tileInventory),
        state,
        companyId,
        undefined,
        undefined,
        (id, nodeId) => !MesabiAccess.open(state, companyId, { locationId: id, nodeId })
    )
    return edgeAreaLocationIds(locationId).some((id) =>
        Map1850.location(id).preprintedTile.nodes.some((node) =>
            network.reaches(id, { kind: 'node', nodeId: node.id })
        )
    )
}

/** An edge token doubles its area's value for its company (§7.4, §8.4). */
export function edgeBonus(state: object, companyId: string, center: RevenueCenter): number {
    const title = requireState1850(state)
    const area = company1850(companyId)?.edgeArea
    if (
        !area ||
        !title.edgeTokens.includes(companyId) ||
        !edgeAreaLocationIds(area).includes(center.locationId)
    )
        return 0
    const node = Map1850.location(center.locationId).preprintedTile.nodes.find(
        (entry) => entry.id === center.nodeId
    )
    assertExists(node, 'A route stops at a node of the location')
    if (!('revenue' in node) || !node.revenue) return 0
    return routeRevenue(node.revenue, revenueStages(title.phaseId))
}

export const PlaceEdgeToken = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('PlaceEdgeToken'),
        companyId: Type.String(),
        metadata: Type.Optional(
            Type.Object(
                { locationId: Type.String(), payment: CashPayment },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type PlaceEdgeToken = Type.Static<typeof PlaceEdgeToken>
const Validator = Compile(PlaceEdgeToken)
export function isPlaceEdgeToken(action: GameAction): action is PlaceEdgeToken {
    return (
        action instanceof HydratedPlaceEdgeToken ||
        (action.type === 'PlaceEdgeToken' && Validator.Check(action))
    )
}

export class HydratedPlaceEdgeToken
    extends HydratableAction<typeof PlaceEdgeToken>
    implements PlaceEdgeToken
{
    declare type: 'PlaceEdgeToken'
    declare playerId: string
    declare companyId: string
    declare metadata?: PlaceEdgeToken['metadata']
    constructor(data: PlaceEdgeToken) {
        super(data instanceof HydratedPlaceEdgeToken ? data.dehydrate() : data, Validator)
    }
    isValid(state: HydratedState1850): boolean {
        return (
            this.source === ActionSource.User &&
            edgeTokenChoice(state)?.companyId === this.companyId &&
            controllingOwner(state, this.companyId)?.playerId === this.playerId
        )
    }
    apply(state: HydratedState1850): void {
        assert(this.isValid(state), 'The company cannot place its edge token now')
        const choice = edgeTokenChoice(state)
        assertExists(choice, 'A valid placement has a choice')
        const payment: CashPayment = {
            from: { kind: 'company', companyId: this.companyId },
            to: { kind: 'bank' },
            amount: EdgeTokenPrice
        }
        settleCashPayments(state, [payment])
        state.edgeTokens.push(this.companyId)
        state.edgeTokenPlaced = true
        this.metadata = { locationId: choice.locationId, payment }
    }
}

export const PlaceEdgeTokenStep: StepAction<HydratedState1850> = stepAction(
    'PlaceEdgeToken',
    (action: HydratedAction): action is HydratedPlaceEdgeToken =>
        action instanceof HydratedPlaceEdgeToken,
    (state, playerId) => {
        const choice = edgeTokenChoice(state)
        return !!choice && controllingOwner(state, choice.companyId)?.playerId === playerId
    }
)
