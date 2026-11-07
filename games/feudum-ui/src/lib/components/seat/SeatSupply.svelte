<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import ShillingToken from '$lib/components/pieces/ShillingToken.svelte'
    import TileFace from '$lib/components/pieces/TileFace.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import Enlargeable from '$lib/components/table/Enlargeable.svelte'
    import { sealFaceShown } from '$lib/model/perspective.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import type { SeatPouch, SeatSupply } from '$lib/model/seatPanel.js'

    /** Contract, Seat panel: the pouch, then what a seat holds. All of it public but the draft. */
    let {
        supply,
        pouch,
        paint,
        scale
    }: { supply: SeatSupply; pouch: SeatPouch; paint: SeatPaint; scale: number } = $props()

    const Piece = 18
    const Tile = 30
    const Bead = 22
    let piece = $derived(Piece * scale)
</script>

{#snippet counted(count: number)}
    <span class:zero={count === 0}>{count}</span>
{/snippet}

<section
    class="flex flex-wrap items-center gap-x-[0.6em] gap-y-[0.25em]"
    data-seat-section="pouch"
    data-pouch={pouch.status}
>
    <span class="caption">Pouch</span>
    {#if pouch.status === 'finalised'}
        <span class="flex items-center gap-[0.25em]" class:spent={pouch.spent}>
            <GoodToken good={pouch.good} size={piece} />
            {pouch.note}{pouch.spent ? ', spent' : ''}
        </span>
    {:else if pouch.status === 'drafted'}
        <span class="flex items-center gap-[0.25em]">
            <GoodToken good={pouch.good} size={piece} /> drafted
        </span>
    {:else if pouch.status === 'choosing'}
        <span class="italic">choosing</span>
    {:else}
        <span class="italic">empty</span>
    {/if}
</section>

<section class="flex flex-col gap-[0.3em]" data-seat-section="supply">
    <div class="flex flex-wrap items-center gap-x-[0.55em] gap-y-[0.25em]">
        {#each supply.goods as { good, count } (good)}
            <span class="flex items-center gap-[0.15em]" data-supply-good={good}>
                <GoodToken {good} size={piece} />
                {@render counted(count)}
            </span>
        {/each}
        <span class="flex items-center gap-[0.15em]" data-supply-shillings={supply.shillings}>
            <ShillingToken value={1} size={piece} />
            {@render counted(supply.shillings)}
        </span>
    </div>
    <div class="flex flex-wrap items-center gap-x-[0.55em] gap-y-[0.25em]">
        <span class="flex items-center gap-[0.15em]" data-supply-markers={supply.markers}>
            <SeatToken kind="marker" {paint} size={piece} />
            {@render counted(supply.markers)}
        </span>
        <span class="flex items-center gap-[0.15em]" data-supply-discs={supply.freeDiscs}>
            <SeatToken kind="disc" {paint} size={piece} />
            {supply.freeDiscs}/{supply.discsOf}
        </span>
        {#each supply.vessels as { vessel, count } (vessel)}
            <span class="flex items-center gap-[0.15em]" data-supply-vessel={vessel}>
                <VesselToken {vessel} size={piece * 1.3} />
                {@render counted(count)}
            </span>
        {/each}
    </div>
    {#if supply.tiles.length > 0 || supply.beads.length > 0 || supply.seals > 0}
        <div class="flex flex-wrap items-center gap-[0.35em]">
            {#each supply.tiles as tile (tile.tileId)}
                <Enlargeable
                    tag="div"
                    label="{tile.landscape.replace('-', ' ')} tile"
                    face={() => ({
                        kind: 'tile',
                        faceShown: true,
                        epoch: tile.epoch,
                        landscape: tile.landscape,
                        region: tile.region
                    })}
                >
                    <div data-supply-tile={tile.tileId}>
                        <TileFace
                            faceShown={true}
                            epoch={tile.epoch}
                            landscape={tile.landscape}
                            region={tile.region}
                            size={Tile * scale}
                        />
                    </div>
                </Enlargeable>
            {/each}
            {#each supply.beads as beadValue, index (index)}
                <Enlargeable
                    tag="div"
                    label="bead +{beadValue}"
                    face={() => ({ kind: 'bead', faceShown: sealFaceShown(true), beadValue })}
                >
                    <SealFace faceShown={sealFaceShown(true)} {beadValue} size={Bead * scale} />
                </Enlargeable>
            {/each}
            {#if supply.seals > 0}
                <span class="flex items-center gap-[0.15em]" data-seals={supply.seals}>
                    <SealFace faceShown={sealFaceShown(false)} size={Bead * scale} />
                    ×{supply.seals}
                </span>
            {/if}
        </div>
    {/if}
</section>

<style>
    .caption {
        font-style: italic;
        color: var(--feudum-wood-dark);
    }

    .zero {
        opacity: 0.45;
    }

    .spent {
        text-decoration: line-through;
        opacity: 0.6;
    }
</style>
