import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { findYoutubeVideo } from "./video.server";

const VideoInput = z.object({ query: z.string().min(1).max(300) });

export type VideoLookupResult = { id: string; title: string; embedUrl: string } | null;

export const lookupVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VideoInput.parse(input))
  .handler(async ({ data }): Promise<VideoLookupResult> => {
    return await findYoutubeVideo(data.query);
  });
