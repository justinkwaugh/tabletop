<script lang="ts">
    import '../../app.css'
    import {
        Navbar,
        NavBrand,
        Avatar,
        Button,
        Dropdown,
        DropdownHeader,
        DropdownDivider,
        DropdownItem,
        Modal,
        Banner,
        NavUl,
        NavLi,
        Toggle,
        Heading,
        Alert,
        DropdownGroup
    } from 'flowbite-svelte'
    import darkLogo from '$lib/components/images/dark-logo.png'
    import { goto } from '$app/navigation'
    import { onMount } from 'svelte'
    import { UserStatus } from '@tabletop/common'
    import { VersionChange, GameEditForm, getAppContext } from '@tabletop/frontend-components'
    import { toast } from 'svelte-sonner'
    import { onceMounted } from '$lib/components/RunOnceMounted.svelte'
    import { BellSolid } from 'flowbite-svelte-icons'

    let {
        api,
        authorizationService,
        gameService,
        notificationService,
        visibilityService,
        libraryService,
        manifestService
    } = getAppContext()
    let titlesById = $derived(libraryService.titlesById)
    let loading = $derived(libraryService.loading)

    let { children } = $props()

    let sessionUser = $derived(authorizationService.getSessionUser())
    let showCreateGameModel = $state(false)
    let showCancelPrompt = $state(false)

    let seed = $derived.by(() => {
        if (!gameService.currentGameSession) {
            return undefined
        }

        const game = gameService.currentGameSession.primaryGame

        if (!authorizationService.isAdmin) {
            return undefined
        }

        return game.seed
    })

    let gameLogicVersion = $derived.by(() => {
        if (!gameService.currentGameSession) {
            return undefined
        }

        const game = gameService.currentGameSession.primaryGame
        return manifestService.getLogicVersion(game.typeId)
    })

    let gameUiVersion = $derived.by(() => {
        if (!gameService.currentGameSession) {
            return undefined
        }

        const game = gameService.currentGameSession.primaryGame
        return manifestService.getUiVersion(game.typeId)
    })

    let currentDefinition = $derived.by(() => {
        if (!gameService.currentGameSession) {
            return undefined
        }

        return titlesById[gameService.currentGameSession.primaryGame.typeId]
    })

    async function onLogout() {
        await api.logout()
        gameService.clear()
        await authorizationService.onLogout()
    }

    const logoutChannel = new BroadcastChannel('logout')
    logoutChannel.onmessage = function (e) {
        onLogout()
    }

    async function logout() {
        onLogout()
        logoutChannel.postMessage({})
    }

    async function gotoProfile() {
        await goto('/profile')
    }

    async function gotoPreferences() {
        showCancelPrompt = false
        await goto('/preferences')
    }

    async function gotoNotifications() {
        showCancelPrompt = false
        await goto('/notifications')
    }

    async function gotoDashboard() {
        await goto('/dashboard')
    }

    async function gotoAbout() {
        await goto('/about')
    }

    function createGame() {
        if (loading) {
            toast.info('Loading game library...')
            return
        }
        showCreateGameModel = true
    }

    async function closeCreateModal() {
        showCreateGameModel = false
    }

    async function onGameCreate() {
        await closeCreateModal()
        notificationService.showPrompt()
    }

    const loginChannel = new BroadcastChannel('login')
    loginChannel.onmessage = async function (e) {
        if (e.data.status === 'success' && e.data.user) {
            await authorizationService.onLogin(e.data.user)
        }
    }

    const userUpdateChannel = new BroadcastChannel('userUpdated')
    userUpdateChannel.onmessage = function (e) {
        const user = e.data.user
        authorizationService.setSessionUser(user)
    }

    async function requestNotificationPermission() {
        notificationService.hidePrompt()
        await notificationService.requestWebNotificationPermission()
    }

    async function dismissPrompt() {
        notificationService.hidePrompt()
        showCancelPrompt = true
    }

    onMount(() => {
        notificationService.onMounted()
        visibilityService.setDocument(document)
        if (/mobile/i.test(navigator.userAgent ?? '') && !location.hash) {
            window.scrollTo(0, 1)
        }
    })

    $effect(() => {
        const versionChange = api.versionChange
        switch (versionChange) {
            case VersionChange.MajorUpgrade:
            case VersionChange.Rollback:
                console.log('Major upgrade detected')
                onceMounted(() => {
                    toast.warning(
                        'The site has been updated and requires a page refresh.  Refreshing in 5 seconds',
                        {
                            duration: Number.POSITIVE_INFINITY,
                            classes: {
                                closeButton: 'hidden'
                            }
                        }
                    )
                    setTimeout(() => {
                        location.reload()
                    }, 5000)
                })
                break
            case VersionChange.MinorUpgrade:
                console.log('Minor upgrade detected')
                onceMounted(() => {
                    toast.info(
                        'The site has been updated with new features or fixes, please refresh the page when you have a moment',
                        {
                            duration: Number.POSITIVE_INFINITY
                        }
                    )
                })
                break
            default:
                break
        }
    })

