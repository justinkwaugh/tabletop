<script lang="ts">
    import { Card, Hr } from 'flowbite-svelte'
    import { ExternalAuthService } from '@tabletop/common'
    import DiscordSignIn, {
        isEnabled as isDiscordSigninEnabled
    } from '$lib/components/DiscordSignIn.svelte'
    import { getAppContext } from '@tabletop/frontend-components'

    let { authorizationService, api } = getAppContext()

    let user = $derived.by(() => {
        return authorizationService.getSessionUser()
    })

    let linkedAccountIdsByType: Map<string, string> = $derived.by(() => {
        return new Map(
            user?.externalIds?.map((id) => {
                const split = id.split(':', 2)
                const type = split[0]
                return [type, id]
            }) ?? []
        )
    })

    function discordBot() {
        const width = 550
        const height = 700
        const left = (screen.width - width) / 2
        const top = (screen.height - height) / 2
        const FRONTEND_HOST = window.location.origin
        const encodedHost = encodeURIComponent(FRONTEND_HOST ?? '')
        const url = `https://discord.com/oauth2/authorize?client_id=1260059992589865133`
        window.open(
            url,
            'Discord Bot Authorization',
            `popup=true,resizable=no, width=${width},height=${height},top=${top},left=${left}`
        )
    }
</script>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center space-y-6">
    <Card class="bg-gray-300 p-4 sm:p-6">
        <div class="flex flex-col space-y-6">
            <h3 class="text-xl font-medium text-gray-900 dark:text-white">Web Notifications</h3>
            <div class="text-white-600 text-sm dark:text-gray-300 mb-4">
                You can receive notifications from Board Together directly in your web browser. <br
                /><br />Just accept the permission prompt that your browser shows you.
            </div>

            {#if isDiscordSigninEnabled}
                <Hr class="my-4" />
                <h3 class="text-xl font-medium text-gray-900 dark:text-white">
                    Discord Notifications
                </h3>
                <div class="text-white-600 text-sm dark:text-gray-300 mb-4">
                    Board Together has a Discord bot that can send you direct notification messages.
                    No server webhook configuration is needed, and the messages will come to you
                    regardless of what server you are in.
                </div>
                {#if linkedAccountIdsByType.get(ExternalAuthService.Discord)}
                    <div class="text-white-600 text-sm dark:text-gray-300 mt-4">
                        Click the button to add the bot to your Discord account.
                    </div>
                    <div class="flex flex-row justify-center">
                        <DiscordSignIn mode={'bot'} />
                    </div>
                    <div class="mt-2text-white-600 text-sm dark:text-gray-300">
                        Bot Commands:
                        <div class="dark:bg-gray-700 p-4 mt-2 rounded-sm">
                            <ul>
                                <li>
                                    <span class="tracking-wider">/notify</span> - Enable notifications
                                </li>
                                <li>
                                    <span class="tracking-wider">/stop</span> - Disable notifications
                                </li>
                            </ul>
                        </div>
                    </div>
                {:else}
                    <div class="text-white-600 text-sm dark:text-gray-300 mt-4">
                        First you need to link your Discord account. Click the "link" button below
                        to do so.
                    </div>
                    <div class="flex flex-row justify-center">
                        <DiscordSignIn mode={'link'} />
                    </div>
                {/if}
            {/if}
        </div>
    </Card>
</div>
