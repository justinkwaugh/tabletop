<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { CardKind, type CitizenshipTerms } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import CitizenshipConversion from '$lib/components/CitizenshipConversion.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import TokenText from '$lib/components/TokenText.svelte'
    import TransferSymbols from '$lib/components/TransferSymbols.svelte'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import { cardName, reliquaryLabel } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-6.6.1, R-6.6.2 — the Exile answers the offer: the binding exchange, then what becomes of
    // their warbands.
    let {
        askingPlayerId,
        exileId,
        reliquarySlotId,
        terms
    }: {
        askingPlayerId: string
        exileId: string
        reliquarySlotId: string
        terms: CitizenshipTerms | undefined
    } = $props()

    const CARD_HEIGHT = 56

    let gameSession = getGameSession()
    let consent = $derived(gameSession.consent)
    let busy = $derived(gameSession.busy)
    let blockedBecause = $derived(consent.blockedBecause)

    // R-6.4-H1, R-9.4 — the relic is a back unless this player's own peek named it.
    let relic: { cardId?: string; back?: CardKind; label: string } = $derived.by(() => {
        const known = gameSession.knownRelicAt(reliquarySlotId)
        return known
            ? { cardId: known, label: cardName(known) }
            : {
                  back: CardKind.Relic,
                  label: `the facedown relic on ${reliquaryLabel(reliquarySlotId)}`
              }
    })

    let fromExile = $derived(terms?.fromExile)
    let givesSomething = $derived(
        (fromExile?.favor ?? 0) > 0 ||
            (fromExile?.secrets ?? 0) > 0 ||
            (fromExile?.relicCardIds?.length ?? 0) > 0 ||
            (fromExile?.banners?.length ?? 0) > 0
    )
</script>

<p class="mb-2 text-sm">
    {#if askingPlayerId === exileId}
        You offer yourself Citizenship.
    {:else}
        <PlayerName playerId={askingPlayerId} /> offers you Citizenship.
    {/if}
</p>

<div
    class="mb-2 grid grid-cols-[84px_minmax(0,1fr)] items-center gap-y-2 border-t border-oath-divider pt-2
           text-[13px]"
>
    <span class="text-xs text-oath-text-muted">You get</span>
    <span class="flex flex-wrap items-center gap-3.5">
        <span class="relative inline-flex">
            <CardImage
                cardId={relic.cardId}
                back={relic.back}
                label={relic.label}
                width={widthAtHeight(CARD_HEIGHT, relic)}
            />
            <Magnifier preview={relic} label={relic.label} />
        </span>
        <TransferSymbols
            transfer={terms?.fromScepterHolder}
            gives={false}
            cardHeight={CARD_HEIGHT}
        />
    </span>
    {#if givesSomething}
        <span class="text-xs text-oath-text-muted">You give</span>
        <span class="flex flex-wrap items-center gap-3.5">
            <TransferSymbols transfer={fromExile} gives={true} cardHeight={CARD_HEIGHT} />
        </span>
    {/if}
</div>

{#if consent.conversion.warbands > 0}
    <CitizenshipConversion {exileId} />
{/if}

{#if consent.picksComplete && blockedBecause}
    <p class="mb-2 text-[11px] text-oath-danger">
        <TokenText text={gameSession.humanizeReason(blockedBecause) ?? ''} />
    </p>
{/if}

<!-- R1: Accept shows once as many pieces are picked as the Empire covers. -->
<div class="answers gap-2">
    {#if consent.picksComplete}
        <button
            class="rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                   border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold"
            disabled={busy || !!blockedBecause}
            onclick={() => consent.answer(true)}
        >
            Accept
        </button>
    {/if}
    <button
        class="rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40
               px-3 py-1.5 text-sm font-semibold"
        disabled={busy}
        onclick={() => consent.answer(false)}
    >
        Refuse
    </button>
</div>

<style>
    /* The answers are as wide as the longer label at every width, 44 px tall on a phone. */
    .answers {
        display: inline-grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
    }
    @media (max-width: 639px) {
        .answers button {
            min-height: 44px;
        }
    }
</style>
