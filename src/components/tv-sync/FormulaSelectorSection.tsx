import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFormulas } from '@/hooks/useFormulas';
import { useUserScreenerUrls } from '@/hooks/useUserScreenerUrls';
import { ScreenerUrlDialog } from '@/components/ScreenerUrlDialog';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { UserScreenerUrl } from '@/app/api/screener-urls/route';
import { Plus, Edit, Trash2, X, ChevronRight, ChevronDown, Zap, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface FormulaSelectorSectionProps {
    selectedFormulaIds: string[];
    onSelectedFormulaIdsChange: (ids: string[]) => void;
    customUrls: string[];
    onCustomUrlsChange: (urls: string[]) => void;
}

const DEFAULT_URLS = [
    { label: 'PPC_no_sma', value: 'https://api.marketinout.com/run/screen?key=eed4a72303564710' },
    { label: 'Second Screener', value: 'https://api.marketinout.com/run/screen?key=79505328ba974866' },
];

export function FormulaSelectorSection({
    selectedFormulaIds,
    onSelectedFormulaIdsChange,
    customUrls,
    onCustomUrlsChange,
}: FormulaSelectorSectionProps) {
    const { formulas, loading: formulasLoading, error: formulasError } = useFormulas();
    const { urls: userUrls, error: userUrlsError, addUrl: addUserUrl, updateUrl: updateUserUrl, deleteUrl: deleteUserUrl } = useUserScreenerUrls();
    const toast = useToast();

    // Custom URLs state (collapsed by default)
    const [customUrlsExpanded, setCustomUrlsExpanded] = useState(false);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingUrl, setEditingUrl] = useState<UserScreenerUrl | null>(null);

    // Confirmation dialog state
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [urlToDelete, setUrlToDelete] = useState<UserScreenerUrl | null>(null);

    // Custom URL handlers
    const handleCustomUrlChange = (index: number, value: string) => {
        const newUrls = [...customUrls];
        newUrls[index] = value;
        onCustomUrlsChange(newUrls);
    };

    const addCustomUrl = () => {
        onCustomUrlsChange([...customUrls, '']);
    };

    const removeCustomUrl = (index: number) => {
        onCustomUrlsChange(customUrls.filter((_, i) => i !== index));
    };

    // Handle adding/editing user URLs
    const handleSaveUrl = async (name: string, url: string): Promise<boolean> => {
        try {
            let success = false;

            if (editingUrl) {
                // Update existing URL
                success = await updateUserUrl(editingUrl.id, name, url);
                if (success) {
                    // Update custom URLs if the edited URL is being used
                    const updatedUrls = customUrls.map(u => u === editingUrl.url ? url : u);
                    onCustomUrlsChange(updatedUrls);
                    toast('Screener URL updated successfully.', 'success');
                }
            } else {
                // Add new URL
                success = await addUserUrl(name, url);
                if (success) {
                    toast('Screener URL added successfully.', 'success');
                }
            }

            return success;
        } catch (error) {
            toast('Failed to save screener URL.', 'error');
            return false;
        }
    };

    return (
        <div>
            <Label className='text-base font-semibold'>Screener Sources</Label>
            <p className='text-sm text-muted-foreground mt-1 mb-4'>
                Select formulas from MIO or add custom URLs
            </p>

            {/* SECTION 1: Formula Multi-Select */}
            <div className='mb-6 space-y-2'>
                <div className='flex items-center gap-2'>
                    <Zap className='h-4 w-4 text-primary' />
                    <Label className='text-sm font-medium'>MIO Formulas</Label>
                    {formulas.length > 0 && (
                        <Badge variant='secondary' className='text-xs'>
                            {formulas.length} available
                        </Badge>
                    )}
                </div>

                {formulasLoading ? (
                    <div className='flex items-center gap-2 p-3 border rounded-lg bg-muted/20'>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        <span className='text-sm text-muted-foreground'>Loading formulas...</span>
                    </div>
                ) : formulasError ? (
                    <Alert variant='destructive'>
                        <AlertDescription>{formulasError}</AlertDescription>
                    </Alert>
                ) : formulas.length === 0 ? (
                    <Alert>
                        <AlertDescription>
                            No formulas found. Visit the{' '}
                            <a href='/mio-formulas' className='underline font-medium'>
                                Formula Manager
                            </a>{' '}
                            to extract your formulas from MIO.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <MultiSelect
                        options={formulas.map(f => ({
                            label: f.name,
                            value: f.id,
                        }))}
                        onValueChange={onSelectedFormulaIdsChange}
                        defaultValue={selectedFormulaIds}
                        placeholder='Select one or more formulas...'
                        className='w-full'
                        maxCount={3}
                    />
                )}
            </div>

            {/* SECTION 2: Custom URLs (Collapsible) */}
            <div>
                <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => setCustomUrlsExpanded(!customUrlsExpanded)}
                    className='flex items-center gap-2 p-0 h-auto mb-3'
                >
                    {customUrlsExpanded ? (
                        <ChevronDown className='h-4 w-4' />
                    ) : (
                        <ChevronRight className='h-4 w-4' />
                    )}
                    <span className='text-sm font-medium'>
                        Custom URLs {customUrls.length > 0 && `(${customUrls.length})`}
                    </span>
                </Button>

                {customUrlsExpanded && (
                    <div className='space-y-4 pl-6 border-l-2'>
                        <div className='flex items-center justify-between'>
                            <p className='text-sm text-muted-foreground'>
                                Add custom screener URLs for advanced use cases
                            </p>
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => {
                                    setEditingUrl(null);
                                    setDialogOpen(true);
                                }}
                                className='flex items-center gap-2'
                            >
                                <Plus className='h-4 w-4' />
                                Save URL
                            </Button>
                        </div>

                        {/* Show user URLs error if any */}
                        {userUrlsError && (
                            <div className='p-3 bg-red-50 border border-red-200 rounded-md'>
                                <p className='text-sm text-red-600'>{userUrlsError}</p>
                            </div>
                        )}

                        {customUrls.length === 0 ? (
                            <div className='text-center p-4 border rounded-lg border-dashed'>
                                <p className='text-sm text-muted-foreground mb-2'>No custom URLs added</p>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    onClick={addCustomUrl}
                                >
                                    <Plus className='h-4 w-4 mr-2' />
                                    Add First Custom URL
                                </Button>
                            </div>
                        ) : (
                            <>
                                {customUrls.map((url, i) => {
                                    const userUrl = userUrls.find(u => u.url === url);

                                    return (
                                        <div key={i} className='flex items-center gap-2'>
                                            <Select value={url} onValueChange={(val) => handleCustomUrlChange(i, val)}>
                                                <SelectTrigger className='w-48'>
                                                    <SelectValue placeholder='Select URL' />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {/* Preset URLs */}
                                                    {DEFAULT_URLS.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label} (Preset)
                                                        </SelectItem>
                                                    ))}
                                                    {/* User URLs */}
                                                    {userUrls.map((userUrl) => (
                                                        <SelectItem key={userUrl.id} value={userUrl.url}>
                                                            {userUrl.name} (Custom)
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                value={url}
                                                onChange={(e) => handleCustomUrlChange(i, e.target.value)}
                                                className='flex-1'
                                                placeholder='Paste or edit API URL'
                                            />

                                            {/* Edit button for user URLs */}
                                            {userUrl && (
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    size='sm'
                                                    onClick={() => {
                                                        setEditingUrl(userUrl);
                                                        setDialogOpen(true);
                                                    }}
                                                    className='flex items-center gap-1'
                                                >
                                                    <Edit className='h-3 w-3' />
                                                </Button>
                                            )}

                                            {/* Delete button for user URLs */}
                                            {userUrl && (
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    size='sm'
                                                    onClick={() => {
                                                        setUrlToDelete(userUrl);
                                                        setConfirmDialogOpen(true);
                                                    }}
                                                    className='flex items-center gap-1 text-red-600 hover:text-red-700'
                                                >
                                                    <Trash2 className='h-3 w-3' />
                                                </Button>
                                            )}

                                            {/* Remove from current selection */}
                                            {customUrls.length > 1 && (
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    size='icon'
                                                    onClick={() => removeCustomUrl(i)}
                                                >
                                                    <X className='h-4 w-4' />
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    onClick={addCustomUrl}
                                >
                                    <Plus className='h-4 w-4 mr-2' />
                                    Add Another URL
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Screener URL Dialog */}
            <ScreenerUrlDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSave={handleSaveUrl}
                editingUrl={editingUrl}
            />

            {/* Confirmation Dialog */}
            <ConfirmationDialog
                open={confirmDialogOpen}
                onOpenChange={setConfirmDialogOpen}
                title="Delete Screener URL"
                description={`Are you sure you want to delete "${urlToDelete?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
                onConfirm={async () => {
                    if (urlToDelete) {
                        const success = await deleteUserUrl(urlToDelete.id);
                        if (success) {
                            // Remove from custom URLs if it's being used
                            const updatedUrls = customUrls.filter(u => u !== urlToDelete.url);
                            onCustomUrlsChange(updatedUrls);
                            toast('Screener URL deleted successfully.', 'success');
                        } else {
                            toast('Failed to delete screener URL.', 'error');
                        }
                        setUrlToDelete(null);
                        setConfirmDialogOpen(false);
                    }
                }}
            />
        </div>
    );
}
