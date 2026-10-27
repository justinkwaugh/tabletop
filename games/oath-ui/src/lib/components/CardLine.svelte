<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import TokenText from '$lib/components/TokenText.svelte'
    import type { WarbandWhose } from '$lib/model/tokenText.js'

    // R-7.4 — a card's one line: what it gives, in symbols ("+1 [warband]", "0 Supply"), then what
    // using it costs in gold and, in rose, what it brings beyond that, a dot between each. A card
    // lent by another player (Master of Disguise) starts with that player's name chip.
    let {
        lender = undefined,
        gives = undefined,
        cost = undefined,
        consequence = undefined,
        warbandColor = undefined
    }: {
        lender?: string
        gives?: string
        cost?: string
        consequence?: string
        warbandColor?: (whose: WarbandWhose) => Color
    } = $props()

    let parts = $derived(
        [
            { text: gives, tone: '' },
            { text: cost, tone: 'text-oath-accent' },
            { text: consequence, tone: 'font-semibold text-oath-danger' }
        ].flatMap((part) => (part.text ? [{ text: part.text, tone: part.tone }] : []))
    )
</script>

{#if lender}<span data-lender={lender}><PlayerName playerId={lender} /></span
    >{#if parts.length > 0}<span class="text-oath-text-muted" aria-hidden="true">{' · '}</span
        >{/if}{/if}{#each parts as part, i (i)}{#if i > 0}<span
            class="text-oath-text-muted"
            aria-hidden="true">{' · '}</span
        >{/if}<span class={part.tone}><TokenText text={part.text} {warbandColor} /></span>{/each}
