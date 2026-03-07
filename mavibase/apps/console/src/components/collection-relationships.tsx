"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useParams } from "next/navigation"
import {
  Plus,
  Trash2,
  Loader2,
  Link as LinkIcon,
  ArrowRight,
  GitBranch,
  Layers,
  Info,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize2,
  GripVertical,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetBody,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/components/custom-toast"
import { getCollectionsForDb } from "@/components/dashboard-sidebar"
import { Skeleton } from "./ui/skeleton"
import axiosInstance from "@/lib/axios-instance"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface RelationshipData {
  id: string
  sourceCollection: { id: string; name: string; key: string }
  sourceAttribute: string
  targetCollection: { id: string; name: string; key: string }
  targetAttribute?: string
  type: "oneToOne" | "oneToMany" | "manyToOne" | "manyToMany"
  onDelete: "cascade" | "setNull" | "restrict"
  twoWay: boolean
  side: "source" | "target"
  createdAt: string
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const TYPE_LABELS: Record<string, string> = {
  oneToOne: "One-to-One",
  oneToMany: "One-to-Many",
  manyToOne: "Many-to-One",
  manyToMany: "Many-to-Many",
}

const TYPE_DESCRIPTIONS: Record<string, string> = {
  oneToOne: "Each document in this collection links to exactly one document in the related collection.",
  oneToMany: "One document in this collection can link to many documents in the related collection.",
  manyToOne: "Many documents in this collection link to one document in the related collection.",
  manyToMany: "Documents in both collections can link to many documents in the other collection.",
}

const TYPE_BADGE_VARIANTS: Record<string, "blue" | "green" | "amber" | "default"> = {
  oneToOne: "blue",
  oneToMany: "green",
  manyToOne: "amber",
  manyToMany: "default",
}

const ON_DELETE_LABELS: Record<string, string> = {
  cascade: "Cascade",
  setNull: "Set Null",
  restrict: "Restrict",
}

const ON_DELETE_DESCRIPTIONS: Record<string, string> = {
  cascade: "When the referenced document is deleted, all related documents are also deleted.",
  setNull: "When the referenced document is deleted, the relationship field is set to null.",
  restrict: "Prevents deletion of the referenced document if related documents exist.",
}

/* ------------------------------------------------------------------ */
/*  Diagram: Collection Node                                           */
/* ------------------------------------------------------------------ */
function CollectionNode({
  name,
  fields,
  x,
  y,
  isCurrentCollection,
}: {
  name: string
  fields: { name: string; type: string; isRelationship?: boolean }[]
  x: number
  y: number
  isCurrentCollection?: boolean
}) {
  const headerHeight = 36
  const rowHeight = 28
  const totalHeight = headerHeight + fields.length * rowHeight
  const width = 220

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Card background */}
      <rect
        x={0}
        y={0}
        width={width}
        height={totalHeight}
        rx={8}
        className={cn(
          isCurrentCollection ? "fill-primary/5 stroke-primary/40" : "fill-card stroke-border"
        )}
        strokeWidth={1}
      />
      {/* Header */}
      <rect
        x={0}
        y={0}
        width={width}
        height={headerHeight}
        rx={8}
        className={cn(
          isCurrentCollection ? "fill-primary/10" : "fill-secondary"
        )}
      />
      {/* Header bottom corners fix */}
      <rect
        x={0}
        y={headerHeight - 8}
        width={width}
        height={8}
        className={cn(
          isCurrentCollection ? "fill-primary/10" : "fill-secondary"
        )}
      />
      {/* Header border */}
      <line
        x1={0}
        y1={headerHeight}
        x2={width}
        y2={headerHeight}
        className="stroke-border"
        strokeWidth={1}
      />
      {/* Collection name */}
      <text
        x={12}
        y={headerHeight / 2 + 1}
        dominantBaseline="central"
        className={cn(
          "text-[11px] font-semibold fill-foreground font-mono"
        )}
      >
        {'/ '}
        {name}
      </text>
      {isCurrentCollection && (
        <circle cx={width - 14} cy={headerHeight / 2} r={3} className="fill-primary" />
      )}

      {/* Fields */}
      {fields.map((field, i) => {
        const yPos = headerHeight + i * rowHeight
        return (
          <g key={field.name}>
            {i > 0 && (
              <line
                x1={0}
                y1={yPos}
                x2={width}
                y2={yPos}
                className="stroke-border/50"
                strokeWidth={0.5}
              />
            )}
            {/* Field connector dot */}
            {field.isRelationship && (
              <circle
                cx={width}
                cy={yPos + rowHeight / 2}
                r={4}
                className="fill-primary stroke-primary/40"
                strokeWidth={1}
              />
            )}
            <text
              x={12}
              y={yPos + rowHeight / 2 + 1}
              dominantBaseline="central"
              className="text-[10px] font-mono fill-foreground"
            >
              {field.name}
            </text>
            <text
              x={width - 12}
              y={yPos + rowHeight / 2 + 1}
              dominantBaseline="central"
              textAnchor="end"
              className="text-[9px] font-mono fill-muted-foreground"
            >
              {field.type}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/*  Diagram: Relationship Diagram                                      */
/* ------------------------------------------------------------------ */
function RelationshipDiagram({
  relationships,
  currentCollectionSlug,
  collections,
}: {
  relationships: RelationshipData[]
  currentCollectionSlug: string
  collections: { slug: string; name: string }[]
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Build collection nodes from relationships
  const { nodes, connections } = useMemo(() => {
    const collectionMap = new Map<string, {
      name: string
      key: string
      fields: { name: string; type: string; isRelationship?: boolean }[]
    }>()

    // Add current collection
    const currentColl = collections.find(c => c.slug === currentCollectionSlug)
    if (currentColl) {
      collectionMap.set(currentColl.slug, {
        name: currentColl.name,
        key: currentColl.slug,
        fields: [],
      })
    }

    // Build fields and connections from relationships
    const conns: { from: string; to: string; fromField: string; type: string; label: string }[] = []

    for (const rel of relationships) {
      const sourceKey = rel.sourceCollection.key
      const targetKey = rel.targetCollection.key

      if (!collectionMap.has(sourceKey)) {
        collectionMap.set(sourceKey, {
          name: rel.sourceCollection.name,
          key: sourceKey,
          fields: [],
        })
      }
      if (!collectionMap.has(targetKey)) {
        collectionMap.set(targetKey, {
          name: rel.targetCollection.name,
          key: targetKey,
          fields: [],
        })
      }

      // Add relationship field to source
      const sourceFields = collectionMap.get(sourceKey)!.fields
      if (!sourceFields.find(f => f.name === rel.sourceAttribute)) {
        sourceFields.push({
          name: rel.sourceAttribute,
          type: "rel",
          isRelationship: true,
        })
      }

      // Add reverse field if two-way
      if (rel.twoWay && rel.targetAttribute) {
        const targetFields = collectionMap.get(targetKey)!.fields
        if (!targetFields.find(f => f.name === rel.targetAttribute)) {
          targetFields.push({
            name: rel.targetAttribute!,
            type: "rel",
            isRelationship: true,
          })
        }
      }

      conns.push({
        from: sourceKey,
        to: targetKey,
        fromField: rel.sourceAttribute,
        type: rel.type,
        label: TYPE_LABELS[rel.type] || rel.type,
      })
    }

    // Ensure each collection has at least the ID field
    for (const [, coll] of collectionMap) {
      if (!coll.fields.find(f => f.name === "id")) {
        coll.fields.unshift({ name: "id", type: "uuid" })
      }
    }

    // Layout: place current collection in center, others around it
    const entries = Array.from(collectionMap.entries())
    const currentIdx = entries.findIndex(([key]) => key === currentCollectionSlug)
    const nodeWidth = 220
    const nodeSpacing = 100
    const startX = 40

    // Simple layout: current on the left, related on the right staggered
    const nodesArr: { key: string; name: string; fields: { name: string; type: string; isRelationship?: boolean }[]; x: number; y: number }[] = []

    if (currentIdx >= 0) {
      const [key, data] = entries[currentIdx]
      const rowHeight = 28
      const headerHeight = 36
      const totalHeight = headerHeight + data.fields.length * rowHeight
      nodesArr.push({
        key,
        name: data.name,
        fields: data.fields,
        x: startX,
        y: Math.max(40, 200 - totalHeight / 2),
      })
    }

    // Place other collections on the right
    const otherEntries = entries.filter(([key]) => key !== currentCollectionSlug)
    const rightX = startX + nodeWidth + nodeSpacing
    otherEntries.forEach(([key, data], i) => {
      const yOffset = i * 180
      nodesArr.push({
        key,
        name: data.name,
        fields: data.fields,
        x: rightX + (i % 2 === 1 ? nodeWidth + nodeSpacing : 0),
        y: 40 + yOffset,
      })
    })

    return { nodes: nodesArr, connections: conns }
  }, [relationships, currentCollectionSlug, collections])

  // Calculate SVG dimensions
  const svgWidth = useMemo(() => {
    if (nodes.length === 0) return 600
    return Math.max(600, ...nodes.map(n => n.x + 260)) + 40
  }, [nodes])

  const svgHeight = useMemo(() => {
    if (nodes.length === 0) return 400
    const maxY = Math.max(...nodes.map(n => {
      const rowHeight = 28
      const headerHeight = 36
      return n.y + headerHeight + n.fields.length * rowHeight
    }))
    return Math.max(400, maxY + 60)
  }, [nodes])

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.15, 2))
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.15, 0.4))
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    }
  }

  const handleMouseUp = () => setIsPanning(false)

  // Generate connection paths
  const connectionPaths = useMemo(() => {
    return connections.map((conn, idx) => {
      const fromNode = nodes.find(n => n.key === conn.from)
      const toNode = nodes.find(n => n.key === conn.to)
      if (!fromNode || !toNode) return null

      const nodeWidth = 220
      const headerHeight = 36
      const rowHeight = 28
      const fieldIdx = fromNode.fields.findIndex(f => f.name === conn.fromField)
      const fromY = fromNode.y + headerHeight + (fieldIdx >= 0 ? fieldIdx : 0) * rowHeight + rowHeight / 2
      const fromX = fromNode.x + nodeWidth
      const toY = toNode.y + headerHeight / 2
      const toX = toNode.x

      // Curved path
      const midX = (fromX + toX) / 2
      const path = `M ${fromX + 4} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`

      return (
        <g key={`conn-${idx}`}>
          <path
            d={path}
            fill="none"
            className="stroke-primary/30"
            strokeWidth={1.5}
            strokeDasharray={conn.type === "manyToMany" ? "4 4" : undefined}
          />
          {/* Target dot */}
          <circle cx={toX} cy={toY} r={4} className="fill-primary stroke-primary/40" strokeWidth={1} />
          {/* Type label on the path */}
          <text
            x={midX}
            y={(fromY + toY) / 2 - 6}
            textAnchor="middle"
            className="text-[8px] font-mono fill-muted-foreground"
          >
            {conn.label}
          </text>
        </g>
      )
    })
  }, [connections, nodes])

  if (relationships.length === 0) return null

  return (
    <div className="relative rounded-xl border border-border overflow-hidden bg-background dotted-bg">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-card/90 backdrop-blur-sm p-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleZoomIn}
              className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ZoomIn className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleZoomOut}
              className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ZoomOut className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>
        <div className="w-px h-4 bg-border" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleReset}
              className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Reset view</TooltipContent>
        </Tooltip>
      </div>

      {/* Zoom level indicator */}
      <div className="absolute bottom-3 left-3 z-10">
        <span className="text-[10px] font-mono text-muted-foreground bg-card/80 rounded px-1.5 py-0.5 border border-border">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      <div
        ref={containerRef}
        className="overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ height: Math.min(svgHeight * zoom + 40, 500) }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: "0 0",
          }}
          className="select-none"
        >
          {/* Grid pattern */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="0.5" className="fill-muted-foreground/10" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Connection lines */}
          {connectionPaths}

          {/* Collection nodes */}
          {nodes.map((node) => (
            <CollectionNode
              key={node.key}
              name={node.name}
              fields={node.fields}
              x={node.x}
              y={node.y}
              isCurrentCollection={node.key === currentCollectionSlug}
            />
          ))}
        </svg>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Create Relationship Sheet                                          */
