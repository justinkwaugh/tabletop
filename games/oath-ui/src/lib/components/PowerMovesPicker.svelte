<script lang="ts">
    import { CardKind, type WarbandOwner } from '@tabletop/oath'
    import MenuToggleRow from '$lib/components/MenuToggleRow.svelte'
    import TokenRow from '$lib/components/TokenRow.svelte'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { warbandFigure } from '$lib/images/pieceImages.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { siteName } from '$lib/model/names.js'
    import {
        sameFrom,
        sameTo,
        withCount,
        withFrom,
        withTo,
        type MoveFrom,
        type MovePick,
        type MoveTo,
        type PowerMoves
    } from '$lib/model/powerMoves.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Messenger's moves, one at a time: From, How many and To as the engine offers them on the
    // state the moves before leave. A whole move folds to its line and the next From opens under it;
    // Undo takes the picks back. No From opens once the power's moves are all used.
    let {
        moves,
        picks,
        onchange
    }: {
        moves: PowerMoves
        picks: MovePick[]
        onchange: (picks: MovePick[]) => void
    } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let gameState = $derived(gameSession.gameState)
    let index = $derived(moves.whole.length)
    let open = $derived(moves.open)

    // The label beside its row on a desktop, above it on a phone.
    const ROW =
        'grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 max-sm:grid-cols-1'

    const fromWidth = new ChoiceWidth()
    const toWidth = new ChoiceWidth()

    function placeName(at: MoveFrom['at'] | MoveTo, capital: boolean): string {
        if (at.kind === 'site') return siteName(gameState, at.siteId)
        return capital ? 'Your board' : 'your board'
    }

    function siteImage(siteId: string): string {
        const cardId = gameState.isSiteFaceup(siteId) ? gameState.siteCardAt(siteId) : undefined
        return (cardId ? cardImage(cardId) : undefined) ?? cardBack(CardKind.Site)
    }

    function figure(owner: WarbandOwner) {
        return warbandFigure(gameSession.warbandColor(owner))
    }

    function placeImage(at: MoveFrom['at'] | MoveTo, owner: WarbandOwner): string {
        return at.kind === 'site' ? siteImage(at.siteId) : figure(owner).src
    }
</script>

{#snippet warbands(count: number, owner: WarbandOwner)}
    {@const piece = figure(owner)}
    <span class="inline-flex items-center gap-0.5 whitespace-nowrap"
        >{count}<img
            class="inline-block h-[1.2em] w-auto"
            src={piece.src}
            width={piece.width}
            height={piece.height}
            alt={count === 1 ? 'warband' : 'warbands'}
        /></span
    >
{/snippet}

<div class="flex flex-col gap-1.5 text-xs">
    {#each moves.whole as move, i (i)}
        <p class="text-sm" data-move={i}>
            {@render warbands(move.count, move.from.owner)}
            {placeName(move.from.at, false)} → {placeName(move.to, false)}
        </p>
    {/each}
    {#if open && open.sources.length > 0}
        <div class={ROW}>
            <span class="text-oath-text-muted">From:</span>
            <div class="flex flex-wrap gap-1.5">
                {#each open.sources as source (`${source.owner}@${JSON.stringify(source.at)}`)}
                    {@const spoken = `${placeName(source.at, true)}, ${source.count} free`}
                    <MenuToggleRow
                        image={placeImage(source.at, source.owner)}
                        shape={source.at.kind === 'board' ? 'piece' : 'wide'}
                        label={spoken}
                        on={open.from !== undefined && sameFrom(open.from, source)}
                        disabled={busy}
                        width={fromWidth}
                        onclick={() => onchange(withFrom(picks, index, source))}
                    >
                        {#snippet name()}{placeName(source.at, true)}
                            <span class="font-normal"
                                >{@render warbands(source.count, source.owner)}</span
                            >{/snippet}
                    </MenuToggleRow>
                {/each}
            </div>
        </div>
        {#if open.from}
            {@const from = open.from}
            <div class={ROW}>
                <span class="text-oath-text-muted">How many:</span>
                <TokenRow
                    image={figure(from.owner)}
                    held={open.free}
                    addable={open.free}
                    picked={open.count ?? 0}
                    label={(n) => `How many: ${n}`}
                    ontap={(n) => onchange(withCount(picks, index, open?.count, n))}
                    {busy}
                />
            </div>
            {#if open.count !== undefined}
                <div class={ROW}>
                    <span class="text-oath-text-muted">To:</span>
                    <div class="flex flex-wrap gap-1.5">
                        {#each open.destinations as to (to.kind === 'site' ? to.siteId : 'board')}
                            <MenuToggleRow
                                image={placeImage(to, from.owner)}
                                shape={to.kind === 'board' ? 'piece' : 'wide'}
                                name={placeName(to, true)}
                                on={open.to !== undefined && sameTo(open.to, to)}
                                disabled={busy}
                                width={toWidth}
                                onclick={() => onchange(withTo(picks, index, to))}
                            />
                        {/each}
                    </div>
                </div>
            {/if}
        {/if}
    {/if}
</div>
