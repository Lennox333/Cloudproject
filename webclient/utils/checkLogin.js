import { SERVER } from "./globals";

export const checkLogin = async () => {
  try {
    const res = await fetch(`${SERVER}/profile`, {
      credentials: "include", // send cookies
    });

    if (!res.ok) return null; // not logged in

    const data = await res.json();
    return data.userId || null; // return userId if present
  } catch (err) {
    console.error(err);
    return null;
  }
};

