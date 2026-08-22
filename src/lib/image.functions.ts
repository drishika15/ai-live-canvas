import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { bestImageServer, searchImagesServer, type ImageHit } from "./image-search.server";

const SearchInput = z.object({
  query: z.string().min(1).max(300),
  limit: z.number().int().min(1).max(24).optional(),
  exclude: z.array(z.string()).max(60).optional(),
});

export type ImageSearchHit = ImageHit;

export const searchImagesLive = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }): Promise<ImageHit[]> => {
    return await searchImagesServer(data.query, data.limit ?? 9, data.exclude ?? []);
  });

export const bestImageLive = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }): Promise<ImageHit | null> => {
    return await bestImageServer(data.query, data.exclude ?? []);
  });
