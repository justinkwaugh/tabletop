import { type Static, Type } from 'typebox'

const TelegramChat = Type.Object({
    id: Type.Number(),
    type: Type.String()
})

// Telegram sends many more fields; only these are read.
export type TelegramUpdate = Static<typeof TelegramUpdate>
export const TelegramUpdate = Type.Object({
    update_id: Type.Number(),
    message: Type.Optional(
        Type.Object({
            chat: TelegramChat,
            from: Type.Optional(Type.Object({ language_code: Type.Optional(Type.String()) })),
            text: Type.Optional(Type.String())
        })
    ),
    my_chat_member: Type.Optional(
        Type.Object({
            chat: TelegramChat,
            new_chat_member: Type.Object({ status: Type.String() })
        })
    )
})
