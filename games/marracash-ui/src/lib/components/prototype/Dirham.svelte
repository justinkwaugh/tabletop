<script lang="ts">
    // PROTOTYPE: the Moroccan dirham sign, isolated so it sits right of the number in LTR text.
    import { DirhamSymbol } from './cardFacts.js'
    let { amount, class: className = '' }: { amount: number | undefined; class?: string } = $props()
</script>

<span class="whitespace-nowrap {className}"
    >{#if amount === undefined}<span class="opacity-80">?</span>{:else}{amount}{/if}<bdi
        class="dirham"
        dir="rtl">{DirhamSymbol}</bdi
    ></span
>

<style>
    .dirham {
        font-family: 'MarraCash Dirham Sign', 'MarraCash El Messiri', serif;
        margin-left: 0.22em;
        /* Naskh letters sit small on their em; this matches them to the digits. */
        font-size: 1.05em;
        font-weight: 700;
        letter-spacing: 0.02em;
    }
</style>
