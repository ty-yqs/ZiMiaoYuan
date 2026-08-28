# ZiMiaoYuan (紫喵园)

[English](README.en.md) · [中文](README.md)

![Shen Xiao Li](logo.jpg)

ZiMiaoYuan is a non-profit mini program dedicated to campus stray cat management. Users can photograph campus cats, build digital profiles, mark spay/neuter and vaccination status, rate each cat's friendliness, and attach sticky notes to share observations. It supports filtering by coat color/gender/age, a statistics dashboard, and an admin review mechanism, facilitating scientific campus TNR (Trap-Neuter-Return) management.

## ✨ Features

- **Login guidance** — First-time setup of nickname and avatar, with identity verification before publishing
- **Cat profiles** — Browse the campus cat gallery; the search bar and filter bar stay pinned to the top, filter by coat color, gender, and age
- **Today's picks** — The home page randomly recommends 2 cats, refreshed on every visit
- **Discover a cat** — Upload photos of a new cat with basic info (including spay/neuter & vaccination status) for review
- **Cat detail** — View a cat's full profile: photo carousel, info, health status, Chinese age labels, vaccination notes
- **Edit proposals** — Users submit corrections to cat info, effective after admin review
- **Discovery records** — Upload new photos (up to 3) for an existing cat, recording the encounter moment
- **Cat feed** — The "Feed" tab shows all reviewed discovery records school-wide in a waterfall layout, with pull-to-refresh and load-more
- **Record detail** — Enter from the "Discovery records" card on the cat detail page to browse all discovery records for that cat in a Moments-style waterfall
- **Sticky notes** — Attach text notes to a cat to share your observations and thoughts
- **Friendliness rating** — Rate a cat's friendliness from 1–5 stars, one vote per user per cat, showing the real-time average and vote count
- **Cat relationships** — Supports 7 relationship types (partner / parent-child / siblings / ex-partner / good friends / rivals / other); parent-child relationships auto-display as mother-daughter / father-son / mother-son / father-daughter based on gender; the detail page shows relationship details, and the edit page proposes additions and removals
- **Special status** — Cats can be marked as adopted / crossed the rainbow bridge / missing, admin-only; status labels appear on the detail page and cards
- **Statistics** — Number of cats on campus, spay/neuter rate, naming rate, coat color/gender/age distribution charts, daily visits; adopted / rainbow bridge / missing counts listed separately at the bottom
- **Image cache** — Cloud images are cached locally for instant viewing; view the cache size and clear it in one tap on the profile page
- **Profile** — User info, contribution stats, my submissions; tap avatar/nickname to edit personal info; ICP filing displayed
- **My submissions** — View the review status (pending / approved / rejected) of your submitted cats, records, and edit proposals; approved cards link to the cat detail page
- **Review notifications** — After a submission is approved or rejected, notify the user via WeChat subscription messages
- **Admin review** — Admins review new cats, edit proposals, and discovery records, with full cat info and photos available during review
- **Web admin console** — A standalone Vue3 + Element Plus web console (CloudBase static hosting) sharing the cloud development backend with the mini program: review cats/edit proposals/records, edit cat content and photos, record management, user management (roles/bans), sponsorship management, sub-admin management (multi-admin with a super-admin tier), data dashboard; account password + token login
- **Sponsorship** — A "feed a can" page showing the appreciation QR code and a list of supporters

## 🛠 Tech Stack

