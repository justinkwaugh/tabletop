import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    assertExists,
    type GameAction
} from '@tabletop/common'
import {
    ConnectedTrack,
    RailwayMapState,
    TrackRequest,
    TrackLayDetails,
    applyTrackLay,
    privateTrackConstruction,
    privateOwner,
    controllingOwner,
    nextOperatingCompany,
    privatePowerUsed,
    recordPrivatePowerUse,
    rotateTileFace,
    type CompanyDecisionState,
    type PrivateTrackTerms,
    stateWith,
    EighteenXXPlayerAction
} from '@tabletop/18xx'
import { AcquisitionSteps } from './acquisitions.js'
import { EighteenFortySixMap, PrivateTrackBlocks } from './map.js'
import { EighteenFortySixTileSet } from './tiles.js'
import { TrackRules1846 } from './track.js'
import type { RevenueMarkerState } from './revenueMarkers.js'
import type { HydratedEighteenFortySixState } from './state.js'

export const ConstructionPrivateId = Type.Union([
    Type.Literal('MC'),
    Type.Literal('O&I'),
    Type.Literal('LSL'),
    Type.Literal('LM')
])
export type ConstructionPrivateId = Type.Static<typeof ConstructionPrivateId>
export const ConstructionPrivateIds: readonly ConstructionPrivateId[] = ['MC', 'O&I', 'LSL', 'LM']
const Locations: Readonly<Record<ConstructionPrivateId, readonly string[]>> = {
    MC: PrivateTrackBlocks.MC,
    'O&I': PrivateTrackBlocks['O&I'],
    LSL: ['D14', 'E17'],
    LM: ['H12', 'G13']
}
export type PrivateConstructionState = CompanyDecisionState & RevenueMarkerState
export function privatePowerCompany(
    state: PrivateConstructionState,
    playerId: string,
    privateId: string
): string | undefined {
    const companyId = nextOperatingCompany(state)
    if (
        !companyId ||
        state.purchaseOffer ||
        state.pendingRevenueMarker ||
        !['I', 'II'].includes(state.phaseId) ||
        !AcquisitionSteps.some((step) => step === state.machineState) ||
        !state.activePlayerIds.includes(playerId) ||
        controllingOwner(state, companyId)?.playerId !== playerId ||
        privatePowerUsed(state, privateId) ||
        !state.companies.some((company) => company.id === privateId && !company.closed)
    )
        return undefined
    const owner = privateOwner(state, privateId)
    return owner?.kind === 'company' && owner.companyId === companyId ? companyId : undefined
}
export function constructionPrivateIds(
    state: PrivateConstructionState,
    playerId: string
): ConstructionPrivateId[] {
    return ConstructionPrivateIds.filter((id) =>
        new PrivateConstruction(state, playerId, id).hasChoice()
    )
}
type PlannedLays = { state: PrivateConstructionState; lays: TrackLayDetails[] }
type ConstructionPlan =
    (PlannedLays & { reason?: never }) | { reason: string; state?: never; lays?: never }
