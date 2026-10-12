<script lang="ts">
    import { formatRate } from '$lib/utils/gameStats'

    let { rate, evenOdds }: { rate: number; evenOdds: number } = $props()
</script>

<span
    class="meter"
    role="img"
    aria-label={`Win rate ${formatRate(rate)}, even odds ${formatRate(evenOdds)}`}
>
    <span class="fill" style:width={`${rate * 100}%`}></span>
    <span class="even-odds" style:left={`calc(${evenOdds * 100}% - 1px)`}></span>
</span>

<style>
    .meter {
        position: relative;
        display: block;
        height: 6px;
        border-radius: 3px;
        background: var(--color-gray-700);
    }
    .fill {
        position: absolute;
        inset: 0 auto 0 0;
        border-radius: 3px;
        background: var(--stats-mark);
    }
    .even-odds {
        position: absolute;
        top: -4px;
        width: 2px;
        height: 14px;
        background: var(--color-gray-200);
        outline: 2px solid var(--color-gray-900);
    }
</style>
