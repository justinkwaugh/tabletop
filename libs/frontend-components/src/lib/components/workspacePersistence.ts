import { createWorkspace, workspaceLayout, MAX_WORKSPACE_PANES, type WorkspaceNode, type WorkspacePane, type WorkspaceInitialSplit } from './tabWorkspace.js'

export type SavedPane = string[] | ['rows' | 'cols', number, SavedPane, SavedPane]
export interface SavedWorkspace { v: 1; sidebar: string[]; main: SavedPane; closed?: string[] }

export function saveWorkspace(root: WorkspaceNode, fixed: WorkspacePane, closableTabs: readonly string[] = []): SavedWorkspace {
    function encode(node: WorkspaceNode): SavedPane {
        return node.kind === 'pane' ? [...node.tabs] : [node.axis === 'horizontal' ? 'rows' : 'cols', Math.round(node.ratio), encode(node.first), encode(node.second)]
    }
    const present = new Set([...fixed.tabs, ...workspaceLayout(root).panes.flatMap(item => item.pane.tabs)])
    const closed = closableTabs.filter(id => !present.has(id))
    return { ...(closed.length ? { closed } : {}), v: 1, sidebar: [...fixed.tabs], main: encode(root) }
}

export function restoreWorkspace(value: unknown, tabs: readonly string[], sidebar: readonly string[], initialSplit?: WorkspaceInitialSplit, optionalTabs: readonly string[] = [], closableTabs: readonly string[] = [], initialLayout?: SavedPane): { root: WorkspaceNode; fixed: WorkspacePane } {
    const fallback = () => initialLayout ? restoreWorkspace({ v: 1, sidebar, main: initialLayout }, tabs, sidebar, initialSplit, optionalTabs, closableTabs) : ({ root: createWorkspace(tabs.filter(id => !sidebar.includes(id) && !optionalTabs.includes(id)), undefined, initialSplit), fixed: { kind: 'pane' as const, id: 'fixed', tabs: [...sidebar], active: sidebar[0] } })
    if (!value || typeof value !== 'object' || !('v' in value) || value.v !== 1 || !('main' in value)) return fallback()
    const closed = new Set('closed' in value && Array.isArray(value.closed) ? value.closed.filter(id => typeof id === 'string' && closableTabs.includes(id)) : [])
    const seen = new Set<string>()
    let serial = 0
    let leaves = 0
    function clean(ids: unknown[], allowed: readonly string[]) {
        return ids.filter((id): id is string => {
            if (typeof id !== 'string' || !allowed.includes(id) || seen.has(id)) return false
            seen.add(id)
            return true
        })
    }
    const fixedTabs = clean('sidebar' in value && Array.isArray(value.sidebar) ? value.sidebar : [], sidebar)
    function decode(node: unknown, depth: number): WorkspaceNode {
        if (!Array.isArray(node) || depth > 12) throw new Error('Invalid pane')
        const id = `restored-${serial++}`
        if (node.length === 4 && (node[0] === 'rows' || node[0] === 'cols') && typeof node[1] === 'number') {
            if (!Number.isFinite(node[1])) throw new Error('Invalid ratio')
            return { kind: 'split', id, axis: node[0] === 'rows' ? 'horizontal' : 'vertical', ratio: Math.max(20, Math.min(80, Math.round(node[1]))), first: decode(node[2], depth + 1), second: decode(node[3], depth + 1) }
        }
        if (!node.every(id => typeof id === 'string') || ++leaves > MAX_WORKSPACE_PANES) throw new Error('Invalid tabs')
        const ids = clean(node, tabs)
        return { kind: 'pane', id, tabs: ids, active: ids[0] }
    }
    try {
        const root = decode(value.main, 0)
        const first = workspaceLayout(root).panes[0].pane
        for (const id of tabs) {
            if (seen.has(id) || optionalTabs.includes(id) || closed.has(id)) continue
            if (sidebar.includes(id)) fixedTabs.push(id)
            else first.tabs.push(id)
        }
        first.active ??= first.tabs[0]
        return { root, fixed: { kind: 'pane' as const, id: 'fixed', tabs: fixedTabs, active: fixedTabs[0] } }
    } catch { return fallback() }
}
