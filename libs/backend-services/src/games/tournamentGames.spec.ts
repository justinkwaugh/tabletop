import { describe, expect, it } from 'vitest'
import { DERIVED_ID_LENGTH } from '../competitions/derivedId.js'
import { tournamentGameId } from './tournamentGames.js'

describe('tournamentGameId', () => {
    const reference = { tournamentId: 'HGeSQdgTpRnde-Ze1IYPo', stageId: 'main', tableId: '5' }

    it('is as long as an ordinary game id', () => {
        const id = tournamentGameId({ shortGameIds: true }, reference)
        expect(id).toMatch(/^[\w-]+$/)
        expect(id).toHaveLength(DERIVED_ID_LENGTH)
    })

    it('keeps the long id for tournaments created before short ids', () => {
        expect(tournamentGameId({}, reference)).toMatch(/^tournament-[0-9a-f]{64}$/)
    })

    it('differs for each table and attempt', () => {
        const ids = [reference, { ...reference, tableId: '6' }, { ...reference, attempt: 2 }].map(
            (value) => tournamentGameId({ shortGameIds: true }, value)
        )
        expect(new Set(ids).size).toBe(3)
        expect(tournamentGameId({ shortGameIds: true }, reference)).toBe(ids[0])
    })
})
