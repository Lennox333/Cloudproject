-- init.sql
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_videos (
    user_id VARCHAR(36) NOT NULL,
    video_id VARCHAR(36) NOT NULL,
    video_title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, video_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
