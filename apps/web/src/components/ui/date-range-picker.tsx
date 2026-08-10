"use client";
import { useState } from "react";
import { DateRange, DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

type DateRangePickerCompProps = {
  mode?: "range";
  selected?: DateRange | undefined;
  onSelect?: (range: DateRange | undefined) => void;
  numberOfMonths?: number;
};

export function DateRangePickerComp({
  selected,
  onSelect,
  numberOfMonths = 1,
}: DateRangePickerCompProps) {
  return (
    <DayPicker
      mode="range"
      selected={selected}
      onSelect={onSelect}
      numberOfMonths={numberOfMonths}
    />
  );
}