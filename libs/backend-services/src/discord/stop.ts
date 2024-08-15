import { SlashCommandBuilder } from 'discord.js'
import { SlashCommand } from './slashCommand.js'

export const StopCommand: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop notifying about turns and game invitations'),
    toJSON() {
        const data = StopCommand.data.toJSON()
        return {
            ...data,
            integration_types: [0, 1], //0 for guild, 1 for user
            contexts: [0, 1, 2] //0 for guild, 1 for app DMs, 2 for GDMs and other DMs
        }
    }
}
