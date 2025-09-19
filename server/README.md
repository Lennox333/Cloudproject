
---

## Endpoints Table

| Endpoint | Method | Access | Description | Request Body / Query | Response |
|----------|--------|--------|-------------|--------------------|----------|
| `/register` | POST | Public | Register a new user | `{ "username": "example", "password": "pass123" }` | `{ "message": "User registered successfully", "userId": "uuid" }` |
| `/login` | POST | Public | Authenticate user and set JWT cookie | `{ "username": "example", "password": "pass123" }` | `{ "message": "Login successful" }` |
| `/logout` | POST | Authenticated | Clears authentication cookie | None | `{ "message": "Logged out successfully" }` |
| `/profile` | GET | Authenticated | Get logged-in user info | None | `{ "message": "Hello username", "userId": "uuid" }` |
| `/get-upload-url` | POST | Authenticated | Get presigned S3 URL for upload | `{ "filename": "video.mp4", "title": "My Video" }` | `{ "uploadUrl": "...", "videoId": "uuid", "s3Key": "videos/video-uuid-video.mp4" }` |
| `/start-encode` | POST | Authenticated | Save metadata and start transcoding | `{ "videoId": "uuid", "s3Key": "...", "title": "My Video", "description": "optional" }` | `{ "message": "Upload confirmed, transcoding started", "videoId": "uuid" }` |
| `/video/:id/stream` | GET | Public | Get presigned URL for streaming | Query: `res=360/480/720` | `{ "videoUrl": "https://..." }` |
| `/thumbnails/:videoId` | GET | Public | Get presigned URL for thumbnail | None | `{ "thumbnailUrl": "https://..." }` |
| `/videos/:id/status` | GET | Authenticated | Get video processing status | None | `{ "videoId": "uuid", "status": "processing/processed/failed" }` |
| `/videos` | GET | Public | List all videos with optional filters | Query: `upld_before`, `upld_after`, `page`, `limit` | `{ "videos": [...], "total": 100, "page": 1, "limit": 10 }` |
| `/videos/:userId` | GET | Authenticated | List user's videos (owner only) | Query: `upld_before`, `upld_after`, `page`, `limit` | `{ "videos": [...], "total": 10, "page": 1, "limit": 10 }` |
| `/video/:videoId` | DELETE | Authenticated | Delete video metadata and S3 files (owner only) | None | `{ "success": true, "message": "Deleted video-uuid" }` |

---

## Notes
- Videos are only available for streaming after `status = processed`.
- Thumbnails are only available after processing is complete.
- `/videos` and `/videos/:userId` support pagination and filtering by upload dates.
- All videos are public for streaming once processed, but deletion is restricted to the owner.
