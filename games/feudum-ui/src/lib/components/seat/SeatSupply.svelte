<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import ShillingToken from '$lib/components/pieces/ShillingToken.svelte'
    import Enlargeable from '$lib/components/table/Enlargeable.svelte'
    import { sealFaceShown } from '$lib/model/perspective.js'
    import type { SeatSupplyItem } from '$lib/model/seatLines.js'

    /**
     * Contract, Seat panel, the supply line: the five goods, shillings, then seals and beads when
     * held. All of it public; a held seal is a count to everyone, its holder included (R-5-H1).
     */
    let { items, scale }: { items: readonly SeatSupplyItem[]; scale: number } = $props()

    const Piece = 15
    let piece = $derived(Piece * scale)
</script>

<div
    class="line flex flex-wrap items-center gap-x-[0.5em] gap-y-[0.2em]"
    data-seat-line="supply"
    data-seat-section="supply"
>
    {#each items as entry, index (index)}
        {#if entry.item === 'good'}
            <span
                class="flex items-center gap-[0.15em]"
                title="{entry.count} {entry.good}"
                data-supply-good={entry.good}
            >
                <GoodToken good={entry.good} size={piece} />
                <span class:zero={entry.count === 0}>{entry.count}</span>
            </span>
        {:else if entry.item === 'shillings'}
            <span
                class="flex items-center gap-[0.15em]"
                title="{entry.count} shillings"
                data-supply-shillings={entry.count}
            >
                <ShillingToken value={1} size={piece} />
                <span class:zero={entry.count === 0}>{entry.count}</span>
            </span>
        {:else if entry.item === 'seals'}
            <span
                class="flex items-center gap-[0.15em]"
                title="{entry.count} king's seals"
                data-seals={entry.count}
            >
                <SealFace faceShown={sealFaceShown(false)} size={piece} />
                {entry.count}
            </span>
        {:else}
            {@const value = entry.value}
            <Enlargeable
                tag="div"
                label="bead +{value}"
                face={() => ({ kind: 'bead', faceShown: sealFaceShown(true), beadValue: value })}
            >
                <div title="bead +{value}" data-supply-bead={value}>
                    <SealFace faceShown={sealFaceShown(true)} beadValue={value} size={piece} />
                </div>
            </Enlargeable>
        {/if}
    {/each}
</div>

<style>
    .zero {
        opacity: 0.45;
    }
</style>
