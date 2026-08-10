"use client"

import Image from 'next/image'
import { Button } from '@workspace/ui/components/button'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import Link from 'next/link'
import { useUserFilterUrlPagination } from '@/hooks/filters-urls/users/use-user-filter-url-pagination'
import { useUsers } from '@/hooks/user/useUser'
import { DataTable } from './new-user/tables/data-table'


function Users() {
  const {
    paginationState,
    setPaginationState,
    filters,
    setFilters,
    userQuery,
  } = useUserFilterUrlPagination(10)

  const { data, isLoading, error, refetch } = useUsers({
    ...userQuery.filters,
    sortBy: userQuery.sortBy,
    sortOrder: userQuery.sortOrder,
    page: paginationState.pageIndex + 1,
    limit: paginationState.pageSize,
  })

  console.log(data)
  if (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : 'An unexpected error occurred while fetching users.'

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center animate-in fade-in duration-500 mt-20">
        <div className="relative mb-8 group">
          <div className="absolute -inset-1 bg-linear-to-r from-gray-400/20 to-gray-400/5 rounded-full blur transition duration-1000 group-hover:duration-200" />
          <Image
            src="/server.svg"
            alt="Server connection error"
            width={280}
            height={280}
            className="relative grayscale opacity-80"
          />
        </div>

        <div className="max-w-md space-y-2 mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
            Connection Interrupted
          </h2>
          <p className="text-sm font-mono bg-destructive/10 text-destructive py-1 px-2 rounded inline-block">
            Error: {errorMessage}
          </p>
          <p className="text-muted-foreground text-xs">
            Error loading users. This might be a temporary network glitch or a server-side hiccup.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => refetch()}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg transition-all hover:ring-2 hover:ring-primary/20 active:scale-95"
          >
            <RefreshCcw className="w-4 h-4" />
            Try Again
          </Button>

          <Button
            variant="secondary"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
            asChild
          >
            <Link href="/dashboard" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="space-y-6 px-4 lg:px-6">
            <div className="animate-fade-in-up mt-10">
              <h1 className="text-3xl font-bold text-foreground mb-2">Users</h1>
              <p className="text-muted-foreground text-sm w-[90%] lg:w-[70%]">
                Manage all registered users — view account details, monitor verification
                and activity status, control access permissions, and update user information.
                Lock, suspend, or remove accounts to keep your platform secure and well-maintained.
              </p>
            </div>

            <DataTable
              data={data?.users ?? []}
              pagination={data?.pagination ?? null}
              paginationState={paginationState}
              setPaginationState={setPaginationState}
              filters={filters}
              setFilters={setFilters}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Users