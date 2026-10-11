<script lang="ts">
    // PROTOTYPE: victory points as the gold star coin printed on cards, directives and titles.
    let { value, size = 22 }: { value: number; size?: number } = $props()
</script>

<span
    class="coin"
    style:width="{size}px"
    style:height="{size}px"
    style:font-size="{size * (value >= 100 ? 0.4 : 0.5)}px"
    title="{value} victory points">{value}</span
>

<style>
    .coin {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border-radius: 50%;
        background: #d9a93a;
        border: 1.5px solid #f3df9c;
        color: #1c1405;
        font-weight: 900;
        line-height: 1;
    }
</style>
