<script lang="ts">
    let { amount }: { amount: number } = $props()
</script>

<span class="elektro" aria-label="{amount} Elektro"
    >{amount}<span class="coin" aria-hidden="true">E</span></span
>

<style>
    .elektro {
        font-weight: 700;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 2px;
    }
    .coin {
        display: inline-grid;
        place-items: center;
        width: 0.95em;
        height: 0.95em;
        border-radius: 50%;
        background: #d7b04a;
        color: #2b2210;
        font-size: 0.72em;
        font-weight: 700;
        line-height: 1;
    }
</style>
