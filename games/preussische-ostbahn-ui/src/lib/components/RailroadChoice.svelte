<script lang="ts">
    import { railroadDefinition, type RailroadId } from '@tabletop/preussische-ostbahn'
    import { RAILROAD_STYLES } from '$lib/utils/railroadStyle.js'

    let {
        railroadId,
        detail,
        cubes,
        onclick
    }: {
        railroadId: RailroadId
        detail?: string
        cubes?: number
        onclick: () => void
    } = $props()

    const style = $derived(RAILROAD_STYLES[railroadId])
</script>

<button
    type="button"
    class="choice"
    style:background={style.fill}
    style:color={style.text}
    {onclick}
>
    <span class="name">{railroadDefinition(railroadId).name}</span>
    {#if detail}<span class="detail">{detail}</span>{/if}
    {#if cubes !== undefined}
        {#if detail}<span class="detail" aria-hidden="true">·</span>{/if}
        <span class="detail">{cubes} track left</span>
    {/if}
</button>

<style>
    .choice {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        white-space: nowrap;
    }

    .choice:hover,
    .choice:focus-visible {
        box-shadow: 0 0 0 2px var(--po-ink);
    }

    .name {
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 15px;
        font-weight: 700;
    }

    .detail {
        font-size: 13px;
        opacity: 0.85;
    }

    @media (max-width: 639px) {
        .choice {
            gap: 4px;
            padding: 3px 8px;
        }

        .name {
            font-size: 13px;
        }

        .detail {
            font-size: 11px;
        }
    }
</style>
