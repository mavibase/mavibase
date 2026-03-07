"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Plus,
  Trash2,
  Loader2,
  Hash,
  Type,
  ToggleLeft,
  Calendar,
  List as ListIcon,
  Mail,
  Link as LinkIcon,
  Braces,
  Wifi,
  ArrowUpDown,
  Eye,
  X,
  Layers,
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
import { useToast } from "@/components/custom-toast"

import { DataTableToolbar } from "@/components/data-table-toolbar"
import axiosInstance from "@/lib/axios-instance"
import { Skeleton } from "./ui/skeleton"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface ObjectProperty {
  key: string
  type: 'string' | 'number' | 'integer' | 'float' | 'boolean'
  required?: boolean
}

interface Attribute {
  key: string
  name?: string
  type: string
  required: boolean
  array: boolean
  default?: unknown
  indexed?: boolean
  unique?: boolean
  size?: number
  min?: unknown
  max?: unknown
  validation?: {
    properties?: ObjectProperty[]
    arrayItemType?: 'string' | 'number' | 'integer' | 'float' | 'boolean' | 'object'
    enum?: string[]
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    minItems?: number
    maxItems?: number
    pattern?: string
  }
  relationship?: unknown
}

/* ------------------------------------------------------------------ */
/*  Safe value display — handles objects, arrays, primitives            */
/* ------------------------------------------------------------------ */
function safeDisplay(val: unknown): string {
  if (val === null || val === undefined || val === "") return ""
  if (typeof val === "object") return JSON.stringify(val)
  return String(val)
}

/* ------------------------------------------------------------------ */
/*  Type config: icons, labels, and which validations apply            */
/* ------------------------------------------------------------------ */
const TYPE_CONFIG: Record<
  string,
  {
    icon: React.ElementType
    label: string
    color: string
    hasSize?: boolean
    hasMinMax?: boolean
    hasEnum?: boolean
    hasObjectFields?: boolean
    hasArrayItems?: boolean
  }
> = {
  string: { icon: Type, label: "String", color: "text-blue-400", hasSize: true },
  integer: { icon: Hash, label: "Integer", color: "text-emerald-400", hasMinMax: true },
  float: { icon: Hash, label: "Float", color: "text-emerald-400", hasMinMax: true },
  boolean: { icon: ToggleLeft, label: "Boolean", color: "text-amber-400" },
  datetime: { icon: Calendar, label: "Datetime", color: "text-purple-400" },
  email: { icon: Mail, label: "Email", color: "text-pink-400", hasSize: true },
  url: { icon: LinkIcon, label: "URL", color: "text-cyan-400", hasSize: true },
  ip: { icon: Wifi, label: "IP", color: "text-orange-400" },
  enum: { icon: ListIcon, label: "Enum", color: "text-yellow-400", hasEnum: true },
  object: { icon: Braces, label: "Object", color: "text-slate-400", hasObjectFields: true },
  array: { icon: ListIcon, label: "Array", color: "text-indigo-400", hasArrayItems: true },
}

const VALID_TYPES = Object.keys(TYPE_CONFIG)

/* ------------------------------------------------------------------ */
/*  Boolean indicator icons (Bootstrap Icons)                           */
/* ------------------------------------------------------------------ */
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className={className}>
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
    </svg>
  )
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className={className}>
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293z"/>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Boolean display: table (icon only) and sheet (icon + label)        */
/* ------------------------------------------------------------------ */
function BooleanCell({ value }: { value: boolean }) {
  return value ? (
    <CheckCircleIcon className="size-4 text-emerald-500" />
  ) : (
    <XCircleIcon className="size-4 text-red-500/60" />
  )
}

