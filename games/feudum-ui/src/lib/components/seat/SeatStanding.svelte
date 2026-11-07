<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import GuildIcon from '$lib/components/pieces/GuildIcon.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import type { SeatGuildCrest, SeatPanelView } from '$lib/model/seatPanel.js'

    /** Contract, Seat panel: the wine barrel, the six crests, then service and voyage. */
    let {
        guilds,
        barrel,
        service,
        voyage,
        paint,
        scale
    }: {
        guilds: readonly SeatGuildCrest[]
        barrel: SeatPanelView['barrel']
        service: SeatPanelView['service']
        voyage: number | undefined
        paint: SeatPaint
        scale: number
    } = $props()

    const Crest = 22
    const Sulfur = 16
    const Reeve = 13
    let slots = $derived(
        Array.from({ length: barrel.capacity }, (_, index) => index < barrel.sulfur)
    )
</script>

<section
    class="flex items-center gap-[0.35em]"
    data-seat-section="barrel"
    data-barrel={barrel.sulfur}
>
    <span class="caption">Barrel</span>
    {#each slots as full, index (index)}
        {#if full}
            <GoodToken good="sulfur" size={Sulfur * scale} />
        {:else}
            <span
                class="empty-slot"
                style:width="{Sulfur * scale}px"
                style:height="{Sulfur * scale}px"
            ></span>
        {/if}
    {/each}
    <span>{barrel.sulfur}/{barrel.capacity}</span>
</section>

<section class="grid grid-cols-6 gap-[0.2em]" data-seat-section="guilds">
    {#each guilds as crest (crest.guild)}
        <div class="flex flex-col items-center text-center" data-guild-crest={crest.guild}>
            <GuildIcon guild={crest.guild} size={Crest * scale} />
            <span data-stars={crest.stars} class:zero={crest.stars === 0}>★{crest.stars}</span>
            <span class="flex min-h-[1.2em] items-center gap-[0.15em]">
                {#if crest.rank}
                    <span class="badge" data-rank={crest.rank}>{crest.rank}</span>
                {/if}
                {#if crest.reeve}
                    <span data-reeve><SeatToken kind="reeve" {paint} size={Reeve * scale} /></span>
                {/if}
            </span>
            {#if crest.noMarker}
                <span class="no-marker" data-no-marker>no marker</span>
            {/if}
        </div>
    {/each}
</section>

<section class="flex flex-wrap items-center gap-x-[0.8em] pr-[2.6em]" data-seat-section="service">
    <span data-service={service.covered}>Service {service.covered}/{service.of}</span>
    {#if service.vassal}
        <span class="italic" data-vassal>vassal</span>
    {/if}
    <span data-voyage={voyage ?? ''}>Voyage {voyage ?? '–'}</span>
</section>

<style>
    .caption {
        font-style: italic;
        color: var(--feudum-wood-dark);
    }

    .empty-slot {
        display: inline-block;
        border-radius: 50%;
        border: 1px dashed var(--feudum-wood-dark);
    }

    .zero {
        opacity: 0.45;
    }

    .badge {
        padding: 0 0.3em;
        border-radius: 0.25em;
        background: var(--feudum-ink);
        color: var(--feudum-parchment);
        font-size: 0.85em;
        font-weight: 700;
    }

    .no-marker {
        font-size: 0.7em;
        line-height: 1;
        font-style: italic;
    }
</style>
