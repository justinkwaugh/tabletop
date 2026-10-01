<script lang="ts">
    import { suitImage } from '$lib/images/suitImages.js'
    import { favorTokenImage, secretTokenImage } from '$lib/images/tileImages.js'
    import { suitName } from '$lib/model/names.js'
    import { tokenParts } from '$lib/model/tokenText.js'

    // A panel names favor, secrets and suits by their tokens and symbols; the word is the image's alt.
    let { text }: { text: string } = $props()
    let parts = $derived(tokenParts(text))
</script>

{#each parts as part, i (i)}
    {#if part.kind === 'text'}{part.text}{:else if part.kind === 'suit'}<img
            class="token-text__mark"
            src={suitImage(part.suit)}
            alt={part.bank ? `the ${suitName(part.suit)} bank` : suitName(part.suit)}
            title={part.bank ? `the ${suitName(part.suit)} bank` : suitName(part.suit)}
        />{:else}<span class="token-text__count"
            >{#if part.count !== undefined}{part.count}{/if}<img
                class="token-text__token"
                src={part.kind === 'favor' ? favorTokenImage() : secretTokenImage()}
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
