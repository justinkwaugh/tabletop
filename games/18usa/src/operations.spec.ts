import { describe, expect, it } from 'vitest'
import {
    cashOwnedBy,
    companyLoans,
    loanRate,
    RailwayMapState,
    TileEdges,
    TrackConstruction
} from '@tabletop/18xx'
import { companyCash, operatingCompany, setPhase } from '../test/positions.js'
import {
    EighteenUSAEarningsRules,
    EighteenUSALoanRules,
    EighteenUSAMap,
    EighteenUSAMarket,
    EighteenUSATileSet,
    EighteenUSATrackRules
} from './index.js'

const KansasCity = 'E15'
const color = (definitionId: string) =>
    EighteenUSATileSet.definitions.find((tile) => tile.id === definitionId)?.face.color
const price = (game: ReturnType<typeof operatingCompany>) =>
    EighteenUSAMarket.companySpace(game.state.stockMarket, 'ATSF').price

describe('loans (§9, §12.9)', () => {
    it('moves the price two spaces for each loan taken', () => {
        const game = operatingCompany(KansasCity)
        expect(price(game)).toBe(50)
        game.act('TakeLoan', { companyId: 'ATSF' })
        expect(companyLoans(game.state, 'ATSF')).toBe(1)
        expect(price(game)).toBe(46)
        expect(cashOwnedBy(game.state, { kind: 'company', companyId: 'ATSF' })).toBe(200)
    })

    it('lends at most the company’s share count', () => {
        const game = operatingCompany(KansasCity)
        game.act('TakeLoan', { companyId: 'ATSF' })
        game.act('TakeLoan', { companyId: 'ATSF' })
        expect(game.valid(game.player)).not.toContain('TakeLoan')
    })

    it('uses the five-player mat: four loans at 5%, six on each other row', () => {
        const game = operatingCompany(KansasCity, () => {}, { players: 5 })
        const rateWith = (outstanding: number) => {
            const state = structuredClone(game.state)
            state.companies.find((company) => company.id === 'ATSF')!.loans = outstanding
            return loanRate(state, EighteenUSALoanRules)
        }
        expect([0, 4, 5, 10, 11].map(rateWith)).toEqual([5, 5, 10, 10, 15])
    })
})

describe('dividends (§12.5)', () => {
    it('moves 1 to 4 spaces as the payout reaches half, all, one and a half and twice the price', () => {
        const game = operatingCompany(KansasCity)
        const move = (paid: number) => {
            const effect = EighteenUSAEarningsRules.marketEffect(game.state, 'ATSF', {
                choice: paid ? 'pay' : 'withhold',
                revenue: paid,
                retained: 0,
                baseDividendPerShare: paid / 2
            })
            const to = effect.move?.toMarketSpaceId
            return to ? EighteenUSAMarket.space(to).price : undefined
        }
        expect([0, 24, 25, 50, 75, 100].map(move)).toEqual([48, 50, 53, 56, 59, 62])
    })
})

describe('phase 5 track (§12.2.4)', () => {
    it('lays a green city on an empty city hex and skips colours of plain track for $10 each', () => {
        const game = operatingCompany(KansasCity, (state) => {
            setPhase(state, '5')
            companyCash(state, 'ATSF', 500)
        })
        const [home] = new TrackConstruction(game.hydrated, EighteenUSATrackRules)
            .choices(KansasCity)
            .filter((choice) => color(choice.definitionId) === 'green')
        game.act('LayTile', {
            companyId: 'ATSF',
            locationId: KansasCity,
            definitionId: home.definitionId,
            rotation: home.rotation,
            nodeMapping: home.nodeMapping,
            expectedCost: home.cost
        })
        expect(game.hydrated.trackStep?.lays).toEqual([
            { locationId: KansasCity, definitionId: home.definitionId, upgrade: false }
        ])
        const construction = new TrackConstruction(game.hydrated, EighteenUSATrackRules)
        const plain = TileEdges.flatMap((edge) => {
            const neighbour = EighteenUSAMap.neighbor(KansasCity, edge)
            return neighbour && !neighbour.terrain ? construction.choices(neighbour.id) : []
        })
        const colors = new Set(plain.map((choice) => color(choice.definitionId)))
        expect(colors.has('brown')).toBe(true)
        expect(colors.has('yellow')).toBe(true)
        const brown = plain.find((choice) => color(choice.definitionId) === 'brown')
        expect(brown?.cost).toBe(20 + 20)
        expect(brown?.upgrade).toBe(true)
    })

    it('lets a company yet to operate lay a brown home city as a free action', () => {
        const game = operatingCompany(KansasCity, (state) => {
            setPhase(state, '5')
            companyCash(state, 'ATSF', 500)
        })
        const construction = new TrackConstruction(game.hydrated, EighteenUSATrackRules)
        const colors = construction.choices(KansasCity).map((choice) => color(choice.definitionId))
        expect(colors).toContain('brown')
        expect(colors).toContain('green')
        expect(colors).not.toContain('yellow')
        const mapState = new RailwayMapState(
            EighteenUSAMap,
            EighteenUSATileSet,
            game.state.tileInventory
        )
        expect(mapState.tile(KansasCity).face.color).toBe('white')
    })
})
