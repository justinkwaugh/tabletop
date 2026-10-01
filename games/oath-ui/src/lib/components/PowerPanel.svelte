<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { cardPower, powerKey, type LegalPowerUse, type PowerUseKey } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName, humanizeReason } from '$lib/model/names.js'

    // R-6.2, R-7.3.2 — "Action:" powers, each with the choices its text opens.
    let gameSession = getGameSession()
    let draft = $derived(gameSession.actionPowers)
    let busy = $derived(gameSession.busy)

    function textOf(p: PowerUseKey): string {
        const power = cardPower(p.cardId, p.powerIndex)
        assertExists(power, `${p.cardId} prints no power ${p.powerIndex}`)
        return power.text
    }
    function reasonFor(p: LegalPowerUse): string | undefined {
        return draft.reasonCannotUse(p)
    }
</script>

<div class="flex flex-col gap-1">
    {#if draft.powers.length === 0}
        <p class="text-xs text-stone-400">No usable "Action:" power right now.</p>
    {/if}
    {#each draft.powers as p (powerKey(p.cardId, p.powerIndex))}
        {@const reason = reasonFor(p)}
        <div class="rounded border border-stone-700 px-2 py-1.5 flex gap-2 items-start">
            <div class="shrink-0">
                <CardImage cardId={p.cardId} width={64} label={cardName(p.cardId)} inspect />
            </div>
            <div class="grow min-w-0">
                <div class="text-sm">
                    <span class="font-semibold">{cardName(p.cardId)}</span>
                    <span class="text-stone-400 text-xs"> — {textOf(p)}</span>
                </div>
                {#if p.choices.length > 0}
                    <div class="mt-1">
                        <PowerChoicePicker
                            choices={p.choices}
                            bind:picks={() => draft.picksOf(p), (picks) => draft.setPicks(p, picks)}
                        />
                    </div>
                {/if}
                {#if reason}
                    <p class="text-[11px] text-rose-300">{humanizeReason(reason)}</p>
                {/if}
                <button
                    class="mt-1 rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 px-2 py-0.5 text-xs"
                    disabled={busy || !!reason}
                    onclick={() => draft.use(p)}
                >
                    Use
                </button>
            </div>
        </div>
    {/each}
</div>
