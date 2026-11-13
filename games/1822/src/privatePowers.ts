import {
    RailwayMapState,
    actsFor,
    closePrivate,
    getCompany,
    hasTurnMark,
    markTurn,
    nextOperatingCompany,
    privateOwningCompany,
    privatePowerUsed,
    rotateTileFace,
    stepAction,
    tileExits,
    titleAction,
    type CompanyDecisionState,
    type ConstructionState,
    type PrivatePowerRules,
    type PrivateTrackTerms,
    type StepAction,
    type TileFace,
    type TrackLayDetails,
    type TrackRequest
} from '@tabletop/18xx'
import { ActionSource, assert, type HydratedAction } from '@tabletop/common'
import * as Type from 'typebox'
import { layRestriction1822 } from './layRestriction.js'
import { lotKind1822 } from './lots.js'
import { Map1822 } from './map.js'
import {
    AdvancedTileLayPrivateId,
    ExtraTileLayPrivateId,
    MoveCardPrivateId,
    RemoveSmallStationPrivateId,
    RiverDiscountPrivateId,
    StationSwapPrivateId
} from './privates.js'
import { addDiscountTokens } from './privateAcquisition.js'
import { requireState1822, type HydratedState1822 } from './state.js'
import { trackCompany1822 } from './turn.js'
import { TileColorOrder1822, TileSet1822, Tiles1822 } from './tiles.js'
import { exchangeTokens1822, releaseExchangeToken1822, returnExchangeToken1822 } from './tokens.js'
import { Phases1822 } from './trains.js'
import type { DiscountTokenKind } from './titleState.js'

const Yellow = 'yellow'
/** The operating turn's marks: an advanced lay taken, and P12's first extra yellow tile laid. */
export const AdvancedLayMark = 'advanced-lay'
export const ExtraLayMark = 'extra-lay'
/** The turn's mark that the next lay spends a discount token of the kind (Table 3: P8, P10). */
export function discountTokenMark(kind: DiscountTokenKind): string {
    return `discount-token:${kind}`
}

/** P8's standing discount on hills and mountains, and P10's on rivers (Table 3). */
const HillDiscount = 20
const RiverDiscount = 10
const TokenTerrainKinds: readonly string[] = ['rough', 'hill', 'mountain']
const HillTerrainKinds: readonly string[] = ['hill', 'mountain']
const RiverTerrainKind = 'water'

function hasStops(face: TileFace): boolean {
    return face.nodes.some((node) => node.kind !== 'junction')
}
function hasCity(face: TileFace): boolean {
    return face.nodes.some((node) => node.kind === 'city' || node.kind === 'offboard')
}

/** The company operating now, if the player directs it and it owns the private, its power unused. */
function owningOperatingCompany(
    state: CompanyDecisionState,
    privateCompanyId: string,
    playerId: string
): string | undefined {
    const companyId = nextOperatingCompany(state)
    return companyId &&
        privateOwningCompany(state, privateCompanyId) === companyId &&
        actsFor(state, playerId, companyId) &&
        !privatePowerUsed(state, privateCompanyId)
        ? companyId
        : undefined
}

/** The colours a company may lay now: what the phase allows, a minor no further than green (§5.8.13). */
function layableColors(state: { phaseId: string }, minor: boolean): string[] {
    const colors = Phases1822.phase(state.phaseId).tileColors
    return minor ? colors.filter((color) => color === Yellow || color === 'green') : [...colors]
}

/** The colour that becomes available next, which P11 lays early; none for a minor past green. */
function nextColor(state: { phaseId: string }, minor: boolean): string | undefined {
    const next = TileColorOrder1822.filter((color) => color !== 'white')[
        Phases1822.phase(state.phaseId).tileColors.length
    ]
    return next && (!minor || next === 'green') ? next : undefined
}

/** The single small station of a hex, if that is all it has (§3.1.14). */
function loneTownId(face: TileFace): string | undefined {
    const stops = face.nodes.filter((node) => node.kind !== 'junction')
    return stops.length === 1 && stops[0].kind === 'town' ? stops[0].id : undefined
}

