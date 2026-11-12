import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedAction
} from '@tabletop/common'
import {
    EighteenXXPlayerAction,
    closePrivate,
    controllingOwner,
    nextOperatingCompany,
    privateOwningCompany,
    stepAction,
    type RouteRules,
    type StepAction
} from '@tabletop/18xx'
import { CattleLocationIds, PortLocationIds } from './map.js'
import { CattlePrivateId, PortPrivateId } from './privates.js'
import { requireState1870, type HydratedState1870, type State1870 } from './state.js'
import { RevenueTokenKind, type RevenueToken } from './titleState.js'
import { Phases1870 } from './trains.js'

/** Port and Cattle tokens leave the map with the first 6-train (p. 5). */
export function revenueTokensExpire(phaseId: string): boolean {
    return Phases1870.isAtLeast(phaseId, '6')
}

export type StopBonus = { amount: number; sourceId: 'cattle' | 'port' }

/**
 * What a stop earns beyond its value for a company: the Cattle token's $10 for its company, a
 * port's $20 for its company, and an open port's $10 for others (p. 9).
 */
export function stopBonuses(
    tokens: readonly RevenueToken[],
    companyId: string,
    locationId: string
): StopBonus[] {
    return tokens.flatMap((token): StopBonus[] => {
        if (token.locationId !== locationId) return []
        if (token.kind === 'cattle')
            return token.companyId === companyId ? [{ amount: 10, sourceId: 'cattle' }] : []
        if (token.companyId === companyId) return [{ amount: 20, sourceId: 'port' }]
        return token.kind === 'open-port' ? [{ amount: 10, sourceId: 'port' }] : []
    })
}

export const revenueTokenRoutes: Pick<RouteRules, 'stopBonus' | 'stopBonusSourceIds'> = {
    stopBonus: (state, _train, companyId, center) =>
        stopBonuses(requireState1870(state).revenueTokens, companyId, center.locationId).reduce(
            (sum, bonus) => sum + bonus.amount,
            0
        ),
    stopBonusSourceIds: (state, _train, companyId, center) => [
        ...new Set(
            stopBonuses(requireState1870(state).revenueTokens, companyId, center.locationId).map(
                (bonus) => bonus.sourceId
            )
        )
    ]
}

export type RevenueTokenChoice = {
    kind: RevenueTokenKind
    companyId: string
    locationId: string
}

function currentRound(state: State1870): [number, number] | undefined {
    const set = state.operatingSet
    return set && [set.number, set.roundNumber]
}

/**
 * The tokens the operating company may place during its turn: the Cattle token while it owns the
 * Southern Cattle Company, and while it owns the Gulf Shipping Company an open or closed port, or
 * a closed port in place of its open one in a later operating round (p. 9).
 */
export function revenueTokenChoices(state: State1870, playerId: string): RevenueTokenChoice[] {
    const companyId = nextOperatingCompany(state)
    if (
        !companyId ||
        state.destinationRun ||
        !['LayingTrack', 'PlacingStation', 'RunningTrains', 'BuyingTrains'].includes(
            state.machineState
        ) ||
        controllingOwner(state, companyId)?.playerId !== playerId
    )
        return []
    const placed = (...kinds: RevenueToken['kind'][]) =>
        state.revenueTokens.find((token) => kinds.includes(token.kind))
    const choices: RevenueTokenChoice[] = []
    if (privateOwningCompany(state, CattlePrivateId) === companyId && !placed('cattle'))
        for (const locationId of CattleLocationIds)
            choices.push({ kind: 'cattle', companyId, locationId })
    if (privateOwningCompany(state, PortPrivateId) === companyId) {
        const port = placed('open-port', 'closed-port')
        if (!port)
            for (const locationId of PortLocationIds) {
                choices.push({ kind: 'open-port', companyId, locationId })
                choices.push({ kind: 'closed-port', companyId, locationId })
            }
        else if (port.kind === 'open-port') {
            const round = currentRound(state)
            if (round && (round[0] !== port.placedInRound[0] || round[1] !== port.placedInRound[1]))
                choices.push({ kind: 'closed-port', companyId, locationId: port.locationId })
        }
    }
    return choices
}

export const PlaceRevenueToken = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('PlaceRevenueToken'),
        companyId: Type.String(),
        kind: RevenueTokenKind,
        locationId: Type.String(),
        metadata: Type.Optional(
            Type.Object(
                { closedPrivateId: Type.Optional(Type.String()) },
                { additionalProperties: false }
            )
        )
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
    declare metadata?: PlaceRevenueToken['metadata']
    constructor(data: PlaceRevenueToken) {
        super(data instanceof HydratedPlaceRevenueToken ? data.dehydrate() : data, Validator)
    }
    isValid(state: HydratedState1870): boolean {
        return (
            this.source === ActionSource.User &&
            revenueTokenChoices(state, this.playerId).some(
                (choice) =>
                    choice.kind === this.kind &&
                    choice.companyId === this.companyId &&
                    choice.locationId === this.locationId
            )
        )
    }
    apply(state: HydratedState1870): void {
        assert(this.isValid(state), 'This token cannot be placed there now')
        const round = currentRound(state)
        assert(round, 'A token is placed during an operating round')
        state.revenueTokens = [
            ...state.revenueTokens.filter(
                (token) => this.kind !== 'closed-port' || token.kind !== 'open-port'
            ),
            {
                kind: this.kind,
                companyId: this.companyId,
                locationId: this.locationId,
                placedInRound: round
            }
        ]
        // Placing the closed port closes the company; the Cattle token does not (p. 9).
        if (this.kind === 'closed-port') {
            closePrivate(state, PortPrivateId)
            this.metadata = { closedPrivateId: PortPrivateId }
        }
    }
}

export const PlaceRevenueTokenStep: StepAction<HydratedState1870> = stepAction(
    'PlaceRevenueToken',
    (action: HydratedAction) => action instanceof HydratedPlaceRevenueToken,
    (state, playerId) => revenueTokenChoices(state, playerId).length > 0
)
