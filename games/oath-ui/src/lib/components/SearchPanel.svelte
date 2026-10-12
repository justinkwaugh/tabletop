<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import CardImage from '$lib/components/CardImage.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import DiscardOrderCards from '$lib/components/DiscardOrderCards.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { cardChoices, toggleSingle } from '$lib/model/cardChoice.js'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import ConspiracyTakePicker from '$lib/components/ConspiracyTakePicker.svelte'
    import { ActionType } from '@tabletop/oath'
    import { actionName } from '$lib/model/actionCatalogue.js'
    import { siteName, cardName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let search = $derived(gameSession.search)
    let busy = $derived(gameSession.busy)

    // One short line per step under the bar; the cards and rings show the rest.
    let step = $derived.by(() => {
        if (!search.kept) return 'Keep one.'
        if (!search.placement) return 'How do you play it?'
        if (search.needsDisplaced) {
            const needed = search.room.needed
            return needed === 1 ? 'Discard 1 adviser.' : `Discard ${needed} advisers.`
        }
        if (search.needsConspiracy) return 'The Conspiracy: take a relic or banner?'
        if (search.needsWhenPlayed) return `${cardName(search.kept)}: choose.`
        return 'Tap to discard; the last goes on top.'
    })
</script>

<div>
    <!-- The staged actions' bar names the action over every step. -->
    <div class="mb-2 rounded bg-oath-accent-soft px-2 py-1.5">
        <span class="text-sm">{actionName(ActionType.Search)}</span>
    </div>
    <p class="mb-2 text-sm font-semibold">{step}</p>

    {#if !search.kept}
        <div class="flex flex-wrap gap-2">
            {#each search.drawn as cardId (cardId)}
                <div class="relative">
                    <button
                        type="button"
                        class="rounded-[5px] ring-1 ring-oath-control-hover hover:ring-oath-accent"
                        disabled={busy}
                        onclick={() => search.keep(cardId)}
                    >
                        <CardImage
                            {cardId}
                            width={widthAtHeight(112, { cardId })}
                            label={cardName(cardId)}
                        />
                    </button>
                    <Magnifier
                        preview={{ cardId, label: cardName(cardId) }}
                        label={cardName(cardId)}
                    />
                </div>
            {/each}
        </div>
    {:else if !search.placement}
        {#if search.otherSites.length > 0}
            <label class="mb-2 flex items-center gap-2 text-xs">
                <span class="text-oath-text-muted">Play to:</span>
                <select
                    disabled={busy}
                    class="rounded bg-oath-surface-raised px-1 py-0.5 text-xs grow"
                    value={search.toSite ?? ''}
                    onchange={(e) => search.setToSite(e.currentTarget.value || undefined)}
                >
                    <option value="">your site</option>
                    {#each search.otherSites as siteId (siteId)}
                        <option value={siteId}>{siteName(gameState, siteId)}</option>
                    {/each}
                </select>
            </label>
        {/if}
        {#if search.secondAllowed && search.drawn.length > 1}
            {@const second = search.second}
            <div class="mb-2 text-xs">
                <span class="text-oath-text-muted">Also play:</span>
                <CardChoiceRow
                    choices={cardChoices(search.secondCandidates)}
                    picked={second ? [second.cardId] : []}
                    onpick={(cardId) => search.tapSecondCard(cardId)}
                    {busy}
                    height={80}
                >
                    {#snippet under(choice)}
                        {#each search.secondPlays.filter((o) => o.cardId === choice.cardId) as option (option.key)}
                            <button
                                type="button"
                                class="rounded border px-1 text-[10px] {second?.key === option.key
                                    ? 'border-oath-accent bg-oath-accent-soft'
                                    : 'border-oath-divider hover:border-oath-accent'}"
                                aria-pressed={second?.key === option.key}
                                disabled={busy}
                                onclick={() =>
                                    search.setSecondPlay(toggleSingle(second?.key, option.key))}
                            >
                                {option.mode}
                            </button>
                        {/each}
                    {/snippet}
                </CardChoiceRow>
            </div>
        {/if}
        {#if search.discardFirstOptions.length > 0}
            <div class="mb-2 text-xs">
                <span class="text-oath-text-muted">Discard first:</span>
                <CardChoiceRow
                    choices={cardChoices(search.discardFirstOptions)}
                    picked={search.discardFirst ? [search.discardFirst] : []}
                    onpick={(cardId) =>
                        search.setDiscardFirst(toggleSingle(search.discardFirst, cardId))}
                    {busy}
                    height={80}
                />
            </div>
        {/if}
        <div class="flex items-start gap-3">
            <span class="relative inline-flex shrink-0">
                <CardImage
                    cardId={search.kept}
                    width={widthAtHeight(100, { cardId: search.kept })}
                    label={cardName(search.kept)}
                    inspect
                />
                <Magnifier
                    preview={{ cardId: search.kept, label: cardName(search.kept) }}
                    label={cardName(search.kept)}
                />
            </span>
            <div>
                <!-- One width, the widest label's: a row on a wide screen, a column below it. -->
                <div class="inline-grid auto-cols-fr gap-1 lg:grid-flow-col">
                    {#each search.placements as option (option.label)}
                        <button
                            class="rounded border border-oath-frame bg-oath-surface-raised px-3 py-1
                                   text-sm whitespace-nowrap hover:border-oath-accent max-sm:min-h-11"
                            disabled={busy}
                            onclick={() =>
                                search.choosePlacement({
                                    play: option.play,
                                    faceUp: option.faceUp
                                })}
                        >
                            {option.label}
                        </button>
                    {/each}
                </div>
                {#if search.placementReason}
                    <p class="mt-1 text-[11px] text-oath-danger">
                        <TokenText
                            text={gameSession.humanizeReason(search.placementReason) ?? ''}
                        />
                    </p>
                {/if}
            </div>
        </div>
    {:else if search.needsDisplaced}
        <div class="flex flex-wrap gap-2">
            {#each search.displaceable as cardId (cardId)}
                <div class="relative">
                    <button
                        type="button"
                        class="rounded-[5px] ring-1 hover:ring-oath-accent {search.displaced.includes(
                            cardId
                        )
                            ? 'ring-2 ring-oath-danger'
                            : 'ring-oath-control-hover'}"
                        disabled={busy}
                        onclick={() => search.chooseDisplaced(cardId)}
                    >
                        <CardImage
                            {cardId}
                            width={widthAtHeight(112, { cardId })}
                            label={cardName(cardId)}
                        />
                    </button>
                    <Magnifier
                        preview={{ cardId, label: cardName(cardId) }}
                        label={cardName(cardId)}
                    />
                </div>
            {/each}
        </div>
    {:else if search.needsConspiracy}
        {@const reason = search.whenPlayedReason}
        <ConspiracyTakePicker
            targets={search.conspiracyTargets}
            prizesOf={(target) => search.conspiracyPrizesOf(target)}
            pick={search.conspiracyPick}
            onchange={(pick) => search.setConspiracyPick(pick)}
        />
        <!-- "Play" once the take is picked whole; a red line only for a complete pick refused. -->
        {#if search.conspiracyComplete}
            {#if reason}
                <p class="text-[11px] text-oath-danger">
                    <TokenText text={gameSession.humanizeReason(reason) ?? ''} />
                </p>
            {/if}
            <button
                class="mt-1 rounded border-[1.5px] border-oath-primary-border bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-0.5 text-xs"
                disabled={busy || !!reason}
                onclick={() => search.confirmConspiracy()}
            >
                Play
            </button>
        {/if}
    {:else if search.needsWhenPlayed}
        {@const reason = search.whenPlayedReason}
        <PowerChoicePicker
            choices={search.whenPlayed}
            bind:picks={() => search.picks, (picks) => search.setPicks(picks)}
        />
        {#if search.whenPlayedComplete}
            {#if reason}
                <p class="text-[11px] text-oath-danger">
                    <TokenText text={gameSession.humanizeReason(reason) ?? ''} />
                </p>
            {/if}
            <button
                class="mt-1 rounded border-[1.5px] border-oath-primary-border bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-0.5 text-xs"
                disabled={busy || !!reason}
                onclick={() => search.confirmWhenPlayed()}
            >
                Play
            </button>
        {/if}
    {:else}
        <div class="flex flex-wrap gap-2">
            <DiscardOrderCards
                cards={search.others}
                tapped={search.tapped}
                {busy}
                ontap={(cardId) => search.tapDiscard(cardId)}
            />
        </div>
    {/if}
</div>
