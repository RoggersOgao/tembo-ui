// Fixed hooks/use-navigation-tracking.ts
// Handles fallback location and GPS issues gracefully

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

interface NavigationState {
  isTracking: boolean;
  currentLocation: Location | null;
  distanceRemaining: number | null;
  estimatedTimeRemaining: number | null;
  hasArrived: boolean;
}

interface UseNavigationTrackingOptions {
  destination: { lat: number; lng: number } | null;
  onLocationUpdate?: (location: Location) => void;
  onArrival?: () => void;
  arrivalThreshold?: number;
  updateInterval?: number;
}

export const useNavigationTracking = ({
  destination,
  onLocationUpdate,
  onArrival,
  arrivalThreshold = 20,
  updateInterval = 3000,
}: UseNavigationTrackingOptions) => {
  const [state, setState] = useState<NavigationState>({
    isTracking: false,
    currentLocation: null,
    distanceRemaining: null,
    estimatedTimeRemaining: null,
    hasArrived: false,
  });

  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const hasArrivedRef = useRef(false);
  const isTrackingRef = useRef(false);
  const destinationRef = useRef(destination);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  const calculateDistance = useCallback((
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }, []);

  const stopTracking = useCallback(() => {
    console.log('Stopping tracking, watchId:', watchIdRef.current);
    
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    isTrackingRef.current = false;
    hasArrivedRef.current = false;
    retryCountRef.current = 0;

    setState((prev) => ({
      ...prev,
      isTracking: false,
    }));
  }, []);

  const startWatchPosition = useCallback(() => {
    const currentDestination = destinationRef.current;
    
    if (!currentDestination || !isTrackingRef.current) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!isTrackingRef.current) {
          console.log('Not tracking anymore, ignoring position update');
          return;
        }

        const now = Date.now();
        
        if (now - lastUpdateRef.current < updateInterval) {
          return;
        }
        lastUpdateRef.current = now;

        const location: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading ?? undefined,
          speed: position.coords.speed ?? undefined,
        };

        const dest = destinationRef.current;
        if (!dest) {
          console.log('No destination, stopping');
          return;
        }

        const distance = calculateDistance(
          location.lat,
          location.lng,
          dest.lat,
          dest.lng
        );

        console.log('Navigation update - Distance:', distance.toFixed(2), 'm');

        let eta: number | null = null;
        if (location.speed && location.speed > 0.5) {
          eta = distance / location.speed;
        } else {
          eta = distance / 1.4;
        }

        const arrived = distance <= arrivalThreshold;

        setState((prev) => ({
          ...prev,
          currentLocation: location,
          distanceRemaining: distance,
          estimatedTimeRemaining: eta,
          hasArrived: arrived,
        }));

        onLocationUpdate?.(location);

        if (arrived && !hasArrivedRef.current) {
          hasArrivedRef.current = true;
          console.log('Arrived at destination!');
          toast.success('You have arrived at your destination!');
          onArrival?.();
          
          setTimeout(() => {
            if (isTrackingRef.current) {
              stopTracking();
            }
          }, 5000);
        }
      },
      (error) => {
        console.log('Watch position error:', error.code, error.message);
        
        if (!isTrackingRef.current) {
          return;
        }

        // Try to continue with lower accuracy if high accuracy fails
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          console.log(`Retrying with lower accuracy (attempt ${retryCountRef.current}/${MAX_RETRIES})`);
          
          // Don't show error on retries, just keep trying
          return;
        }

        let errorMessage = 'Unable to track location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'GPS signal lost. Please move to an area with better coverage.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timeout';
            break;
        }
        
        toast.error(errorMessage);
        stopTracking();
      },
      {
        enableHighAccuracy: retryCountRef.current < 2, // Try high accuracy first
        timeout: 20000,
        maximumAge: 0,
      }
    );

    console.log('Started watching position, watchId:', watchIdRef.current);
  }, [calculateDistance, arrivalThreshold, onLocationUpdate, onArrival, updateInterval, stopTracking]);

  const startTracking = useCallback(() => {
    const currentDestination = destinationRef.current;
    
    if (!currentDestination) {
      toast.error('No destination set');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser');
      return;
    }

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Reset refs
    hasArrivedRef.current = false;
    isTrackingRef.current = true;
    lastUpdateRef.current = 0;
    retryCountRef.current = 0;

    setState((prev) => ({ 
      ...prev, 
      isTracking: true, 
      hasArrived: false 
    }));

    console.log('Starting navigation tracking to:', currentDestination);
    
    // Show loading toast
    const loadingToast = toast.loading('Acquiring GPS signal...');

    // Try to get high accuracy position first with longer timeout
    navigator.geolocation.getCurrentPosition(
      (initialPosition) => {
        toast.dismiss(loadingToast);
        console.log('GPS signal acquired:', initialPosition.coords);
        
        // Check if we actually have a good GPS fix
        if (initialPosition.coords.accuracy > 100) {
          toast.info('GPS accuracy is low, but starting navigation...');
        } else {
          toast.success('Navigation started - Follow the blue line!');
        }
        
        // Update initial location
        const location: Location = {
          lat: initialPosition.coords.latitude,
          lng: initialPosition.coords.longitude,
          accuracy: initialPosition.coords.accuracy,
          heading: initialPosition.coords.heading ?? undefined,
          speed: initialPosition.coords.speed ?? undefined,
        };
        
        setState((prev) => ({
          ...prev,
          currentLocation: location,
        }));
        
        onLocationUpdate?.(location);
        
        // Now start continuous watching
        startWatchPosition();
      },
      (error) => {
        toast.dismiss(loadingToast);
        console.log('Failed to get initial GPS position:', error.code, error.message);
        
        // If permission denied, stop immediately
        if (error.code === error.PERMISSION_DENIED) {
          isTrackingRef.current = false;
          setState((prev) => ({ ...prev, isTracking: false }));
          toast.error('Location permission denied. Please enable location access in your browser settings.');
          return;
        }
        
        // For other errors, try to start with lower accuracy
        if (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT) {
          toast.info('GPS signal weak, trying with lower accuracy...');
          retryCountRef.current = 1; // Skip to lower accuracy mode
          startWatchPosition();
          return;
        }
        
        // Unknown error
        isTrackingRef.current = false;
        setState((prev) => ({ ...prev, isTracking: false }));
        toast.error('Unable to start navigation. Please check your location settings.');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // Give more time for initial fix
        maximumAge: 0,
      }
    );
  }, [startWatchPosition, onLocationUpdate, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('Navigation hook unmounting, cleaning up');
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      isTrackingRef.current = false;
    };
  }, []);

  return {
    ...state,
    startTracking,
    stopTracking,
  };
};