| Category | Technology |
|------|------|
| Framework | WeChat Mini Program (native) + TypeScript |
| UI components | [Vant Weapp](https://vant-ui.github.io/vant-weapp/) |
| Backend | WeChat Cloud Development (CloudBase) |
| Database | Cloud Database (NoSQL document-based) |
| Storage | Cloud Storage (image upload) |
| Cloud functions | Node.js + wx-server-sdk |
| Web admin | Vue3 + Vite + Element Plus |

## 📁 Project Structure

```
SUATCat/
├── miniprogram/               # Mini program frontend
│   ├── app.ts                 # Entry: cloud init, login, visit tracking
│   ├── app.json               # Routes, tabBar (5 tabs)
│   ├── app.wxss               # Global styles
│   ├── config/index.js        # Global config (env ID, enums, constants)
│   ├── utils/
│   │   ├── api.js             # Cloud function call wrapper
│   │   ├── constants.js       # Routes, storage keys, cloud function names
│   │   ├── imageCache.js      # Image cache utility (download, cache, clear, size)
│   │   └── util.js            # Utility functions (incl. requireProfile identity check)
│   ├── styles/theme.wxss      # Theme colors, CSS variables, utility classes
│   ├── components/
│   │   └── cat-card/          # Cat card component (image cache, border + bg + rounded styles)
│   ├── pages/
│   │   ├── index/             # Home: Banner + 2 random cat recommendations + quick entries
│   │   ├── feed/              # Feed: school-wide reviewed discovery records waterfall (pull-to-refresh + load-more)
│   │   ├── cats/list/         # Profile list: pinned top search + coat/gender/age filters
│   │   ├── cats/detail/       # Cat detail: photos, info, health, relationships, records, sticky notes (with image cache)
│   │   ├── cats/edit/         # Edit proposal: submit cat info corrections + relationship add/remove
│   │   ├── cats/records/      # Full list of records/sticky notes (with image cache)
│   │   ├── upload/            # Upload: new cat (with health status) / add record (with identity check)
│   │   ├── profile/           # Profile: user info, contribution stats, clear cache, edit profile, ICP filing
│   │   │   └── submissions/   #   My submissions: view submission records and review status
│   │   ├── stats/             # Statistics: registered count, spay/neuter rate, distribution charts, visits, pull-to-refresh
│   │   ├── login/             # Login guidance: set avatar and nickname
│   │   ├── support/           # Feed a can: appreciation QR code and supporter list
│   │   ├── admin/             # Admin review panel: new cat review + edit review + record review + info changes
│   │   └── about/             # About ZiMiaoYuan
│   └── typings/index.d.ts     # TypeScript type definitions
├── cloudfunctions/            # Cloud functions
│   ├── login/                 # User login and auto-registration
│   ├── getCats/               # Cat list query (pagination, filtering, search)
│   ├── getCatDetail/          # Cat detail + related records + relationship data
│   ├── addCat/                # Create cat profile (with health status)
│   ├── uploadRecord/          # Upload discovery record / sticky note
│   ├── adminUpdateCat/        # Admin approve, update, delete, review edit proposals, toggle special status
│   ├── proposeEdit/           # User submits edit proposal (with relationship add/remove)
│   ├── getPendingEdits/       # Get pending edit proposal list
│   ├── updateCatRelationship/ # Add/remove cat relationships
│   ├── getUserStats/          # User contribution stats (cats discovered, records, incl. all statuses)
│   ├── getStats/              # Global stats (campus cats, spay/neuter rate, distribution, visits; excludes adopted/rainbow bridge/missing)
│   ├── trackVisit/            # Record daily mini program visits
│   ├── updateUser/            # Update user nickname and avatar
│   ├── rateCat/               # Cat friendliness rating (1-5 stars, one vote per user per cat)
│   ├── getSupporters/         # Get supporter list
│   ├── getSponsorQR/          # Get sponsorship QR code
│   ├── getPendingRecords/     # Get pending discovery records
│   ├── reviewRecord/          # Review discovery records (approve/reject) + edit/delete records
│   ├── getAllRecords/         # Paginated fetch of all reviewed discovery records (feed stream)
│   ├── getCatRecords/         # Paginated fetch of a cat's reviewed discovery records
│   ├── getPendingCounts/      # Get pending counts by type
│   ├── getMySubmissions/      # Get the current user's submissions and review status
│   ├── adminLogin/            # Web admin account/password login (generates token)
│   ├── adminManageAdmins/     # Super admin manages console admins (add/remove / change role / reset password)
│   ├── adminGetImages/        # Batch convert fileID to temporary links (web admin image display)
│   ├── initAdmin/             # One-time initialization of the console admin account
│   ├── getRecords/            # Admin paginated record list (status filter)
│   ├── getUsers/              # Admin paginated user list (search / role / contribution stats)
│   ├── adminUpdateUser/       # Change user role / ban or unban
│   └── adminSupporter/        # Admin add/delete sponsorship records
├── web-admin/                 # Web admin console (Vue3 + Element Plus)
│   ├── src/api.ts             # callFunction wrapper (anonymous login + token injection)
│   ├── src/auth.ts            # token storage in localStorage
│   ├── src/components/CloudImage.vue  # fileID → temporary link image component (with zoom preview)
│   └── src/views/             # Login, review, cat management, record management, user management, dashboard
├── tsconfig.json
└── project.config.json        # WeChat DevTools config
```

## 🎨 Design

A warm, healing campus style. The palette centers on mint green `#7EC8A8`, paired with a creamy beige `#FFF8EC` background and warm orange `#F2A65A` accents. Cat cards use a white background with rounded borders and soft shadows, with a consistent 16rpx corner radius throughout.

## 🚀 Local Development

1. Clone the project and open the root directory in **WeChat DevTools**
2. Fill in your cloud environment ID in `miniprogram/config/index.js`
3. In the terminal, `cd miniprogram/` and run `npm install`
4. In DevTools: **Tools → Build npm**
5. Right-click each cloud function directory under `cloudfunctions/` and choose **Upload and Deploy**

## 📦 Cloud Development

### Database Collections

| Collection | Description |
|------|------|
| `users` | User info (openid, nickname, avatar, role) |
| `cats` | Cat profiles (name, photos, coat color, age, gender, health, status, location) |
| `records` | Discovery records & sticky notes (cat reference, photos, content, author) |
| `editProposals` | Edit proposals (cat reference, proposer, changes, review status) |
| `dailyVisits` | Daily visit counts (date, count; auto-created on first visit) |
| `ratings` | Cat rating records (cat ID, user ID, 1-5 rating) |
| `relationships` | Cat relationships (both cat IDs, relationship type, note) |
| `supporters` | Sponsors (nickname, amount, month) |
| `admins` | Web admin accounts (username, password hash, role: super/admin) |
| `adminTokens` | Web admin login tokens (7-day validity) |
| `settings` | Global feature toggles (whether feed / discovery records / sticky notes are publicly viewable, guest browsing permission, detail page bottom buttons, discover-a-cat entry) |

### User Identity Verification

The `requireProfile()` method in `util.js` checks whether the current user has set a nickname and avatar. The following actions trigger verification:

- Entering the "Profile" page
- Submitting a discovered cat / updating cat photos / editing cat info
- Posting a sticky note

If not set, the user is redirected to the login guidance page and resumes the action after setup.

### Image Cache Mechanism

`cloud://` cloud storage images must be converted to temporary HTTPS links before rendering. `imageCache.js` adds local persistent caching on top of that:

1. Check `imageCacheMap` (a `cloud://` → local path mapping table maintained in Storage)
2. Cache hit → use the local path directly, **no network request needed**
3. Cache miss → `getTempFileURL` conversion → `downloadFile` download → `saveFile` persist to `USER_DATA_PATH`
4. Users can view the cache size and clear it in one tap on the "Profile" page

### User Roles

- `student` (default) — browse, upload, record, write sticky notes
- `admin` — all of the above + review `new cats`, `info edits`, `discovery records`

Manually set the `role` field to `"admin"` in the `users` collection to gain admin privileges.

The web console uses a separate `admins` collection + token authentication, decoupled from the mini program user system (see `web-admin/README.en.md`).

## 📝 Submission Review Flow

All user submissions require admin review:

```
User submits → pending
                  ↓
     admin approve → approved (publicly visible)
     admin reject  → rejected (with a reason)
```

Applies to: new cat profiles, discovery records, sticky notes, and cat info edit proposals.

Review results are sent to users via WeChat subscription messages.

## 🔮 Roadmap

- AI cat recognition (FastAPI + PyTorch backend integration)
- Shareable poster generation
