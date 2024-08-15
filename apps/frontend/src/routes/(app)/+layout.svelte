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
        NavHamburger,
        Modal,
        Banner
    } from 'flowbite-svelte'
    import darkLogo from '$lib/components/images/dark-logo.png'
    import { goto } from '$app/navigation'
    import { getContext, onMount } from 'svelte'
    import GameEditForm from '$lib/components/GameEditForm.svelte'
    import { UserStatus } from '@tabletop/common'
    import type { AppContext } from '$lib/stores/appContext.svelte'
    import { BellSolid } from 'flowbite-svelte-icons'
    import { slide } from 'svelte/transition'

    let appContext = getContext('appContext') as AppContext

    let { children } = $props()

    let sessionUser = $derived(appContext.authorizationService.getSessionUser())
    let showCreateGameModel = $state(false)

    async function onLogout() {
        await appContext.api.logout()
        appContext.gameService.clear()
        await appContext.authorizationService.onLogout()
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

    async function gotoDashboard() {
        await goto('/dashboard')
    }

    function createGame() {
        showCreateGameModel = true
    }

    async function closeCreateModal() {
        showCreateGameModel = false
        await gotoDashboard()
    }

    async function onGameCreate() {
        await closeCreateModal()
        appContext.notificationService.showPrompt()
    }

    const loginChannel = new BroadcastChannel('login')
    loginChannel.onmessage = async function (e) {
        if (e.data.status === 'success' && e.data.user) {
            await appContext.authorizationService.onLogin(e.data.user)
        }
    }

    const userUpdateChannel = new BroadcastChannel('userUpdated')
    userUpdateChannel.onmessage = function (e) {
        const user = e.data.user
        appContext.authorizationService.setSessionUser(user)
    }

    async function requestNotificationPermission() {
        appContext.notificationService.hidePrompt()
        await appContext.notificationService.requestWebNotificationPermission()
    }

    async function dismissPrompt() {
        appContext.notificationService.hidePrompt()
    }

    onMount(() => {
        appContext.notificationService.onMounted()
    })

    const slideParams = { axis: 'y', duration: 600 }
</script>

<Navbar fluid={true} class="bg-gray-100">
    <NavBrand href="/">
        <img src={darkLogo} alt="Board Together" class="h-8 w-auto" />
    </NavBrand>

    <div class="flex md:order-2">
        {#if sessionUser}
            {#if sessionUser.status === UserStatus.Active}
                <Button size="xs" color="blue" class="me-4" onclick={createGame}>New Game</Button>
            {/if}

            <Avatar id="user-drop" class="cursor-pointer" rounded />
            <Dropdown triggeredBy="#user-drop">
                <DropdownHeader>
                    <span class="block text-sm"
                        >{sessionUser.username || 'username not assigned'}</span
                    >
                </DropdownHeader>
                {#if sessionUser.status === UserStatus.Active}
                    <DropdownItem on:click={gotoDashboard}>Dashboard</DropdownItem>
                {/if}
                <DropdownItem on:click={gotoProfile}>Profile</DropdownItem>
                <DropdownDivider />
                <DropdownItem on:click={logout}>Sign out</DropdownItem>
            </Dropdown>
        {/if}
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
{#if appContext.notificationService.shouldShowPrompt()}
    <Banner
        id="default-banner"
        position="relative"
        bannerType="info"
        dismissable={false}
        classInner="w-full"
    >
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
