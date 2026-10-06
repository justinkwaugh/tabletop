<script lang="ts">
    import type { EarningsPopups } from '$lib/animators/earningsPopups.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { earnings }: { earnings: EarningsPopups } = $props()
    const gameSession = getGameSession()

    function track(id: string) {
        return (node: HTMLElement) => {
            earnings.setNode(id, node)
            return () => earnings.setNode(id, undefined)
        }
    }
</script>

<div class="pointer-events-none absolute inset-0" aria-hidden="true">
    {#each earnings.popups as popup (popup.id)}
        <div
            {@attach track(popup.id)}
            class="absolute font-bold flex items-center gap-0.5 rounded-full border-2 border-black/25 py-0.5 pr-3 pl-2.5 text-[21px] leading-tight whitespace-nowrap opacity-0 shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
            style:font-family="'MarraCash Cinzel', Georgia, serif"
            style:left="{popup.x}px"
            style:top="{popup.y}px"
            style:background-color={gameSession.colors.getPlayerBgColorValue(popup.playerId)}
            style:color={gameSession.colors.getPlayerTextColorValue(popup.playerId)}
        >
            <span class="text-[29px] leading-none font-black">+</span>{popup.amount}
        </div>
    {/each}
</div>
