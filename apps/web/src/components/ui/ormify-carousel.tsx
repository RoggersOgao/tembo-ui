'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CarouselImage {
  id: number;
  src: string;
  alt: string;
  description?: string;
  aspectRatio?: 'landscape' | 'portrait' | 'square';
}

const images: CarouselImage[] = [
  {
    id: 1,
    src: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1920&q=80',
    alt: 'Modern luxury villa with panoramic mountain views at sunset',
    description: 'Premium villa with floor-to-ceiling windows',
    aspectRatio: 'landscape'
  },
  {
    id: 2,
    src: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1920&q=80',
    alt: 'Minimalist Scandinavian living room with natural light',
    description: 'Designed living space with organic materials',
    aspectRatio: 'landscape'
  },
  {
    id: 3,
    src: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1920&q=80',
    alt: 'Luxury bedroom suite with panoramic windows overlooking forest',
    description: 'Master bedroom with private terrace access',
    aspectRatio: 'landscape'
  },
  {
    id: 4,
    src: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1920&q=80',
    alt: 'Modern kitchen with marble countertops and premium appliances',
    description: 'Chef\'s kitchen with integrated dining',
    aspectRatio: 'landscape'
  },
  {
    id: 5,
    src: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1920&q=80',
    alt: 'Infinity edge swimming pool overlooking ocean horizon',
    description: 'Private pool with sunset viewing deck',
    aspectRatio: 'landscape'
  },
  {
    id: 6,
    src: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1920&q=80',
    alt: 'Spacious walk-in closet with custom cabinetry',
    description: 'Designed wardrobe and dressing area',
    aspectRatio: 'portrait'
  },
  {
    id: 7,
    src: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1920&q=80',
    alt: 'Modern bathroom with freestanding tub and rainforest shower',
    description: 'Spa-inspired master bathroom',
    aspectRatio: 'landscape'
  },
  {
    id: 8,
    src: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1920&q=80',
    alt: 'Home office with ergonomic setup and garden views',
    description: 'Productive workspace with natural light',
    aspectRatio: 'landscape'
  }
];


interface carouselProps {
  className?: string
}

export default function Inspiration({ className }: carouselProps) {

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);

  const handlePrevious = () => {
    setCurrentSlide((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    if ('touches' in e) {
      setDragStartX(e.touches[0]!.clientX);
    } else {
      setDragStartX(e.clientX);
    }
  };

  const handleDragEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    let dragEndX: number;

    if ('changedTouches' in e) {
      dragEndX = e.changedTouches[0]!.clientX;
    } else {
      dragEndX = e.clientX;
    }

    const dragDistance = dragStartX - dragEndX;
    const minSwipeDistance = 50;

    if (dragDistance > minSwipeDistance) {
      handleNext();
    } else if (dragDistance < -minSwipeDistance) {
      handlePrevious();
    }
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
  };
  return (
    <div className="space-y-8">
      <div className="relative">
        <div
          className={cn("relative", className)}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={() => setIsDragging(false)}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div>
            {images.map((image, index) => (
              <div
                key={image.id}
                className={`absolute inset-0 transition-opacity duration-500 ${index === currentSlide ? 'opacity-100' : 'opacity-0'
                  }`}
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  width={800}
                  height={600}
                  className="w-full h-full object-cover"
                  sizes="100vw"
                  priority={index === 0}
                />

                {/* Multiple layers for richer warm effect */}
                <div className="absolute inset-0 bg-amber-700-500/20 mix-blend-multiply pointer-events-none"></div>
                <div className="absolute inset-0 bg-amber-700/10 mix-blend-overlay pointer-events-none"></div>
                <div className="absolute inset-0 bg-linear-to-br from-yellow-500/5 to-orange-500/10 mix-blend-soft-light pointer-events-none"></div>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="absolute inset-0 flex justify-between items-center p-4">
            <button
              onClick={handlePrevious}
              className="flex justify-center items-center  shadow-lg rounded-full w-10 h-10 transition-colors"
            >
              <ChevronLeft className=" text-white hover:text-white/60 transition-colors" size={30} />
            </button>
            <button
              onClick={handleNext}
              className="flex justify-center items-center shadow-lg rounded-full w-10 h-10 transition-colors"
            >
              <ChevronRight className=" text-white hover:text-white/60 transition-colors" size={30} />
            </button>
          </div>

        </div>
        {/* Dots */}
        <div className="bottom-6 left-1/2 absolute flex items-center gap-2 -translate-x-1/2 transition-all ease-in duration-175">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-colors ${index === currentSlide ? 'bg-white w-3 h-3 flex items-center ' : 'bg-neutral-400'
                }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}