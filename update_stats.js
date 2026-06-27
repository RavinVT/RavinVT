// Discord Widget Stats Updater
// Fetches YouTube & Twitch stats and updates Discord widget

const DISCORD_APP_ID = "1520449663721799800";
const DISCORD_USER_ID = "798183671047127080";

async function getYouTubeStats() {
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  const apiKey = process.env.YOUTUBE_API_KEY;

  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.items?.length) throw new Error("YouTube channel not found");

  const stats = data.items[0].statistics;
  return {
    yt_subcount: parseInt(stats.subscriberCount),
    yt_videos: parseInt(stats.videoCount),
    yt_viewcount: parseInt(stats.viewCount),
  };
}

async function getTwitchStats() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const username = process.env.TWITCH_USERNAME;

  // Get OAuth token
  const tokenRes = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  const tokenData = await tokenRes.json();
  const access_token = tokenData.access_token;

  console.log("Twitch token status:", tokenRes.status, access_token ? "✅ got token" : "❌ no token");
  console.log("Looking up Twitch username:", username);

  const headers = {
    "Client-Id": clientId,
    Authorization: `Bearer ${access_token}`,
  };

  // Get user info
  const userRes = await fetch(
    `https://api.twitch.tv/helix/users?login=${username}`,
    { headers }
  );
  const userData = await userRes.json();
  console.log("Twitch user response:", JSON.stringify(userData));

  if (!userData.data?.length) throw new Error("Twitch user not found");
  const userId = userData.data[0].id;

  // Get follower count
  const followerRes = await fetch(
    `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${userId}`,
    { headers }
  );
  const followerData = await followerRes.json();

  // Get subscriber count (requires channel:read:subscriptions scope — see note)
  const subRes = await fetch(
    `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${userId}`,
    { headers }
  );
  const subData = await subRes.json();

  const hoursStreamed = parseInt(process.env.TWITCH_HOURS_STREAMED ?? "0");

  return {
    twitch_followers: followerData.total ?? 0,
    twitch_subs: subData.data?.length ?? 1,
    twitch_hours_streamed: hoursStreamed,
  };
}

async function updateDiscordWidget(stats) {
  const url = `https://discord.com/api/v9/applications/${DISCORD_APP_ID}/users/${DISCORD_USER_ID}/identities/0/profile`;

  const body = {
    data: {
      dynamic: Object.entries(stats).map(([name, value]) => ({
        type: 2,
        name,
        value,
      })),
    },
  };

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "User-Agent": "DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord API error ${res.status}: ${text}`);
  }

  console.log("Discord widget updated successfully!");
  console.log("Stats pushed:", stats);
}

async function main() {
  console.log("Fetching YouTube stats...");
  const ytStats = await getYouTubeStats();
  console.log("YouTube:", ytStats);

  console.log("Fetching Twitch stats...");
  const twitchStats = await getTwitchStats();
  console.log("Twitch:", twitchStats);

  const allStats = { ...ytStats, ...twitchStats };

  console.log("Pushing to Discord widget...");
  await updateDiscordWidget(allStats);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
