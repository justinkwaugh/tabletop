import type { GameDefinition, PlayerState } from '@tabletop/common'
import { assert } from '@tabletop/common'
import {
    createCompanyStations,
    createOrdinaryShareCertificates,
    homeStationId,
    type HydratedEighteenXXState,
    type InitialPosition,
    type Owner,
    type President,
    type StockMarket
} from '@tabletop/18xx'
import {
    prepareFinalOperatingTurn,
    withScenarios,
    type PreparedPosition
} from '@tabletop/18xx/scenarios'
import { Definition, EighteenNinetyFourTitleRules } from '../definition/gameDefinition.js'
import { EighteenNinetyFourMajors } from '../majors.js'
import { EighteenNinetyFourMap } from '../map.js'
import { EighteenNinetyFourMarket } from '../stockMarket.js'
import { EighteenNinetyFourStationCounts } from '../stationRules.js'
import { EighteenNinetyFourTileSet } from '../tiles.js'
import { EighteenNinetyFourTrainDepot } from '../trains.js'
import type { EighteenNinetyFourState, HydratedEighteenNinetyFourState } from '../state.js'

const bank: Owner = { kind: 'bank' }
const offering = { owner: bank, poolId: 'initial-offering' }

// Mechelen and Bruxelles carry the Belge's first track; Versailles joins Paris.
const BuiltTrack = [
    { locationId: 'E16', definitionId: '18xx:57', rotation: 0 },
    { locationId: 'F15', definitionId: '1894:X2', rotation: 3 },
    { locationId: 'G6', definitionId: '1894:X1', rotation: 0 }
] as const

const OperatingPositions: readonly PreparedPosition[] = [
    'construction',
    'stations',
    'routes',
    'operations'
]

export function createEighteenNinetyFourScenarioMarket(position: PreparedPosition): StockMarket {
    const market: StockMarket = { stacks: [] }
    EighteenNinetyFourMarket.placeMarker(market, 'Belge', '3:5')
    EighteenNinetyFourMarket.placeMarker(market, 'PLM', '1:1')
    if (position === 'flotation') EighteenNinetyFourMarket.placeMarker(market, 'CFOR', '7:5')
    return market
}

/**
 * Belge and the PLM, the starting companies, have floated and operated; the other companies
 * wait in the IPO. Positions add track, trains and phases as each example needs.
 */
