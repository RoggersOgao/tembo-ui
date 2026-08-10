"use client"
import { useState, useEffect } from "react";

interface MultiSegmentPriceSliderProps {
  minValue?: number;
  maxValue?: number;
  onPriceChange?: (min: number, max: number) => void;
  rangeColor?: string;
  thumbColor?: string;
  trackColor?: string;
  showTitle?: boolean;
  showMarkers?: boolean;
}

interface Segment {
  start: number;
  end: number;
  priceStart: number;
  priceEnd: number;
  step: number;
}

function formatPrice(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)} x 100M`;
  }
  if (value >= 10000000) {
    return `${(value / 10000000).toFixed(1)}x10M`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
}

function formatPriceDetailed(value: number): string {
  return `KES ${value.toLocaleString()}`;
}

const SEGMENTS: Segment[] = [
  { start: 0, end: 15, priceStart: 0, priceEnd: 5000, step: 100 },
  { start: 15, end: 35, priceStart: 5000, priceEnd: 20000, step: 500 },
  { start: 35, end: 55, priceStart: 20000, priceEnd: 100000, step: 2000 },
  { start: 55, end: 70, priceStart: 100000, priceEnd: 1000000, step: 10000 },
  { start: 70, end: 85, priceStart: 1000000, priceEnd: 10000000, step: 100000 },
  { start: 85, end: 95, priceStart: 10000000, priceEnd: 100000000, step: 1000000 },
  { start: 95, end: 100, priceStart: 100000000, priceEnd: 1000000000, step: 10000000 },
];

export default function MultiSegmentPriceSlider({
  minValue = 5000,
  maxValue = 50000,
  onPriceChange,
  rangeColor = "bg-slate-700",
  thumbColor = "border-slate-700",
  trackColor = "bg-slate-200",
  showTitle = true,
  showMarkers = true,
}: MultiSegmentPriceSliderProps) {
  const [minPrice, setMinPrice] = useState(minValue);
  const [maxPrice, setMaxPrice] = useState(maxValue);
  const [sliderValues, setSliderValues] = useState([0, 100]);

  const sliderToPrice = (sliderValue: number): number => {
    for (const segment of SEGMENTS) {
      if (sliderValue <= segment.end) {
        const segmentProgress = (sliderValue - segment.start) / (segment.end - segment.start);
        const price = segment.priceStart + segmentProgress * (segment.priceEnd - segment.priceStart);
        return Math.round(price / segment.step) * segment.step;
      }
    }
    return 1000000000;
  };

  const priceToSlider = (price: number): number => {
    for (const segment of SEGMENTS) {
      if (price <= segment.priceEnd) {
        const priceProgress = (price - segment.priceStart) / (segment.priceEnd - segment.priceStart);
        return segment.start + priceProgress * (segment.end - segment.start);
      }
    }
    return 100;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const newValue = parseFloat(e.target.value);
    const newValues: [number, number] = [sliderValues[0] ?? 0, sliderValues[1] ?? 100];
    
    if (index === 0) {
      newValues[0] = Math.min(newValue, newValues[1]);
    } else {
      newValues[1] = Math.max(newValue, newValues[0]);
    }
    
    setSliderValues(newValues);
    
    const newMin = sliderToPrice(newValues[0]);
    const newMax = sliderToPrice(newValues[1]);
    
    setMinPrice(newMin);
    setMaxPrice(newMax);
    
    if (onPriceChange) {
      onPriceChange(newMin, newMax);
    }
  };

  useEffect(() => {
    setMinPrice(minValue);
    setMaxPrice(maxValue);
    setSliderValues([priceToSlider(minValue), priceToSlider(maxValue)]);
  }, [minValue, maxValue]);

  // Calculate marker positions based on actual slider segments
  const markerPositions = [
    { label: '0', value: 0, position: 0 },
    { label: '5K', value: 5000, position: 15 },
    { label: '20K', value: 20000, position: 35 },
    { label: '100K', value: 100000, position: 55 },
    { label: '1M', value: 1000000, position: 70 },
    { label: '10M', value: 10000000, position: 85 },
    { label: '100M', value: 100000000, position: 95 },
    { label: '1B', value: 1000000000, position: 100 },
  ];

  return (
    <div className="space-y-1 mx-auto w-full">
      {showTitle && (
        <>
          <h3 className="font-bold text-base">Price Range</h3>
          <p className="text-gray-500 text-sm">
            Slide to adjust your budget from 0 to 1 Billion
          </p>
        </>
      )}

      <div className="relative pt-6 pb-2">
        {/* Custom dual range slider */}
        <div className="relative h-1">
          {/* Track background */}
          <div className={`absolute w-full h-1 rounded-full ${trackColor}`} />
          
          {/* Active range */}
          <div 
            className={`absolute h-1 rounded-full ${rangeColor}`}
            style={{
              left: `${sliderValues[0] ?? 0}%`,
              right: `${100 - (sliderValues[1] ?? 100)}%`
            }}
          />
          
          {/* Min slider */}
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={sliderValues[0] ?? 0}
            onChange={(e) => handleSliderChange(e, 0)}
            className="-top-px absolute bg-transparent [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:border-2 [&::-webkit-slider-thumb]:border-2 [&::-moz-range-thumb]:rounded-full [&::-webkit-slider-thumb]:rounded-full w-full [&::-moz-range-thumb]:w-4 [&::-webkit-slider-thumb]:w-4 h-2 [&::-moz-range-thumb]:h-3 [&::-webkit-slider-thumb]:h-3 appearance-none [&::-moz-range-thumb]:appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:cursor-pointer [&::-webkit-slider-thumb]:cursor-pointer pointer-events-none [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
            style={{ zIndex: (sliderValues[0] ?? 0) > 50 ? 5 : 3 }}
          />
          
          {/* Max slider */}
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={sliderValues[1] ?? 100}
            onChange={(e) => handleSliderChange(e, 1)}
            className="-top-px absolute bg-transparent [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:border-2 [&::-webkit-slider-thumb]:border-2 [&::-moz-range-thumb]:rounded-full [&::-webkit-slider-thumb]:rounded-full w-full [&::-moz-range-thumb]:w-4 [&::-webkit-slider-thumb]:w-4 h-2 [&::-moz-range-thumb]:h-3 [&::-webkit-slider-thumb]:h-3 appearance-none [&::-moz-range-thumb]:appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:cursor-pointer [&::-webkit-slider-thumb]:cursor-pointer pointer-events-none [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
            style={{ zIndex: 4 }}
          />
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="space-y-1 text-center">
          <p className="text-gray-500 text-xs">Minimum</p>
          <p className="font-bold text-foreground text-lg">
            {formatPrice(minPrice)}
          </p>
          <p className="text-gray-500 text-xs">
            {formatPriceDetailed(minPrice)}
          </p>
        </div>
        <div className="space-y-1 text-center">
          <p className="text-gray-500 text-xs">Maximum</p>
          <p className="font-bold text-foreground text-lg">
            {formatPrice(maxPrice)}
          </p>
          <p className="text-gray-500 text-xs">
            {formatPriceDetailed(maxPrice)}
          </p>
        </div>
      </div>

      {showMarkers && (
        <div className="relative text-gray-500 text-xs mt-3 pb-3">
          {markerPositions.map((marker, idx) => (
            <span
              key={idx}
              className="absolute -translate-x-1/2 transform"
              style={{ left: `${marker.position}%` }}
            >
              {marker.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}