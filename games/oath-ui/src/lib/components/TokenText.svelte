<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { suitImage } from '$lib/images/suitImages.js'
    import { favorToken, secretToken } from '$lib/images/tileImages.js'
    import { warbandFigure } from '$lib/images/pieceImages.js'
    import { suitName } from '$lib/model/names.js'
    import { tokenParts } from '$lib/model/tokenText.js'

    // A panel names favor, secrets and suits by their tokens and symbols; the word is the image's alt.
    // R-10.13 — given colours, warbands are their token in their owner's colour, the Empire's in its own.
    let { text, warbandColors }: { text: string; warbandColors?: { own: Color; imperial: Color } } =
        $props()
    let parts = $derived(tokenParts(text, { warbands: warbandColors !== undefined }))
</script>

{#each parts as part, i (i)}
    {#if part.kind === 'text'}{part.text}{:else if part.kind === 'suit'}<img
            class="token-text__mark"
            src={suitImage(part.suit)}
            alt={part.bank ? `the ${suitName(part.suit)} bank` : suitName(part.suit)}
            title={part.bank ? `the ${suitName(part.suit)} bank` : suitName(part.suit)}
        />{:else if part.kind === 'warband'}<span class="token-text__count"
            >{part.count}{#if warbandColors}{@const figure = warbandFigure(
                    part.imperial ? warbandColors.imperial : warbandColors.own
                )}<img
                    class="token-text__token"
                    src={figure.src}
                    width={figure.width}
                    height={figure.height}
                    alt={part.words}
                    title={part.words}
                />{/if}</span
        >{:else}{@const token = part.kind === 'favor' ? favorToken() : secretToken()}<span
            class="token-text__count"
            >{#if part.count !== undefined}{part.count}{/if}<img
                class="token-text__token"
                src={token.src}
                width={token.width}
                height={token.height}
                alt={part.kind === 'favor' ? 'favor' : part.count === 1 ? 'secret' : 'secrets'}
            /></span
        >{/if}
{/each}

<style>
    .token-text__count {
        display: inline-flex;
        align-items: center;
        gap: 0.2em;
        white-space: nowrap;
    }
    .token-text__token {
        display: inline-block;
        width: auto;
        height: 1.2em;
        vertical-align: -0.25em;
    }
    .token-text__mark {
        display: inline-block;
        width: 1.2em;
        height: 1.2em;
        vertical-align: -0.25em;
    }
</style>
