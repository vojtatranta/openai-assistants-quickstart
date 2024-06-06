import { NextApiRequest } from "next";

// Create a new assistant
export async function GET(request: NextApiRequest) {
  const url = new URL(request.url);

  console.log("url.searchParams", url.searchParams);

  const geocodingResult = await fetch(
    `https://api.mapy.cz/v1/geocode?query=${url.searchParams.get("location")}&lang=cs&limit=5&type=regional&type=poi`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Mapy-Api-Key": "JC2adit5cZEDvOCalsrSxfQqKR5F11RrUWYT2ujxOU8",
      },
    },
  ).then((res) => res.json());

  const position = geocodingResult?.items?.[0]?.position;

  if (!position) {
    return Response.json({
      error: "Couldn't find location",
      status: 404,
    });
  }

  console.log("position", position);

  const result = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${position.lat}&lon=${position.lon}&altitude=500`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    },
  ).then((res) => res.json());

  return Response.json(result);
}
