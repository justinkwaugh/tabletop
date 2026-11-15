<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'

    // A system's name wherever text names it, underlined: clicking zooms the star map into the
    // system, or back out when it is the system in focus, as its printed name on the map does.
    let { systemId }: { systemId: string } = $props()

    const gameSession = getGameSession()
    const name = $derived(systemName(systemId))
    const inFocus = $derived(gameSession.focusedSystemId === systemId && !gameSession.focusClosing)

    function toggle(event: MouseEvent) {
        event.stopPropagation()
        if (inFocus) {
            gameSession.leaveFocus()
        } else {
            gameSession.focusSystem(systemId)
        }
    }
</script>

<button
    type="button"
    class="system-link"
    title={inFocus ? `Zoom out of ${name}` : `Zoom into ${name}`}
    onclick={toggle}>{name}</button
>

<style>
    /* Repeated to win over the action panel's button styles, scoped to the game's root. */
    .system-link.system-link {
        display: inline;
        min-height: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: none;
        box-shadow: none;
        letter-spacing: inherit;
        text-transform: inherit;
        font: inherit;
        color: inherit;
        text-align: inherit;
        text-decoration: underline dotted;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
        cursor: zoom-in;
    }

    .system-link.system-link.system-link:hover {
        background: none;
        text-decoration-style: solid;
    }
</style>
