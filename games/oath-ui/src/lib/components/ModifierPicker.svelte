<script lang="ts">
    import { cardName } from '$lib/model/names.js'
    import { ActionType, IMPERIAL_WARBANDS, powerKey, type CardPower } from '@tabletop/oath'
    import CardLine from '$lib/components/CardLine.svelte'
    import CardToggleRow from '$lib/components/CardToggleRow.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { powerUseKey } from '$lib/model/powerUse.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import {
        ACTION_CARD_CONSEQUENCES,
        actionCardLine,
        answerCostText
    } from '$lib/model/actionCards.js'

    // R-7.4 — declared with the action; mandatory ones (R-7.4.1) never appear here. Each card is a
    // framed row under "Cards"; the free gains start in use, and a tap puts one down.
    let { action }: { action: ActionType } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)

    let listed = $derived(
        action === gameSession.selection.action ? gameSession.modifiers.listed : []
    )
    const width = new ChoiceWidth()

    // A gained warband is drawn in the colour the seat gains it in, the Empire's for a Citizen.
    let owner = $derived(gameSession.musterWarbandOwner ?? IMPERIAL_WARBANDS)
    const warbandColor = () => gameSession.warbandColor(owner)

    function toggle(power: CardPower) {
        const use = powerUseKey(power)
        gameSession.modifiers.declare(use, !gameSession.modifiers.isDeclared(use))
    }
</script>

{#if listed.length > 0}
    <div class="mb-2 text-xs">
        <h4 class="mb-1 text-[11px] font-semibold uppercase tracking-widest text-oath-heading">
            Cards
        </h4>
        <div class="flex flex-wrap gap-1.5">
            {#each listed as power (powerKey(power.cardId, power.powerIndex))}
                <CardToggleRow
                    cardId={power.cardId}
                    on={gameSession.modifiers.isDeclared(powerUseKey(power))}
                    disabled={busy}
                    {width}
                    onclick={() => toggle(power)}
                >
                    {#snippet line()}<CardLine
                            gives={actionCardLine(power.cardId)}
                            cost={answerCostText(power.cost)}
                            consequence={ACTION_CARD_CONSEQUENCES[power.cardId]}
                            {warbandColor}
                        />{/snippet}
                </CardToggleRow>
            {/each}
        </div>
        {#each listed as power (powerKey(power.cardId, power.powerIndex))}
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
