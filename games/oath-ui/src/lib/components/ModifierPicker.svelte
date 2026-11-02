<script lang="ts">
    import { powerCardName } from '$lib/model/names.js'
    import { pickerWords } from '$lib/model/powerPickerWords.js'
    import { IMPERIAL_WARBANDS, powerKey, type CardPower } from '@tabletop/oath'
    import CardLine from '$lib/components/CardLine.svelte'
    import CardToggleRow from '$lib/components/CardToggleRow.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { powerUseKey } from '$lib/model/powerUse.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import type { ModifierRows } from '$lib/model/modifierRows.js'
    import {
        ACTION_CARD_CONSEQUENCES,
        actionCardLine,
        answerCostText
    } from '$lib/model/actionCards.js'

    // R-7.4 — declared with the action; mandatory ones (R-7.4.1) never appear here. Each card is a
    // framed row under "Cards"; the free gains start in use, and a tap puts one down. `rows`: the
    // staged action's cards, or those a power's use declares (Oracle). `tagUnder`: rows in a narrow
    // column beside a card put "in use" under the line on a phone. `spacing`: the margin around the
    // block, under it in an action's menu, above it on a power's row (whose "Use" sits close under it).
    let {
        rows,
        tagUnder = false,
        spacing = 'mb-2'
    }: { rows: ModifierRows; tagUnder?: boolean; spacing?: 'mb-2' | 'mt-1' } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)

    let listed = $derived(rows.listed)
    const width = new ChoiceWidth()

    // A gained warband is drawn in the colour the seat gains it in, the Empire's for a Citizen.
    let owner = $derived(gameSession.musterWarbandOwner ?? IMPERIAL_WARBANDS)
    const warbandColor = () => gameSession.warbandColor(owner)

    function toggle(power: CardPower) {
        const use = powerUseKey(power)
        rows.declare(use, !rows.isDeclared(use))
    }
</script>

{#if listed.length > 0}
    <div class="{spacing} text-xs">
        <h4 class="mb-1 text-[11px] font-semibold uppercase tracking-widest text-oath-heading">
            Cards
        </h4>
        <div class="flex flex-wrap gap-1.5">
            {#each listed as power (powerKey(power.cardId, power.powerIndex))}
                <CardToggleRow
                    cardId={power.cardId}
                    on={rows.isDeclared(powerUseKey(power))}
                    disabled={busy}
                    {width}
                    {tagUnder}
                    onclick={() => toggle(power)}
                >
                    {#snippet line()}<CardLine
                            lender={rows.lenderOf(power)}
                            gives={actionCardLine(power.cardId, gameSession.gameState)}
                            cost={answerCostText(power.cost)}
                            consequence={ACTION_CARD_CONSEQUENCES[power.cardId]}
                            {warbandColor}
                        />{/snippet}
                </CardToggleRow>
            {/each}
        </div>
        {#each listed as power (powerKey(power.cardId, power.powerIndex))}
            <!-- A card whose pile the menu's rows pick (Errand Boy, Observatory) draws no picker. -->
            {#if rows.isDeclared(powerUseKey(power)) && !rows.picksInMenu(power)}
                {@const legal = rows.choicesOf(power)}
                {@const words = pickerWords(power.cardId)}
                {#if legal.length > 0}
                    <div class="mt-1" data-modifier-picks={power.cardId}>
                        <!-- A card's own few words ("To:") stand for its name. -->
                        {#if !words.pile}
                            <div class="text-oath-text-muted mb-0.5">
                                {powerCardName(power.cardId, power.powerIndex)}:
                            </div>
                        {/if}
                        <PowerChoicePicker
                            choices={legal}
                            bind:picks={
                                () => rows.picksOf(powerUseKey(power)),
                                (picks) => rows.setPicks(powerUseKey(power), picks)
                            }
                            {words}
                        />
                    </div>
                {/if}
            {/if}
        {/each}
    </div>
{/if}
