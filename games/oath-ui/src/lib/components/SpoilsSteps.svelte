<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { CardKind, type WarbandOwner } from '@tabletop/oath'
    import CageWarbandRows from '$lib/components/CageWarbandRows.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import MenuCount from '$lib/components/MenuCount.svelte'
    import SpoilsOption from '$lib/components/SpoilsOption.svelte'
    import TokenRow from '$lib/components/TokenRow.svelte'
    import TokenText from '$lib/components/TokenText.svelte'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import { warbandFigure } from '$lib/images/pieceImages.js'
    import { favorToken } from '$lib/images/tileImages.js'
    import type { RelicRow } from '$lib/model/battleDrafts.js'
    import { cageQuestion } from '$lib/model/cagePlacement.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { cardName, plural, siteName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { spoilsSummary } from '$lib/model/spoils.js'

    // R-5.5.7 — the spoils one step at a time: the warbands on the sites taken, the relics (and the
    // Obsidian Cage's purple warbands when it went down), the defeated pawn (picked on the map),
    // then the favor, whose two buttons send. A step's options
    // share their widest one's width and are 44 px tall on a phone; none has a tooltip or a hover look.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let spoils = $derived(gameSession.victory)
    let busy = $derived(gameSession.busy)
    let defenderId = $derived(gameState.campaign?.defenderPlayerId)
    let pawnSiteName = $derived.by(() => {
        const siteId =
            defenderId === undefined ? undefined : gameState.getPlayerState(defenderId).siteId
        return siteId === undefined ? '' : siteName(gameState, siteId)
    })
    let manyOwners = $derived(spoils.forceOwners.length > 1)

    const PICTURE_HEIGHT = 56
    const relicWidth = new ChoiceWidth()
    const pawnWidth = new ChoiceWidth()
    const sendWidth = new ChoiceWidth()

    function placeLabel(siteId: string, owner: WarbandOwner, n: number): string {
        const whose = manyOwners ? `, ${gameSession.warbandOwnerName(owner)}` : ''
        return `Place ${plural(n, 'warband')} at ${siteName(gameState, siteId)}${whose}`
    }

    // R-9.4 — a relic the attacker has not seen is drawn by its back, with no magnifier; one from
    // the defender's board was faceup there.
    function relicPicture(row: RelicRow): { src: string; cardId?: string; label: string } {
        const known = row.kind === 'held' ? row.cardId : gameSession.knownRelicAt(row.slotId)
        const src = known ? cardImage(known) : undefined
        return known && src
            ? { src, cardId: known, label: cardName(known) }
            : { src: cardBack(CardKind.Relic), label: 'Facedown relic' }
    }

    function sitePicture(siteId: string): { src: string; cardId?: string; label: string } {
        const cardId = gameState.siteCardAt(siteId)
        const src = cardId && gameState.isSiteFaceup(siteId) ? cardImage(cardId) : undefined
        return cardId && src
            ? { src, cardId, label: siteName(gameState, siteId) }
            : { src: cardBack(CardKind.Site), label: siteName(gameState, siteId) }
    }
</script>