</script>

{#snippet gameName()}
    {#if gameService.currentGameSession}
        <Heading
            class="text-nowrap text-center mt-2 sm:mt-0 max-w-[320px] dark:text-gray-200 font-medium tight overflow-clip text-ellipsis"
            style=""
            tag="h4"
            >{currentDefinition?.info.metadata.beta ? 'BETA: ' : ''}{gameService.currentGameSession
                .primaryGame.name}</Heading
        >
    {/if}
{/snippet}

{#snippet gameSeed()}
    {#if seed}
        <div
            class="text-nowrap text-center mb-2 sm:mb-0 max-w-[320px] dark:text-gray-400 font-mono text-xs overflow-clip text-ellipsis"
            style=""
        >
            Seed: {seed}
        </div>
    {/if}
{/snippet}

<Navbar
    fluid={true}
    class="{currentDefinition?.info.metadata.beta ? 'dark:bg-red-900' : 'dark:bg-gray-800'} "
>
    <div class="flex flex-col w-full">
        <div class="flex flex-row justify-between items-center w-full">
            <div class="flex justify-center items-center">
                <NavBrand href="/library" class="shrink-0 cursor-pointer">
                    <img src={darkLogo} alt="Board Together" class="h-8 w-auto" />
                </NavBrand>

                <div
                    class="hidden sm:block rounded-lg py-2 px-2 md:px-4 flex flex-col justify-start items-start ml-4"
                >
                    {@render gameName()}
                </div>
            </div>
            <div class="flex items-center">
                <div class="flex items-center gap-3 mr-4">
                    <a
                        href="/about"
                        class="hidden md:inline-flex text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                    >
                        About Us
                    </a>
                    <div class="flex items-center gap-3">
                        <a
                            href="https://github.com/justinkwaugh/tabletop"
                            target="_blank"
                            rel="noreferrer"
                            class="inline-flex items-center leading-none"
                        >
                            <span class="sr-only">GitHub</span>
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                preserveAspectRatio="xMidYMid meet"
                                class="h-5 w-5 block text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                fill="currentColor"
                            >
                                <path
                                    d="M12 .5C5.65.5.5 5.77.5 12.26c0 5.2 3.44 9.6 8.21 11.17.6.12.82-.27.82-.6 0-.3-.01-1.1-.02-2.16-3.34.74-4.04-1.65-4.04-1.65-.55-1.42-1.34-1.8-1.34-1.8-1.09-.77.08-.76.08-.76 1.2.09 1.83 1.26 1.83 1.26 1.08 1.89 2.84 1.35 3.53 1.03.11-.8.42-1.35.77-1.66-2.67-.31-5.47-1.36-5.47-6.05 0-1.34.46-2.43 1.22-3.29-.12-.31-.53-1.56.12-3.26 0 0 1-.33 3.3 1.26.96-.27 1.98-.4 3-.41 1.02.01 2.05.14 3 .41 2.3-1.6 3.3-1.26 3.3-1.26.65 1.7.24 2.95.12 3.26.76.86 1.22 1.95 1.22 3.29 0 4.7-2.81 5.74-5.49 6.04.43.38.82 1.13.82 2.28 0 1.64-.01 2.96-.01 3.36 0 .33.22.72.83.6 4.77-1.57 8.2-5.97 8.2-11.17C23.5 5.77 18.35.5 12 .5z"
                                />
                            </svg>
                        </a>
                        <a
                            href="https://discord.gg/5ggK5VGGvA"
                            target="_blank"
                            rel="noreferrer"
                            class="inline-flex items-center leading-none"
                        >
                            <span class="sr-only">Discord</span>
                            <svg
                                aria-hidden="true"
                                viewBox="0 -28.5 256 256"
                                preserveAspectRatio="xMidYMid meet"
                                class="h-5 w-5 block text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                fill="currentColor"
                            >
                                <path
                                    d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"
                                />
                            </svg>
                        </a>
                    </div>
                </div>
                {#if sessionUser}
                    {#if sessionUser.status === UserStatus.Active}
                        <Button size="xs" color="blue" class="me-4 h-[30px]" onclick={gotoDashboard}
                            >My Games</Button
                        >
                    {/if}

                    <Avatar id="user-drop" class="cursor-pointer" />
                    <Dropdown triggeredBy="#user-drop">
                        <DropdownGroup class="py-1">
                            <DropdownHeader class="py-2">
                                <span class="block text-sm"
                                    >{sessionUser.username || 'username not assigned'}</span
                                >
                            </DropdownHeader>
                            <DropdownDivider />
                            <DropdownItem class="w-full text-left" onclick={gotoProfile}
                                >Profile</DropdownItem
                            >
                            <DropdownItem class="w-full text-left" onclick={gotoPreferences}
                                >Preferences</DropdownItem
                            >
                            <DropdownItem class="w-full text-left" onclick={gotoNotifications}
                                >Notifications</DropdownItem
                            >
                            <DropdownDivider />
                            <DropdownItem onclick={gotoAbout} class="md:hidden w-full text-left"
                                >About us</DropdownItem
                            >

                            <DropdownDivider class="md:hidden" />
                            {#if authorizationService.isAdmin}
                                <li>
                                    <Toggle
                                        bind:checked={authorizationService.debugViewEnabled}
                                        class="rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                                        >Debug</Toggle
                                    >
                                </li>
                                <li>
                                    <Toggle
                                        bind:checked={authorizationService.adminCapabilitiesEnabled}
                                        class="rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                                        >Admin</Toggle
                                    >
                                </li>
                            {/if}
                            <DropdownItem class="w-full text-left" onclick={logout}
                                >Sign out</DropdownItem
                            >
                            {#if authorizationService.isAdmin}
                                <DropdownDivider />
                                <DropdownItem
                                    class="w-full text-left dark:text-gray-400 font-mono text-xs py-1"
                                    >FE: v{manifestService.getFrontendVersion()}</DropdownItem
                                >
                                {#if gameLogicVersion}
                                    <DropdownItem
                                        class="w-full text-left dark:text-gray-400 font-mono text-xs py-1"
                                        >Logic: v{gameLogicVersion ?? 'N/A'}</DropdownItem
                                    >
                                {/if}
                                {#if gameUiVersion}
                                    <DropdownItem
                                        class="w-full text-left dark:text-gray-400 font-mono text-xs py-1"
                                        >UI: v{gameUiVersion ?? 'N/A'}</DropdownItem
                                    >
                                {/if}
                                {#if seed}
                                    <DropdownItem class="w-full text-left py-1"
                                        >{@render gameSeed()}</DropdownItem
                                    >
                                {/if}
                            {/if}
                        </DropdownGroup>
                    </Dropdown>
                {/if}
            </div>
        </div>
        <div class="flex justify-center sm:hidden w-full overflow-hidden text-ellipsis">
            {@render gameName()}
        </div>
    </div>
</Navbar>
<Modal
    bind:open={showCreateGameModel}
    size="xs"
    autoclose={false}
    class="w-full"
    outsideclose
    dismissable={false}
    onclick={(e) => e.stopPropagation()}
>
    <GameEditForm oncancel={() => closeCreateModal()} onsave={(game) => onGameCreate()} />
</Modal>
<Modal
    bind:open={showCancelPrompt}
    size="xs"
    autoclose={false}
    class="w-full"
    outsideclose
    dismissable={false}
    onclick={(e) => e.stopPropagation()}
>
    <Alert color="blue" class="dark:bg-transparent dark:text-blue-400">
        <div class="flex items-center gap-3">
            <span class="text-lg font-medium">Just so you know...</span>
        </div>
        <p class="mt-2 mb-4 text-sm">
            If you do not want to be prompted about notifications any more, you can configure that
            in your prefences.
        </p>
        <div class="flex gap-2">
            <Button
                onclick={() => {
                    showCancelPrompt = false
                }}
                size="xs"
                color="blue">Got it</Button
            >
            <Button onclick={() => gotoPreferences()} size="xs" outline color="light"
                >Go to Preferences</Button
            >
        </div>
    </Alert>
</Modal>
{#if notificationService.shouldShowPrompt()}
    <Banner id="default-banner" class="relative" type="top" dismissable={false}>
        <div class="flex items-center justify-between w-full">
            <div class="flex items-center">
                <p class="flex items-center text-sm font-normal text-gray-500 dark:text-gray-400">
                    <span class="inline-flex p-1 me-3 bg-gray-200 rounded-full dark:bg-gray-600">
                        <BellSolid class="w-3 h-3 text-gray-500 dark:text-gray-400" />
                        <span class="sr-only">Light bulb</span>
                    </span>
                    <span>
                        Receive notifications about game invitations and to let you know it is your
                        turn?
                    </span>
                </p>
                <Button
                    onclick={() => requestNotificationPermission()}
                    color="blue"
                    class="ms-4 max-h-[24px]"
                    size="xs">Allow</Button
                >
            </div>

            <div class="flex">
                <Button
                    onclick={() => dismissPrompt()}
                    color="light"
                    class="ms-4 max-h-[24px]"
                    size="xs">Close</Button
                >
            </div>
        </div></Banner
    >
{/if}
{@render children()}
