import { assert, assertExists, TournamentSchedule, tournamentTableId } from '@tabletop/common'
import * as Type from 'typebox'

export const StoredTournamentSchedule = Type.Object({
    ...Type.Omit(TournamentSchedule, ['tables']).properties,
    positions: Type.Array(Type.Integer({ minimum: 0, maximum: 255 }), { maxItems: 65_536 })
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
    return { ...metadata, positions }
}

export function loadTournamentSchedule(stored: StoredTournamentSchedule): TournamentSchedule {
    const { positions, ...metadata } = stored
    assert(
        positions.length === stored.entrantIds.length * stored.gamesPerEntrant,
        'Incomplete schedule assignments'
    )
    const tables: TournamentSchedule['tables'] = []
    for (let offset = 0; offset < positions.length; offset += stored.tableSize) {
        tables.push({
            id: tournamentTableId(tables.length),
            entrantIds: positions.slice(offset, offset + stored.tableSize).map((index) => {
                const id = stored.entrantIds[index]
                assertExists(id, 'Schedule position is outside its roster')
                return id
            })
        })
    }
    return { ...metadata, tables }
}
