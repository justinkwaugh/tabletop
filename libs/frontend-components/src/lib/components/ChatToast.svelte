<script lang="ts">
    import { GameChatMessage } from '@tabletop/common'

    let {
        message,
        playerName,
        playerBgColor,
        playerTextColor
    }: {
        message: GameChatMessage
        playerName: string
        playerBgColor: string
        playerTextColor: string
    } = $props()

    function textSplit(text: string) {
        return text.split('\n')
    }
</script>

<div class="rounded-lg bg-blue-900 border border-black text-gray-200 p-4">
    <div class="flex flex-row justify-start items-center gap-x-4 text-md">
        <span class="text-nowrap rounded px-2 {playerBgColor} font-medium {playerTextColor}"
            >{playerName}</span
        >
        <div class="flex flex-col justify-center items-start">
            {#each textSplit(message.text) as text}
                <p class="text-gray-200 leading-[1.1rem]">{text}</p>
            {/each}
        </div>
    </div>
</div>
