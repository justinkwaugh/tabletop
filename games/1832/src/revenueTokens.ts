import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    PlayerAction,
    assert,
    assertExists,
    type HydratedAction
} from '@tabletop/common'
import {
    SystemActionFirstHandler,
    controllingOwner,
    nextOperatingCompany,
    privateOwningCompany,
    type MapStateData,
    type OperatingSet,
    type RevenueCenter,
    type RouteRules,
    type StationPlacementState,
    type TrainRunningState,
    stepAction
} from '@tabletop/18xx'
import type { TitleStepAction } from './titleActions.js'
import { EighteenThirtyTwoMap, PortLocationIds } from './map.js'
import {
    requireEighteenThirtyTwoState,
    type EighteenThirtyTwoState,
    type EighteenThirtyTwoStateHandler,
    type HydratedEighteenThirtyTwoState
} from './state.js'
import { currentTileFace } from './tileState.js'
import {
    RevenueTokenKind,
    inGame,
    type EighteenThirtyTwoTitleState,
    type RevenueToken
} from './titleState.js'
import { EighteenThirtyTwoPhases } from './trains.js'

export const MiamiLocationId = 'AA28'
export const KeyWestCompanyId = 'FEC'
/** The private whose token each kind is (§16.2 P2–P3). */
export const RevenueTokenPrivateIds = { port: 'P3', cotton: 'P2' } as const

/** Whether a private's token power is still unused. */
export function revenueTokenUnplaced(
    state: EighteenThirtyTwoTitleState,
    privateCompanyId: string
): boolean {
    return !state.revenueTokens.some(
        (token) =>
            token.kind !== 'key-west' && RevenueTokenPrivateIds[token.kind] === privateCompanyId
    )
}

/** Port and Cotton tokens leave at phase 6, the Key West token at phase 8 (§4.2.5, §4.2.6). */
export function activeRevenueTokens(
    state: EighteenThirtyTwoTitleState & { phaseId: string }
): RevenueToken[] {
    return state.revenueTokens.filter((token) =>
        token.kind === 'key-west'
            ? !EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '8')
            : !EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '6')
    )
}

type StopBonus = { amount: number; label: string }

function revenueNodes(state: MapStateData, locationId: string, kinds: readonly string[]) {
    return currentTileFace(state, locationId).nodes.filter((node) => kinds.includes(node.kind))
}

/**
 * What a stop earns beyond its value for a company: a Port's $20 for its owner and $10 for
 * others, Cotton's $10 for its owner, and Key West's $50 at Miami for the FEC (§7.5–7.6).
 */
export function stopBonuses(
    state: TrainRunningState & EighteenThirtyTwoTitleState,
    companyId: string,
    center: RevenueCenter
): StopBonus[] {
    return activeRevenueTokens(state).flatMap((token): StopBonus[] => {
        if (token.kind === 'key-west')
            return companyId === KeyWestCompanyId && center.locationId === MiamiLocationId
                ? [{ amount: 50, label: 'Key West' }]
                : []
        if (token.locationId !== center.locationId || token.nodeId !== center.nodeId) return []
        if (token.kind === 'port')
            return [{ amount: token.companyId === companyId ? 20 : 10, label: 'Port' }]
        return token.companyId === companyId ? [{ amount: 10, label: 'Cotton' }] : []
    })
}

/** Miami is worth nothing on the game's first run there before phase 5 (§8.4). */
export function miamiFirstRun(state: EighteenThirtyTwoTitleState & { phaseId: string }) {
    return !state.miamiRun && !EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '5')
}

export const revenueTokenRoutes: Pick<RouteRules, 'stopBonus' | 'stopBonusLabel' | 'stopRevenue'> =
    {
        stopRevenue: (state, _companyId, center, printed) =>
            center.locationId === MiamiLocationId &&
            miamiFirstRun(requireEighteenThirtyTwoState(state))
                ? 0
                : printed,
        stopBonus: (state, _train, companyId, center) =>
            stopBonuses(requireEighteenThirtyTwoState(state), companyId, center).reduce(
                (sum, bonus) => sum + bonus.amount,
                0
            ),
        stopBonusLabel: (state, _train, companyId, center) => {
            const labels = stopBonuses(requireEighteenThirtyTwoState(state), companyId, center).map(
                (bonus) => bonus.label
            )
            return labels.length ? labels.join(' + ') : undefined
        }
    }

function currentTurn(set: OperatingSet | undefined) {
    assertExists(set, 'Tokens are placed during an operating round')
    return { set: set.number, round: set.roundNumber }
}

function inOperatingSet<State extends object>(
    state: State
): state is State & { operatingSet: OperatingSet } {
    return 'operatingSet' in state && !!state.operatingSet
}

/** Placing the Key West token is the FEC's token placement for that operating turn (§7.5). */
export function keyWestPlacedThisTurn(state: StationPlacementState, companyId: string): boolean {
    if (companyId !== KeyWestCompanyId || !inOperatingSet(state)) return false
    const turn = currentTurn(state.operatingSet)
    return requireEighteenThirtyTwoState(state).revenueTokens.some(
        (token) =>
            token.kind === 'key-west' &&
            token.placed.set === turn.set &&
            token.placed.round === turn.round
    )
}

export type RevenueTokenChoice = Pick<RevenueToken, 'kind' | 'locationId' | 'nodeId'> & {
    companyId: string
}

/**
 * The tokens the operating company may place as extra placements in its token step: the Port on
 * an anchored location and Cotton in a non-coastal city while it owns their private, and from
 * phase 3 the FEC's Key West token in Miami instead of a station (§7.5, §16.2 P2–P3).
 */