function trackTerms(
    stateObject: CompanyDecisionState,
    privateCompanyId: string,
    playerId: string
): PrivateTrackTerms | undefined {
    const state = requireState1822(stateObject)
    const companyId = owningOperatingCompany(state, privateCompanyId, playerId)
    if (
        !companyId ||
        state.machineState !== 'LayingTrack' ||
        state.trackStep?.companyId !== companyId
    )
        return undefined
    const minor = getCompany(state, companyId).kind === 'minor'
    const payer = { kind: 'company' as const, companyId }
    const restriction = (request: TrackRequest) => layRestriction1822(state, request)
    const everywhere = Map1822.definition.locations
        .filter((location) => location.buildable)
        .map((location) => location.id)
    // P2 lays plain track where a single small station stands, as the turn's track lay (§3.1.14).
    if (privateCompanyId === RemoveSmallStationPrivateId) {
        const mapState = new RailwayMapState(Map1822, TileSet1822, state.tileInventory)
        return {
            companyId,
            locationIds: everywhere.filter((id) => loneTownId(mapState.tile(id).face)),
            definitionIds: Tiles1822.filter((tile) => !hasStops(tile.face)).map((tile) => tile.id),
            payer,
            connected: true,
            countsAsOrdinaryLay: true,
            restriction,
            removedStops: (_locationId, before, after) => {
                const town = loneTownId(before)
                return town && !hasStops(after) ? [town] : []
            }
        }
    }
    // P11 lays one plain or small-station upgrade of the next colour, in place of the turn's
    // track (Table 3).
    if (privateCompanyId === AdvancedTileLayPrivateId) {
        const next = nextColor(state, minor)
        if (!next || next === Yellow || state.trackStep.lays.length) return undefined
        return {
            companyId,
            locationIds: everywhere,
            definitionIds: Tiles1822.filter(
                (tile) => tile.face.color === next && !hasCity(tile.face)
            ).map((tile) => tile.id),
            payer,
            connected: true,
            restriction,
            colors: [...Phases1822.phase(state.phaseId).tileColors, next]
        }
    }
    // P12 lays an extra yellow tile, two for a major company, or one extra upgrade (Table 3).
    if (privateCompanyId === ExtraTileLayPrivateId) {
        const colors = layableColors(state, minor).filter(
            (color) => color === Yellow || !hasTurnMark(state, ExtraLayMark)
        )
        return {
            companyId,
            locationIds: everywhere,
            definitionIds: Tiles1822.filter((tile) => colors.includes(tile.face.color)).map(
                (tile) => tile.id
            ),
            payer,
            connected: true,
            restriction,
            reusable: true
        }
    }
    return undefined
}

function afterTrackLay(
    stateObject: CompanyDecisionState,
    privateCompanyId: string,
    details: TrackLayDetails
) {
    const state = requireState1822(stateObject)
    const closes = { payments: [], closedPrivateIds: [privateCompanyId] }
    const stays = { payments: [], closedPrivateIds: [] }
    if (privateCompanyId === AdvancedTileLayPrivateId) {
        markTurn(state, AdvancedLayMark)
        return closes
    }
    if (privateCompanyId !== ExtraTileLayPrivateId) return closes
    const face = Tiles1822.find((tile) => tile.id === details.definitionId)?.face
    const major = getCompany(state, details.companyId).kind === 'major'
    if (face?.color === Yellow && major && !hasTurnMark(state, ExtraLayMark)) {
        markTurn(state, ExtraLayMark)
        return stays
    }
    return closes
}

/** P12 closes with the track step in which a major company laid only one of its two extra tiles (Table 3). */
export function closeSpentExtraLay1822(state: HydratedState1822): void {
    if (hasTurnMark(state, ExtraLayMark) && !getCompany(state, ExtraTileLayPrivateId).closed)
        closePrivate(state, ExtraTileLayPrivateId)
}

