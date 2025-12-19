"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  label: string
  currency?: "₹" | "$"
  disabled?: boolean
  className?: string
  id?: string
}

export function CurrencyInput({
  value,
  onChange,
  label,
  currency = "₹",
  disabled = false,
  className,
  id,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState("")

  // Format number with thousands separator
  const formatCurrency = (num: number): string => {
    if (isNaN(num) || num === 0) return ""
    return num.toLocaleString("en-IN")
  }

  // Update display value when prop value changes
  React.useEffect(() => {
    setDisplayValue(formatCurrency(value))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    
    // Allow empty input
    if (input === "") {
      setDisplayValue("")
      onChange(0)
      return
    }

    // Remove non-numeric characters except decimal point
    const cleaned = input.replace(/[^\d.]/g, "")
    
    // Parse and validate
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed)) {
      onChange(parsed)
      setDisplayValue(cleaned)
    }
  }

  const handleBlur = () => {
    // Format on blur for better UX
    setDisplayValue(formatCurrency(value))
  }

  const inputId = id || `currency-${label.toLowerCase().replace(/\s+/g, "-")}`

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {currency}
        </span>
        <Input
          id={inputId}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          className="pl-8"
          placeholder="0"
        />
      </div>
    </div>
  )
}
