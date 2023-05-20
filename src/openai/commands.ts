import { Message } from "discord.js"
import { DiscordClient } from "../Discord/DiscordClient"
import { Registry } from "../Registry/Registry"

export enum PROMPTS {
    simple = "asd",
    management = "dsa",
    setIdentity = "dsa eres",
    memory = "dsa memo",
    memory_access ="dsa mem",

    set = "set",
    book = "book",
}

export const AI_COMMANDS =[
    {
        id: 120,
        content: PROMPTS.setIdentity,
        response: (message: Message, bot: DiscordClient, registry: Registry) => {
            bot.openai.setIdentity(message)
        }
    },
    {
        id: 121,
        content: PROMPTS.simple,
        response: (message: Message, bot: DiscordClient, registry: Registry) => {
            bot.openai.triggerPrompt(message)
        }
    },
    {
        id: 121,
        content: PROMPTS.memory,
        response: (message: Message, bot: DiscordClient, registry: Registry) => {
            bot.openai.getMemory(message)
        }
    },
    {
        id: 124,
        content: PROMPTS.memory_access,
        response: (message: Message, bot: DiscordClient, registry: Registry) => {
            bot.openai.lookUpOrSetMemory(message)
        }
    }
]