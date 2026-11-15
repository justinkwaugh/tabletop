<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import PieceIcon from './PieceIcon.svelte'

    let { playerId, onDark = false }: { playerId: string; onDark?: boolean } = $props()

    const session = getGameSession()
</script>

<span class="named">
    <span class="roof">
        <PieceIcon
            name="{session.rooftopSprite({ coords: { x: 0, y: 0 }, playerId })}-0"
            height={24}
            maxWidth={28}
        />
    </span>
    <span class="name">
        <PlayerName
            {playerId}
            backgroundOpacity={0}
            additionalClasses={onDark ? '!p-0 !text-[#e6c595]' : '!p-0 !text-[#2a1609]'}
        />
    </span>
</span>

<style>
    .named {
        display: inline-flex;
        gap: 7px;
        align-items: center;
    }

    .roof {
        display: flex;
        flex: none;
        justify-content: center;
        width: 28px;
    }

    .name {
        position: relative;
        top: 3px;
    }
</style>