export const PrivatePowerRules1822: PrivatePowerRules = {
    trackTerms,
    afterTrackLay,
    earlyTrainCompany: () => undefined
}

/** What a lay costs for terrain and estuary crossings, before any discount (§5.8.9). */
function layTerrain(
    state: ConstructionState,
    request: TrackRequest
): { terrain: number; kinds: readonly string[]; estuaries: number; estuaryCost: number } {
    const location = Map1822.location(request.locationId)
    const tile = new RailwayMapState(Map1822, TileSet1822, state.tileInventory).tile(
        request.locationId
    )
    const before = tileExits(rotateTileFace(tile.face, tile.rotation))
    const definition = Tiles1822.find((entry) => entry.id === request.definitionId)
    const after = definition ? tileExits(rotateTileFace(definition.face, request.rotation)) : before
    const crossings = [...after]
        .filter((edge) => !before.has(edge))
        .flatMap((edge) => {
            const neighbor = Map1822.neighbor(request.locationId, edge)
            const opposite = (edge + 3) % 6
            const costs = [
                ...(location.borders ?? []).filter((border) => border.edge === edge),
                ...(neighbor?.borders ?? []).filter((border) => border.edge === opposite)
            ].flatMap((border) => (border.cost ? [border.cost] : []))
            return costs.length ? [Math.max(...costs)] : []
        })
    return {
        terrain: tile.placement ? 0 : (location.terrain?.cost ?? 0),
        kinds: location.terrain?.kinds ?? [],
        estuaries: crossings.length,
        estuaryCost: crossings.reduce((sum, cost) => sum + cost, 0)
    }
}

function tokensHeld(state: HydratedState1822, companyId: string, kind: DiscountTokenKind): number {
    return (
        state.discountTokens.find((entry) => entry.companyId === companyId && entry.kind === kind)
            ?.count ?? 0
    )
}

/** The discount tokens a lay would spend, of those the company has said it is using. */
export function discountTokensSpent1822(
    stateObject: ConstructionState,
    request: TrackRequest
): { terrain: boolean; estuaries: number } {
    const state = requireState1822(stateObject)
    const parts = layTerrain(state, request)
    return {
        terrain:
            hasTurnMark(state, discountTokenMark('terrain')) &&
            tokensHeld(state, request.companyId, 'terrain') > 0 &&
            parts.terrain > 0 &&
            parts.kinds.some((kind) => TokenTerrainKinds.includes(kind)),
        estuaries: hasTurnMark(state, discountTokenMark('estuary'))
            ? Math.min(tokensHeld(state, request.companyId, 'estuary'), parts.estuaries)
            : 0
    }
}

/**
 * What a lay's terrain costs the company after its private companies' discounts: P8's token
 * pays the whole of a rough, hill or mountain hex, or its standing discount takes £20 off hills
 * and mountains; P10 takes £10 off rivers and its tokens each pay one estuary crossing (Table 3).
 */
export function terrainCost1822(
    stateObject: ConstructionState,
    request: TrackRequest,
    cost: number
) {
    const state = requireState1822(stateObject)
    const parts = layTerrain(state, request)
    const spent = discountTokensSpent1822(state, request)
    let discount = 0
    if (spent.terrain) discount += parts.terrain
    else if (parts.terrain) {
        if (
            state.hillDiscountCompanyId === request.companyId &&
            parts.kinds.some((kind) => HillTerrainKinds.includes(kind))
        )
            discount += Math.min(HillDiscount, parts.terrain)
        if (
            privateOwningCompany(state, RiverDiscountPrivateId) === request.companyId &&
            parts.kinds.includes(RiverTerrainKind)
        )
            discount += Math.min(RiverDiscount, parts.terrain)
    }
    if (spent.estuaries && parts.estuaries)
        discount += (parts.estuaryCost / parts.estuaries) * spent.estuaries
    return Math.max(0, cost - discount)
}

