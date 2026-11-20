import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { reasonTaxRefused, taxPreview, taxShillings } from './tax.js'
import { knightRows, rowSeat, seatKnightRow } from '../model/knightRows.js'

const SPACES: readonly SpaceId[] = ['space.forest.1', 'space.forest.3', 'space.desert.1']

type Kind = 'outpost' | 'farm' | 'town' | 'feudum'

/** The seat rules a space of each kind named, its markers leaving its own supply. */
function rule(state: HydratedFeudumGameState, playerId: string, kinds: readonly Kind[]): void {
    kinds.forEach((kind, index) => {
        const space = state.spaces[SPACES[index]]
        space.location.kind = kind
        space.ruler = { playerId, subject: false }
        state.getPlayerState(playerId).influenceSupply -= 1
    })
}

function tableWith(
    kinds: readonly Kind[],
    edit?: (state: HydratedFeudumGameState, playerId: string) => void
): { table: Table; playerId: string } {
    const table = tableAtPlayingCards(() => ({ cards: ['tax', 'migrate', 'guild'] }))
    const playerId = table.asked
    table.moveTo((state) => {
        rule(state, playerId, kinds)
        edit?.(state, playerId)
        state.recomputeRanks()
        return MachineState.PlayingCards
    })
    return { table, playerId }
}

function knight(state: HydratedFeudumGameState, playerId: string): void {
    state.getPlayerState(playerId).pawns[0].character = 'knight'
}

/** Moves every marker of the seat's out of the general supply, onto its own supply. */
function emptyColour(state: HydratedFeudumGameState, playerId: string): void {
    const player = state.getPlayerState(playerId)
    player.influenceSupply += state.supply.influence[playerId]
    state.supply.influence[playerId] = 0
}

describe('Tax: R-3.12.1', () => {
    it('R-3.12.1 one town: 2 shillings, from the general supply', () => {
        const { table, playerId } = tableWith(['town'])
        const { shillings } = table.seat(playerId)
        const { shillings: inSupply } = table.state.supply

        const [action] = table.send(playerId, { type: ActionType.Tax })

        expect(table.seat(playerId).shillings).toBe(shillings + 2)
        expect(table.state.supply.shillings).toBe(inSupply - 2)
        expect(table.seat(playerId).played).toEqual([{ kind: 'tax', use: 'regular' }])
        expect(action).toMatchObject({ metadata: { shillings: 2, rankChanges: [] } })
        expect(action).not.toHaveProperty('metadata.reinforcements')
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-3.12.1 +1 per other town or feudum ruled; outposts and farms add nothing', () => {
        const cases: readonly [readonly Kind[], number][] = [
            [['town', 'town'], 3],
            [['town', 'feudum'], 3],
            [['town', 'town', 'feudum'], 4],
            [['town', 'farm', 'outpost'], 2]
        ]
        for (const [kinds, expected] of cases) {
            const { table, playerId } = tableWith(kinds)
            const { shillings } = table.seat(playerId)
            expect(taxShillings(table.hydrated(), playerId)).toBe(expected)
            table.send(playerId, { type: ActionType.Tax })
            expect(table.seat(playerId).shillings).toBe(shillings + expected)
        }
    })

    it('R-3.12.1 refuses a seat ruling no town, with the reason', () => {
        for (const kinds of [[], ['farm'], ['feudum']] satisfies Kind[][]) {
            const { table, playerId } = tableWith(kinds)
            expect(reasonTaxRefused(table.hydrated(), playerId, {})).toBe('You rule no town.')
            expect(() => table.send(playerId, { type: ActionType.Tax })).toThrow(
                'You rule no town.'
            )
        }
    })

    it('R-4.1.4 a serf or a subject of a town taxes nothing', () => {
        const { table, playerId } = tableWith([], (state, id) => {
            const space = state.spaces[SPACES[0]]
            space.location.kind = 'town'
            space.ruler = { playerId: 'p9', subject: false }
            space.serf = { playerId: id }
            state.getPlayerState(id).influenceSupply -= 1
        })
        expect(reasonTaxRefused(table.hydrated(), playerId, {})).toBe('You rule no town.')
    })

    it('R-1.1-H1 a short supply pays what remains, and the metadata says what', () => {
        const { table, playerId } = tableWith(['town', 'town'], (state, id) => {
            state.getPlayerState(id).shillings += state.supply.shillings - 2
            state.supply.shillings = 2
        })
        const { shillings } = table.seat(playerId)
        const [action] = table.send(playerId, { type: ActionType.Tax })
        expect(table.seat(playerId).shillings).toBe(shillings + 2)
        expect(table.state.supply.shillings).toBe(0)
        expect(action).toMatchObject({ metadata: { shillings: 2 } })
    })

    it('R-3.2 refuses a seat not on turn, and passes the turn after', () => {
        const { table, playerId } = tableWith(['town'])
        expect(reasonTaxRefused(table.hydrated(), table.order[1], {})).toBe("It isn't your turn.")
        table.send(playerId, { type: ActionType.Tax })
        expect(table.asked).toBe(table.order[1])
    })

    it('R-3.2 is offered from the hand, registered for the API', () => {
        const { table, playerId } = tableWith(['town'])
        expect(table.offered(playerId)).toContain(ActionType.Tax)
        expect(FeudumApiActions[ActionType.Tax]).toBeDefined()
    })
})

