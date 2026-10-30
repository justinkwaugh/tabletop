import type { Transaction } from '@google-cloud/firestore'
import type { FastifyInstance } from 'fastify'
import {
    accountStatusAfterCompletionCheck,
    normalizeEmailAddress,
    sessionGenerationOf,
    type User
} from '@tabletop/common'
import {
    TokenService,
    MemoryTokenStore,
    UpdateValidationResult,
    type StoredUser,
    type TaskService,
    type UserStore
} from '@tabletop/backend-services'

import { errorStatusCode } from '../lib/errorStatusCode.js'

export const ORIGINAL_PASSWORD = 'original-password-value'

// The same error shape the application error handler sends, so specs can read error names
export function apiErrorShape(server: FastifyInstance): void {
    server.setErrorHandler(async (error: Error, _request, reply) => {
        if (reply.statusCode < 400) {
            void reply.code(errorStatusCode(error))
        }
        return { status: 'error', error: { ...error, name: error.name, message: error.message } }
    })
}

const transaction: Transaction = Object.create(null)
const locks = { addKeys: async () => {} }

export function memoryUserStore(initial: User, initialPassword?: string) {
    let password = initialPassword
    let current = initial
    let credentialGate = { reached: () => {}, held: Promise.resolve() }
    const stored = (): StoredUser => ({
        ...current,
        passwordHash: password === undefined ? undefined : `hash:${password}`,
        createdAt: undefined,
        updatedAt: undefined
    })
    const replaceCredential = (candidate: string) => {
        password = candidate
        current = {
            ...current,
            hasPassword: true,
            sessionGeneration: sessionGenerationOf(current) + 1
        }
        return current
    }
    const store: UserStore = Object.create(null)
    store.findById = async (id) => (id === current.id ? current : undefined)
    store.findByEmail = async (email) =>
        current.email === normalizeEmailAddress(email) ? current : undefined
    store.findByUsernameAndPassword = async (username, candidate) => {
        const holder = username === current.username && candidate === password ? current : undefined
        credentialGate.reached()
        await credentialGate.held
        return holder
    }
    store.updatePassword = async (_userId, candidate, options) => {
        options?.validate?.(stored())
        await options?.participant?.(transaction, locks)
        return replaceCredential(candidate)
    }
    store.updateUser = async ({
        fields,
        password: candidate,
        currentPassword,
        validator,
        participant
    }) => {
        const original = current
        const fieldsToUpdate: Partial<StoredUser> = {
            ...fields,
            ...(candidate ? { passwordHash: `hash:${candidate}` } : {})
        }
        if (validator?.(stored(), fieldsToUpdate) === UpdateValidationResult.Cancel) {
            return [current, [], current]
        }
        if (currentPassword !== undefined && currentPassword !== password) {
            throw new Error('wrong current password')
        }
        await participant?.(transaction, locks)
        const definedFields = Object.fromEntries(
            Object.entries(fields).filter(([, value]) => value !== undefined)
        )
        const updatedFields = Object.keys(definedFields)
        current = { ...current, ...definedFields }
        if (fields.email && fields.email !== original.email) {
            current = {
                ...current,
                email: normalizeEmailAddress(fields.email),
                emailVerified: false
            }
        }
        if (candidate) {
            replaceCredential(candidate)
            updatedFields.push('password')
        }
        const status = accountStatusAfterCompletionCheck(
            current.status,
            Boolean(current.username && current.email && current.emailVerified)
        )
        if (status !== current.status) {
            current = { ...current, status }
            updatedFields.push('status')
        }
        return [current, updatedFields, original]
    }
    return {
        store,
        account: () => current,
        holdLoginsAfterCredentialCheck: () => {
            let release = () => {}
            let reached = () => {}
            const held = new Promise<void>((resolve) => (release = resolve))
            const firstArrival = new Promise<void>((resolve) => (reached = resolve))
            credentialGate = { reached, held }
            return { release, loginReachedGate: firstArrival }
        }
    }
}

export function memoryTokens(options: { now?: () => Date } = {}) {
    const tokenStore = new MemoryTokenStore()
    const tokenService = new TokenService(tokenStore, options)
    return { tokenStore, tokenService }
}

export type SentMail = {
    kind: 'reset' | 'verification' | 'sensitive'
    userId: string
    token: string
}

export function recordingTasks() {
    const mails: SentMail[] = []
    const tasks: TaskService = Object.create(null)
    tasks.sendAccountChangeNotificationEmail = async () => {}
    tasks.sendPasswordResetEmail = async (mail) => {
        mails.push({ kind: 'reset', ...mail })
    }
    tasks.sendVerificationEmail = async (mail) => {
        mails.push({ kind: 'verification', ...mail })
    }
    tasks.sendAuthVerificationEmail = async (mail) => {
        mails.push({ kind: 'sensitive', ...mail })
    }
    const lastMail = (kind: SentMail['kind']) => {
        const mail = [...mails].reverse().find((candidate) => candidate.kind === kind)
        if (!mail) throw new Error(`no ${kind} mail was sent`)
        return mail
    }
    return { tasks, mails, lastMail }
}
