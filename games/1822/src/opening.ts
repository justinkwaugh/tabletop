import {
    beginOpening,
    createCompanyStations,
    startingCashByPlayerCount,
    treasuryPoolId,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type StartingCashSetup
} from '@tabletop/18xx'
import { assert, shuffle } from '@tabletop/common'
import {
    LnwrId,
    MajorIds1822,
    Majors1822,
    concessionId,
    createMajorCertificates1822,
    createMinorCertificates1822
} from './companies.js'
import { GameConfig1822 } from './definition/gameConfig.js'
import {
    charterCertificateId,
    dealLots1822,
    minorIdsInPlay1822,
    privateSet1822,
    refillBidBoxes1822
} from './lots.js'
import { Map1822 } from './map.js'
import { setupOf1822 } from './scenarios.js'
import { MarketPoolId1822 } from './names.js'
import { PhaseCreditPrivateIds, TaxHavenPrivateId } from './privates.js'
import { MaximumPlayers1822, MinimumPlayers1822 } from './setup.js'
import type { HydratedState1822, State1822 } from './state.js'
import { TileSet1822, TileSet1822Variants } from './tiles.js'
import { TrainDepot1822 } from './trains.js'

/** A major company begins with two station tokens it may place: its home and one more (§5.12.2). */
const MajorStationCount = 2
const MinorStationCount = 1

/** Private companies that hold money or a share on their own charter (Table 3: P15, P16, P20). */
const PrivatesHoldingCash: readonly string[] = [...PhaseCreditPrivateIds, TaxHavenPrivateId]

/** Each player's start money: Table 1's, or the scenario's where one is played (§6.2.1). */
export function startingCash1822(setup: StartingCashSetup): number {
    const { startingCash } = setupOf1822({ variants: GameConfig1822.variants(setup.config) })
    return startingCashByPlayerCount(startingCash)(setup)
}

export function createOpening1822({
    players,
    prng,
    config,
    startingPositions
}: OpeningSetup): Opening<typeof State1822, HydratedState1822> {
    assert(
        players.length >= MinimumPlayers1822 && players.length <= MaximumPlayers1822,
        '1822 supports three to seven players'
    )
    const variants = GameConfig1822.variants(config)
    const setup = setupOf1822({ variants })
    const privateIds = privateSet1822(variants).map((entry) => entry.id)
    const capital = startingCash1822({ playerCount: players.length, config })
    // The player number cards are dealt at random (§2.1.14).
    const order = players.map((entry) => entry.playerId)
    shuffle(order, prng.random)
    const playerOrder = startingPositions ? [...startingPositions.playerIds] : order
    const { stacks, removedPrivateIds, removedCompanyIds } = dealLots1822(prng, variants)
    const inPlay = (id: string) => !removedCompanyIds.includes(id)
    const majorIds = MajorIds1822.filter(inPlay)
    const minorIds = minorIdsInPlay1822(variants).filter(inPlay)
    const concessionIds = majorIds.map(concessionId)
    const charterIds = [
        ...privateIds.filter((id) => !removedPrivateIds.includes(id)),
        ...concessionIds
    ]
    const companyIds = [...majorIds, ...minorIds]
    const tileInventory = TileSet1822.createInventory(
        [],
        variants.scenario && TileSet1822Variants.includes(variants.scenario)
            ? variants.scenario
            : undefined
    )
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        phaseId: '1',
        companies: [
            ...majorIds.map((id) => ({ id, kind: 'major' })),
            ...minorIds.map((id) => ({ id, kind: 'minor' })),
            ...[...privateIds, ...concessionIds].map((id) => ({ id, kind: 'private' }))
        ].map((company) => {
            if (company.kind !== 'private')
                return {
                    ...company,
                    started: false,
                    floated: false,
                    funded: false,
                    operated: false
                }
            // A private company removed during setup is closed from the start (§2.1.7).
            return removedPrivateIds.includes(company.id) ? { ...company, closed: true } : company
        }),
        cash: [
            {
                owner: { kind: 'bank' },
                amount: setup.bank - players.length * capital
            },
            ...players.map((entry) => ({
                owner: { kind: 'player' as const, playerId: entry.playerId },
                amount: capital
            })),
            ...[...companyIds, ...PrivatesHoldingCash.filter((id) => charterIds.includes(id))].map(
                (companyId) => ({
                    owner: { kind: 'company' as const, companyId },
                    amount: 0
                })
            )
        ],
        certificatePools: [
            { id: MarketPoolId1822, owner: { kind: 'bank' } },
            ...companyIds.map((companyId) => ({
                id: treasuryPoolId(companyId),
                owner: { kind: 'company' as const, companyId }
            }))
        ],
        certificates: [
            ...majorIds.flatMap((companyId) => createMajorCertificates1822(companyId)),
            ...minorIds.flatMap((companyId) =>
                createMinorCertificates1822(companyId, { owner: { kind: 'bank' } })
            ),
            ...charterIds.map((companyId) => ({
                id: charterCertificateId(companyId),
                companyId,
                kind: 'private' as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: [
            ...majorIds.flatMap((companyId) => createCompanyStations(companyId, MajorStationCount)),
            ...minorIds.flatMap((companyId) => createCompanyStations(companyId, MinorStationCount))
        ],
        stationReservations: [
            ...Map1822.stationReservations().filter((reservation) =>
                companyIds.includes(reservation.companyId)
            ),
            // The LNWR's destination token starts in Manchester as a second home (§5.6.2).
            ...Majors1822.filter((major) => major.id === LnwrId && inPlay(major.id)).map(
                (major) => ({
                    companyId: major.id,
                    ...major.destination
                })
            )
        ],
        tileInventory,
        trainInventory: TrainDepot1822.createInventory(variants.scenario)
    }
    const titleState = {
        variants,
        ...(removedPrivateIds.length ? { removedPrivateIds } : {}),
        ...(removedCompanyIds.length ? { removedCompanyIds } : {}),
        ownershipLimitExemptions: [],
        bidBoxes: { stacks, boxes: [], bids: [] },
        playerLoans: [],
        debutCompanyIds: [],
        discountTokens: [],
        exchangeTokenUse: []
    }
    return {
        position,
        titleState,
        begin(state) {
            state.turnManager.turnOrder = [...playerOrder]
            refillBidBoxes1822(state)
            beginOpening(state, 'StockRound', playerOrder[0])
        }
    }
}
