#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'

const usage = 'Usage: node tools/deploy/scripts/create-gcs-placeholder.mjs gs://<bucket>/<path>/'
const gcsDirectoryPattern = /^gs:\/\/([^/]+)\/(.+)$/
const tokenCachePath = '/tmp/tabletop-gcs-placeholder-token.json'
const tokenLifetimeMs = 50 * 60 * 1000

const readArgs = () => {
    const target = process.argv[2]
    if (!target) {
        throw new Error(`Missing target directory URL.\n${usage}`)
    }
    const match = gcsDirectoryPattern.exec(target.trim())
    if (!match) {
        throw new Error(`Invalid GCS directory URL "${target}".\n${usage}`)
    }
    const bucket = match[1]
    const rawObjectName = match[2]
    const objectName = rawObjectName.endsWith('/') ? rawObjectName : `${rawObjectName}/`
    return { bucket, objectName, displayUrl: `gs://${bucket}/${objectName}` }
}

const printAccessToken = () =>
    new Promise((resolve, reject) => {
        const child = spawn('gcloud', ['auth', 'print-access-token'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: process.env
        })

        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
        })
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })
        child.on('error', reject)
        child.on('close', (code) => {
            if (code !== 0) {
                reject(
                    new Error(
                        `Failed to get access token (exit ${code}). ${stderr.trim() || 'No stderr'}`
                    )
                )
                return
            }
            const token = stdout.trim()
            if (!token) {
                reject(new Error('Failed to get access token: empty output from gcloud'))
                return
            }
            resolve(token)
        })
    })

const readCachedToken = async () => {
    try {
        const raw = await fs.readFile(tokenCachePath, 'utf8')
        const parsed = JSON.parse(raw)
        if (typeof parsed?.token !== 'string') {
            return undefined
        }
        if (typeof parsed?.expiresAt !== 'number') {
            return undefined
        }
        if (Date.now() >= parsed.expiresAt) {
            return undefined
        }
        return parsed.token
    } catch {
        return undefined
    }
}

const writeCachedToken = async (token) => {
    const payload = {
        token,
        expiresAt: Date.now() + tokenLifetimeMs
    }
    await fs.writeFile(tokenCachePath, JSON.stringify(payload), 'utf8')
}

const resolveAccessToken = async () => {
    const envToken = process.env.TABLETOP_GCS_ACCESS_TOKEN?.trim()
    if (envToken) return envToken

    const cached = await readCachedToken()
    if (cached) return cached

    const token = await printAccessToken()
    await writeCachedToken(token)
    return token
}

const createPlaceholder = async () => {
    const { bucket, objectName, displayUrl } = readArgs()
    const token = await resolveAccessToken()
    const uploadUrl = new URL(
        `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o`
    )
    uploadUrl.searchParams.set('uploadType', 'media')
    uploadUrl.searchParams.set('name', objectName)

    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream'
        },
        body: ''
    })

    if (!response.ok) {
        const details = await response.text()
        throw new Error(
            `Failed to create placeholder ${displayUrl}: ${response.status} ${response.statusText}${
                details ? `\n${details}` : ''
            }`
        )
    }

    console.log(`Created placeholder ${displayUrl}`)
}

createPlaceholder().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})
