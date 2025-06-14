
import React from "react";
import { Button } from "@/components/ui/button";
import { LogOut, MessageCircle, Users } from "lucide-react";
import CreateRoomDialog from "@/components/CreateRoomDialog";
import RoomActions from "@/components/RoomActions";

type Room = {
  id: string;
  name: string;
  created_at: string;
};

export type ChatSidebarProps = {
  user: any;
  rooms: Room[];
  currentRoom: string;
  setCurrentRoom: (id: string) => void;
  handleSignOut: () => void;
  fetchRooms: () => void;
  handleRoomDeleted: () => void;
  generateRoomAvatar: (name: string) => string;
};

const ChatSidebar = ({
  user,
  rooms,
  currentRoom,
  setCurrentRoom,
  handleSignOut,
  fetchRooms,
  handleRoomDeleted,
  generateRoomAvatar,
}: ChatSidebarProps) => {
  return (
    <div className="w-80 bg-white/80 backdrop-blur-sm border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Chat Rooms</h1>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* Rooms List */}
      <div className="flex-1 overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Rooms</span>
            </div>
          </div>
          <CreateRoomDialog onRoomCreated={fetchRooms} />
          <div className="space-y-1 mt-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                className={`group flex items-center justify-between p-3 rounded-lg transition-colors ${
                  currentRoom === room.id
                    ? "bg-blue-100 text-blue-700"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <button
                  onClick={() => setCurrentRoom(room.id)}
                  className="flex-1 text-left flex items-center space-x-3"
                >
                  <div
                    className={`w-8 h-8 bg-gradient-to-r ${generateRoomAvatar(
                      room.name
                    )} rounded-full flex items-center justify-center`}
                  >
                    <span className="text-white font-medium text-sm">
                      {room.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{room.name}</div>
                    <div className="text-xs text-gray-500">
                      Created {new Date(room.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </button>
                <RoomActions
                  roomId={room.id}
                  roomName={room.name}
                  onRoomDeleted={handleRoomDeleted}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;
