"use client"

import { useState, useEffect, useRef } from 'react';

interface Location {
  lng: number;
  lat: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
}

export const useUserLocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHighAccuracy, setIsHighAccuracy] = useState(true);
  
  const watchId = useRef<number | null>(null);
  const retryAttempts = useRef(0);
  const hasInitialLocation = useRef(false);
  
  const NAIROBI_DEFAULT = { lng: 36.8155, lat: -1.2841 };
  const MAX_RETRY_ATTEMPTS = 3;

  useEffect(() => {
    const handleSuccess = (position: GeolocationPosition) => {
      const { longitude, latitude, accuracy, heading, speed } = position.coords;
      
      const newLocation: Location = {
        lng: longitude,
        lat: latitude,
        accuracy: accuracy,
        heading: heading,
        speed: speed,
      };
      
      setLocation(newLocation);
      setLoading(false);
      setError(null);
      hasInitialLocation.current = true;
      retryAttempts.current = 0;
    };

    const handleError = (err: GeolocationPositionError) => {
      let errorMessage = '';
      
      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMessage = 'Location permission denied';
          break;
        case err.POSITION_UNAVAILABLE:
          errorMessage = 'Location unavailable';
          break;
        case err.TIMEOUT:
          errorMessage = 'Location request timed out';
          break;
        default:
          errorMessage = 'Unknown location error';
      }

      setError(errorMessage);

      if (isHighAccuracy && retryAttempts.current < MAX_RETRY_ATTEMPTS) {
        retryAttempts.current++;
        setIsHighAccuracy(false);
        
        if (watchId.current !== null) {
          navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
        }
        
        startWatching(false);
        return;
      }

      if (!hasInitialLocation.current) {
        setLocation(NAIROBI_DEFAULT);
      }
      
      setLoading(false);
    };

    const startWatching = (highAccuracy: boolean) => {
      const options: PositionOptions = {
        enableHighAccuracy: highAccuracy,
        timeout: highAccuracy ? 30000 : 10000,
        maximumAge: 0,
      };

      watchId.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        options
      );
    };

    // Get initial position quickly
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleSuccess(position);
        startWatching(isHighAccuracy);
      },
      (err) => {
        handleError(err);
        startWatching(isHighAccuracy);
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60000,
      }
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [isHighAccuracy]);

  return { 
    location, 
    error, 
    loading,
    isHighAccuracy,
  };
};