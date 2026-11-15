<script lang="ts">
    let { entries }: { entries: { label: string; color: string; thin?: boolean }[] } = $props()
</script>

<ul class="key" aria-hidden="true">
    {#each entries as entry (entry.label)}
        <li>
            <span class="swatch" class:thin={entry.thin} style:background={entry.color}></span>
            {entry.label}
        </li>
    {/each}
</ul>

<style>
    .key {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 18px;
        margin-top: 10px;
        color: var(--color-gray-400);
        font-size: 12px;
    }
    .swatch {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 2px;
        margin-right: 6px;
    }
    .swatch.thin {
        height: 3px;
        vertical-align: middle;
    }
</style>
