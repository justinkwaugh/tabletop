# Tab workspace

`TabWorkspace` from `@tabletop/frontend-components` supplies draggable tabs,
resizable horizontal/vertical splits, pane merging, tab closing/adding, and layout
serialization. It has no game, Game Session, 18xx, or host dependency.

```svelte
<script lang="ts">
    import { TabWorkspace, type WorkspaceTab, type SavedWorkspace } from '@tabletop/frontend-components'

    const tabs: WorkspaceTab[] = [
        { id: 'editor', label: 'Editor', closable: false },
        { id: 'preview', label: 'Preview' },
        { id: 'notes', label: 'Notes', optional: true }
    ]
    let saved: SavedWorkspace | undefined = $state()
</script>

<div style="height: 600px">
    <TabWorkspace {tabs} savedLayout={saved} onLayoutChange={value => saved = value}>
        {#snippet children(id, active)}
            <div>{id} {active ? 'visible' : 'hidden'}</div>
        {/snippet}
    </TabWorkspace>
</div>
```

The caller supplies stable tab IDs, labels, and content. Tabs are closeable unless
`closable: false`; optional tabs start absent and appear in Add tabs. At most eight
main panes can exist. Deleting a pane merges its tabs into the surviving sibling.
Both split directions, repeated splitting, swapping sides, and divider resizing
are built in. Dragging keeps each side of a divider at least 100px; ratios are
clamped to 5–95% when restored or moved with the keyboard.

`initialSplit: { axis: 'horizontal', first: ['editor'] }` starts with an upper pane
containing Editor and the remaining tabs below. `vertical` splits left/right.
`splittable={false}` uses a single tabbed view with no pane controls or dragging.
The caller chooses its responsive breakpoint; the workspace does not assume one.

An optional `fixedPane` supplies a target HTMLElement, label, and allowed tab IDs.
Its header and content render in that target. It cannot split or close; its tabs
can move into main panes and back, and only its allowed IDs may enter it.

Content receives `(id, active)`. Moving or reordering a tab preserves its mounted
content. Inactive panels are hidden and inert. Closing a tab unmounts its content.
A caller must use `active` for visibility-sensitive work instead of assuming one
workspace-wide active tab. `bind:selected` can activate a tab wherever it lives.
`tabTitle` optionally renders an icon or other decoration before a tab label.

## Persistence

`savedLayout` is read when the workspace mounts. Wait for stored preferences to
load before mounting; remount when changing users or explicitly loading another
layout. `onLayoutChange` receives a `SavedWorkspace` after structural changes,
including completed divider drags. Selecting a tab alone does not save a layout.

The v1 format stores ordered tab IDs, a recursive split tree, integer percentages,
and intentionally closed tabs. Runtime IDs and active selections are omitted.
The historical `sidebar` field means the optional fixed pane, regardless of its
physical position. Its name stays unchanged to preserve existing saved layouts.
Unknown/duplicate tabs are removed, missing required tabs are restored, optional
absent tabs stay absent, and malformed or unsupported layouts use defaults.

Storage belongs to the caller. The exported `DebouncedLayout` helper optionally
provides five-second debouncing, save/retry status, and local draft recovery; its
callbacks accept any storage adapter. Instantiate it during Svelte initialization,
provide an account-specific key, and dispose it through the owning component's
lifecycle. No preference schema or network API is required by `TabWorkspace`.

## Theme

The workspace has neutral defaults. Set these inherited CSS properties on a
containing element, including the fixed-pane target's ancestor when applicable:

- `--workspace-text`, `--workspace-muted`, `--workspace-inactive`
- `--workspace-border`, `--workspace-focus`, `--workspace-hover`
- `--workspace-surface`

Game-specific colors and dark mode belong to the caller. The 18xx table maps its
railway theme to these properties; the base module never reads railway variables.

This is bundled UI behavior, with no host bridge or Logic change. TOP and Shikoku
1889 need updated UI Artifacts to adopt it; existing saved layouts remain valid.

For a nested starting arrangement, pass `initialLayout` using the `SavedPane`
format (for example a left/right split whose branches each split top/bottom).
It applies only when no valid saved layout exists. `restoreWorkspace` and
`saveWorkspace` are exported for caller-owned layout migrations; the base module
continues to own validation, unknown-tab filtering, and the eight-pane limit.
