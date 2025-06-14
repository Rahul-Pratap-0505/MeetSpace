
import React from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Trash2, MoreVertical } from 'lucide-react'
import { toast } from 'sonner'

type MessageActionsProps = {
  messageId: string
  isOwn: boolean
  onMessageDeleted: () => void
}

const MessageActions = ({ messageId, isOwn, onMessageDeleted }: MessageActionsProps) => {
  const handleDeleteMessage = async () => {
    try {
      console.log('Deleting message:', messageId)
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)

      if (error) {
        console.error('Delete error:', error)
        throw error
      }

      console.log('Message deleted successfully')
      toast.success('Message deleted')
      onMessageDeleted()
    } catch (error: any) {
      console.error('Error deleting message:', error)
      toast.error('Error deleting message: ' + error.message)
    }
  }

  if (!isOwn) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
          <span className="sr-only">Message options</span>
          <MoreVertical className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDeleteMessage} className="text-red-600">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Message
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default MessageActions
