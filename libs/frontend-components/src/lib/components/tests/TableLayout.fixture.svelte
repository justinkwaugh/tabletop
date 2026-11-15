<script lang="ts">
    import { untrack } from 'svelte'
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import { setGameSession } from '$lib/model/gameSessionContext.js'
    import DefaultTableLayout from '../DefaultTableLayout.svelte'
    let { session }: { session: GameSession<any, any> } = $props()
    setGameSession(untrack(() => session))
</script>

<div class="flex flex-col w-screen overflow-auto">
    <DefaultTableLayout>
        {#snippet sideContent()}<p>Players</p>{/snippet}
        {#snippet gameContent()}
            <p style="text-align: right">
                Winner<span
                    data-testid="hidden-label"
                    style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%)"
                    >Player name</span
                >
            </p>
        {/snippet}
    </DefaultTableLayout>
</div>
