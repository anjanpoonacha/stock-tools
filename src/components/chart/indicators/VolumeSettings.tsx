"use client"

import * as React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { GlobalSettings } from "@/types/chartSettings"

interface VolumeSettingsProps {
	settings: Record<string, any>
	onChange: (newSettings: Record<string, any>) => void
	globalSettings: GlobalSettings
	onGlobalChange: (key: keyof GlobalSettings, value: any) => void
}

export function VolumeSettings({
	settings,
	onChange,
	globalSettings,
	onGlobalChange,
}: VolumeSettingsProps) {
	// Local state for input to prevent re-renders on every keystroke
	const [localMALength, setLocalMALength] = React.useState(globalSettings.volumeMALength)
	const updateTimerRef = React.useRef<NodeJS.Timeout | null>(null)

	// Sync local state when global settings change externally
	React.useEffect(() => {
		setLocalMALength(globalSettings.volumeMALength)
	}, [globalSettings.volumeMALength])

	const handleShowMAChange = (checked: boolean) => {
		onGlobalChange('showVolumeMA', checked)
	}

	const handleMALengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = parseInt(e.target.value, 10)
		
		// Update local state immediately for responsive UI
		setLocalMALength(value)
		
		// Debounce the actual settings update
		if (updateTimerRef.current) {
			clearTimeout(updateTimerRef.current)
		}
		
		updateTimerRef.current = setTimeout(() => {
			if (!isNaN(value) && value > 0) {
				onGlobalChange('volumeMALength', value)
			}
		}, 500) // 500ms debounce
	}

	// Cleanup timer on unmount
	React.useEffect(() => {
		return () => {
			if (updateTimerRef.current) {
				clearTimeout(updateTimerRef.current)
			}
		}
	}, [])

	return (
		<div className="space-y-4 p-1">
			{/* Show MA Checkbox */}
			<div className="flex items-center gap-2">
				<Checkbox
					id="show-volume-ma"
					checked={globalSettings.showVolumeMA}
					onCheckedChange={handleShowMAChange}
				/>
				<Label htmlFor="show-volume-ma" className="cursor-pointer">
					Show MA
				</Label>
			</div>

			{/* MA Length Input - only shown when MA is enabled */}
			{globalSettings.showVolumeMA && (
				<div className="flex items-center gap-2">
					<Label htmlFor="volume-ma-length" className="min-w-[80px]">
						MA Length
					</Label>
					<Input
						id="volume-ma-length"
						type="number"
						min="1"
						value={localMALength}
						onChange={handleMALengthChange}
						className="w-20"
					/>
				</div>
			)}
		</div>
	)
}
