<script lang="ts">
    import type { WorkspaceTab, WorkspaceFixedPane } from './workspaceTypes.js'
    import {
        initialSidebarTabs,
        restoreWorkspaceTabs,
        saveWorkspace,
        type SavedWorkspace,
        type InitialWorkspace
    } from './workspacePersistence.js'
    import { tick, untrack, type Snippet } from 'svelte'
    import { chainSidewaysScroll } from '../utils/scrollChain.js'
    import {
        type WorkspaceInitialSplit,
        activateTab,
        closeTab,
        addTab,
        deletePane,
        mergeTabs,
        maxSplitRatio,
        minSplitRatio,
        moveTab,
        moveTabToIndex,
        orderPaneTabs,
        tabDragIndex,
        tabDragShift,
        withdrawTabs,
        type TabDrag,
        resizeSplit,
        splitPane,
        swapSplit,
        workspaceLayout,
        type DividerLayout,
        type WorkspaceNode,
        type WorkspacePane,
        type PaneLayout
    } from './tabWorkspace.js'
    let {
        tabs,
        children,
        selected = $bindable<string | undefined>(),
        label = 'Workspace',
        splittable = true,
        initialSplit,
        initialLayout,
        fixedPane,
        tabTitle,
        savedLayout,
        onLayoutChange,
        fixedPaneDeleted = $bindable(false)
    }: {
        tabs: readonly WorkspaceTab[]
        children: Snippet<[string, boolean]>
        savedLayout?: unknown
        onLayoutChange?: (value: SavedWorkspace) => void
        tabTitle?: Snippet<[string]>
        selected?: string
        label?: string
        fixedPane?: WorkspaceFixedPane
        splittable?: boolean
        initialSplit?: WorkspaceInitialSplit
        initialLayout?: InitialWorkspace
        fixedPaneDeleted?: boolean
    } = $props()
    const instanceId = $props.id()
    const closableTabs = $derived(tabs.filter((tab) => tab.closable !== false).map((tab) => tab.id))
    const recordedClosableTabs = $derived(
        closableTabs.filter((id) => !tabs.find((tab) => tab.id === id)?.optional)
    )
    const initial = untrack(() =>
        restoreWorkspaceTabs(savedLayout, tabs, fixedPane?.tabs, initialSplit, initialLayout)
    )
    let root: WorkspaceNode = $state(initial.root)
    let fixed: WorkspacePane = $state(initial.fixed)
    fixedPaneDeleted = untrack(() => initial.fixedPaneDeleted && !!fixedPane?.deletable)
    let lastLayout = JSON.stringify(
        saveWorkspace(
            initial.root,
            fixedPaneDeleted ? undefined : initial.fixed,
            recordedClosableTabs
        )
    )
    $effect(() => {
        if (resize) return
        const value = saveWorkspace(
            root,
            fixedPaneDeleted ? undefined : fixed,
            recordedClosableTabs
        )
        const serialized = JSON.stringify(value)
        if (serialized === lastLayout) return
        lastLayout = serialized
        untrack(() => onLayoutChange?.(value))
    })
    const mainLayout = $derived(workspaceLayout(root))
    const shownFixedPane = $derived(fixedPaneDeleted ? undefined : fixedPane)
    const layout = $derived({
        ...mainLayout,
        panes: shownFixedPane
            ? [
                  ...mainLayout.panes,
                  { pane: fixed, x: 0, y: 0, width: 100, height: 100, available: [] }
              ]
            : mainLayout.panes
    })
    function paneLabel(item: PaneLayout) {
        return item.pane.id === 'fixed'
            ? fixedPane?.label
            : `${label} pane ${layout.panes.indexOf(item) + 1}`
    }
    function mountPane(node: HTMLElement, target: HTMLElement | undefined) {
        const home = node.parentNode
        // Re-inserting a panel resets every scroll position inside it.
        function move(next: HTMLElement | undefined) {
            const parent = next ?? home
            if (parent && node.parentNode !== parent) parent.appendChild(node)
        }
        move(target)
        return {
            update: move,
            destroy() {
                node.remove()
            }
        }
    }
    function availableTabs(pane: string) {
        return tabs.filter(
            (tab) =>
                accepts(tab.id, pane) &&
                !layout.panes.some((item) => item.pane.tabs.includes(tab.id))
        )
    }
    function accepts(tab: string, pane: string) {
        return pane !== 'fixed' || !!fixedPane?.tabs.includes(tab)
    }
    function activate(tab: string) {
        root = activateTab(root, tab)
        if (fixed.tabs.includes(tab)) fixed = { ...fixed, active: tab }
    }
    let element: HTMLDivElement
    const menuWidth = 180
    const menuGap = 4
    const windowMargin = 8
    let menuButton: HTMLElement | undefined
    let menuPosition = $state({ top: 'auto', bottom: 'auto', right: '0', maxHeight: '70dvh' })
    function placeMenuOnRoomierSide(button: HTMLElement) {
        menuButton = button
        const rect = button.getBoundingClientRect()
        const right = `${Math.max(windowMargin, window.innerWidth - Math.max(menuWidth + windowMargin, rect.right))}px`
        const below = window.innerHeight - rect.bottom
        const maxHeight = `min(70dvh, ${Math.max(below, rect.top) - menuGap - windowMargin}px)`
        menuPosition =
            below >= rect.top
                ? { top: `${rect.bottom + menuGap}px`, bottom: 'auto', right, maxHeight }
                : {
                      top: 'auto',
                      bottom: `${window.innerHeight - rect.top + menuGap}px`,
                      right,
                      maxHeight
                  }
    }
    function placeOpenMenu() {
        if (menuButton) placeMenuOnRoomierSide(menuButton)
    }
    let dragged: string | undefined = $state()
    let pendingDrop: { tab: string; pane: string; beforeTab?: string } | undefined
    let insertBefore: string | undefined = $state()
    let dropTarget: string | undefined = $state()
    let resize:
        | {
              id: string
              start: number
              extent: number
              ratio: number
              axis: 'horizontal' | 'vertical'
          }
        | undefined = $state()
    $effect(() => {
        const tab = selected
        if (tab) untrack(() => activate(tab))
    })
    function select(tab: string) {
        activate(tab)
        selected = tab
    }
    function transfer(tab: string, pane: string, beforeTab?: string) {
        if (!accepts(tab, pane)) return
        const combined = moveTab(
            {
                kind: 'split',
                id: 'transfer',
                axis: 'vertical',
                ratio: 50,
                first: fixed,
                second: root
            },
            tab,
            pane,
            beforeTab
        )
        if (combined.kind === 'split' && combined.first.kind === 'pane') {
            fixed = combined.first
            root = combined.second
        }
        selected = tab
        void tick().then(() =>
            document.getElementById(`${instanceId}-tab-${encodeURIComponent(tab)}`)?.focus()
        )
    }
    function deleteFixedPane() {
        root = mergeTabs(root, fixed)
        fixed = { ...fixed, tabs: [], active: undefined }
        fixedPaneDeleted = true
    }
    function restoreFixedPane(pane: WorkspaceFixedPane) {
        const returning = withdrawTabs(
            root,
            initialSidebarTabs(pane.tabs, initialLayout).filter((tab) => accepts(tab, 'fixed'))
        )
        root = returning.root
        fixed = { ...fixed, tabs: returning.withdrawn, active: returning.withdrawn[0] }
        fixedPaneDeleted = false
    }
    let drag: (TabDrag & { pane: string; startY: number }) | undefined = $state()
    function dragShift(pane: string, tab: string) {
        return drag?.pane === pane ? tabDragShift(drag, tab) : 0
    }
    function orderTabs(pane: string, order: readonly string[]) {
        if (pane === 'fixed') fixed = { ...fixed, tabs: [...order] }
        else root = orderPaneTabs(root, pane, order)
    }
    function startDrag(event: PointerEvent, pane: WorkspacePane, tab: string) {
        const grip = event.currentTarget
        const row = grip instanceof HTMLElement ? grip.parentElement : null
        if (!(grip instanceof HTMLElement) || !row || event.button !== 0) return
        event.preventDefault()
        grip.setPointerCapture(event.pointerId)
        drag = {
            pane: pane.id,
            tab,
            tabs: pane.tabs,
            startY: event.clientY,
            rowHeight: row.getBoundingClientRect().height,
            offset: 0
        }
    }
    function moveDrag(event: PointerEvent) {
        if (drag) drag = { ...drag, offset: event.clientY - drag.startY }
    }
    function dropDrag() {
        if (!drag) return
        const index = tabDragIndex(drag)
        if (index !== drag.tabs.indexOf(drag.tab))
            orderTabs(drag.pane, moveTabToIndex(drag.tabs, drag.tab, index))
        drag = undefined
    }
    function reorderKeys(event: KeyboardEvent, pane: WorkspacePane, tab: string) {
        const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
        const index = pane.tabs.indexOf(tab) + step
        if (!step || index < 0 || index >= pane.tabs.length) return
        event.preventDefault()
        const grip = event.currentTarget
        orderTabs(pane.id, moveTabToIndex(pane.tabs, tab, index))
        if (grip instanceof HTMLElement) void tick().then(() => grip.focus())
    }
    function removeTab(tab: string) {
        if (!closableTabs.includes(tab)) return
        root = closeTab(root, tab)
        const next = closeTab(fixed, tab)
        if (next.kind === 'pane') fixed = next
        if (selected === tab) selected = undefined
    }
    function addWidget(tab: string, pane: string) {
        if (layout.panes.some((item) => item.pane.tabs.includes(tab))) transfer(tab, pane)
        else {
            if (pane === 'fixed') {
                const next = addTab(fixed, tab, pane)
                if (next.kind === 'pane') fixed = next
            } else root = addTab(root, tab, pane)
            selected = tab
        }
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
        const pane = layout.panes.find((item) => item.pane.id === paneId)?.pane
        if (!pane) return
        if (
            splittable &&
            event.altKey &&
            event.shiftKey &&
            ['ArrowLeft', 'ArrowRight'].includes(event.key)
        ) {
            event.preventDefault()
            const index = layout.panes.findIndex((item) => item.pane.id === paneId)
            const next =
                (index + (event.key === 'ArrowRight' ? 1 : -1) + layout.panes.length) %
                layout.panes.length
            transfer(tabId, layout.panes[next].pane.id)
            return
        }
        const index = pane.tabs.indexOf(tabId)
        const next =
            event.key === 'ArrowRight'
                ? (index + 1) % pane.tabs.length
                : event.key === 'ArrowLeft'
                  ? (index - 1 + pane.tabs.length) % pane.tabs.length
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? pane.tabs.length - 1
                      : undefined
        if (next === undefined) return
        event.preventDefault()
        select(pane.tabs[next])
        document.getElementById(`${instanceId}-tab-${encodeURIComponent(pane.tabs[next])}`)?.focus()
    }
    const minPaneSize = 100
    function startResize(event: MouseEvent, divider: DividerLayout) {
        if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) return
        event.preventDefault()
        const rect = element.getBoundingClientRect()
        const vertical = divider.split.axis === 'vertical'
        resize = {
            id: divider.split.id,
            axis: divider.split.axis,
            ratio: divider.split.ratio,
            start: vertical ? event.clientX : event.clientY,
            extent: vertical
                ? (rect.width * divider.width) / 100
                : (rect.height * divider.height) / 100
        }
        if (event instanceof PointerEvent) event.currentTarget.setPointerCapture(event.pointerId)
    }
    function moveResize(event: MouseEvent) {
        if (!resize) return
        const coordinate = resize.axis === 'vertical' ? event.clientX : event.clientY
        const minRatio = (minPaneSize / resize.extent) * 100
        const ratio = resize.ratio + ((coordinate - resize.start) / resize.extent) * 100
        root = resizeSplit(root, resize.id, Math.max(minRatio, Math.min(100 - minRatio, ratio)))
    }
    function endResize(event: MouseEvent) {
        moveResize(event)
        resize = undefined
    }
    function cancelResize() {
        if (resize) root = resizeSplit(root, resize.id, resize.ratio)
        resize = undefined
    }
    function resizeKeys(event: KeyboardEvent, divider: DividerLayout) {
        const { axis, ratio, id } = divider.split
        const next =
            event.key === (axis === 'vertical' ? 'ArrowLeft' : 'ArrowUp')
                ? ratio - 2
                : event.key === (axis === 'vertical' ? 'ArrowRight' : 'ArrowDown')
                  ? ratio + 2
                  : event.key === 'Home'
                    ? minSplitRatio
                    : event.key === 'End'
                      ? maxSplitRatio
                      : undefined
        if (next === undefined) return
        event.preventDefault()
        root = resizeSplit(root, id, next)
    }
