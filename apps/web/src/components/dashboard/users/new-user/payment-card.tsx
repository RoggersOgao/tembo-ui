'use client';

import { Button } from '@workspace/ui/components/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@workspace/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { Banknote, CreditCard, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function PaymentCard() {
  const [method, setMethod] = useState<'mpesa' | 'stripe' | 'bank'>('mpesa');

  return (
    <div className="max-w-xl mx-auto mt-16 p-4">
      <Card className="rounded-3xl shadow-lg border bg-white">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-semibold text-gray-800">Pay Listing Fee</CardTitle>
          <p className="text-sm text-muted-foreground">Choose a payment method below</p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-gray-100 p-4 rounded-xl text-center">
            <p className="text-sm text-gray-500">Amount to Pay</p>
            <p className="text-4xl font-bold text-gray-800">KES 3,500</p>
            <p className="text-xs text-muted-foreground mt-1">30-day property listing</p>
          </div>

          <Select onValueChange={(value) => setMethod(value as 'mpesa' | 'stripe' | 'bank')} defaultValue="mpesa">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mpesa">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-green-500" />
                  M-Pesa
                </div>
              </SelectItem>
              <SelectItem value="stripe">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Stripe
                </div>
              </SelectItem>
              <SelectItem value="bank">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-gray-600" />
                  Bank Card
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {method === 'mpesa' && (
            <div className="space-y-2 mt-4">
              <p className="text-sm text-muted-foreground">
                You&apos;ll receive an M-Pesa prompt on your phone.
              </p>
              <Button className="w-full bg-green-500 text-white hover:bg-green-600" asChild>
                <Link href="/mpesa">
                  Pay with M-Pesa
                </Link>
              </Button>
            </div>
          )}

          {method === 'stripe' && (
            <div className="space-y-2 mt-4">
              <p className="text-sm text-muted-foreground">
                Pay securely via Stripe using Visa, Mastercard, or Apple Pay.
              </p>
              <Button className="w-full bg-blue-600 text-white hover:bg-blue-700">
                Continue to Stripe
              </Button>
            </div>
          )}

          {method === 'bank' && (
            <div className="space-y-2 mt-4">
              <p className="text-sm text-muted-foreground">
                Use your local or international bank card.
              </p>
              <Button className="w-full" variant="secondary">
                Pay with Bank Card
              </Button>
            </div>
          )}
        </CardContent>

        <CardFooter className="text-xs text-muted-foreground text-center justify-center mt-2">
          Secure checkout • No extra charges • Need help? <a href="/support" className="underline ml-1">Contact us</a>
        </CardFooter>
      </Card>
    </div>
  );
}
