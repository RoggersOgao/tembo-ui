import { Booking, Listing, Message, Review, User } from "@/app/types/listing-types";


export const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    joinedDate: '2020-01-15',
    isHost: true,
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    joinedDate: '2021-03-20',
    isHost: false,
  },
];

export const mockListings: Listing[] = [
  // {
  //   id: '1',
  //   title: 'Modern Downtown Loft',
  //   description: 'A beautiful modern loft in the heart of the city with stunning skyline views.',
  //   images: [
  //     'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
  //     'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=600&fit=crop',
  //     'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
  //   ],
  //   price: 120,
  //   location: {
  //     city: 'New York',
  //     country: 'United States',
  //     coordinates: { lat: 40.7128, lng: -74.0060 },
  //   },
  //   host: mockUsers[0]!!,
  //   amenities: ['WiFi', 'Kitchen', 'Air conditioning', 'Workspace'],
  //   bedrooms: 2,
  //   bathrooms: 1,
  //   guests: 4,
  //   rating: 4.8,
  //   reviewCount: 24,
  //   propertyType: 'Apartment',
  //   createdAt: '2023-01-15',
  // },
  // {
  //   id: '2',
  //   title: 'Cozy Beach House',
  //   description: 'Perfect getaway by the ocean with private beach access.',
  //   images: [
  //     'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&h=600&fit=crop',
  //     'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop',
  //     'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
  //   ],
  //   price: 200,
  //   location: {
  //     city: 'Malibu',
  //     country: 'United States',
  //     coordinates: { lat: 34.0259, lng: -118.7798 },
  //   },
  //   host: mockUsers[1]!,
  //   amenities: ['WiFi', 'Beach access', 'Parking', 'Hot tub'],
  //   bedrooms: 3,
  //   bathrooms: 2,
  //   guests: 6,
  //   rating: 4.9,
  //   reviewCount: 18,
  //   propertyType: 'House',
  //   createdAt: '2023-02-10',
  // },
  // {
  //   id: '3',
  //   title: 'Modern City Apartment',
  //   description: 'Stylish downtown apartment close to restaurants and nightlife.',
  //   images: [
  //     '/landing-i4.png',
  //     'https://source.unsplash.com/800x600/?interior,modern',
  //     'https://source.unsplash.com/800x600/?urban,balcony',
  //   ],
  //   price: 145,
  //   location: {
  //     city: 'Berlin',
  //     country: 'Germany',
  //     coordinates: { lat: 52.52, lng: 13.405 },
  //   },
  //   host: mockUsers[2]!,
  //   amenities: ['WiFi', 'Elevator', 'Washer', 'Balcony'],
  //   bedrooms: 2,
  //   bathrooms: 1,
  //   guests: 4,
  //   rating: 4.7,
  //   reviewCount: 24,
  //   propertyType: 'Apartment',
  //   createdAt: '2023-04-15',
  // },
  {
    id: '4',
    title: 'Rustic Mountain Cabin',
    description: 'Escape to the mountains in this cozy log cabin with stunning views.',
    images: [
      '/landing-i3.png',
      'https://source.unsplash.com/800x600/?forest,loghouse',
      'https://source.unsplash.com/800x600/?nature,wood',
    ],
    price: 180,
    location: {
      city: 'Banff',
      country: 'Canada',
      coordinates: { lat: 51.1784, lng: -115.5708 },
    },
    host: mockUsers[3]!,
    amenities: ['Fireplace', 'Hot tub', 'Hiking trails', 'Kitchen'],
    bedrooms: 2,
    bathrooms: 1,
    guests: 5,
    rating: 4.8,
    reviewCount: 32,
    propertyType: 'Cabin',
    createdAt: '2023-06-21',
  },
  // {
  //   id: '5',
  //   title: 'Charming Countryside Villa',
  //   description: 'Peaceful villa surrounded by olive trees and vineyards.',
  //   images: [
  //     '/landing-i1.png',
  //     'https://source.unsplash.com/800x600/?italy,house',
  //     'https://source.unsplash.com/800x600/?garden,villa',
  //   ],
  //   price: 250,
  //   location: {
  //     city: 'Tuscany',
  //     country: 'Italy',
  //     coordinates: { lat: 43.7711, lng: 11.2486 },
  //   },
  //   host: mockUsers[4]!,
  //   amenities: ['Pool', 'Garden', 'WiFi', 'BBQ grill'],
  //   bedrooms: 4,
  //   bathrooms: 3,
  //   guests: 8,
  //   rating: 4.95,
  //   reviewCount: 41,
  //   propertyType: 'Villa',
  //   createdAt: '2023-05-02',
  // },
  {
    id: '6',
    title: 'Luxury Penthouse',
    description: 'Elegant penthouse featuring panoramic city views and modern interiors.',
    images: [
      '/landing-i2.png',
      'https://source.unsplash.com/800x600/?skyline,apartment',
      'https://source.unsplash.com/800x600/?luxury,interior',
    ],
    price: 350,
    location: {
      city: 'Tokyo',
      country: 'Japan',
      coordinates: { lat: 35.6762, lng: 139.6503 },
    },
    host: mockUsers[5]!,
    amenities: ['Air conditioning', 'Gym', 'Rooftop access', 'Smart TV'],
    bedrooms: 3,
    bathrooms: 2,
    guests: 6,
    rating: 4.85,
    reviewCount: 29,
    propertyType: 'Penthouse',
    createdAt: '2023-03-18',
  }
  
];

export const mockReviews: Review[] = [
  {
    id: '1',
    user: mockUsers[1]!,
    listing: mockListings[0]!,
    rating: 5,
    comment: 'Amazing place with incredible views! Host was very responsive.',
    createdAt: '2023-06-15',
  },
];

export const mockBookings: Booking[] = [
  {
    id: '1',
    listing: mockListings[0]!,
    user: mockUsers[1]!,
    checkIn: '2024-01-15',
    checkOut: '2024-01-20',
    guests: 2,
    totalPrice: 600,
    status: 'confirmed',
    createdAt: '2023-12-01',
  },
];

export const mockMessages: Message[] = [
  {
    id: '1',
    sender: mockUsers[0]!,
    receiver: mockUsers[1]!,
    content: 'Hi! Welcome to my place. Let me know if you need anything.',
    timestamp: '2024-01-14T10:00:00Z',
    read: false,
  },
];