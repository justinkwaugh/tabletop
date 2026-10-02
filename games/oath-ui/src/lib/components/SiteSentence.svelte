<script lang="ts">
    import { attackDieBlank } from '$lib/images/diceImages.js'
    import { suitImage } from '$lib/images/suitImages.js'
    import { favorTokenImage, secretTokenImage } from '$lib/images/tileImages.js'
    import { suitName } from '$lib/model/names.js'
    import { sentenceParts } from '$lib/model/siteSentence.js'

    // Item 28 — what a site does, under it when enlarged; the word is each symbol's alt.
    let { sentence }: { sentence: string } = $props()
    let parts = $derived(sentenceParts(sentence))
</script>

<p class="site-sentence">
    {#each parts as part, i (i)}
        {#if part.kind === 'text'}{part.text}{:else if part.kind === 'suit'}<img
                class="site-sentence__mark"
                src={suitImage(part.suit)}
                alt={suitName(part.suit)}
                title={suitName(part.suit)}
            />{:else if part.kind === 'favor'}<img
                class="site-sentence__token"
                src={favorTokenImage()}
                alt="favor"
            />{:else if part.kind === 'secret'}<img
                class="site-sentence__token"
                src={secretTokenImage()}
                alt="secret"
            />{:else}<img
                class="site-sentence__mark"
                src={attackDieBlank()}
                alt="attack die"
            />{/if}
    {/each}
</p>

<style>
    .site-sentence {
        margin: 0;
        font-weight: 400;
        line-height: 1.45;
    }
    .site-sentence__mark,
    .site-sentence__token {
        display: inline-block;
        height: 1.25em;
        vertical-align: -0.28em;
    }
    .site-sentence__mark {
        width: 1.25em;
    }
    .site-sentence__token {
        width: auto;
    }
</style>
