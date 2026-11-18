import { ActionSource, assert, assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    applyStationPlacement,
    companyStationCenters,
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    homeStationId,
    nextOperatingCompany,
    presidentCertificate,
    reachRoutes,
    settleCashPayments,
    systemAction,
    titleAction,
    trainsOwnedBy
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { ForeignInvestors1880 } from './companies.js'
import { Map1880 } from './map.js'
import type { HydratedState1880, InvestorMerger1880, StateHandler1880 } from './state.js'
import { ChoosingInvestorsState } from './state.js'
import { MajorIds1880, isInvestor, reserveInvestorShare } from './stock.js'
import { TileSet1880 } from './tiles.js'
import { investorsActive } from './track.js'
import { TrainDepot1880 } from './trains.js'
import { trainOnSale } from './trainRules.js'

const Id = Type.String({ minLength: 1 })

/** The premium an investor's owner receives as it merges (§VII). */
export const ConnectionPremium = 50
/** What the investor's owner may take of its treasury instead of its company: a fifth (§VII). */
const OwnerShareOfTreasury = 5

/** The investor's owner's fifth of a treasury, at a merger or the game's end (§VII). */
export function ownerShareOfTreasury(treasury: number): number {
    return Math.floor(treasury / OwnerShareOfTreasury)
}

const investorHome = (investorId: string) => {
    const investor = ForeignInvestors1880.find((entry) => entry.id === investorId)
    assertExists(investor, `Unknown foreign investor ${investorId}`)
    return investor.home
}

/** The foreign investor a player chose, if they have one still in play. */
export function playerInvestor(state: HydratedState1880, playerId: string): string | undefined {
    return ForeignInvestors1880.map((investor) => investor.id).find((id) => {
        const certificate = presidentCertificate(state, id)
        return (
            !getCompany(state, id).closed &&
            certificate?.owner.kind === 'player' &&
            certificate.owner.playerId === playerId
        )
    })
}

/** The major whose reserved share sits on the investor's charter (§VII). */
export function associatedCompany(
    state: HydratedState1880,
    investorId: string
): string | undefined {
    return state.certificates.find(
        (certificate) =>
            certificate.owner.kind === 'company' &&
            certificate.owner.companyId === investorId &&
            certificate.kind === 'share'
    )?.companyId
}

// Choosing investors (§V, §VII).

/** Whether the player holds a foreign investor. */
function holdsInvestor(state: HydratedState1880, playerId: string): boolean {
    return ForeignInvestors1880.some(
        (investor) => controllingOwner(state, investor.id)?.playerId === playerId
    )
}

/**
 * Whether the investors have been chosen: each is held by a player or out of the game, as it
 * stays once merged (§V, §VII).
 */
export function investorChoiceDone(state: HydratedState1880): boolean {
    return ForeignInvestors1880.every(
        (investor) =>
            getCompany(state, investor.id).closed ||
            presidentCertificate(state, investor.id)?.owner.kind === 'player'
    )
}

/** The player choosing a foreign investor now: the one whose turn it is (§V). */
export function investorChooser(state: HydratedState1880): string | undefined {
    return state.machineState === ChoosingInvestorsState && !investorChoiceDone(state)
        ? state.turnManager.currentTurn()?.playerId
        : undefined
}

/** The investors the game is played with, in number order: all but any left out at setup. */
export function investorsInGame(state: Pick<HydratedState1880, 'removedInvestorIds'>): string[] {
    return ForeignInvestors1880.map((investor) => investor.id).filter(
        (id) => !state.removedInvestorIds?.includes(id)
    )
}

/** The investors still free to choose, in number order. */
export function unchosenInvestors(state: HydratedState1880): string[] {
    return ForeignInvestors1880.map((investor) => investor.id).filter(
        (id) =>
            !getCompany(state, id).closed && presidentCertificate(state, id)?.owner.kind === 'bank'
    )
}

function removeUnchosenInvestors(state: HydratedState1880): void {
    const removedIds = unchosenInvestors(state)
    for (const id of removedIds) getCompany(state, id).closed = true
    state.stationReservations = state.stationReservations.filter(
        (reservation) => !removedIds.includes(reservation.companyId)
    )
}

const ChooseInvestorAction = titleAction('ChooseInvestor', { investorId: Id })
export const ChooseInvestor = ChooseInvestorAction.schema
export type ChooseInvestor = Type.Static<typeof ChooseInvestor>
export const isChooseInvestor = ChooseInvestorAction.is

/**
 * A player takes a foreign investor, free; it stands in its home at once. The P6 owner, already
 * the BCR's director, places a BCR share on it. The investors left over leave the game (§VII).
 */
export class HydratedChooseInvestor extends ChooseInvestorAction.Base {
    declare playerId: string
    declare investorId: string
    isValid(state: HydratedState1880): boolean {
        return (
            this.source === ActionSource.User &&
            investorChooser(state) === this.playerId &&
            unchosenInvestors(state).includes(this.investorId)
        )
    }
    apply(state: HydratedState1880): void {
        assert(this.isValid(state), 'This investor cannot be chosen')
        const certificate = presidentCertificate(state, this.investorId)
        assertExists(certificate, 'An investor is held by its certificate')
        certificate.owner = { kind: 'player', playerId: this.playerId }
        delete certificate.poolId
        const investor = getCompany(state, this.investorId)
        investor.started = true
        investor.floated = true
        investor.president = { kind: 'player', playerId: this.playerId }
        applyStationPlacement(state, {
            companyId: this.investorId,
            stationId: homeStationId(this.investorId),
            position: { locationId: investorHome(this.investorId), nodeId: 'city', slot: 0 },
            cost: 0
        })
        for (const companyId of MajorIds1880)
            if (controllingOwner(state, companyId)?.playerId === this.playerId)
                reserveInvestorShare(state, companyId)
        // Each player chooses in a turn of their own, in seat order; then the share round's
        // first turn begins (§V).
        state.turnManager.endTurn(state.actionCount)
        const next = state.turnManager.turnOrder.find((playerId) => !holdsInvestor(state, playerId))
        if (!next) removeUnchosenInvestors(state)
        const playerId = next ?? state.turnManager.turnOrder[0]
        state.turnManager.startTurn(playerId, state.actionCount + 1)
        state.activePlayerIds = [playerId]
    }
}

/**
 * The players choose their investors in turn, the first in the share round's opening turn;
 * then the first share round goes on (§V).
 */
export const ChoosingInvestorsHandler: StateHandler1880 = {
    isValidAction: (action, context) =>
        action instanceof HydratedChooseInvestor && action.isValid(context.gameState),
    validActionsForPlayer: (playerId, context) =>
        investorChooser(context.gameState) === playerId ? [ChooseInvestorAction.type] : [],
    enter(context) {
        const chooser = investorChooser(context.gameState)
        if (chooser) context.gameState.activePlayerIds = [chooser]
    },
    onAction: (_action, context) =>
        investorChoiceDone(context.gameState) ? 'StockRound' : ChoosingInvestorsState
}

/** After the private auction, the investors are chosen before the share round (§V). */
export function choosesInvestors(handler: StateHandler1880): StateHandler1880 {
    return {
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        enter: (context) => handler.enter(context),
        onAction(action, context) {
            const next = handler.onAction(action, context)
            return next === 'StockRound' && !investorChoiceDone(context.gameState)
                ? ChoosingInvestorsState
                : next
        }
    }
}

// Leasing (§VII).

/** The investor operating now, while investors still operate, with no train leased yet. */
function leaseDue(state: HydratedState1880): { companyId: string } | undefined {
    const companyId = nextOperatingCompany(state)
    if (!companyId || !isInvestor(companyId) || !investorsActive(state)) return undefined
    return trainsOwnedBy(state, { kind: 'company', companyId }).length ? undefined : { companyId }
}

const LeaseTrainAction = systemAction('LeaseTrain', {
    companyId: Id,
    metadata: Type.Optional(Type.Object({ trainId: Id }, { additionalProperties: false }))
})
export const LeaseTrain = LeaseTrainAction.schema
export const isLeaseTrain = LeaseTrainAction.is
/** A foreign investor leases the train on sale for its run; it stays the bank's (§VII). */
export class HydratedLeaseTrain extends LeaseTrainAction.Base {
    declare companyId: string
    declare metadata?: { trainId: string }
    apply(state: HydratedState1880): void {
        assert(leaseDue(state)?.companyId === this.companyId, 'No lease is due')
        const definitionId = trainOnSale(state)
        const train = TrainDepot1880.nextTrain(state.trainInventory, definitionId)
        assertExists(train, 'The bank leases the train on sale')
        TrainDepot1880.purchase(state.trainInventory, train.id, definitionId, {
            kind: 'company',
            companyId: this.companyId
        })
        this.metadata = { trainId: train.id }
    }
}

function returnDue(state: HydratedState1880): { companyId: string } | undefined {
    const companyId = nextOperatingCompany(state)
    if (!companyId || !isInvestor(companyId)) return undefined
    return trainsOwnedBy(state, { kind: 'company', companyId }).length ? { companyId } : undefined
}

const ReturnLeasedTrainAction = systemAction('ReturnLeasedTrain', { companyId: Id })
export const ReturnLeasedTrain = ReturnLeasedTrainAction.schema
export const isReturnLeasedTrain = ReturnLeasedTrainAction.is
/** The leased train goes back to the bank once the investor has run it. */
export class HydratedReturnLeasedTrain extends ReturnLeasedTrainAction.Base {
    declare companyId: string
    apply(state: HydratedState1880): void {
        assert(returnDue(state)?.companyId === this.companyId, 'No leased train to return')
        for (const train of trainsOwnedBy(state, { kind: 'company', companyId: this.companyId }))
            TrainDepot1880.restock(state.trainInventory, train.id)
    }
}

export const investorLeases = { leaseDue, returnDue }

// Merging (§VII).

/**
 * Whether a train could run, never reversing, from the investor's home to a station of its
 * company, other companies' stations no obstacle (§VII; the designer's ruling).
 */
export function joinedNetworks(
    state: HydratedState1880,
    investorId: string,
    companyId: string
): boolean {
    const mapState = new RailwayMapState(Map1880, TileSet1880, state.tileInventory)
    const targets = companyStationCenters(state, companyId)
    if (!targets.length) return false
    const home = companyStationCenters(state, investorId)
    let joined = false
    reachRoutes(
        Map1880,
        (locationId) => mapState.tile(locationId).face,
        home,
        () => false,
        {
            reached(locationId, endpoint) {
                if (
                    endpoint.kind === 'node' &&
                    targets.some(
                        (center) =>
                            center.locationId === locationId && center.nodeId === endpoint.nodeId
                    )
                )
                    joined = true
            }
        }
    )
    return joined
}

/** The investor whose turn just ended, if its network now joins its company's. */
function mergerDue(state: HydratedState1880): { investorId: string } | undefined {
    if (state.investorMerger) return undefined
    const set = state.operatingSet
    const investorId = set?.completedCompanyIds.at(-1)
    if (!investorId || !isInvestor(investorId) || getCompany(state, investorId).closed)
        return undefined
    const companyId = associatedCompany(state, investorId)
    return companyId && joinedNetworks(state, investorId, companyId) ? { investorId } : undefined
}

const JoinInvestorAction = systemAction('JoinInvestor', {
    investorId: Id,
    metadata: Type.Optional(
        Type.Object({ companyId: Id, playerId: Id }, { additionalProperties: false })
    )
})
export const isJoinInvestor = JoinInvestorAction.is
/**
 * The investor's network joins its company's: its owner receives the reserved share and a ¥50
 * premium, then chooses where its treasury goes (§VII).
 */
export class HydratedJoinInvestor extends JoinInvestorAction.Base {
    declare investorId: string
    declare metadata?: { companyId: string; playerId: string }
    apply(state: HydratedState1880): void {
        assert(mergerDue(state)?.investorId === this.investorId, 'No merger is due')
        const companyId = associatedCompany(state, this.investorId)
        const owner = controllingOwner(state, this.investorId)
        assertExists(companyId, 'A merging investor has its company')
        assertExists(owner, 'A merging investor has its owner')
        const share = state.certificates.find(
            (certificate) =>
                certificate.owner.kind === 'company' &&
                certificate.owner.companyId === this.investorId
        )
        assertExists(share, 'A merging investor holds its share')
        share.owner = { kind: 'player', playerId: owner.playerId }
        settleCashPayments(state, [
            {
                from: { kind: 'bank' },
                to: { kind: 'player', playerId: owner.playerId },
                amount: ConnectionPremium
            }
        ])
        state.investorMerger = { investorId: this.investorId, companyId }
        state.activePlayerIds = [owner.playerId]
        this.metadata = { companyId, playerId: owner.playerId }
    }
}

/** Whether the company may put its cheapest station in the investor's placed home (§VII). */
export function mergerReplaces(state: HydratedState1880, merger: InvestorMerger1880): boolean {
    const home = state.stations.find((station) => station.id === homeStationId(merger.investorId))
    return home?.status === 'placed' && !!replacementStation(state, merger.companyId)
}

/** Whether the investor's owner directs its company, and so makes the station choice too. */
export function ownerDirectsMerger(state: HydratedState1880, merger: InvestorMerger1880): boolean {
    return (
        controllingOwner(state, merger.investorId)?.playerId ===
        controllingOwner(state, merger.companyId)?.playerId
    )
}

/**
 * The company's station replaces the investor's, or not; the investor's station leaves the map
 * either way, and the investor leaves the game (§VII). Returns the replacing station.
 */
function completeMerger(
    state: HydratedState1880,
    merger: InvestorMerger1880,
    replaceStation: boolean
): string | undefined {
    const { investorId, companyId } = merger
    const home = state.stations.find((station) => station.id === homeStationId(investorId))
    const stationId = replaceStation ? replacementStation(state, companyId) : undefined
    state.stations = state.stations.flatMap((station) => {
        if (station.id === home?.id) return []
        if (station.id === stationId && home?.status === 'placed')
            return [
                {
                    id: station.id,
                    companyId,
                    status: 'placed' as const,
                    position: { ...home.position }
                }
            ]
        return [station]
    })
    const certificate = presidentCertificate(state, investorId)
    if (certificate) certificate.owner = { kind: 'bank' }
    getCompany(state, investorId).closed = true
    delete state.investorMerger
    return stationId
}

const MergeInvestorAction = titleAction('MergeInvestor', {
    treasuryTo: Type.Union([Type.Literal('company'), Type.Literal('owner')]),
    replaceStation: Type.Boolean(),
    metadata: Type.Optional(
        Type.Object(
            {
                amount: Type.Integer({ minimum: 0 }),
                stationId: Type.Optional(Id),
                /** The company's director, left to choose the station (§VII). */
                stationChooser: Type.Optional(Id)
            },
            { additionalProperties: false }
        )
    )
})
export const MergeInvestor = MergeInvestorAction.schema
export type MergeInvestor = Type.Static<typeof MergeInvestor>
export const isMergeInvestor = MergeInvestorAction.is

/** The cheapest station still on the company's charter, which may take the investor's place. */
export function replacementStation(
    state: HydratedState1880,
    companyId: string
): string | undefined {
    return state.stations.find(
        (station) => station.companyId === companyId && station.status === 'available'
    )?.id
}

/**
 * Its owner sends the investor's treasury to the company, or takes a fifth of it, the rest
 * going to the bank. An owner directing the company also chooses whether its cheapest station
 * replaces the investor's, free, and the investor leaves the game; otherwise the company's
 * director then chooses (§VII).
 */
export class HydratedMergeInvestor extends MergeInvestorAction.Base {
    declare playerId: string
    declare treasuryTo: MergeInvestor['treasuryTo']
    declare replaceStation: boolean
    declare metadata?: MergeInvestor['metadata']
    isValid(state: HydratedState1880): boolean {
        const merger = state.investorMerger
        return (
            this.source === ActionSource.User &&
            !!merger &&
            !merger.stationChooser &&
            controllingOwner(state, merger.investorId)?.playerId === this.playerId &&
            (!this.replaceStation ||
                (ownerDirectsMerger(state, merger) && mergerReplaces(state, merger)))
        )
    }
    apply(state: HydratedState1880): void {
        assert(this.isValid(state), 'This merger choice is not available')
        const merger = state.investorMerger
        assertExists(merger, 'A merger is pending')
        const { investorId, companyId } = merger
        const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId: investorId })
        const amount = this.treasuryTo === 'company' ? treasury : ownerShareOfTreasury(treasury)
        const owner = { kind: 'player' as const, playerId: this.playerId }
        settleCashPayments(state, [
            ...(amount
                ? [
                      {
                          from: { kind: 'company' as const, companyId: investorId },
                          to:
                              this.treasuryTo === 'company'
                                  ? { kind: 'company' as const, companyId }
                                  : owner,
                          amount
                      }
                  ]
                : []),
            ...(treasury - amount
                ? [
                      {
                          from: { kind: 'company' as const, companyId: investorId },
                          to: { kind: 'bank' as const },
                          amount: treasury - amount
                      }
                  ]
                : [])
        ])
        if (!ownerDirectsMerger(state, merger) && mergerReplaces(state, merger)) {
            const director = controllingOwner(state, companyId)
            assertExists(director, 'A merging investor’s company has its director')
            merger.stationChooser = director.playerId
            state.activePlayerIds = [director.playerId]
            this.metadata = { amount, stationChooser: director.playerId }
            return
        }
        const stationId = completeMerger(state, merger, this.replaceStation)
        this.metadata = { amount, ...(stationId ? { stationId } : {}) }
    }
}

