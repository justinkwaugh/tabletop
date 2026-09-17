import { expect, it } from 'vitest'
import { createWorkspace, activateTab, deletePane, moveTab, resizeSplit, splitPane, workspaceLayout, type WorkspaceNode } from './tabWorkspace.js'
const initial = (): WorkspaceNode => ({ kind: 'pane', id: 'root', tabs: ['map', 'market', 'sheet', 'tiles'], active: 'map' })
it('allows repeated directions, caps the workspace at six panes, and frees capacity on deletion', () => {
    for (const axis of ['horizontal', 'vertical'] as const) {
        let root = initial()
        for (let i = 0; i < 5; i++) root = splitPane(root, 'root', axis)
        const layout = workspaceLayout(root)
        expect(layout.panes).toHaveLength(6)
        expect(new Set(layout.panes.map(item => item.pane.id)).size).toBe(6)
        expect(new Set(layout.dividers.map(item => item.split.id)).size).toBe(5)
        for (const item of layout.panes) {
            expect(item.available).toEqual([])
            expect(splitPane(root, item.pane.id, axis)).toEqual(root)
        }
        root = deletePane(root, layout.panes[1].pane.id)
        expect(workspaceLayout(root).panes.every(item => item.available.length === 2)).toBe(true)
        root = splitPane(root, 'root', axis)
        expect(workspaceLayout(root).panes).toHaveLength(6)
    }
})
it('moves tabs without losing or duplicating them, allowing empty panes', () => {
    let root = splitPane(initial(), 'root', 'vertical')
    for (const tab of ['map', 'market', 'sheet', 'tiles']) root = moveTab(root, tab, 'root-vertical')
    const panes = workspaceLayout(root).panes
    expect(panes[0].pane.tabs).toEqual([])
    expect(panes[0].pane.active).toBeUndefined()
    expect(panes[1].pane.tabs).toEqual(['map', 'market', 'sheet', 'tiles'])
    root = moveTab(root, 'map', 'root')
    expect(workspaceLayout(root).panes[0].pane.active).toBe('map')
    expect(workspaceLayout(activateTab(root, 'market')).panes[1].pane.active).toBe('market')
})
it('resizes only the chosen split and keeps panes within the workspace', () => {
    let root = splitPane(initial(), 'root', 'vertical')
    root = splitPane(root, 'root', 'horizontal')
    root = resizeSplit(root, 'root-split-horizontal', 95)
    const layout = workspaceLayout(root)
    expect(layout.dividers.map(item => item.split.ratio)).toEqual([50, 80])
    expect(layout.panes.reduce((area, pane) => area + pane.width * pane.height, 0)).toBe(10000)
})
it('reorders tabs within and between panes and appends drops on empty tab-bar space', () => {
    let root = moveTab(initial(), 'tiles', 'root', 'market')
    expect(workspaceLayout(root).panes[0].pane.tabs).toEqual(['map', 'tiles', 'market', 'sheet'])
    root = moveTab(root, 'map', 'root')
    expect(workspaceLayout(root).panes[0].pane.tabs).toEqual(['tiles', 'market', 'sheet', 'map'])
    expect(moveTab(root, 'market', 'root', 'market')).toEqual(activateTab(root, 'market'))
})
it('deletes panes and expands siblings without losing tabs', () => {
    let root = splitPane(initial(), 'root', 'vertical')
    expect(workspaceLayout(deletePane(root, 'root')).panes[0].pane.tabs).toEqual(['map', 'market', 'sheet', 'tiles'])
    root = splitPane(root, 'root-vertical', 'horizontal')
    root = deletePane(root, 'root-vertical')
    expect(workspaceLayout(root).panes).toHaveLength(2)
    root = deletePane(root, 'root-vertical-horizontal')
    expect(root).toEqual(initial())
})

it('merges populated panes into a surviving sibling subtree and cannot delete the last pane', () => {
    let root = splitPane(initial(), 'root', 'vertical')
    root = moveTab(root, 'market', 'root-vertical')
    root = splitPane(root, 'root', 'horizontal')
    root = moveTab(root, 'sheet', 'root-horizontal')
    root = deletePane(root, 'root-vertical')
    expect(workspaceLayout(root).panes.map(item => item.pane.tabs)).toEqual([['map', 'tiles', 'market'], ['sheet']])
    root = deletePane(root, 'root-horizontal')
    expect(workspaceLayout(root).panes[0].pane.tabs).toEqual(['map', 'tiles', 'market', 'sheet'])
    expect(deletePane(root, 'root')).toEqual(root)
})

it('initializes a half split with each tab in exactly one pane and selection preserved', () => {
    const tabs = ['map', 'market', 'sheet', 'tiles', 'actions']
    const layout = workspaceLayout(createWorkspace(tabs, 'map', { axis: 'horizontal', first: ['actions'] }))
    expect(layout.panes.map(item => item.pane.tabs)).toEqual([['actions'], ['map', 'market', 'sheet', 'tiles']])
    expect(layout.panes.map(item => item.pane.active)).toEqual(['actions', 'map'])
    expect(layout.panes.map(item => item.height)).toEqual([50, 50])
    expect(workspaceLayout(createWorkspace(tabs, 'market')).panes[0].pane.active).toBe('market')
})
