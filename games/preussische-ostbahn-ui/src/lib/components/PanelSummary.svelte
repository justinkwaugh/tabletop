<script lang="ts">
    import type { Snippet } from 'svelte'

    let { heading, facts }: { heading: Snippet; facts: string[] } = $props()
</script>

<div class="heading">{@render heading()}</div>
<div class="facts">
    {#each facts as fact, index (index)}
        {#if index > 0}<span aria-hidden="true">·</span>{/if}
        <span>{fact}</span>
    {/each}
</div>

<style>
    .heading {
        font-size: 17px;
        font-weight: 700;
        line-height: 1.4;
    }

    .facts {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
        color: var(--po-muted);
        font-size: 14px;
    }
</style>
