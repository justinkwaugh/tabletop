<script lang="ts">
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import PrivateCard from '../privates/PrivateCard.svelte'
    import CardLightbox from '../privates/CardLightbox.svelte'

    let {
        session,
        id,
        name,
        price,
        income,
        description = '',
        token
    }: {
        session: EighteenXXSession
        id: string
        name: string
        price?: number
        income?: number
        description?: string
        token?: StationAppearance
    } = $props()
    const money = $derived(session.presentation.money)
    const imageUrl = $derived(session.publishedCardImage(id))
    const thumbnailUrl = $derived(session.publishedCardImage(id, 'thumbnail'))
    let lightbox = $state(false)
</script>

<!-- An auction lot as a card: the published image (click to enlarge) or the generated card. -->
{#if imageUrl}
    <button
        class="card-button"
        aria-label={`Show ${name} card`}
        onclick={() => {
            lightbox = true
        }}
    >
        <PrivateCard {money} {name} description="" imageUrl={thumbnailUrl} />
    </button>
    {#if lightbox}
        <CardLightbox
            {imageUrl}
            {name}
            onclose={() => {
                lightbox = false
            }}
        />
    {/if}
{:else}
    <PrivateCard
        {money}
        phaseColors={session.presentation.phaseColors}
        {token}
        {name}
        {description}
        value={price}
        {income}
    />
{/if}

<style>
    .card-button {
        display: block;
        padding: 0;
        border: 0;
        background: none;
        cursor: zoom-in;
        border-radius: 10px;
    }
    .card-button:focus-visible {
        outline: 2px solid var(--rail-focus, #796047);
        outline-offset: 3px;
    }
    /* Published card art takes its height from the host; the host sets --auction-card-height. */
    .card-button :global(.private-card img) {
        width: auto;
        height: var(--auction-card-height, 180px);
    }
</style>
