"use client"

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { createPortal } from "react-dom"
import {
  Plus,
  Trash2,
  Copy,
  Loader2,
  FileJson,
  Download,
  Upload,
  ArrowUpDown,
  Braces,
  FormInput,
  MoreHorizontal,
  Eye,
  History,
  Pencil,
  X,
  AlertTriangle,
  File,
  FileText,
  Sparkles,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useToast } from "@/components/custom-toast"

import { DataTablePagination } from "@/components/data-table-pagination"
import axiosInstance from "@/lib/axios-instance"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { Skeleton } from "./ui/skeleton"

/* ------------------------------------------------------------------ */
/*  Structured Object Editor with Schema Support                       */
/* ------------------------------------------------------------------ */
interface ObjectEditorProps {
  value: string
  onChange: (v: string) => void
  schema?: { key: string; type: string; required?: boolean }[]
}

function ObjectEditor({ value, onChange, schema }: ObjectEditorProps) {
  // Initialize pairs from schema if available, otherwise from value
  const [pairs, setPairs] = useState<{ key: string; value: string; expectedType?: string; isRequired?: boolean }[]>(() => {
    try {
      const obj = JSON.parse(value || "{}")
      if (schema && schema.length > 0) {
        // Pre-populate with schema fields
        return schema.map(s => ({
          key: s.key,
          value: obj[s.key] !== undefined ? (typeof obj[s.key] === "string" ? obj[s.key] : JSON.stringify(obj[s.key])) : "",
          expectedType: s.type,
          isRequired: s.required
        }))
      }
      return Object.entries(obj).map(([k, v]) => { 
        const schemaField = schema?.find(s => s.key === k)
        return {
          key: k, 
          value: typeof v === "string" ? v : JSON.stringify(v),
          expectedType: schemaField?.type,
          isRequired: schemaField?.required
        }
      })
    } catch {
      if (schema && schema.length > 0) {
        return schema.map(s => ({ key: s.key, value: "", expectedType: s.type, isRequired: s.required }))
      }
      return [{ key: "", value: "" }]
    }
  })

  const updateOutput = (newPairs: { key: string; value: string; expectedType?: string }[]) => {
    setPairs(newPairs)
    const obj: Record<string, unknown> = {}
    for (const p of newPairs) {
      if (p.key.trim()) {
        // Try to parse value as JSON, otherwise keep as string
        try {
          obj[p.key.trim()] = JSON.parse(p.value)
        } catch {
          obj[p.key.trim()] = p.value
        }
      }
    }
    onChange(JSON.stringify(obj))
  }

  const addPair = () => updateOutput([...pairs, { key: "", value: "" }])
  const removePair = (idx: number) => {
    // Don't allow removing schema-defined fields
    if (schema && pairs[idx].expectedType) return
    updateOutput(pairs.filter((_, i) => i !== idx))
  }
  const updatePair = (idx: number, field: "key" | "value", val: string) => {
    const newPairs = pairs.map((p, i) => i === idx ? { ...p, [field]: val } : p)
    updateOutput(newPairs)
  }

  return (
    <div className="space-y-2">
      {schema && schema.length > 0 && (
        <div className="text-xs text-muted-foreground bg-secondary/50 rounded px-2 py-1.5 mb-2">
          Expected schema: {schema.map(s => `${s.key}: ${s.type}${s.required ? '*' : ''}`).join(', ')}
        </div>
      )}
      {pairs.map((pair, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <Input
              placeholder="key"
              value={pair.key}
              onChange={(e) => updatePair(idx, "key", e.target.value)}
              className="bg-secondary border-border font-mono text-sm h-8 w-full"
              disabled={!!pair.expectedType} // Disable key editing for schema fields
            />
            {pair.isRequired && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-destructive text-xs font-bold">*</span>
            )}
          </div>
          <span className="text-muted-foreground">:</span>
          <div className="flex-1 relative">
            <Input
              placeholder={pair.expectedType ? `Enter ${pair.expectedType}${pair.isRequired ? ' (required)' : ''}` : "value"}
              value={pair.value}
              onChange={(e) => updatePair(idx, "value", e.target.value)}
              className={cn(
                "bg-secondary border-border font-mono text-sm h-8 w-full pr-16",
                pair.isRequired && !pair.value && "border-destructive/50"
              )}
            />
            {pair.expectedType && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">
                {pair.expectedType}
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive disabled:opacity-30"
            onClick={() => removePair(idx)}
            disabled={!!pair.expectedType}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {(!schema || schema.length === 0) && (
        <Button type="button" variant="outline" size="sm" onClick={addPair} className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" /> Add field
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        {schema && schema.length > 0 
          ? "Fill in values matching the expected types above"
          : "Values without quotes are auto-detected (strings, numbers, booleans)"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Structured Array Editor with Item Type Support                     */
/* ------------------------------------------------------------------ */
interface ArrayEditorProps {
  value: string
  onChange: (v: string) => void
  itemType?: 'string' | 'number' | 'integer' | 'float' | 'boolean' | 'object'
}

function ArrayEditor({ value, onChange, itemType }: ArrayEditorProps) {
  const [items, setItems] = useState<string[]>(() => {
    try {
      const arr = JSON.parse(value || "[]")
      return Array.isArray(arr) ? arr.map((v) => typeof v === "string" ? v : JSON.stringify(v)) : [""]
    } catch {
      return value ? value.split(",").map(s => s.trim()) : [""]
    }
  })

  const updateOutput = (newItems: string[]) => {
    setItems(newItems)
    const arr = newItems.filter(Boolean).map((item) => {
      // Try to parse as JSON (number, boolean), otherwise keep as string
      try {
        return JSON.parse(item)
      } catch {
        return item
      }
    })
    onChange(JSON.stringify(arr))
  }

  const addItem = () => updateOutput([...items, ""])
  const removeItem = (idx: number) => updateOutput(items.filter((_, i) => i !== idx))
  const updateItem = (idx: number, val: string) => {
    const newItems = items.map((item, i) => i === idx ? val : item)
    updateOutput(newItems)
  }

  const getPlaceholder = () => {
    if (!itemType) return "value"
    switch (itemType) {
      case "string": return "text value"
      case "integer": return "whole number (e.g. 42)"
      case "number":
      case "float": return "number (e.g. 3.14)"
      case "boolean": return "true or false"
      case "object": return '{"key": "value"}'
      default: return "value"
    }
  }

  return (
    <div className="space-y-2">
      {itemType && (
        <div className="text-xs text-muted-foreground bg-secondary/50 rounded px-2 py-1.5 mb-2">
          Expected item type: <span className="text-primary font-mono">{itemType}</span>
        </div>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground w-6">[{idx}]</span>
          <div className="flex-1 relative">
            <Input
              placeholder={getPlaceholder()}
              value={item}
              onChange={(e) => updateItem(idx, e.target.value)}
              className="bg-secondary border-border font-mono text-sm h-8 w-full"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => removeItem(idx)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
        <Plus className="h-3 w-3 mr-1" /> Add item
      </Button>
      <p className="text-xs text-muted-foreground">
        {itemType 
          ? `Each item must be a valid ${itemType}`
          : "Values without quotes are auto-detected (strings, numbers, booleans)"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Relationship Document Selector (custom dropdown, no Radix)         */
/* ------------------------------------------------------------------ */
interface DocItem {
  id: string
  label: string
  preview: string // Show some actual field data
}

function RelationshipSelector({
  dbId,
  relatedCollectionId,
  isMulti,
  value,
  onChange,
}: {
  dbId: string
  relatedCollectionId: string
  isMulti: boolean
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return value ? [value] : []
    }
  })

  // Close on outside click / escape
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    // Use setTimeout to avoid immediate close on the same click that opens
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClick)
      document.addEventListener("keydown", handleKey)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("click", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  // Fetch documents from related collection
  const fetchDocs = useCallback(async () => {
    if (!relatedCollectionId || !dbId) return
    setLoading(true)
    try {
      const res = await axiosInstance.db.get(
        `/v1/db/databases/${dbId}/collections/${relatedCollectionId}/documents?limit=100`
      )
      const rawDocs = res.data?.data || []
      setDocs(rawDocs.map((d: any) => {
        const id = d.$id || d.id
        // Find a good display label from common fields
        const labelField = d.name || d.title || d.label || d.email || d.username
        // Build a preview of other fields (exclude system fields)
        const previewFields: string[] = []
        for (const [key, val] of Object.entries(d)) {
          if (key.startsWith("$") || key === "id" || key === labelField) continue
          if (val !== null && val !== undefined && typeof val !== "object") {
            const strVal = String(val)
            if (strVal.length <= 30) {
              previewFields.push(`${key}: ${strVal}`)
            }
          }
          if (previewFields.length >= 3) break
        }
        return { 
          id, 
          label: labelField ? String(labelField) : id.slice(0, 12) + "...",
          preview: previewFields.length > 0 ? previewFields.join(" | ") : `ID: ${id.slice(0, 20)}...`
        }
      }))
    } catch (err) {
      console.error("Failed to fetch related docs:", err)
    } finally {
      setLoading(false)
    }
  }, [dbId, relatedCollectionId])

  useEffect(() => {
    if (open) fetchDocs()
  }, [open, fetchDocs])

  const toggleDoc = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    let newSelected: string[]
    if (isMulti) {
      newSelected = selectedIds.includes(docId)
        ? selectedIds.filter(id => id !== docId)
        : [...selectedIds, docId]
    } else {
      newSelected = selectedIds.includes(docId) ? [] : [docId]
      if (!selectedIds.includes(docId)) setOpen(false) // Only close on select, not deselect
    }
    setSelectedIds(newSelected)
    onChange(isMulti ? JSON.stringify(newSelected) : (newSelected[0] || ""))
  }

  const filteredDocs = docs.filter(d => 
    d.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.preview.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const displayValue = selectedIds.length > 0
    ? selectedIds.map(id => docs.find(d => d.id === id)?.label || id.slice(0, 8) + "...").join(", ")
    : "Select document" + (isMulti ? "s" : "")

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full h-9 px-3 rounded-md border border-border bg-secondary text-sm text-foreground hover:bg-secondary/80 transition-colors"
      >
        <span className="truncate text-left">{displayValue}</span>
        <svg className={cn("h-4 w-4 opacity-50 shrink-0 ml-2 transition-transform", open && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[320px] rounded-md border border-border bg-popover shadow-lg">
          <div className="p-2 border-b border-border">
            <Input
              placeholder="Search by name, fields, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 bg-secondary border-border"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading documents...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                {docs.length === 0 ? "No documents in this collection" : "No matching documents"}
              </div>
            ) : (
              filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0",
                    selectedIds.includes(doc.id) && "bg-accent"
                  )}
                  onClick={(e) => toggleDoc(doc.id, e)}
                >
                  <div className={cn(
                    "flex items-center justify-center h-5 w-5 rounded border shrink-0 mt-0.5",
                    selectedIds.includes(doc.id) 
                      ? "bg-primary border-primary text-primary-foreground" 
                      : "border-muted-foreground/40"
                  )}>
                    {selectedIds.includes(doc.id) && (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.label}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.preview}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          {selectedIds.length > 0 && (
            <div className="p-2 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedIds([])
                  onChange(isMulti ? "[]" : "")
                }}
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Custom Dropdown (replaces shadcn DropdownMenu)                     */
/* ------------------------------------------------------------------ */
interface CustomDropdownItem {
  label: string
  icon?: React.ReactNode
  destructive?: boolean
  separator?: boolean
  href?: string
  onClick?: () => void
}

 function CustomDropdown({
  items,
  trigger,
  }: {
  items: CustomDropdownItem[]
  trigger?: React.ReactNode
  }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Calculate position when opened
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const menuHeight = 220 // estimate
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < menuHeight ? rect.top - menuHeight + 8 : rect.bottom + 4
    const left = rect.right - 176 // w-44 = 176px, align right edge
    setPos({ top: Math.max(8, top), left: Math.max(8, left) })
  }, [open])

  useEffect(() => {
  if (!open) return
  const handleClick = (e: MouseEvent) => {
  if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
    btnRef.current && !btnRef.current.contains(e.target as Node)) {
  setOpen(false)
  }
  }
  const handleKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") setOpen(false)
  }
  document.addEventListener("mousedown", handleClick)
  document.addEventListener("keydown", handleKey)
  return () => {
  document.removeEventListener("mousedown", handleClick)
  document.removeEventListener("keydown", handleKey)
  }
  }, [open])

  return (
  <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="flex items-center justify-center size-7 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
      >
        {trigger ?? <MoreHorizontal className="size-4" />}
        <span className="sr-only">Actions</span>
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-44 rounded-md border border-border bg-popover shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {items.map((item, i) => (
            <div key={i}>
              {item.separator && <div className="my-1 h-px bg-border" />}
              {item.href ? (
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-1.5 text-sm transition-colors",
                    item.destructive
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-foreground hover:bg-secondary"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => { item.onClick?.(); setOpen(false) }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-1.5 text-sm transition-colors text-left",
                    item.destructive
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-foreground hover:bg-secondary"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
  </>
  )
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface DocumentRecord {
  $id: string
  $collection_id: string
  $database_id: string
  $created_at: string
  $updated_at: string
  $version: number
  $permissions: Record<string, unknown>
  [key: string]: unknown
}

interface ObjectProperty {
  key: string
  type: 'string' | 'number' | 'integer' | 'float' | 'boolean'
  required?: boolean
}

interface AttributeRecord {
  key: string
  type: string
  required: boolean
  array: boolean
  default?: string | null
  indexed?: boolean
  validation?: {
    properties?: ObjectProperty[]
    arrayItemType?: 'string' | 'number' | 'integer' | 'float' | 'boolean' | 'object'
    enum?: string[]
  }
  relationship?: {
    type: string
    relatedCollection: string
    twoWay?: boolean
    twoWayKey?: string
    onDelete?: string
    side?: string
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

function displayValue(val: unknown): string {
  if (val === null || val === undefined) return "-"
  if (typeof val === "object") return JSON.stringify(val)
  return String(val)
}

function getUserKeys(doc: DocumentRecord): string[] {
  return Object.keys(doc).filter((k) => !k.startsWith("$"))
}

/* ------------------------------------------------------------------ */
/*  Form field renderer for a single attribute                         */
/* ------------------------------------------------------------------ */
function AttributeFormField({
  attr,
  value,
  onChange,
  dbId,
}: {
  attr: AttributeRecord
  value: string
  onChange: (v: string) => void
  dbId?: string
}) {
  const inputBase =
    "flex w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/50 focus:ring-[3px] outline-none transition-colors"

  if (attr.type === "boolean") {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          {attr.key}
          {attr.required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputBase, "h-9")}
        >
          <option value="">Select...</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </div>
    )
  }

  if (attr.type === "integer" || attr.type === "float" || attr.type === "number") {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          {attr.key}
          {attr.required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        <Input
          type="number"
          step={attr.type === "integer" ? "1" : "any"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${attr.type}`}
          className="bg-secondary border-border font-mono"
        />
      </div>
    )
  }

  if (attr.type === "datetime") {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          {attr.key}
          {attr.required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        <Input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-secondary border-border font-mono"
        />
      </div>
    )
  }

  // Object type: structured key-value editor
  if (attr.type === "object") {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          {attr.key}
          {attr.required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        <ObjectEditor value={value} onChange={onChange} schema={attr.validation?.properties} />
      </div>
    )
  }

  // Array type: structured list editor
  if (attr.type === "array") {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          {attr.key}
          {attr.required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        <ArrayEditor value={value} onChange={onChange} itemType={attr.validation?.arrayItemType} />
      </div>
    )
  }

  // Enum type: dropdown with available options
  if (attr.type === "enum") {
    const enumValues = (attr as any).validation?.enum || (attr as any).elements || []
    if (enumValues.length > 0) {
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            {attr.key}
            {attr.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(inputBase, "h-9")}
          >
            <option value="">Select...</option>
            {enumValues.map((v: string) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      )
    }
  }

  // Relationship type: document selector
  if (attr.type === "relationship" && attr.relationship && dbId) {
    const relType = attr.relationship.type
    const isMulti = relType === "oneToMany" || relType === "manyToMany"
    
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          {attr.key}
          {attr.required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        <RelationshipSelector
          dbId={dbId}
          relatedCollectionId={attr.relationship.relatedCollection}
          isMulti={isMulti}
          value={value}
          onChange={onChange}
        />
        <p className="text-xs text-muted-foreground">
          {relType} relationship - select document{isMulti ? "s" : ""} from the related collection
        </p>
      </div>
    )
  }

  // Default: text input (string, email, url, ip, etc.)
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {attr.key}
        {attr.required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <Input
        type={attr.type === "email" ? "email" : attr.type === "url" ? "url" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${attr.type}`}
        className="bg-secondary border-border font-mono"
      />
      <p className="text-xs text-muted-foreground">
        {attr.type}{attr.array ? " (array)" : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Coerce form string value to typed value based on attribute type     */
/* ------------------------------------------------------------------ */
function coerceValue(val: string, attr: AttributeRecord): unknown {
  if (val === "" || val === undefined) return undefined
  
  // Handle relationship fields: oneToMany/manyToMany expect arrays of IDs
  if (attr.type === "relationship" && attr.relationship) {
    const relType = attr.relationship.type
    if (relType === "oneToMany" || relType === "manyToMany") {
      // Try parsing as JSON array first, then split by comma
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // Split comma-separated IDs
        return val.split(",").map((s) => s.trim()).filter(Boolean)
      }
    }
    // oneToOne / manyToOne - single ID string
    return val
  }
  
  // Handle object type: always try JSON.parse
  if (attr.type === "object") {
    try { return JSON.parse(val) } catch { return val }
  }
  
  // Handle array type: always try JSON.parse
  if (attr.type === "array") {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // Fall through to comma split
    }
    return val.split(",").map((s) => coerceSingle(s.trim(), "string"))
  }
  
  if (attr.array) {
    try {
      return JSON.parse(val)
    } catch {
      return val.split(",").map((s) => coerceSingle(s.trim(), attr.type))
    }
  }
  return coerceSingle(val, attr.type)
}

function coerceSingle(val: string, type: string): unknown {
  if (type === "integer") return parseInt(val, 10)
  if (type === "float" || type === "number") return parseFloat(val)
  if (type === "boolean") return val === "true"
  if (type === "datetime") return new Date(val).toISOString()
  if (type === "object") {
    try { return JSON.parse(val) } catch { return val }
  }
  if (type === "array") {
    try { return JSON.parse(val) } catch { return val }
  }
  // relationship, enum, string, email, url, ip - all stay as strings
  return val
}

/* ------------------------------------------------------------------ */
/*  Create Document Sheet (JSON + Form tabs)                            */
/* ------------------------------------------------------------------ */
function CreateDocumentSheet({
  open,
  onOpenChange,
  dbId,
  collectionId,
  attributes,
  onCreated,
  versioningEnabled = true,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  dbId: string
  collectionId: string
  attributes: AttributeRecord[]
  onCreated: () => void
  versioningEnabled?: boolean
}) {
  const [tab, setTab] = useState<string>("json")
  const [jsonValue, setJsonValue] = useState(
    JSON.stringify({ name: "John", email: "john@example.com" }, null, 2)
  )
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  // Reset form values when attributes change or sheet opens
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {}
      attributes.forEach((a) => {
        initial[a.key] = a.default != null ? String(a.default) : ""
      })
      setFormValues(initial)
    }
  }, [open, attributes])

  const updateField = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  const buildPayloadFromForm = (): Record<string, unknown> | null => {
    const payload: Record<string, unknown> = {}
    for (const attr of attributes) {
      const raw = formValues[attr.key] ?? ""
      if (attr.required && raw.trim() === "") {
        toast({ message: `"${attr.key}" is required`, type: "error" })
        return null
      }
      if (raw.trim() !== "") {
        const coerced = coerceValue(raw, attr)
        if (coerced !== undefined) payload[attr.key] = coerced
      }
    }
    return payload
  }

  const handleAdd = async () => {
    let parsed: Record<string, unknown>

    if (tab === "json") {
      try {
        parsed = JSON.parse(jsonValue)
      } catch {
        toast({ message: "Invalid JSON", type: "error" })
        return
      }
    } else {
      const result = buildPayloadFromForm()
      if (!result) return
      parsed = result
    }

    setCreating(true)
    try {
      await axiosInstance.db.post(
        `/v1/db/databases/${dbId}/collections/${collectionId}/documents`,
        parsed
      )
      toast({ message: "Document created successfully", type: "success" })
      onOpenChange(false)
      onCreated()
    } catch (error: any) {
      const errData = error.response?.data?.error || error.response?.data
      let msg = errData?.message || "Failed to create document"
      
      // Show field-specific details if available (more user-friendly)
      if (errData?.details?.fieldDetails) {
        const fieldMsgs: string[] = []
        for (const [field, info] of Object.entries(errData.details.fieldDetails)) {
          const details = info as any
          if (details.error === "type_mismatch") {
            fieldMsgs.push(`"${field}": expected ${details.expectedType}, got ${details.receivedType}`)
          } else if (details.error === "format_validation_failed") {
            fieldMsgs.push(`"${field}": invalid ${details.expectedFormat} format`)
          } else if (details.message) {
            fieldMsgs.push(`"${field}": ${details.message}`)
          } else if (details.error) {
            fieldMsgs.push(`"${field}": ${details.error}`)
          }
        }
        if (fieldMsgs.length > 0) msg = fieldMsgs.join("; ")
      }
      // Fall back to basic errors array
      else if (errData?.details?.errors && Array.isArray(errData.details.errors)) {
        msg = errData.details.errors.join("; ")
      }
      toast({ message: msg, type: "error" })
    } finally {
      setCreating(false)
    }
  }

  // Sync form -> JSON when switching to JSON tab
  const handleTabChange = (newTab: string) => {
    if (newTab === "json" && tab === "form") {
      const payload: Record<string, unknown> = {}
      for (const attr of attributes) {
        const raw = formValues[attr.key] ?? ""
        if (raw.trim() !== "") {
          const coerced = coerceValue(raw, attr)
          if (coerced !== undefined) payload[attr.key] = coerced
        }
      }
      if (Object.keys(payload).length > 0) {
        setJsonValue(JSON.stringify(payload, null, 2))
      }
    }
    setTab(newTab)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground">Create document</SheetTitle>
          <SheetDescription>
            Insert a new document using JSON or fill in the form from your attributes.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-6 py-4 flex-1 overflow-y-auto">
          {!versioningEnabled && (
            <div className="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
              <AlertTriangle className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Versioning is disabled. This document will be created without version tracking.
              </p>
            </div>
          )}
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList className="w-full">
              <TabsTrigger value="json" className="flex-1 gap-1.5">
                <Braces className="size-3.5" />
                JSON
              </TabsTrigger>
              <TabsTrigger
                value="form"
                className="flex-1 gap-1.5"
                disabled={attributes.length === 0}
              >
                <FormInput className="size-3.5" />
                Form
              </TabsTrigger>
            </TabsList>

            <TabsContent value="json" className="mt-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Document JSON</label>
                <textarea
                  value={jsonValue}
                  onChange={(e) => setJsonValue(e.target.value)}
                  rows={14}
                  className="flex w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/50 focus:ring-[3px] outline-none transition-colors resize-none"
                  spellCheck={false}
                />
              </div>
            </TabsContent>

            <TabsContent value="form" className="mt-3">
              {attributes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No attributes defined. Create attributes first to use the form.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {attributes.map((attr) => (
<AttributeFormField
  key={attr.key}
  attr={attr}
  value={formValues[attr.key] ?? ""}
  onChange={(v) => updateField(attr.key, v)}
  dbId={dbId}
  />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <SheetFooter className="px-6 flex-row gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Inserting...
              </>
            ) : (
              "Insert document"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/*  Bulk Import Sheet                                                  */
/* ------------------------------------------------------------------ */
function BulkImportSheet({
  open,
  onOpenChange,
  dbId,
  collectionId,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  dbId: string
  collectionId: string
  onDone: () => void
}) {
  const exampleJson = `[
  {
    "name": "Example 1",
    "email": "example1@test.com",
    "status": "active"
  },
  {
    "name": "Example 2",
    "email": "example2@test.com",
    "status": "pending"
  }
]`
  const [jsonValue, setJsonValue] = useState(exampleJson)
  const [importing, setImporting] = useState(false)
  const { toast } = useToast()

  const handleImport = async () => {
    let parsed: Record<string, unknown>[]
    try {
      parsed = JSON.parse(jsonValue)
      if (!Array.isArray(parsed)) throw new Error("Must be array")
    } catch {
      toast({ message: "Invalid JSON array", type: "error" })
      return
    }
    if (parsed.length > 100) {
      toast({ message: "Maximum 100 documents per batch", type: "error" })
      return
    }
    setImporting(true)
    try {
      await axiosInstance.db.post(
        `/v1/db/databases/${dbId}/collections/${collectionId}/documents/bulk`,
        { documents: parsed }
      )
      toast({ message: `${parsed.length} documents imported successfully`, type: "success" })
      onOpenChange(false)
      onDone()
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to bulk import"
      toast({ message: msg, type: "error" })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground">Bulk import</SheetTitle>
          <SheetDescription>
            Paste a JSON array of documents (max 100). Each document should be an object with your field values.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-6 py-4 flex-1 overflow-y-auto">
          <textarea
            value={jsonValue}
            onChange={(e) => setJsonValue(e.target.value)}
            rows={16}
            className="flex w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/50 focus:ring-[3px] outline-none transition-colors resize-none"
            spellCheck={false}
          />
        </div>
        <SheetFooter className="px-6 flex-row gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing}>
            {importing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Importing...
              </>
            ) : (
              "Import"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/*  Bulk Edit Sheet                                                     */
/* ------------------------------------------------------------------ */
function BulkEditSheet({
  open,
  onOpenChange,
  dbId,
  collectionId,
  attributes,
  selectedDocs,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  dbId: string
  collectionId: string
  attributes: AttributeRecord[]
  selectedDocs: DocumentRecord[]
  onUpdated: () => void
}) {
  const [tab, setTab] = useState<string>("form")
  const [jsonValue, setJsonValue] = useState("")
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      setFormValues({})
      setEnabledFields(new Set())
      setJsonValue(JSON.stringify({ /* fields to update */ }, null, 2))
      setTab("form")
    }
  }, [open])

  const toggleField = (key: string) => {
    setEnabledFields((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const updateField = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    let fieldsToUpdate: Record<string, unknown>

    if (tab === "json") {
      try {
        fieldsToUpdate = JSON.parse(jsonValue)
        if (typeof fieldsToUpdate !== "object" || Array.isArray(fieldsToUpdate)) {
          throw new Error("Must be an object")
        }
      } catch {
        toast({ message: "Invalid JSON object", type: "error" })
        return
      }
    } else {
      if (enabledFields.size === 0) {
        toast({ message: "Select at least one field to update", type: "warning" })
        return
      }
      fieldsToUpdate = {}
      for (const key of enabledFields) {
        const attr = attributes.find((a) => a.key === key)
        const raw = formValues[key] ?? ""
        if (attr) {
          const coerced = coerceValue(raw, attr)
          if (coerced !== undefined) fieldsToUpdate[key] = coerced
          else fieldsToUpdate[key] = raw
        } else {
          try { fieldsToUpdate[key] = JSON.parse(raw) } catch { fieldsToUpdate[key] = raw }
        }
      }
    }

    setSaving(true)
    try {
      const updates = selectedDocs.map((doc) => {
        // Merge existing data with updates
        const existingData: Record<string, unknown> = {}
        getUserKeys(doc).forEach((k) => { existingData[k] = doc[k] })
        return {
          id: doc.$id,
          data: { ...existingData, ...fieldsToUpdate },
        }
      })

      await axiosInstance.db.patch(
        `/v1/db/databases/${dbId}/collections/${collectionId}/documents/bulk`,
        { updates }
      )
      toast({
        message: `${selectedDocs.length} document${selectedDocs.length !== 1 ? "s" : ""} updated`,
        type: "success",
      })
      onOpenChange(false)
      onUpdated()
    } catch (error: any) {
      const msg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        "Failed to bulk update"
      toast({ message: msg, type: "error" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground flex items-center gap-2">
            <Pencil className="size-4 text-muted-foreground" />
            Bulk edit {selectedDocs.length} document{selectedDocs.length !== 1 ? "s" : ""}
          </SheetTitle>
          <SheetDescription>
            Select the fields you want to update. The new values will be applied to all selected documents.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-6 py-4 flex-1 overflow-y-auto">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger
                value="form"
                className="flex-1 gap-1.5"
                disabled={attributes.length === 0}
              >
                <FormInput className="size-3.5" />
                Form
              </TabsTrigger>
              <TabsTrigger value="json" className="flex-1 gap-1.5">
                <Braces className="size-3.5" />
                JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="form" className="mt-3">
              {attributes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No attributes defined. Use JSON mode to edit.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {attributes.map((attr) => {
                    const enabled = enabledFields.has(attr.key)
                    return (
                      <div key={attr.key} className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={() => toggleField(attr.key)}
                            className="rounded border-border accent-primary"
                          />
                          {attr.key}
                          <span className="text-xs text-muted-foreground font-normal">({attr.type})</span>
                        </label>
  {enabled && (
<AttributeFormField
  attr={attr}
  value={formValues[attr.key] ?? ""}
  onChange={(v) => updateField(attr.key, v)}
  dbId={dbId}
  />
  )}
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="json" className="mt-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Fields to update (JSON object)</label>
                <p className="text-xs text-muted-foreground">
                  Only include the fields you want to change. They will be merged into each document.
                </p>
                <textarea
                  value={jsonValue}
                  onChange={(e) => setJsonValue(e.target.value)}
                  rows={14}
                  className="flex w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/50 focus:ring-[3px] outline-none transition-colors resize-none"
                  spellCheck={false}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <SheetFooter className="px-6 flex-row gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Updating...
              </>
            ) : (
              `Update ${selectedDocs.length} document${selectedDocs.length !== 1 ? "s" : ""}`
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/*  View Document Sheet (raw JSON)                                     */
/* ------------------------------------------------------------------ */
function ViewDocumentSheet({
  open,
  onOpenChange,
  document: doc,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  document: DocumentRecord | null
}) {
  const jsonString = (() => {
    if (!doc) return ""
    const cleanObj: Record<string, unknown> = { $id: doc.$id }
    getUserKeys(doc).forEach((k) => { cleanObj[k] = doc[k] })
    cleanObj.$collection_id = doc.$collection_id
    cleanObj.$database_id = doc.$database_id
    cleanObj.$created_at = doc.$created_at
    cleanObj.$updated_at = doc.$updated_at
    cleanObj.$version = doc.$version
    cleanObj.$permissions = doc.$permissions
    return JSON.stringify(cleanObj, null, 2)
  })()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground flex items-center gap-2">
            <FileJson className="size-4 text-muted-foreground" />
            View document
          </SheetTitle>
          <SheetDescription>
            Raw JSON for document{" "}
            <span className="font-mono text-foreground">{doc?.$id ?? ""}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-6 py-4 flex-1 overflow-y-auto">
          <pre className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground overflow-auto max-h-[60vh] whitespace-pre">
            {jsonString}
          </pre>
        </div>

        <SheetFooter className="px-6 flex-row gap-2 justify-end border-t border-border pt-4">
          <Button
            variant="outline"
            className="border-border"
            onClick={() => {
              navigator.clipboard.writeText(jsonString)
            }}
          >
            <Copy className="size-3.5" />
            Copy JSON
          </Button>
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/*  Edit Document Sheet (JSON + Form tabs)                              */
/* ------------------------------------------------------------------ */
function EditDocumentSheet({
  open,
  onOpenChange,
  dbId,
  collectionId,
  attributes,
  document: doc,
  onUpdated,
  versioningEnabled = true,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  dbId: string
  collectionId: string
  attributes: AttributeRecord[]
  document: DocumentRecord | null
  onUpdated: () => void
  versioningEnabled?: boolean
}) {
  const [tab, setTab] = useState<string>("form")
  const [jsonValue, setJsonValue] = useState("")
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Pre-populate form + JSON when sheet opens or doc changes
  useEffect(() => {
    if (open && doc) {
      const initial: Record<string, string> = {}
      const payload: Record<string, unknown> = {}
      const userKeys = getUserKeys(doc)

      // Fill from attributes (in order) + any extra user keys
      const attrKeys = new Set(attributes.map((a) => a.key))
      attributes.forEach((a) => {
        const val = doc[a.key]
        initial[a.key] = val === null || val === undefined ? "" : typeof val === "object" ? JSON.stringify(val) : String(val)
        if (val !== undefined && val !== null) payload[a.key] = val
      })
      userKeys.forEach((k) => {
        if (!attrKeys.has(k)) {
          initial[k] = doc[k] === null || doc[k] === undefined ? "" : typeof doc[k] === "object" ? JSON.stringify(doc[k]) : String(doc[k])
          if (doc[k] !== undefined && doc[k] !== null) payload[k] = doc[k]
        }
      })

      setFormValues(initial)
      setJsonValue(JSON.stringify(payload, null, 2))
    }
  }, [open, doc, attributes])

  const updateField = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  const buildPayloadFromForm = (): Record<string, unknown> | null => {
    const payload: Record<string, unknown> = {}
    for (const attr of attributes) {
      const raw = formValues[attr.key] ?? ""
      if (attr.required && raw.trim() === "") {
        toast({ message: `"${attr.key}" is required`, type: "error" })
        return null
      }
      if (raw.trim() !== "") {
        const coerced = coerceValue(raw, attr)
        if (coerced !== undefined) payload[attr.key] = coerced
      }
    }
    // Include non-attribute user keys
    const attrKeys = new Set(attributes.map((a) => a.key))
    if (doc) {
      getUserKeys(doc).forEach((k) => {
        if (!attrKeys.has(k)) {
          const raw = formValues[k] ?? ""
          if (raw.trim() !== "") {
            try { payload[k] = JSON.parse(raw) } catch { payload[k] = raw }
          }
        }
      })
    }
    return payload
  }

  const handleSave = async () => {
    if (!doc) return
    let parsed: Record<string, unknown>

    if (tab === "json") {
      try {
        parsed = JSON.parse(jsonValue)
      } catch {
        toast({ message: "Invalid JSON", type: "error" })
        return
      }
    } else {
      const result = buildPayloadFromForm()
      if (!result) return
      parsed = result
    }

    setSaving(true)
    try {
      await axiosInstance.db.put(
        `/v1/db/databases/${dbId}/collections/${collectionId}/documents/${doc.$id}`,
        parsed
      )
      toast({ message: "Document updated successfully", type: "success" })
      onOpenChange(false)
      onUpdated()
    } catch (error: any) {
      const msg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        "Failed to update document"
      toast({ message: msg, type: "error" })
    } finally {
      setSaving(false)
    }
  }

  // Sync form -> JSON when switching to JSON tab
  const handleTabChange = (newTab: string) => {
    if (newTab === "json" && tab === "form") {
      const result = buildPayloadFromForm()
      if (result && Object.keys(result).length > 0) {
        setJsonValue(JSON.stringify(result, null, 2))
      }
    }
    setTab(newTab)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground flex items-center gap-2">
            <Pencil className="size-4 text-muted-foreground" />
            Edit document
          </SheetTitle>
          <SheetDescription>
            Update document{" "}
            <span className="font-mono text-foreground">{doc?.$id ?? ""}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-6 py-4 flex-1 overflow-y-auto">
          {!versioningEnabled && (
            <div className="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
              <AlertTriangle className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Versioning is disabled. This edit will not create a new version.
              </p>
            </div>
          )}
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList className="w-full">
              <TabsTrigger
                value="form"
                className="flex-1 gap-1.5"
                disabled={attributes.length === 0}
              >
                <FormInput className="size-3.5" />
                Form
              </TabsTrigger>
              <TabsTrigger value="json" className="flex-1 gap-1.5">
                <Braces className="size-3.5" />
                JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="form" className="mt-3">
              {attributes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No attributes defined. Use JSON mode to edit.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {attributes.map((attr) => (
<AttributeFormField
  key={attr.key}
  attr={attr}
  value={formValues[attr.key] ?? ""}
  onChange={(v) => updateField(attr.key, v)}
  dbId={dbId}
  />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="json" className="mt-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Document JSON</label>
                <textarea
                  value={jsonValue}
                  onChange={(e) => setJsonValue(e.target.value)}
                  rows={14}
                  className="flex w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/50 focus:ring-[3px] outline-none transition-colors resize-none"
                  spellCheck={false}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <SheetFooter className="px-6 flex-row gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/*  Document Permissions Sheet                                         */
/* ------------------------------------------------------------------ */
const PERM_ACTIONS = ["read", "create", "update", "delete"] as const
type PermAction = (typeof PERM_ACTIONS)[number]

const PERM_ACTION_META: Record<PermAction, { label: string; color: string }> = {
  read:   { label: "Read",   color: "text-blue-400" },
  create: { label: "Create", color: "text-emerald-400" },
  update: { label: "Update", color: "text-amber-400" },
  delete: { label: "Delete", color: "text-red-400" },
}

function DocumentPermissionsSheet({
  open,
  onOpenChange,
  dbId,
  collectionId,
  document: doc,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  dbId: string
  collectionId: string
  document: DocumentRecord | null
  onUpdated: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [permissions, setPermissions] = useState<Record<string, string[]>>({})
  const [newAction, setNewAction] = useState<PermAction>("read")
  const [newTarget, setNewTarget] = useState("")

  useEffect(() => {
    if (open && doc) {
      const perms = (doc.$permissions || {}) as Record<string, string[]>
      // Deep copy
      const copy: Record<string, string[]> = {}
      for (const key of Object.keys(perms)) {
        copy[key] = Array.isArray(perms[key]) ? [...perms[key]] : []
      }
      setPermissions(copy)
    }
  }, [open, doc])

  const handleAddRule = () => {
    const target = newTarget.trim()
    if (!target) {
      toast({ message: "Target is required", type: "error" })
      return
    }
    setPermissions((prev) => {
      const existing = prev[newAction] || []
      if (existing.includes(target)) {
        toast({ message: "Rule already exists", type: "warning" })
        return prev
      }
      return { ...prev, [newAction]: [...existing, target] }
    })
    setNewTarget("")
  }

  const handleRemoveRule = (action: string, target: string) => {
    setPermissions((prev) => {
      const existing = prev[action] || []
      const filtered = existing.filter((t) => t !== target)
      if (filtered.length === 0) {
        const copy = { ...prev }
        delete copy[action]
        return copy
      }
      return { ...prev, [action]: filtered }
    })
  }

  const handleSave = async () => {
    if (!doc) return
    setSaving(true)
    try {
      await axiosInstance.db.put(
        `/v1/db/databases/${dbId}/collections/${collectionId}/documents/${doc.$id}`,
        {
          ...Object.fromEntries(
            Object.entries(doc).filter(([k]) => !k.startsWith("$"))
          ),
          $permissions: permissions,
        }
      )
      toast({ message: "Permissions updated", type: "success" })
      onOpenChange(false)
      onUpdated()
    } catch (error: any) {
      const msg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        "Failed to update permissions"
      toast({ message: msg, type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const handleClearAll = () => {
    setPermissions({})
  }

  const totalRules = Object.values(permissions).reduce((sum, arr) => sum + arr.length, 0)

  const selectClass =
    "flex h-9 w-full rounded-md border border-border bg-secondary px-3 py-1 text-sm text-foreground font-mono focus:border-ring focus:ring-ring/50 focus:ring-[3px] outline-none transition-colors"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" />
            Document Permissions
          </SheetTitle>
          <SheetDescription>
            Manage permissions for{" "}
            <span className="font-mono text-foreground">{doc?.$id ?? ""}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-6 py-4 flex-1 overflow-y-auto">
          {/* Add new rule */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Add permission rule</label>
            <div className="flex items-center gap-2">
              <select
                value={newAction}
                onChange={(e) => setNewAction(e.target.value as PermAction)}
                className={cn(selectClass, "w-28 shrink-0")}
              >
                {PERM_ACTIONS.map((a) => (
                  <option key={a} value={a}>{PERM_ACTION_META[a].label}</option>
                ))}
              </select>
              <Input
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="any, owner, role:admin, user:id..."
                className="bg-secondary border-border font-mono flex-1"
              />
              <Button size="sm" className="h-9 shrink-0" onClick={handleAddRule}>
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Targets: <code className="text-[10px] px-1 py-0.5 rounded bg-secondary text-foreground">any</code>{" "}
              <code className="text-[10px] px-1 py-0.5 rounded bg-secondary text-foreground">owner</code>{" "}
              <code className="text-[10px] px-1 py-0.5 rounded bg-secondary text-foreground">{"role:<name>"}</code>{" "}
              <code className="text-[10px] px-1 py-0.5 rounded bg-secondary text-foreground">{"user:<id>"}</code>{" "}
              <code className="text-[10px] px-1 py-0.5 rounded bg-secondary text-foreground">{"team:<id>"}</code>
            </p>
          </div>

          {/* Current rules */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Current rules ({totalRules})
              </label>
              {totalRules > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {totalRules === 0 ? (
              <div className="rounded-lg border border-border bg-secondary/50 py-8 text-center">
                <p className="text-sm text-muted-foreground">No permission rules set.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This document will inherit collection-level permissions.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {PERM_ACTIONS.map((action) => {
                  const targets = permissions[action]
                  if (!targets || targets.length === 0) return null
                  const meta = PERM_ACTION_META[action]
                  return (
                    <div key={action} className="border-b border-border last:border-b-0">
                      <div className="flex items-center gap-2 px-3 py-2 bg-card">
                        <span className={cn("text-xs font-medium", meta.color)}>{meta.label}</span>
                        <span className="text-[10px] text-muted-foreground">({targets.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 px-3 py-2">
                        {targets.map((target) => {
                          let variant = "bg-secondary text-muted-foreground border-border"
                          if (target === "any") variant = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          else if (target === "owner") variant = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                          else if (target.startsWith("role:")) variant = "bg-primary/10 text-primary border-primary/20"
                          else if (target.startsWith("user:")) variant = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          else if (target.startsWith("team:")) variant = "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"

                          return (
                            <span
                              key={target}
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border",
                                variant
                              )}
                            >
                              {target}
                              <button
                                onClick={() => handleRemoveRule(action, target)}
                                className="ml-0.5 hover:text-destructive transition-colors"
                              >
                                <X className="size-2.5" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* JSON preview */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">JSON Preview</label>
            <pre className="rounded-md border border-border bg-secondary px-3 py-2 text-[11px] font-mono text-foreground overflow-auto max-h-32 whitespace-pre">
              {JSON.stringify({ $permissions: permissions }, null, 2)}
            </pre>
          </div>
        </div>

        <SheetFooter className="px-6 flex-row gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save permissions"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty state with no columns                                        */
/* ------------------------------------------------------------------ */
function EmptyNoAttributes({ onCreateAttribute }: { onCreateAttribute: () => void }) {
  return (

          <div className="relative w-full mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/50">
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 py-12 text-center backdrop-blur-xs">
        {/* Icon */}
        <div className="flex items-center justify-center size-10 rounded-xl border border-border bg-background">
          <FileText className="size-5" strokeWidth={1.5} />
        </div>

        {/* Copy */}
        <h3 className="mt-2 text-lg tracking-tight text-foreground text-balance">
          No documents yet
        </h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-md leading-relaxed text-pretty">
          Start by defining attributes to describe the structure of your documents.{" "}
          Not sure what to add? You can generate a preset to quickly create sample documents without setting up attributes first.
        </p>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <Button
            onClick={onCreateAttribute}
            
          >
            <Plus className="size-4" strokeWidth={2} />
            Create attribute
          </Button>
          <Button
            variant="secondary">
            <Sparkles className="size-4" strokeWidth={2} />
            Generate preset
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
          {/* Layer 1 - outermost, lightest */}
          <path
            d="M-20 140 C60 140, 100 60, 180 80 S300 140, 400 100 S520 30, 620 60"
            stroke="currentColor"
            className="text-primary/10"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M-20 135 C80 130, 120 50, 200 75 S320 145, 420 95 S540 25, 620 55"
            stroke="currentColor"
            className="text-primary/10"
            strokeWidth="1.2"
            fill="none"
          />

          {/* Layer 2 */}
          <path
            d="M-20 130 C50 120, 90 70, 170 90 S290 130, 390 85 S510 40, 620 70"
            stroke="currentColor"
            className="text-primary/15"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M-20 125 C70 110, 110 65, 190 85 S310 135, 410 80 S530 35, 620 65"
            stroke="currentColor"
            className="text-primary/15"
            strokeWidth="1.2"
            fill="none"
          />

          {/* Layer 3 */}
          <path
            d="M-20 118 C40 100, 80 80, 160 95 S280 120, 380 70 S500 50, 620 80"
            stroke="currentColor"
            className="text-primary/20"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M-20 112 C60 95, 100 75, 180 90 S300 125, 400 65 S520 45, 620 75"
            stroke="currentColor"
            className="text-primary/20"
            strokeWidth="1.2"
            fill="none"
          />

          {/* Layer 4 - inner, stronger */}
          <path
            d="M-20 105 C30 85, 70 90, 150 100 S270 110, 370 55 S490 60, 620 85"
            stroke="currentColor"
            className="text-primary/25"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M-20 100 C50 78, 90 85, 170 95 S290 115, 390 50 S510 55, 620 80"
            stroke="currentColor"
            className="text-primary/25"
            strokeWidth="1.2"
            fill="none"
          />

          {/* Layer 5 - innermost, most visible */}
          <path
            d="M-20 92 C20 70, 60 95, 140 105 S260 100, 360 42 S480 65, 620 90"
            stroke="currentColor"
            className="text-primary/30"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M-20 86 C40 65, 80 100, 160 108 S280 95, 380 38 S500 60, 620 85"
            stroke="currentColor"
            className="text-primary/30"
            strokeWidth="1.2"
            fill="none"
          />

          {/* Accent lines with slight color variation */}
          <path
            d="M-20 148 C90 150, 130 50, 210 70 S340 148, 440 108 S560 20, 620 50"
            stroke="currentColor"
            className="text-chart-1/8"
            strokeWidth="1"
            fill="none"
          />
          <path
            d="M-20 80 C10 55, 50 100, 130 110 S250 90, 350 35 S470 70, 620 95"
            stroke="currentColor"
            className="text-chart-2/8"
            strokeWidth="1"
            fill="none"
          />
        </svg>
      </div>
    </div>

  )
}

/* ------------------------------------------------------------------ */
/*  Main documents content                                             */
/* ------------------------------------------------------------------ */
export function DocumentsContent() {
  const params = useParams()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string
  const collectionSlug = params.collectionSlug as string
  const { toast } = useToast()

  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [attributes, setAttributes] = useState<AttributeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingAttrs, setLoadingAttrs] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [viewTarget, setViewTarget] = useState<DocumentRecord | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DocumentRecord | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [permsTarget, setPermsTarget] = useState<DocumentRecord | null>(null)
  const [permsOpen, setPermsOpen] = useState(false)
  const [versioningEnabled, setVersioningEnabled] = useState(true)

  // Pagination (server-side)
  const [limit, setLimit] = useState(10)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)

  // Sort
  const [sortBy, setSortBy] = useState<string>("$id")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [searchQuery, setSearchQuery] = useState("")

 const fetchAttributes = useCallback(async () => {
  setLoadingAttrs(true)
  try {
  const res = await axiosInstance.db.get(
  `/v1/db/databases/${dbId}/collections/${collectionSlug}/attributes`
  )
  const attrs = res.data?.data || []
  setAttributes(attrs)
    } catch {
      setAttributes([])
    } finally {
      setLoadingAttrs(false)
    }
  }, [dbId, collectionSlug])

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.db.get(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/documents`,
        { params: { limit, offset } }
      )
      const docs = res.data?.data || []
      setDocuments(docs)
      setTotal(res.data?.pagination?.total ?? docs.length)
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to load documents"
      toast({ message: msg, type: "error" })
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [dbId, collectionSlug, limit, offset, toast])

  // Fetch server config (versioning flag)
  useEffect(() => {
    axiosInstance.db
      .get("/v1/db/config")
      .then((res) => {
        setVersioningEnabled(res.data?.data?.versioning_enabled ?? true)
      })
      .catch(() => {
        // Default to enabled if config endpoint not available
        setVersioningEnabled(true)
      })
  }, [])

  useEffect(() => {
    fetchAttributes()
  }, [fetchAttributes])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Build columns: $id first, user-defined in middle, system dates at end
  // Column visibility uses the same ColumnDef shape as DataTableToolbar
  const hasData = documents.length > 0

  const columnDefs = [
    { key: "$id", label: "$id", visible: true },
    ...attributes.map((a) => ({ key: a.key, label: a.key, visible: hasData })),
    { key: "$version", label: "$version", visible: true },
    { key: "$createdAt", label: "$createdAt", visible: true },
    { key: "$updatedAt", label: "$updatedAt", visible: true },
  ]
  const [columns, setColumns] = useState(columnDefs)

  // Sync column defs when attributes, data, or versioning flag change
  useEffect(() => {
    setColumns((prev) => {
      const prevMap = new Map(prev.map((c) => [c.key, c.visible]))
      return [
        { key: "$id", label: "$id", visible: true }, // always visible
        ...attributes.map((a) => ({
          key: a.key,
          label: a.key,
          // When no data, force attribute columns off; when data exists, always show all columns
          visible: hasData ? true : false,
        })),
        { key: "$version", label: "$version", visible: prevMap.get("$version") ?? true },
        { key: "$createdAt", label: "$createdAt", visible: prevMap.get("$createdAt") ?? true },
        { key: "$updatedAt", label: "$updatedAt", visible: prevMap.get("$updatedAt") ?? true },
      ]
    })
  }, [attributes, versioningEnabled, hasData])

  // System column keys that are always toggleable
  const systemKeys = new Set(["$id", "$version", "$createdAt", "$updatedAt"])

  const handleColumnToggle = (key: string) => {
    if (key === "$id") return // $id cannot be hidden
    // When no data, only allow toggling system columns
    if (!hasData && !systemKeys.has(key)) return
    setColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c))
    )
  }

  const visibleCols = columns.filter((c) => c.visible)

  // Client-side search + sort
  const filteredAndSorted = (() => {
    let result = documents

    // Search: match any visible column value
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((doc) =>
        visibleCols.some((col) => {
          let val: unknown
          if (col.key === "$id") val = doc.$id
          else if (col.key === "$createdAt") val = doc.$created_at
          else if (col.key === "$updatedAt") val = doc.$updated_at
          else val = doc[col.key]
          return val !== null && val !== undefined && String(val).toLowerCase().includes(q)
        })
      )
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: unknown
      let bVal: unknown
      if (sortBy === "$id") { aVal = a.$id; bVal = b.$id }
      else if (sortBy === "$createdAt") { aVal = a.$created_at; bVal = b.$created_at }
      else if (sortBy === "$updatedAt") { aVal = a.$updated_at; bVal = b.$updated_at }
      else { aVal = a[sortBy]; bVal = b[sortBy] }

      const aStr = aVal != null ? String(aVal) : ""
      const bStr = bVal != null ? String(bVal) : ""

      // Try numeric comparison
      const aNum = Number(aStr)
      const bNum = Number(bStr)
      if (!isNaN(aNum) && !isNaN(bNum) && aStr !== "" && bStr !== "") {
        return sortDir === "asc" ? aNum - bNum : bNum - aNum
      }

      const cmp = aStr.localeCompare(bStr, undefined, { sensitivity: "base" })
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  })()

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(documents.map((d) => d.$id)))
    }
  }

  const handleSingleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await axiosInstance.db.delete(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/documents/${deleteTarget.$id}`
      )
      toast({ message: "Document deleted", type: "error" })
      setDeleteOpen(false)
      setDeleteTarget(null)
      fetchDocuments()
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to delete document"
      toast({ message: msg, type: "error" })
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    try {
      await axiosInstance.db.delete(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/documents/bulk`,
        { data: { ids: Array.from(selectedIds) } }
      )
      toast({ message: `${selectedIds.size} documents deleted`, type: "error" })
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
      fetchDocuments()
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to bulk delete"
      toast({ message: msg, type: "error" })
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleExport = () => {
    const data = documents.map((doc) => {
      const obj: Record<string, unknown> = { $id: doc.$id }
      getUserKeys(doc).forEach((k) => { obj[k] = doc[k] })
      obj.$created_at = doc.$created_at
      obj.$updated_at = doc.$updated_at
      return obj
    })
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${collectionSlug}-documents.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ message: "Exported current page", type: "success" })
  }

  const handleCopyDoc = (doc: DocumentRecord) => {
    const cleanObj: Record<string, unknown> = { $id: doc.$id }
    getUserKeys(doc).forEach((k) => { cleanObj[k] = doc[k] })
    cleanObj.$created_at = doc.$created_at
    cleanObj.$updated_at = doc.$updated_at
    navigator.clipboard.writeText(JSON.stringify(cleanObj, null, 2))
    toast({ message: "Copied to clipboard", type: "success" })
  }

  const hasNoAttributes = attributes.length === 0 && !loadingAttrs

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
            <FileText className="size-5 text-foreground stroke-[1.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg text-foreground leading-tight flex items-center gap-2">
                Documents [ {loading ? <Skeleton className="h-3 w-4"/> : `${total}`} ]
              </h1>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              View, create, and manage all documents within this collection.
            </p>
          </div>
        </div>
      </div>
      {loading && documents.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      ) : hasNoAttributes && documents.length === 0 ? (
        <EmptyNoAttributes
          onCreateAttribute={() => {
            const path = window.location.pathname.replace("/documents", "/attributes")
            window.location.href = path
          }}
        />
      ) : (
        <>
          {/* Toolbar - same pattern as databases */}
          <DataTableToolbar
            searchPlaceholder="Search documents..."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            columns={columns.map((c) => ({
              ...c,
              disabled: !hasData && !systemKeys.has(c.key),
            }))}
            onColumnToggle={handleColumnToggle}
          >
            <Button variant="outline" size="sm" className="h-8 border-border" onClick={() => setImportOpen(true)}>
              <Upload className="size-3.5" />
              Import
            </Button>
            <Button variant="outline" size="sm" className="h-8 border-border" onClick={handleExport}>
              <Download className="size-3.5" />
              Export
            </Button>
            <Button size="sm" className="h-8" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" />
              Create document
            </Button>
          </DataTableToolbar>

          {/* PostgreSQL-style grid table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-card">
                    {/* Checkbox header */}
                    <th className="w-10 min-w-10 border-b border-r border-border px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={documents.length > 0 && selectedIds.size === documents.length}
                        onChange={handleToggleAll}
                        className="size-3.5 rounded border-border accent-primary cursor-pointer"
                      />
                    </th>
                    {/* Row number header */}
                    <th className="w-10 min-w-10 border-b border-r border-border px-2 py-1.5 text-center">
                      <span className="text-[11px] text-muted-foreground">#</span>
                    </th>
                    {visibleCols.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          "border-b border-r border-border px-3 py-1.5 text-left last:border-r-0",
                          col.key === "$id" && "min-w-[200px]",
                          col.key === "$createdAt" && "min-w-[130px]",
                          col.key === "$updatedAt" && "min-w-[130px]",
                          col.key === "$version" && "min-w-[80px]",
                          !col.key.startsWith("$") && "min-w-[120px]"
                        )}
                      >
                        <button
                          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors font-mono"
                          onClick={() => {
                            if (sortBy === col.key) setSortDir(sortDir === "asc" ? "desc" : "asc")
                            else { setSortBy(col.key); setSortDir("asc") }
                          }}
                        >
                          {col.label}
                          <ArrowUpDown className="size-2.5 opacity-40" />
                        </button>
                      </th>
                    ))}
                    {/* Actions header */}
                    <th className="border-b border-border w-[72px] min-w-[72px] px-1 py-1.5" />
                  </tr>
                </thead>
                <tbody className="text-xs font-mono">
                  {filteredAndSorted.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleCols.length + 3}
                        className="text-center py-16 text-sm text-muted-foreground font-sans"
                      >
                        {searchQuery.trim() ? "No documents match your search." : "No documents yet. Create your first document."}
                      </td>
                    </tr>
                  ) : (
                    filteredAndSorted.map((doc, idx) => {
                      const rowNum = offset + idx + 1
                      const selected = selectedIds.has(doc.$id)
                      const versionHref = `/${teamSlug}/${projectSlug}/databases/${dbId}/${collectionSlug}/documents/${doc.$id}/versions`

                      return (
                        <tr
                          key={doc.$id}
                          className={cn(
                            "group border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors",
                            selected && "bg-primary/[0.04]"
                          )}
                        >
                          {/* Checkbox */}
                          <td className="w-10 min-w-10 border-r border-border px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => handleToggleSelect(doc.$id)}
                              className="size-3.5 rounded border-border accent-primary cursor-pointer"
                            />
                          </td>
                          {/* Row number */}
                          <td className="w-10 min-w-10 border-r border-border px-2 py-1.5 text-center">
                            <span className="text-[11px] text-muted-foreground tabular-nums">{rowNum}</span>
                          </td>

                          {visibleCols.map((col) => {
                            if (col.key === "$id") {
                              return (
                                <td key={col.key} className="border-r border-border px-3 py-1.5 min-w-[200px]">
                                  <div className="flex items-center gap-2">
                                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                                    <span className="text-foreground font-medium truncate max-w-[160px]" title={doc.$id}>
                                      {doc.$id}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        navigator.clipboard.writeText(doc.$id)
                                        toast({ message: "ID copied", type: "success" })
                                      }}
                                      className="shrink-0 flex items-center justify-center size-5 rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                                    >
                                      <Copy className="size-2.5" />
                                    </button>
                                  </div>
                                </td>
                              )
                            }

                            if (col.key === "$createdAt" || col.key === "$updatedAt") {
                              const raw = col.key === "$createdAt" ? doc.$created_at : doc.$updated_at
                              return (
                                <td key={col.key} className="border-r border-border last:border-r-0 px-3 py-1.5 text-muted-foreground">
                                  {formatDate(raw)}
                                </td>
                              )
                            }

                            if (col.key === "$version") {
                              return (
                                <td key={col.key} className="border-r border-border px-3 py-1.5">
                                  <Link
                                    href={versionHref}
                                    className="inline-flex items-center gap-1 text-foreground hover:text-primary transition-colors"
                                  >
                                    <History className="size-3 shrink-0" />
                                    v{doc.$version ?? 1}
                                  </Link>
                                </td>
                              )
                            }

                            // User-defined attribute columns
                            const raw = doc[col.key]
                            const isObj = raw !== null && raw !== undefined && typeof raw === "object"
                            return (
                              <td key={col.key} className="border-r border-border last:border-r-0 px-3 py-1.5">
                                {raw === null || raw === undefined ? (
                                  <span className="text-muted-foreground/40">-</span>
                                ) : isObj ? (
                                  <span className="text-primary">{displayValue(raw)}</span>
                                ) : (
                                  <span className="text-foreground">{displayValue(raw)}</span>
                                )}
                              </td>
                            )
                          })}

                          {/* Actions */}
                          <td className="px-1 py-1">
                            <CustomDropdown
                              items={[
                                {
                                  label: "View document",
                                  icon: <Eye className="size-3.5" />,
                                  onClick: () => { setViewTarget(doc); setViewOpen(true) },
                                },
                                {
                                  label: "Edit document",
                                  icon: <Pencil className="size-3.5" />,
                                  onClick: () => { setEditTarget(doc); setEditOpen(true) },
                                },
                                {
                                  label: "Permissions",
                                  icon: <Shield className="size-3.5" />,
                                  onClick: () => { setPermsTarget(doc); setPermsOpen(true) },
                                },
                                {
                                  label: "View versions",
                                  icon: <History className="size-3.5" />,
                                  href: versionHref,
                                },
                                {
                                  label: "Copy JSON",
                                  icon: <Copy className="size-3.5" />,
                                  onClick: () => handleCopyDoc(doc),
                                },
                                {
                                  label: "Delete",
                                  icon: <Trash2 className="size-3.5" />,
                                  destructive: true,
                                  separator: true,
                                  onClick: () => { setDeleteTarget(doc); setDeleteOpen(true) },
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border bg-card/50">
              <p className="text-xs text-muted-foreground">
                {filteredAndSorted.length} of {total} document{total !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

            {/* Pagination */}
            <div className="mt-3">
              <DataTablePagination
                total={total}
                limit={limit}
                offset={offset}
                noun="Documents"
                onPageChange={(newOffset) => { setOffset(newOffset); setSelectedIds(new Set()) }}
                onLimitChange={(newLimit) => { setLimit(newLimit); setOffset(0); setSelectedIds(new Set()) }}
              />
            </div>
        </>
      )}

      {/* Sheets */}
      <CreateDocumentSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        dbId={dbId}
        collectionId={collectionSlug}
        attributes={attributes}
        onCreated={fetchDocuments}
        versioningEnabled={versioningEnabled}
      />
      <BulkImportSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        dbId={dbId}
        collectionId={collectionSlug}
        onDone={fetchDocuments}
      />
      <ViewDocumentSheet
        open={viewOpen}
        onOpenChange={(v) => {
          setViewOpen(v)
          if (!v) setTimeout(() => setViewTarget(null), 300)
        }}
        document={viewTarget}
      />
      <EditDocumentSheet
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v)
          if (!v) setTimeout(() => setEditTarget(null), 300)
        }}
        dbId={dbId}
        collectionId={collectionSlug}
        attributes={attributes}
        document={editTarget}
        onUpdated={fetchDocuments}
        versioningEnabled={versioningEnabled}
      />
      <DocumentPermissionsSheet
        open={permsOpen}
        onOpenChange={(v) => {
          setPermsOpen(v)
          if (!v) setTimeout(() => setPermsTarget(null), 300)
        }}
        dbId={dbId}
        collectionId={collectionSlug}
        document={permsTarget}
        onUpdated={fetchDocuments}
      />

      {/* Delete row dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-mono font-semibold text-foreground">{deleteTarget?.$id}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-border">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleSingleDelete} disabled={deleting}>
              {deleting ? <><Loader2 className="size-4 animate-spin" /> Deleting...</> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Bulk delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} selected document{selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-border">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <><Loader2 className="size-4 animate-spin" /> Deleting...</> : `Delete ${selectedIds.size} document${selectedIds.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk edit sheet */}
      <BulkEditSheet
        open={bulkEditOpen}
        onOpenChange={(v) => {
          setBulkEditOpen(v)
        }}
        dbId={dbId}
        collectionId={collectionSlug}
        attributes={attributes}
        selectedDocs={documents.filter((d) => selectedIds.has(d.$id))}
        onUpdated={() => {
          setSelectedIds(new Set())
          fetchDocuments()
        }}
      />

      {/* Floating selection action bar */}
      <div
        className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out",
          selectedIds.size > 0
            ? "translate-y-0 opacity-100"
            : "translate-y-4 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-3 rounded-lg border border-border bg-popover px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-border" />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-border"
            onClick={() => setBulkEditOpen(true)}
          >
            <Pencil className="size-3" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="size-3" />
            Delete
          </Button>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={() => setSelectedIds(new Set())}
            className="flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Deselect all"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
