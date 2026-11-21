import type { TrainDefinition } from '../trains/train.js'
import type { RevenueCenter, RouteResult } from './route.js'
import type { RouteVisit } from './routeNetwork.js'

export type FleetRoute = {
    result: RouteResult
    train: TrainDefinition
    /** Every stop the route reaches, those it passes included. */
    visits: readonly RouteVisit[]
    /** The stops the train calls at, which count toward its distance and may pay. */
    stops: readonly RouteVisit[]
    locationIds: readonly string[]
}

export type FleetSettlement = { routes: RouteResult[]; subsidy?: number; reason?: never }
export type FleetRejection = { reason: string; routes?: never; subsidy?: never }
export type RevenueKind = RouteVisit['node']['kind']

export type FleetTrainPolicy = {
    payingKinds?: readonly RevenueKind[]
    /** The payment limit applies to these kinds; other payable kinds remain unlimited. */
    payingStopLimit?: { count: number; kinds: readonly RevenueKind[] }
    hexSubsidy?: number
    /** Required runs form one chain, extended by one optional run when any optional run runs. */
    freight?: 'required' | 'optional'
}

export type FreightChainPolicy = {
    bonusPerHex: number
    endRates?: readonly { stops: readonly RevenueCenter[]; bonusPerHex: number }[]
    /** Off-board ends are measured from the adjacent route hex, plus one hex. */
    offboardDistance?: 'adjacent-hex'
}

export interface FleetRules {
    sharedTrack?: true
    /**
     * Payment identity defaults to the revenue center; each named group shares one payment.
     * Freight chains between the same two identities share one distance bonus.
     */
    payOnce?: { groups?: readonly (readonly RevenueCenter[])[] }
    /**
     * Runs meet another at a stop of these kinds; 1860's runs meet at any station, large or
     * small, or a halt.
     */
    connectivity?: { at: RevenueKind | readonly RevenueKind[]; root?: 'home' }
    routeShape?: { endKinds: readonly RevenueKind[]; minimumCities?: number }
    trains?: Readonly<Record<string, FleetTrainPolicy>>
    freightChains?: FreightChainPolicy
}
