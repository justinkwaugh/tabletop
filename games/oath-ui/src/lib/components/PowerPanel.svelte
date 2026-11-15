<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { assertExists } from '@tabletop/common'
    import { cardPower, powerKey, type LegalPowerUse, type PowerUseKey } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import FavorCost from '$lib/components/FavorCost.svelte'
    import PowerMovesPicker from '$lib/components/PowerMovesPicker.svelte'
    import ModifierPicker from '$lib/components/ModifierPicker.svelte'
    import ScepterChoice from '$lib/components/ScepterChoice.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { powerCardName } from '$lib/model/names.js'
    import { pickerWords } from '$lib/model/powerPickerWords.js'
    import { awaitsFirstPick } from '$lib/model/powerChoices.js'
    import { answerCostText } from '$lib/model/actionCards.js'
    import { GRAND_SCEPTER } from '$lib/model/cardUses.js'

    // R-6.2, R-7.3.2 — "Action:" powers, each with the choices its text opens. Opened from a card's
    // "Use", the panel holds that card's powers alone; the Grand Scepter's offers its two uses.
    let gameSession = getGameSession()
    let draft = $derived(gameSession.actionPowers)
    let busy = $derived(gameSession.busy)

    function powerOf(p: PowerUseKey) {
        const power = cardPower(p.cardId, p.powerIndex)
        assertExists(power, `${p.cardId} prints no power ${p.powerIndex}`)
        return power
    }
    function reasonFor(p: LegalPowerUse): string | undefined {
        return draft.reasonCannotUse(p)
    }

    let scepter = $derived(draft.card === GRAND_SCEPTER)

    // R-7.1.2 — what the press pays, in gold after "Use", as a question's yes shows it.
    function useCost(p: PowerUseKey): string | undefined {
        return answerCostText(powerOf(p).cost)
    }
</script>

{#snippet useRow(
    p: LegalPowerUse,
    complete: boolean,
    reason: string | undefined,
    cost: string | undefined
)}
    <!-- "Use" waits for complete picks; complete picks the engine refuses show its reason instead,
         once there is a pick to judge (the Ivory Eye's are all optional, so complete from the start). -->
    {#if complete && reason}
        {#if !awaitsFirstPick(p.choices, draft.picksOf(p))}
            <p class="text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(reason) ?? ''} />
            </p>
        {/if}
    {:else if complete}
        <button
            class="mt-1 inline-flex items-center gap-1 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 border-[1.5px] border-oath-primary-border px-2 py-0.5 text-xs max-sm:min-h-11"
            disabled={busy}
            aria-label={cost ? `Use, paying ${cost}` : undefined}
            onclick={() => draft.use(p)}
        >
            Use{#if cost}<span aria-hidden="true">·</span><span class="text-oath-accent"
                    ><TokenText text={cost} /></span
                >{/if}
        </button>
    {/if}
{/snippet}

<div class="flex flex-col gap-1">
    {#if scepter}
        <ScepterChoice />
    {:else if draft.powers.length === 0}
        <p class="text-xs text-oath-text-muted">No usable "Action:" power right now.</p>
    {/if}
    {#each draft.powers as p (powerKey(p.cardId, p.powerIndex))}
        {@const reason = reasonFor(p)}
        {@const name = powerCardName(p.cardId, p.powerIndex)}
        {@const cost = useCost(p)}
        {@const moves = draft.movesOf(p)}
        {@const complete = draft.picksComplete(p)}
        <!-- Messenger's moves sit beside its card, under its name; on a phone they run the panel's width under its card. -->
        <div
            class="border-t border-oath-divider pt-1.5 gap-2 items-start {moves
                ? 'grid grid-cols-[auto_minmax(0,1fr)] gap-y-1'
                : 'flex'}"
            data-action-power={p.cardId}
        >
            <span
                class="relative inline-flex shrink-0 {moves ? 'row-span-2 max-sm:row-span-1' : ''}"
            >
                <CardImage cardId={p.cardId} width={64} label={name} inspect />
                <Magnifier preview={{ cardId: p.cardId, label: name }} label={name} size="medium" />
            </span>
            <div class="grow min-w-0 {moves ? 'max-sm:self-center' : ''}">
                <div class="text-sm font-semibold">{name}</div>
                {#each draft.tollsOf(p) as toll (toll.cardId)}
                    <p class="mt-1 text-sm">
                        <FavorCost sign="+" count={1} />
                        {#if toll.payeeId}to <PlayerName
                                playerId={toll.payeeId}
                            />{:else}burned{/if}
                    </p>
                {/each}
                {#if !moves}
                    {#if p.choices.length > 0}
                        <div class="mt-1">
                            <PowerChoicePicker
                                choices={p.choices}
                                bind:picks={
                                    () => draft.picksOf(p), (picks) => draft.setPicks(p, picks)
                                }
                                tollAt={draft.moveTollAt(p)}
                                words={pickerWords(p.cardId)}
                                siteOnMap={(spec) => draft.siteRow(p, spec)}
                            />
                        </div>
                    {/if}
                    <!-- R-6.1, R-7.4 — Oracle declares the Search modifiers acting on its play before the draw. -->
                    {@const modifierRows = draft.modifierRows(p)}
                    {#if modifierRows}
                        <div data-power-modifiers={p.cardId}>
                            <ModifierPicker rows={modifierRows} tagUnder spacing="mt-1" />
                        </div>
                    {/if}
                    {@render useRow(p, complete, reason, cost)}
                {/if}
            </div>
            {#if moves}
                <div class="col-start-2 min-w-0 max-sm:col-span-2 max-sm:col-start-1">
                    <PowerMovesPicker
                        {moves}
                        picks={draft.picksOf(p).moves}
                        onchange={(picks) => draft.setMoves(p, picks)}
                    />
                    {@render useRow(p, complete, reason, cost)}
                </div>
            {/if}
        </div>
    {/each}
</div>
