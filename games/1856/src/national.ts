import {
    ActionSource,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import {
    BetweenCompaniesState,
    CashPayment,
    SystemActionFirstHandler,
    closeShareCompany,
    companyLoans,
    controllingOwner,
    createOrdinaryShareCertificates,
    finiteCashOwnedBy,
    getCompany,
    homeStationId,
    placeStockMarker,
    presidentOf,
    removeLocationMarkers,
    removeStockMarker,
    repayLoan,
    replaceStation,
    settleCashPayments,
    sharesOwned,
    systemAction,
    titleAction,
    transferCompanyAssets,
    trainsOwnedBy,
    type FinancialState,
    type Owner
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { forgetClosedCompany } from './capitalization.js'
import { CgrId, MajorIds1856 } from './companies.js'
import { LoanRules1856, LoanValue1856 } from './loans.js'
import { IpoPoolId1856, MarketPoolId1856 } from './names.js'
import {
    NationalFormationState,
    PortMarkerKind,
    requireState1856,
    type HydratedState1856,
    type StateHandler1856
} from './state.js'
import { companiesInPlay } from './stock.js'
import { Market1856 } from './stockMarket.js'
import { NationalPhaseId, NationalTrainLimit, Phases1856, isPermanentTrain } from './trains.js'

const Id = Type.String({ minLength: 1 })

/** Whether the CGR's formation is still to come: the 6s are here and it has neither formed nor failed to. */
function formationDue(state: HydratedState1856): boolean {
    const cgr = getCompany(state, CgrId)
    return (
        Phases1856.isAtLeast(state.phaseId, NationalPhaseId) &&
        !cgr.started &&
        !cgr.closed &&
        !state.nationalFormation &&
        !!state.operatingSet &&
        !state.operatingSet.completed
    )
}

/** The players in seat order, starting with the given one (Absorbing Companies). */
export function playersFrom(state: HydratedState1856, playerId: string): string[] {
    const seats = state.players.map((player) => player.playerId)
    const start = seats.indexOf(playerId)
    return [...seats.slice(start), ...seats.slice(0, start)]
}

function presidentId(state: HydratedState1856, companyId: string): string {
    const president = controllingOwner(state, companyId)
    assertExists(president, 'A public company has a president')
    return president.playerId
}

const BeginNationalFormationAction = systemAction('BeginNationalFormation', {
    metadata: Type.Optional(
        Type.Object(
            {
                repayments: Type.Array(CashPayment),
                owing: Type.Array(Id),
                portRemoved: Type.Optional(Type.Literal(true))
            },
            { additionalProperties: false }
        )
    )
})
export const BeginNationalFormation = BeginNationalFormationAction.schema
export type BeginNationalFormation = Type.Static<typeof BeginNationalFormation>
export const isBeginNationalFormation = BeginNationalFormationAction.is

/**
 * As the first 6-train's buyer ends its turn every company with loans repays all it can from its
 * treasury, $100 at a time; the port token leaves the map (Absorbing Companies, Phase Five).
 */
class HydratedBeginNationalFormation
    extends BeginNationalFormationAction.Base
    implements BeginNationalFormation
{
    declare type: 'BeginNationalFormation'
    declare metadata?: BeginNationalFormation['metadata']
    apply(state: HydratedState1856): void {
        assert(
            this.source === ActionSource.System && formationDue(state),
            'The CGR forms once, as the first 6-train’s buyer ends its turn'
        )
        const set = state.operatingSet
        assertExists(set, 'The CGR forms in an operating round')
        const buyer = set.completedCompanyIds.at(-1)
        assertExists(buyer, 'A company bought the first 6-train')
        const triggerPlayerId = presidentId(state, buyer)
        const repayments: CashPayment[] = []
        for (const companyId of MajorIds1856) {
            const treasury = { kind: 'company' as const, companyId }
            while (
                companyLoans(state, companyId) &&
                finiteCashOwnedBy(state, treasury) >= LoanValue1856
            )
                repayments.push(repayLoan(state, LoanRules1856, companyId).payment)
        }
        const order = playersFrom(state, triggerPlayerId)
        const operating = set.companyOrder
        const owing = MajorIds1856.filter((companyId) => companyLoans(state, companyId) > 0).sort(
            (a, b) =>
                order.indexOf(presidentId(state, a)) - order.indexOf(presidentId(state, b)) ||
                operating.indexOf(a) - operating.indexOf(b)
        )
        const portRemoved = !!state.port
        delete state.port
        removeLocationMarkers(state, { kind: PortMarkerKind })
        state.nationalFormation = {
            triggerPlayerId,
            owing,
            absorbed: [],
            activePlayerIds: [...state.activePlayerIds]
        }
        this.metadata = { repayments, owing, ...(portRemoved ? { portRemoved: true } : {}) }
    }
}

/** What the company still owes on its loans. */
export function loansOwed(state: HydratedState1856, companyId: string): number {
    return companyLoans(state, companyId) * LoanValue1856
}

/** The company whose president decides next, and the companies they may decide for. */
export function nationalDecision(
    state: HydratedState1856
): { playerId: string; companyIds: string[] } | undefined {
    const formation = state.nationalFormation
    if (!formation || formation.formed) return undefined
    const [first] = formation.owing
    if (!first) return undefined
    const playerId = presidentId(state, first)
    return {
        playerId,
        companyIds: formation.owing.filter((id) => presidentId(state, id) === playerId)
    }
}

/**
 * What the president must add to the treasury's remaining cash to repay the company's loans
 * (1995 Loan Repayment).
 */
export function nationalTopUp(state: HydratedState1856, companyId: string): number {
    return Math.max(
        0,
        loansOwed(state, companyId) - finiteCashOwnedBy(state, { kind: 'company', companyId })
    )
}

/** Whether the president can repay the company's remaining loans with their own cash. */
export function canRepayNationalLoans(state: HydratedState1856, companyId: string): boolean {
    const playerId = presidentId(state, companyId)
    return finiteCashOwnedBy(state, { kind: 'player', playerId }) >= nationalTopUp(state, companyId)
}

const SettleNationalLoansAction = titleAction('SettleNationalLoans', {
    companyId: Id,
    repay: Type.Boolean(),
    metadata: Type.Optional(
        Type.Object({ payments: Type.Array(CashPayment) }, { additionalProperties: false })
    )
})
export const SettleNationalLoans = SettleNationalLoansAction.schema
export type SettleNationalLoans = Type.Static<typeof SettleNationalLoans>
export const isSettleNationalLoans = SettleNationalLoansAction.is

/**
 * The president repays the rest from their own cash, never by selling shares, or lets the CGR
 * absorb the company; the system lets it go when the president cannot pay (Absorbing Companies).
 */
class HydratedSettleNationalLoans
    extends SettleNationalLoansAction.Base
    implements SettleNationalLoans
{
    declare type: 'SettleNationalLoans'
    declare playerId: string
    declare companyId: string
    declare repay: boolean
    declare metadata?: SettleNationalLoans['metadata']
    isValidFor(state: HydratedState1856): boolean {
        const decision = nationalDecision(state)
        if (!decision?.companyIds.includes(this.companyId) || decision.playerId !== this.playerId)
            return false
        if (this.source === ActionSource.System)
            return !this.repay && !canRepayNationalLoans(state, this.companyId)
        return !this.repay || canRepayNationalLoans(state, this.companyId)
    }
    apply(state: HydratedState1856): void {
        assert(this.isValidFor(state), 'The president settles their company’s loans in turn')
        const formation = state.nationalFormation
        assertExists(formation, 'Loans are settled as the CGR forms')
        formation.owing = formation.owing.filter((id) => id !== this.companyId)
        if (!this.repay) {
            formation.absorbed = [...formation.absorbed, this.companyId]
            this.metadata = { payments: [] }
            return
        }
        const topUp = nationalTopUp(state, this.companyId)
        const treasury: CashPayment = {
            from: { kind: 'company', companyId: this.companyId },
            to: { kind: 'bank' },
            amount: loansOwed(state, this.companyId) - topUp
        }
        const payment: CashPayment = {
            from: { kind: 'player', playerId: this.playerId },
            to: { kind: 'bank' },
            amount: topUp
        }
        settleCashPayments(
            state,
            [treasury, payment].filter((entry) => entry.amount > 0)
        )
        delete getCompany(state, this.companyId).loans
        this.metadata = { payments: [treasury, payment].filter((entry) => entry.amount > 0) }
    }
}

/** The CGR's first price: $100, or the top-row space right of $100 closest to its absorbed companies' average (Stock Value). */
export function nationalPriceSpaceId(prices: readonly number[]): string {
    const sorted = [...prices].sort((a, b) => a - b)
    const counted = sorted.length > 2 ? sorted.slice(1) : sorted
    const average =
        Math.floor(counted.reduce((sum, price) => sum + price, 0) / counted.length / 5) * 5
    const top = Market1856.spaces
        .filter((space) => space.row === 0 && space.price >= 100)
        .sort((a, b) => a.price - b.price)
    if (average <= 100) return top[0].id
    const closest = top
        .slice(1)
        .reduce((best, space) =>
            Math.abs(space.price - average) < Math.abs(best.price - average) ? space : best
        )
    return closest.id
}

/** What each player and the open market receive in the exchange, and the CGR's president. */
export type NationalExchange = {
    players: { playerId: string; shares: number }[]
    market: number
    shareCount: 10 | 20
    presidentId: string
    /** The president received a single share and owes a second. */
    owesSecondShare: boolean
}

/**
 * Two shares of the absorbed companies for one CGR share, players in seat order from the 6's
 * buyer, then the open market; single shares go to the open market, then are discarded. A second
 * issue of ten makes twenty 5% shares; beyond that nothing is exchanged. The president's
 * certificate goes to the player with the most CGR shares, the first of them from the 6's buyer,
 * or, if none has two, to the first to receive one (Share Exchange, Determining the CGR President).
 */
export function nationalExchange(
    state: HydratedState1856,
    absorbed: readonly string[],
    triggerPlayerId: string
): NationalExchange {
    let left = 20
    let singles = absorbed.reduce((sum, companyId) => sum + marketShares(state, companyId), 0)
    const players: NationalExchange['players'] = []
    for (const playerId of playersFrom(state, triggerPlayerId)) {
        const held = absorbed.reduce(
            (sum, companyId) => sum + sharesOwned(state, companyId, { kind: 'player', playerId }),
            0
        )
        singles += held % 2
        const shares = Math.min(Math.floor(held / 2), left)
        left -= shares
        if (shares) players.push({ playerId, shares })
    }
    const market = Math.min(Math.floor(singles / 2), left)
    const issued = 20 - left - market
    const shareCount = issued + market > 10 ? 20 : 10
    const most = Math.max(...players.map((entry) => entry.shares))
    const president = players.find((entry) => entry.shares === most)
    assertExists(president, 'The CGR forms with at least one player’s shares')
    return {
        players,
        market,
        shareCount,
        presidentId: president.playerId,
        owesSecondShare: president.shares === 1
    }
}

/** The company's shares in the open market. */
function marketShares(state: FinancialState, companyId: string): number {
    return state.certificates.reduce(
        (sum, certificate) =>
            sum +
            (certificate.kind === 'share' &&
            certificate.companyId === companyId &&
            certificate.poolId === MarketPoolId1856
                ? certificate.shares
                : 0),
        0
    )
}

type Allocation = { owner: Owner; poolId?: string }

function nationalCertificates(exchange: NationalExchange) {
    const ipo: Allocation = { owner: { kind: 'bank' }, poolId: IpoPoolId1856 }
    const allocations: Allocation[] = []
    for (const { playerId, shares } of exchange.players) {
        const own = playerId === exchange.presidentId ? Math.max(0, shares - 2) : shares
        for (let index = 0; index < own; index++)
            allocations.push({ owner: { kind: 'player', playerId } })
    }
    for (let index = 0; index < exchange.market; index++)
        allocations.push({ owner: { kind: 'bank' }, poolId: MarketPoolId1856 })
    const ordinary = exchange.shareCount - 2
    while (allocations.length < ordinary) allocations.push(ipo)
    const certificates = createOrdinaryShareCertificates(CgrId, allocations.slice(0, ordinary), {
        kind: 'player',
        playerId: exchange.presidentId
    })
    return certificates.map((certificate) =>
        certificate.president && exchange.owesSecondShare
            ? { ...certificate, shares: 1 }
            : certificate
    )
}

/** The absorbed companies' placed stations beyond their homes, outside the homes' hexes. */
function stationCandidates(state: HydratedState1856, absorbed: readonly string[]) {
    const homes = absorbed.flatMap((companyId) => {
        const home = state.stations.find((station) => station.id === homeStationId(companyId))
        return home?.status === 'placed' ? [home] : []
    })
    const homeHexes = new Set(homes.map((home) => home.position.locationId))
    const others = state.stations.flatMap((station) =>
        absorbed.includes(station.companyId) &&
        station.status === 'placed' &&
        station.id !== homeStationId(station.companyId) &&
        !homeHexes.has(station.position.locationId)
            ? [station]
            : []
    )
    return { homes, others }
}

/** How many of the other stations the CGR keeps: one a hex, up to its ten in all (Token Exchange). */
function stationsKept(homes: number, others: readonly { position: { locationId: string } }[]) {
    const hexes = new Set(others.map((station) => station.position.locationId)).size
    return Math.max(0, Math.min(hexes, 10 - homes))
}

function nationalStationIds(state: HydratedState1856): string[] {
    return state.stations
        .filter((station) => station.companyId === CgrId && station.status === 'available')
        .map((station) => station.id)
}

function replaceWithNational(state: HydratedState1856, stationIds: readonly string[]): void {
    const free = nationalStationIds(state)
    stationIds.forEach((stationId, index) => {
        const national = free[index]
        assertExists(national, 'The CGR has a station for each it takes over')
        replaceStation(state, stationId, national)
    })
}

/** Whether the president must choose which trains the CGR keeps (CGR Trains). */
function trainChoiceNeeded(state: HydratedState1856): boolean {
    const trains = trainsOwnedBy(state, { kind: 'company', companyId: CgrId })
    return (
        trains.length > NationalTrainLimit ||
        trains.some((train) => !isPermanentTrain(train.definitionId))
    )
}

const FormNationalAction = systemAction('FormNational', {
    metadata: Type.Optional(
        Type.Object(
            {
                absorbed: Type.Array(Id),
                players: Type.Array(
                    Type.Object(
                        { playerId: Id, shares: Type.Integer({ minimum: 1 }) },
                        { additionalProperties: false }
                    )
                ),
                market: Type.Integer({ minimum: 0 }),
                shareCount: Type.Integer({ minimum: 10 }),
                presidentId: Type.Optional(Id),
                owesSecondShare: Type.Optional(Type.Literal(true)),
                marketSpaceId: Type.Optional(Id),
                cash: Type.Integer({ minimum: 0 })
            },
            { additionalProperties: false }
        )
    )
})
export const FormNational = FormNationalAction.schema
export type FormNational = Type.Static<typeof FormNational>
export const isFormNational = FormNationalAction.is

/**
 * The CGR takes the absorbed companies' shares in exchange, their cash, trains and rights, and
 * their home stations; it starts at its averaged price. If every company repaid, it never forms
 * (Share Exchange, Stock Value, Treasury, Non-Formation).
 */
class HydratedFormNational extends FormNationalAction.Base implements FormNational {
    declare type: 'FormNational'
    declare metadata?: FormNational['metadata']
    apply(state: HydratedState1856): void {
        const formation = state.nationalFormation
        assert(
            this.source === ActionSource.System &&
                !!formation &&
                !formation.formed &&
                !formation.owing.length,
            'The CGR forms once every president has settled'
        )
        const { absorbed } = formation
        const cgr = getCompany(state, CgrId)
        if (!absorbed.length) {
            cgr.closed = true
            state.certificateLimitCompanies = companiesInPlay(state)
            this.metadata = { absorbed: [], players: [], market: 0, shareCount: 10, cash: 0 }
            endFormation(state)
            return
        }
        const exchange = nationalExchange(state, absorbed, formation.triggerPlayerId)
        const prices = absorbed.map(
            (companyId) => Market1856.companySpace(state.stockMarket, companyId).price
        )
        const marketSpaceId = nationalPriceSpaceId(prices)
        state.certificates = [...state.certificates, ...nationalCertificates(exchange)]
        cgr.started = true
        cgr.floated = true
        cgr.funded = true
        cgr.parPrice = Market1856.space(marketSpaceId).price
        if (exchange.shareCount === 20) cgr.shareCount = 20
        placeStockMarker(state.stockMarket, CgrId, marketSpaceId)
        let cash = 0
        for (const companyId of absorbed) {
            const transfer = transferCompanyAssets(state, companyId, CgrId, { loans: false })
            cash += transfer.payment?.amount ?? 0
        }
        const rights = new Set(
            (state.accessRights ?? [])
                .filter((right) => absorbed.includes(right.companyId) || right.companyId === CgrId)
                .map((right) => right.rightId)
        )
        state.accessRights = [
            ...(state.accessRights ?? []).filter(
                (right) => !absorbed.includes(right.companyId) && right.companyId !== CgrId
            ),
            ...[...rights].map((rightId) => ({ rightId, companyId: CgrId }))
        ]
        const { homes, others } = stationCandidates(state, absorbed)
        replaceWithNational(
            state,
            homes.map((home) => home.id)
        )
        const keep = stationsKept(homes.length, others)
        const hexes = new Set(others.map((station) => station.position.locationId))
        if (keep === hexes.size && hexes.size === others.length)
            replaceWithNational(
                state,
                others.map((station) => station.id)
            )
        else if (keep)
            formation.stationChoice = {
                stations: others.map((station) => ({
                    stationId: station.id,
                    companyId: station.companyId,
                    position: { ...station.position }
                })),
                keep
            }
        closeAbsorbed(state, absorbed)
        if (trainChoiceNeeded(state)) formation.trainChoice = true
        state.national = {
            ...(exchange.owesSecondShare ? { presidencyOwedBy: exchange.presidentId } : {})
        }
        formation.formed = true
        this.metadata = {
            absorbed: [...absorbed],
            players: exchange.players,
            market: exchange.market,
            shareCount: exchange.shareCount,
            presidentId: exchange.presidentId,
            ...(exchange.owesSecondShare ? { owesSecondShare: true as const } : {}),
            marketSpaceId,
            cash
        }
        if (!formation.stationChoice && !formation.trainChoice) completeFormation(state)
    }
}

const ChooseNationalStationsAction = titleAction('ChooseNationalStations', {
    stationIds: Type.Array(Id, { uniqueItems: true, default: [] })
})
export const ChooseNationalStations = ChooseNationalStationsAction.schema
export type ChooseNationalStations = Type.Static<typeof ChooseNationalStations>
export const isChooseNationalStations = ChooseNationalStationsAction.is

/** Whether the stations the president keeps are legal: one a hex, as many as the CGR may keep. */
export function nationalStationsReason(
    state: HydratedState1856,
    stationIds: readonly string[]
): string | undefined {
    const choice = state.nationalFormation?.stationChoice
    if (!choice) return 'No stations are being chosen.'
    const kept = choice.stations.filter((station) => stationIds.includes(station.stationId))
    if (kept.length !== stationIds.length)
        return 'Only the absorbed companies’ stations may be kept.'
    if (stationIds.length !== choice.keep) return `The CGR keeps ${choice.keep} of these stations.`
    const hexes = kept.map((station) => station.position.locationId)
    if (new Set(hexes).size !== hexes.length) return 'The CGR keeps one station a hex.'
    return undefined
}

/** The CGR's president keeps every station they legally can, one a hex (Token Exchange). */
class HydratedChooseNationalStations
    extends ChooseNationalStationsAction.Base
    implements ChooseNationalStations
{
    declare type: 'ChooseNationalStations'
    declare playerId: string
    declare stationIds: string[]
    apply(state: HydratedState1856): void {
        assert(
            this.source === ActionSource.User &&
                presidentOf(state, CgrId)?.kind === 'player' &&
                presidentId(state, CgrId) === this.playerId &&
                !nationalStationsReason(state, this.stationIds),
            'The CGR’s president keeps a legal set of stations'
        )
        const formation = state.nationalFormation
        assertExists(formation, 'Stations are chosen as the CGR forms')
        const choice = formation.stationChoice
        assertExists(choice, 'Stations are being chosen')
        const free = nationalStationIds(state)
        const positions = choice.stations
            .filter((station) => this.stationIds.includes(station.stationId))
            .map((station) => station.position)
        state.stations = state.stations.map((station) => {
            const index = free.indexOf(station.id)
            const position = positions[index]
            return index >= 0 && position
                ? { id: station.id, companyId: CgrId, status: 'placed', position: { ...position } }
                : station
        })
        delete formation.stationChoice
        if (!formation.trainChoice) completeFormation(state)
    }
}

const ChooseNationalTrainsAction = titleAction('ChooseNationalTrains', {
    trainIds: Type.Array(Id, { uniqueItems: true, default: [] })
})
export const ChooseNationalTrains = ChooseNationalTrainsAction.schema
export type ChooseNationalTrains = Type.Static<typeof ChooseNationalTrains>
export const isChooseNationalTrains = ChooseNationalTrainsAction.is

/** Whether the trains kept are legal: up to three, every permanent train among them while room remains. */
export function nationalTrainsReason(
    state: HydratedState1856,
    trainIds: readonly string[]
): string | undefined {
    if (!state.nationalFormation?.trainChoice) return 'No trains are being chosen.'
    const trains = trainsOwnedBy(state, { kind: 'company', companyId: CgrId })
    const kept = trains.filter((train) => trainIds.includes(train.id))
    if (kept.length !== trainIds.length) return 'Only the absorbed companies’ trains may be kept.'
    if (kept.length > NationalTrainLimit) return 'The CGR keeps at most three trains.'
    const permanent = trains.filter((train) => isPermanentTrain(train.definitionId)).length
    const keptPermanent = kept.filter((train) => isPermanentTrain(train.definitionId)).length
    if (keptPermanent < Math.min(permanent, NationalTrainLimit))
        return 'The CGR keeps every permanent train, up to three.'
    return undefined
}

/** The CGR's president keeps its permanent trains and any others they wish, up to three (CGR Trains). */
class HydratedChooseNationalTrains
    extends ChooseNationalTrainsAction.Base
    implements ChooseNationalTrains
{
    declare type: 'ChooseNationalTrains'
    declare playerId: string
    declare trainIds: string[]
    apply(state: HydratedState1856): void {
        const formation = state.nationalFormation
        assert(
            this.source === ActionSource.User &&
                !!formation &&
                !formation.stationChoice &&
                presidentId(state, CgrId) === this.playerId &&
                !nationalTrainsReason(state, this.trainIds),
            'The CGR’s president keeps a legal set of trains'
        )
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            train.status === 'owned' &&
            train.owner.kind === 'company' &&
            train.owner.companyId === CgrId &&
            !this.trainIds.includes(train.id)
                ? { id: train.id, definitionId: train.definitionId, status: 'market' }
                : train
        )
        delete formation?.trainChoice
        completeFormation(state)
    }
}

/** The absorbed companies close, their loans forgiven, their shares exchanged. */
function closeAbsorbed(state: HydratedState1856, absorbed: readonly string[]): void {
    for (const companyId of absorbed) {
        delete getCompany(state, companyId).loans
        closeShareCompany(state, companyId, 'market')
        forgetClosedCompany(state, companyId)
        removeStockMarker(state.stockMarket, companyId)
    }
}

/**
 * The CGR's permanent train frees its price,
 * and it operates next unless one of its companies has operated this round (Triggering
 * Formation, CGR Trains).
 */
function completeFormation(state: HydratedState1856): void {
    const formation = state.nationalFormation
    assertExists(formation, 'The CGR is forming')
    const set = state.operatingSet
    assertExists(set, 'The CGR forms in an operating round')
    const operated = formation.absorbed.some((id) => set.completedCompanyIds.includes(id))
    const national = state.national
    assertExists(national, 'The CGR has formed')
    if (
        trainsOwnedBy(state, { kind: 'company', companyId: CgrId }).some((train) =>
            isPermanentTrain(train.definitionId)
        )
    )
        national.permanentTrain = true
    if (!operated) {
        const done = set.companyOrder.filter((id) => set.completedCompanyIds.includes(id))
        const pending = set.companyOrder.filter((id) => !set.completedCompanyIds.includes(id))
        set.companyOrder = [...done, CgrId, ...pending]
    }
    state.certificateLimitCompanies = companiesInPlay(state)
    endFormation(state)
}

function endFormation(state: HydratedState1856): void {
    const formation = state.nationalFormation
    assertExists(formation, 'The CGR is forming')
    state.activePlayerIds = formation.activePlayerIds
    delete state.nationalFormation
}

export const NationalActions1856 = [
    BeginNationalFormationAction.define((action) => new HydratedBeginNationalFormation(action)),
    SettleNationalLoansAction.define((action) => new HydratedSettleNationalLoans(action)),
    FormNationalAction.define((action) => new HydratedFormNational(action)),
    ChooseNationalStationsAction.define((action) => new HydratedChooseNationalStations(action)),
    ChooseNationalTrainsAction.define((action) => new HydratedChooseNationalTrains(action))
]

/** Between companies, once the first 6-train's buyer has ended its turn, the CGR forms. */
export function formsNational(handler: StateHandler1856): StateHandler1856 {
    return new SystemActionFirstHandler(
        handler,
        BeginNationalFormation,
        (state) => (formationDue(requireState1856(state)) ? {} : undefined),
        NationalFormationState
    )
}

/** Who acts in the formation now, and with what. */
function formationTurn(
    state: HydratedState1856
):
    | { playerId: string; action: string }
    | { system: 'FormNational' | 'decline'; companyId?: string }
    | undefined {
    const formation = state.nationalFormation
    if (!formation) return undefined
    if (!formation.formed) {
        const decision = nationalDecision(state)
        if (!decision) return { system: 'FormNational' }
        const affordable = decision.companyIds.filter((id) => canRepayNationalLoans(state, id))
        if (!affordable.length) return { system: 'decline', companyId: decision.companyIds[0] }
        return { playerId: decision.playerId, action: 'SettleNationalLoans' }
    }
    const playerId = presidentId(state, CgrId)
    if (formation.stationChoice) return { playerId, action: 'ChooseNationalStations' }
    if (formation.trainChoice) return { playerId, action: 'ChooseNationalTrains' }
    return undefined
}

/** The CGR's formation: presidents settle their loans, then its president keeps stations and trains. */
export class NationalFormationHandler implements StateHandler1856 {
    isValidAction(action: HydratedAction, context: MachineContext<HydratedState1856>): boolean {
        const state = context.gameState
        const turn = formationTurn(state)
        if (!turn) return false
        if ('system' in turn) {
            if (turn.system === 'FormNational') return isFormNational(action)
            return (
                isSettleNationalLoans(action) &&
                action.source === ActionSource.System &&
                action.companyId === turn.companyId &&
                !action.repay
            )
        }
        if (action.type !== turn.action || !('playerId' in action)) return false
        return action.playerId === turn.playerId
    }
    validActionsForPlayer(playerId: string, context: MachineContext<HydratedState1856>): string[] {
        const turn = formationTurn(context.gameState)
        return turn && 'playerId' in turn && turn.playerId === playerId ? [turn.action] : []
    }
    enter(context: MachineContext<HydratedState1856>): void {
        const state = context.gameState
        const turn = formationTurn(state)
        if (!turn) return
        if ('system' in turn) {
            if (turn.system === 'FormNational') context.addSystemAction(FormNational, {})
            else {
                const decision = nationalDecision(state)
                assertExists(decision, 'A president is deciding')
                state.activePlayerIds = [decision.playerId]
                context.addSystemAction(SettleNationalLoans, {
                    playerId: decision.playerId,
                    companyId: turn.companyId,
                    repay: false
                })
            }
            return
        }
        state.activePlayerIds = [turn.playerId]
    }
    onAction(_action: HydratedAction, context: MachineContext<HydratedState1856>): string {
        return context.gameState.nationalFormation ? NationalFormationState : BetweenCompaniesState
    }
}
