import { CodeEditorShape } from '../components/Shapes/CodeEditorShape'
import {
    OPENAI_INTERPRETATION_SKETCH_PROMPT,
    OPENAI_USER_INTERPRETATION_SKETCH_PROMPT,
} from './prompt'

export async function getInterpretationFromAI({
    image,
    apiKey,
    text,
    grid,
    codeEditorShape,
}: {
    image: string
    apiKey: string
    text: string
    grid?: {
    	color: string
    	size: number
    	labels: boolean
    }
    codeEditorShape: CodeEditorShape
}) {
    if (!apiKey) throw Error('You need to provide an API key (sorry)')

    const messages: GPT4oCompletionRequest['messages'] = [
        {
            role: 'system',
            content: OPENAI_INTERPRETATION_SKETCH_PROMPT,
        },
        {
            role: 'user',
            content: [],
        },
    ]

    const userContent = messages[1].content as Exclude<MessageContent, string>

    userContent.push({
        type: 'text',
        text: OPENAI_USER_INTERPRETATION_SKETCH_PROMPT,
    })

    // Add the image
    userContent.push({
        type: 'image_url',
        image_url: {
            url: image,
            detail: 'high',
        },
    })


    if (text) {
        userContent.push({
            type: 'text',
            text: `Here's a list of text that we found in the annotations:\n${text}`,
        })
    }

    userContent.push(
        {
            type: 'text',
            text: `And here's the code that user annotated with: ${codeEditorShape.props.code}`,
        }
    )

    const body: GPT4oCompletionRequest = {
        model: 'gpt-4o',
        max_tokens: 4096,
        temperature: 1,
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
    } catch (e: any) {
        throw Error(`Could not contact OpenAI: ${e.message}`)
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
    model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo'
    messages: {
        role: 'system' | 'user' | 'assistant' | 'function'
        content: MessageContent
        name?: string | undefined
    }[]
    functions?: any[] | undefined
    function_call?: any | undefined
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