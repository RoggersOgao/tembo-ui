export interface Building {
    id: string;
    name: string;
    type: string;
    address: string;
    latitude: number;
    longitude: number;
    height: number;
    width: number;
    floors: number;
    yearBuilt: number;
    description: string;
    features?: string[];
    owner?: string;
    contact?: string;
  }
  