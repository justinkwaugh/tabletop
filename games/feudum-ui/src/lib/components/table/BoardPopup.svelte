<script lang="ts">
    import { flip, shift } from '@floating-ui/dom'
    import { Floater } from '@tabletop/frontend-components'
    import type { FlowPopup } from '$lib/model/cardFlows.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import DieChoice from '$lib/components/panel/DieChoice.svelte'
    import RowChoice from '$lib/components/panel/RowChoice.svelte'
    import PanelRow from './PanelRow.svelte'

    /** Contract, Coexistence and precedence: a manual popover, since a press outside it closes nothing. */
    let { popup }: { popup: FlowPopup } = $props()

    const gameSession = getGameSession()
    const phone = new PhoneLayout()

    const PopupDie = 56

    const dice = $derived(popup.choices.every(({ art }) => art?.kind === 'die'))
    const discs = $derived(popup.choices.every(({ art }) => art?.kind === 'disc'))

    const reference = $derived(
        gameSession.benchCovers
            ? `[data-bench] [data-pick="${popup.anchor}"]`
            : `[data-board-surface] [data-pick="${popup.anchor}"], [data-guild-view] [data-pick-anchor="${popup.anchor}"]`
    )

    /** The shared Floater names its role a tooltip; this holds choices. */
    const popoverAttributes = $derived({
        role: 'group',
        'aria-label': popup.heading ?? 'Choose',
        style: 'margin:0;border:0;padding:0;overflow:visible',
        'data-board-popup': popup.anchor
    })

    /** No hide(): toggling the popup hidden as the phone frames the board loops its ResizeObserver. */
    const StayInView = [flip({ altBoundary: true }), shift({ altBoundary: true })]
</script>

{#key popup.anchor}
    <Floater
        {reference}
        placement={phone.phone ? 'top' : 'right-start'}
        strategy="fixed"
        trigger="manual"
        middlewares={StayInView}
        {...popoverAttributes}
    >
        <div
            class="rounded-lg border border-feudum-accent bg-feudum-surface-raised p-2
                {dice
                ? 'grid grid-cols-3 justify-items-center gap-x-3 gap-y-2'
                : discs
                  ? 'flex max-w-xs flex-wrap items-center gap-1'
                  : 'flex flex-col items-stretch gap-1'}"
            data-popup-dice={dice ? '' : undefined}
        >
            {#if popup.heading}
                <p class="w-full text-sm" data-popup-heading>{popup.heading}</p>
            {/if}
            {#each popup.choices as choice (choice.label)}
                {#if choice.art?.kind === 'disc'}
                    <RowChoice
                        row={{
                            choice,
                            art: choice.art,
                            press: () => gameSession.pressPopupChoice(choice)
                        }}
                        pointer={gameSession}
                    />
                {:else if choice.art?.kind === 'die'}
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
