"use client";

import React, { useEffect, useState } from "react";
import styles from "./page.module.css";
import Chat from "../../components/chat";
import WeatherWidget from "../../components/weather-widget";
import { getWeather } from "../../utils/weather";
import zod from "zod";

const WeatherSchema = zod.object({
  result: zod.object({
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
  }),
});

type WeatherType = zod.infer<typeof WeatherSchema>;

function normalizeYrWeatherData(
  data,
  cb: (weather: WeatherType) => void,
): void {
  try {
    const weather = WeatherSchema.parse(data);
    cb(weather);
  } catch (error) {
    console.warn("Couldn't parse weather data", error);
  }
}

const FunctionCalling = () => {
  const [weatherData, setWeatherData] = useState({});

  useEffect(() => {
    const resp = fetch(
      `/api/langtail?${new URLSearchParams({
        location: "Prague, Czech Republic",
        prompt: "weather",
      })}`,
      {
        method: "GET",
      },
    )
      .then((res) => res.json())
      .then((res) => {
        console.log("res client", res);
        return fetch(
          `/api/langtail/weather?${new URLSearchParams({
            location: "Prague, Czech Republic",
          })}`,
          {
            method: "GET",
          },
        );
      })
      .then((res) => res.json())
      .then((weather) => {
        console.log("weather", weather);
        normalizeYrWeatherData(weather, (data) => {
          const temperature =
            data.result.properties.timeseries[0].data.instant.details
              .air_temperature;
          setWeatherData({
            temperature,
            unit: data.result.properties.meta.units.air_temperature
              .substring(0, 1)
              .toUpperCase(),
          });
        });
      });
  }, []);

  const functionCallHandler = async (call) => {
    if (call?.function?.name !== "get_weather") return;
    const args = JSON.parse(call.function.arguments);
    const data = getWeather(args.location);
    setWeatherData(data);
    return JSON.stringify(data);
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
