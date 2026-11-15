<script lang="ts">
    import type { StatFigure } from '$lib/utils/siteStats'

    let { figures, small = false }: { figures: StatFigure[]; small?: boolean } = $props()
</script>

<dl class="figures" class:small>
    {#each figures as figure (figure.label)}
        <div class="figure">
            <dt>{figure.label}</dt>
            <dd class="value">{figure.value}</dd>
            {#if figure.note}<dd class="note">{figure.note}</dd>{/if}
        </div>
    {/each}
</dl>

<style>
    .figures {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        row-gap: 14px;
    }
    .figure {
        display: flex;
        flex-direction: column;
        padding: 0 18px;
        border-left: 1px solid var(--color-gray-700);
    }
    .figure:first-child {
        padding-left: 0;
        border-left: 0;
    }
    .value {
        order: -1;
        font-family: 'Source Sans 3', sans-serif;
        font-size: 30px;
        font-weight: 600;
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        color: var(--color-gray-100);
    }
    dt {
        margin-top: 2px;
        font-size: 14px;
        color: var(--color-gray-300);
    }
    .note {
        font-size: 12px;
        color: var(--color-gray-400);
    }
    .small {
        grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
        margin-bottom: 14px;
    }
    .small .value {
        font-size: 22px;
    }
    .small dt {
        font-size: 12px;
    }
</style>
