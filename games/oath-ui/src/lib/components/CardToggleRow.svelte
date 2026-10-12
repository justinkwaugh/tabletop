<script lang="ts">
    import type { Snippet } from 'svelte'
    import { CardKind, kindOf } from '@tabletop/oath'
    import MenuToggleRow from '$lib/components/MenuToggleRow.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import { cardImage } from '$lib/images/cardImages.js'
    import { cardName } from '$lib/model/names.js'
    import type { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'

    // R-7.4 — a card offered in a menu or a plan panel: a framed row with the small card, the
    // magnifier on its corner, the card's name over one line, and "in use" while it is on. The
    // magnifier sits beside the row's button, never inside it, and enlarges the card on a tap.
    let {
        cardId,
        line = undefined,
        on,
        disabled,
        width = undefined,
        onclick
    }: {
        cardId: string
        line?: Snippet
        on: boolean
        disabled: boolean
        width?: ChoiceWidth
        onclick: () => void
    } = $props()

    let name = $derived(cardName(cardId))
</script>

<span class="relative inline-flex max-sm:flex" data-card-row={cardId}>
    <MenuToggleRow
        image={cardImage(cardId) ?? ''}
        shape={kindOf(cardId) === CardKind.Relic ? 'relic' : 'card'}
        {name}
        detail={line}
        tag="in use"
        {on}
        {disabled}
        {width}
        {onclick}
    />
    <Magnifier preview={{ cardId, label: name }} label={name} size="small" />
</span>
