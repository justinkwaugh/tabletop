<script lang="ts">
    import { CommandKind } from '@tabletop/napoleons-triumph'
    import type { DeclarationStage, FeintStage, OccupationStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Force from './Force.svelte'

    let { stage }: { stage: FeintStage | DeclarationStage | OccupationStage } = $props()

    const gameSession = getGameSession()

    const COMMAND_NAMES: Record<CommandKind, string> = {
        [CommandKind.Corps]: 'Corps move',
        [CommandKind.Detach]: 'Detach and move',
        [CommandKind.Unit]: 'Independent move'
    }
</script>

{#each stage.groups as group (group.label)}
    <div class="nt-battle-faint">{group.label}</div>
    <Force
        units={group.units}
        selected={stage.attackers}
        markers={stage.roles}
        onpick={(id) => gameSession.pickBattleUnit(id)}
    />
{:else}
    <div class="nt-battle-faint">No unit here can still be commanded.</div>
{/each}
{#if stage.commandOptions.length > 1}
    <div class="flex flex-wrap items-center gap-2 pt-1">
        {#each stage.commandOptions as kind (kind)}
            <button
                type="button"
                class="nt-plain-button nt-battle-small"
                class:nt-chosen={kind === stage.command}
                aria-pressed={kind === stage.command}
                onclick={() => gameSession.chooseAttackCommand(kind)}>{COMMAND_NAMES[kind]}</button
            >
        {/each}
    </div>
{/if}
