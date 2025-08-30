'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';

interface UserSelectorProps {
    availableUsers: string[];
    onUserSelect: (email: string) => void;
    disabled?: boolean;
}

export function UserSelector({ availableUsers, onUserSelect, disabled = false }: UserSelectorProps) {
    if (availableUsers.length === 0) {
        return null;
    }

    return (
        <div className='space-y-2'>
            <Label className='flex items-center gap-2'>
                <Users className='h-4 w-4' />
                Available Users
            </Label>
            <div className='flex flex-wrap gap-2'>
                {availableUsers.map((email) => (
                    <Button
                        key={email}
                        variant='outline'
                        size='sm'
                        onClick={() => onUserSelect(email)}
                        disabled={disabled}
                        className='text-xs'
                    >
                        {email}
                    </Button>
                ))}
            </div>
        </div>
    );
}
