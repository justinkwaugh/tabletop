<script lang="ts" module>
    export const SquarePickerAnchorId = 'reef-square-picker-anchor'
</script>

<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import type { ReefSquare } from '@tabletop/reef-encounter'
    import ChoiceButton from '$lib/components/action/ChoiceButton.svelte'
    import PolypChip from '$lib/components/PolypChip.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const square: ReefSquare | undefined = $derived(
        gameSession.placementSquare ??
            (gameSession.shrimpIntent?.kind === 'move' ? gameSession.shrimpIntent.from : undefined)
    )
    const color = $derived(gameSession.placing?.color)
    const key = (square: ReefSquare) =>
        `${square.boardId}:${square.coords.row}:${square.coords.col}`
</script>

{#if square}
    {#key key(square)}
        <Floater reference="#{SquarePickerAnchorId}" trigger="manual" placement="right" offset={6}>
            <div class="picker reef-glass" role="group" aria-label="Finish this choice">
                {#if gameSession.placementSquare && color}
                    <ChoiceButton
                        label="Place a {color} polyp from your supply"
                        onclick={() => gameSession.placePolypFrom('supply')}
                    >
                        <PolypChip {color} count={1} />
                        <span class="choice-text">From your supply</span>
                    </ChoiceButton>
                    <ChoiceButton
                        label="Place a consumed {color} polyp"
                        onclick={() => gameSession.placePolypFrom('consumed')}
                    >
                        <PolypChip {color} count={1} consumed />
                        <span class="choice-text">Consumed</span>
                    </ChoiceButton>
                {:else}
                    <ChoiceButton
                        label="Put the shrimp back in your supply"
                        onclick={() => gameSession.returnShrimpToSupply()}
                    >
                        <span class="choice-text">Back to your supply</span>
                    </ChoiceButton>
                {/if}
            </div>
        </Floater>
    {/key}
{/if}

<style>
    .picker {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        font-family: 'Reef Nunito', 'Trebuchet MS', sans-serif;
    }

    .choice-text {
        padding-inline: 6px;
        font-size: 14px;
    }
</style>
