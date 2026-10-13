<script lang="ts">
    import type { Region } from '@tabletop/oath'
    import type { Snippet } from 'svelte'
    import MenuToggleRow from '$lib/components/MenuToggleRow.svelte'
    import { cardBack } from '$lib/images/cardImages.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { pileOf } from '$lib/model/pileRows.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-9.4 — a discard pile picked as a row: its top back with its count, then its name. The
    // rows share the widest one's width; the picked one is ringed. `after`: more places in the
    // same list (the Cracked Horn's world deck), sharing the width.
    let {
        regions,
        picked,
        onpick,
        width = new ChoiceWidth(),
        after = undefined
    }: {
        regions: readonly Region[]
        picked: Region | undefined
        onpick: (region: Region) => void
        width?: ChoiceWidth
        after?: Snippet
    } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
</script>

<div class="flex flex-col items-start gap-1.5" role="group">
    {#each regions as region (region)}
        {@const pile = pileOf(gameSession.gameState, region)}
        <MenuToggleRow
            image={cardBack(pile.back)}
            name={pile.name}
            shape="card"
            count={pile.count}
            label="{pile.name}, {pile.count} {pile.count === 1 ? 'card' : 'cards'}"
            on={picked === region}
            disabled={busy}
            {width}
            onclick={() => onpick(region)}
        />
    {/each}
    {@render after?.()}
</div>
