<script lang="ts">
    import SeatChip from '$lib/components/SeatChip.svelte'
    import { cardImage } from '$lib/images/cardImages.js'
    import { attackFaceImage, defenseFaceImage, skullImage } from '$lib/images/diceImages.js'
    import { warbandFigure } from '$lib/images/pieceImages.js'
    import type { ResultPart } from '$lib/model/battleResult.js'
    import { cardName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.5.5, R-5.5.6 — a battle's result in words, dice faces, warbands, chips and cards; what
    // dies in rose, Hospital in bold.
    let { parts }: { parts: readonly ResultPart[] } = $props()

    let gameSession = getGameSession()

    const SWORD = attackFaceImage({ swords: 1, hollowSwords: 0, skulls: 0 })
    const SHIELD = defenseFaceImage({ shields: 1, doubling: false })
</script>

<p class="battle-result mb-2 text-sm">
    {#each parts as part, i (i)}{#if part.kind === 'text'}{part.text}{:else if part.kind === 'rose'}<span
                class="text-oath-danger">{part.text}</span
            >{:else if part.kind === 'strong'}<strong>{part.text}</strong
            >{:else if part.kind === 'seat'}<SeatChip
                playerId={part.playerId}
            />{:else if part.kind === 'sword'}<img
                class="battle-result__mark"
                src={SWORD}
                alt="swords"
            />{:else if part.kind === 'shield'}<img
                class="battle-result__mark"
                src={SHIELD}
                alt="defense"
            />{:else if part.kind === 'skull'}<img
                class="battle-result__mark"
                src={skullImage()}
                alt="skulls"
            />{:else if part.kind === 'warband'}{@const figure = warbandFigure(
                gameSession.warbandColor(part.owner)
            )}<img
                class="battle-result__mark"
                src={figure.src}
                width={figure.width}
                height={figure.height}
                alt="warbands"
            />{:else if part.kind === 'card'}{@const src = cardImage(part.cardId)}{#if src}<img
                    class="battle-result__card"
                    {src}
                    alt={cardName(part.cardId)}
                />{/if}{/if}{/each}
</p>

<style>
    .battle-result__mark {
        display: inline;
        width: auto;
        height: 1.2em;
        vertical-align: -0.25em;
    }
    .battle-result__card {
        display: inline;
        width: auto;
        height: 1.6em;
        margin-right: 4px;
        border-radius: 2px;
        vertical-align: -0.45em;
    }
</style>
