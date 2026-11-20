<script lang="ts">
    import { ForeignInvestors1880 } from '@tabletop/1880'
    import { placeReference } from '@tabletop/18xx'
    import { CompanyToken, PlaceText } from '@tabletop/18xx-ui'
    import type { Session1880 } from './session.svelte.js'
    let {
        session,
        investorIds,
        tokenSize,
        label
    }: { session: Session1880; investorIds: readonly string[]; tokenSize: number; label: string } =
        $props()
    const investors = $derived(
        ForeignInvestors1880.filter((investor) => investorIds.includes(investor.id))
    )
</script>

<ul class="lineup" aria-label={label}>
    {#each investors as investor (investor.id)}
        <li title={investor.name} data-investor={investor.id}>
            <CompanyToken appearance={session.mapView.stations[investor.id]} size={tokenSize} />
            <span class="home"><PlaceText text={placeReference(investor.home)} /></span>
        </li>
    {/each}
</ul>

<style>
    .lineup {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    li {
        display: grid;
        justify-items: center;
        gap: 2px;
    }
    li :global(svg) {
        display: block;
    }
    .home {
        font-size: 0.917em;
        white-space: nowrap;
    }
</style>
