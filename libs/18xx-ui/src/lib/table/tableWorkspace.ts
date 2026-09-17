import { restoreWorkspace, saveWorkspace, workspaceLayout, type SavedPane, type SavedWorkspace, type WorkspaceTab } from '@tabletop/frontend-components'

const sidebar = ['Players', 'History', 'Chat']
export const initialTableLayout: SavedPane = ['cols', 20,
    ['rows', 25, ['Game info'], sidebar],
    ['rows', 50, ['Actions'], ['Map', 'Market', 'Spreadsheet', 'Tiles', 'Player Aid']]
]

export function saveTableWorkspace(value: SavedWorkspace) {
    return { ...value, tableLayoutVersion: 2 }
}

export function restoreTableWorkspace(value: unknown, tabs: readonly WorkspaceTab[]): unknown {
    if (!value || typeof value !== 'object' || !('v' in value) || value.v !== 1 || ('tableLayoutVersion' in value && value.tableLayoutVersion === 2)) return value
    const legacyTabs = tabs.filter(tab => tab.id !== 'Game info')
    const closable = legacyTabs.filter(tab => tab.closable !== false && !tab.optional).map(tab => tab.id)
    const restored = restoreWorkspace(value, legacyTabs.map(tab => tab.id), sidebar,
        { axis: 'horizontal', first: ['Actions'] }, legacyTabs.filter(tab => tab.optional).map(tab => tab.id), closable)
    const layout = workspaceLayout(restored.root)
    const saved = saveWorkspace(restored.root, restored.fixed, closable)
    if (layout.panes.length === 8) {
        layout.panes[0].pane.tabs.unshift('Game info', ...restored.fixed.tabs)
        restored.fixed.tabs = []
        return saveTableWorkspace(saveWorkspace(restored.root, restored.fixed, closable))
    }
    const left: SavedPane = layout.panes.length === 7
        ? ['Game info', ...saved.sidebar]
        : ['rows', 25, ['Game info'], saved.sidebar]
    return saveTableWorkspace({ ...saved, sidebar: [], main: ['cols', 20, left, saved.main] })
}
