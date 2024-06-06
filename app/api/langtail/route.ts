import { NextApiRequest } from "next";
import { lt } from "../../langtail";

// Create a new assistant
export async function GET(request: NextApiRequest) {
  const url = new URL(request.url);

  const messages = JSON.parse(url.searchParams.get("messages"));
  console.log("messages", messages);
  const result = await lt.prompts.invoke({
    prompt: url.searchParams.get("prompt"),
    messages,
  });

  return Response.json(result);
}
