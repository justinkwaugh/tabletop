<script lang="ts">
    import { locomotiveData, type LocomotiveId } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { kindColor, kindOf, locomotiveName } from '$lib/utils/locomotives.js'
    import KindShape from './KindShape.svelte'

    let { locomotiveId }: { locomotiveId: LocomotiveId } = $props()

    const gameSession = getGameSession()

    const generation = $derived(locomotiveData(locomotiveId).generation)
</script>

<span
    class="badge"
    style:--kind={kindColor(locomotiveId, gameSession.kindPalette)}
    title={locomotiveName(locomotiveId)}
    ><span class="generation"
        >{generation}{#if gameSession.colorBlind}<svg
                class="shape"
                viewBox="-6 -6 12 12"
                aria-hidden="true"><KindShape kind={kindOf(locomotiveId)} size={10} /></svg
            >{/if}</span
    ><span class="name">{locomotiveData(locomotiveId).kind}</span></span
>

<style>
    .badge {
        display: inline-flex;
        align-items: stretch;
        overflow: hidden;
        border: 1.5px solid #232d36;
        border-radius: 5px;
        background: #edf1f4;
        color: #232d36;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.35;
        white-space: nowrap;
        vertical-align: middle;
    }

    .generation {
        padding: 0 5px;
        background: var(--kind);
        font-family: 'LW Abril', Georgia, serif;
        font-weight: 400;
    }

    .shape {
        display: inline-block;
        width: 0.7em;
        height: 0.7em;
        margin-left: 3px;
        vertical-align: -0.02em;
    }

    .name {
        padding: 0 5px;
        font-family: 'LW Baskerville', Georgia, serif;
    }
</style>
