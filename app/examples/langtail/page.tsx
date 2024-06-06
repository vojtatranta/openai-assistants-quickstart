"use client";

import React, { useEffect, useState } from "react";
import styles from "./page.module.css";
import Chat, { ChatMessage } from "../../components/chat";
import WeatherWidget, { SkyCondition } from "../../components/weather-widget";
import { getWeather } from "../../utils/weather";
import zod from "zod";

const WeatherSchema = zod.object({
  properties: zod.object({
    meta: zod.object({
      units: zod.object({
        air_temperature: zod.string(),
      }),
    }),
    timeseries: zod.array(
      zod.object({
        data: zod.object({
          instant: zod.object({
            details: zod.object({
              air_temperature: zod.number(),
            }),
          }),
          next_1_hours: zod
            .object({
              summary: zod.object({
                symbol_code: zod.string(),
              }),
            })
            .optional(),
        }),
      }),
    ),
  }),
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
  if (maybeSkyState.includes("cloud")) {
    return "Cloudy";
  }

  if (maybeSkyState.includes("rain")) {
    return "Rainy";
  }

  if (maybeSkyState.includes("snow")) {
    return "Snowy";
  }

  if (maybeSkyState.includes("wind")) {
    return "Windy";
  }

  if (maybeSkyState.includes("fair")) {
    return "Sunny";
  }

  if (maybeSkyState.includes("sunny")) {
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
      .then((weather) => ({
        role: "tool" as const,
        name: latestToolCall.function.name,
        tool_call_id: latestToolCall.id,
        content:
          normalizeYrWeatherData(weather, (data) => {
            const temperature =
              data.properties.timeseries[0].data.instant.details
                .air_temperature;
            const unit = data.properties.meta.units.air_temperature;

            setWeatherData({
              temperature,
              location: location.location,
              unit: unit.substring(0, 1).toUpperCase(),
              conditions:
                decodeSkyState(
                  data.properties.timeseries[0].data.next_1_hours?.summary
                    .symbol_code ?? "",
                ) || "Sunny",
            });

            return `${temperature} ${unit}`;
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
