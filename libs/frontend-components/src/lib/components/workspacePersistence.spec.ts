import { expect, it } from 'vitest'
import { restoreWorkspace, saveWorkspace } from './workspacePersistence.js'
import { workspaceLayout } from './tabWorkspace.js'
const tabs = ['Map', 'Market', 'Tiles', 'Actions', 'Players', 'History', 'Chat']
const sidebar = ['Players', 'History', 'Chat']
const initial = { axis: 'horizontal' as const, first: ['Actions'] }
it('round trips order, empty panes, fixed tabs and split percentages without active tabs', () => {
    const saved = { v: 1, sidebar: ['Chat'], main: ['rows', 38, ['Actions', 'History'], ['cols', 62, ['Map', 'Tiles', 'Players'], ['Market']]] }
    const restored = restoreWorkspace(saved, tabs, sidebar, initial)
    expect(saveWorkspace(restored.root, restored.fixed)).toEqual(saved)
    restored.fixed.active = 'anything'
    expect(saveWorkspace(restored.root, restored.fixed)).toEqual(saved)
})
it('drops unknown and duplicate tabs, rejects wrong sidebar tabs, and restores missing tabs', () => {
    const restored = restoreWorkspace({ v: 1, sidebar: ['Map', 'Players', 'Players', 'Alien'], main: ['rows', 500, ['Map', 'Map', 'OldTab'], ['History']] }, tabs, sidebar, initial)
    const panes = workspaceLayout(restored.root).panes
    expect(restored.fixed.tabs).toEqual(['Players', 'Chat'])
    expect(panes.flatMap(p => p.pane.tabs)).toEqual(['Map', 'Market', 'Tiles', 'Actions', 'History'])
    expect(workspaceLayout(restored.root).dividers[0].split.ratio).toBe(80)
})
it('invalid, future-version, overdeep and overfull layouts fall back safely', () => {
    let deep: unknown = []
    for (let i = 0; i < 20; i++) deep = ['rows', 50, [], deep]
    for (const value of [null, {}, 'bad', { v: 2, main: [] }, { v: 1, main: ['rows', NaN, [], []] }, { v: 1, main: ['rows', 50, false, []] }, { v: 1, main: deep }]) {
        const restored = restoreWorkspace(value, tabs, sidebar, initial)
        expect(workspaceLayout(restored.root).panes.map(p => p.pane.tabs)).toEqual([['Actions'], ['Map', 'Market', 'Tiles']])
        expect(restored.fixed.tabs).toEqual(sidebar)
    }
})

it('keeps optional widgets absent by default but restores them when saved', () => {
    const catalog = [...tabs, 'Operating Order']
    const optional = ['Operating Order']
    const initialState = restoreWorkspace(null, catalog, sidebar, initial, optional)
    expect(workspaceLayout(initialState.root).panes.flatMap(p => p.pane.tabs)).not.toContain('Operating Order')
    const restored = restoreWorkspace({ v: 1, sidebar, main: ['Operating Order', 'Map'] }, catalog, sidebar, initial, optional)
    expect(workspaceLayout(restored.root).panes[0].pane.tabs).toContain('Operating Order')
})

it('honors intentional closures but never closes a protected tab during restore', () => {
    const restored = restoreWorkspace({ v: 1, sidebar, main: ['Map'], closed: ['Tiles', 'Actions'] }, tabs, sidebar, initial, [], ['Tiles'])
    const ids = workspaceLayout(restored.root).panes.flatMap(item => item.pane.tabs)
    expect(ids).not.toContain('Tiles')
    expect(ids).toContain('Actions')
    expect(saveWorkspace(restored.root, restored.fixed, ['Tiles']).closed).toEqual(['Tiles'])
})
