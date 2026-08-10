"use client"
import React from 'react';
import { Listing } from '@/app/types/listing-types';
import { IconStairsUp } from '@tabler/icons-react';
import { Button } from '@workspace/ui/components/button';
import { motion } from 'framer-motion';
import { ArrowRight, Heart, Sofa } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { MdOutlineSquareFoot } from 'react-icons/md';
import { formatCurrency } from '@/lib/formatCurrency';

interface ListingCardProps {
  listing: Listing;
  onWishlistToggle: (id: string) => void;
  isWishlisted: boolean;
}

const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  onWishlistToggle,
  isWishlisted,
}) => {
  return (
    <motion.div className="md:max-h-51">
      <div className="flex gap-7 flex-col lg:flex-row">

        {/* Image — relative so the wishlist button is scoped to this card */}
        <div className="group flex-1 relative rounded-2xl">
          <Image
            src={listing.images[0] as string}
            alt={listing.title}
            width={600}
            height={600}
            className="w-full h-51 object-cover duration-300 rounded-xl"
          />
          <button
            onClick={(e) => {
              e.preventDefault();
              onWishlistToggle(listing.id);
            }}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
          >
            <Heart
              size={16}
              className={
                isWishlisted
                  ? 'fill-red-500 text-red-500'
                  : 'text-gray-600 hover:text-gray-900'
              }
            />
          </button>
        </div>

        {/* Details */}
        <div className="space-y-1 flex-1 flex flex-col justify-between">
          <div>
            <Link href={`/listing/${listing.id}`}>
              <h1 className="uppercase text-[22px] tracking-tighter text-neutral-800 dark:text-neutral-200">
                {listing.title}
              </h1>
            </Link>
            <div className="flex flex-wrap gap-2 mt-4">
              <p className="text-muted-foreground flex gap-1 items-center text-[13px] min-w-26">
                <Sofa size={17} /> Rooms 3
              </p>
              <p className="text-muted-foreground flex gap-1 items-center text-[13px] min-w-26">
                <IconStairsUp size={17} /> Floors 2
              </p>
              <p className="text-muted-foreground flex gap-1 items-center text-[13px] min-w-26">
                <MdOutlineSquareFoot size={19} /> 143 m<sup>2</sup>
              </p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-black dark:text-white font-semibold text-2xl">
              {formatCurrency(listing.price)}{' '}
              <span className="text-xs text-muted-foreground capitalize font-light">/ month</span>
            </p>
            <Button
              variant="default"
              size="lg"
              className="capitalize rounded-xl group mt-2 text-[13px] bg-black dark:bg-white text-white dark:text-neutral-800"
            >
              Explore this Home
              <span className="group-hover:translate-x-1 transition-transform ease-in-out">
                <ArrowRight />
              </span>
            </Button>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

export default ListingCard;