export function createEighteenNinetyFourScenario(
    players: readonly PlayerState[],
    position: PreparedPosition
): Omit<InitialPosition, 'stockMarket'> {
    assert(players.length === 3 || players.length === 4, '1894 examples use three or four players')
    const owners: President[] = players.map((player) => ({
        kind: 'player',
        playerId: player.playerId
    }))
    const [alex, blair, casey] = owners
    const dealt = (president: President) => [
        ...owners.filter((owner) => owner !== president).map((owner) => ({ owner })),
        { owner: president },
        ...Array.from({ length: 8 - owners.length }, () => offering)
    ]
    const started: Readonly<Record<string, { president: President; par: number }>> = {
        Belge: { president: alex, par: 100 },
        PLM: { president: blair, par: 95 }
    }
    const majors = Object.values(EighteenNinetyFourMajors)
    const flotation = position === 'flotation'
    const operating = OperatingPositions.includes(position)
    const state: Omit<InitialPosition, 'stockMarket'> = {
        bank: {},
        companies: [
            ...majors.map((major) => {
                const start = started[major.id]
                if (start)
                    return {
                        id: major.id,
                        kind: 'major',
                        parPrice: start.par,
                        started: true,
                        funded: true,
                        operated: true,
                        floated: true,
                        president: start.president
                    }
                if (flotation && major.id === 'CFOR')
                    return {
                        id: major.id,
                        kind: 'major',
                        parPrice: 67,
                        started: true,
                        funded: false,
                        operated: false,
                        floated: false,
                        president: alex
                    }
                return {
                    id: major.id,
                    kind: 'major',
                    started: false,
                    funded: false,
                    operated: false,
                    floated: false
                }
            }),
            ...['LRC', 'AR', 'SQG', 'LS', 'PLMMS', 'BMS'].map((id) => ({
                id,
                kind: 'private',
                ...(id.endsWith('MS') ? { closed: true } : {})
            }))
        ],
        certificatePools: [
            { id: 'initial-offering', owner: bank },
            { id: 'open-market', owner: bank }
        ],
        cash: [
            { owner: bank, amount: 'unlimited' },
            ...owners.map((owner) => ({ owner, amount: 300 })),
            ...majors.map((major) => ({
                owner: { kind: 'company' as const, companyId: major.id },
                amount: major.id === 'Belge' ? 600 : major.id === 'PLM' ? 500 : 0
            }))
        ],
        certificates: [
            ...majors.flatMap((major) => {
                const start = started[major.id]
                if (start)
                    return createOrdinaryShareCertificates(
                        major.id,
                        dealt(start.president),
                        start.president
                    )
                if (flotation && major.id === 'CFOR')
                    return createOrdinaryShareCertificates(
                        major.id,
                        [
                            { owner: alex },
                            { owner: alex },
                            ...Array.from({ length: 6 }, () => offering)
                        ],
                        alex
                    )
                return createOrdinaryShareCertificates(
                    major.id,
                    Array.from({ length: 8 }, () => offering),
                    offering
                )
            }),
            { id: 'LRC:charter', companyId: 'LRC', kind: 'private', owner: casey },
            {
                id: 'AR:charter',
                companyId: 'AR',
                kind: 'private',
                owner: { kind: 'company', companyId: 'Belge' }
            },
            { id: 'SQG:charter', companyId: 'SQG', kind: 'private', owner: alex },
            {
                id: 'LS:charter',
                companyId: 'LS',
                kind: 'private',
                owner: { kind: 'company', companyId: 'PLM' }
            }
        ],
        stations: majors.flatMap((major) =>
            createCompanyStations(major.id, EighteenNinetyFourStationCounts[major.id]).map(
                (station) =>
                    station.id === homeStationId('Belge')
                        ? {
                              ...station,
                              status: 'placed' as const,
                              position: { locationId: 'E16', nodeId: 'city', slot: 0 }
                          }
                        : station.id === homeStationId('PLM')
                          ? {
                                ...station,
                                status: 'placed' as const,
                                position: { locationId: 'G6', nodeId: 'city-0', slot: 0 }
                            }
                          : station
            )
        ),
        stationReservations: EighteenNinetyFourMap.stationReservations().filter(
            (reservation) => !['Belge', 'PLM'].includes(reservation.companyId)
        ),
        tileInventory: EighteenNinetyFourTileSet.createInventory(operating ? BuiltTrack : []),
        trainInventory: EighteenNinetyFourTrainDepot.createInventory(),
        phaseId: operating ? '3' : '2'
    }
    const buy = (companyId: string, definitionId: string) => {
        const train = EighteenNinetyFourTrainDepot.nextTrain(state.trainInventory, definitionId)
        assert(train, `The example needs a ${definitionId}-train`)
        EighteenNinetyFourTrainDepot.purchase(state.trainInventory, train.id, definitionId, {
            kind: 'company',
            companyId
        })
    }
    const setTreasury = (companyId: string, amount: number) => {
        const treasury = state.cash.find(
            (cash) => cash.owner.kind === 'company' && cash.owner.companyId === companyId
        )
        assert(treasury, 'The example names a treasury')
        treasury.amount = amount
    }
    const dropDepotBefore = (definitionId: string) => {
        const ranks = EighteenNinetyFourTrainDepot.definition.supply.map(
            (entry) => entry.definitionId
        )
        state.trainInventory.trains = state.trainInventory.trains.filter(
            (train) =>
                !(
                    train.status === 'depot' &&
                    ranks.indexOf(train.definitionId) < ranks.indexOf(definitionId)
                )
        )
    }
    if (operating) {
        buy('Belge', '2')
        buy('Belge', '3')
        buy('PLM', '2')
    }
    if (position === 'trains') buy('PLM', '2')
    if (position === 'phases' || position === 'diesel' || position === 'private-events') {
        state.phaseId = position === 'diesel' ? '7' : '4'
        const rosters: Record<string, string[]> =
            position === 'diesel'
                ? { Belge: ['6', '7'], PLM: ['5+1', '7'] }
                : { Belge: ['3', '4'], PLM: ['3', '4'] }
        for (const [companyId, ranks] of Object.entries(rosters))
            for (const rank of ranks) buy(companyId, rank)
        dropDepotBefore(position === 'diesel' ? 'D' : '5+1')
        setTreasury('Belge', 1400)
    }
    if (position === 'funding' || position === 'bankruptcy') {
        state.phaseId = '3'
        state.tileInventory = EighteenNinetyFourTileSet.createInventory(BuiltTrack)
        dropDepotBefore('4')
        setTreasury('Belge', position === 'funding' ? 70 : 0)
        for (const cash of state.cash)
            if (cash.owner.kind === 'player') cash.amount = position === 'funding' ? 40 : 0
        if (position === 'bankruptcy')
            for (const certificate of state.certificates)
                if (certificate.kind === 'share' && !certificate.president) {
                    certificate.owner = bank
                    certificate.poolId = 'initial-offering'
                }
    }
    return state
}

export function prepareEighteenNinetyFourEnding(state: HydratedEighteenXXState): void {
    state.gameEnding = { reason: 'Phase D', finalOperatingSet: 1 }
    prepareFinalOperatingTurn(state)
}

export const EighteenNinetyFourScenarios: GameDefinition<
    EighteenNinetyFourState,
    HydratedEighteenNinetyFourState
> = withScenarios(Definition, EighteenNinetyFourTitleRules, {
    createMarket: createEighteenNinetyFourScenarioMarket,
    createFinances: createEighteenNinetyFourScenario,
    prepareEnding: prepareEighteenNinetyFourEnding
})
