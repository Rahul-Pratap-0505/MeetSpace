
import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

type CreateRoomDialogProps = {
  onRoomCreated: () => void
}

const CreateRoomDialog = ({ onRoomCreated }: CreateRoomDialogProps) => {
  const [roomName, setRoomName] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const { user } = useAuth();

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomName.trim() || !user) return

    setIsCreating(true)
    try {
      const { error } = await supabase
        .from('rooms')
        .insert([{ name: roomName.trim(), created_by: user.id }])  // << set created_by

      if (error) throw error

      toast.success('Room created successfully!')
      setRoomName('')
      setIsOpen(false)
      onRoomCreated()
    } catch (error: any) {
      toast.error('Error creating room: ' + error.message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`
            w-full justify-start
            text-foreground 
            dark:border dark:border-muted dark:bg-muted/60 dark:hover:bg-muted/80 dark:hover:border-primary
            transition
          `}
        >
          <Plus className="h-4 w-4 mr-2" />
          <span>
            Create Room
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreateRoom} className="space-y-4">
          <Input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Enter room name..."
            autoFocus
          />
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!roomName.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create Room'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateRoomDialog
