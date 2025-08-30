export async function fetchVideos({ conn, userId, upld_before, upld_after, page = 1, limit = 10 }) {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const offset = (pageNum - 1) * limitNum;

  let sql = `SELECT * FROM user_videos WHERE 1=1`;
  const params = [];

  if (userId) {
    sql += " AND user_id = ?";
    params.push(userId);
  }

  if (upld_before) {
    sql += " AND uploaded_at <= ?";
    params.push(upld_before);
  }

  if (upld_after) {
    sql += " AND uploaded_at >= ?";
    params.push(upld_after);
  }

  sql += ` ORDER BY uploaded_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

  const videos = await conn.query(sql, params);

  // total count for pagination
  let countSql = `SELECT COUNT(*) as total FROM user_videos WHERE 1=1`;
  const countParams = [];
  if (userId) countParams.push(userId);
  if (upld_before) countParams.push(upld_before);
  if (upld_after) countParams.push(upld_after);

  const [countResult] = await conn.query(countSql, countParams);
  const total = Number(countResult.total);

  // Convert BigInt safely
  const safeVideos = videos.map((video) => {
    const obj = {};
    for (const key in video) {
      obj[key] = typeof video[key] === "bigint" ? Number(video[key]) : video[key];
    }
    return obj;
  });

  return { videos: safeVideos, total, page: pageNum, limit: limitNum };
}