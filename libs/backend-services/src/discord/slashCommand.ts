import { SlashCommandBuilder } from 'discord.js'

export type SlashCommand = {
    data: SlashCommandBuilder
    toJSON: () => unknown
}
