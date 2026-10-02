<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { siteHolding, siteReference } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import CardWarbands from '$lib/components/CardWarbands.svelte'
    import SiteSentence from '$lib/components/SiteSentence.svelte'
    import { cardAspect } from '$lib/images/cardShape.js'
    import { cardPreview } from '$lib/model/cardPreview.svelte.js'
    import { previewSourceWidth, previewWidth } from '$lib/model/previewSize.js'
    import { cardName, plural } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { banditWarbandImage, pawnImage, warbandImage } from '$lib/images/pieceImages.js'
    import TokenBadge from '$lib/components/TokenBadge.svelte'
    import TokenPair from '$lib/components/TokenPair.svelte'
    import { cardRulerIds, sitePieces } from '$lib/model/siteRule.js'
    import { warbandsOnCardOf } from '$lib/model/cardWarbands.js'

    // Mounted outside the table layout: a transformed ancestor would be the containing block of this fixed layer.
    // Rule 5 — an enlarged site offers to focus the board on its row.
    let { onZoomSite }: { onZoomSite?: (slotId: string) => void } = $props()

    let areaWidth = $state(0)
    let areaHeight = $state(0)
    let stackHeight = $state(0)

    let preview = $derived(cardPreview.current)

    let gameSession = getGameSession()
    let pieces = $derived.by(() => {
        const slotId = preview?.slotId
        if (!slotId) return undefined
        const gameState = gameSession.gameState
        const onSite = sitePieces(gameState, slotId)
        const pawns = onSite.pawns.map((p) => ({
            playerId: p.playerId,
            name: gameSession.getPlayerName(p.playerId),
            color: gameSession.colors.getPlayerColor(p.playerId)
        }))
        const cardId = gameState.siteCardAt(slotId)
        const tokens = cardId ? gameState.tokensOn(cardId) : { favor: 0, secrets: 0 }
        const denizens = (gameState.denizensBySite[slotId] ?? []).map(cardName)
        const relics = gameState.relicSlotsAt(slotId).length
        return { ...onSite, pawns, tokens, denizens, relics }
    })

    let sentence = $derived(
        preview?.cardId && preview.back === undefined ? siteReference(preview.cardId) : undefined
    )

    function namesOf(playerIds: string[]): string {
        return playerIds.map((id) => gameSession.getPlayerName(id)).join(', ')
    }

    // R-10.21 — a denizen's ruler, which the Grand Mask can part from its site's.
    let cardFacts = $derived.by(() => {
        const cardId = preview?.cardId
        if (!cardId || preview?.back !== undefined || preview?.slotId) return undefined
        const gameState = gameSession.gameState
        const hasWarbands = warbandsOnCardOf(gameState, cardId).length > 0
        const rulerIds = siteHolding(gameState, cardId) ? cardRulerIds(gameState, cardId) : []
        if (!hasWarbands && rulerIds.length === 0) return undefined
        return { cardId, hasWarbands, rulerIds }
    })

    const measureArea: Attachment<HTMLElement> = (node) => {
        const read = () => {
            areaWidth = node.clientWidth
            areaHeight = node.clientHeight
        }
        const observer = new ResizeObserver(read)
        observer.observe(node)
        read()
        return () => observer.disconnect()
    }

    // A transform leaves layout alone, so the stack's height is read unscaled.
    const measureStack: Attachment<HTMLElement> = (node) => {
        const read = () => {
            stackHeight = node.offsetHeight
        }
        const observer = new ResizeObserver(read)
        observer.observe(node)
        read()
        return () => observer.disconnect()
    }

    // Item 12 — a wide card to its source art, an upright one to 460 px, inside the area.
    let width = $derived.by(() => {
        if (!preview) return 0
        const aspect = preview.aspect ?? cardAspect(preview)
        return previewWidth(
            { width: areaWidth, height: areaHeight },
            aspect,
            previewSourceWidth(preview)
        )
    })

    // The boxes under the card can outgrow what the card leaves; the whole stack shrinks to fit.
    let stackScale = $derived(stackHeight > areaHeight ? areaHeight / stackHeight : 1)
</script>