const ReplaceInvestorStationAction = titleAction('ReplaceInvestorStation', {
    replaceStation: Type.Boolean(),
    metadata: Type.Optional(
        Type.Object(
            { investorId: Id, companyId: Id, stationId: Type.Optional(Id) },
            { additionalProperties: false }
        )
    )
})
export const ReplaceInvestorStation = ReplaceInvestorStationAction.schema
export const isReplaceInvestorStation = ReplaceInvestorStationAction.is

/**
 * The director of the investor's company, another player than its owner, chooses whether the
 * company's cheapest station replaces the investor's, free; the investor then leaves (§VII).
 */
export class HydratedReplaceInvestorStation extends ReplaceInvestorStationAction.Base {
    declare playerId: string
    declare replaceStation: boolean
    declare metadata?: { investorId: string; companyId: string; stationId?: string }
    isValid(state: HydratedState1880): boolean {
        const merger = state.investorMerger
        return (
            this.source === ActionSource.User &&
            !!merger &&
            merger.stationChooser === this.playerId &&
            (!this.replaceStation || mergerReplaces(state, merger))
        )
    }
    apply(state: HydratedState1880): void {
        assert(this.isValid(state), 'This station choice is not available')
        const merger = state.investorMerger
        assertExists(merger, 'A merger is pending')
        const { investorId, companyId } = merger
        const stationId = completeMerger(state, merger, this.replaceStation)
        this.metadata = { investorId, companyId, ...(stationId ? { stationId } : {}) }
    }
}

