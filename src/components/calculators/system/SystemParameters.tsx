"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CurrencyInput } from "@/components/calculators/shared/CurrencyInput"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface SystemParametersProps {
  rValue: number
  totalTrades: number
  onRValueChange: (value: number) => void
  onTotalTradesChange: (value: number) => void
}

export function SystemParameters({
  rValue,
  totalTrades,
  onRValueChange,
  onTotalTradesChange,
}: SystemParametersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Parameters</CardTitle>
        <CardDescription>
          Define your risk per trade (1R) and total number of trades
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <CurrencyInput
          value={rValue}
          onChange={onRValueChange}
          label="Risk Per Trade (1R)"
          currency="₹"
        />

        <div className="space-y-2">
          <Label htmlFor="total-trades">Total Trades</Label>
          <Input
            id="total-trades"
            type="number"
            min="1"
            value={totalTrades}
            onChange={(e) => onTotalTradesChange(Math.max(1, parseInt(e.target.value) || 1))}
            placeholder="100"
          />
        </div>
      </CardContent>
    </Card>
  )
}
