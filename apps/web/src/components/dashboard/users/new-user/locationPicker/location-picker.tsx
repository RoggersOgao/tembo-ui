"use client"

import { Button } from '@workspace/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Loader2, MapPin, Navigation } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';
import './location-marker.css';

import type { Map as LeafletMap, Marker } from 'leaflet';

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  address: string;
  coordinates?: string;
  onLocationChange: (data: { latitude: number; longitude: number; address: string; coordinates?: string }) => void;
}

// Helper to generate PostGIS coordinate string
const generateCoordinates = (lng: number, lat: number): string => {
  return `SRID=4326;POINT(${lng.toFixed(8)} ${lat.toFixed(8)})`;
};

export default function LocationPicker({
  latitude: propLatitude,
  longitude: propLongitude,
  address: propAddress,
  coordinates: propCoordinates,
  onLocationChange
}: LocationPickerProps) {
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);

  // Internal state to track current values
  const [currentLat, setCurrentLat] = useState(propLatitude || 0);
  const [currentLng, setCurrentLng] = useState(propLongitude || 0);
  const [currentAddress, setCurrentAddress] = useState(propAddress || '');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const LeafletRef = useRef<typeof import('leaflet') | null>(null);
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingRef = useRef(false);

  // Create 3D marker with profile picture
  const createMarker = useCallback((L: typeof import('leaflet')) => {
    return L.divIcon({
      html: `
        <div class="marker-3d">
          <div class="marker-pulse"></div>
          <div class="marker-profile">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Property" alt="Location" />
            <div class="marker-ring"></div>
          </div>
          <div class="marker-stem"></div>
          <div class="marker-shadow"></div>
        </div>
      `,
      className: 'custom-marker-icon',
      iconSize: [60, 90],
      iconAnchor: [30, 90],
      popupAnchor: [0, -90]
    });
  }, []);

  // Update location with debounced reverse geocoding
  const updateLocation = useCallback(async (lat: number, lng: number, skipGeocode = false) => {
    // Prevent circular updates
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;

    try {
      const L = LeafletRef.current;
      const map = mapRef.current;

      // Update internal state
      setCurrentLat(lat);
      setCurrentLng(lng);

      // Update marker position immediately
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else if (map && L) {
        markerRef.current = L.marker([lat, lng], { icon: createMarker(L) }).addTo(map);
      }

      // Skip geocoding if not needed (e.g., when syncing from props)
      if (skipGeocode) {
        const coords = generateCoordinates(lng, lat);
        onLocationChange({
          latitude: lat,
          longitude: lng,
          address: currentAddress || propAddress,
          coordinates: coords
        });
        return;
      }

      // Debounced geocoding
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);

      setIsFetchingAddress(true);

      geocodeTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            {
              headers: {
                'Accept-Language': 'en',
                'User-Agent': 'PropertyManagementApp/1.0'
              }
            }
          );

          const coords = generateCoordinates(lng, lat);

          if (res.ok) {
            const data = await res.json();
            const newAddress = data.display_name;
            setCurrentAddress(newAddress);
            onLocationChange({
              latitude: lat,
              longitude: lng,
              address: newAddress,
              coordinates: coords
            });
            toast.success("Location updated");
          } else {
            onLocationChange({
              latitude: lat,
              longitude: lng,
              address: currentAddress || propAddress,
              coordinates: coords
            });
            toast.error("Failed to fetch address");
          }
        } catch (err) {
          // console.error('Geocoding error:', err);
          const coords = generateCoordinates(lng, lat);
          onLocationChange({
            latitude: lat,
            longitude: lng,
            address: currentAddress || propAddress,
            coordinates: coords
          });
          toast.error("Failed to fetch address");
        } finally {
          setIsFetchingAddress(false);
        }
      }, 500);
    } finally {
      // Reset the updating flag after a short delay
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 100);
    }
  }, [onLocationChange, createMarker, currentAddress, propAddress]);

  // Initialize map once
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const L = (await import('leaflet')).default;
        LeafletRef.current = L;

        if (!mapContainerRef.current || !mounted || mapRef.current) return;

        const initLat = propLatitude || -1.2921;
        const initLng = propLongitude || 36.8219;

        setCurrentLat(initLat);
        setCurrentLng(initLng);

        const map = L.map(mapContainerRef.current, {
          preferCanvas: true,
          zoomControl: true
        }).setView([initLat, initLng], propLatitude && propLongitude ? 15 : 13);

        map.attributionControl.setPrefix(false);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
          minZoom: 3,
          keepBuffer: 2
        }).addTo(map);

        if (propLatitude && propLongitude) {
          markerRef.current = L.marker([propLatitude, propLongitude], { icon: createMarker(L) }).addTo(map);
        }

        map.on('click', (e) => updateLocation(e.latlng.lat, e.latlng.lng));

        mapRef.current = map;
        setIsMapLoading(false);
      } catch (err) {
        console.error('Map init error:', err);
        toast.error("Failed to load map");
        setIsMapLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
      if (mapRef.current) {
        mapRef.current.off();
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Sync internal state with props
  useEffect(() => {
    if (propLatitude !== currentLat || propLongitude !== currentLng) {
      setCurrentLat(propLatitude);
      setCurrentLng(propLongitude);
    }
    if (propAddress !== currentAddress) {
      setCurrentAddress(propAddress);
    }
  }, [propLatitude, propLongitude, propAddress]);

  // Sync map when coordinates change externally (but not during our own updates)
  useEffect(() => {
    if (isUpdatingRef.current) return;

    const map = mapRef.current;
    const L = LeafletRef.current;

    if (map && L && propLatitude && propLongitude) {
      const center = map.getCenter();
      const dist = Math.sqrt(
        Math.pow(center.lat - propLatitude, 2) + Math.pow(center.lng - propLongitude, 2)
      );

      // Only update if the difference is significant
      if (dist > 0.001) {
        map.setView([propLatitude, propLongitude], 15, { animate: true });

        if (markerRef.current) {
          markerRef.current.setLatLng([propLatitude, propLongitude]);
        } else {
          markerRef.current = L.marker([propLatitude, propLongitude], { icon: createMarker(L) }).addTo(map);
        }
      }
    }
  }, [propLatitude, propLongitude, createMarker]);

  // High-accuracy GPS location
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    if (!window.isSecureContext && !isLocalhost) {
      toast.error("Geolocation requires HTTPS");
      return;
    }

    setIsFetchingAddress(true);
    const toastId = toast.loading("Getting precise location...");

    const getPosition = (highAccuracy: boolean): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 15000 : 5000,
          maximumAge: 0
        });
      });
    };

    try {
      let position: GeolocationPosition;

      try {
        position = await getPosition(true);
      } catch (err: any) {
        if (err.code === GeolocationPositionError.TIMEOUT ||
          err.code === GeolocationPositionError.POSITION_UNAVAILABLE) {
          toast.loading("Trying alternative method...", { id: toastId });
          position = await getPosition(false);
        } else {
          throw err;
        }
      }

      toast.dismiss(toastId);

      await updateLocation(position.coords.latitude, position.coords.longitude);

      if (mapRef.current) {
        mapRef.current.setView([position.coords.latitude, position.coords.longitude], 17, { animate: true });
      }

    } catch (err: any) {
      toast.dismiss(toastId);

      const messages: Record<number, { title: string; detail: string }> = {
        [GeolocationPositionError.PERMISSION_DENIED]: {
          title: "Location Permission Denied",
          detail: "Enable location access in browser settings"
        },
        [GeolocationPositionError.POSITION_UNAVAILABLE]: {
          title: "Location Unavailable",
          detail: "Your device couldn't determine location"
        },
        [GeolocationPositionError.TIMEOUT]: {
          title: "Location Request Timed Out",
          detail: "Check your connection and try again"
        }
      };

      const msg = messages[err.code] || { title: "Location Error", detail: err.message || "Unknown error" };

      toast.error(
        <div className="space-y-1">
          <div className="font-semibold">{msg.title}</div>
          <div className="text-sm opacity-90">{msg.detail}</div>
        </div>,
        { duration: 5000 }
      );

      setIsFetchingAddress(false);
    }
  };

  // Manual coordinate updates
  const handleCoordinateChange = (field: 'latitude' | 'longitude', value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      const newLat = field === 'latitude' ? num : currentLat;
      const newLng = field === 'longitude' ? num : currentLng;

      if (mapRef.current && LeafletRef.current) {
        mapRef.current.setView([newLat, newLng], 15, { animate: true });

        if (markerRef.current) {
          markerRef.current.setLatLng([newLat, newLng]);
        } else {
          markerRef.current = LeafletRef.current.marker([newLat, newLng], {
            icon: createMarker(LeafletRef.current)
          }).addTo(mapRef.current);
        }
      }

      updateLocation(newLat, newLng);
    }
  };

  // Handle address change
  const handleAddressChange = (newAddress: string) => {
    setCurrentAddress(newAddress);
    const coords = generateCoordinates(currentLng, currentLat);
    onLocationChange({
      latitude: currentLat,
      longitude: currentLng,
      address: newAddress,
      coordinates: coords
    });
  };

  return (
    <Card className="w-full shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Property Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map */}
        <div className="relative w-full h-[300px] rounded-md border overflow-hidden bg-muted/20">
          <div ref={mapContainerRef} className="absolute inset-0 z-0" />

          {(isMapLoading || isFetchingAddress) && (
            <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] flex items-center justify-center">
              <div className="bg-background  rounded-full px-4 py-2 flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {isMapLoading ? 'Loading Map...' : 'Fetching Address...'}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="absolute top-2 right-2 z-4">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shadow-md h-8 text-xs bg-background/90 hover:bg-background"
              onClick={getCurrentLocation}
              disabled={isFetchingAddress}
            >
              <Navigation className="h-3 w-3 mr-2" />
              Locate Me
            </Button>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={currentAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Full property address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude" className="text-xs text-muted-foreground">
                Latitude
              </Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={currentLat || ''}
                onChange={(e) => handleCoordinateChange('latitude', e.target.value)}
                placeholder="0.000000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude" className="text-xs text-muted-foreground">
                Longitude
              </Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={currentLng || ''}
                onChange={(e) => handleCoordinateChange('longitude', e.target.value)}
                placeholder="0.000000"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}