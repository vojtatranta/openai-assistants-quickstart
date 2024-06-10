import { lt } from "../../../langtail";
import { NextRequest } from "next/server";
import { OpenAIStream, StreamingTextResponse } from "ai";

// Create a new assistant
export async function POST(request: NextRequest) {
  const messages = (await request.json()).messages;

  const result = await lt.prompts.invoke({
    prompt: "weather",
    messages,
    stream: true,
  });

  const stream = OpenAIStream(result);

  return new StreamingTextResponse(stream);
}
