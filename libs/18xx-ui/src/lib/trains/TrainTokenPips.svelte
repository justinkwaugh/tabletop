<script lang="ts">
    let {
        count,
        limit,
        lapsing = false
    }: { count: number; limit?: number; lapsing?: boolean } = $props()
</script>

<!--
    One pip for each token a train carries, then a hollow one for each more it could take. They
    take the warning colour once they alone keep the train from rusting.
-->
<span class="pips" class:lapsing aria-hidden="true"
    >{#each { length: limit ?? count }, index (index)}<span
            class="pip"
            class:hollow={index >= count}
        ></span>{/each}</span
>

<style>
    .pips {
        display: inline-flex;
        align-items: center;
        gap: 0.25em;
        height: 0.5em;
    }
    .lapsing {
        color: var(--rail-warning, #a8690a);
    }
    .pip {
        width: 0.5em;
        height: 0.5em;
        border-radius: 50%;
        background: currentColor;
    }
    .hollow {
        background: none;
        box-shadow: inset 0 0 0 1.5px currentColor;
        opacity: 0.55;
    }
</style>
