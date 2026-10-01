import { expect, it } from 'vitest'
import { restoreWorkspace, workspaceLayout, type SavedPane } from '@tabletop/frontend-components'
import {
    defaultTableView,
    initialTableLayout,
    restoreTableWorkspace,
    saveTableWorkspace
} from './tableWorkspace.js'
const tabs = [
    'Game info',
    'Players',
    'History',
    'Chat',
    'Actions',
    'Map',
    'Market',
    'Spreadsheet',
    'Tiles'
].map((id) => ({ id, label: id, closable: id !== 'Actions' }))

it('starts with information above social tabs and Player Aid after Tiles', () => {
    const restored = restoreWorkspace(
        null,
        [...tabs.map((tab) => tab.id), 'Companies', 'Player Aid'],
        [],
        undefined,
        [],
        [],
        initialTableLayout(tabs)
    )
    expect(workspaceLayout(restored.root).panes.map((item) => item.pane.tabs)).toEqual([
        ['Game info'],
        ['Players', 'History', 'Chat'],
        ['Actions'],
        ['Map', 'Market', 'Spreadsheet', 'Companies', 'Tiles', 'Player Aid']
    ])
})
it('preserves legacy splits, percentages and sidebar order during migration', () => {
    const main = ['rows', 37, ['Actions', 'History'], ['Map', 'Market', 'Spreadsheet']]
    const result = restoreTableWorkspace(
        { v: 1, sidebar: ['Chat', 'Players'], main, closed: ['Tiles'] },
        tabs
    )
    expect(result).toEqual({
        v: 1,
        tableLayoutVersion: 2,
        sidebar: [],
        closed: ['Tiles'],
        main: ['cols', 20, ['rows', 25, ['Game info'], ['Chat', 'Players']], main]
    })
})
it('never exceeds eight panes when promoting a full legacy layout', () => {
    for (const count of [7, 8]) {
        let main: SavedPane = ['Actions', 'Map', 'Market', 'Spreadsheet', 'Tiles']
        for (let index = 1; index < count; index++) main = ['rows', 50, [], main]
        const migrated = restoreTableWorkspace(
            { v: 1, sidebar: ['Players', 'History', 'Chat'], main },
            tabs
        )
        const restored = restoreWorkspace(
            migrated,
            tabs.map((tab) => tab.id),
            []
        )
        const panes = workspaceLayout(restored.root).panes
        expect(panes).toHaveLength(8)
        expect(panes.flatMap((item) => item.pane.tabs).sort()).toEqual(
            tabs.map((tab) => tab.id).sort()
        )
    }
})
it('does not reintroduce an intentionally closed Game info tab in the new layout', () => {
    const saved = saveTableWorkspace({ v: 1, sidebar: [], main: ['Map'], closed: ['Game info'] })
    expect(restoreTableWorkspace(saved, tabs)).toBe(saved)
})
it('defaults to Board only when it shares a pane with Map', () => {
    const withBoard = [...tabs, { id: 'Board', label: 'Board', optional: true }]
    const layout = (main: SavedPane) => saveTableWorkspace({ v: 1, sidebar: [], main })
    expect(defaultTableView(layout(['Map', 'Market', 'Board']), withBoard)).toBe('Board')
    expect(defaultTableView(layout(['cols', 50, ['Map'], ['Board']]), withBoard)).toBe('Map')
    expect(defaultTableView(layout(['Map', 'Market']), withBoard)).toBe('Map')
    expect(defaultTableView(null, withBoard)).toBe('Board')
    expect(defaultTableView(null, tabs)).toBe('Map')
})
it('starts a new layout with Board before Map when the title has board areas', () => {
    const withBoard = [...tabs, { id: 'Board', label: 'Board', optional: true }]
    expect(initialTableLayout(withBoard)).toEqual([
        'cols',
        20,
        ['rows', 25, ['Game info'], ['Players', 'History', 'Chat']],
        [
            'rows',
            50,
            ['Actions'],
            ['Board', 'Map', 'Market', 'Spreadsheet', 'Companies', 'Tiles', 'Player Aid']
        ]
    ])
})
