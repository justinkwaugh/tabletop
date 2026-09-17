<script lang="ts">
    import { restoreWorkspace, saveWorkspace, type SavedWorkspace } from './workspacePersistence.js'
    import { tick, untrack, type Snippet } from 'svelte'
    import { type WorkspaceInitialSplit, activateTab, deletePane, moveTab, resizeSplit, splitPane, swapSplit, workspaceLayout, type DividerLayout, type WorkspaceNode, type WorkspacePane, type PaneLayout } from './tabWorkspace.js'
    let { tabs, children, selected = $bindable<string>(), label = 'Workspace', splittable = true, initialSplit, fixedPane, tabTitle, savedLayout, onLayoutChange }: {
        tabs: readonly { id: string; label: string; shortLabel?: string }[]
        children: Snippet<[string, boolean]>
        savedLayout?: unknown
        onLayoutChange?: (value: SavedWorkspace) => void
        tabTitle?: Snippet<[string]>
        selected?: string
        label?: string
        fixedPane?: { target: HTMLElement | undefined; tabs: readonly string[]; label: string }
        splittable?: boolean
        initialSplit?: WorkspaceInitialSplit
    } = $props()
    const instanceId = $props.id()
    const initial = untrack(() => restoreWorkspace(savedLayout, tabs.map(tab => tab.id), fixedPane?.tabs ?? [], initialSplit))
    let root: WorkspaceNode = $state(initial.root)
    let fixed: WorkspacePane = $state(initial.fixed)
    let lastLayout = JSON.stringify(saveWorkspace(initial.root, initial.fixed))
    $effect(() => {
        if (resize) return
        const value = saveWorkspace(root, fixed)
        const serialized = JSON.stringify(value)
        if (serialized === lastLayout) return
        lastLayout = serialized
        untrack(() => onLayoutChange?.(value))
    })
    const mainLayout = $derived(workspaceLayout(root))
    const layout = $derived({ ...mainLayout, panes: fixedPane ? [...mainLayout.panes, { pane: fixed, x: 0, y: 0, width: 100, height: 100, available: [] }] : mainLayout.panes })
    function paneLabel(item: PaneLayout) { return item.pane.id === 'fixed' ? fixedPane?.label : `${label} pane ${layout.panes.indexOf(item) + 1}` }
    function mountPane(node: HTMLElement, target: HTMLElement | undefined) {
        const home = node.parentNode
        function move(next: HTMLElement | undefined) { (next ?? home)?.appendChild(node) }
        move(target)
        return { update: move, destroy() { node.remove() } }
    }
    function accepts(tab: string, pane: string) { return pane !== 'fixed' || !!fixedPane?.tabs.includes(tab) }
    function activate(tab: string) {
        root = activateTab(root, tab)
        if (fixed.tabs.includes(tab)) fixed = { ...fixed, active: tab }
    }
    let element: HTMLDivElement
    let dragged: string | undefined = $state()
    let pendingDrop: { tab: string; pane: string; beforeTab?: string } | undefined
    let insertBefore: string | undefined = $state()
    let dropTarget: string | undefined = $state()
    let resize: { id: string; start: number; extent: number; ratio: number; axis: 'horizontal' | 'vertical' } | undefined = $state()
    $effect(() => {
        const tab = selected
        if (tab) untrack(() => activate(tab))
    })
    function select(tab: string) { activate(tab); selected = tab }
    function transfer(tab: string, pane: string, beforeTab?: string) {
        if (!accepts(tab, pane)) return
        const combined = moveTab({ kind: 'split', id: 'transfer', axis: 'vertical', ratio: 50, first: fixed, second: root }, tab, pane, beforeTab)
        if (combined.kind === 'split' && combined.first.kind === 'pane') {
            fixed = combined.first
            root = combined.second
        }
        selected = tab
        void tick().then(() => document.getElementById(`${instanceId}-tab-${tab}`)?.focus())
    }
    function drop(event: DragEvent, pane: string, beforeTab?: string) {
        if (!dragged || !accepts(dragged, pane)) return
        event.preventDefault()
        event.stopPropagation()
        pendingDrop = { tab: dragged, pane, beforeTab }
    }
    function finishDrag() {
        if (pendingDrop) transfer(pendingDrop.tab, pendingDrop.pane, pendingDrop.beforeTab)
        pendingDrop = undefined
        dragged = undefined
        dropTarget = undefined
        insertBefore = undefined
    }
    function dragOver(event: DragEvent, pane: string, beforeTab?: string) {
        if (!dragged || !accepts(dragged, pane)) return
        event.preventDefault()
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
        event.stopPropagation()
        dropTarget = pane
        insertBefore = beforeTab
    }
    function tabKeys(event: KeyboardEvent, paneId: string, tabId: string) {
        const pane = layout.panes.find(item => item.pane.id === paneId)?.pane
        if (!pane) return
        if (splittable && event.altKey && event.shiftKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault()
            const index = layout.panes.findIndex(item => item.pane.id === paneId)
            const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + layout.panes.length) % layout.panes.length
            transfer(tabId, layout.panes[next].pane.id)
            return
        }
        const index = pane.tabs.indexOf(tabId)
        const next = event.key === 'ArrowRight' ? (index + 1) % pane.tabs.length : event.key === 'ArrowLeft'
            ? (index - 1 + pane.tabs.length) % pane.tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? pane.tabs.length - 1 : undefined
        if (next === undefined) return
        event.preventDefault()
        select(pane.tabs[next])
        document.getElementById(`${instanceId}-tab-${pane.tabs[next]}`)?.focus()
    }
    function startResize(event: MouseEvent, divider: DividerLayout) {
        if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) return
        event.preventDefault()
        const rect = element.getBoundingClientRect()
        const vertical = divider.split.axis === 'vertical'
        resize = { id: divider.split.id, axis: divider.split.axis, ratio: divider.split.ratio,
            start: vertical ? event.clientX : event.clientY,
            extent: vertical ? rect.width * divider.width / 100 : rect.height * divider.height / 100 }
        if (event instanceof PointerEvent) event.currentTarget.setPointerCapture(event.pointerId)
    }
    function moveResize(event: MouseEvent) {
        if (!resize) return
        const coordinate = resize.axis === 'vertical' ? event.clientX : event.clientY
        root = resizeSplit(root, resize.id, resize.ratio + (coordinate - resize.start) / resize.extent * 100)
    }
    function endResize(event: MouseEvent) { moveResize(event); resize = undefined }
    function cancelResize() { if (resize) root = resizeSplit(root, resize.id, resize.ratio); resize = undefined }
    function resizeKeys(event: KeyboardEvent, divider: DividerLayout) {
        const { axis, ratio, id } = divider.split
        const next = event.key === (axis === 'vertical' ? 'ArrowLeft' : 'ArrowUp') ? ratio - 2
            : event.key === (axis === 'vertical' ? 'ArrowRight' : 'ArrowDown') ? ratio + 2
            : event.key === 'Home' ? 20 : event.key === 'End' ? 80 : undefined
        if (next === undefined) return
        event.preventDefault(); root = resizeSplit(root, id, next)
    }