</script>

<svelte:window
    onmousemove={moveResize}
    onmouseup={endResize}
    onblur={cancelResize}
    onresize={placeOpenMenu}
/>

<div class="workspace" aria-label={label} bind:this={element}>
    {#snippet paneHeader(item: PaneLayout)}
        {@const menuId = `${instanceId}-menu-${item.pane.id}`}
        {@const paneSplits = splittable && item.pane.id !== 'fixed'}
        {@const restorableFixedPane =
            fixedPaneDeleted && item.pane.id !== 'fixed' ? fixedPane : undefined}
        {@const deletableFixedPane =
            item.pane.id === 'fixed' && fixedPane?.deletable ? fixedPane : undefined}
        {@const paneActions = paneSplits || !!restorableFixedPane}
        <section
            class="pane"
            class:fixed={item.pane.id === 'fixed'}
            class:drop-target={dropTarget === item.pane.id}
            aria-label={paneLabel(item)}
            use:mountPane={item.pane.id === 'fixed' ? fixedPane?.target : undefined}
            style:left={`${item.x}%`}
            style:top={`${item.y}%`}
            style:width={`${item.width}%`}
            style:height={`${item.height}%`}
            ondragover={(event) => dragOver(event, item.pane.id)}
            ondrop={(event) => drop(event, item.pane.id)}
        >
            <header>
                <div
                    class="tabs"
                    role="tablist"
                    {@attach chainSidewaysScroll}
                    aria-label={item.pane.id === 'fixed'
                        ? `${fixedPane?.label} tabs`
                        : `${label} tabs ${layout.panes.indexOf(item) + 1}`}
                >
                    {#each item.pane.tabs as id (id)}
                        {@const tab = tabs.find((tab) => tab.id === id)}
                        <button
                            class:insert-before={insertBefore === id && dragged !== id}
                            role="tab"
                            id={`${instanceId}-tab-${encodeURIComponent(id)}`}
                            aria-selected={item.pane.active === id}
                            aria-controls={`${instanceId}-panel-${encodeURIComponent(id)}`}
                            tabindex={item.pane.active === id ? 0 : -1}
                            draggable={splittable}
                            onclick={() => select(id)}
                            onkeydown={(event) => tabKeys(event, item.pane.id, id)}
                            title={splittable
                                ? 'Drag to reorder or move to another pane; Alt+Shift+Left/Right moves between panes'
                                : undefined}
                            ondragover={(event) => dragOver(event, item.pane.id, id)}
                            ondrop={(event) => drop(event, item.pane.id, id)}
                            ondragstart={(event) => {
                                dragged = id
                                if (event.dataTransfer) {
                                    event.dataTransfer.effectAllowed = 'move'
                                    event.dataTransfer.setData('text/plain', id)
                                }
                            }}
                            ondragend={finishDrag}
                        >
                            {#if tabTitle}{@render tabTitle(id)}{/if}<span
                                class:has-short={!!tab?.shortLabel}>{tab?.label}</span
                            >{#if tab?.shortLabel}<span class="short-label">{tab.shortLabel}</span
                                >{/if}
                        </button>
                    {/each}
                </div>
                {#if paneActions || deletableFixedPane || item.pane.tabs.length || availableTabs(item.pane.id).length}<div
                        class="split-controls"
                    >
                        <button
                            class="split-button"
                            aria-label={`Pane options for ${paneLabel(item)}`}
                            title="Pane options"
                            popovertarget={menuId}
                            onclick={(event) => placeMenuOnRoomierSide(event.currentTarget)}
                        >
                            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"
                                ><path
                                    d="M4 9v2m6-2v2m6-2v2"
                                    stroke-width="3"
                                    stroke-linecap="round"
                                ></path></svg
                            >
                        </button>
                        <div
                            class="widget-menu"
                            id={menuId}
                            popover
                            style:top={menuPosition.top}
                            style:bottom={menuPosition.bottom}
                            style:right={menuPosition.right}
                            style:max-height={menuPosition.maxHeight}
                            ontoggle={(event) => {
                                if (event.newState !== 'closed') return
                                menuButton = undefined
                                drag = undefined
                            }}
                        >
                            {#if restorableFixedPane}
                                <div class="pane-actions">
                                    <!-- Adding unmounts this button before popovertargetaction would run, so close the menu first. -->
                                    <button
                                        aria-label={`Add ${restorableFixedPane.label} pane`}
                                        title="Split left / right"
                                        onclick={(event) => {
                                            event.currentTarget
                                                .closest<HTMLElement>('[popover]')
                                                ?.hidePopover()
                                            restoreFixedPane(restorableFixedPane)
                                        }}
                                    >
                                        <svg
                                            viewBox="0 0 20 20"
                                            width="18"
                                            height="18"
                                            aria-hidden="true"
                                            ><rect x="2" y="3" width="16" height="14" rx="1"
                                            ></rect><path d="M10 3v14"></path></svg
                                        >
                                    </button>
                                </div>
                            {:else if paneSplits}
                                <div class="pane-actions">
                                    {#each ['horizontal', 'vertical'] as const as axis (axis)}
                                        <button
                                            aria-label={`Split pane ${layout.panes.indexOf(item) + 1} ${axis === 'horizontal' ? 'horizontally' : 'vertically'}`}
                                            title={axis === 'horizontal'
                                                ? 'Split top / bottom'
                                                : 'Split left / right'}
                                            disabled={!item.available.includes(axis)}
                                            popovertarget={menuId}
                                            popovertargetaction="hide"
                                            onclick={() =>
                                                (root = splitPane(root, item.pane.id, axis))}
                                        >
                                            <svg
                                                viewBox="0 0 20 20"
                                                width="18"
                                                height="18"
                                                aria-hidden="true"
                                                ><rect x="2" y="3" width="16" height="14" rx="1"
                                                ></rect>{#if axis === 'horizontal'}<path
                                                        d="M2 10h16"
                                                    ></path>{:else}<path d="M10 3v14"
                                                    ></path>{/if}</svg
                                            >
                                        </button>
                                    {/each}
                                </div>
                            {/if}
                            {#if item.pane.tabs.length}{#if paneActions}<hr />{/if}
                                <strong>Current tabs</strong>
                                {#each item.pane.tabs as id (id)}
                                    {@const tabLabel = tabs.find((tab) => tab.id === id)?.label}
                                    <div
                                        class="existing-tab"
                                        class:dragging={drag?.pane === item.pane.id &&
                                            drag.tab === id}
                                        class:reordering={drag?.pane === item.pane.id}
                                        style:transform={drag?.pane === item.pane.id
                                            ? `translateY(${dragShift(item.pane.id, id)}px)`
                                            : undefined}
                                    >
                                        {#if !splittable && item.pane.tabs.length > 1}<button
                                                class="reorder-tab"
                                                aria-label={`Move ${tabLabel} tab`}
                                                title="Drag to reorder; Arrow Up/Down moves"
                                                onpointerdown={(event) =>
                                                    startDrag(event, item.pane, id)}
                                                onpointermove={moveDrag}
                                                onpointerup={dropDrag}
                                                onpointercancel={() => (drag = undefined)}
                                                onlostpointercapture={() => (drag = undefined)}
                                                onkeydown={(event) =>
                                                    reorderKeys(event, item.pane, id)}
                                                ><svg
                                                    viewBox="0 0 20 20"
                                                    width="14"
                                                    height="14"
                                                    aria-hidden="true"
                                                    ><path
                                                        d="M7 5h.01M13 5h.01M7 10h.01M13 10h.01M7 15h.01M13 15h.01"
                                                    ></path></svg
                                                ></button
                                            >{/if}
                                        <span class="tab-label">{tabLabel}</span>
                                        {#if closableTabs.includes(id)}<button
                                                class="close-tab"
                                                aria-label={`Close ${id} tab`}
                                                title="Close tab"
                                                onclick={() => removeTab(id)}
                                                ><svg
                                                    viewBox="0 0 20 20"
                                                    width="14"
                                                    height="14"
                                                    aria-hidden="true"
                                                    ><path d="m5 5 10 10M15 5 5 15"></path></svg
                                                ></button
                                            >{/if}
                                    </div>
                                {/each}
                            {/if}
                            {#if availableTabs(item.pane.id).length}{#if paneActions || item.pane.tabs.length}<hr
                                    />{/if}
                                <strong>Add tabs</strong>
                                {#each availableTabs(item.pane.id) as tab (tab.id)}
                                    <!-- Adding unmounts this button before popovertargetaction would run, so close the menu first. -->
                                    <button
                                        class="add-tab"
                                        onclick={(event) => {
                                            event.currentTarget
                                                .closest<HTMLElement>('[popover]')
                                                ?.hidePopover()
                                            addWidget(tab.id, item.pane.id)
                                        }}
                                    >
                                        {tab.label}
                                    </button>
                                {/each}
                            {/if}
                            {#if deletableFixedPane}{#if item.pane.tabs.length || availableTabs(item.pane.id).length}<hr
                                    />{/if}
                                <button
                                    class="delete-pane"
                                    aria-label={`Delete ${deletableFixedPane.label} pane`}
                                    onclick={deleteFixedPane}
                                >
                                    Delete pane
                                </button>
                            {/if}
                            {#if paneSplits && mainLayout.panes.length > 1}<hr />
                                <button
                                    class="delete-pane"
                                    aria-label={`Delete pane ${layout.panes.indexOf(item) + 1}`}
                                    onclick={() => {
                                        root = deletePane(root, item.pane.id)
                                        if (selected) root = activateTab(root, selected)
                                    }}
                                >
                                    Delete pane
                                </button>
                            {/if}
                        </div>
                    </div>{/if}
            </header>
            {#if !item.pane.tabs.length}<div class="empty">
                    {splittable ? 'Drag a tab here' : 'Add a tab from the pane menu'}
                </div>{/if}
        </section>
    {/snippet}
    {#each mainLayout.panes as item (item.pane.id)}{@render paneHeader(item)}{/each}
    {#if shownFixedPane}{@render paneHeader({
            pane: fixed,
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            available: []
        })}{/if}
    {#each tabs as tab (tab.id)}
        {@const item = layout.panes.find((item) => item.pane.tabs.includes(tab.id))}
        {#if item}
            <div
                use:mountPane={item.pane.id === 'fixed' ? fixedPane?.target : undefined}
                class="panel"
                class:inactive={item.pane.active !== tab.id}
                class:drop-target={dropTarget === item.pane.id}
                role="tabpanel"
                id={`${instanceId}-panel-${encodeURIComponent(tab.id)}`}
                aria-labelledby={`${instanceId}-tab-${encodeURIComponent(tab.id)}`}
                aria-hidden={item.pane.active !== tab.id}
                inert={item.pane.active !== tab.id}
                tabindex="0"
                style:left={`${item.x}%`}
                style:top={`calc(${item.y}% + var(--workspace-header-height))`}
                style:width={`${item.width}%`}
                style:height={`calc(${item.height}% - var(--workspace-header-height))`}
                ondragover={(event) => dragOver(event, item.pane.id)}
                ondrop={(event) => drop(event, item.pane.id)}
            >
                {@render children(tab.id, item.pane.active === tab.id)}
            </div>
        {/if}
    {/each}
    {#each layout.dividers as item (item.split.id)}
        {@const vertical = item.split.axis === 'vertical'}
        <div
            class="divider"
            class:vertical
            role="separator"
            tabindex="0"
            aria-label={`Resize ${item.split.axis} split`}
            aria-orientation={item.split.axis}
            aria-valuemin={minSplitRatio}
            aria-valuemax={maxSplitRatio}
            aria-valuenow={Math.round(item.split.ratio)}
            style:left={vertical
                ? `calc(${item.x + (item.width * item.split.ratio) / 100}% - 4px)`
                : `${item.x}%`}
            style:top={vertical
                ? `${item.y}%`
                : `calc(${item.y + (item.height * item.split.ratio) / 100}% - 4px)`}
            style:width={vertical ? '8px' : `${item.width}%`}
            style:height={vertical ? `${item.height}%` : '8px'}
            onmousedown={(event) => startResize(event, item)}
            onpointerdown={(event) => {
                if (event.pointerType !== 'mouse') startResize(event, item)
            }}
            onpointermove={(event) => {
                if (event.pointerType !== 'mouse') moveResize(event)
            }}
            onpointerup={(event) => {
                if (event.pointerType !== 'mouse') endResize(event)
            }}
            onpointercancel={cancelResize}
            onlostpointercapture={cancelResize}
            onkeydown={(event) => resizeKeys(event, item)}
        ></div>
        <button
            class="swap-sides"
            title="Swap sides"
            aria-label={`Swap sides of ${item.split.axis} split`}
            style:left={vertical
                ? `calc(${item.x + (item.width * item.split.ratio) / 100}% - 12px)`
                : `calc(${item.x + item.width / 2}% - 12px)`}
            style:top={vertical
                ? `calc(${item.y + item.height / 2}% - 12px)`
                : `calc(${item.y + (item.height * item.split.ratio) / 100}% - 12px)`}
            onclick={() => (root = swapSplit(root, item.split.id))}
        >
            <svg
                viewBox="0 0 20 20"
                width="16"
                height="16"
                aria-hidden="true"
                style:transform={vertical ? undefined : 'rotate(90deg)'}
                ><path d="M3 6h14m-4-4 4 4-4 4M17 14H3m4-4-4 4 4 4"></path></svg
            >
        </button>
    {/each}
</div>

<style>
    .workspace {
        position: relative;
        flex: 1;
        min-width: 0;
        min-height: 160px;
        height: 100%;
        color: var(--workspace-text, #374151);
    }
    /* Fixed-pane parts mount outside .workspace, so they carry the header height themselves. */
    .pane,
    .panel {
        --workspace-header-height: 35px;
        position: absolute;
        box-sizing: border-box;
        min-width: 0;
        min-height: 0;
    }
    .pane {
        z-index: 1;
        display: flex;
        flex-direction: column;
    }
    header {
        height: var(--workspace-header-height);
        flex: none;
        display: flex;
        align-items: center;
        border-bottom: 1px solid var(--workspace-border, #d1d5db);
        box-sizing: border-box;
    }
    .tabs {
        display: flex;
        flex: 1;
        min-width: 0;
        gap: 24px;
        padding: 0 16px;
        overflow-x: auto;
        scrollbar-width: thin;
    }
    button {
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    [role='tab'] {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex: none;
        height: 34px;
        padding: 8px 0 6px;
        border: 0;
        border-bottom: 2px solid transparent;
        color: var(--workspace-inactive, #6b7280);
        font-size: 11px;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        white-space: nowrap;
    }
    [role='tab'][aria-selected='true'] {
        color: var(--workspace-text, #374151);
        border-bottom-color: var(--workspace-focus, #2563eb);
    }
    .tabs > [role='tab']:only-child {
        font-weight: 400;
        border-bottom-color: transparent;
    }
    button:hover:enabled {
        color: var(--workspace-text, #374151);
    }
    [role='tab'].insert-before {
        box-shadow: -2px 0 var(--workspace-focus, #2563eb);
    }
    .split-controls {
        display: flex;
        flex: none;
        padding: 0 8px;
        gap: 4px;
    }
    .split-button {
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border: 0;
        border-radius: 3px;
        color: var(--workspace-muted, #6b7280);
    }
    .split-button:hover:enabled {
        background: var(--workspace-hover, #0000000a);
    }
    .split-button:disabled {
        opacity: 0.25;
        cursor: default;
    }
    svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.4;
    }
    .panel {
        z-index: 2;
        overflow: hidden;
    }
    .panel.inactive {
        visibility: hidden;
        pointer-events: none;
    }
    .empty {
        flex: 1;
        display: grid;
        place-items: center;
        color: var(--workspace-muted, #6b7280);
        font-size: 13px;
    }
    .drop-target {
        outline: 2px dashed var(--workspace-focus, #2563eb);
        outline-offset: -4px;
    }
    .widget-menu {
        margin: 0;
        left: auto;
        width: 180px;
        box-sizing: border-box;
        overflow: auto;
        padding: 4px;
        border: 1px solid var(--workspace-border, #d1d5db);
        border-radius: 6px;
        background: var(--workspace-surface, #ffffff);
        color: var(--workspace-text, #374151);
    }
    .existing-tab {
        position: relative;
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 26px;
        font-size: 12px;
        padding-left: 4px;
        border-radius: 3px;
        background: var(--workspace-surface, #ffffff);
    }
    .existing-tab .tab-label {
        flex: 1;
    }
    .existing-tab.reordering:not(.dragging) {
        transition: transform 120ms ease;
    }
    .existing-tab.dragging {
        z-index: 1;
        box-shadow: 0 2px 8px #00000040;
    }
    .widget-menu .reorder-tab {
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        margin-left: -4px;
        padding: 0;
        border: 0;
        color: var(--workspace-muted, #6b7280);
        cursor: grab;
        touch-action: none;
    }
    .reorder-tab svg {
        stroke-width: 2.6;
        stroke-linecap: round;
    }
    .existing-tab.dragging .reorder-tab {
        cursor: grabbing;
    }
    .widget-menu .close-tab {
        width: 24px;
        height: 24px;
        padding: 0;
        display: grid;
        place-items: center;
        justify-content: center;
        gap: 0;
        flex: none;
    }
    .widget-menu .pane-actions {
        display: flex;
        gap: 2px;
    }
    .widget-menu .pane-actions button {
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        padding: 2px;
        border-radius: 3px;
    }
    .widget-menu hr {
        border: 0;
        border-top: 1px solid var(--workspace-border, #d1d5db);
        margin: 6px 0 10px;
    }
    .widget-menu button:disabled {
        opacity: 0.35;
        cursor: default;
    }
    .widget-menu strong {
        display: block;
        margin: 0 4px 4px;
        font-size: 11px;
        font-weight: 600;
        color: var(--workspace-muted, #6b7280);
    }
    .widget-menu .add-tab,
    .widget-menu .delete-pane {
        min-height: 26px;
        padding: 4px;
        font-size: 12px;
    }
    .widget-menu .delete-pane,
    .widget-menu .delete-pane:hover:enabled {
        color: var(--workspace-danger, #dc2626);
    }
    .widget-menu button {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        width: 100%;
        padding: 8px;
        border: 0;
        text-align: left;
    }
    .widget-menu button:hover {
        background: var(--workspace-hover, #0000000a);
    }
    .swap-sides {
        opacity: 0;
        pointer-events: none;
        position: absolute;
        z-index: 5;
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border: 1px solid var(--workspace-border, #d1d5db);
        border-radius: 5px;
        background: var(--workspace-surface, #ffffff);
        color: var(--workspace-muted, #6b7280);
    }
    .divider:hover + .swap-sides,
    .divider:focus + .swap-sides,
    .swap-sides:hover,
    .swap-sides:focus-visible {
        opacity: 1;
        pointer-events: auto;
    }
    .divider {
        position: absolute;
        z-index: 4;
        cursor: row-resize;
        touch-action: none;
    }
    .divider.vertical {
        cursor: col-resize;
    }
    .divider::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 0;
        right: 0;
        height: 1px;
        background: var(--workspace-border, #d1d5db);
    }
    .divider.vertical::after {
        left: 3px;
        top: 0;
        bottom: 0;
        width: 1px;
        height: auto;
    }
    .divider:hover::after,
    .divider:focus-visible::after {
        background: var(--workspace-focus, #2563eb);
    }
    button:focus-visible,
    .divider:focus-visible {
        outline: 2px solid var(--workspace-focus, #2563eb);
        outline-offset: -2px;
    }
    .short-label {
        display: none;
    }
    .fixed .tabs {
        gap: 16px;
        padding-inline: 8px;
    }
    @media (width < 640px) {
        .has-short {
            display: none;
        }
        .short-label {
            display: inline;
        }
        .tabs {
            gap: 16px;
            padding-inline: 8px;
        }
    }
</style>