/**
 * Between companies, an investor whose turn just ended joins its company if their networks
 * meet; play waits for its owner's merger choices (§VII).
 */
export function mergesInvestors(handler: StateHandler1880): StateHandler1880 {
    return {
        isValidAction(action, context) {
            const state = context.gameState
            if (action instanceof HydratedJoinInvestor)
                return action.source === ActionSource.System && !!mergerDue(state)
            if (action instanceof HydratedMergeInvestor) return action.isValid(state)
            if (action instanceof HydratedReplaceInvestorStation) return action.isValid(state)
            if (state.investorMerger || mergerDue(state)) return false
            return handler.isValidAction(action, context)
        },
        validActionsForPlayer(playerId, context) {
            const state = context.gameState
            if (mergerDue(state)) return []
            const merger = state.investorMerger
            if (merger?.stationChooser)
                return merger.stationChooser === playerId ? [ReplaceInvestorStationAction.type] : []
            if (merger)
                return controllingOwner(state, merger.investorId)?.playerId === playerId
                    ? [MergeInvestorAction.type]
                    : []
            return handler.validActionsForPlayer(playerId, context)
        },
        enter(context) {
            const due = mergerDue(context.gameState)
            if (due) context.addSystemAction(JoinInvestorAction.schema, due)
            else if (!context.gameState.investorMerger) handler.enter(context)
        },
        onAction(action, context) {
            if (
                action instanceof HydratedJoinInvestor ||
                action instanceof HydratedMergeInvestor ||
                action instanceof HydratedReplaceInvestorStation
            )
                return context.gameState.machineState
            return handler.onAction(action, context)
        }
    }
}

export const InvestorActions1880 = [
    ChooseInvestorAction.define((action) => new HydratedChooseInvestor(action)),
    LeaseTrainAction.define((action) => new HydratedLeaseTrain(action)),
    ReturnLeasedTrainAction.define((action) => new HydratedReturnLeasedTrain(action)),
    JoinInvestorAction.define((action) => new HydratedJoinInvestor(action)),
    MergeInvestorAction.define((action) => new HydratedMergeInvestor(action)),
    ReplaceInvestorStationAction.define((action) => new HydratedReplaceInvestorStation(action))
]