function BooleanLabel({ value }: { value: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {value ? (
        <>
          <CheckCircleIcon className="size-4 text-emerald-500" />
          <span className="text-emerald-500 font-medium">Yes</span>
        </>
      ) : (
        <>
          <XCircleIcon className="size-4 text-red-500/60" />
          <span className="text-muted-foreground">No</span>
        </>
      )}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Attribute Detail Sheet                                              */
/* ------------------------------------------------------------------ */
function AttributeDetailSheet({
  open,
  onOpenChange,
  attribute,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  attribute: Attribute | null
}) {
  if (!attribute) return null

  const cfg = TYPE_CONFIG[attribute.type]
  const Icon = cfg?.icon || Type

  const detailRows: { label: string; value: React.ReactNode }[] = [
    { label: "Key", value: <span className="font-mono text-foreground">{attribute.key}</span> },
    {
      label: "Type",
      value: (
        <span className="inline-flex items-center gap-1.5">
          <Icon className={cn("size-3.5", cfg?.color || "text-muted-foreground")} />
          <span className="text-foreground">{cfg?.label || attribute.type}</span>
        </span>
      ),
    },
  ]

  // Only show Required row for non-object types (objects have per-property required)
  if (attribute.type !== "object") {
    detailRows.push({ label: "Required", value: <BooleanLabel value={attribute.required} /> })
  }

  detailRows.push(
    { label: "Array", value: <BooleanLabel value={attribute.array} /> },
    { label: "Indexed", value: <BooleanLabel value={attribute.indexed ?? false} /> },
    { label: "Unique", value: <BooleanLabel value={attribute.unique ?? false} /> }
  )

  // Default
  const defaultStr = safeDisplay(attribute.default)
  detailRows.push({
    label: "Default",
    value: defaultStr ? (
      <span className="font-mono bg-secondary rounded px-2 py-0.5 text-foreground">{defaultStr}</span>
    ) : (
      <span className="text-muted-foreground">None</span>
    ),
  })

  // Size (string types)
  if (cfg?.hasSize) {
    const sizeStr = safeDisplay(attribute.size)
    detailRows.push({
      label: "Size",
      value: sizeStr ? (
        <span className="font-mono text-foreground">{sizeStr}</span>
      ) : (
        <span className="text-muted-foreground">Default</span>
      ),
    })
  }

  // Min / Max (number types)
  if (cfg?.hasMinMax) {
    const minStr = safeDisplay(attribute.min)
    const maxStr = safeDisplay(attribute.max)
    detailRows.push({
      label: "Min",
      value: minStr ? (
        <span className="font-mono text-foreground">{minStr}</span>
      ) : (
        <span className="text-muted-foreground">No limit</span>
      ),
    })
    detailRows.push({
      label: "Max",
      value: maxStr ? (
        <span className="font-mono text-foreground">{maxStr}</span>
      ) : (
        <span className="text-muted-foreground">No limit</span>
      ),
    })
  }

  // Object properties schema
  if (attribute.type === "object" && attribute.validation?.properties && attribute.validation.properties.length > 0) {
    detailRows.push({
      label: "Properties",
      value: (
        <div className="flex flex-col gap-1.5">
          {attribute.validation.properties.map((prop) => (
            <div key={prop.key} className="flex items-center gap-2">
              <span className="font-mono text-xs bg-secondary rounded px-2 py-0.5 text-foreground">
                {prop.key}: <span className="text-primary">{prop.type}</span>
              </span>
              {prop.required && (
                <span className="text-[10px] text-destructive bg-destructive/10 rounded px-1.5 py-0.5 font-medium">
                  required
                </span>
              )}
            </div>
          ))}
        </div>
      ),
    })
  }

  // Array item type
  if (attribute.type === "array" && attribute.validation?.arrayItemType) {
    detailRows.push({
      label: "Array Items",
      value: (
        <span className="font-mono bg-secondary rounded px-2 py-0.5 text-foreground">
          {attribute.validation.arrayItemType}[]
        </span>
      ),
    })
  }

  // Enum values
  if (attribute.type === "enum" && attribute.validation?.enum && attribute.validation.enum.length > 0) {
    detailRows.push({
      label: "Enum Values",
      value: (
        <div className="flex flex-wrap gap-1">
          {attribute.validation.enum.map((val) => (
            <span key={val} className="font-mono text-xs bg-secondary rounded px-2 py-0.5 text-foreground">
              {val}
            </span>
          ))}
        </div>
      ),
    })
  }

  // Other validation rules (min, max, pattern, etc.)
  const otherValidation: string[] = []
  if (attribute.validation?.min !== undefined) otherValidation.push(`min: ${attribute.validation.min}`)
  if (attribute.validation?.max !== undefined) otherValidation.push(`max: ${attribute.validation.max}`)
  if (attribute.validation?.minLength !== undefined) otherValidation.push(`minLength: ${attribute.validation.minLength}`)
  if (attribute.validation?.maxLength !== undefined) otherValidation.push(`maxLength: ${attribute.validation.maxLength}`)
  if (attribute.validation?.minItems !== undefined) otherValidation.push(`minItems: ${attribute.validation.minItems}`)
  if (attribute.validation?.maxItems !== undefined) otherValidation.push(`maxItems: ${attribute.validation.maxItems}`)
  if (attribute.validation?.pattern) otherValidation.push(`pattern: ${attribute.validation.pattern}`)
  
  if (otherValidation.length > 0) {
    detailRows.push({
      label: "Validation",
      value: <span className="font-mono text-foreground break-all text-xs">{otherValidation.join(", ")}</span>,
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground flex items-center gap-2">
            <Icon className={cn("size-4", cfg?.color || "text-muted-foreground")} />
            {attribute.key}
          </SheetTitle>
          <SheetDescription>
            Attribute details and validation rules.
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
/*  Create Attribute Sheet                                              */
/* ------------------------------------------------------------------ */
function CreateAttributeSheet({
  open,
  onOpenChange,
  onCreate,
  creating,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: (attr: Record<string, unknown>) => void
  creating: boolean
}) {
  const [key, setKey] = useState("")
  const [type, setType] = useState("string")
  const [required, setRequired] = useState(false)
  const [isArray, setIsArray] = useState(false)
  const [defaultValue, setDefaultValue] = useState("")
  const [useNowDefault, setUseNowDefault] = useState(false)
  const [indexed, setIndexed] = useState(false)
  const [unique, setUnique] = useState(false)
  const [size, setSize] = useState("")
  const [min, setMin] = useState("")
  const [max, setMax] = useState("")

  // Enum
  const [enumElements, setEnumElements] = useState<string[]>([])
  const [enumInput, setEnumInput] = useState("")

  // Object fields
  const [objectFields, setObjectFields] = useState<{ key: string; type: string; required: boolean }[]>([])
  const [objFieldKey, setObjFieldKey] = useState("")
  const [objFieldType, setObjFieldType] = useState("string")
  const [objFieldRequired, setObjFieldRequired] = useState(false)

  // Array items
  const [arrayItemType, setArrayItemType] = useState("string")

  const cfg = TYPE_CONFIG[type]

  const reset = () => {
    setKey("")
    setType("string")
    setRequired(false)
    setIsArray(false)
    setDefaultValue("")
    setUseNowDefault(false)
    setIndexed(false)
    setUnique(false)
    setSize("")
    setMin("")
    setMax("")
    setEnumElements([])
    setEnumInput("")
    setObjectFields([])
    setObjFieldKey("")
    setObjFieldType("string")
    setObjFieldRequired(false)
    setArrayItemType("string")
  }

  const handleAddEnum = () => {
    const val = enumInput.trim()
    if (val && !enumElements.includes(val)) {
      setEnumElements([...enumElements, val])
      setEnumInput("")
    }
  }

  const handleRemoveEnum = (val: string) => {
    setEnumElements(enumElements.filter((e) => e !== val))
    if (defaultValue === val) setDefaultValue("")
  }

  const handleAddObjectField = () => {
    const k = objFieldKey.trim()
    if (k && !objectFields.find((f) => f.key === k)) {
      setObjectFields([...objectFields, { key: k, type: objFieldType, required: objFieldRequired }])
      setObjFieldKey("")
      setObjFieldType("string")
      setObjFieldRequired(false)
    }
  }

  const handleRemoveObjectField = (k: string) => {
    setObjectFields(objectFields.filter((f) => f.key !== k))
  }

  const handleSubmit = () => {
  const payload: Record<string, unknown> = {
  key: key.trim(),
  type,
  // For object type, required is per-property, not at the field level
  required: type === "object" ? false : required,
  array: isArray,
  indexed: indexed || undefined,
  unique: unique || undefined,
  }

    // Default value
    if (type === "datetime" && useNowDefault) {
      payload.default = "now()"
    } else if (defaultValue.trim()) {
      payload.default = defaultValue.trim()
    }

    // Size
    if (cfg?.hasSize && size) payload.size = Number(size)

    // Min / Max
    if (cfg?.hasMinMax) {
      if (min) payload.min = Number(min)
      if (max) payload.max = Number(max)
    }

    // Enum elements — send both `elements` and `validation.enum` for backend compatibility
    if (cfg?.hasEnum && enumElements.length > 0) {
      payload.elements = enumElements
      payload.validation = { ...(payload.validation as Record<string, unknown> || {}), enum: enumElements }
    }

    // Object fields definition - send as validation.properties
    if (cfg?.hasObjectFields && objectFields.length > 0) {
      payload.validation = { 
        ...(payload.validation as Record<string, unknown> || {}), 
        properties: objectFields.map(f => ({ key: f.key, type: f.type, required: f.required }))
      }
    }

    // Array item type - send as validation.arrayItemType
    if (cfg?.hasArrayItems) {
      payload.validation = { 
        ...(payload.validation as Record<string, unknown> || {}), 
        arrayItemType: arrayItemType 
      }
    }

    onCreate(payload)
    reset()
  }

  const inputClass =
    "flex h-9 w-full rounded-md border border-border bg-secondary px-3 py-1 text-sm text-foreground font-mono focus:border-ring focus:ring-ring/50 focus:ring-[3px] outline-none transition-colors"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground">Create attribute</SheetTitle>
          <SheetDescription>
            Add a new attribute to this collection&apos;s schema.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-6 py-4 flex-1 overflow-y-auto">
          {/* Type selector - small cards */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Type</label>
            <div className="grid grid-cols-4 gap-1.5">
              {VALID_TYPES.map((t) => {
                const c = TYPE_CONFIG[t]
                const Icon = c.icon
                const active = type === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setType(t)
                      setDefaultValue("")
                      setUseNowDefault(false)
                      // Reset required when switching to object type (required is per-key for objects)
                      if (t === "object") setRequired(false)
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition-all",
                      active
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border bg-secondary hover:bg-secondary/80 hover:border-muted-foreground/30"
                    )}
                  >
                    <Icon className={cn("size-4", active ? c.color : "text-muted-foreground")} />
                    <span className={cn("text-[10px] font-medium leading-none", active ? "text-foreground" : "text-muted-foreground")}>
                      {c.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Key</label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="attribute_name"
              className="bg-secondary border-border font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Must start with a letter or underscore. Only letters, numbers, and underscores.
            </p>
          </div>

          {/* ── Type-specific sections ── */}

          {/* Default value: boolean */}
          {type === "boolean" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Default value <span className="text-muted-foreground font-normal">optional</span>
              </label>
              <select
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                className={inputClass}
              >
                <option value="">None</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
          )}

          {/* Default value: datetime with now() option */}
          {type === "datetime" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Default value <span className="text-muted-foreground font-normal">optional</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={useNowDefault}
                    onChange={(e) => {
                      setUseNowDefault(e.target.checked)
                      if (e.target.checked) setDefaultValue("")
                    }}
                    className="rounded border-border accent-primary"
                  />
                  <span className="font-mono text-xs">now()</span>
                </label>
              </div>
              {!useNowDefault && (
                <Input
                  type="datetime-local"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  className="bg-secondary border-border font-mono"
                />
              )}
              {useNowDefault && (
                <p className="text-xs text-muted-foreground">
                  Default will be the current timestamp when the document is created.
                </p>
              )}
            </div>
          )}

          {/* Default value: integer */}
          {type === "integer" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Default value <span className="text-muted-foreground font-normal">optional</span>
              </label>
              <Input
                type="number"
                step="1"
                value={defaultValue}
                onChange={(e) => {
                  const v = e.target.value
                  // Only allow whole numbers (strip decimals)
                  if (v === "" || v === "-" || /^-?\d+$/.test(v)) {
                    setDefaultValue(v)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "." || e.key === ",") e.preventDefault()
                }}
                placeholder="0"
                className="bg-secondary border-border font-mono"
              />
              <p className="text-xs text-muted-foreground">Must be a whole number (no decimals).</p>
            </div>
          )}

          {/* Default value: float */}
          {type === "float" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Default value <span className="text-muted-foreground font-normal">optional</span>
              </label>
              <Input
                type="number"
                step="any"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder="0.0"
                className="bg-secondary border-border font-mono"
              />
            </div>
          )}

          {/* Default value: string, email, url, ip */}
          {(type === "string" || type === "email" || type === "url" || type === "ip") && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Default value <span className="text-muted-foreground font-normal">optional</span>
              </label>
              <Input
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder={`Enter default ${type}`}
                className="bg-secondary border-border font-mono"
              />
            </div>
          )}

          {/* Enum elements builder */}
          {cfg?.hasEnum && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Enum elements</label>
              <div className="flex gap-2">
                <Input
                  value={enumInput}
                  onChange={(e) => setEnumInput(e.target.value)}
                  placeholder="Add element..."
                  className="bg-secondary border-border font-mono flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddEnum() } }}
                />
                <Button type="button" variant="outline" size="sm" className="h-9 border-border" onClick={handleAddEnum} disabled={!enumInput.trim()}>
                  <Plus className="size-3.5" />
                </Button>
              </div>
              {enumElements.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {enumElements.map((el) => (
                    <span
                      key={el}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-mono text-foreground"
                    >
                      {el}
                      <button
                        type="button"
                        onClick={() => handleRemoveEnum(el)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Enum default: select from elements */}
              {enumElements.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-sm font-medium text-foreground">
                    Default value <span className="text-muted-foreground font-normal">optional</span>
                  </label>
                  <select
                    value={defaultValue}
                    onChange={(e) => setDefaultValue(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Null (no default)</option>
                    {enumElements.map((el) => (
                      <option key={el} value={el}>{el}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Object fields builder */}
          {cfg?.hasObjectFields && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Object properties</label>
                <span className="text-xs text-muted-foreground">Mark required per property</span>
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  value={objFieldKey}
                  onChange={(e) => setObjFieldKey(e.target.value)}
                  placeholder="property_name"
                  className="bg-secondary border-border font-mono flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddObjectField() } }}
                />
                <select
                  value={objFieldType}
                  onChange={(e) => setObjFieldType(e.target.value)}
                  className="flex h-9 rounded-md border border-border bg-secondary px-2 py-1 text-xs font-mono text-foreground focus:border-ring outline-none transition-colors"
                >
                  <option value="string">string</option>
                  <option value="integer">integer</option>
                  <option value="float">float</option>
                  <option value="boolean">boolean</option>
                </select>
                <label 
                  className={cn(
                    "flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap px-2 py-1 rounded-md border transition-colors",
                    objFieldRequired 
                      ? "border-destructive/50 bg-destructive/10 text-destructive" 
                      : "border-border bg-secondary text-muted-foreground hover:border-muted-foreground/50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={objFieldRequired}
                    onChange={(e) => setObjFieldRequired(e.target.checked)}
                    className="size-3.5 rounded border-border accent-destructive"
                  />
                  Required
                </label>
                <Button type="button" variant="outline" size="sm" className="h-9 border-border" onClick={handleAddObjectField} disabled={!objFieldKey.trim()}>
                  <Plus className="size-3.5" />
                </Button>
              </div>
              {objectFields.length > 0 && (
                <div className="rounded-md border border-border overflow-hidden mt-1">
                  {objectFields.map((f, i) => (
                    <div
                      key={f.key}
                      className={cn(
                        "flex items-center justify-between px-3 py-2",
                        i !== objectFields.length - 1 && "border-b border-border"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-foreground">
                          {f.key}
                        </span>
                        <span className="text-[10px] text-primary bg-primary/10 rounded px-1.5 py-0.5">{f.type}</span>
                        {f.required && (
                          <span className="text-[10px] text-destructive bg-destructive/10 rounded px-1.5 py-0.5 font-medium">
                            required
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveObjectField(f.key)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Define expected properties and their types. Required properties will fail validation if missing.
              </p>
            </div>
          )}

          {/* Array item type selector */}
          {cfg?.hasArrayItems && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Array item type</label>
              <select
                value={arrayItemType}
                onChange={(e) => setArrayItemType(e.target.value)}
                className={inputClass}
              >
                <option value="string">string</option>
                <option value="integer">integer</option>
                <option value="float">float</option>
                <option value="boolean">boolean</option>
                <option value="object">object</option>
              </select>
              <p className="text-xs text-muted-foreground">
                The type of each item in the array.
              </p>
            </div>
          )}

          {/* Size (for string/email/url) */}
          {cfg?.hasSize && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Size <span className="text-muted-foreground font-normal">max characters</span>
              </label>
              <Input
                type="number"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="16383"
                className="bg-secondary border-border font-mono"
              />
            </div>
          )}

          {/* Min / Max (for numbers) */}
          {cfg?.hasMinMax && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Min</label>
                <Input
                  type="number"
                  step={type === "integer" ? "1" : "any"}
                  value={min}
                  onChange={(e) => {
                    const v = e.target.value
                    if (type === "integer") {
                      if (v === "" || v === "-" || /^-?\d+$/.test(v)) setMin(v)
                    } else {
                      setMin(v)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (type === "integer" && (e.key === "." || e.key === ",")) e.preventDefault()
                  }}
                  placeholder="No limit"
                  className="bg-secondary border-border font-mono"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Max</label>
                <Input
                  type="number"
                  step={type === "integer" ? "1" : "any"}
                  value={max}
                  onChange={(e) => {
                    const v = e.target.value
                    if (type === "integer") {
                      if (v === "" || v === "-" || /^-?\d+$/.test(v)) setMax(v)
                    } else {
                      setMax(v)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (type === "integer" && (e.key === "." || e.key === ",")) e.preventDefault()
                  }}
                  placeholder="No limit"
                  className="bg-secondary border-border font-mono"
                />
              </div>
            </div>
          )}

          {/* Toggles row */}
          <div className="flex flex-col gap-3 pt-1">
            {/* Required toggle - hidden for Object type since required is per-key */}
            {type !== "object" && (
              <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
                <button
                  type="button"
                  role="switch"
                  aria-checked={required}
                  onClick={() => setRequired(!required)}
                  className={cn(
                    "relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                    required ? "bg-primary" : "bg-secondary border border-border"
                  )}
                >
                  <span
                    className={cn(
                      "absolute size-3.5 rounded-full bg-background shadow transition-transform",
                      required ? "translate-x-[18px]" : "translate-x-[3px]"
                    )}
                  />
                </button>
                <div>
                  <span className="font-medium">Required</span>
                  <p className="text-xs text-muted-foreground">Document creation will fail if this field is missing.</p>
                </div>
              </label>
            )}

            <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={isArray}
                onClick={() => setIsArray(!isArray)}
                className={cn(
                  "relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                  isArray ? "bg-primary" : "bg-secondary border border-border"
                )}
              >
                <span
                  className={cn(
                    "absolute size-3.5 rounded-full bg-background shadow transition-transform",
                    isArray ? "translate-x-[18px]" : "translate-x-[3px]"
                  )}
                />
              </button>
              <div>
                <span className="font-medium">Array</span>
                <p className="text-xs text-muted-foreground">Store multiple values of this type.</p>
              </div>
            </label>

            <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={indexed}
                onClick={() => setIndexed(!indexed)}
                className={cn(
                  "relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                  indexed ? "bg-primary" : "bg-secondary border border-border"
                )}
              >
                <span
                  className={cn(
                    "absolute size-3.5 rounded-full bg-background shadow transition-transform",
                    indexed ? "translate-x-[18px]" : "translate-x-[3px]"
                  )}
                />
              </button>
              <div>
                <span className="font-medium">Indexed</span>
                <p className="text-xs text-muted-foreground">Create a database index for faster queries on this field.</p>
              </div>
            </label>

            <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={unique}
                onClick={() => setUnique(!unique)}
                className={cn(
                  "relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                  unique ? "bg-primary" : "bg-secondary border border-border"
                )}
              >
                <span
                  className={cn(
                    "absolute size-3.5 rounded-full bg-background shadow transition-transform",
                    unique ? "translate-x-[18px]" : "translate-x-[3px]"
                  )}
                />
              </button>
              <div>
                <span className="font-medium">Unique</span>
                <p className="text-xs text-muted-foreground">Enforce unique values across all documents.</p>
              </div>
            </label>
          </div>
        </div>

        <SheetFooter className="px-6 flex-row gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={creating || !key.trim()}>
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/*  Attributes Content                                                 */
/* ------------------------------------------------------------------ */
export function AttributesContent() {
  const params = useParams()
  const dbId = params.dbId as string
  const collectionSlug = params.collectionSlug as string
  const { toast } = useToast()

  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [detailAttr, setDetailAttr] = useState<Attribute | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [sortBy, setSortBy] = useState<string>("key")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  // Column visibility
  const columnDefs = [
    { key: "key", label: "Key", visible: true },
    { key: "type", label: "Type", visible: true },
    { key: "required", label: "Required", visible: true },
    { key: "array", label: "Array", visible: true },
    { key: "indexed", label: "Indexed", visible: true },
    { key: "unique", label: "Unique", visible: true },
    { key: "default", label: "Default", visible: true },
    { key: "size", label: "Size", visible: true },
  ]
  const [columns, setColumns] = useState(columnDefs)
  const visibleCols = columns.filter((c) => c.visible)

  const handleColumnToggle = (colKey: string) => {
    if (colKey === "key") return // key always visible
    setColumns((prev) =>
      prev.map((c) => (c.key === colKey ? { ...c, visible: !c.visible } : c))
    )
  }

  const fetchAttributes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.db.get(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/attributes`
      )
      setAttributes(res.data?.data || [])
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to load attributes"
      toast({ message: msg, type: "error" })
      setAttributes([])
    } finally {
      setLoading(false)
    }
  }, [dbId, collectionSlug, toast])

  useEffect(() => {
    fetchAttributes()
  }, [fetchAttributes])

  const handleCreate = async (attr: Record<string, unknown>) => {
    if (!attr.key || !(attr.key as string).trim()) {
      toast({ message: "Attribute key is required", type: "error" })
      return
    }
    setCreating(true)
    try {
      await axiosInstance.db.post(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/attributes`,
        attr
      )
      toast({ message: `Attribute "${attr.key}" created`, type: "success" })
      fetchAttributes()
      setAddOpen(false)
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to create attribute"
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
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/attributes/${deleteTarget}`
      )
      toast({ message: `Attribute "${deleteTarget}" deleted`, type: "error" })
      fetchAttributes()
      setDeleteOpen(false)
      setDeleteTarget(null)
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to delete attribute"
      toast({ message: msg, type: "error" })
    } finally {
      setDeleting(false)
    }
  }

  // Client-side search + sort
  const filteredAndSorted = (() => {
    let result = attributes

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.key.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q)
      )
    }

    result = [...result].sort((a, b) => {
      let aVal: string
      let bVal: string
      if (sortBy === "key") { aVal = a.key; bVal = b.key }
      else if (sortBy === "type") { aVal = a.type; bVal = b.type }
      else if (sortBy === "required") { aVal = String(a.required); bVal = String(b.required) }
      else if (sortBy === "array") { aVal = String(a.array); bVal = String(b.array) }
      else if (sortBy === "indexed") { aVal = String(a.indexed ?? false); bVal = String(b.indexed ?? false) }
      else if (sortBy === "unique") { aVal = String(a.unique ?? false); bVal = String(b.unique ?? false) }
      else if (sortBy === "default") { aVal = String(a.default ?? ""); bVal = String(b.default ?? "") }
      else if (sortBy === "size") { aVal = String(a.size ?? 0); bVal = String(b.size ?? 0) }
      else { aVal = a.key; bVal = b.key }

      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" })
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  })()

  const getCellValue = (attr: Attribute, colKey: string) => {
    switch (colKey) {
      case "key": return null // handled separately
      case "type": {
        const cfg = TYPE_CONFIG[attr.type]
        const Icon = cfg?.icon || Type
        return (
          <div className="flex items-center gap-1.5">
            <Icon className={cn("size-3.5", cfg?.color || "text-muted-foreground")} />
            <span>{attr.type}</span>
          </div>
        )
      }
      case "required":
        // For object types, required is per-property, show indicator
        if (attr.type === "object") {
          return <span className="text-xs text-muted-foreground">per key</span>
        }
        return <BooleanCell value={attr.required} />
      case "array":
        return <BooleanCell value={attr.array} />
      case "indexed":
        return <BooleanCell value={attr.indexed ?? false} />
      case "unique":
        return <BooleanCell value={attr.unique ?? false} />
      case "default": {
        const d = safeDisplay(attr.default)
        return d ? (
          <span className="bg-secondary rounded px-1.5 py-0.5">{d}</span>
        ) : (
          <span className="text-muted-foreground/40">-</span>
        )
      }
      case "size": {
        const s = safeDisplay(attr.size)
        return s ? (
          <span>{s}</span>
        ) : (
          <span className="text-muted-foreground/40">-</span>
        )
      }
      default:
        return <span className="text-muted-foreground/40">-</span>
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}


                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
            <Layers className="size-5 text-foreground stroke-[1.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg text-foreground leading-tight flex items-center gap-2">
                Attributes [ {loading ? <Skeleton className="h-3 w-4"/> : `${attributes.length}`} ]
              </h1>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              View, create, and manage all attributes for this collection's schema.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      ) : attributes.length === 0 && !searchQuery.trim() ? (
                  <div className="relative w-full mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/50">
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 py-12 text-center backdrop-blur-xs">
        {/* Icon */}
        <div className="flex items-center justify-center size-10 rounded-xl border border-border bg-background">
          <Layers className="size-5" strokeWidth={1.5} />
        </div>

        {/* Copy */}
        <h3 className="mt-2 text-lg tracking-tight text-foreground text-balance">
          No attributes yet
        </h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-md leading-relaxed text-pretty">
        Define the schema for this collection by creating attributes.
        </p>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <Button
            onClick={() => setAddOpen(true)}>
            <Plus className="size-4" strokeWidth={2} />
            Create attribute
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
      ) : (
        <>
          {/* Toolbar */}
          <DataTableToolbar
            searchPlaceholder="Search attributes..."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            columns={columns}
            onColumnToggle={handleColumnToggle}
          >
            <Button size="sm" className="h-8" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" />
              Create attribute
            </Button>
          </DataTableToolbar>

          {/* PostgreSQL-style grid table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-card">
                    {/* Row number header */}
                    <th className="w-10 min-w-10 border-b border-r border-border px-2 py-1.5 text-center">
                      <span className="text-[11px] text-muted-foreground">#</span>
                    </th>
                    {visibleCols.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          "border-b border-r border-border px-3 py-1.5 text-left last:border-r-0",
                          col.key === "key" && "min-w-[180px]",
                          col.key === "type" && "min-w-[120px]",
                          (col.key === "required" || col.key === "array" || col.key === "indexed" || col.key === "unique") && "min-w-[80px]",
                          col.key === "default" && "min-w-[120px]",
                          col.key === "size" && "min-w-[80px]"
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
                        colSpan={visibleCols.length + 2}
                        className="text-center py-16 text-sm text-muted-foreground font-sans"
                      >
                        {searchQuery.trim() ? "No attributes match your search." : "No attributes yet."}
                      </td>
                    </tr>
                  ) : (
                    filteredAndSorted.map((attr, idx) => {
                      const rowNum = idx + 1
                      return (
                        <tr
                          key={attr.key}
                          className="group border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors"
                        >
                          {/* Row number */}
                          <td className="w-10 min-w-10 border-r border-border px-2 py-1.5 text-center">
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {rowNum}
                            </span>
                          </td>

                          {visibleCols.map((col) => {
                            if (col.key === "key") {
                              const cfg = TYPE_CONFIG[attr.type]
                              const Icon = cfg?.icon || Type
                              return (
                                <td
                                  key={col.key}
                                  className="border-r border-border px-3 py-1.5 min-w-[180px]"
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className={cn("size-3.5 shrink-0", cfg?.color || "text-muted-foreground")} />
                                    <span className="text-foreground font-medium">{attr.key}</span>
                                  </div>
                                </td>
                              )
                            }
                            return (
                              <td
                                key={col.key}
                                className="border-r border-border last:border-r-0 px-3 py-1.5 text-foreground"
                              >
                                {getCellValue(attr, col.key)}
                              </td>
                            )
                          })}

                          {/* Actions */}
                          <td className="px-1 py-1">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                onClick={() => { setDetailAttr(attr); setDetailOpen(true) }}
                                className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                title="View details"
                              >
                                <Eye className="size-3" />
                              </button>
                              <button
                                onClick={() => { setDeleteTarget(attr.key); setDeleteOpen(true) }}
                                className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Delete attribute"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
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
                {filteredAndSorted.length} of {attributes.length} attribute{attributes.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Create Attribute Sheet */}
      <CreateAttributeSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreate={handleCreate}
        creating={creating}
      />

      {/* Attribute Detail Sheet */}
      <AttributeDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        attribute={detailAttr}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete attribute</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-mono font-semibold text-foreground">{deleteTarget}</span>?
              This action cannot be undone.
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