/** Takes the discount tokens a lay spent; P10 closes with its second (Table 3). */
export function spendDiscountTokens1822(
    stateObject: ConstructionState,
    companyId: string,
    spent: { terrain: boolean; estuaries: number }
): void {
    const state = requireState1822(stateObject)
    if (spent.terrain) addDiscountTokens(state, companyId, 'terrain', -1)
    if (spent.estuaries) {
        addDiscountTokens(state, companyId, 'estuary', -spent.estuaries)
        if (
            !tokensHeld(state, companyId, 'estuary') &&
            privateOwningCompany(state, RiverDiscountPrivateId) === companyId
        )
            closePrivate(state, RiverDiscountPrivateId)
    }
    if (spent.terrain || spent.estuaries)
        state.turnMarks = state.turnMarks?.filter(
            (mark) =>
                !(spent.terrain && mark === discountTokenMark('terrain')) &&
                !(spent.estuaries && mark === discountTokenMark('estuary'))
        )
}

/** The kinds of discount token the player's company holds and has not yet said it is using. */
export function usableDiscountTokens1822(
    state: HydratedState1822,
    playerId: string
): DiscountTokenKind[] {
    const companyId = trackCompany1822(state, playerId)
    if (!companyId) return []
    const kinds: DiscountTokenKind[] = ['terrain', 'estuary']
    return kinds.filter(
        (kind) =>
            tokensHeld(state, companyId, kind) > 0 && !hasTurnMark(state, discountTokenMark(kind))
    )
}

const UseDiscountTokenAction = titleAction('UseDiscountToken', {
    companyId: Type.String({ minLength: 1 }),
    kind: Type.Union([Type.Literal('terrain'), Type.Literal('estuary')])
})
export const UseDiscountToken = UseDiscountTokenAction.schema
export type UseDiscountToken = Type.Static<typeof UseDiscountToken>
export const isUseDiscountToken = UseDiscountTokenAction.is

/** The company says its next lay spends its discount tokens of the kind, where they apply (Table 3). */
export class HydratedUseDiscountToken extends UseDiscountTokenAction.Base {
    declare playerId: string
    declare companyId: UseDiscountToken['companyId']
    declare kind: UseDiscountToken['kind']
    isValid(state: HydratedState1822): boolean {
        return (
            this.source === ActionSource.User &&
            trackCompany1822(state, this.playerId) === this.companyId &&
            usableDiscountTokens1822(state, this.playerId).includes(this.kind)
        )
    }
    apply(state: HydratedState1822): void {
        assert(this.isValid(state), 'The company holds no such discount token to use')
        markTurn(state, discountTokenMark(this.kind))
    }
}

/** The certificates P17 may move: those still in their stacks, not in the bidding boxes (Table 3). */
export function movableStackCards1822(state: HydratedState1822, playerId: string): string[] {
    return owningOperatingCompany(state, MoveCardPrivateId, playerId)
        ? state.bidBoxes.stacks.flatMap((stack) => stack.lotIds)
        : []
}

const MoveStackCardAction = titleAction('MoveStackCard', {
    companyId: Type.String({ minLength: 1 }),
    lotId: Type.String({ minLength: 1 }),
    to: Type.Union([Type.Literal('top'), Type.Literal('bottom')])
})
export const MoveStackCard = MoveStackCardAction.schema
export type MoveStackCard = Type.Static<typeof MoveStackCard>
export const isMoveStackCard = MoveStackCardAction.is

