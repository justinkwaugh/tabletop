<script lang="ts">
    import { cityIn } from '@tabletop/ride-the-rails'
    import { BOARD_LOOK, CITY_CENTRE_INSET } from '$lib/utils/boardLook.js'
    import { insetCellPoints, type LitHexView } from '$lib/utils/pickMarks.js'

    let { views }: { views: readonly LitHexView[] } = $props()

    const litViews = $derived(views.filter((view) => view.ring === 'lit' || view.ring === 'start'))
    const lit = $derived(BOARD_LOOK.litHex === 'wash' ? litViews : [])
    // 'plain-city': a lit city loses its grey for the plains' colour, under its band and cubes.
    const plainCities = $derived(
        BOARD_LOOK.litHex === 'plain-city' ? litViews.filter((view) => cityIn(view.hexId)) : []
    )
</script>

<!-- BOARD_LOOK.litHex 'wash': a pale wash over each lit hex's ground; 'plain-city': each lit city
     painted the plains' colour inside a rim of its grey. Under the bands and cubes, so neither covers what stands in it. -->
<g class="lit-wash" aria-hidden="true">
    {#each plainCities as view (view.hexId)}
        {#each insetCellPoints(view.hexId, CITY_CENTRE_INSET) as points, cell (cell)}
            <polygon {points} fill="var(--rtr-plain)"></polygon>
        {/each}
    {/each}
    {#each lit as view (view.hexId)}
        {#each insetCellPoints(view.hexId, 0) as points, cell (cell)}
            <polygon {points} fill="var(--rtr-lit-wash)"></polygon>
        {/each}
    {/each}
</g>
