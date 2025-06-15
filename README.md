
# MeetSpace

**MeetSpace** is a modern, full-stack real-time chat and video call platform, designed to help teams, friends, and communities communicate instantly and securely. Built with React, TypeScript, Supabase, and shadcn/ui, MeetSpace supports robust authentication, role-based admin operations, file sharing, theming, mobile/friendly UX, and scalable architecture.

![MeetSpace Screenshot](public/placeholder.svg)

---

## 🚀 Features

- **Real-Time Group Chat:** Join or create chat rooms and message in real time with presence tracking.
- **Video Calling:** Start and join group video calls directly from chat rooms.
- **Room Management:** Create or delete chat rooms, with superadmin privileges (see below).
- **Superadmin Policy:** Only the superadmin (`rahulsingh5may@gmail.com`) can delete any room; others can delete only the rooms they create.
- **User Authentication:** Secure email/password auth, plus Google OAuth.
- **Profile Avatars:** User profiles with usernames and avatars.
- **Notifications:** Instant feedback through toasts and UI indicators.
- **Mobile Responsive:** Fully works on phones, tablets, and desktops.
- **File Sharing:** Attach files to your chat messages (with storage policy coming soon).
- **Theming:** Light/dark mode with system preference support.
- **Built with Modern React Stack:** TypeScript, shadcn/ui, Tailwind CSS, and Supabase for backend.

---

## 🛠️ Technology Stack

- **Frontend:** React 18, TypeScript, shadcn/ui, Tailwind CSS, lucide-react icons
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime)
- **State/Networking:** @tanstack/react-query for efficient state management
- **Authentication:** Supabase Auth (Email/password, and Google OAuth)
- **Notifications:** sonner and shadcn/toast
- **Realtime Communication:** Supabase's realtime subscriptions for chat, presence, and calls

---

## 📦 Project Structure

```
src/
  components/       // All UI and re-usable components
  contexts/         // Application-wide providers (e.g. AuthContext)
  hooks/            // Custom React hooks for business logic
  integrations/     // Third-party and SDK integration (e.g. Supabase client/types)
  pages/            // Top-level pages (Chat, Auth, NotFound, etc.)
  lib/              // Utility files (e.g. supabase wrapper)
supabase/
  migrations/       // Database schema and policy migrations
public/
  lovable-uploads/  // User-uploaded assets and images
  ...
README.md           // This file
```

---

## 📝 Database Schema (Supabase)

**Tables:**

- `profiles` - user profiles (id, username, avatar_url, created_at)
- `rooms` - chat rooms (id, name, created_by, created_at)
- `messages` - messages (id, sender_id, content, file_url, room_id, created_at)
- See Supabase migrations for the latest schema and RLS (auth rules).

**Policies:**

- **Room deletion:** Only the room creator and the superadmin may delete a room.
- **Messages and rooms:** Users can view all rooms/messages; insert/update/delete restricted as per ownership and auth.
- **Superadmin function:** There is a Postgres function `is_superadmin()` that checks if the current user is `rahulsingh5may@gmail.com`.

---

## 🔑 Special Admin Policy

- The email `rahulsingh5may@gmail.com` is the global superadmin for the app.
- Only this account can delete any chat room (even if they are not the creator).
- All other users can only delete rooms they have created.

---

## 🚦 Getting Started

1. **Clone the repository:**
   ```sh
   git clone https://github.com/your-username/meetspace.git
   cd meetspace
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Create a `.env` file** (if not using default public keys):
   ```
   # Set your Supabase keys here
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

4. **Start the development server:**
   ```sh
   npm run dev
   ```

5. **Visit in your browser:**
   ```
   http://localhost:3000
   ```

---

## 🔌 Supabase Setup & Migrations

- This project is designed for instant deployment on [Supabase](https://supabase.com/).
- Database migrations (supabase/migrations/) will set up all tables, policies, RLS, and triggers.
- Set up authentication providers [here](https://supabase.com/dashboard/project/ibqrsfwddrziflogmldn/auth/providers) (Google, etc).

---

## 🌐 Authentication

- Email/password login & signup with automatic redirect.
- Google OAuth (see Supabase docs for project setup).
- Auth policies use both JWT and Supabase's RLS for strong access enforcement.

---

## 🖥️ Key Components

- `ChatSidebar`: Room navigation & management with admin-only controls.
- `ChatMessages`: Main chat window with avatars, files, and message actions.
- `ChatInput`: Rich input box, file uploads, typing indicators.
- `VideoCallModal`: Peer-to-peer group video calls using WebRTC and Supabase signaling.
- `AuthPage`: Unified sign-in and registration.
- `ProtectedRoute`: Ensures only authenticated users access chat.

---

## 📱 Mobile Ready

MeetSpace is designed to be fully responsive, with touch-friendly UI and off-canvas navigation for mobile.

---

## 🙋‍♂️ Contributing

Pull requests are welcome! For new features/bugfixes:

1. Fork the repository.
2. Create your feature branch (`git checkout -b my-feature`).
3. Commit your changes (`git commit -am 'Add my feature'`).
4. Push to the branch (`git push origin my-feature`).
5. Create a new Pull Request.

For any questions, open an issue.

---

## 📄 License

This project is [MIT](LICENSE) licensed.

---

## ✨ Credits

Created by Rahul Pratap.

Lovable AI and open source contributors.

---

## 💬 Community & Support

- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Lovable Docs](https://docs.lovable.dev/)
- [Discord community](https://discord.com/channels/1119885301872070706/1280461670979993613)

