import { redirect } from "next/navigation"

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ teamSlug: string; projectSlug: string; dbId: string; collectionSlug: string }>
}) {
  const { teamSlug, projectSlug, dbId, collectionSlug } = await params
  redirect(`/${teamSlug}/${projectSlug}/databases/${dbId}/${collectionSlug}/documents`)
}
