# Todo App, Notifications, Trash & Auth System Design

**Date:** 2026-02-24
**Approach:** Full Stack in One Shot (Approach A)

## Summary

Add four major features to the Mesa de Recibos platform:
1. **Authentication system** with JWT, user management, and admin panel
2. **Soft-delete + trash** across all 3 modules (Recibos, DS, Penhoras) with unified trash view
3. **Todo app** with subtasks, comments, record linking, and user assignment
4. **Notification system** with in-app bell, browser push, and configurable preferences

All features integrate via a collapsible right sidebar accessible from any module.

---

## 1. Authentication System

### Database Schema

```prisma
model User {
  id          Int       @id @default(autoincrement())
  username    String    @unique
  displayName String
  email       String?   @unique
  password    String    // bcrypt hashed
  role        UserRole  @default(USER)
  avatarColor String?   // hex color for avatar circle
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  todosCreated      Todo[]         @relation("TodoCreator")
  todosAssigned     Todo[]         @relation("TodoAssignee")
  todoComments      TodoComment[]
  notifications     Notification[]
  notificationPrefs NotificationPreference?
  deletedRecords    Record[]       @relation("RecordDeleter")
  deletedDsRecords  DsRecord[]     @relation("DsRecordDeleter")
  deletedPenhorasRecords PenhorasRecord[] @relation("PenhorasRecordDeleter")
}

enum UserRole {
  ADMIN
  USER
}
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user (first user = ADMIN) |
| POST | `/api/auth/login` | Login, returns JWT in httpOnly cookie |
| POST | `/api/auth/logout` | Clears auth cookie |
| GET | `/api/auth/me` | Returns current user from token |
| GET | `/api/users` | List all users (for assignment dropdowns) |
| PATCH | `/api/users/:id` | Update user (admin only) |
| DELETE | `/api/users/:id` | Deactivate user (admin only) |

### Frontend

- **Login page:** Username + password form, redirect to app on success
- **`useAuth()` hook:** Manages user state, login/logout, token refresh
- **Protected routes:** All existing routes wrapped in auth check
- **User avatar:** Top-right corner with dropdown (profile, admin panel, logout)
- **Admin panel:** User list with create/edit/deactivate actions (new tab in Configuracao or standalone)

### Key Decisions

- JWT stored in httpOnly cookie (7-day expiry)
- First registered user auto-promoted to ADMIN
- No email verification (internal tool)
- bcrypt with 12 salt rounds
- `requireAuth` middleware on all `/api/*` routes except `/api/auth/*`

---

## 2. Soft Delete + Trash System

### Database Changes

Add to `Record`, `DsRecord`, `PenhorasRecord`, and `Todo`:

```prisma
deletedAt   DateTime?
deletedById Int?        // FK to User
```

### Backend Changes

- All existing `GET` list endpoints: add `WHERE deletedAt IS NULL` filter by default
- New query param `?trash=true` returns only soft-deleted records
- `DELETE /api/records/:id` → sets `deletedAt = now(), deletedById = currentUser.id`
- `POST /api/records/:id/restore` → clears `deletedAt` and `deletedById`
- `DELETE /api/records/:id/permanent` → hard delete (admin only, from trash)
- Same pattern for `/api/ds/records/:id` and `/api/penhoras/records/:id`
- **Auto-purge:** Scheduled task (runs daily) deletes records where `deletedAt < now() - 30 days`

### Frontend

**Per-module table views:**
- Delete button on each row (icon button with trash icon)
- Confirmation modal: "Move [record identifier] to trash? It will be permanently deleted after 30 days."
- Small indicator: "X items in trash" linking to sidebar trash tab

**Sidebar Trash tab (unified):**
- Grouped by module (Recibos, DS, Penhoras, Todos)
- Each item shows: record summary, deleted by, deleted date, days remaining
- Actions per item: Restore, Delete Permanently (admin only)
- Bulk select + bulk restore/delete
- "Empty Trash" button (admin only) with confirmation
- Filter by module

---

## 3. Todo App

### Database Schema

```prisma
model Todo {
  id          Int          @id @default(autoincrement())
  title       String
  description String?
  priority    TodoPriority @default(MEDIUM)
  status      TodoStatus   @default(PENDING)
  dueDate     DateTime?

  // Assignment
  createdById Int
  createdBy   User         @relation("TodoCreator", fields: [createdById], references: [id])
  assigneeId  Int?
  assignee    User?        @relation("TodoAssignee", fields: [assigneeId], references: [id])

  // Optional record link
  linkedModule   String?   // 'recibos' | 'ds' | 'penhoras'
  linkedRecordId Int?

  // Soft delete
  deletedAt   DateTime?
  deletedById Int?

  // Relations
  subtasks    TodoSubtask[]
  comments    TodoComment[]

  // Timestamps
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model TodoSubtask {
  id        Int     @id @default(autoincrement())
  todoId    Int
  todo      Todo    @relation(fields: [todoId], references: [id], onDelete: Cascade)
  title     String
  completed Boolean @default(false)
  order     Int     @default(0)
}

model TodoComment {
  id        Int      @id @default(autoincrement())
  todoId    Int
  todo      Todo     @relation(fields: [todoId], references: [id], onDelete: Cascade)
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  content   String
  createdAt DateTime @default(now())
}

enum TodoPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TodoStatus {
  PENDING
  IN_PROGRESS
  DONE
}
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/todos` | List todos (filters: assignee, status, priority, module, due date) |
| POST | `/api/todos` | Create todo |
| PATCH | `/api/todos/:id` | Update todo |
| DELETE | `/api/todos/:id` | Soft delete |
| POST | `/api/todos/:id/subtasks` | Add subtask |
| PATCH | `/api/todos/:id/subtasks/:sid` | Toggle/edit subtask |
| DELETE | `/api/todos/:id/subtasks/:sid` | Remove subtask |
| GET | `/api/todos/:id/comments` | List comments |
| POST | `/api/todos/:id/comments` | Add comment |

### Frontend (Sidebar)

- **Quick-add input** at top of sidebar
- **Todo cards** showing: title, priority badge (color-coded), assignee avatar, due date, linked record chip, subtask progress (3/5)
- **Expanded todo view** (inline in sidebar): edit title, description, assignee picker, priority, due date, subtask checklist, comments thread
- **Filter pills:** status, priority, assignee, linked module
- **Tabs:** "My Tasks" (assigned to me) / "All Tasks"
- **"Create Todo" action** in record detail drawers (pre-links the record)
- **Record link search:** Search dialog to pick a record from any module by processo/PE/referencia

---

## 4. Notification System

### Database Schema

```prisma
model Notification {
  id             Int              @id @default(autoincrement())
  userId         Int
  user           User             @relation(fields: [userId], references: [id])
  type           NotificationType
  title          String
  message        String
  read           Boolean          @default(false)
  linkedModule   String?          // 'recibos' | 'ds' | 'penhoras' | 'todos'
  linkedRecordId Int?
  linkedTodoId   Int?
  createdAt      DateTime         @default(now())
}

model NotificationPreference {
  id     Int  @id @default(autoincrement())
  userId Int  @unique
  user   User @relation(fields: [userId], references: [id])

  taskAssigned      Boolean @default(true)
  taskCompleted     Boolean @default(true)
  taskCommented     Boolean @default(true)
  taskDueSoon       Boolean @default(true)
  recordStatusChange Boolean @default(true)
  mention           Boolean @default(true)
}

enum NotificationType {
  TASK_ASSIGNED
  TASK_COMPLETED
  TASK_COMMENTED
  TASK_DUE_SOON
  RECORD_STATUS_CHANGE
  MENTION
}
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List for current user (paginated) |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| POST | `/api/notifications/read-all` | Mark all as read |
| GET | `/api/notifications/stream` | SSE endpoint for real-time |
| GET | `/api/notifications/preferences` | Get user preferences |
| PATCH | `/api/notifications/preferences` | Update preferences |

### Trigger Points (Server-Side)

| Event | Notification Type | Recipient |
|-------|------------------|-----------|
| Todo assigned to user | TASK_ASSIGNED | Assignee |
| Todo status → DONE | TASK_COMPLETED | Creator |
| Comment added to todo | TASK_COMMENTED | All participants (creator + assignee) |
| Todo due within 24h | TASK_DUE_SOON | Assignee (scheduled check) |
| Record status changed | RECORD_STATUS_CHANGE | (future: configurable per record) |
| `@username` in comment | MENTION | Mentioned user |

### Real-Time Delivery

- **SSE (Server-Sent Events):** `/api/notifications/stream` keeps connection open, pushes new notifications
- **Browser Push (Service Worker):** Registered on first login, sends native OS notifications when tab is not focused
- **Preference check:** Before creating a notification, check user's `NotificationPreference` for that type

### Frontend

- **Bell icon** in top-right with unread count badge
- **Dropdown panel:** Recent notifications grouped by time (today, yesterday, earlier)
- **Click notification** → navigates to relevant todo/record
- **"Mark all read" button**
- **Notification preferences** page in user settings (toggle each type)
- **Browser push permission prompt** on first login

---

## 5. Unified Right Sidebar

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Brand/Module] ──── [tabs] ──── [Bell 🔴3] [Avatar ▾] │ [≡]
├───────────────────────────────────┬──────────────────────┤
│                                   │ [Todos][Notif][Trash]│
│   Main content area               │                      │
│   (current module tab)            │  Active sidebar tab  │
│                                   │  content             │
│                                   │                      │
│                                   │                      │
└───────────────────────────────────┴──────────────────────┘
```

### Behavior

- **Toggle:** Keyboard shortcut (Alt+T) or click sidebar toggle button [≡]
- **Width:** 360px default, resizable
- **State persistence:** Open/closed + active tab saved in localStorage
- **Badge counts:** Pending todos count, unread notifications count, trash item count
- **Responsive:** Collapses to icon strip on narrow screens
- **Pinnable:** Can be pinned open or auto-close on item click

### Sidebar Tabs

1. **Todos** — Task list with quick-add, filters, expanded todo view
2. **Notifications** — Notification feed with mark-read actions
3. **Trash** — Unified soft-deleted records from all modules

---

## Implementation Order

1. Database schema changes (Prisma migration)
2. Auth system (backend + login page + middleware)
3. Soft-delete fields + trash API endpoints
4. Todo CRUD API + subtasks + comments
5. Notification system (backend + SSE)
6. Sidebar shell (right panel, tabs, toggle)
7. Sidebar: Todos tab
8. Sidebar: Notifications tab + bell icon
9. Sidebar: Trash tab + per-module indicators
10. Browser push notification setup (Service Worker)
11. Admin panel (user management)
12. Notification preferences UI
13. Record-linking for todos
14. Auto-purge scheduled task
