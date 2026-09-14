import { expect, it } from 'vitest'
import { migrateCompanyNames } from './migrateCompanyNames.js'

it('updates saved names and reversal patches without changing game progress or roles', () => {
    const saved = {
        game: { state: { actionCount: 47, actionChecksum: 1234, companies: [
            { id: 'ML', name: 'Charlottetown · Mainline', role: 'mainline', cash: 240 }
        ] } },
        actions: [{ id: 'sale-47', index: 46, undo: { companies: [
            { id: 'ML', name: 'Charlottetown · Mainline', cash: 200 }
        ] } }]
    }
    expect(migrateCompanyNames(saved)).toBe(true)
    expect(saved.game.state).toEqual({ actionCount: 47, actionChecksum: 1234, companies: [
        { id: 'ML', name: 'Charlottetown', role: 'mainline', cash: 240 }
    ] })
    expect(saved.actions).toEqual([{ id: 'sale-47', index: 46, undo: { companies: [
        { id: 'ML', name: 'Charlottetown', cash: 200 }
    ] } }])
    expect(migrateCompanyNames(saved)).toBe(false)
})
