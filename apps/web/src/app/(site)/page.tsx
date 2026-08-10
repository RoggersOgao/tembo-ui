// app/(site)/page.tsx

import Container from '@/global/container'
import { Button } from '@workspace/ui/components/button'
import {openConsentPreferences} from "@repo/analytics/react";

// Variants to prefetch — must match what's rendered below.
// SSR seeds the React Query cache so the first paint has no loading state.
const PREFETCH_VARIANTS = ['featured', 'top-rated'] as const

export default async function Home() {


  return (
    <div >
      <Container className="isolate">

       <Button>Click me!</Button>

        <section className="@container/main">
            hey
        </section>

        <button onClick={openConsentPreferences}>Manage cookie preferences</button>
      </Container>
    </div>
  )
}