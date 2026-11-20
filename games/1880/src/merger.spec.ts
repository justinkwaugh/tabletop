import { beforeAll, describe, expect, it } from 'vitest'
import { controllingOwner, homeStationId, presidentCertificate } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { botMove, Random } from '../test/bot.js'
import { edit, kit, type Table } from '../test/kit.js'
import { mergerReplaces, ownerDirectsMerger } from './investors.js'

type Position = { game: Table; seed: number }

/** A merger awaiting its owner's choice, with a station the company could put in its place. */
function pendingMerger(): Position {
    for (let seed = 1; seed < 40; seed++) {
        const game = kit.table(4, seed)
        const random = new Random(seed)
        const due = () => {
            const merger = game.hydrated.investorMerger
            return !!merger && mergerReplaces(game.hydrated, merger)
        }
        for (let count = 0; count < 6000 && !due(); count++) {
            if (game.state.machineState === 'GameOver') break
            const next = botMove(game, random)
            game.act(next.type, next.fields, next.playerId)
        }
        if (due()) return { game, seed }
    }
    throw new Error('No merger came')
}

/** A table of its own at the position. */
function copyOf({ game, seed }: Position): Table {
    const copy = kit.table(4, seed)
    copy.state = structuredClone(game.state)
    return copy
}

/** The same position, the company's directorship passed to another player. */
function directedByAnother(position: Position): { game: Table; owner: string; director: string } {
    const game = position.game
    const merger = game.state.investorMerger
    assertExists(merger, 'A merger is pending')
    const owner = controllingOwner(game.hydrated, merger.investorId)?.playerId
    assertExists(owner, 'The investor has its owner')
    const director = game.state.players.find((player) => player.playerId !== owner)?.playerId
    assertExists(director, 'Another player is seated')
    const copy = copyOf(position)
    edit(copy, (state) => {
        const certificate = presidentCertificate(state, merger.companyId)
        assertExists(certificate, 'The company has its director’s certificate')
        certificate.owner = { kind: 'player', playerId: director }
        const company = state.companies.find((entry) => entry.id === merger.companyId)
        assertExists(company, 'The company is in the game')
        company.president = { kind: 'player', playerId: director }
    })
    return { game: copy, owner, director }
}

const placedAt = (game: Table, stationId: string) => {
    const station = game.state.stations.find((entry) => entry.id === stationId)
    return station?.status === 'placed' ? station.position : undefined
}

describe('a foreign investor merging into its company (§VII)', () => {
    let position: Position
    beforeAll(() => {
        position = pendingMerger()
    }, 600_000)

    it('lets an owner who directs the company choose the treasury and the station at once', () => {
        const game = copyOf(position)
        const merger = game.hydrated.investorMerger
        assertExists(merger, 'A merger is pending')
        expect(ownerDirectsMerger(game.hydrated, merger)).toBe(true)
        const home = placedAt(game, homeStationId(merger.investorId))
        game.act('MergeInvestor', { treasuryTo: 'company', replaceStation: true })
        expect(game.state.investorMerger).toBeUndefined()
        const replacing = game.state.stations.find(
            (station) =>
                station.companyId === merger.companyId &&
                station.status === 'placed' &&
                station.position.locationId === home?.locationId
        )
        expect(replacing).toBeDefined()
    })

    it('leaves the station to the company’s director when another player directs it', () => {
        const { game, owner, director } = directedByAnother(position)
        const merger = game.hydrated.investorMerger
        assertExists(merger, 'A merger is pending')
        const home = placedAt(game, homeStationId(merger.investorId))
        // The owner chooses only where the treasury goes.
        expect(() =>
            game.act('MergeInvestor', { treasuryTo: 'owner', replaceStation: true }, owner)
        ).toThrow()
        game.act('MergeInvestor', { treasuryTo: 'owner', replaceStation: false }, owner)
        expect(game.state.investorMerger?.stationChooser).toBe(director)
        expect(game.valid(director)).toContain('ReplaceInvestorStation')
        expect(game.valid(owner)).not.toContain('ReplaceInvestorStation')
        expect(game.valid(owner)).not.toContain('MergeInvestor')
        game.act('ReplaceInvestorStation', { replaceStation: true }, director)
        expect(game.state.investorMerger).toBeUndefined()
        expect(placedAt(game, homeStationId(merger.investorId))).toBeUndefined()
        expect(
            game.state.stations.some(
                (station) =>
                    station.companyId === merger.companyId &&
                    station.status === 'placed' &&
                    station.position.locationId === home?.locationId
            )
        ).toBe(true)
    })

    it('lets the director decline, the investor’s station leaving the map', () => {
        const { game, owner, director } = directedByAnother(position)
        const merger = game.hydrated.investorMerger
        assertExists(merger, 'A merger is pending')
        const placedBefore = game.state.stations.filter(
            (station) => station.companyId === merger.companyId && station.status === 'placed'
        ).length
        game.act('MergeInvestor', { treasuryTo: 'company', replaceStation: false }, owner)
        game.act('ReplaceInvestorStation', { replaceStation: false }, director)
        expect(game.state.investorMerger).toBeUndefined()
        expect(placedAt(game, homeStationId(merger.investorId))).toBeUndefined()
        expect(
            game.state.stations.filter(
                (station) => station.companyId === merger.companyId && station.status === 'placed'
            ).length
        ).toBe(placedBefore)
    })
})
