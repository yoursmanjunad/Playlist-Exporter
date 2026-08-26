import { getYouTubeClient } from "../services/youtube/youtube.service.js";

export default async function getYouTubeMe(req, res) {
    try {
        const userId = req.user._id;

        const youtube = await getYouTubeClient(userId);

        const response = await youtube.channels.list({
            part: ["snippet", "contentDetails", "statistics"],
            mine: true
        });

        const channel = response.data.items?.[0];

        if (!channel) {
            return res.status(404).json({
                message: "YouTube channel not found."
            });
        }

        return res.status(200).json({
            youtube: {
                channelId: channel.id,

                name: channel.snippet?.title,

                description:
                    channel.snippet?.description,

                avatarUrl:
                    channel.snippet?.thumbnails?.high?.url ||
                    channel.snippet?.thumbnails?.default?.url,

                country:
                    channel.snippet?.country || null,

                subscribers:
                    channel.statistics?.subscriberCount || null,

                videos:
                    channel.statistics?.videoCount || null,

                views:
                    channel.statistics?.viewCount || null,

                uploadsPlaylistId:
                    channel.contentDetails
                        ?.relatedPlaylists
                        ?.uploads || null
            }
        });

    } catch (error) {
        console.error(
            "Get YouTube user error:",
            error.response?.data || error
        );

        return res.status(500).json({
            message: "Failed to fetch YouTube account."
        });
    }
}