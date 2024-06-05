import { NextApiRequest } from "next";
import { lt } from "../../langtail";

// Create a new assistant
export async function GET(request: NextApiRequest) {
  const url = new URL(request.url);

  const options = {
    prompt: url.searchParams.get("prompt"),
    variables: {
      location: url.searchParams.get("location"),
    },
  };

  const result = await lt.prompts.invoke(options);

  return Response.json({ result });
}
