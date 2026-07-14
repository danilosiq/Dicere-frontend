"use client";

import { useEffect, useState } from "react";

const LOCALE = "pt-BR";
const UPDATE_INTERVAL_MS = 60_000;

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const weekDayFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
});

const dayFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
});

export type LocalDateTime = {
  time: string;
  weekDay: string;
  day: string;
  month: string;
  formattedDateTime: string;
};

const EMPTY_LOCAL_DATE_TIME: LocalDateTime = {
  time: "",
  weekDay: "",
  day: "",
  month: "",
  formattedDateTime: "",
};

function removeAbbreviationPeriod(value: string) {
  return value.replaceAll(".", "");
}

export function formatLocalDateTime(date: Date): LocalDateTime {
  const time = timeFormatter.format(date);
  const weekDay = removeAbbreviationPeriod(weekDayFormatter.format(date));
  const day = dayFormatter.format(date);
  const month = removeAbbreviationPeriod(monthFormatter.format(date));

  return {
    time,
    weekDay,
    day,
    month,
    formattedDateTime: `${time} • ${weekDay} - ${day} de ${month}`,
  };
}

export function useLocalDateTime(): LocalDateTime {
  const [localDateTime, setLocalDateTime] = useState(EMPTY_LOCAL_DATE_TIME);

  useEffect(() => {
    function updateLocalDateTime() {
      setLocalDateTime(formatLocalDateTime(new Date()));
    }

    updateLocalDateTime();

    const intervalId = window.setInterval(
      updateLocalDateTime,
      UPDATE_INTERVAL_MS,
    );

    return () => window.clearInterval(intervalId);
  }, []);

  return localDateTime;
}
