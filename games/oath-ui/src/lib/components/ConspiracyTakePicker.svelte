<script lang="ts">
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { cardChoices } from '$lib/model/cardChoice.js'
    import { type ConspiracyPick, type TakePrizeOption } from '$lib/model/conspiracyTake.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.1.4.IV — burn one secret to take a relic or banner from a player at your site.
    let {
        targets,
        prizesOf,
        pick,
        onchange
    }: {
        targets: string[]
        prizesOf: (targetPlayerId: string) => TakePrizeOption[]
        pick: ConspiracyPick
        onchange: (pick: Omit<ConspiracyPick, 'confirmed'>) => void
    } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let target = $derived(
        pick.targetPlayerId !== undefined && targets.includes(pick.targetPlayerId)
            ? pick.targetPlayerId
            : undefined
    )
    let prizes = $derived(target ? prizesOf(target) : [])
    let picked = $derived(pick.prizeIndex === undefined ? undefined : prizes[pick.prizeIndex])

    function tapPrize(index: number) {
        onchange({
            targetPlayerId: target,
            prizeIndex: pick.prizeIndex === index ? undefined : index
        })
    }
</script>

<label class="flex items-center gap-2 text-xs mb-1">
    take from
    <select
        class="rounded bg-oath-surface-raised px-1 py-0.5 grow"
        disabled={busy}
        value={target ?? ''}
        onchange={(e) => onchange({ targetPlayerId: e.currentTarget.value || undefined })}
    >
        <option value="">nobody</option>
        {#each targets as id (id)}<option value={id}>{gameSession.getPlayerName(id)}</option>{/each}
    </select>
</label>
{#if target}
    <!-- A relic is a card; a banner keeps its own chip. -->
    <div class="mb-2 text-xs">
        <CardChoiceRow
            choices={cardChoices(
                prizes.flatMap((option) =>
                    option.prize.kind === 'relic' ? [option.prize.cardId] : []
                )
            )}
            picked={picked?.prize.kind === 'relic' ? [picked.prize.cardId] : []}
            onpick={(cardId) =>
                tapPrize(
                    prizes.findIndex(
                        (option) => option.prize.kind === 'relic' && option.prize.cardId === cardId
                    )
                )}
            {busy}
            height={80}
        />
        <div class="mt-1 flex flex-wrap gap-1">
            {#each prizes as option, index (option.label)}
                {#if option.prize.kind === 'banner'}
                    <button
                        type="button"
                        class="rounded border px-2 py-0.5 {pick.prizeIndex === index
                            ? 'border-oath-accent bg-oath-accent-soft'
                            : 'border-oath-divider hover:border-oath-accent'}"
                        aria-pressed={pick.prizeIndex === index}
                        disabled={busy}
                        onclick={() => tapPrize(index)}
                    >
                        {option.label}
                    </button>
                {/if}
            {/each}
        </div>
    </div>
{/if}
