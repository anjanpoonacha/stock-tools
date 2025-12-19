"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface PercentageInputProps {
  value: number
  onChange: (value: number) => void
  label: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
  id?: string
}

export function PercentageInput({
  value,
  onChange,
  label,
  min = 0,
  max = 100,
  step = 0.1,
  disabled = false,
  className,
  id,
}: PercentageInputProps) {
  const [error, setError] = React.useState<string>("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    
    // Allow empty input
    if (input === "") {
      onChange(0)
      setError("")
      return
    }

    // Parse value
    const parsed = parseFloat(input)
    
    // Validate
    if (isNaN(parsed)) {
      setError("Invalid number")
      return
    }

    if (parsed < min) {
      setError(`Minimum value is ${min}%`)
      onChange(min)
      return
    }

    if (parsed > max) {
      setError(`Maximum value is ${max}%`)
      onChange(max)
      return
    }

    setError("")
    onChange(parsed)
  }

  const handleBlur = () => {
    // Ensure value is within range on blur
    if (value < min) {
      onChange(min)
    } else if (value > max) {
      onChange(max)
    }
  }

  const inputId = id || `percentage-${label.toLowerCase().replace(/\s+/g, "-")}`

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          type="number"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          className={cn("pr-8", error && "border-destructive")}
          placeholder="0"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          %
        </span>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
