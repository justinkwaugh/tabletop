<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import type { FlowPopup } from '$lib/model/cardFlows.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PanelRow from './PanelRow.svelte'

    /**
     * A popup beside its anchor, over the board (contract: Popups). A manual popover, since a press
     * outside it does nothing and closes nothing; Undo removes it.
     */
    let { popup }: { popup: FlowPopup } = $props()

    const gameSession = getGameSession()

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
        reference={`[data-board-surface] [data-pick="${popup.anchor}"]`}
        placement="right-start"
        strategy="fixed"
        trigger="manual"
        {...popoverAttributes}
    >
        <div
            class="flex flex-col items-stretch gap-1 rounded-lg border border-feudum-accent bg-feudum-surface-raised p-2"
        >
            {#each popup.choices as choice (choice.label)}
                <PanelRow {choice} onPress={(row) => void gameSession.pressPopupChoice(row)} />
            {/each}
        </div>
    </Floater>
{/key}