export class PrivateConstruction {
    constructor(
        readonly state: PrivateConstructionState,
        readonly playerId: string,
        readonly privateId: ConstructionPrivateId
    ) {}
    get maximumLays(): number {
        return this.privateId === 'LSL' ? 1 : 2
    }
    choices(requests: readonly TrackRequest[]): TrackLayDetails[] {
        const plan = this.evaluate(requests, false)
        return plan.state ? [...this.offers(plan)] : []
    }
    hasChoice(): boolean {
        const plan = this.evaluate([], false)
        return !!plan.state && this.canExtend(plan)
    }
    private canExtend(plan: PlannedLays): boolean {
        return !this.offers(plan).next().done
    }
    private *offers(plan: PlannedLays): Generator<TrackLayDetails> {
        if (plan.lays.length >= this.maximumLays) return
        const companyId = privatePowerCompany(this.state, this.playerId, this.privateId)
        assertExists(companyId)
        const construction = privateTrackConstruction(
            plan.state,
            this.terms(companyId),
            TrackRules1846
        )
        for (const locationId of Locations[this.privateId]) {
            if (plan.lays.some((lay) => lay.locationId === locationId)) continue
            for (const choice of construction.choices(locationId)) {
                const next = this.extend(plan, choice)
                // A lay must either complete the power or leave a further lay that does.
                if (!this.incomplete(next) || this.canExtend(next)) yield choice
            }
        }
    }
    evaluate(requests: readonly TrackRequest[], complete = true): ConstructionPlan {
        const companyId = privatePowerCompany(this.state, this.playerId, this.privateId)
        if (!companyId || (this.privateId === 'LSL' && this.state.phaseId !== 'II'))
            return { reason: 'This private construction power is unavailable.' }
        if (requests.length > this.maximumLays || (complete && !requests.length))
            return { reason: 'Choose one or two permitted tile lays.' }
        if (this.privateId === 'LM' && this.miamiConnected(this.state))
            return { reason: 'Cincinnati and Dayton are already connected.' }
        let plan: PlannedLays = { state: this.state, lays: [] }
        for (const request of requests) {
            if (
                request.companyId !== companyId ||
                plan.lays.some((lay) => lay.locationId === request.locationId)
            )
                return { reason: 'Use each permitted hex at most once.' }
            const result = privateTrackConstruction(
                plan.state,
                this.terms(companyId),
                TrackRules1846
            ).evaluate(request)
            if (!result.details) return { reason: result.reason }
            plan = this.extend(plan, result.details)
        }
        const reason = complete ? this.incomplete(plan) : undefined
        return reason ? { reason } : plan
    }
    private extend(plan: PlannedLays, details: TrackLayDetails): PlannedLays {
        const state = stateWith(plan.state, {
            cash: structuredClone(plan.state.cash),
            bank: { ...plan.state.bank }
        })
        const lay = applyTrackLay(
            state,
            TrackRules1846,
            details,
            { kind: 'company', companyId: details.companyId },
            false
        )
        return { state, lays: [...plan.lays, lay] }
    }
    private incomplete({ state, lays }: PlannedLays): string | undefined {
        if (
            (this.privateId === 'MC' || this.privateId === 'O&I') &&
            lays.length === 2 &&
            !this.map(state)
                .connections(lays[0].locationId)
                .some((connection) => connection.neighborLocationId === lays[1].locationId)
        )
            return 'The two private tiles must connect to each other.'
        if (
            this.privateId === 'LM' &&
            (!this.miamiConnected(state) || !lays.every((lay) => this.miamiUsesNewExit(state, lay)))
        )
            return 'Each Little Miami tile must add track used to connect Cincinnati and Dayton.'
        return undefined
    }
    private terms(companyId: string): PrivateTrackTerms {
        const colors =
            this.privateId === 'LSL'
                ? ['green']
                : this.privateId === 'LM'
                  ? ['yellow', 'green']
                  : ['yellow']
        return {
            companyId,
            locationIds: Locations[this.privateId],
            definitionIds: EighteenFortySixTileSet.definitions
                .filter((tile) => colors.includes(tile.face.color))
                .map((tile) => tile.id),
            payer: { kind: 'company', companyId },
            connected: false,
            ...(this.privateId === 'LM' ? { terrainDiscount: 20 } : { free: true as const })
        }
    }
    private map(state: PrivateConstructionState): RailwayMapState {
        return new RailwayMapState(
            EighteenFortySixMap,
            EighteenFortySixTileSet,
            state.tileInventory
        )
    }
    private miamiConnected(state: PrivateConstructionState): boolean {
        return new ConnectedTrack(this.map(state), [{ locationId: 'H12', nodeId: 'city' }]).reaches(
            'G13',
            { kind: 'node', nodeId: 'city' }
        )
    }
    private miamiUsesNewExit(state: PrivateConstructionState, lay: TrackLayDetails): boolean {
        const previous = this.map(this.state).tile(lay.locationId)
        const oldEdges = rotateTileFace(previous.face, previous.rotation).paths.flatMap((path) =>
            path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
        )
        const map = this.map(state)
        const tile = map.tile(lay.locationId)
        const face = rotateTileFace(tile.face, tile.rotation)
        const newDepartures = face.paths.filter((path) =>
            path.endpoints.some((end) => end.kind === 'edge' && !oldEdges.includes(end.edge))
        )
        const other = Locations.LM.find((id) => id !== lay.locationId)
        assertExists(other)
        return new ConnectedTrack(
            map,
            [{ locationId: lay.locationId, nodeId: 'city' }],
            undefined,
            { locationId: lay.locationId, face: { ...face, paths: newDepartures } }
        ).reaches(other, { kind: 'node', nodeId: 'city' })
    }
}

export const BuildPrivateTrack = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('BuildPrivateTrack'),
        privateCompanyId: ConstructionPrivateId,
        lays: Type.Array(TrackRequest, { minItems: 1, maxItems: 2 }),
        expectedCost: Type.Integer({ minimum: 0 }),
        metadata: Type.Optional(
            Type.Object(
                { lays: Type.Array(TrackLayDetails), cost: Type.Integer({ minimum: 0 }) },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type BuildPrivateTrack = Type.Static<typeof BuildPrivateTrack>
const Validator = Compile(BuildPrivateTrack)
export function isBuildPrivateTrack(action: GameAction): action is BuildPrivateTrack {
    return Validator.Check(action)
}
export class BuildPrivateTrackAction extends HydratableAction<typeof BuildPrivateTrack> {
    declare playerId: string
    declare privateCompanyId: ConstructionPrivateId
    declare lays: TrackRequest[]
    declare expectedCost: number
    declare metadata?: BuildPrivateTrack['metadata']
    constructor(data: BuildPrivateTrack) {
        super(data, Validator)
    }
    isValid(state: HydratedEighteenFortySixState): boolean {
        const plan = new PrivateConstruction(state, this.playerId, this.privateCompanyId).evaluate(
            this.lays
        )
        return (
            this.source === ActionSource.User &&
            !!plan.lays &&
            plan.lays.reduce((sum, lay) => sum + lay.cost, 0) === this.expectedCost
        )
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(this.isValid(state), 'Invalid private construction or changed cost')
        const plan = new PrivateConstruction(state, this.playerId, this.privateCompanyId).evaluate(
            this.lays
        )
        assertExists(plan.lays)
        for (const lay of plan.lays)
            applyTrackLay(
                state,
                TrackRules1846,
                lay,
                { kind: 'company', companyId: lay.companyId },
                false
            )
        recordPrivatePowerUse(state, this.privateCompanyId)
        this.metadata = { lays: plan.lays, cost: this.expectedCost }
    }
}
