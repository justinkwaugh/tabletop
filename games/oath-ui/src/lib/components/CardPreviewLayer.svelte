<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { siteHolding } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import CardWarbands from '$lib/components/CardWarbands.svelte'
    import { cardAspect } from '$lib/images/cardShape.js'
    import { cardPreview } from '$lib/model/cardPreview.svelte.js'
    import { cardName, plural } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { banditWarbandImage, pawnImage, warbandImage } from '$lib/images/pieceImages.js'
    import TokenBadge from '$lib/components/TokenBadge.svelte'
    import TokenPair from '$lib/components/TokenPair.svelte'
    import { cardRulerIds, sitePieces } from '$lib/model/siteRule.js'
    import { warbandsOnCardOf } from '$lib/model/cardWarbands.js'

    // Mounted outside the table layout: a transformed ancestor would be the containing block of this fixed layer.
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
            name: gameSession.getPlayerName(p.playerId),
            color: p.color
        }))
        const cardId = gameState.siteCardAt(slotId)
        const tokens = cardId ? gameState.tokensOn(cardId) : { favor: 0, secrets: 0 }
        const denizens = (gameState.denizensBySite[slotId] ?? []).map(cardName)
        const relics = gameState.relicSlotsAt(slotId).length
        return { ...onSite, pawns, tokens, denizens, relics }
    })

    function namesOf(playerIds: string[]): string {
        return playerIds.map((id) => gameSession.getPlayerName(id)).join(', ')
    }

    // R-10.21 — a denizen's ruler, which the Grand Mask can part from its site's.
    let cardFacts = $derived.by(() => {
        const cardId = preview?.cardId
        if (!cardId || preview?.faceDown || preview?.slotId) return undefined
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

    // Capped: past a point more pixels hide the board.
    let width = $derived.by(() => {
        if (!preview) return 0
        const aspect = preview.aspect ?? cardAspect(preview)
        return Math.round(Math.min(areaWidth * 0.46, areaHeight * 0.82 * aspect, 460))
    })

    // The boxes under the card can outgrow what the card leaves; the whole stack shrinks to fit.
    let stackScale = $derived(stackHeight > areaHeight ? areaHeight / stackHeight : 1)
</script>

{#if preview}
    <!-- Inert under a mouse, so picking never depends on how long the pointer
         was still; on touch the sticky preview takes and swallows the closing tap. -->
    <div
        class="card-preview"
        class:card-preview--sticky={cardPreview.sticky}
        aria-hidden={!cardPreview.sticky}
        role="button"
        tabindex={cardPreview.sticky ? 0 : -1}
        onpointerdown={(event) => {
            if (!cardPreview.sticky) return
            event.preventDefault()
            event.stopPropagation()
            cardPreview.dismiss()
        }}
        onkeydown={(event) => {
            if (cardPreview.sticky && (event.key === 'Escape' || event.key === 'Enter'))
                cardPreview.dismiss()
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
                                faceDown={preview.faceDown}
                                backKind={preview.backKind}
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
                                {preview.badge.count}
                                {preview.badge.kind === 'favor' ? 'favor' : 'secrets'} on it
                            </span>
                        </div>
                    {/if}
                    {#if pieces}
                        <div class="card-preview__pieces" style="width:{width}px;">
                            {#if pieces.warbands.length > 0}
                                {#each pieces.warbands as [color, n] (color)}
                                    <span class="piece">
                                        <img
                                            class="figure"
                                            src={warbandImage(color)}
                                            alt="{color} warband"
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
                            {#each pieces.pawns as pawn (pawn.name)}
                                <span class="piece">
                                    <img
                                        class="figure figure--pawn"
                                        src={pawnImage(pawn.color)}
                                        alt="{pawn.color} pawn"
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
        pointer-events: none;
    }

    .card-preview__area {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .card-preview--sticky {
        pointer-events: auto;
        background: rgba(0, 0, 0, 0.35);
        cursor: pointer;
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
        background: rgba(12, 10, 9, 0.92);
        border: 1px solid rgba(251, 191, 36, 0.45);
        color: #e7e5e4;
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
        color: #a8a29e;
        font-weight: 400;
    }

    .card-preview__frame {
        border-radius: 12px;
        box-shadow:
            0 0 0 2px rgba(251, 191, 36, 0.55),
            0 24px 60px rgba(0, 0, 0, 0.65);
        overflow: hidden;
        line-height: 0;
    }
</style>
