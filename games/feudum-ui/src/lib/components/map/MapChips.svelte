<script lang="ts">
    import { Spaces, type HydratedFeudumGameState } from '@tabletop/feudum'
    import { PlainChrome, isPickable, type BoardChrome } from '$lib/model/boardChrome.js'
    import { roleOf, type BoardTarget } from '$lib/model/boardOffer.js'
    import { spaceChips } from '$lib/model/spaceChips.js'
    import PickChip from './PickChip.svelte'

    /** Contract, Pick conventions: every chip over all the pieces, in one row, so each reads. */
    let { state, chrome = PlainChrome }: { state: HydratedFeudumGameState; chrome?: BoardChrome } =
        $props()

    function pressOf(target: BoardTarget): (() => void) | undefined {
        const press = chrome.press
        return press && isPickable(roleOf(chrome.offer, target)) ? () => press(target) : undefined
    }
</script>

{#each Spaces as space (space.id)}
    {#each spaceChips(state, chrome.offer, space.id) as { target, chip, at } (target)}
        <g transform="translate({at.x} {at.y})" data-chip-of={target}>
            <PickChip {chip} press={pressOf(target)} />
        </g>
    {/each}
{/each}
