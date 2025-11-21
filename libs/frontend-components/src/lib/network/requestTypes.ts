import { Type, type Static } from 'typebox'
export type Credentials = Static<typeof Credentials>
export const Credentials = Type.Object({
    username: Type.String(),
    password: Type.String()
})
