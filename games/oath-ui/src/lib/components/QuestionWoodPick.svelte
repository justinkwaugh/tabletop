<script lang="ts">
    import { CardKind, PowerQuestionKind, type PowerQuestion } from '@tabletop/oath'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { regionName, siteName } from '$lib/model/names.js'
    import { woodCostNoteShort } from '$lib/model/woodTravel.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-11.7 — the traveller's own Travel: only the sites they can pay for, by region and price.
    let {
        question
    }: { question: Extract<PowerQuestion, { kind: PowerQuestionKind.ShroudedWoodDestination }> } =
        $props()

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let traveler = $derived(gameSession.getPlayerName(question.travelerPlayerId))
    let supply = $derived(gameState.getPlayerState(question.travelerPlayerId).supply)

    function picture(slotId: string): string {
        const cardId = gameState.siteCardAt(slotId)
        const faceup = cardId !== undefined && gameState.isSiteFaceup(slotId)
        return (faceup ? cardImage(cardId) : undefined) ?? cardBack(CardKind.Site)
    }
</script>

<p class="text-sm mb-2.5">
    You rule the Shrouded Wood: choose where {traveler} goes. {traveler} pays when you choose, and has
    {supply} Supply.
</p>
<div
    class="inline-grid auto-cols-fr grid-flow-col items-start gap-x-5 max-sm:flex max-sm:w-full max-sm:flex-col max-sm:items-stretch max-sm:gap-2"
>
    {#each draft.woodRegions as row (`${row.region}:${row.cost}`)}
        <div class="min-w-0" role="group" aria-label="Sites in the {regionName(row.region)}">
            <div class="mb-1.5 max-sm:mb-1 max-sm:flex max-sm:items-baseline max-sm:gap-2">
                <h4 class="text-[10.5px] font-bold uppercase tracking-[0.14em] text-oath-heading">
                    {regionName(row.region)}
                </h4>
                <p class="whitespace-nowrap text-sm">
                    <span class="font-bold text-oath-accent">{row.cost}</span> Supply
                    {#if row.foldedBy.length > 0}
                        <span class="ml-0.5 text-[12.5px] text-oath-text-muted"
                            >{woodCostNoteShort(row)}</span
                        >
                    {/if}
                </p>
            </div>
            <div
                class="flex flex-col gap-1.5 max-sm:grid max-sm:auto-cols-[minmax(0,1fr)] max-sm:grid-flow-col max-sm:gap-1"
            >
                {#each row.siteIds as slotId (slotId)}
                    <button
                        class="flex w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-md border border-oath-frame
                               bg-oath-surface py-1 pr-3 pl-1 text-left text-[15px] leading-tight font-semibold
                               hover:bg-oath-surface-raised disabled:opacity-40
                               max-sm:min-h-[42px] max-sm:gap-1.5 max-sm:pr-1.5 max-sm:text-[13px]"
                        disabled={busy}
                        onclick={() => draft.sendThrough(slotId)}
                    >
                        <img
                            src={picture(slotId)}
                            alt=""
                            class="h-[34px] w-11 shrink-0 rounded object-cover
                                   {row.siteIds.length > 2
                                ? 'max-sm:h-5 max-sm:w-[26px]'
                                : 'max-sm:h-7 max-sm:w-9'}"
                        />
                        <span class="min-w-0">{siteName(gameState, slotId)}</span>
                    </button>
                {/each}
            </div>
        </div>
    {/each}
</div>
