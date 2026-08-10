// actions/get-token.ts
'use server'
import { getAccessTokenServer } from '@/lib/auth-helpers'
export async function getToken() {
  return getAccessTokenServer()
}