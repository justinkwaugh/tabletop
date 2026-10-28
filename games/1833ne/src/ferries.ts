import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, HydratableAction, assert, type HydratedGameState } from '@tabletop/common'
import {
    CashPayment,
    ConnectedTrack,
    EighteenXXPlayerAction,
    TrackNetwork,
    actsFor,
    finiteCashOwnedBy,
    nextOperatingCompany,
    settleCashPayments,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { Places } from './map.js'
import { mapState, ownsPrivate } from './privates.js'
import { Phases1833NE } from './trains.js'

export type FerryDefinition = { locationId: string; name: string; value: number }

/** The five ferries and their values (setup, p. 3). */
export const Ferries1833NE: readonly FerryDefinition[] = [
    { locationId: 'C26', name: 'New Haven', value: 20 },
    { locationId: 'E26', name: 'Allyn’s Point', value: 20 },
    { locationId: 'F27', name: 'Stonington', value: 20 },
    { locationId: 'F25', name: 'Providence', value: 10 },
    { locationId: 'G26', name: 'Fall River', value: 20 }
]
export const FerryPrice = 40
export const FerryBonus = { new: 20, last: 20 } as const

export const OwnedFerry = Type.Object(
    {
        locationId: Type.String(),
        companyId: Type.String(),
        luxury: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type OwnedFerry = Type.Static<typeof OwnedFerry>
export const FerryBonusMarker = Type.Object(
    {
        locationId: Type.String(),
        side: Type.Union([Type.Literal('new'), Type.Literal('last')]),
        /** The last ferry keeps the New bonus until its buyer has run (§6.57). */
        lastAfterRunOf: Type.Optional(Type.String())
    },
    { additionalProperties: false }
)
export type FerryBonusMarker = Type.Static<typeof FerryBonusMarker>
export const FerryFields = {
    ferries: Type.Array(OwnedFerry),
    ferryBonus: Type.Optional(FerryBonusMarker),
    /** The corporation that has bought its one ferry this operating turn. */
    ferryBuyerId: Type.Optional(Type.String())
}
export type FerryState = Type.Static<Type.TObject<typeof FerryFields>>
type State = HydratedEighteenXXState & FerryState

export function ferryDefinition(locationId: string): FerryDefinition | undefined {
    return Ferries1833NE.find((ferry) => ferry.locationId === locationId)
}

function ferriesInPlay(state: Pick<State, 'phaseId'>): boolean {
    return !Phases1833NE.isAtLeast(state.phaseId, 'IV')
}

/** A ferry's value on a route of the corporation owning it, with its bonus and luxury. */
export function ferryValue(
    state: Pick<State, 'phaseId' | 'ferries' | 'ferryBonus'>,
    companyId: string,
    locationId: string
): number {
    if (!ferriesInPlay(state)) return 0
    const owned = state.ferries.find(
        (ferry) => ferry.locationId === locationId && ferry.companyId === companyId
    )
    const definition = ferryDefinition(locationId)
    if (!owned || !definition) return 0
    const bonus =
        state.ferryBonus?.locationId === locationId ? FerryBonus[state.ferryBonus.side] : 0
    return (definition.value + bonus) * (owned.luxury ? 2 : 1)
}

/**
 * A corporation may buy a ferry whose city it reaches from a token and which connects, through
 * any cities, to Boston (§6.56).
 */
export function ferryConnected(state: State, companyId: string, locationId: string): boolean {
    const map = mapState(state)
    const stops = map
        .tile(locationId)
        .face.nodes.filter((node) => node.kind === 'city' || node.kind === 'town')
        .map((node) => ({ locationId, nodeId: node.id }))
    const network = new TrackNetwork(map, state, companyId)
    const reached = stops.filter((stop) =>
        network.reaches(stop.locationId, { kind: 'node', nodeId: stop.nodeId })
    )
    if (!reached.length) return false
    const toBoston = new ConnectedTrack(map, reached)
    return map
        .tile(Places.boston)
        .face.nodes.some((node) =>
            toBoston.reaches(Places.boston, { kind: 'node', nodeId: node.id })
        )
}

export function ferryChoices(state: State): string[] {
    const companyId = nextOperatingCompany(state)
    if (
        !companyId ||
        state.machineState !== 'LayingTrack' ||
        !ferriesInPlay(state) ||
        state.ferryBuyerId === companyId ||
        finiteCashOwnedBy(state, { kind: 'company', companyId }) < FerryPrice
    )
        return []
    return Ferries1833NE.filter(
        (ferry) =>
            !state.ferries.some((owned) => owned.locationId === ferry.locationId) &&
            ferryConnected(state, companyId, ferry.locationId)
    ).map((ferry) => ferry.locationId)
}

export const BuyFerry = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('BuyFerry'),
        source: Type.Literal(ActionSource.User),
        companyId: Type.String(),
        locationId: Type.String(),
        metadata: Type.Optional(
            Type.Object(
                { payment: CashPayment, lastFerry: Type.Optional(Type.Literal(true)) },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type BuyFerry = Type.Static<typeof BuyFerry>
export const BuyFerryValidator = Compile(BuyFerry)

export class BuyFerryAction extends HydratableAction<typeof BuyFerry> {
    declare playerId: string
    declare companyId: string
    declare locationId: string
    declare metadata?: BuyFerry['metadata']
    constructor(data: BuyFerry) {
        super(data, BuyFerryValidator)
    }
    isValid(state: HydratedGameState & State): boolean {
        return (
            state.activePlayerIds.includes(this.playerId) &&
            nextOperatingCompany(state) === this.companyId &&
            actsFor(state, this.playerId, this.companyId) &&
            ferryChoices(state).includes(this.locationId)
        )
    }
    apply(state: HydratedGameState & State): void {
        assert(this.isValid(state), 'This ferry cannot be bought')
        const payment = {
            from: { kind: 'company' as const, companyId: this.companyId },
            to: { kind: 'bank' as const },
            amount: FerryPrice
        }
        settleCashPayments(state, [payment])
        state.ferries.push({ locationId: this.locationId, companyId: this.companyId })
        state.ferryBuyerId = this.companyId
        const lastFerry = state.ferries.length === Ferries1833NE.length
        state.ferryBonus = {
            locationId: this.locationId,
            side: 'new',
            ...(lastFerry ? { lastAfterRunOf: this.companyId } : {})
        }
        this.metadata = { payment, ...(lastFerry ? { lastFerry: true } : {}) }
    }
}

/** Flips the bonus to its Last side once the last ferry's buyer has run its routes. */
export function afterRoutesRun(state: State, companyId: string): void {
    if (state.ferryBonus?.lastAfterRunOf === companyId)
        state.ferryBonus = { locationId: state.ferryBonus.locationId, side: 'last' }
}

export function luxuryChoices(state: State): string[] {
    const companyId = nextOperatingCompany(state)
    if (
        !companyId ||
        !['LayingTrack', 'RunningTrains'].includes(state.machineState) ||
        !ferriesInPlay(state) ||
        !ownsPrivate(state, companyId, 'P5') ||
        state.ferries.some((ferry) => ferry.luxury)
    )
        return []
    return state.ferries
        .filter((ferry) => ferry.companyId === companyId)
        .map((ferry) => ferry.locationId)
}

export const AssignLuxuryFerry = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('AssignLuxuryFerry'),
        source: Type.Literal(ActionSource.User),
        companyId: Type.String(),
        locationId: Type.String()
    },
    { additionalProperties: false }
)
export type AssignLuxuryFerry = Type.Static<typeof AssignLuxuryFerry>
export const AssignLuxuryFerryValidator = Compile(AssignLuxuryFerry)

export class AssignLuxuryFerryAction extends HydratableAction<typeof AssignLuxuryFerry> {
    declare playerId: string
    declare companyId: string
    declare locationId: string
    constructor(data: AssignLuxuryFerry) {
        super(data, AssignLuxuryFerryValidator)
    }
    isValid(state: HydratedGameState & State): boolean {
        return (
            state.activePlayerIds.includes(this.playerId) &&
            nextOperatingCompany(state) === this.companyId &&
            actsFor(state, this.playerId, this.companyId) &&
            luxuryChoices(state).includes(this.locationId)
        )
    }
    apply(state: HydratedGameState & State): void {
        assert(this.isValid(state), 'The Luxury Ferry cannot be assigned to this ferry')
        const ferry = state.ferries.find((owned) => owned.locationId === this.locationId)
        assert(ferry, 'The assigned ferry is owned')
        ferry.luxury = true
    }
}
