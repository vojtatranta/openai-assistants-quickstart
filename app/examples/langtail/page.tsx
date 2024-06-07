"use client";

import React, { useEffect, useState } from "react";
import styles from "./page.module.css";
import Chat, { ChatMessage } from "../../components/chat";
import WeatherWidget, { SkyCondition } from "../../components/weather-widget";
import { getWeather } from "../../utils/weather";
import zod from "zod";

const WeatherSchema = zod.object({
  main: zod.object({
    temp: zod.number(),
  }),
  weather: zod.array(zod.object({ main: zod.string() })),
});

type WeatherType = zod.infer<typeof WeatherSchema>;

function normalizeYrWeatherData<T>(
  data,
  cb: (weather: WeatherType) => T,
): T | undefined {
  console.log("raw weather data", data);
  try {
    const weather = WeatherSchema.parse(data);
    return cb(weather);
  } catch (error) {
    console.warn("Couldn't parse weather data", error);
  }
}

function decodeSkyState(maybeSkyState: string): SkyCondition | null {
  const loweredCase = maybeSkyState.toLocaleLowerCase();
  if (loweredCase.includes("cloud")) {
    return "Cloudy";
  }

  if (loweredCase.includes("rain")) {
    return "Rainy";
  }

  if (loweredCase.includes("snow")) {
    return "Snowy";
  }

  if (loweredCase.includes("wind")) {
    return "Windy";
  }

  if (loweredCase.includes("fair")) {
    return "Sunny";
  }

  if (loweredCase.includes("sun")) {
    return "Sunny";
  }

  return null;
}

const FunctionCalling = () => {
  const [weatherData, setWeatherData] = useState({});

  const functionCallHandler = async (message: ChatMessage) => {
    const latestToolCall = message.tool_calls?.[message.tool_calls.length - 1];

    if (latestToolCall?.function.name !== "get_weather") {
      return;
    }

    const location = JSON.parse(latestToolCall.function.arguments ?? "");

    return fetch(
      `/api/langtail/weather?${new URLSearchParams({
        location: location.location,
      })}`,
      {
        method: "GET",
      },
    )
      .then((res) => res.json())
      .then((weatherData) => weatherData)
      .then((weather) => ({
        role: "tool" as const,
        name: latestToolCall.function.name,
        tool_call_id: latestToolCall.id,
        content:
          normalizeYrWeatherData(weather, (data) => {
            const temperature = data.main.temp;
            const unit = "C";
            const conditions = decodeSkyState(data.weather[0]?.main) ?? "Sunny";

            setWeatherData({
              temperature,
              location: location.location,
              unit: unit.substring(0, 1).toUpperCase(),
              conditions,
            });

            return `${temperature}, ${unit}, ${conditions}`;
          }) ?? "---",
      }));
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.column}>
          <WeatherWidget {...weatherData} />
        </div>
        <div className={styles.chatContainer}>
          <div className={styles.chat}>
            <Chat functionCallHandler={functionCallHandler} />
          </div>
        </div>
      </div>
    </main>
  );
};

export default FunctionCalling;
