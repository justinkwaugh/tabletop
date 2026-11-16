import {
    assert,
    assertExists,
    TournamentMatchGame,
    TournamentSchedule,
    tournamentTableId
} from '@tabletop/common'
import * as Type from 'typebox'

export const StoredTournamentSchedule = Type.Object({
    ...Type.Omit(TournamentSchedule, ['tables']).properties,
    positions: Type.Array(Type.Integer({ minimum: 0, maximum: 255 }), { maxItems: 65_536 }),
    // A Knockout's Tables in order, which it adds as Matches resolve.
    matches: Type.Optional(Type.Array(TournamentMatchGame, { maxItems: 4096 }))
})
export type StoredTournamentSchedule = Type.Static<typeof StoredTournamentSchedule>

export function storeTournamentSchedule(schedule: TournamentSchedule): StoredTournamentSchedule {
    const { tables, ...metadata } = schedule
    const indices = new Map(schedule.entrantIds.map((id, index) => [id, index]))
    const positions = tables.flatMap((table, index) => {
        assert(table.id === tournamentTableId(index), 'Table IDs must follow schedule order')
        return table.entrantIds.map((id) => {
            const index = indices.get(id)
            assertExists(index, 'Table entrant is missing from the schedule roster')
            return index
        })
    })
    if (!schedule.bracket) return { ...metadata, positions }
    const matches = tables.map((table) => {
        assertExists(table.match, 'A knockout table belongs to a match')
        return table.match
    })
    return { ...metadata, positions, matches }
}

export function loadTournamentSchedule(stored: StoredTournamentSchedule): TournamentSchedule {
    const { positions, matches, ...metadata } = stored
    assert(
        positions.length ===
            (matches
                ? matches.length * stored.tableSize
                : stored.entrantIds.length * stored.gamesPerEntrant),
        'Incomplete schedule assignments'
    )
    const tables: TournamentSchedule['tables'] = []
    for (let offset = 0; offset < positions.length; offset += stored.tableSize) {
        const match = matches?.[tables.length]
        tables.push({
            id: tournamentTableId(tables.length),
            entrantIds: positions.slice(offset, offset + stored.tableSize).map((index) => {
                const id = stored.entrantIds[index]
                assertExists(id, 'Schedule position is outside its roster')
                return id
            }),
            ...(match ? { match } : {})
        })
    }
    return { ...metadata, tables }
}
