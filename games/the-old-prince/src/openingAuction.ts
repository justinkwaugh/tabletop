import { assert, shuffle, type PlayerState, type Prng } from '@tabletop/common'
import {
    awardCertificates,
    cashOwnedBy,
    getCompany,
    privateIncomePayments,
    settleCashPayments,
    createOrdinaryShareCertificates,
    placeStockMarker,
    type OfferPileAuctionRules,
    type OfferAuctionState,
    type CompanyState,
    type MapStateData,
    type TrainState,
    type StockMarket
} from '@tabletop/18xx'
import { TheOldPrinceCompanies, theOldPrinceRole } from './companies.js'
import { TheOldPrincePrivates } from './privates.js'
import { peirPresident } from './finance.js'
import { TheOldPrinceMap } from './map.js'
import { TheOldPrinceTileSet } from './tiles.js'
import { TheOldPrinceTrainDepot } from './trains.js'
import { createTheOldPrinceStockMarket } from './stockMarket.js'
export const TheOldPrinceAuctionRules: OfferPileAuctionRules = {
    increment: 5,
    lots(state) {
        return [
            ...TheOldPrincePrivates.filter(
                (lot) => lot.id !== 'KM' && state.companies.some((c) => c.id === lot.id)
            ),
            ...state.certificates
                .filter((c) => c.kind === 'share')
                .filter((c) => c.companyId === 'PEIR')
                .map((c) => ({
                    id: c.id,
                    name: `PEIR ${c.number} · ${TheOldPrinceCompanies.find((company) => company.number === c.number)!.name}`,
                    price: 80
                }))
        ]
    },
    award(state, award) {
        if (award.lotId.startsWith('PEIR:')) {
            awardCertificates(state, award, [award.lotId])
            const president = peirPresident(state)
            if (president)
                getCompany(state, 'PEIR').president = { kind: 'player', playerId: president }
            return
        }
        const mainline = theOldPrinceRole(state, 'mainline'),
            shortline = theOldPrinceRole(state, 'shortline')
        const extras: Record<string, string[]> = {
            MLC: [`${mainline}:president`],
            SLC: [`${shortline}:president`],
            RA: [`${mainline}:share:1`],
            RF: [`${mainline}:share:2`]
        }
        awardCertificates(state, award, [`${award.lotId}:charter`, ...(extras[award.lotId] ?? [])])
        if (award.lotId === 'MLC' || award.lotId === 'SLC')
            getCompany(state, award.lotId === 'MLC' ? mainline : shortline).president = {
                kind: 'player',
                playerId: award.playerId
            }
    },
    payIncome(state) {
        settleCashPayments(
            state,
            privateIncomePayments(state).filter((payment) => payment.to.kind === 'player')
        )
    },
    firstStockOrder(state) {
        const order = [...state.turnManager.turnOrder]
        const index = order.indexOf(state.offerAuction!.auctioneerId)
        const rotated = [...order.slice(index), ...order.slice(0, index)]
        return rotated.sort((a, b) => {
            const first = cashOwnedBy(state, { kind: 'player', playerId: a }),
                second = cashOwnedBy(state, { kind: 'player', playerId: b })
            assert(
                typeof first === 'number' && typeof second === 'number',
                'Players require finite cash'
            )
            return first - second
        })
    }
}
export function createTheOldPrinceOpening(
    players: readonly PlayerState[],
    prng: Prng
): CompanyState &
    MapStateData &
    TrainState &
    Pick<OfferAuctionState, 'offerAuction'> & { stockMarket: StockMarket } {
    assert(players.length === 3 || players.length === 4, 'TOP supports three or four players')
    const shuffled = [...TheOldPrinceCompanies]
    shuffle(shuffled, prng.random)
    const [mainline, shortline, ...remaining] = shuffled
    const privates = TheOldPrincePrivates.filter((p) => p.id !== 'IB' || players.length === 4)
    const market = { owner: { kind: 'bank' } as const, poolId: 'market' }
    const reserved = { owner: { kind: 'bank' } as const, poolId: 'reserved' }
    const auction = { owner: { kind: 'bank' } as const, poolId: 'auction' }
    const union = { owner: { kind: 'company' as const, companyId: 'UB' } }
    const lotIds = [
        ...privates.filter((p) => p.id !== 'KM').map((p) => p.id),
        ...remaining.map((c) => `PEIR:share:${c.number}`)
    ]
    shuffle(lotIds, prng.random)
    const auctioneerId = players[prng.randInt(players.length)].playerId
    const stockMarket = createTheOldPrinceStockMarket('opening')
    placeStockMarker(stockMarket, mainline.companyId, '1:1')
    placeStockMarker(stockMarket, shortline.companyId, '2:1')
    const stations: MapStateData['stations'] = []
    const stationReservations: MapStateData['stationReservations'] = []
    for (const company of TheOldPrinceCompanies) {
        const location = TheOldPrinceMap.definition.locations.find((l) =>
            l.reservations?.some((r) => r.companyId === company.companyId)
        )!
        const reservation = location.reservations!.find((r) => r.companyId === company.companyId)!
        const position = { locationId: location.id, nodeId: reservation.nodeId, slot: 0 }
        const main = company.companyId === mainline.companyId
        stations.push(
            main
                ? {
                      id: `${company.companyId}:home`,
                      companyId: company.companyId,
                      status: 'placed',
                      position
                  }
                : {
                      id: `${company.companyId}:home`,
                      companyId: company.companyId,
                      status: 'available'
                  }
        )
        for (let index = 1; index < 4; index++)
            stations.push({
                id: `${company.companyId}:station:${index}`,
                companyId: company.companyId,
                status: 'available'
            })
        if (!main) stationReservations.push({ ...reservation, locationId: location.id })
        if (remaining.some((c) => c.companyId === company.companyId))
            stations.push({
                id: `PEIR:${company.companyId}`,
                companyId: 'PEIR',
                status: 'placed',
                position
            })
    }
    return {
        bank: { name: 'Bank' },
        companies: [
            ...TheOldPrinceCompanies.map((c) => ({
                id: c.companyId,
                name: c.name,
                kind: 'major',
                shareCount: 10,
                started: c === mainline || c === shortline,
                floated: c === mainline,
                funded: c === mainline,
                operated: false,
                ...(c === mainline
                    ? { role: 'mainline', parPrice: 92 }
                    : c === shortline
                      ? { role: 'shortline', parPrice: 86 }
                      : {})
            })),
            { id: 'PEIR', name: 'Prince Edward Island Railway', kind: 'major' },
            ...privates.map((p) => ({
                id: p.id,
                name: p.name,
                kind: 'private',
                privateRevenue: p.revenue
            }))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: 'unlimited' },
            ...players.map((p) => ({
                owner: { kind: 'player' as const, playerId: p.playerId },
                amount: players.length === 3 ? 580 : 460
            })),
            ...TheOldPrinceCompanies.map((c) => ({
                owner: { kind: 'company' as const, companyId: c.companyId },
                amount: c === mainline ? 920 : 0
            })),
            { owner: { kind: 'company', companyId: 'PEIR' }, amount: 200 },
            { owner: { kind: 'company', companyId: 'UB' }, amount: 0 }
        ],
        certificatePools: [
            { id: 'market', name: 'Market', owner: { kind: 'bank' } },
            { id: 'reserved', name: 'Reserved exchanges', owner: { kind: 'bank' } },
            { id: 'auction', name: 'Auction', owner: { kind: 'bank' } },
            ...TheOldPrinceCompanies.map((c) => ({
                id: `treasury:${c.companyId}`,
                name: 'Treasury shares',
                owner: { kind: 'company' as const, companyId: c.companyId }
            }))
        ],
        certificates: [
            ...TheOldPrinceCompanies.flatMap((c) =>
                createOrdinaryShareCertificates(
                    c.companyId,
                    Array.from({ length: 8 }, (_, index) =>
                        c === mainline
                            ? index < 2
                                ? auction
                                : index === 7
                                  ? union
                                  : market
                            : c === shortline
                              ? index >= 5
                                  ? reserved
                                  : market
                              : c === remaining[0] && index === 7
                                ? union
                                : market
                    ),
                    c === mainline || c === shortline ? auction : market
                )
            ),
            ...remaining.map((c) => ({
                id: `PEIR:share:${c.number}`,
                companyId: 'PEIR',
                kind: 'share' as const,
                shares: 1,
                president: false,
                number: c.number,
                certificateLimitCount: 1,
                retired: false as const,
                owner: { kind: 'bank' as const },
                poolId: 'auction'
            })),
            ...privates.map((p) => ({
                id: `${p.id}:charter`,
                companyId: p.id,
                kind: 'private' as const,
                certificateLimitCount: 1,
                retired: false as const,
                owner:
                    p.id === 'KM'
                        ? { kind: 'company' as const, companyId: 'PEIR' }
                        : { kind: 'bank' as const },
                ...(p.id === 'KM' ? {} : { poolId: 'auction' })
            }))
        ],
        tranches: [
            {
                id: 'initial',
                name: 'Mainline and Shortline',
                capacity: 2,
                companyIds: [mainline.companyId, shortline.companyId]
            },
            { id: '1', name: 'Tranche 1', capacity: 1, companyIds: [] },
            { id: '2', name: 'Tranche 2', capacity: 2, companyIds: [] },
            { id: '3', name: 'Tranche 3', capacity: 3, companyIds: [] }
        ],
        ownershipLimitExemptions: [],
        stations,
        stationReservations,
        stockMarket,
        tileInventory: TheOldPrinceTileSet.createInventory(),
        trainInventory: TheOldPrinceTrainDepot.createInventory(),
        phaseId: '2H',
        offerAuction: {
            piles: players.map((p, index) => ({
                playerId: p.playerId,
                lotIds: lotIds.slice(
                    (index * lotIds.length) / players.length,
                    ((index + 1) * lotIds.length) / players.length
                )
            })),
            auctioneerId,
            awards: [],
            incomePayments: 0,
            stalled: false,
            completed: false
        }
    }
}
