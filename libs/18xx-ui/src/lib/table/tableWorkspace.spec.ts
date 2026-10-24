import { expect, it } from 'vitest'
import { restoreWorkspace, workspaceLayout, type SavedPane } from '@tabletop/frontend-components'
import {
    defaultTableView,
    firstTabbedView,
    initialTableLayout,
    restoreTableWorkspace,
    tabbedTableLayout,
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

it('starts with Players beside the play area and the reference tabs closed', () => {
    const ids = [...tabs.map((tab) => tab.id), 'Companies', 'Player Aid']
    const restored = restoreWorkspace(
        null,
        ids,
        [],
        undefined,
        [],
        ids.filter((id) => id !== 'Actions'),
        initialTableLayout(tabs)
    )
    expect(workspaceLayout(restored.root).panes.map((item) => item.pane.tabs)).toEqual([
        ['Players'],
        ['History', 'Chat'],
        ['Actions'],
        ['Spreadsheet'],
        ['Map', 'Tiles'],
        ['Companies']
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
it('defaults to Board unless Map is open in another pane', () => {
    const withBoard = [...tabs, { id: 'Board', label: 'Board', optional: true }]
    const layout = (main: SavedPane) => saveTableWorkspace({ v: 1, sidebar: [], main })
    expect(defaultTableView(layout(['Map', 'Market', 'Board']), withBoard)).toBe('Board')
    expect(defaultTableView(layout(['cols', 50, ['Map'], ['Board']]), withBoard)).toBe('Map')
    expect(defaultTableView(layout(['Map', 'Market']), withBoard)).toBe('Map')
    expect(
        defaultTableView(
            saveTableWorkspace({ v: 1, sidebar: [], main: ['Board', 'Tiles'], closed: ['Map'] }),
            withBoard
        )
    ).toBe('Board')
    expect(defaultTableView(null, withBoard)).toBe('Board')
    expect(defaultTableView(null, tabs)).toBe('Map')
})
it('starts a new layout with Board in place of Map when the title has board areas', () => {
    const withBoard = [...tabs, { id: 'Board', label: 'Board', optional: true }]
    expect(initialTableLayout(withBoard)).toEqual({
        main: [
            'cols',
            18,
            ['Players'],
            [
                'rows',
                48,
                ['cols', 55, ['cols', 38, ['History', 'Chat'], ['Actions']], ['Spreadsheet']],
                ['cols', 49, ['Board', 'Tiles'], ['Companies']]
            ]
        ],
        closed: ['Map', 'Market', 'Player Aid', 'Game info']
    })
})
it('builds the tabbed layout for a title, with Chat and Game info only where they exist', () => {
    const board = tabbedTableLayout({ board: true, chat: true, gameInformation: true })
    expect(board.tabs.find((tab) => tab.id === 'Map')).toEqual({
        id: 'Map',
        label: 'Board',
        closable: false
    })
    expect(board.initial).toEqual({
        main: ['Map', 'Spreadsheet', 'Companies', 'Tiles'],
        sidebar: ['Players', 'History', 'Chat']
    })
    expect(board.sidebarAccepts).not.toContain('Map')
    expect(board.tabs.filter((tab) => tab.optional).map((tab) => tab.id)).toEqual([
        'Market',
        'Player Aid',
        'Depot',
        'Stats',
        'Game info'
    ])
    const hotseat = tabbedTableLayout({ board: false, chat: false, gameInformation: false })
    expect(hotseat.initial).toEqual({
        main: ['Map', 'Market', 'Spreadsheet', 'Companies', 'Tiles'],
        sidebar: ['Players', 'History']
    })
    expect(hotseat.tabs.map((tab) => tab.id)).not.toContain('Chat')
    expect(hotseat.tabs.map((tab) => tab.id)).not.toContain('Game info')
})
it('opens the tabbed layout on the first tab of its view pane', () => {
    const layout = tabbedTableLayout({ board: true, chat: true, gameInformation: false })
    expect(firstTabbedView(null, layout)).toBe('Map')
    expect(
        firstTabbedView(
            { v: 1, sidebar: ['Players', 'History'], main: ['Tiles', 'Map', 'Spreadsheet'] },
            layout
        )
    ).toBe('Tiles')
    expect(
        firstTabbedView(
            { v: 1, sidebarDeleted: true, sidebar: [], main: ['History', 'Map'] },
            layout
        )
    ).toBe('History')
})
