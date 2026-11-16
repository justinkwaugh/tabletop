<script lang="ts">
    import { Spaces } from '@tabletop/feudum'
    import { PlainChrome, type BoardChrome } from '$lib/model/boardChrome.js'
    import { chipOf, feudumTarget, spaceTarget } from '$lib/model/boardOffer.js'
    import { SpaceRingFrame, spaceGeometry } from '$lib/utils/boardGeometry.js'
    import PickChip from './PickChip.svelte'

    /**
     * Contract, Board surface: a space's chip, over the pieces standing on the space so its cost or
     * label stays readable. It stands where the space's pick chrome would draw it; the press stays
     * the space's own, under the pieces.
     */
    let { chrome = PlainChrome }: { chrome?: BoardChrome } = $props()
</script>

{#each Spaces as space (space.id)}
    {@const centre = spaceGeometry(space.id).centre}
    {#each [spaceTarget(space.id), feudumTarget(space.id)] as target (target)}
        {@const chip = chipOf(chrome.offer, target)}
        {#if chip}
            <g transform="translate({centre.x} {centre.y})" data-chip-of={target}>
                <PickChip {chip} y={-SpaceRingFrame / 2 - 24} />
            </g>
        {/if}
    {/each}
{/each}
