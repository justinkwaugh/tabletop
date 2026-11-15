<script lang="ts">
    import { railroadDefinition, type RailroadId } from '@tabletop/preussische-ostbahn'
    import { RAILROAD_STYLES } from '$lib/utils/railroadStyle.js'

    let { railroadId, short = false }: { railroadId: RailroadId; short?: boolean } = $props()
    const style = $derived(RAILROAD_STYLES[railroadId])
</script>

<span
    class="badge"
    class:short
    title={short ? railroadDefinition(railroadId).name : undefined}
    style:background={style.fill}
    style:color={style.text}>{short ? style.initial : railroadDefinition(railroadId).name}</span
>

<style>
    .badge {
        display: inline-block;
        border-radius: 4px;
        padding: 0 5px;
        font-weight: 700;
        line-height: 1.35;
        white-space: nowrap;
    }

    .badge.short {
        min-width: 1.7em;
        text-align: center;
    }
</style>
