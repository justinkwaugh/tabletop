<script lang="ts">
    import UnitTile from '$lib/components/UnitTile.svelte'
    import type { SideLosses } from '$lib/model/attackLosses.js'
    import { lossMark } from '$lib/model/roleMark.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { side }: { side: SideLosses } = $props()

    const gameSession = getGameSession()

    function hover(event: PointerEvent, unitId: string | undefined) {
        if (event.pointerType === 'mouse') {
            gameSession.hoverLoss(unitId)
        }
    }
</script>

{#each side.taken as loss (loss.unitId)}
    {@const onTheMap = gameSession.marksLoss(loss.unitId)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
        class="nt-lost-unit"
        onpointerenter={(event) => onTheMap && hover(event, loss.unitId)}
        onpointerleave={(event) => onTheMap && hover(event, undefined)}
    >
        <UnitTile
            playerId={side.playerId}
            face={loss.face}
            roleMark={lossMark(loss.steps)}
            marker={loss.eliminated ? 'destroyed' : undefined}
            label={onTheMap ? 'Show where this unit lost its steps' : 'A unit that lost steps'}
            selected={gameSession.pointedLossId === loss.unitId}
            close={!onTheMap}
            onclick={onTheMap ? () => gameSession.toggleLoss(loss.unitId) : undefined}
        />
    </span>
{/each}

<style>
    .nt-lost-unit {
        display: contents;
    }
</style>