{#if preview}
    <!-- Rule 4 — over a backdrop that takes the next press, so the press that closes it does nothing else. -->
    <div
        class="card-preview"
        role="button"
        tabindex="0"
        aria-label="Close the enlarged card"
        onpointerdown={(event) => {
            event.preventDefault()
            event.stopPropagation()
        }}
        onclick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            cardPreview.dismiss()
        }}
        onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') cardPreview.dismiss()
        }}
    >
        <div class="card-preview__area" {@attach measureArea}>
            {#if width > 0}
                <div
                    class="card-preview__stack"
                    {@attach measureStack}
                    style="transform:{stackScale < 1 ? `scale(${stackScale})` : 'none'};"
                >
                    <div class="card-preview__frame">
                        {#if preview.imageSrc}
                            <img
                                src={preview.imageSrc}
                                alt={preview.label ?? ''}
                                style="width:{width}px; height:auto; border-radius:8px;"
                            />
                        {:else}
                            <CardImage
                                cardId={preview.cardId}
                                back={preview.back}
                                label={preview.label}
                                {width}
                            />
                        {/if}
                    </div>
                    {#if preview.badge}
                        <div class="card-preview__pieces" style="width:{width}px;">
                            <span class="piece">
                                <TokenBadge
                                    kind={preview.badge.kind}
                                    count={preview.badge.count}
                                    size={40}
                                />
                                on it
                            </span>
                        </div>
                    {/if}
                    {#if pieces}
                        <div class="card-preview__pieces" style="width:{width}px;">
                            {#if pieces.warbands.length > 0}
                                {#each pieces.warbands as [owner, n] (owner)}
                                    <span class="piece">
                                        <img
                                            class="figure"
                                            src={warbandImage(gameSession.warbandColor(owner))}
                                            alt="{gameSession.warbandOwnerName(owner)} warband"
                                        />
                                        {plural(n, 'warband')}
                                    </span>
                                {/each}
                            {:else if pieces.bandits}
                                <span class="piece">
                                    <img class="figure" src={banditWarbandImage()} alt="" />
                                    {pieces.rule.banditsRule
                                        ? 'bandits rule here'
                                        : `bandits serve ${namesOf(pieces.rule.banditsServeIds)} here`}
                                </span>
                            {:else}
                                <span class="piece muted">no warbands</span>
                            {/if}
                            {#each pieces.pawns as pawn (pawn.playerId)}
                                <span class="piece">
                                    <img
                                        class="figure figure--pawn"
                                        src={pawnImage(pawn.color)}
                                        alt="{pawn.name}'s pawn"
                                    />
                                    {pawn.name}
                                </span>
                            {/each}
                            <TokenPair
                                favor={pieces.tokens.favor}
                                secrets={pieces.tokens.secrets}
                                size={40}
                            />
                            {#if pieces.denizens.length > 0}
                                <span class="piece muted">{pieces.denizens.join(' · ')}</span>
                            {/if}
                            {#if pieces.relics > 0}
                                <span class="piece muted">{plural(pieces.relics, 'relic')}</span>
                            {/if}
                            {#if pieces.rule.rulerIds.length > 0}
                                <span class="piece muted"
                                    >ruled by {namesOf(pieces.rule.rulerIds)}</span
                                >
                            {/if}
                        </div>
                    {/if}
                    {#if cardFacts}
                        <div class="card-preview__pieces" style="width:{width}px;">
                            {#if cardFacts.hasWarbands}
                                <span class="piece">
                                    <CardWarbands cardId={cardFacts.cardId} size={26} /> on this card
                                </span>
                            {/if}
                            {#if cardFacts.rulerIds.length > 0}
                                <span class="piece muted"
                                    >ruled by {namesOf(cardFacts.rulerIds)}</span
                                >
                            {/if}
                        </div>
                    {/if}
                    {#if sentence}
                        <div class="card-preview__pieces" style="width:{width}px;">
                            <SiteSentence {sentence} />
                        </div>
                    {/if}
                    {#if preview.slotId && onZoomSite}
                        {@const slotId = preview.slotId}
                        <button
                            type="button"
                            class="rounded-md bg-oath-primary px-3.5 py-1.5 text-[15px] font-bold
                                   text-oath-primary-text hover:bg-oath-primary-hover"
                            onclick={(event) => {
                                event.stopPropagation()
                                onZoomSite(slotId)
                                cardPreview.dismiss()
                            }}
                        >
                            Zoom the board here
                        </button>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .card-preview {
        position: fixed;
        inset: 0;
        z-index: 60;
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
            env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
        background: rgba(0, 0, 0, 0.35);
        cursor: pointer;
    }

    .card-preview__area {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .figure {
        height: 26px;
        width: auto;
        vertical-align: middle;
        margin-right: 6px;
    }
    .figure--pawn {
        height: 32px;
    }

    .card-preview__stack {
        flex-shrink: 0;
        transform-origin: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }

    .card-preview__pieces {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 12px;
        padding: 8px 12px;
        border-radius: 10px;
        background: var(--oath-surface-raised);
        border: 1px solid var(--oath-frame);
        color: var(--oath-text);
        font-size: 15px;
        font-weight: 600;
        line-height: 1.2;
    }

    .piece {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .piece.muted {
        color: var(--oath-text-muted);
        font-weight: 400;
    }

    .card-preview__frame {
        border-radius: 12px;
        box-shadow:
            0 0 0 2px var(--oath-frame),
            0 24px 60px rgba(0, 0, 0, 0.65);
        overflow: hidden;
        line-height: 0;
    }
</style>
