<script lang="ts">
    import { GameChatMessage } from '@tabletop/common'
    import { Toast } from 'flowbite-svelte'

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

<Toast dismissable={false}>
    <div class="flex flex-row justify-start items-center gap-x-4 text-md text-gray-200">
        <span class="text-nowrap rounded px-2 {playerBgColor} font-medium {playerTextColor}"
            >{playerName}</span
        >
        <div class="flex flex-col justify-center items-start">
            {#each textSplit(message.text) as text}
                <p class="leading-[1.1rem]">{text}</p>
            {/each}
        </div>
    </div>
</Toast>
