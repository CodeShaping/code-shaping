import { CodeEditorShape } from '../CodeEditorShape/CodeEditorShape'
import {
    OPENAI_MAKE_CODE_PROMPT,
    OPENAI_USER_MAKE_CODE_PROMPT,
    OPENAI_EDIT_PARTIAL_CODE_PROMPT,
    OPENAI_USER_EDIT_PARTIAL_CODE_PROMPT,
} from '../prompt'

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
            content: [],
        },
    ]

    const userContent = messages[1].content as Exclude<MessageContent, string>

    userContent.push({
        type: 'text',
        text: `If user asks to flatten the nested if statements, you can provide a code snippet: def process_transaction(transaction: Transaction, db: Database):
    if transaction.amount <= 0:
        return {"status": "error", "message": "Invalid transaction amount"}
    
    if transaction.sender == transaction.recipient:
        return {"status": "error", "message": "Sender and recipient cannot be the same"}
    
    if not await validate_transaction(transaction):
        return {"status": "error", "message": "Transaction validation failed"}
    
    sender_balance = await db.execute_query(f"SELECT balance FROM accounts WHERE user='{transaction.sender}'")
    recipient_exists = await db.execute_query(f"SELECT id FROM accounts WHERE user='{transaction.recipient}'")
    
    if not (sender_balance[0]['balance'] >= transaction.amount and recipient_exists):
        return {"status": "error", "message": "Insufficient funds or recipient not found"}
    
    # Perform the transaction
    await db.execute_query(f"UPDATE accounts SET balance = balance - {transaction.amount} WHERE user='{transaction.sender}'")
    await db.execute_query(f"UPDATE accounts SET balance = balance + {transaction.amount} WHERE user='{transaction.recipient}'")
    return {"status": "success", "message": "Transaction processed successfully"}`,
    })


    userContent.push({
        type: 'text',
        text: `Example: if user asks to combine queries into a single query, you can provide a code snippet: await db.execute_query(f"""
    BEGIN;
    UPDATE accounts SET balance = balance - {transaction.amount} WHERE user='{transaction.sender}';
    UPDATE accounts SET balance = balance + {transaction.amount} WHERE user='{transaction.recipient}';
    COMMIT;
""")
return {"status": "success", "message": "Transaction processed successfully"}`,
    })


    userContent.push({
        type: 'text',
        text: `and if ask about adding a try catch block, you can provide a code snippet:
        if sender_balance[0]['balance'] >= transaction.amount and recipient_exists:
        try:
            db.execute_query(f"""
                BEGIN;
                UPDATE accounts SET balance = balance - {transaction.amount} WHERE user='{transaction.sender}';
                UPDATE accounts SET balance = balance + {transaction.amount} WHERE user='{transaction.recipient}';
                COMMIT;
            """)
            return {"status": "success", "message": "Transaction processed successfully"}
        except Exception as e:
            db.execute_query("ROLLBACK;")
            return {"status": "error", "message": f"Transaction failed: {str(e)}"}
    else:
        return {"status": "error", "message": "Insufficient funds or recipient not found"}`
    })

    userContent.push({
        type: 'text',
        text: `Example: if user circles all database operations with  draws a diagram with multiple "Query" boxes flowing into a "Batch Query" box. you can add a class: class QueryBatch:
    def __init__(self):
        self.queries = []
    
    def add(self, query):
        self.queries.append(query)
    
    def execute(self, db):
        return db.execute_query("; ".join(self.queries))
        `,
    })

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

    // Prompt the theme
    // userContent.push({
    // 	type: 'text',
    // 	text: `Please make your result use the ${theme} theme.`,
    // })

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
    model: 'gpt-4o'
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
