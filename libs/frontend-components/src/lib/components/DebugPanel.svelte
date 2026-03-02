<script lang="ts">
    import JSONTree from 'svelte-json-tree'
    import { Tabs, TabItem } from 'flowbite-svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.js'

    let gameSession = getGameSession()
    let copiedState = false
    let copiedActions = false
    let stateCopyTimeout: ReturnType<typeof setTimeout> | undefined
    let actionsCopyTimeout: ReturnType<typeof setTimeout> | undefined

    async function copyTextToClipboard(text: string): Promise<void> {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return
        }

        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.top = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
    }

    function markCopied(target: 'state' | 'actions'): void {
        if (target === 'state') {
            copiedState = true
            if (stateCopyTimeout) {
                clearTimeout(stateCopyTimeout)
            }
            stateCopyTimeout = setTimeout(() => {
                copiedState = false
            }, 1200)
            return
        }

        copiedActions = true
        if (actionsCopyTimeout) {
            clearTimeout(actionsCopyTimeout)
        }
        actionsCopyTimeout = setTimeout(() => {
            copiedActions = false
        }, 1200)
    }

    async function copyStateToClipboard(): Promise<void> {
        const stateJson = JSON.stringify(gameSession.gameState.dehydrate(), null, 2)
        await copyTextToClipboard(stateJson)
        markCopied('state')
    }

    async function copyActionsToClipboard(): Promise<void> {
        const actionsJson = JSON.stringify(gameSession.actions.toReversed(), null, 2)
        await copyTextToClipboard(actionsJson)
        markCopied('actions')
    }
</script>

<div
    class="rounded-lg dark:bg-black space-y-2 text-left ms-2 p-4 sm:h-[calc(100dvh-84px)] h-[calc(100dvh-116px)] overflow-auto"
>
    <div class="flex items-center gap-2">
        <button
            type="button"
            class="rounded border border-zinc-500 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-100 hover:bg-zinc-800"
            onclick={copyStateToClipboard}
        >
            {copiedState ? 'State copied' : 'Copy state'}
        </button>
        <button
            type="button"
            class="rounded border border-zinc-500 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-100 hover:bg-zinc-800"
            onclick={copyActionsToClipboard}
        >
            {copiedActions ? 'Actions copied' : 'Copy actions'}
        </button>
    </div>
    <Tabs tabStyle="pill" divider={false} classes={{ content: 'dark:bg-gray-200 rounded-lg p-2' }}>
        <TabItem open title="Game">
            <div style="--json-tree-font-size: 14px;">
                <JSONTree value={gameSession.game} />
            </div>
        </TabItem>
        <TabItem title="State">
            <div style="--json-tree-font-size: 14px;">
                <JSONTree value={gameSession.gameState.dehydrate()} />
            </div>
        </TabItem>
        <TabItem title="Actions">
            <div style="--json-tree-font-size: 14px;">
                <JSONTree value={gameSession.actions.toReversed()} />
            </div>
        </TabItem>
    </Tabs>
</div>
