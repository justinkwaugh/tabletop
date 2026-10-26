import {
    restoreWorkspace,
    restoreWorkspaceTabs,
    saveWorkspace,
    workspaceLayout,
    type InitialWorkspace,
    type SavedPane,
    type SavedWorkspace,
    type WorkspaceTab
} from '@tabletop/frontend-components'
import { assertExists } from '@tabletop/common'

const sidebar = ['Players', 'History', 'Chat']
export function initialTableLayout(tabs: readonly WorkspaceTab[]): InitialWorkspace {
    const board = tabs.some((tab) => tab.id === 'Board')
    return {
        main: [
            'cols',
            18,
            ['Players'],
            [
                'rows',
                48,
                ['cols', 55, ['cols', 38, ['History', 'Chat'], ['Actions']], ['Spreadsheet']],
                ['cols', 49, [board ? 'Board' : 'Map', 'Tiles'], ['Companies']]
            ]
        ],
        closed: [...(board ? ['Map'] : []), 'Market', 'Player Aid', 'Game info']
    }
}

export function saveTableWorkspace(value: SavedWorkspace) {
    return { ...value, tableLayoutVersion: 2 }
}

export function restoreTableWorkspace(value: unknown, tabs: readonly WorkspaceTab[]): unknown {
    if (
        !value ||
        typeof value !== 'object' ||
        !('v' in value) ||
        value.v !== 1 ||
        ('tableLayoutVersion' in value && value.tableLayoutVersion === 2)
    )
        return value
    const legacyTabs = tabs.filter((tab) => tab.id !== 'Game info')
    const closable = legacyTabs
        .filter((tab) => tab.closable !== false && !tab.optional)
        .map((tab) => tab.id)
    const restored = restoreWorkspace(
        value,
        legacyTabs.map((tab) => tab.id),
        sidebar,
        { axis: 'horizontal', first: ['Actions'] },
        legacyTabs.filter((tab) => tab.optional).map((tab) => tab.id),
        closable
    )
    const layout = workspaceLayout(restored.root)
    const saved = saveWorkspace(restored.root, restored.fixed, closable)
    if (layout.panes.length === 8) {
        layout.panes[0].pane.tabs.unshift('Game info', ...restored.fixed.tabs)
        restored.fixed.tabs = []
        return saveTableWorkspace(saveWorkspace(restored.root, restored.fixed, closable))
    }
    const left: SavedPane =
        layout.panes.length === 7
            ? ['Game info', ...saved.sidebar]
            : ['rows', 25, ['Game info'], saved.sidebar]
    return saveTableWorkspace({ ...saved, sidebar: [], main: ['cols', 20, left, saved.main] })
}

export interface TabbedTableLayout {
    tabs: WorkspaceTab[]
    sidebarAccepts: string[]
    initial: InitialWorkspace
}

export function tabbedTableLayout(title: {
    board: boolean
    chat: boolean
    gameInformation: boolean
}): TabbedTableLayout {
    const sidebarTabs = sidebar.filter((id) => id !== 'Chat' || title.chat)
    const optional = [
        'Player Aid',
        'Depot',
        'Stats',
        ...(title.gameInformation ? ['Game info'] : [])
    ]
    const tabs: WorkspaceTab[] = [
        { id: 'Map', label: title.board ? 'Board' : 'Map', closable: false },
        { id: 'Market', label: 'Market', ...(title.board ? { optional: true } : {}) },
        { id: 'Spreadsheet', label: 'Spreadsheet', shortLabel: 'Sheet' },
        { id: 'Companies', label: 'Companies' },
        { id: 'Tiles', label: 'Tiles' },
        ...sidebarTabs.map((id) => ({ id, label: id })),
        ...optional.map((id) => ({ id, label: id, optional: true }))
    ]
    return {
        tabs,
        sidebarAccepts: tabs.filter((tab) => tab.id !== 'Map').map((tab) => tab.id),
        initial: {
            main: tabs
                .filter((tab) => !tab.optional && !sidebarTabs.includes(tab.id))
                .map((tab) => tab.id),
            sidebar: sidebarTabs
        }
    }
}

export function firstTabbedView(savedLayout: unknown, layout: TabbedTableLayout): string {
    const { root } = restoreWorkspaceTabs(
        savedLayout,
        layout.tabs,
        layout.sidebarAccepts,
        undefined,
        layout.initial
    )
    const first = workspaceLayout(root).panes[0].pane.tabs[0]
    assertExists(first, 'The tabbed view pane always holds Map, which cannot close')
    return first
}

export function defaultTableView(
    savedLayout: unknown,
    tabs: readonly WorkspaceTab[]
): 'Board' | 'Map' {
    const { root } = restoreWorkspaceTabs(
        savedLayout,
        tabs,
        [],
        undefined,
        initialTableLayout(tabs)
    )
    const panes = workspaceLayout(root).panes.map(({ pane }) => pane.tabs)
    const boardPane = panes.find((tabs) => tabs.includes('Board'))
    const mapPane = panes.find((tabs) => tabs.includes('Map'))
    return boardPane && (!mapPane || mapPane === boardPane) ? 'Board' : 'Map'
}
