"use client";

import React, { useEffect, useState } from "react";
import styles from "./page.module.css";
import Chat from "../../components/chat";
import WeatherWidget from "../../components/weather-widget";
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
        }),
      }),
    ),
  }),
});

type WeatherType = zod.infer<typeof WeatherSchema>;

function normalizeYrWeatherData<T>(data, cb: (weather: WeatherType) => T): T {
  try {
    const weather = WeatherSchema.parse(data);
    return cb(weather);
  } catch (error) {
    console.warn("Couldn't parse weather data", error);
  }
}

const FunctionCalling = () => {
  const [weatherData, setWeatherData] = useState({});

  const functionCallHandler = async (call) => {
    const latestToolCall =
      call.message.tool_calls[call.message.tool_calls.length - 1];

    if (latestToolCall?.function.name !== "get_weather") {
      return;
    }

    const location = JSON.parse(latestToolCall.function.arguments ?? "");

    return fetch(
      `/api/langtail/weather?${new URLSearchParams({
        location: location,
      })}`,
      {
        method: "GET",
      },
    )
      .then((res) => res.json())
      .then((weather) => {
        console.log("weather", weather);
        const weatherMessage = normalizeYrWeatherData(weather, (data) => {
          const temperature =
            data.properties.timeseries[0].data.instant.details.air_temperature;
          const unit = data.properties.meta.units.air_temperature;
          setWeatherData({
            temperature,
            location: location.location,
            unit: unit.substring(0, 1).toUpperCase(),
          });

          return `${temperature} ${unit}`;
        });

        return {
          role: "tool",
          name: latestToolCall.function.name,
          tool_call_id: latestToolCall.id,
          content: weatherMessage,
        };
      });
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
