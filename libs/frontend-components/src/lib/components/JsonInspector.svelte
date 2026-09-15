<script lang="ts">
    import { onDestroy } from 'svelte'
    import { SvelteMap } from 'svelte/reactivity'
    import { copyTextToClipboard } from '../utils/clipboard.js'
    import { formatJsonValue, jsonEntries, jsonPreview } from '../utils/jsonInspector.js'

    let { value, label }: { value: unknown; label: string } = $props()
    const expanded = new SvelteMap<string, boolean>()
    let expandAll = $state(false)
    let copyStatus = $state<'idle' | 'copied' | 'failed'>('idle')
    let copyTimeout: ReturnType<typeof setTimeout> | undefined
    let entries = $derived(jsonEntries(value))

    function setExpansion(open: boolean) {
        expanded.clear()
        expandAll = open
    }

    async function copyJson() {
        clearTimeout(copyTimeout)
        try {
            await copyTextToClipboard(JSON.stringify(value, null, 2) ?? String(value))
            copyStatus = 'copied'
        } catch {
            copyStatus = 'failed'
        }
        copyTimeout = setTimeout(() => (copyStatus = 'idle'), 2000)
    }

    onDestroy(() => clearTimeout(copyTimeout))
</script>

{#snippet node(key: string, child: unknown, path: string[], ancestors: unknown[], index: boolean)}
    {@const children = jsonEntries(child)}
    {@const circular = ancestors.includes(child)}
    {@const expandable = children.length > 0 && !circular}
    {@const pathKey = JSON.stringify(path)}
    {@const open = expanded.get(pathKey) ?? expandAll}
    <li>
        {#if expandable}
            <button
                type="button"
                class="row branch"
                aria-expanded={open}
                aria-label={`${open ? 'Collapse' : 'Expand'} ${key}`}
                title={path.join(' › ')}
                onclick={() => expanded.set(pathKey, !open)}
            >
                <svg class:open viewBox="0 0 16 16" aria-hidden="true"
                    ><path d="m6 4 4 4-4 4"></path></svg
                >
                <span class="key" class:index>{key}</span>
                <span class="count"
                    >{Array.isArray(child) ? `[${children.length}]` : `{${children.length}}`}</span
                >
                {#if !open}<span class="preview">{jsonPreview(child)}</span>{/if}
            </button>
            {#if open}
                <ul class="children">
                    {#each children as [childKey, childValue] (childKey)}
                        {@render node(
                            childKey,
                            childValue,
                            [...path, childKey],
                            [...ancestors, child],
                            Array.isArray(child)
                        )}
                    {/each}
                </ul>
            {/if}
        {:else}
            <div class="row leaf" title={path.join(' › ')}>
                <span class="key" class:index>{key}<span class="colon">:</span></span>
                <span
                    class="value"
                    class:string={typeof child === 'string' || child instanceof Date}
                    class:number={typeof child === 'number' || typeof child === 'bigint'}
                    class:boolean={typeof child === 'boolean'}
                    class:muted={child == null || typeof child === 'object'}
                    >{circular ? '[Circular]' : formatJsonValue(child)}</span
                >
            </div>
        {/if}
    </li>
{/snippet}

<section class="inspector" aria-label={`${label} JSON inspector`}>
    <div class="toolbar">
        <span class="summary"
            >{Array.isArray(value) ? `${entries.length} items` : `${entries.length} fields`}</span
        >
        <div class="tools">
            <button type="button" onclick={() => setExpansion(true)}>Expand all</button>
            <button type="button" onclick={() => setExpansion(false)}>Collapse all</button>
            <button
                type="button"
                onclick={copyJson}
                aria-label={`Copy ${label.toLowerCase()} JSON`}
            >
                {copyStatus === 'copied'
                    ? 'Copied'
                    : copyStatus === 'failed'
                      ? 'Copy failed'
                      : 'Copy JSON'}
            </button>
        </div>
        <span class="sr-only" role="status"
            >{copyStatus === 'copied'
                ? `${label} copied`
                : copyStatus === 'failed'
                  ? 'Could not copy JSON. Try again.'
                  : ''}</span
        >
    </div>
    <div class="tree">
        {#if entries.length > 0}
            <ul>
                {#each entries as [key, child] (key)}
                    {@render node(key, child, [key], [value], Array.isArray(value))}
                {/each}
            </ul>
        {:else}
            <div class="empty">{formatJsonValue(value)}</div>
        {/if}
    </div>
</section>

<style>
    .inspector {
        --surface: #ffffff;
        --toolbar: #f6f8fa;
        --border: #dce2e9;
        --text: #243247;
        --muted: #657389;
        --hover: #edf2f8;
        --string: #187447;
        --number: #175bb5;
        --boolean: #8547bb;
        color: var(--text);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
        min-width: 0;
    }
    :global(.dark) .inspector {
        --surface: #151a23;
        --toolbar: #1b222e;
        --border: #303a49;
        --text: #dce4ef;
        --muted: #96a3b8;
        --hover: #242f40;
        --string: #91d5ae;
        --number: #8cbeff;
        --boolean: #cfadff;
    }
    .toolbar,
    .tools {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .toolbar {
        flex-wrap: wrap;
        justify-content: space-between;
        padding: 6px 8px;
        background: var(--toolbar);
        border-bottom: 1px solid var(--border);
        font:
            11px/1.5 system-ui,
            sans-serif;
    }
    .summary {
        color: var(--muted);
        padding: 0 4px;
    }
    button {
        cursor: pointer;
        color: inherit;
    }
    .tools button {
        background: transparent;
        font: inherit;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 4px 6px;
        white-space: nowrap;
    }
    .tools button:hover {
        background: var(--hover);
        border-color: var(--border);
    }
    button:focus-visible {
        outline: 2px solid var(--number);
        outline-offset: -2px;
    }
    .tree {
        overflow: auto;
        padding: 6px;
        font:
            12px/1.65 ui-monospace,
            SFMono-Regular,
            Menlo,
            Consolas,
            monospace;
        tab-size: 2;
    }
    ul {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .children {
        margin-left: 10px;
        padding-left: 13px;
        border-left: 1px solid var(--border);
    }
    .row {
        display: flex;
        align-items: baseline;
        gap: 7px;
        min-height: 25px;
        box-sizing: border-box;
        padding: 2px 5px;
        border-radius: 4px;
        text-align: left;
    }
    .row:hover {
        background: var(--hover);
    }
    .branch {
        width: 100%;
        align-items: center;
        font: inherit;
        border: 0;
        background: transparent;
    }
    svg {
        width: 12px;
        height: 12px;
        flex: 0 0 12px;
        color: var(--muted);
    }
    svg path {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.75;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    svg.open {
        transform: rotate(90deg);
    }
    .key {
        flex-shrink: 0;
        white-space: pre;
    }
    .index,
    .colon,
    .muted {
        color: var(--muted);
    }
    .count {
        flex-shrink: 0;
        color: var(--muted);
        font-size: 10px;
        background: var(--toolbar);
        border: 1px solid var(--border);
        padding: 0 4px;
        border-radius: 4px;
    }
    .preview {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--muted);
    }
    .leaf {
        padding-left: 24px;
    }
    .value {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        min-width: 0;
    }
    .string {
        color: var(--string);
    }
    .number {
        color: var(--number);
    }
    .boolean {
        color: var(--boolean);
    }
    .empty {
        padding: 8px;
        color: var(--muted);
    }
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
</style>
