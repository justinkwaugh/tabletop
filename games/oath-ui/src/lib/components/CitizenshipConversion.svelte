<script lang="ts">
    import { IMPERIAL_WARBANDS, type WarbandLocation } from '@tabletop/oath'
    import { warbandImage } from '$lib/images/pieceImages.js'
    import { siteName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-6.6.2, R-9.3 — as many of the Exile's warbands become Imperial as the Empire has; the
    // rest leave play, and when the Empire is short the Exile picks which are replaced.
    let { exileId }: { exileId: string } = $props()

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let consent = $derived(gameSession.consent)
    let busy = $derived(gameSession.busy)

    let conversion = $derived(consent.conversion)
    let ownSrc = $derived(warbandImage(gameSession.warbandColor(exileId)))
    let imperialSrc = $derived(warbandImage(gameSession.warbandColor(IMPERIAL_WARBANDS)))
    let label = $derived(
        `Your ${conversion.warbands} warbands become ${conversion.imperial} Imperial warbands` +
            (conversion.removed > 0 ? `; ${conversion.removed} are removed` : '')
    )

    function where(at: WarbandLocation): string {
        return at.kind === 'board' ? 'on your board' : `at ${siteName(gameState, at.siteId)}`
    }

    function placeLabel(at: WarbandLocation): string {
        const text = where(at)
        return text.charAt(0).toUpperCase() + text.slice(1)
    }
</script>

<div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
    <div
        role="img"
        aria-label={label}
        class="mb-2 flex flex-wrap items-center gap-2 text-sm font-bold"
    >
        <span class="flex items-center gap-0.5">
            {conversion.warbands}<img src={ownSrc} alt="" class="h-[26px] w-auto" />
        </span>
        <svg
            width="22"
            height="14"
            viewBox="0 0 22 14"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-oath-text-muted"
            aria-hidden="true"
        >
            <path d="M2 7h17M13 2l6 5-6 5"></path>
        </svg>
        <span class="flex items-center gap-0.5">
            {conversion.imperial}<img src={imperialSrc} alt="" class="h-[26px] w-auto" />
        </span>
        {#if conversion.removed > 0}
            <span class="text-oath-text-muted">·</span>
            <span class="flex items-center gap-1 text-oath-danger">
                {conversion.removed}<img src={ownSrc} alt="" class="h-[20px] w-auto opacity-40" />
                Removed
            </span>
        {/if}
    </div>

    {#each consent.places as place (JSON.stringify(place.at))}
        {@const placeText = where(place.at)}
        <div class="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span class="w-[130px]">{placeLabel(place.at)}</span>
            <span class="flex flex-wrap gap-1.5">
                {#each place.pieces as piece (piece.key)}
                    {@const imperial = consent.isImperial(piece.key)}
                    <span class="flex flex-col items-center gap-0.5">
                        <button
                            type="button"
                            class="piece flex h-11 w-11 items-center justify-center rounded-md"
                            class:piece--imperial={imperial && consent.canPick}
                            class:piece--removed={!imperial}
                            aria-label="{imperial ? 'Imperial' : 'Removed'}: a warband {placeText}"
                            aria-pressed={consent.canPick ? imperial : undefined}
                            disabled={busy || !consent.canPick}
                            onclick={() => consent.pick(piece.key)}
                        >
                            <img
                                src={imperial
                                    ? imperialSrc
                                    : warbandImage(gameSession.warbandColor(piece.owner))}
                                alt=""
                                class="h-8 w-auto"
                                class:opacity-40={!imperial}
                            />
                        </button>
                        {#if conversion.kind !== 'enough'}
                            <span
                                class="text-[10px] {imperial
                                    ? 'text-oath-text-muted'
                                    : 'text-oath-danger'}">{imperial ? 'Imperial' : 'Removed'}</span
                            >
                        {/if}
                    </span>
                {/each}
            </span>
        </div>
    {/each}
</div>

<style>
    .piece--imperial {
        border: 1px solid var(--oath-accent);
        box-shadow: 0 0 0 1px var(--oath-accent);
        background: var(--oath-accent-soft);
    }
    .piece--removed {
        border: 1px dashed color-mix(in srgb, var(--oath-danger) 60%, transparent);
        background: var(--oath-surface);
    }
    .piece:not(:disabled) {
        cursor: pointer;
    }
</style>