/** P17 moves one certificate to the top or the bottom of its stack, and closes (Table 3). */
export class HydratedMoveStackCard extends MoveStackCardAction.Base {
    declare playerId: string
    declare companyId: MoveStackCard['companyId']
    declare lotId: MoveStackCard['lotId']
    declare to: MoveStackCard['to']
    isValid(state: HydratedState1822): boolean {
        return (
            this.source === ActionSource.User &&
            owningOperatingCompany(state, MoveCardPrivateId, this.playerId) === this.companyId &&
            movableStackCards1822(state, this.playerId).includes(this.lotId)
        )
    }
    apply(state: HydratedState1822): void {
        assert(this.isValid(state), 'P17 moves a certificate still in its stack')
        const kind = lotKind1822(this.lotId)
        state.bidBoxes.stacks = state.bidBoxes.stacks.map((stack) => {
            if (stack.id !== kind) return stack
            const rest = stack.lotIds.filter((lotId) => lotId !== this.lotId)
            return {
                ...stack,
                lotIds: this.to === 'top' ? [this.lotId, ...rest] : [...rest, this.lotId]
            }
        })
        closePrivate(state, MoveCardPrivateId)
    }
}

/** The token moves P18 offers: an exchange token made available, or an available one put back (Table 3). */
export function stationSwaps1822(
    state: HydratedState1822,
    playerId: string
): ('to-available' | 'to-exchange')[] {
    const companyId = owningOperatingCompany(state, StationSwapPrivateId, playerId)
    if (!companyId) return []
    const available = state.stations.some(
        (station) => station.companyId === companyId && station.status === 'available'
    )
    return [
        ...(exchangeTokens1822(state, companyId) ? ['to-available' as const] : []),
        ...(available ? ['to-exchange' as const] : [])
    ]
}

const SwapStationTokenAction = titleAction('SwapStationToken', {
    companyId: Type.String({ minLength: 1 }),
    direction: Type.Union([Type.Literal('to-available'), Type.Literal('to-exchange')])
})
export const SwapStationToken = SwapStationTokenAction.schema
export type SwapStationToken = Type.Static<typeof SwapStationToken>
export const isSwapStationToken = SwapStationTokenAction.is

/** P18 moves a token between the company's exchange tokens and its available tokens, and closes (Table 3). */
export class HydratedSwapStationToken extends SwapStationTokenAction.Base {
    declare playerId: string
    declare companyId: SwapStationToken['companyId']
    declare direction: SwapStationToken['direction']
    isValid(state: HydratedState1822): boolean {
        return (
            this.source === ActionSource.User &&
            owningOperatingCompany(state, StationSwapPrivateId, this.playerId) === this.companyId &&
            stationSwaps1822(state, this.playerId).includes(this.direction)
        )
    }
    apply(state: HydratedState1822): void {
        assert(this.isValid(state), 'P18 has no such token to move')
        if (this.direction === 'to-available') releaseExchangeToken1822(state, this.companyId)
        else {
            const station = state.stations.find(
                (entry) => entry.companyId === this.companyId && entry.status === 'available'
            )
            assert(station, 'The company has an available token')
            returnExchangeToken1822(state, station.id)
        }
        closePrivate(state, StationSwapPrivateId)
    }
}

export const PrivatePowerSteps: readonly StepAction<HydratedState1822>[] = [
    stepAction(
        UseDiscountTokenAction.type,
        (action: HydratedAction): action is HydratedUseDiscountToken =>
            action instanceof HydratedUseDiscountToken,
        (state, playerId) => usableDiscountTokens1822(state, playerId).length > 0
    ),
    stepAction(
        MoveStackCardAction.type,
        (action: HydratedAction): action is HydratedMoveStackCard =>
            action instanceof HydratedMoveStackCard,
        (state, playerId) =>
            state.machineState === 'LayingTrack' &&
            movableStackCards1822(state, playerId).length > 0
    ),
    stepAction(
        SwapStationTokenAction.type,
        (action: HydratedAction): action is HydratedSwapStationToken =>
            action instanceof HydratedSwapStationToken,
        (state, playerId) => stationSwaps1822(state, playerId).length > 0
    )
]

export const PrivatePowerActions = [
    UseDiscountTokenAction.define((action) => new HydratedUseDiscountToken(action)),
    MoveStackCardAction.define((action) => new HydratedMoveStackCard(action)),
    SwapStationTokenAction.define((action) => new HydratedSwapStationToken(action))
]
