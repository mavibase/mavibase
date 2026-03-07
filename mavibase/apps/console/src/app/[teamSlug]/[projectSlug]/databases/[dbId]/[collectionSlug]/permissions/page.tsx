import { PermissionsContent } from "@/components/collection-permissions"
import { DocumentPermissionsContent } from "@/components/document-permissions"

export default function PermissionsPage() {
  return (
    <div className="flex flex-col">
      <PermissionsContent />
      <DocumentPermissionsContent />
    </div>
  )
}
