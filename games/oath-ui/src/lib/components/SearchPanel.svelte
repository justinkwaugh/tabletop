<script lang="ts">
    import CardImage from '$lib/components/CardImage.svelte'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import DiscardOrderCards from '$lib/components/DiscardOrderCards.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { cardChoices, toggleSingle } from '$lib/model/cardChoice.js'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import ConspiracyTakePicker from '$lib/components/ConspiracyTakePicker.svelte'
    import { siteName, cardName, humanizeReason } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let search = $derived(gameSession.search)
    let busy = $derived(gameSession.busy)
</script>

<div>
    <div class="mb-2 flex items-center justify-between gap-2">
        <span class="text-sm">
            {#if !search.kept}
                <span class="font-semibold">Tap the card to keep.</span>
            {:else if !search.placement}
                Keeping <span class="font-semibold">{cardName(search.kept)}</span>.
                <span class="font-semibold">How do you play it?</span>
            {:else if search.needsDisplaced}
                <span class="font-semibold">Over the adviser limit.</span>
                {search.room.needed === 1
                    ? 'Discard which adviser?'
                    : `Discard ${search.room.needed} advisers (${search.displaced.length} chosen).`}
            {:else if search.needsConspiracy}
                <span class="font-semibold">The Conspiracy:</span> take a relic or banner?
            {:else if search.needsWhenPlayed}
                <span class="font-semibold">{cardName(search.kept)}</span>: choose for its When
                Played power.
            {:else}
                <span class="font-semibold">Tap the card that is discarded first</span>; the last
                goes on top.
            {/if}
        </span>
        {#if search.kept}
            <button
                class="shrink-0 rounded bg-stone-700 hover:bg-stone-600 px-2 py-1 text-xs font-semibold"
                disabled={busy}
                onclick={() => gameSession.back()}
            >
                Back
            </button>
        {/if}
    </div>

    {#if !search.kept}
        <div class="flex flex-wrap gap-2">
            {#each search.drawn as cardId (cardId)}
                <button
                    type="button"
                    class="rounded-[5px] ring-1 ring-stone-600 hover:ring-amber-400"
                    disabled={busy}
                    onclick={() => search.keep(cardId)}
                >
                    <CardImage
                        {cardId}
                        width={widthAtHeight(112, { cardId })}
                        label={cardName(cardId)}
                        inspect
                    />
                </button>
            {/each}
        </div>
    {:else if !search.placement}
        {#if search.otherSites.length > 0}
            <label class="mb-2 flex items-center gap-2 text-xs">
                <span class="text-stone-400">Play to:</span>
                <select
                    disabled={busy}
                    class="rounded bg-stone-800 px-1 py-0.5 text-xs grow"
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
                <span class="text-stone-400">Also play one, and how:</span>
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
                                    ? 'border-amber-300 bg-amber-950/60'
                                    : 'border-stone-700 hover:border-amber-400'}"
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
                <span class="text-stone-400">If played to a site, discard first:</span>
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
            <CardImage
                cardId={search.kept}
                width={widthAtHeight(100, { cardId: search.kept })}
                label={cardName(search.kept)}
                inspect
            />
            <div class="flex flex-wrap gap-1 grow">
                {#each search.placements as option (option.label)}
                    <button
                        class="rounded border px-2 py-1 text-sm text-left {option.blockedBecause
                            ? 'border-stone-800 bg-stone-900/40 opacity-55'
                            : 'border-amber-500/40 bg-stone-800/60 hover:border-amber-300'}"
                        disabled={busy || !!option.blockedBecause}
                        title={option.blockedBecause ? humanizeReason(option.blockedBecause) : ''}
                        onclick={() =>
                            search.choosePlacement({ play: option.play, faceUp: option.faceUp })}
                    >
                        {option.label}
                        {#if option.blockedBecause}
                            <span class="block text-[11px] text-stone-400 leading-snug">
                                {humanizeReason(option.blockedBecause)}
                            </span>
                        {/if}
                    </button>
                {/each}
            </div>
        </div>
    {:else if search.needsDisplaced}
        <div class="flex flex-wrap gap-2">
            {#each search.displaceable as cardId (cardId)}
                <button
                    type="button"
                    class="rounded-[5px] ring-1 hover:ring-amber-400 {search.displaced.includes(
                        cardId
                    )
                        ? 'ring-2 ring-rose-400'
                        : 'ring-stone-600'}"
                    disabled={busy}
                    onclick={() => search.chooseDisplaced(cardId)}
                >
                    <CardImage
                        {cardId}
                        width={widthAtHeight(112, { cardId })}
                        label={cardName(cardId)}
                        inspect
                    />
                </button>
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
        {#if reason}
            <p class="text-[11px] text-rose-300">{humanizeReason(reason)}</p>
        {/if}
        <button
            class="mt-1 rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 px-2 py-0.5 text-xs"
            disabled={busy || !!reason}
            onclick={() => search.confirmConspiracy()}
        >
            Play the Conspiracy
        </button>
    {:else if search.needsWhenPlayed}
        {@const reason = search.whenPlayedReason}
        <PowerChoicePicker
            choices={search.whenPlayed}
            bind:picks={() => search.picks, (picks) => search.setPicks(picks)}
        />
        {#if reason}
            <p class="text-[11px] text-rose-300">{humanizeReason(reason)}</p>
        {/if}
        <button
            class="mt-1 rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 px-2 py-0.5 text-xs"
            disabled={busy || !!reason}
            onclick={() => search.confirmWhenPlayed()}
        >
            Play {cardName(search.kept)}
        </button>
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
