import type { GameChatMessage } from '@tabletop/common'
import type { ComponentType } from 'svelte'
import { toast } from 'svelte-sonner'
import { ChatEventType, type ChatEvent } from '$lib/services/chatService.js'
import type { GameSessionView } from '$lib/model/gameSessionView.js'
import ChatToast from '$lib/components/ChatToast.svelte'
import {
    adminChatAuthorBgColor,
    adminChatAuthorName,
    adminChatAuthorTextColor
} from '$lib/components/chatPresentation.js'

export function toastNewChatMessages(gameSession: GameSessionView, chatShown: () => boolean) {
    function attribution(message: GameChatMessage) {
        if (message.admin) {
            return {
                playerName: adminChatAuthorName,
                playerBgColor: adminChatAuthorBgColor,
                playerTextColor: adminChatAuthorTextColor
            }
        }
        return {
            playerName: gameSession.getPlayerName(message.playerId),
            playerBgColor: gameSession.colors.getPlayerBgColorValue(message.playerId),
            playerTextColor: gameSession.colors.getPlayerTextColorValue(message.playerId)
        }
    }
    async function listener(event: ChatEvent) {
        if (event.eventType === ChatEventType.NewGameChatMessage && !chatShown()) {
            toast.custom(ChatToast as unknown as ComponentType, {
                duration: 3000,
                position: 'bottom-left',
                componentProps: { message: event.message, ...attribution(event.message) }
            })
        }
    }
    const chatService = gameSession.chatService
    chatService.addListener(listener)
    return () => chatService.removeListener(listener)
}
