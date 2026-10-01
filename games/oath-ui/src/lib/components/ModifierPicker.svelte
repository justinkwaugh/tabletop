<script lang="ts">
    import { cardName } from '$lib/model/names.js'
    import { ActionType, powerKey } from '@tabletop/oath'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { powerUseCards } from '$lib/model/cardChoice.js'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { powerUseKey } from '$lib/model/powerUse.js'

    // R-7.4 — declared with the action; mandatory ones (R-7.4.1) never appear here.
    let { action }: { action: ActionType } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)

    let usable = $derived(
        action === gameSession.selection.action ? gameSession.modifiers.options : []
    )
</script>

{#if usable.length > 0}
    <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
        <div class="mb-1 text-oath-text-muted">Tap a card to use it with this action:</div>
        <CardChoiceRow
            choices={powerUseCards(usable)}
            picked={usable
                .filter((power) => gameSession.modifiers.isDeclared(powerUseKey(power)))
                .map((power) => powerKey(power.cardId, power.powerIndex))}
            onpick={(key) => {
                const power = usable.find((p) => powerKey(p.cardId, p.powerIndex) === key)
                if (power) {
                    const use = powerUseKey(power)
                    gameSession.modifiers.declare(use, !gameSession.modifiers.isDeclared(use))
                }
            }}
            {busy}
            height={100}
        />
        {#each usable as power (powerKey(power.cardId, power.powerIndex))}
            {#if gameSession.modifiers.isDeclared(powerUseKey(power))}
                {@const legal = gameSession.modifiers.choicesOf(power)}
                {#if legal.length > 0}
                    <div class="mt-1">
                        <div class="text-oath-text-muted mb-0.5">
                            {cardName(power.cardId)}:
                        </div>
                        <PowerChoicePicker
                            choices={legal}
                            bind:picks={
                                () => gameSession.modifiers.picksOf(powerUseKey(power)),
                                (picks) => gameSession.modifiers.setPicks(powerUseKey(power), picks)
                            }
                        />
                    </div>
                {/if}
            {/if}
        {/each}
    </div>
{/if}
