<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import type { FlowPopup } from '$lib/model/cardFlows.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import DieChoice from '$lib/components/panel/DieChoice.svelte'
    import PanelRow from './PanelRow.svelte'

    /**
     * A popup beside its anchor, over the board (contract: Popups). A manual popover, since a press
     * outside it does nothing and closes nothing; Undo removes it. Guild choices stand as their dice
     * in rows of three.
     */
    let { popup }: { popup: FlowPopup } = $props()

    const gameSession = getGameSession()
    const phone = new PhoneLayout()

    /** A popup's die face, smaller than the panel's so the grid sits beside its space. */
    const PopupDie = 56

    const dice = $derived(popup.choices.every(({ art }) => art?.kind === 'die'))

    /** Under an open bench its own guild area is the anchor; the board's is covered. */
    const reference = $derived(
        `${gameSession.benchCovers ? '[data-bench]' : '[data-board-surface]'} [data-pick="${popup.anchor}"]`
    )

    /** The shared Floater names its role a tooltip; this holds choices. */
    const popoverAttributes = $derived({
        role: 'group',
        'aria-label': 'Choose',
        style: 'margin:0;border:0;padding:0;overflow:visible',
        'data-board-popup': popup.anchor
    })
</script>

{#key popup.anchor}
    <Floater
        {reference}
        placement={phone.phone ? 'top' : 'right-start'}
        strategy="fixed"
        trigger="manual"
        {...popoverAttributes}
    >
        <div
            class="rounded-lg border border-feudum-accent bg-feudum-surface-raised p-2
                {dice
                ? 'grid grid-cols-3 justify-items-center gap-x-3 gap-y-2'
                : 'flex flex-col items-stretch gap-1'}"
            data-popup-dice={dice ? '' : undefined}
        >
            {#each popup.choices as choice (choice.label)}
                {#if choice.art?.kind === 'die'}
                    <DieChoice
                        {choice}
                        art={choice.art}
                        size={PopupDie}
                        pointer={gameSession}
                        onPress={(row) => void gameSession.pressPopupChoice(row)}
                    />
                {:else}
                    <PanelRow
                        {choice}
                        pointer={gameSession}
                        onPress={(row) => void gameSession.pressPopupChoice(row)}
                    />
                {/if}
            {/each}
        </div>
    </Floater>
{/key}
