<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { cardChoices } from '$lib/model/cardChoice.js'
    import { type ConspiracyPick, type TakePrizeOption } from '$lib/model/conspiracyTake.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.1.4.IV — burn one secret to take a relic or banner from a player at your site.
    let {
        targets,
        prizesOf,
        pick,
        onchange,
        ask
    }: {
        targets: string[]
        prizesOf: (targetPlayerId: string) => TakePrizeOption[]
        pick: ConspiracyPick
        onchange: (pick: Omit<ConspiracyPick, 'confirmed'>) => void
        /** A question's few words before the players, where the panel has not asked it already. */
        ask?: string
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

<!-- A player is their chip: a tap picks them, a second tap drops them; none picked takes nothing. -->
<div class="mb-1 flex flex-wrap items-center gap-2 text-xs">
    {#if ask}<span class="text-oath-text-muted">{ask}</span>{/if}
    <span class="text-oath-text-muted">From:</span>
    {#each targets as id (id)}
        <button
            type="button"
            class="rounded p-0.5 text-sm max-sm:min-h-11 {target === id
                ? 'ring-2 ring-oath-accent'
                : 'ring-1 ring-transparent hover:ring-oath-accent'}"
            aria-pressed={target === id}
            disabled={busy}
            onclick={() => onchange({ targetPlayerId: target === id ? undefined : id })}
        >
            <PlayerName playerId={id} />
        </button>
    {/each}
</div>
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