export function revenueTokenChoices(
    state: EighteenThirtyTwoState,
    playerId: string
): RevenueTokenChoice[] {
    const step = state.stationStep
    const companyId = nextOperatingCompany(state)
    if (
        state.machineState !== 'PlacingStation' ||
        !step ||
        step.completed ||
        step.companyId !== companyId ||
        controllingOwner(state, companyId)?.playerId !== playerId
    )
        return []
    const placed = (kind: RevenueTokenKind) =>
        state.revenueTokens.some((token) => token.kind === kind)
    const choices: RevenueTokenChoice[] = []
    for (const kind of ['port', 'cotton'] as const) {
        const privateId = RevenueTokenPrivateIds[kind]
        if (
            placed(kind) ||
            !inGame(state, privateId) ||
            privateOwningCompany(state, privateId) !== companyId
        )
            continue
        for (const location of EighteenThirtyTwoMap.definition.locations) {
            const coastal = PortLocationIds.includes(location.id)
            if (kind === 'port' ? !coastal : coastal) continue
            for (const node of revenueNodes(
                state,
                location.id,
                kind === 'port' ? ['city', 'town', 'offboard'] : ['city']
            ))
                choices.push({ kind, companyId, locationId: location.id, nodeId: node.id })
        }
    }
    const [miami] = revenueNodes(state, MiamiLocationId, ['offboard'])
    if (
        companyId === KeyWestCompanyId &&
        miami &&
        !placed('key-west') &&
        step.placedStationIds.length === 0 &&
        EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '3') &&
        !EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '8')
    )
        choices.push({
            kind: 'key-west',
            companyId,
            locationId: MiamiLocationId,
            nodeId: miami.id
        })
    return choices
}

export const PlaceRevenueToken = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('PlaceRevenueToken'),
        companyId: Type.String(),
        kind: RevenueTokenKind,
        locationId: Type.String(),
        nodeId: Type.String()
    },
    { additionalProperties: false }
)
export type PlaceRevenueToken = Type.Static<typeof PlaceRevenueToken>
const Validator = Compile(PlaceRevenueToken)
export function isPlaceRevenueToken(action: GameAction): action is PlaceRevenueToken {
    return (
        action instanceof HydratedPlaceRevenueToken ||
        (action.type === 'PlaceRevenueToken' && Validator.Check(action))
    )
}

export class HydratedPlaceRevenueToken
    extends HydratableAction<typeof PlaceRevenueToken>
    implements PlaceRevenueToken
{
    declare type: 'PlaceRevenueToken'
    declare playerId: string
    declare companyId: string
    declare kind: RevenueTokenKind
    declare locationId: string
    declare nodeId: string
    constructor(data: PlaceRevenueToken) {
        super(data instanceof HydratedPlaceRevenueToken ? data.dehydrate() : data, Validator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User &&
            revenueTokenChoices(state, this.playerId).some(
                (choice) =>
                    choice.kind === this.kind &&
                    choice.companyId === this.companyId &&
                    choice.locationId === this.locationId &&
                    choice.nodeId === this.nodeId
            )
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'This token cannot be placed there now')
        state.revenueTokens.push({
            kind: this.kind,
            companyId: this.companyId,
            locationId: this.locationId,
            nodeId: this.nodeId,
            placed: currentTurn(state.operatingSet)
        })
    }
}

export const PlaceRevenueTokenStep: TitleStepAction = stepAction(
    'PlaceRevenueToken',
    (action: HydratedAction) => action instanceof HydratedPlaceRevenueToken,
    (state, playerId) => revenueTokenChoices(state, playerId).length > 0
)

/** A Cotton token follows its city when Atlanta's tile is upgraded (§16.2 P2). */
export function migrateRevenueTokens(
    state: Pick<EighteenThirtyTwoTitleState, 'revenueTokens'>,
    locationId: string,
    nodeMapping: Readonly<Record<string, string>>
): void {
    for (const token of state.revenueTokens)
        if (token.locationId === locationId && nodeMapping[token.nodeId])
            token.nodeId = nodeMapping[token.nodeId]
}

const RecordFields = Type.Object({ type: Type.Literal('RecordMiamiRun') })
export const RecordMiamiRun: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof RecordFields.properties
> = Type.Object(
    { ...GameAction.properties, ...RecordFields.properties },
    { additionalProperties: false }
)
export type RecordMiamiRun = Type.Static<typeof RecordMiamiRun>
const RecordValidator = Compile(RecordMiamiRun)
export function isRecordMiamiRun(action: GameAction): action is RecordMiamiRun {
    return (
        action instanceof HydratedRecordMiamiRun ||
        (action.type === 'RecordMiamiRun' && RecordValidator.Check(action))
    )
}

/** Whether the run just made was the game's first to Miami before phase 5. */
export function ranToMiamiFirst(state: EighteenThirtyTwoState): boolean {
    return (
        miamiFirstRun(state) &&
        !!state.routeStep?.result?.routes.some((route) =>
            route.visits.some((visit) => visit.locationId === MiamiLocationId)
        )
    )
}

export class HydratedRecordMiamiRun
    extends HydratableAction<typeof RecordMiamiRun>
    implements RecordMiamiRun
{
    declare type: 'RecordMiamiRun'
    constructor(data: RecordMiamiRun) {
        super(data instanceof HydratedRecordMiamiRun ? data.dehydrate() : data, RecordValidator)
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(
            this.source === ActionSource.System && ranToMiamiFirst(state),
            'Miami’s first run is recorded after it is made'
        )
        state.miamiRun = true
    }
}

/** After the first run to Miami, it pays its ordinary value (§8.4). */
export function recordsMiamiRun(
    handler: EighteenThirtyTwoStateHandler
): EighteenThirtyTwoStateHandler {
    return new SystemActionFirstHandler(handler, RecordMiamiRun, (state) =>
        ranToMiamiFirst(state) ? {} : undefined
    )
}
