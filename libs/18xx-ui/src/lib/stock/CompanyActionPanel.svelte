<script lang="ts">
    import type { Snippet } from 'svelte'
    import StockPanelHeading from './StockPanelHeading.svelte'
    let {
        label,
        heading,
        children
    }: {
        /** The panel's accessible name. */
        label: string
        heading: string
        /** The company cards. */
        children: Snippet
    } = $props()
</script>

<section aria-label={label}>
    <StockPanelHeading text={heading} />
    <div class="cards">
        {@render children()}
    </div>
</section>

<style>
    section {
        container-type: inline-size;
        padding: 6px 0;
    }
    .cards {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
</style>
