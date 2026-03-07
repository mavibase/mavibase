"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { getDbName, getCollectionsForDb } from "@/components/dashboard-sidebar"

export function CollectionBreadcrumb({ page }: { page: string }) {
  const params = useParams()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string
  const collectionSlug = params.collectionSlug as string

  const dbName = getDbName(dbId)
  const collections = getCollectionsForDb(dbId)
  const currentCollection = collections.find((c) => c.slug === collectionSlug)
  const collectionName = currentCollection?.name || collectionSlug

  const basePath = `/${teamSlug}/${projectSlug}`

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={`${basePath}/databases`}>Databases</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={`${basePath}/databases/${dbId}/${collectionSlug}/documents`}>
              {dbName}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={`${basePath}/databases/${dbId}/${collectionSlug}/documents`}>
              {collectionName}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{page}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
