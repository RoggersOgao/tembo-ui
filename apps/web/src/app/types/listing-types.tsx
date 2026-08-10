export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    joinedDate: string;
    isHost: boolean;
  }
  
  export interface Listing {
    id: string;
    title: string;
    description: string;
    images: string[];
    price: number;
    location: {
      city: string;
      country: string;
      coordinates: {
        lat: number;
        lng: number;
      };
    };
    host: User;
    amenities: string[];
    bedrooms: number;
    bathrooms: number;
    guests: number;
    rating: number;
    reviewCount: number;
    propertyType: string;
    createdAt: string;
  }
  
  export interface Review {
    id: string;
    user: User;
    listing: Listing;
    rating: number;
    comment: string;
    createdAt: string;
  }
  
  export interface Booking {
    id: string;
    listing: Listing;
    user: User;
    checkIn: string;
    checkOut: string;
    guests: number;
    totalPrice: number;
    status: 'pending' | 'confirmed' | 'cancelled';
    createdAt: string;
  }
  
  export interface Message {
    id: string;
    sender: User;
    receiver: User;
    content: string;
    timestamp: string;
    read: boolean;
  }
  
  export interface SearchFilters {
    location: string;
    checkIn?: Date;
    checkOut?: Date;
    guests: number;
    priceRange?: {
      min: number;
      max: number;
    };
    propertyType?: string;
    amenities?: string[];
  }