</script>

<svelte:window onmousemove={moveResize} onmouseup={endResize} onblur={cancelResize} />

<div class="workspace" aria-label={label} bind:this={element}>
    {#snippet paneHeader(item: PaneLayout)}
        <section class="pane" class:fixed={item.pane.id === 'fixed'} class:drop-target={dropTarget === item.pane.id}
            aria-label={paneLabel(item)}
            use:mountPane={item.pane.id === 'fixed' ? fixedPane?.target : undefined}
            style:left={`${item.x}%`} style:top={`${item.y}%`} style:width={`${item.width}%`} style:height={`${item.height}%`}
            ondragover={(event) => dragOver(event, item.pane.id)} ondrop={(event) => drop(event, item.pane.id)}>
            <header>
                <div class="tabs" role="tablist" aria-label={item.pane.id === 'fixed' ? `${fixedPane?.label} tabs` : `${label} tabs ${layout.panes.indexOf(item) + 1}`}>
                    {#each item.pane.tabs as id (id)}
                        {@const tab = tabs.find(tab => tab.id === id)}
                        <button class:insert-before={insertBefore === id && dragged !== id} role="tab" id={`${instanceId}-tab-${id}`} aria-selected={item.pane.active === id}
                            aria-controls={`${instanceId}-panel-${id}`} tabindex={item.pane.active === id ? 0 : -1}
                            draggable={splittable} onclick={() => select(id)} onkeydown={(event) => tabKeys(event, item.pane.id, id)}
                            title={splittable ? "Drag to reorder or move to another pane; Alt+Shift+Left/Right moves between panes" : undefined}
                            ondragover={(event) => dragOver(event, item.pane.id, id)} ondrop={(event) => drop(event, item.pane.id, id)}
                            ondragstart={(event) => { dragged = id; if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id) } }}
                            ondragend={finishDrag}>
                            {#if tabTitle}{@render tabTitle(id)}{/if}<span class:has-short={!!tab?.shortLabel}>{tab?.label}</span>{#if tab?.shortLabel}<span class="short-label">{tab.shortLabel}</span>{/if}
                        </button>
                    {/each}
                </div>
                {#if splittable && item.pane.id !== 'fixed'}<div class="split-controls">
                    {#if mainLayout.panes.length > 1}
                        <button class="split-button" aria-label={`Delete pane ${layout.panes.indexOf(item) + 1}`} title="Delete pane"
                            onclick={() => { root = deletePane(root, item.pane.id); if (selected) root = activateTab(root, selected) }}>
                            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
                        </button>
                    {/if}
                    {#each ['horizontal', 'vertical'] as const as axis}
                        <button class="split-button" aria-label={`Split pane ${layout.panes.indexOf(item) + 1} ${axis === 'horizontal' ? 'horizontally' : 'vertically'}`}
                            title={axis === 'horizontal' ? 'Split top and bottom' : 'Split left and right'} disabled={!item.available.includes(axis)}
                            onclick={() => root = splitPane(root, item.pane.id, axis)}>
                            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2" y="3" width="16" height="14" rx="1" />{#if axis === 'horizontal'}<path d="M2 10h16" />{:else}<path d="M10 3v14" />{/if}</svg>
                        </button>
                    {/each}
                </div>{/if}
            </header>
            {#if !item.pane.tabs.length}<div class="empty">Drag a tab here</div>{/if}
        </section>
    {/snippet}
    {#each mainLayout.panes as item (item.pane.id)}{@render paneHeader(item)}{/each}
    {#if fixedPane}{@render paneHeader({ pane: fixed, x: 0, y: 0, width: 100, height: 100, available: [] })}{/if}
    {#each tabs as tab (tab.id)}
        {@const item = layout.panes.find(item => item.pane.tabs.includes(tab.id))}
        {#if item}
            <div use:mountPane={item.pane.id === 'fixed' ? fixedPane?.target : undefined} class="panel" class:inactive={item.pane.active !== tab.id} class:drop-target={dropTarget === item.pane.id}
                role="tabpanel" id={`${instanceId}-panel-${tab.id}`} aria-labelledby={`${instanceId}-tab-${tab.id}`}
                aria-hidden={item.pane.active !== tab.id} inert={item.pane.active !== tab.id} tabindex="0"
                style:left={`${item.x}%`} style:top={`calc(${item.y}% + var(--workspace-header-height))`} style:width={`${item.width}%`} style:height={`calc(${item.height}% - var(--workspace-header-height))`}
                ondragover={(event) => dragOver(event, item.pane.id)} ondrop={(event) => drop(event, item.pane.id)}>
                {@render children(tab.id, item.pane.active === tab.id)}
            </div>
        {/if}
    {/each}
    {#each layout.dividers as item (item.split.id)}
        {@const vertical = item.split.axis === 'vertical'}
        <div class="divider" class:vertical role="separator" tabindex="0" aria-label={`Resize ${item.split.axis} split`}
            aria-orientation={item.split.axis} aria-valuemin="20" aria-valuemax="80" aria-valuenow={Math.round(item.split.ratio)}
            style:left={vertical ? `calc(${item.x + item.width * item.split.ratio / 100}% - 4px)` : `${item.x}%`}
            style:top={vertical ? `${item.y}%` : `calc(${item.y + item.height * item.split.ratio / 100}% - 4px)`}
            style:width={vertical ? '8px' : `${item.width}%`} style:height={vertical ? `${item.height}%` : '8px'}
            onmousedown={(event) => startResize(event, item)}
            onpointerdown={(event) => { if (event.pointerType !== 'mouse') startResize(event, item) }}
            onpointermove={(event) => { if (event.pointerType !== 'mouse') moveResize(event) }}
            onpointerup={(event) => { if (event.pointerType !== 'mouse') endResize(event) }}
            onpointercancel={cancelResize} onlostpointercapture={cancelResize} onkeydown={(event) => resizeKeys(event, item)}></div>
        <button class="swap-sides" title="Swap sides" aria-label={`Swap sides of ${item.split.axis} split`}
            style:left={vertical ? `calc(${item.x + item.width * item.split.ratio / 100}% - 12px)` : `calc(${item.x + item.width / 2}% - 12px)`}
            style:top={vertical ? `calc(${item.y + item.height / 2}% - 12px)` : `calc(${item.y + item.height * item.split.ratio / 100}% - 12px)`}
            onclick={() => root = swapSplit(root, item.split.id)}>
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" style:transform={vertical ? undefined : 'rotate(90deg)'}><path d="M3 6h14m-4-4 4 4-4 4M17 14H3m4-4-4 4 4 4"/></svg>
        </button>
    {/each}
</div>

<style>
    .workspace { --workspace-header-height: 35px; position: relative; flex: 1; min-width: 0; min-height: 160px; height: 100%; color: var(--workspace-text, var(--rail-text, #443c34)); }
    .pane, .panel { position: absolute; box-sizing: border-box; min-width: 0; min-height: 0; }
    .pane { display: flex; flex-direction: column; }
    header { height: var(--workspace-header-height); flex: none; display: flex; align-items: center; border-bottom: 1px solid var(--workspace-border, var(--rail-border, #d2c5b7)); box-sizing: border-box; }
    .tabs { display: flex; flex: 1; min-width: 0; gap: 24px; padding: 0 16px; overflow-x: auto; scrollbar-width: thin; }
    button { background: transparent; color: inherit; font: inherit; cursor: pointer; }
    [role='tab'] { display: inline-flex; align-items: center; gap: 6px; flex: none; height: 34px; padding: 8px 0 6px; border: 0; border-bottom: 2px solid transparent; color: var(--workspace-muted, var(--rail-inactive, #938371)); font-size: 11px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
    [role='tab'][aria-selected='true'] { color: var(--workspace-text, var(--rail-text, #5e4937)); border-bottom-color: var(--workspace-focus, var(--rail-focus, #7c634b)); }
    button:hover:enabled { color: var(--workspace-text, var(--rail-text, #5e4937)); }
    [role='tab'].insert-before { box-shadow: -2px 0 var(--workspace-focus, var(--rail-focus, #7c634b)); }
    .pane.fixed .tabs { gap: 12px; padding-inline: 8px; }
    .split-controls { display: flex; flex: none; padding: 0 8px; gap: 4px; }
    .split-button { display: grid; place-items: center; width: 24px; height: 24px; border: 0; border-radius: 3px; color: var(--workspace-muted, var(--rail-muted, #887969)); }
    .split-button:hover:enabled { background: var(--workspace-hover, var(--rail-hover, #69554016)); }
    .split-button:disabled { opacity: .25; cursor: default; }
    svg { fill: none; stroke: currentColor; stroke-width: 1.4; }
    .panel { overflow: hidden; }
    .panel.inactive { visibility: hidden; pointer-events: none; }
    .empty { flex: 1; display: grid; place-items: center; color: var(--workspace-muted, var(--rail-muted, #887969)); font-size: 13px; }
    .drop-target { outline: 2px dashed var(--workspace-focus, var(--rail-focus, #7c634b)); outline-offset: -4px; }
    .swap-sides { opacity: 0; pointer-events: none; position: absolute; z-index: 5; display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 1px solid var(--rail-border, #d2c5b7); border-radius: 5px; background: var(--rail-surface, #faf7f2); color: var(--rail-muted, #887969); }
    .divider:hover + .swap-sides, .divider:focus + .swap-sides, .swap-sides:hover, .swap-sides:focus-visible { opacity: 1; pointer-events: auto; }
    .divider { position: absolute; z-index: 4; cursor: row-resize; touch-action: none; }
    .divider.vertical { cursor: col-resize; }
    .divider::after { content: ''; position: absolute; top: 3px; left: 0; right: 0; height: 1px; background: var(--workspace-border, var(--rail-border, #d2c5b7)); }
    .divider.vertical::after { left: 3px; top: 0; bottom: 0; width: 1px; height: auto; }
    .divider:hover::after, .divider:focus-visible::after { background: var(--workspace-focus, var(--rail-focus, #7c634b)); }
    button:focus-visible, .divider:focus-visible { outline: 2px solid var(--workspace-focus, var(--rail-focus, #7c634b)); outline-offset: -2px; }
    .short-label { display: none; }
    @media (width < 640px) { .has-short { display: none; } .short-label { display: inline; } .tabs { gap: 16px; padding-inline: 8px; } }
</style>
