<script lang="ts">
    import { INDUSTRIES } from '@tabletop/railheads'
    import IndustryCard from './IndustryCard.svelte'
</script>

<section class="industries" aria-label="Industry development">
    {#each INDUSTRIES as industry (industry)}
        <IndustryCard {industry} />
    {/each}
</section>

<style>
    .industries {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 6px;
    }
</style>
