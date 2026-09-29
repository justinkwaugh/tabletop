<script lang="ts">
    import type { TableNotices } from '../session/tableNotices.svelte.js'
    let { notices }: { notices: TableNotices } = $props()
</script>

{#if notices.items.length}
    <ul class="table-notices" role="status" aria-live="polite" aria-label="Table notices">
        {#each notices.items as notice (notice.id)}
            <li>
                <span>{notice.text}</span>
                <button aria-label="Dismiss notice" onclick={() => notices.dismiss(notice.id)}
                    >×</button
                >
            </li>
        {/each}
    </ul>
{/if}

<style>
    .table-notices {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 0;
        padding: 6px 12px;
        list-style: none;
        border-bottom: 1px solid var(--rail-border, #b8a995);
        background: var(--rail-surface-selected, #e6dccd);
        color: var(--rail-text, #514538);
        font-size: 12px;
    }
    li {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }
    button {
        padding: 0 4px;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #796047);
        outline-offset: 1px;
    }
</style>
