<script lang="ts">
    let { text }: { text: string } = $props()

    // "enhanced +n" is drawn as the word with the buttons' superscript extra beside it, as a key.
    const parts = $derived(
        text.split(/(enhanced \+\w+)/).map((part) => {
            const match = /^enhanced (\+\w+)$/.exec(part)
            return match ? { word: 'enhanced', extra: match[1] } : { text: part }
        })
    )
</script>

{#each parts as part, index (index)}{#if 'extra' in part}<span class="keyed"
            >{part.word}<sup class="extra">{part.extra}</sup></span
        >{:else}{part.text}{/if}{/each}

<style>
    .keyed {
        white-space: nowrap;
    }

    .extra {
        margin-left: 1px;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 0.8em;
        font-weight: 700;
        line-height: 0;
    }
</style>
