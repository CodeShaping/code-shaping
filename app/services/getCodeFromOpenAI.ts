import { CodeEditorShape } from '../components/Shapes/CodeEditorShape'
import {
    OPENAI_MAKE_CODE_PROMPT,
    OPENAI_USER_MAKE_CODE_PROMPT,
    OPENAI_EDIT_PARTIAL_CODE_PROMPT,
    OPENAI_USER_EDIT_PARTIAL_CODE_PROMPT,
} from './prompt'

export async function getCodeFromOpenAI({
    interpretation,
    image,
    apiKey,
    text,
    grid,
    previousCodeEditors = [],
    intended_edit,
}: {
    interpretation: string
    image: string
    apiKey: string
    text: string
    grid?: {
        color: string
        size: number
        labels: boolean
    }
    previousCodeEditors?: CodeEditorShape[]
    intended_edit?: string
}) {
    if (!apiKey) throw Error('You need to provide an API key (sorry)')



    const messages: GPT4oCompletionRequest['messages'] = [
        {
            role: 'system',
            content: intended_edit?.length ? OPENAI_EDIT_PARTIAL_CODE_PROMPT : OPENAI_MAKE_CODE_PROMPT,
        },
        {
            role: 'user',
            content: []
        },
    ]

    const userContent = messages[1].content as Exclude<MessageContent, string>

    userContent.push({
        type: 'text',
        text: intended_edit?.length ? OPENAI_USER_EDIT_PARTIAL_CODE_PROMPT : OPENAI_USER_MAKE_CODE_PROMPT,
    })

    // Add the image
    userContent.push({
        type: 'image_url',
        image_url: {
            url: image,
            detail: 'high',
        },
    })

    if (interpretation) {
        userContent.push({
            type: 'text',
            text: `The user specified following action to take: "${interpretation}"`,
        })
    }

    // Add the strings of text
    if (text) {
        userContent.push({
            type: 'text',
            text: `Here's a list of text that we found in the annotations:\n${text}`,
        })
    }

    if (grid) {
        userContent.push({
            type: 'text',
            text: `The user have a ${grid.color} grid overlaid on top. Each cell of the grid is ${grid.size}x${grid.size}px.`,
        })
    }

    // Add the previous previews code
    for (let i = 0; i < previousCodeEditors.length; i++) {
        const preview = previousCodeEditors[i]
        userContent.push({
            type: 'text',
            text: `The users also included the code in the code editor:\n${preview.props.code}`,
        })
    }

    if (intended_edit?.length) {
        userContent.push({
            type: 'text',
            text: `The user intended to edit the code to: "${intended_edit}"`,
        })
    }


    const body: GPT4oCompletionRequest = {
        model: 'gpt-4o',
        max_tokens: 4096,
        temperature: 0,
        messages,
        seed: 42,
        n: 1,
    }

    let json = null

    try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        })
        json = await resp.json()
    } catch (e: unknown) {
        throw Error(`Could not contact OpenAI: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }

    return json
}

type MessageContent =
    | string
    | (
        | string
        | {
            type: 'image_url'
            image_url:
            | string
            | {
                url: string
                detail: 'low' | 'high' | 'auto'
            }
        }
        | {
            type: 'text'
            text: string
        }
    )[]

export type GPT4oCompletionRequest = {
    model: 'gpt-4o'
    messages: {
        role: 'system' | 'user' | 'assistant' | 'function'
        content: MessageContent
        name?: string | undefined
    }[]
    functions?: unknown[] | undefined
    function_call?: unknown | undefined
    stream?: boolean | undefined
    temperature?: number | undefined
    top_p?: number | undefined
    max_tokens?: number | undefined
    n?: number | undefined
    best_of?: number | undefined
    frequency_penalty?: number | undefined
    presence_penalty?: number | undefined
    seed?: number | undefined
    logit_bias?:
    | {
        [x: string]: number
    }
    | undefined
    stop?: (string[] | string) | undefined
}
