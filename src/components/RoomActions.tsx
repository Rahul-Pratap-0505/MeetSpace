
import React from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Trash2, MoreVertical } from 'lucide-react'
import { toast } from 'sonner'

type RoomActionsProps = {
  roomId: string
  roomName: string
  onRoomDeleted: () => void
  canDelete?: boolean
}

const RoomActions = ({ roomId, roomName, onRoomDeleted, canDelete = true }: RoomActionsProps) => {
  const handleDeleteRoom = async () => {
    try {
      // First delete all messages in the room
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', roomId)

      if (messagesError) throw messagesError

      // Then delete the room
      const { error: roomError } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId)

      if (roomError) throw roomError

      toast.success(`Room "${roomName}" deleted`)
      onRoomDeleted()
    } catch (error: any) {
      toast.error('Error deleting room: ' + error.message)
    }
  }

  if (!canDelete) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
          <span className="sr-only">Room options</span>
          <MoreVertical className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDeleteRoom} className="text-red-600">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Room
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default RoomActions
