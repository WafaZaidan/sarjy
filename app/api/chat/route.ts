import OpenAI from "openai";

import {NextResponse} from "next/server";

const client = new OpenAI({
    apiKey: process.env.AI_API_KEY,
})


export async function POST(request: Request) {
    try {
        const messageJson = await request.json()
        const message = messageJson.message
        console.log('message', message)
        console.log('message', typeof message)

        if (typeof message !== 'string' || !message.trim()) {
            return NextResponse.json({
                error: "Invalid Message",
                status: "400"
            })
        }
        console.log('sending for response', message)

        const response = await client.responses.create({
            model: "gpt-5-nano",
            instructions: " You are Sarjy a voice aI assistant, give precise and concise answers",
            input: message,
        })
        console.log('res text', response.output_text)
        return NextResponse.json({
            message: response.output_text
        })

    } catch (error) {
        console.log('Oh no something went wrong', error)
    }
    return NextResponse.json()

}
