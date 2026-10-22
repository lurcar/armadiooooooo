export type ChatOutfit = { name: string; occasion: string; reason: string; item_ids: string[] };
export type ChatReply = { message: string; outfits: ChatOutfit[]; error: string | null };