/* ------------------------------------------------------------------ */
function CreateRelationshipSheet({
  open,
  onOpenChange,
  onCreate,
  creating,
  collections,
  currentCollectionSlug,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: (data: Record<string, unknown>) => void
  creating: boolean
  collections: { slug: string; name: string }[]
  currentCollectionSlug: string
}) {
  const [key, setKey] = useState("")
  const [relType, setRelType] = useState<string>("oneToMany")
  const [relatedCollection, setRelatedCollection] = useState("")
  const [onDelete, setOnDelete] = useState<string>("setNull")
  const [twoWay, setTwoWay] = useState(false)
  const [twoWayKey, setTwoWayKey] = useState("")

  const reset = () => {
    setKey("")
    setRelType("oneToMany")
    setRelatedCollection("")
    setOnDelete("setNull")
    setTwoWay(false)
    setTwoWayKey("")
  }

  const handleSubmit = () => {
    onCreate({
      key: key.trim(),
      type: "relationship",
      relatedCollection,
      relationshipType: relType,
      onDelete,
      twoWay,
      twoWayKey: twoWay ? twoWayKey.trim() : undefined,
    })
    reset()
  }

  const inputClass =
    "flex h-9 w-full rounded-md border border-border bg-secondary px-3 py-1 text-sm text-foreground focus:border-ring focus:ring-ring/50 focus:ring-[3px] outline-none transition-colors"

  const currentCollectionName = collections.find(c => c.slug === currentCollectionSlug)?.name || currentCollectionSlug
  const selectedRelatedName = collections.find(c => c.slug === relatedCollection)?.name

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground flex items-center gap-2">
            <GitBranch className="size-4 text-primary" />
            Create relationship
          </SheetTitle>
          <SheetDescription>
            Link <span className="font-medium text-foreground">{currentCollectionName}</span> to another collection in this database.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-5 px-6">
          {/* Relationship type selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Relationship type</label>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRelType(value)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                    relType === value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-secondary hover:bg-secondary/80 hover:border-muted-foreground/30"
                  )}
                >
                  <span className={cn("text-xs font-medium", relType === value ? "text-foreground" : "text-muted-foreground")}>
                    {label}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    {TYPE_DESCRIPTIONS[value]?.split(".")[0]}.
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Attribute key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Attribute key</label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. author, category, orders"
              className="bg-secondary border-border font-mono"
            />
            <p className="text-xs text-muted-foreground">
              This field will be added to <span className="font-mono text-foreground">{currentCollectionSlug}</span> to store the relationship reference.
            </p>
          </div>

          {/* Related collection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Related collection</label>
            <select
              value={relatedCollection}
              onChange={(e) => setRelatedCollection(e.target.value)}
              className={inputClass}
            >
              <option value="">Select a collection...</option>
              {collections
                .filter((c) => c.slug !== currentCollectionSlug)
                .map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
            </select>
            {relatedCollection && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="font-mono text-foreground">{currentCollectionName}</span>
                <ArrowRight className="size-3" />
                <span className="font-mono text-primary">{selectedRelatedName}</span>
              </div>
            )}
          </div>

          {/* On Delete action */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">On delete behavior</label>
            <div className="flex flex-col gap-1.5">
              {Object.entries(ON_DELETE_LABELS).map(([value, label]) => (
                <label
                  key={value}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all",
                    onDelete === value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-secondary hover:bg-secondary/80"
                  )}
                >
                  <input
                    type="radio"
                    name="onDelete"
                    value={value}
                    checked={onDelete === value}
                    onChange={() => setOnDelete(value)}
                    className="mt-0.5 accent-primary"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className={cn("text-xs font-medium", onDelete === value ? "text-foreground" : "text-muted-foreground")}>
                      {label}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {ON_DELETE_DESCRIPTIONS[value]}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Two-way toggle */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={twoWay}
                onClick={() => setTwoWay(!twoWay)}
                className={cn(
                  "relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                  twoWay ? "bg-primary" : "bg-secondary border border-border"
                )}
              >
                <span
                  className={cn(
                    "absolute size-3.5 rounded-full bg-background shadow transition-transform",
                    twoWay ? "translate-x-[18px]" : "translate-x-[3px]"
                  )}
                />
              </button>
              <div>
                <span className="font-medium">Two-way relationship</span>
                <p className="text-xs text-muted-foreground">
                  Creates a back-reference field in the related collection, so you can navigate the relationship from both sides.
                </p>
              </div>
            </label>

            {twoWay && (
              <div className="flex flex-col gap-1.5 ml-12">
                <label className="text-sm font-medium text-foreground">Back-reference key</label>
                <Input
                  value={twoWayKey}
                  onChange={(e) => setTwoWayKey(e.target.value)}
                  placeholder={`e.g. ${currentCollectionSlug}`}
                  className="bg-secondary border-border font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  This field will be added to <span className="font-mono text-foreground">{selectedRelatedName || "the related collection"}</span>.
                </p>
              </div>
            )}
          </div>

          {/* Tip */}
          <div className="rounded-lg border border-dashed border-border bg-background/50 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="size-3.5 text-muted-foreground" />
              <p className="font-medium text-xs text-foreground">Quick tip</p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Relationships are created as special attributes on your collection schema. Use <span className="font-mono text-foreground">?populate=fieldName</span> in your API queries to automatically resolve related documents.
            </p>
          </div>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={creating || !key.trim() || !relatedCollection || (twoWay && !twoWayKey.trim())}
          >
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="size-3.5" />
                Create
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/*  Relationship Detail Sheet                                          */
/* ------------------------------------------------------------------ */
function RelationshipDetailSheet({
  open,
  onOpenChange,
  relationship,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  relationship: RelationshipData | null
}) {
  if (!relationship) return null

  const detailRows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Type",
      value: (
        <Badge variant={TYPE_BADGE_VARIANTS[relationship.type] || "default"}>
          {TYPE_LABELS[relationship.type]}
        </Badge>
      ),
    },
    {
      label: "Source",
      value: (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-foreground text-xs">{relationship.sourceCollection.name}</span>
          <span className="text-muted-foreground text-[10px]">.{relationship.sourceAttribute}</span>
        </div>
      ),
    },
    {
      label: "Target",
      value: (
        <span className="font-mono text-primary text-xs">{relationship.targetCollection.name}</span>
      ),
    },
    {
      label: "On Delete",
      value: (
        <span className="text-xs text-foreground">{ON_DELETE_LABELS[relationship.onDelete]}</span>
      ),
    },
    {
      label: "Two-way",
      value: (
        <span className={cn("text-xs font-medium", relationship.twoWay ? "text-emerald-500" : "text-muted-foreground")}>
          {relationship.twoWay ? "Yes" : "No"}
        </span>
      ),
    },
  ]

  if (relationship.twoWay && relationship.targetAttribute) {
    detailRows.push({
      label: "Back-reference",
      value: (
        <span className="font-mono text-xs text-foreground">{relationship.targetAttribute}</span>
      ),
    })
  }

  detailRows.push({
    label: "Side",
    value: (
      <Badge variant={relationship.side === "source" ? "blue" : "amber"}>
        {relationship.side === "source" ? "Source" : "Target"}
      </Badge>
    ),
  })

  detailRows.push({
    label: "Created",
    value: (
      <span className="text-xs text-muted-foreground">
        {new Date(relationship.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
      </span>
    ),
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground flex items-center gap-2">
            <LinkIcon className="size-4 text-primary" />
            {relationship.sourceAttribute}
          </SheetTitle>
          <SheetDescription>
            {relationship.sourceCollection.name} to {relationship.targetCollection.name} relationship details.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col px-6 py-4 flex-1 overflow-y-auto">
          <div className="rounded-lg border border-border overflow-hidden">
            {detailRows.map((row, i) => (
              <div
                key={row.label}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5",
                  i !== detailRows.length - 1 && "border-b border-border"
                )}
              >
                <span className="text-xs font-medium text-muted-foreground">{row.label}</span>
                <div className="text-sm">{row.value}</div>
              </div>
            ))}
          </div>

          {/* Explanation card */}
          <div className="mt-4 rounded-lg border border-dashed border-border bg-background/50 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="size-3.5 text-muted-foreground" />
              <p className="font-medium text-xs text-foreground">About this relationship</p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {TYPE_DESCRIPTIONS[relationship.type]}
              {relationship.twoWay && (
                <> This is a two-way relationship, meaning you can query from either collection.</>
              )}
            </p>
          </div>
        </div>

        <SheetFooter className="px-6 flex-row gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/*  Relationships Content (Main Export)                                 */
/* ------------------------------------------------------------------ */
export function RelationshipsContent() {
  const params = useParams()
  const dbId = params.dbId as string
  const collectionSlug = params.collectionSlug as string
  const { toast } = useToast()

  const collections = getCollectionsForDb(dbId)
  const currentCollection = collections.find((c) => c.slug === collectionSlug)

  const [relationships, setRelationships] = useState<RelationshipData[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RelationshipData | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [detailRel, setDetailRel] = useState<RelationshipData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const fetchRelationships = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.db.get(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/relationships`
      )
      setRelationships(res.data?.data || [])
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to load relationships"
      toast({ message: msg, type: "error" })
      setRelationships([])
    } finally {
      setLoading(false)
    }
  }, [dbId, collectionSlug, toast])

  useEffect(() => {
    fetchRelationships()
  }, [fetchRelationships])

  const handleCreate = async (data: Record<string, unknown>) => {
    if (!data.key || !(data.key as string).trim()) {
      toast({ message: "Attribute key is required", type: "error" })
      return
    }
    if (!data.relatedCollection) {
      toast({ message: "Related collection is required", type: "error" })
      return
    }
    setCreating(true)
    try {
      await axiosInstance.db.post(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/attributes`,
        data
      )
      toast({ message: `Relationship "${data.key}" created`, type: "success" })
      fetchRelationships()
      setAddOpen(false)
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to create relationship"
      toast({ message: msg, type: "error" })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await axiosInstance.db.delete(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/attributes/${deleteTarget.sourceAttribute}`
      )
      toast({ message: `Relationship "${deleteTarget.sourceAttribute}" deleted`, type: "error" })
      fetchRelationships()
      setDeleteOpen(false)
      setDeleteTarget(null)
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to delete relationship"
      toast({ message: msg, type: "error" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header - matching attributes/documents style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
            <GitBranch className="size-5 text-foreground stroke-[1.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg text-foreground leading-tight flex items-center gap-2">
                Relationships [ {loading ? <Skeleton className="h-3 w-4" /> : `${relationships.length}`} ]
              </h1>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Define how <span className="font-medium text-foreground">{currentCollection?.name || collectionSlug}</span> is linked to other collections.
            </p>
          </div>
        </div>
        {!loading && relationships.length > 0 && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            Create relationship
          </Button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      ) : relationships.length === 0 ? (
        /* Empty state */
        <div className="relative w-full mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/50">
          <div className="relative z-10 flex flex-col items-center px-6 py-12 text-center backdrop-blur-xs">
            <div className="flex items-center justify-center size-10 rounded-xl border border-border bg-background">
              <GitBranch className="size-5" strokeWidth={1.5} />
            </div>
            <h3 className="mt-2 text-lg tracking-tight text-foreground text-balance">
              No relationships yet
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md leading-relaxed text-pretty">
              Create relationships to link this collection with others and enable powerful cross-collection queries.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4" strokeWidth={2} />
                Create relationship
              </Button>
            </div>
          </div>

          {/* Decorative wave lines */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
            <svg
              viewBox="0 0 600 160"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto"
              preserveAspectRatio="none"
            >
              <path d="M-20 140 C60 140, 100 60, 180 80 S300 140, 400 100 S520 30, 620 60" stroke="currentColor" className="text-primary/10" strokeWidth="1.5" fill="none" />
              <path d="M-20 135 C80 130, 120 50, 200 75 S320 145, 420 95 S540 25, 620 55" stroke="currentColor" className="text-primary/10" strokeWidth="1.2" fill="none" />
              <path d="M-20 130 C50 120, 90 70, 170 90 S290 130, 390 85 S510 40, 620 70" stroke="currentColor" className="text-primary/15" strokeWidth="1.5" fill="none" />
              <path d="M-20 125 C70 110, 110 65, 190 85 S310 135, 410 80 S530 35, 620 65" stroke="currentColor" className="text-primary/15" strokeWidth="1.2" fill="none" />
              <path d="M-20 118 C40 100, 80 80, 160 95 S280 120, 380 70 S500 50, 620 80" stroke="currentColor" className="text-primary/20" strokeWidth="1.5" fill="none" />
              <path d="M-20 112 C60 95, 100 75, 180 90 S300 125, 400 65 S520 45, 620 75" stroke="currentColor" className="text-primary/20" strokeWidth="1.2" fill="none" />
              <path d="M-20 105 C30 85, 70 90, 150 100 S270 110, 370 55 S490 60, 620 85" stroke="currentColor" className="text-primary/25" strokeWidth="1.5" fill="none" />
              <path d="M-20 92 C20 70, 60 95, 140 105 S260 100, 360 42 S480 65, 620 90" stroke="currentColor" className="text-primary/30" strokeWidth="1.5" fill="none" />
              <path d="M-20 148 C90 150, 130 50, 210 70 S340 148, 440 108 S560 20, 620 50" stroke="currentColor" className="text-chart-1/8" strokeWidth="1" fill="none" />
              <path d="M-20 80 C10 55, 50 100, 130 110 S250 90, 350 35 S470 70, 620 95" stroke="currentColor" className="text-chart-2/8" strokeWidth="1" fill="none" />
            </svg>
          </div>
        </div>
      ) : (
        <>
          {/* Diagram view */}
          <RelationshipDiagram
            relationships={relationships}
            currentCollectionSlug={collectionSlug}
            collections={collections.map(c => ({ slug: c.slug, name: c.name }))}
          />

          {/* Relationships table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-card">
                    <th className="w-10 min-w-10 border-b border-r border-border px-2 py-1.5 text-center">
                      <span className="text-[11px] text-muted-foreground">#</span>
                    </th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[140px]">
                      <span className="text-xs font-medium text-muted-foreground font-mono">Attribute</span>
                    </th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[110px]">
                      <span className="text-xs font-medium text-muted-foreground font-mono">Type</span>
                    </th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[200px]">
                      <span className="text-xs font-medium text-muted-foreground font-mono">Direction</span>
                    </th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[90px]">
                      <span className="text-xs font-medium text-muted-foreground font-mono">On Delete</span>
                    </th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[70px]">
                      <span className="text-xs font-medium text-muted-foreground font-mono">Two-way</span>
                    </th>
                    <th className="border-b border-border w-[72px] min-w-[72px] px-1 py-1.5" />
                  </tr>
                </thead>
                <tbody className="text-xs font-mono">
                  {relationships.map((rel, idx) => (
                    <tr
                      key={rel.id}
                      className="group border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors cursor-pointer"
                      onClick={() => { setDetailRel(rel); setDetailOpen(true) }}
                    >
                      <td className="w-10 min-w-10 border-r border-border px-2 py-1.5 text-center">
                        <span className="text-[11px] text-muted-foreground tabular-nums">{idx + 1}</span>
                      </td>
                      <td className="border-r border-border px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="size-3.5 text-primary shrink-0" />
                          <span className="text-foreground font-medium">{rel.sourceAttribute}</span>
                        </div>
                      </td>
                      <td className="border-r border-border px-3 py-1.5">
                        <Badge variant={TYPE_BADGE_VARIANTS[rel.type] || "default"} className="text-[10px]">
                          {TYPE_LABELS[rel.type]}
                        </Badge>
                      </td>
                      <td className="border-r border-border px-3 py-1.5">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-foreground font-medium">{rel.sourceCollection.name}</span>
                          <ArrowRight className="size-3 text-muted-foreground" />
                          <span className="text-primary font-medium">{rel.targetCollection.name}</span>
                        </div>
                      </td>
                      <td className="border-r border-border px-3 py-1.5">
                        <span className="text-foreground">{ON_DELETE_LABELS[rel.onDelete]}</span>
                      </td>
                      <td className="border-r border-border px-3 py-1.5">
                        <span className={cn(
                          "text-xs font-medium",
                          rel.twoWay ? "text-emerald-500" : "text-muted-foreground"
                        )}>
                          {rel.twoWay ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTarget(rel)
                              setDeleteOpen(true)
                            }}
                            className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete relationship"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-border bg-card/50">
              <p className="text-xs text-muted-foreground">
                {relationships.length} relationship{relationships.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Tips section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-lg border border-dashed border-border bg-background/50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="size-3.5 text-muted-foreground" />
                <p className="font-medium text-xs text-foreground">Populating relationships</p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Add <span className="font-mono text-foreground">?populate=fieldName</span> to your GET requests to resolve referenced documents inline.
              </p>
            </div>
            <div className="rounded-lg border border-dashed border-border bg-background/50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="size-3.5 text-muted-foreground" />
                <p className="font-medium text-xs text-foreground">Cascade deletes</p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Use cascade delete carefully. When a parent document is removed, all linked child documents will be permanently deleted.
              </p>
            </div>
            <div className="rounded-lg border border-dashed border-border bg-background/50 p-3 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="size-3.5 text-muted-foreground" />
                <p className="font-medium text-xs text-foreground">Two-way relationships</p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Enabling two-way creates a back-reference field in the target collection, making it easy to query from either side.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Create Relationship Sheet */}
      <CreateRelationshipSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreate={handleCreate}
        creating={creating}
        collections={collections.map(c => ({ slug: c.slug, name: c.name }))}
        currentCollectionSlug={collectionSlug}
      />

      {/* Relationship Detail Sheet */}
      <RelationshipDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        relationship={detailRel}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete relationship</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the relationship{" "}
              <span className="font-mono font-semibold text-foreground">{deleteTarget?.sourceAttribute}</span>
              {deleteTarget?.twoWay && (
                <> and its back-reference <span className="font-mono font-semibold text-foreground">{deleteTarget.targetAttribute}</span></>
              )}
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-border">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