describe('Reinforcements: R-3.12.2, R-3.12-H1 (S22)', () => {
    it('R-3.12-H1 with a Knight pawn the seat is asked: Tax without an answer is refused', () => {
        const { table, playerId } = tableWith(['town'], knight)
        expect(reasonTaxRefused(table.hydrated(), playerId, {})).toBe(
            'Collect Reinforcements or decline it.'
        )
        expect(() => table.send(playerId, { type: ActionType.Tax })).toThrow(
            'Collect Reinforcements or decline it.'
        )
        expect(reasonTaxRefused(table.hydrated(), playerId, { collect: true })).toBeUndefined()
        expect(reasonTaxRefused(table.hydrated(), playerId, { collect: false })).toBeUndefined()
    })

    it('R-3.12.2 collected: one marker from the general supply', () => {
        const { table, playerId } = tableWith(['town'], knight)
        const seat = table.seat(playerId)
        const markers = seat.influenceSupply
        const inSupply = table.state.supply.influence[seat.playerId]

        const [action] = table.send(playerId, { type: ActionType.Tax, collect: true })

        expect(table.seat(playerId).influenceSupply).toBe(markers + 1)
        expect(table.state.supply.influence[seat.playerId]).toBe(inSupply - 1)
        expect(table.seat(playerId).played).toEqual([{ kind: 'tax', use: 'special' }])
        expect(action).toMatchObject({
            metadata: { shillings: 2, reinforcements: 'general-supply', rankChanges: [] }
        })
    })

    it('R-3.12-H1 declined: Tax pays, no marker comes, and the card is played for its action', () => {
        const { table, playerId } = tableWith(['town'], knight)
        const seat = table.seat(playerId)
        const markers = seat.influenceSupply
        const inSupply = table.state.supply.influence[seat.playerId]

        const [action] = table.send(playerId, { type: ActionType.Tax, collect: false })

        expect(table.seat(playerId).shillings).toBe(seat.shillings + 2)
        expect(table.seat(playerId).influenceSupply).toBe(markers)
        expect(table.state.supply.influence[seat.playerId]).toBe(inSupply)
        expect(table.seat(playerId).played).toEqual([{ kind: 'tax', use: 'regular' }])
        expect(action).toMatchObject({ metadata: { shillings: 2, rankChanges: [] } })
        expect(action).not.toHaveProperty('metadata.reinforcements')
    })

    it('R-3.12.2 several knights still take one marker', () => {
        const { table, playerId } = tableWith(['town'], (state, id) => {
            const [first, second] = state.getPlayerState(id).pawns
            first.character = 'knight'
            second.character = 'knight'
            second.spaceId = first.spaceId
        })
        const markers = table.seat(playerId).influenceSupply
        table.send(playerId, { type: ActionType.Tax, collect: true })
        expect(table.seat(playerId).influenceSupply).toBe(markers + 1)
    })

    it("R-3.12.2 with none of the seat's markers in the general supply, from the seat’s own row", () => {
        const { table, playerId } = tableWith(['town'], (state, id) => {
            knight(state, id)
            emptyColour(state, id)
        })
        const rows = knightRows(table.state)
        const before = rows.map(({ row }) => row.markers)
        const own = rows.findIndex(({ row }) => rowSeat(row.owner) === playerId)
        const markers = table.seat(playerId).influenceSupply

        const [action] = table.send(playerId, { type: ActionType.Tax, collect: true })

        expect(table.seat(playerId).influenceSupply).toBe(markers + 1)
        expect(knightRows(table.state).map(({ row }) => row.markers)).toEqual(
            before.map((count, index) => (index === own ? count - 1 : count))
        )
        expect(action).toMatchObject({ metadata: { reinforcements: 'knight-row' } })
    })

    it('R-3.12.2, R-1.1 with neither, nothing is asked: Tax still pays and no marker comes', () => {
        const { table, playerId } = tableWith(['town'], (state, id) => {
            knight(state, id)
            emptyColour(state, id)
            const row = seatKnightRow(state, id)?.row
            if (row) {
                state.getPlayerState(id).influenceSupply += row.markers
                row.markers = 0
            }
        })
        const markers = table.seat(playerId).influenceSupply
        expect(reasonTaxRefused(table.hydrated(), playerId, { collect: true })).toBe(
            'No influence marker of yours is left to collect.'
        )
        const [action] = table.send(playerId, { type: ActionType.Tax })
        expect(table.seat(playerId).influenceSupply).toBe(markers)
        expect(action).toMatchObject({ metadata: { shillings: 2 } })
        expect(action).not.toHaveProperty('metadata.reinforcements')
    })

    it('R-3.12.2 without a Knight pawn nothing is asked or comes, though a row holds markers', () => {
        const { table, playerId } = tableWith(['town'])
        const markers = table.seat(playerId).influenceSupply
        expect(reasonTaxRefused(table.hydrated(), playerId, { collect: true })).toBe(
            'Reinforcements needs a Knight pawn on the board.'
        )
        table.send(playerId, { type: ActionType.Tax })
        expect(table.seat(playerId).influenceSupply).toBe(markers)
    })

    it('R-4.5.2 the marker goes straight onto a track the seat qualifies for', () => {
        const { table, playerId } = tableWith(['town'], (state, id) => {
            const player = state.getPlayerState(id)
            const [first, second] = player.pawns
            first.character = 'knight'
            // The farmer keeps its rank's marker on the track.
            second.spaceId = first.spaceId
            second.character = 'farmer'
            state.supply.influence[player.playerId] += player.influenceSupply
            player.influenceSupply = 0
            state.guilds.tracks.knight = {}
        })
        const inSupply = table.state.supply.influence[playerId]
        expect(table.state.guilds.tracks.knight.master).toBeUndefined()

        const [action] = table.send(playerId, { type: ActionType.Tax, collect: true })

        expect(table.state.guilds.tracks.knight.master?.playerId).toBe(playerId)
        expect(table.seat(playerId).influenceSupply).toBe(0)
        expect(table.state.supply.influence[playerId]).toBe(inSupply - 1)
        expect(action).toMatchObject({
            metadata: {
                reinforcements: 'general-supply',
                rankChanges: [{ guildId: 'knight', playerId, to: 'master' }]
            }
        })
    })

    it('R-3.12 the preview gives the press’s result and changes nothing', () => {
        const { table, playerId } = tableWith(['town', 'town'], knight)
        const before = JSON.stringify(table.state)
        expect(taxPreview(table.hydrated(), playerId, { collect: true })).toEqual({
            shillings: 3,
            reinforcements: 'general-supply',
            rankChanges: []
        })
        expect(taxPreview(table.hydrated(), playerId, { collect: false })).toEqual({
            shillings: 3,
            rankChanges: []
        })
        expect(JSON.stringify(table.state)).toBe(before)
    })
})

describe('R-3.15.2 replayed', () => {
    it('R-3.15.2 Déjà Vu taxes again for a saltpeter, on the real Action', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['tax', 'repeat', 'guild'] }), 2)
        const [first, second] = table.order
        table.moveTo((state) => {
            rule(state, first, ['town'])
            return MachineState.PlayingCards
        })
        table.send(first, { type: ActionType.Tax })
        table.send(second, { type: ActionType.ForfeitCard, kind: 'tax' })
        const { shillings } = table.seat(first)
        const { saltpeter } = table.seat(first).goods

        table.send(first, { type: ActionType.Tax, asRepeat: 'deja-vu' })

        const seat = table.seat(first)
        expect(seat.shillings).toBe(shillings + 2)
        expect(seat.goods.saltpeter).toBe(saltpeter - 1)
        expect(seat.hand).toEqual(['guild'])
        expect(seat.played.at(-1)).toEqual({
            kind: 'repeat',
            use: 'regular',
            replayedKind: 'tax',
            dejaVu: true
        })
    })
})
