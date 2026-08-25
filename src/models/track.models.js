import mongoose, { Schema } from "mongoose";

const TrackSchema = new Schema(
    {
        playlistId: {
            type: Schema.Types.ObjectId,
            ref: "Playlist",
            required: true,
            index: true,
        },

        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        provider: {
            type: String,
            enum: ["spotify"],
            default: "spotify",
        },

        providerTrackId: {
            type: String,
            required: true,
        },

        title: {
            type: String,
            required: true,
        },

        artists: {
            type: [String],
            required: true,
        },

        album: {
            type: String,
        },

        albumArtUrl: {
            type: String,
        },

        durationMs: {
            type: Number,
        },

        isrc: {
            type: String,
        },

        position: {
            type: Number,
            required: true,
        },

        selectedForTransfer: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

TrackSchema.index({ playlistId: 1, position: 1 });

TrackSchema.index(
    { playlistId: 1, providerTrackId: 1 },
    { unique: true }
);

const trackModel = mongoose.model("Track", TrackSchema);

export default trackModel;