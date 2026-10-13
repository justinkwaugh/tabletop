<script lang="ts">
    import { powerKey, type CardPower } from '@tabletop/oath'
    import CardLine from '$lib/components/CardLine.svelte'
    import CardToggleRow from '$lib/components/CardToggleRow.svelte'
    import { answerCostText } from '$lib/model/actionCards.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'

    // R-5.5.3, R-7.1.2 — the battle plans as card rows: the small card with its magnifier, the
    // name, what using it costs in gold, and "in use" while picked; the rows share one width.
    let {
        plans,
        isOn,
        toggle,
        busy
    }: {
        plans: readonly CardPower[]
        isOn: (power: CardPower) => boolean
        toggle: (power: CardPower) => void
        busy: boolean
    } = $props()

    const width = new ChoiceWidth()
</script>

<div class="flex flex-wrap gap-1.5" data-plan-rows>
    {#each plans as power (powerKey(power.cardId, power.powerIndex))}
        {@const cost = answerCostText(power.cost)}
        {#if cost}
            <CardToggleRow
                cardId={power.cardId}
                on={isOn(power)}
                disabled={busy}
                {width}
                onclick={() => toggle(power)}
            >
                {#snippet line()}<CardLine {cost} />{/snippet}
            </CardToggleRow>
        {:else}
            <CardToggleRow
                cardId={power.cardId}
                on={isOn(power)}
                disabled={busy}
                {width}
                onclick={() => toggle(power)}
            />
        {/if}
    {/each}
</div>
