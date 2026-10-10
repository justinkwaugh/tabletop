<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { LetPeekSubjectKind } from '@tabletop/oath'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { letPeekCard, letPeekChipName, letPeekKey } from '$lib/model/letPeekChoices.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-6.1, R-9.4, R-6.6.1 — what the player may show, and to whom: the card first, then a chip.
    // `seat` is the seat card's picker, drawn at a phone's width wherever it is.
    let { seat = false }: { seat?: boolean } = $props()

    let gameSession = getGameSession()
    let shows = $derived(gameSession.letPeekShows)
    let busy = $derived(gameSession.busy)
    let picked = $derived(gameSession.letPeekPicked)
    let pickedShow = $derived(shows.find((show) => letPeekKey(show.subject) === picked))

    const layout = new PhoneLayout()
    // 69 px on a phone: the four Reliquary relics and their gaps (300 px) fit a 375 px phone's panel.
    let height = $derived(seat ? 56 : layout.narrow ? 69 : 100)

    // The facedown advisers, then the Reliquary relics in space order; the Reliquary takes its own
    // line on a phone and in the seat card.
    let rows = $derived(
        [LetPeekSubjectKind.Adviser, LetPeekSubjectKind.Reliquary]
            .map((kind) =>
                shows
                    .filter((show) => show.subject.kind === kind)
                    .map((show) =>
                        letPeekCard(show.subject, (slotId) => gameSession.knownRelicAt(slotId))
                    )
            )
            .filter((choices) => choices.length > 0)
    )
</script>

<div class="let-peek-picker {seat ? 'rounded-lg bg-oath-surface p-2' : ''}">
    <div
        class="flex gap-2 {seat
            ? 'flex-col items-start'
            : 'flex-wrap max-sm:flex-col max-sm:items-start'}"
    >
        {#each rows as choices (choices[0].key)}
            <CardChoiceRow
                {choices}
                picked={picked ? [picked] : []}
                onpick={(key) => gameSession.pickLetPeekSubject(key)}
                {busy}
                {height}
            />
        {/each}
    </div>
    {#if pickedShow}
        {@const subject = pickedShow.subject}
        <div class="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
            <span class="text-oath-text-muted">To:</span>
            {#each pickedShow.toPlayerIds as toPlayerId (toPlayerId)}
                <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-md border border-oath-frame
                           bg-oath-surface p-[3px] hover:border-oath-accent disabled:opacity-40
                           {seat ? 'min-h-11 px-1.5' : 'max-sm:min-h-11 max-sm:px-1.5'}"
                    aria-label={letPeekChipName(subject, gameSession.getPlayerName(toPlayerId))}
                    disabled={busy}
                    onclick={() => gameSession.letPeek(subject, toPlayerId)}
                >
                    <PlayerName playerId={toPlayerId} />
                </button>
            {/each}
        </div>
    {/if}
</div>