{#snippet picture(face: { src: string; cardId?: string; label: string }, width: number)}
    <span class="relative inline-flex shrink-0">
        <img
            class="rounded-[4px]"
            style:width="{width}px"
            style:height="{PICTURE_HEIGHT}px"
            src={face.src}
            alt={face.label}
        />
        {#if face.cardId}
            <Magnifier preview={{ cardId: face.cardId, label: face.label }} label={face.label} />
        {/if}
    </span>
{/snippet}

{#if spoils.step === 'warbands'}
    <p class="mb-1.5 text-sm">Place warbands: {spoils.placedTotal} of {spoils.forceAvailable}.</p>
    <div class="flex flex-col gap-1.5" role="list" aria-label="Warbands on the sites taken">
        {#each spoils.warbandRows as row (row.siteId + row.owner)}
            <!-- The site's picture and name, then its warbands: on one line on a desktop, each
                 row's warbands starting at the same place, and under the site on a phone. -->
            <div
                role="listitem"
                class="flex w-fit max-w-full items-center gap-x-3.5 gap-y-2 rounded-md bg-oath-surface-raised px-2 py-1.5
                       max-sm:flex-col max-sm:items-start"
            >
                <span class="flex items-center gap-x-3.5">
                    {@render picture(
                        sitePicture(row.siteId),
                        widthAtHeight(PICTURE_HEIGHT, { back: CardKind.Site })
                    )}
                    <span class="text-[15px] font-bold sm:w-36"
                        >{siteName(gameState, row.siteId)}{#if manyOwners}<span
                                class="block text-sm font-normal text-oath-text-muted"
                                >{gameSession.warbandOwnerName(row.owner)}</span
                            >{/if}</span
                    >
                </span>
                <!-- R-5.5.7.I — "any number of your warbands, even zero": none ringed is 0. -->
                <TokenRow
                    image={warbandFigure(gameSession.warbandColor(row.owner))}
                    held={spoils.forceOf(row.owner)}
                    addable={spoils.ceilingAt(row.siteId, row.owner)}
                    picked={spoils.countAt(row.siteId, row.owner)}
                    label={(n) => placeLabel(row.siteId, row.owner, n)}
                    ontap={(n) => spoils.tapWarband(row.siteId, row.owner, n)}
                    {busy}
                />
            </div>
        {/each}
    </div>
{:else if spoils.step === 'relics'}
    <div class="flex flex-col gap-1.5" role="list" aria-label="Relics taken">
        {#each spoils.relicRows as row (row.key)}
            {@const relic = relicPicture(row)}
            {@const choice = spoils.relicChoice(row.key)}
            <div
                role="listitem"
                class="flex w-fit max-w-full items-center gap-x-3.5 gap-y-2 rounded-md bg-oath-surface-raised px-2 py-1.5
                       max-sm:flex-col max-sm:items-start"
            >
                <span class="flex items-center gap-x-3.5">
                    {@render picture(relic, PICTURE_HEIGHT)}
                    <span class="text-[15px] font-bold">{relic.label}</span>
                </span>
                <span class="flex flex-wrap gap-1.5">
                    <SpoilsOption
                        pressed={choice === 'keep'}
                        width={relicWidth}
                        disabled={busy}
                        onclick={() => spoils.setRelic(row.key, false)}>Keep it</SpoilsOption
                    >
                    <SpoilsOption
                        pressed={choice === 'bottom'}
                        width={relicWidth}
                        disabled={busy}
                        onclick={() => spoils.setRelic(row.key, true)}
                        >Bottom of the relic deck</SpoilsOption
                    >
                </span>
            </div>
        {/each}
    </div>
{:else if spoils.step === 'cage'}
    <!-- R-10.13-H1 — a step of its own, Fae Merchant's Cage rows: the question alone. -->
    <p class="mb-2 text-base">{cageQuestion(spoils.cageWarbands)}</p>
    <CageWarbandRows
        boards={spoils.cageBoards}
        total={spoils.cageWarbands}
        counts={spoils.cageCounts}
        ceilingAt={(row) => spoils.cageCeilingAt(row)}
        onpick={(row, count) => spoils.setCageCount(row, count)}
    />
{:else if spoils.step === 'pawn' && defenderId !== undefined}
    <!-- R-5.5.7.III — the sites they may be sent to are lit on the map; R-11.7, or the Wood's ruler picks. -->
    {#if spoils.woodRuler === undefined}
        <p class="mb-1.5 text-sm">
            Tap a lit site to banish <PlayerName playerId={defenderId} possessive /> pawn there.
        </p>
    {/if}
    <div class="flex flex-wrap gap-1.5">
        <SpoilsOption width={pawnWidth} disabled={busy} onclick={() => spoils.leavePawn()}
            >Leave it at {pawnSiteName}</SpoilsOption
        >
        {#if spoils.woodRuler !== undefined}
            <SpoilsOption
                label="Let {gameSession.getPlayerName(spoils.woodRuler)} choose"
                width={pawnWidth}
                disabled={busy}
                onclick={() => spoils.letWoodRulerChoose()}
                >Let <PlayerName playerId={spoils.woodRuler} /> choose</SpoilsOption
            >
        {/if}
    </div>
{:else if spoils.step === 'favor' && defenderId !== undefined}
    <div class="flex items-center gap-2 text-[15px] font-bold">
        <span><PlayerName playerId={defenderId} possessive /> favor</span>
        <MenuCount count={gameState.getPlayerState(defenderId).favor} image={favorToken()} />
    </div>
{:else if spoils.step === undefined}
    <!-- Nothing to choose: what the spoils take, then the button that takes them. -->
    <ul class="list-disc pl-5 text-sm text-oath-text">
        {#each spoilsSummary(gameState, gameState.campaign?.targets ?? [], spoils.placeCounts, defenderId) as item, index (index)}
            <li>
                {#if item.kind === 'pawn'}<PlayerName playerId={item.playerId} possessive /> pawn and
                    favor{:else}{item.text}{/if}
            </li>
        {/each}
    </ul>
{/if}

{#if spoils.nextShown}
    <button
        type="button"
        class="mt-2 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
               border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold send"
        disabled={busy}
        onclick={() => spoils.next()}
    >
        Next
    </button>
{:else if spoils.step === 'favor' || spoils.sendShown}
    <!-- The reason the spoils are refused takes the buttons' place. -->
    {#if spoils.blockedBecause}
        <p class="mt-2 text-[11px] text-oath-danger">
            <TokenText text={gameSession.humanizeReason(spoils.blockedBecause) ?? ''} />
        </p>
    {:else}
        <!-- One width for the two, the wider one's; one per line when the two do not fit. -->
        <div class="mt-2 flex flex-wrap gap-2">
            <button
                type="button"
                class="shrink-0 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                       border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold send"
                style:min-width="{sendWidth.widest}px"
                disabled={busy}
                onclick={() => spoils.takeSpoils(false)}
            >
                <span class="inline-block w-max" {@attach sendWidth.measure}>Take spoils</span>
            </button>
            {#if spoils.step === 'favor'}
                <!-- R-5.5.7.III — "may burn half their favor" is a choice, so a second button. -->
                <button
                    type="button"
                    class="burn shrink-0 rounded border border-oath-danger/60 bg-oath-danger-soft text-oath-text disabled:opacity-40
                           px-3 py-1.5 text-sm font-semibold send"
                    style:min-width="{sendWidth.widest}px"
                    disabled={busy}
                    onclick={() => spoils.takeSpoils(true)}
                >
                    <span class="inline-block w-max" {@attach sendWidth.measure}
                        ><TokenText text={`Take and burn ${spoils.burnAmount} favor`} /></span
                    >
                </button>
            {/if}
        </div>
    {/if}
{/if}

<style>
    /* 44 px on a phone, on the screen: `FitBox` scales a step taller than its share of the screen
       down, so the step's own buttons start that much taller (`--fit-scale`). */
    @media (width < 40rem) {
        .send {
            min-height: calc(2.75rem / var(--fit-scale, 1));
        }
    }
    /* The burnt favor: the token as the text draws it, scorched. */
    .burn :global(img) {
        filter: sepia(1) saturate(4) hue-rotate(-30deg) brightness(0.7) contrast(1.3);
    }
</style>
