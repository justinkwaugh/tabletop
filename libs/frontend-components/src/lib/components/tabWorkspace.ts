export const MAX_WORKSPACE_PANES = 8

export type SplitAxis = 'horizontal' | 'vertical'
export type WorkspaceNode = WorkspacePane | WorkspaceSplit
export interface WorkspacePane {
    kind: 'pane'
    id: string
    tabs: string[]
    active: string | undefined
}
export interface WorkspaceSplit {
    kind: 'split'
    id: string
    axis: SplitAxis
    ratio: number
    first: WorkspaceNode
    second: WorkspaceNode
}
export interface WorkspaceRect { x: number; y: number; width: number; height: number }
export interface PaneLayout extends WorkspaceRect { pane: WorkspacePane; available: SplitAxis[] }
export interface DividerLayout extends WorkspaceRect { split: WorkspaceSplit }

export interface WorkspaceInitialSplit {
    axis: SplitAxis
    first: readonly string[]
}

export function createWorkspace(tabs: readonly string[], selected?: string, initialSplit?: WorkspaceInitialSplit): WorkspaceNode {
    function pane(id: string, ids: string[]): WorkspacePane {
        return { kind: 'pane', id, tabs: ids, active: selected && ids.includes(selected) ? selected : ids[0] }
    }
    if (!initialSplit) return pane('root', [...tabs])
    return {
        kind: 'split', id: 'initial-split', axis: initialSplit.axis, ratio: 50,
        first: pane('root', tabs.filter(id => initialSplit.first.includes(id))),
        second: pane('initial-second', tabs.filter(id => !initialSplit.first.includes(id)))
    }
}

export function workspaceLayout(root: WorkspaceNode) {
    const panes: PaneLayout[] = []
    const dividers: DividerLayout[] = []
    function visit(node: WorkspaceNode, rect: WorkspaceRect) {
        if (node.kind === 'pane') {
            panes.push({ ...rect, pane: node, available: ['horizontal', 'vertical'] })
            return
        }
        dividers.push({ ...rect, split: node })
        const fraction = node.ratio / 100
        const first = node.axis === 'vertical' ? { ...rect, width: rect.width * fraction } : { ...rect, height: rect.height * fraction }
        const second = node.axis === 'vertical'
            ? { ...rect, x: rect.x + first.width, width: rect.width - first.width }
            : { ...rect, y: rect.y + first.height, height: rect.height - first.height }
        visit(node.first, first)
        visit(node.second, second)
    }
    visit(root, { x: 0, y: 0, width: 100, height: 100 })
    if (panes.length >= MAX_WORKSPACE_PANES) for (const pane of panes) pane.available = []
    return { panes, dividers }
}

function updatePane(root: WorkspaceNode, id: string, update: (pane: WorkspacePane) => WorkspaceNode): WorkspaceNode {
    if (root.kind === 'pane') return root.id === id ? update(root) : root
    return { ...root, first: updatePane(root.first, id, update), second: updatePane(root.second, id, update) }
}
export function splitPane(root: WorkspaceNode, id: string, axis: SplitAxis): WorkspaceNode {
    const layout = workspaceLayout(root)
    if (!layout.panes.find(item => item.pane.id === id)?.available.includes(axis)) return root
    const ids = new Set([...layout.panes.map(item => item.pane.id), ...layout.dividers.map(item => item.split.id)])
    function uniqueId(base: string) {
        let candidate = base
        for (let suffix = 2; ids.has(candidate); suffix++) candidate = `${base}-${suffix}`
        return candidate
    }
    return updatePane(root, id, pane => ({ kind: 'split', id: uniqueId(`${id}-split-${axis}`), axis, ratio: 50,
        first: pane, second: { kind: 'pane', id: uniqueId(`${id}-${axis}`), tabs: [], active: undefined } }))
}
export function activateTab(root: WorkspaceNode, tab: string): WorkspaceNode {
    if (root.kind === 'pane') return root.tabs.includes(tab) ? { ...root, active: tab } : root
    return { ...root, first: activateTab(root.first, tab), second: activateTab(root.second, tab) }
}
export function moveTab(root: WorkspaceNode, tab: string, destination: string, beforeTab?: string): WorkspaceNode {
    const panes = workspaceLayout(root).panes
    const source = panes.find(item => item.pane.tabs.includes(tab))?.pane
    if (!source || !panes.some(item => item.pane.id === destination)) return root
    if (beforeTab === tab) return activateTab(root, tab)
    const removed = updatePane(root, source.id, pane => {
        const tabs = pane.tabs.filter(id => id !== tab)
        return { ...pane, tabs, active: pane.active === tab ? tabs[0] : pane.active }
    })
    return updatePane(removed, destination, pane => {
        const tabs = [...pane.tabs]
        const index = beforeTab === undefined ? -1 : tabs.indexOf(beforeTab)
        tabs.splice(index < 0 ? tabs.length : index, 0, tab)
        return { ...pane, tabs, active: tab }
    })
}
export const minSplitRatio = 5
export const maxSplitRatio = 95
export function clampSplitRatio(ratio: number): number {
    return Math.max(minSplitRatio, Math.min(maxSplitRatio, ratio))
}
export function resizeSplit(root: WorkspaceNode, id: string, ratio: number): WorkspaceNode {
    if (root.kind === 'pane') return root
    if (root.id === id) return { ...root, ratio: clampSplitRatio(ratio) }
    return { ...root, first: resizeSplit(root.first, id, ratio), second: resizeSplit(root.second, id, ratio) }
}

function mergeTabs(node: WorkspaceNode, pane: WorkspacePane): WorkspaceNode {
    if (node.kind === 'pane') return { ...node, tabs: [...node.tabs, ...pane.tabs], active: node.active ?? pane.active }
    return { ...node, first: mergeTabs(node.first, pane) }
}
export function deletePane(root: WorkspaceNode, id: string): WorkspaceNode {
    if (root.kind === 'pane') return root
    if (root.first.kind === 'pane' && root.first.id === id) return mergeTabs(root.second, root.first)
    if (root.second.kind === 'pane' && root.second.id === id) return mergeTabs(root.first, root.second)
    return { ...root, first: deletePane(root.first, id), second: deletePane(root.second, id) }
}

export function swapSplit(root: WorkspaceNode, id: string): WorkspaceNode {
    if (root.kind === 'pane') return root
    if (root.id === id) return { ...root, ratio: 100 - root.ratio, first: root.second, second: root.first }
    return { ...root, first: swapSplit(root.first, id), second: swapSplit(root.second, id) }
}

export function addTab(root: WorkspaceNode, tab: string, pane: string): WorkspaceNode {
    if (workspaceLayout(root).panes.some(item => item.pane.tabs.includes(tab))) return moveTab(root, tab, pane)
    return updatePane(root, pane, item => ({ ...item, tabs: [...item.tabs, tab], active: tab }))
}

export function closeTab(root: WorkspaceNode, tab: string): WorkspaceNode {
    if (root.kind === 'split') return { ...root, first: closeTab(root.first, tab), second: closeTab(root.second, tab) }
    const tabs = root.tabs.filter(id => id !== tab)
    return { ...root, tabs, active: root.active === tab ? tabs[0] : root.active }
}
