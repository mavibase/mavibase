import { redirect } from "next/navigation"

export default async function TeamProjectPage({
  params,
}: {
  params: Promise<{ teamSlug: string; projectSlug: string }>
}) {
  const { teamSlug, projectSlug } = await params
  redirect(`/${teamSlug}/${projectSlug}/overview`)
}
