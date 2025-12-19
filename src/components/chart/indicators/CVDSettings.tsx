import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { CVD_ANCHOR_PERIODS, CVD_CUSTOM_PERIODS } from '@/lib/chart/constants';

interface CVDSettingsProps {
	settings: Record<string, any>;
	onChange: (newSettings: Record<string, any>) => void;
}

export function CVDSettings({ settings, onChange }: CVDSettingsProps) {
	const anchorPeriod = settings.anchorPeriod || '3M';
	const useCustomPeriod = settings.useCustomPeriod || false;
	const customPeriod = settings.customPeriod || '15S';
	const useManualInput = settings.useManualInput || false;
	const manualPeriod = settings.manualPeriod || '';

	const handleAnchorPeriodChange = (value: string) => {
		onChange({ ...settings, anchorPeriod: value });
	};

	const handleUseCustomPeriodChange = (checked: boolean) => {
		onChange({ ...settings, useCustomPeriod: checked });
	};

	const handleCustomPeriodChange = (value: string) => {
		onChange({ ...settings, customPeriod: value });
	};

	const handleUseManualInputChange = (checked: boolean) => {
		onChange({ ...settings, useManualInput: checked });
	};

	const handleManualPeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange({ ...settings, manualPeriod: e.target.value });
	};

	return (
		<div className="space-y-3 p-1">
			<div className="space-y-2">
				<Label htmlFor="anchor-period" className="text-xs font-medium">
					Anchor Period
				</Label>
				<Select value={anchorPeriod} onValueChange={handleAnchorPeriodChange}>
					<SelectTrigger
						id="anchor-period"
						className="h-8 text-xs bg-background border-border"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{CVD_ANCHOR_PERIODS.map((period) => (
							<SelectItem
								key={period.value}
								value={period.value}
								className="text-xs"
							>
								{period.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex items-center space-x-2">
				<Checkbox
					id="use-custom-period"
					checked={useCustomPeriod}
					onCheckedChange={handleUseCustomPeriodChange}
					className="border-border"
				/>
				<Label
					htmlFor="use-custom-period"
					className="text-xs font-medium cursor-pointer"
				>
					Use Custom Period
				</Label>
			</div>

			{useCustomPeriod && (
				<div className="space-y-3">
					<div className="space-y-2">
						<Label htmlFor="custom-period" className="text-xs font-medium">
							Custom Period
						</Label>
						<Select value={customPeriod} onValueChange={handleCustomPeriodChange}>
							<SelectTrigger
								id="custom-period"
								className="h-8 text-xs bg-background border-border"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{CVD_CUSTOM_PERIODS.map((period) => (
									<SelectItem
										key={period.value}
										value={period.value}
										className="text-xs"
									>
										{period.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Manual Input Option */}
					<div className="flex items-center space-x-2">
						<Checkbox
							id="use-manual-input"
							checked={useManualInput}
							onCheckedChange={handleUseManualInputChange}
							className="border-border"
						/>
						<Label
							htmlFor="use-manual-input"
							className="text-xs font-medium cursor-pointer"
						>
							Custom Value
						</Label>
					</div>

					{useManualInput && (
						<div className="space-y-2">
							<Label htmlFor="manual-period" className="text-xs font-medium">
								Enter Period
							</Label>
							<Input
								id="manual-period"
								type="text"
								value={manualPeriod}
								onChange={handleManualPeriodChange}
								placeholder="e.g., 30S, 5, 60, 1D"
								className="h-8 text-xs bg-background border-border"
							/>
							<p className="text-[10px] text-muted-foreground">
								Seconds: 15S, 30S | Minutes: 1, 5, 15, 60 | Days/Weeks/Months: 1D, 1W, 1M, 3M, 1Y
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
