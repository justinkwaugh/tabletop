<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        localHexPoints,
        pointsAttribute,
        spaceCentre,
        veilPath
    } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()
    const litRing = pointsAttribute(localHexPoints(0.94))
    const decidedOutline = pointsAttribute(localHexPoints(1.02))

    const offer = $derived(gameSession.boardOffer)
    const hexes = $derived([...offer.hexes])
    const beingDecided = $derived(hexes.filter(([, hex]) => hex.beingDecided !== undefined))
    const previewed = $derived(hexes.filter(([, hex]) => hex.previewed))
</script>

<!-- Contract, "Pick conventions": the one veil with holes at the lit hexes, then the outline of the
     Repairs town being decided (R-4.3), the lit rings (R-3.3) and the hover preview's thin rings. -->
<g class="pointer-events-none">
    {#if offer.veiled}
        <path d={veilPath(offer.lit)} fill="var(--pp-veil)" fill-rule="evenodd" data-veil></path>
    {/if}
    {#each beingDecided as [spaceId] (spaceId)}
        {@const centre = spaceCentre(spaceId)}
        <g transform="translate({centre.x} {centre.y})" data-being-decided={spaceId}>
            <polygon points={decidedOutline} fill="none" stroke="var(--pp-halo)" stroke-width="20"
            ></polygon>
            <polygon
                points={decidedOutline}
                fill="none"
                stroke="var(--pp-decided)"
                stroke-width="10"
                stroke-dasharray="26 16"
            ></polygon>
        </g>
    {/each}
    {#each offer.lit as spaceId (spaceId)}
        {@const centre = spaceCentre(spaceId)}
        <g transform="translate({centre.x} {centre.y})" data-lit={spaceId}>
            <polygon
                points={litRing}
                fill="none"
                stroke="var(--pp-halo)"
                stroke-width="24"
                stroke-linejoin="round"
            ></polygon>
            <polygon
                points={litRing}
                fill="none"
                stroke="var(--pp-accent)"
                stroke-width="12"
                stroke-linejoin="round"
            ></polygon>
        </g>
    {/each}
    {#each previewed as [spaceId] (spaceId)}
        {@const centre = spaceCentre(spaceId)}
        <g transform="translate({centre.x} {centre.y})" data-previewed={spaceId}>
            <polygon points={litRing} fill="none" stroke="var(--pp-halo)" stroke-width="10"
            ></polygon>
            <polygon points={litRing} fill="none" stroke="var(--pp-accent)" stroke-width="5"
            ></polygon>
        </g>
    {/each}
</g>
