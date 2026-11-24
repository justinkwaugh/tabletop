import { trainsOwnedBy } from '@tabletop/18xx'
import {
    AmericanLocomotiveId,
    CarnegieSteelId,
    BankruptRailroadId,
    CompanyTownId,
    DoubleHeadingId,
    ExpressFreightId,
    FoxBridgeId,
    GreatNorthernId,
    HendricksonIronId,
    ImportExportHubId,
    KeystoneBridgeId,
    LehighCoalId,
    MetropolisCandidates,
    NobelsBlastingId,
    PennsyBoneyardId,
    PettiboneMullikenId,
    ReeceOilId,
    RegionalHeadquartersId,
    RuralJunctionId,
    SubsidyPrivateIds,
    SuemWynnId,
    TrackEngineersId,
    BoomtownId,
    UnionSwitchId,
    WesternLandGrantId,
    isMetropolis
} from '../../18usa/src/index.js'
import { EighteenUSATrainDepot } from '../../18usa/src/trains.js'
import { edit, type Table } from '../../18usa/test/kit.js'
import { companyCash, givePrivate, operatingCompany, setCash } from '../../18usa/test/positions.js'
import { playUntil, runningWithPullman } from './seededGames.js'

const firstLay = (phaseId: string, companyId: string) => (game: Table) =>
    game.state.machineState === 'LayingTrack' &&
    game.state.phaseId === phaseId &&
    game.state.trackStep?.companyId === companyId &&
    !game.state.trackStep.lays.length

function holding(game: Table, companyId: string, privateIds: readonly string[], cash: number) {
    edit(game, (state) => {
        for (const privateId of privateIds) givePrivate(state, privateId, companyId)
        companyCash(state, companyId, cash)
    })
    return game
}

const rustsOnNextPurchase = (game: Table) => {
    const companyId = game.state.trainPurchaseStep?.companyId
    const next = EighteenUSATrainDepot.nextDefinitionId(game.state.trainInventory)
    return (
        game.state.machineState === 'BuyingTrains' &&
        !!companyId &&
        trainsOwnedBy(game.state, { kind: 'company', companyId }).some(
            (train) => EighteenUSATrainDepot.trainDefinition(train.definitionId).rustsOn === next
        )
    )
}

const northWesternLay = () => playUntil(4, 4, firstLay('5', 'NW'))

/**
 * Phase 5, Norfolk and Western's first lay, with the resource and bridge privates and the
 * Resource subsidy.
 */
export function resourcePrivates(): Table {
    return holding(
        northWesternLay(),
        'NW',
        [
            LehighCoalId,
            ReeceOilId,
            HendricksonIronId,
            FoxBridgeId,
            KeystoneBridgeId,
            NobelsBlastingId,
            SubsidyPrivateIds.resource
        ],
        400
    )
}

/** The same lay with the privates that add or change tile actions. */
export function trackPrivates(): Table {
    return holding(
        northWesternLay(),
        'NW',
        [TrackEngineersId, BoomtownId, PettiboneMullikenId, GreatNorthernId],
        400
    )
}

/** The same lay with the privates that lay tiles of their own. */
export function tilePrivates(): Table {
    return holding(
        northWesternLay(),
        'NW',
        [RegionalHeadquartersId, RuralJunctionId, CompanyTownId],
        400
    )
}

/** Phase 4, New York Central's first lay, with the privates that place stations and markers. */
export function stationPrivates(): Table {
    return holding(
        playUntil(4, 3, firstLay('4', 'NYC')),
        'NYC',
        [ImportExportHubId, ExpressFreightId, SuemWynnId, SubsidyPrivateIds.freeStation],
        400
    )
}

/** The Pullman run, its company holding Union Switch & Signal and Double Heading. */
export function runPrivates(): Table {
    const game = playUntil(4, 1, runningWithPullman)
    const companyId = game.state.routeStep?.companyId
    if (!companyId) throw new Error('The run step names its company')
    return holding(game, companyId, [UnionSwitchId, DoubleHeadingId], 400)
}

/** A company buying trains whose next depot train rusts one of its own. */
export function trainPrivates(): Table {
    const game = playUntil(4, 1, rustsOnNextPurchase)
    const companyId = game.state.trainPurchaseStep?.companyId
    if (!companyId) throw new Error('The purchase step names its company')
    return holding(
        game,
        companyId,
        [AmericanLocomotiveId, PennsyBoneyardId, WesternLandGrantId],
        600
    )
}

/**
 * A stock turn in phase 2 whose player holds Carnegie Steel and Bankrupt Railroad, Carnegie
 * holding every metropolis candidate still empty.
 */
export function companyStartPrivates(): Table {
    const game = playUntil(
        4,
        1,
        (table) =>
            table.state.machineState === 'StockRound' &&
            table.state.phaseId === '2' &&
            !table.state.companyAuction &&
            table.state.companies.some(
                (company) => company.kind !== 'private' && company.started
            ) &&
            table.valid(table.player).includes('AuctionCompany')
    )
    const playerId = game.player
    edit(game, (state) => {
        for (const privateId of [CarnegieSteelId, BankruptRailroadId])
            givePrivate(state, privateId, { kind: 'player', playerId })
        state.carnegieIds = MetropolisCandidates.map((city) => city.locationId).filter(
            (locationId) =>
                !isMetropolis(state, locationId) && !state.tileInventory.placements[locationId]
        )
    })
    setCash(game, playerId, 400)
    return game
}

/** ATSF's first operating round at G7, an empty city, with the Boomtown subsidy. */
export function boomtownSubsidy(): Table {
    return operatingCompany('G7', (state) => givePrivate(state, SubsidyPrivateIds.boomtown, 'ATSF'))
}
