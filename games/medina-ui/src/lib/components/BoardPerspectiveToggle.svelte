<script lang="ts">
    import { BoardPerspective } from '@tabletop/medina'
    import { getGameSession } from '$lib/model/sessionContext.svelte'

    const session = getGameSession()

    const topDown = $derived(session.boardPerspective === BoardPerspective.TopDown)
</script>

<button
    type="button"
    class="toggle"
    class:on={topDown}
    class:phone={session.projection.sideways}
    aria-pressed={topDown}
    onclick={() => session.toggleTopDown()}
>
    Top down
</button>

<style>
    .toggle {
        position: absolute;
        top: 8px;
        right: 10px;
        z-index: 3;
        padding: 8px 12px 6px;
        border: 2px solid #47332a;
        border-radius: 6px;
        background: #231610;
        color: #e6c595;
        font:
            700 15px/1 'Medina Display',
            Georgia,
            serif;
        cursor: pointer;
    }

    .toggle.phone {
        top: auto;
        right: 8px;
        bottom: 8px;
    }

    .toggle:hover:not(.on) {
        border-color: #e6c595;
    }

    .toggle.on {
        border-color: #e6c595;
        background: #e6c595;
        color: #231610;
    }
</style>
